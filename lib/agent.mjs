// atlias as a regular agent: the same harness, flown from a terminal of its own.
// One ship, three engines: Claude Code (claude -p), Codex (codex exec) or a local
// Ollama model driven by atlias's own tool loop. The guard, the gate, the graph
// router, the handoff note and Dream all run here exactly as they do in a host.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { STATE_DIR, config, readJson, writeJson, run, recordEvent, saveSessionMeta, clip, isCodeFile } from './core.mjs';
import { logo, colorMode, accent, dim, bold } from './logo.mjs';
import * as router from './router.mjs';
import * as guard from './guard.mjs';
import * as gate from './gate.mjs';
import * as progress from './progress.mjs';
import * as dream from './dream.mjs';
import * as graph from './graph.mjs';
import * as hosts from './hosts.mjs';
import * as extra from './hosts-extra.mjs';
import { recall, remember } from '../mcp/tools.mjs';

const MODE = () => colorMode();
const c = (s) => accent(s, MODE());
const d = (s) => dim(s, MODE());
const b = (s) => bold(s, MODE());

// ---------- engines ----------
export const VERSION_PROBE_MS = 5000;
function cli(cmd, args, input, cwd, timeout = 20 * 60 * 1000) {
  const exe = process.platform === 'win32' ? `${cmd}.cmd` : cmd;
  let r = spawnSync(exe, args, { input, encoding: 'utf8', cwd, timeout, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (r.error && r.error.code === 'ENOENT') r = spawnSync(cmd, args, { input, encoding: 'utf8', cwd, timeout, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  return r;
}
export function detectEngines() {
  const ok = (cmd) => cli(cmd, ['--version'], '', process.cwd(), VERSION_PROBE_MS).status === 0;
  return { claude: ok('claude'), codex: ok('codex'), ollama: ollamaAlive(config().agent.ollamaUrl), echo: true };
}
export function ollamaAlive(url) {
  try {
    const u = new URL('/api/tags', url);
    const mod = u.protocol === 'https:' ? 'node:https' : 'node:http';
    const probe = `const http=require(${JSON.stringify(mod)});const q=http.get(${JSON.stringify(u.href)},{timeout:1500},(r)=>process.exit(r.statusCode===200?0:1));q.on('error',()=>process.exit(1));q.on('timeout',()=>{q.destroy();process.exit(1)});`;
    return spawnSync(process.execPath, ['-e', probe], { timeout: 5000, windowsHide: true }).status === 0;
  } catch { return false; }
}
// Claude Code's --session-id takes a UUID and nothing else, so the host gets
// state.hostSid while atlias keeps its own prefixed id for its own files.
export function claudeArgs(state) {
  const base = ['-p', '--output-format', 'text'];
  return state.started ? [...base, '--resume', state.hostSid] : [...base, '--session-id', state.hostSid];
}
export function claudeTurn(state, prompt, deps = {}) {
  const exec = deps.run || cli;
  let r = exec('claude', claudeArgs(state), prompt, state.cwd);
  // A first turn can fail because the host will not take a pinned session at
  // all; a later one can fail because the session is gone. Both recover by
  // asking for the most recent conversation instead.
  if (r.status !== 0 || r.error) r = exec('claude', ['-p', '--output-format', 'text', ...(state.started ? ['--continue'] : [])], prompt, state.cwd);
  state.started = true;
  if (r.status !== 0 || r.error) return `claude failed: ${clip(((r.stderr || '') + (r.error ? r.error.message : '')).trim(), 500)}`;
  return (r.stdout || '').trim();
}
export function codexTurn(state, prompt) {
  // codex exec is one shot, so atlias carries the continuity in the prompt.
  const history = state.history.slice(-6).map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${clip(h.text, 1200)}`).join('\n');
  const full = history ? `Earlier in this session:\n${history}\n\nNow the user says:\n${prompt}` : prompt;
  let r = cli('codex', ['exec', '-'], full, state.cwd);
  if (r.status !== 0 || r.error) r = cli('codex', ['exec', full], '', state.cwd);
  if (r.status !== 0 || r.error) return `codex failed: ${clip(((r.stderr || '') + (r.error ? r.error.message : '')).trim(), 500)}`;
  return (r.stdout || '').trim();
}
// A remote Ollama is reached over https, and the wrong module fails with a
// protocol error that names nothing useful.
export function transportFor(url) {
  try { return new URL(url).protocol === 'https:' ? https : http; } catch { return http; }
}
export function ollamaChat(url, model, messages) {
  return new Promise((resolve) => {
    const u = new URL('/api/chat', url);
    const body = JSON.stringify({ model, messages, stream: false, options: { temperature: 0.2 } });
    const req = transportFor(u.href).request({ hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname, method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }, timeout: 10 * 60 * 1000 }, (res) => {
      let data = '';
      res.on('data', (x) => { data += x; });
      res.on('end', () => { try { resolve(JSON.parse(data).message.content || ''); } catch { resolve(`ollama returned something unexpected: ${clip(data, 300)}`); } });
    });
    req.on('error', (e) => resolve(`ollama failed: ${e.message}`));
    req.on('timeout', () => { req.destroy(); resolve('ollama timed out'); });
    req.end(body);
  });
}

// ---------- the native tool loop ----------
export const TOOL_RE = /```atlias\s*\n([\s\S]*?)```/;
export function parseToolCall(text) {
  const m = TOOL_RE.exec(String(text || ''));
  if (!m) return null;
  try { const j = JSON.parse(m[1]); return j && typeof j.tool === 'string' ? j : null; } catch { return null; }
}
export function systemPrompt(cwd) {
  const hasGraph = graph.status(cwd).exists;
  return [`You are atlias, a coding agent working in ${cwd}. Be precise, verify before claiming, never invent a result.`,
    'To use a tool, reply with ONLY one fenced block and nothing else:',
    '```atlias', '{"tool":"read_file","path":"src/app.js"}', '```',
    'Tools: read_file{path}; write_file{path,content}; list_dir{path}; grep{pattern,path}; shell{command}; recall{query}; remember{name,type,description,body}' + (hasGraph ? '; graph_query{question} (cheap, ask it before reading files)' : '') + '.',
    'After a tool result you get another turn. When the task is done, answer in plain text with no block, and end with one line naming the check you ran and the second adversarial read you did.'].join('\n');
}
// Is this path inside the directory the agent was started in?
export function insideProject(cwd, target) {
  const rel = path.relative(path.resolve(cwd), path.resolve(target));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}
export async function runTool(state, call, ask) {
  const cwd = state.cwd;
  const abs = (p) => (path.isAbsolute(p || '') ? p : path.join(cwd, p || ''));
  try {
    switch (call.tool) {
      case 'read_file': return clip(fs.readFileSync(abs(call.path), 'utf8'), 12000);
      case 'list_dir': return fs.readdirSync(abs(call.path || '.'), { withFileTypes: true }).map((e) => (e.isDirectory() ? e.name + '/' : e.name)).slice(0, 300).join('\n');
      case 'grep': {
        const r = run('git', ['grep', '-n', '-I', '--', String(call.pattern || '')], { cwd: abs(call.path || '.'), timeout: 20000 });
        return clip(r.stdout || r.stderr || '(no matches)', 8000);
      }
      case 'write_file': {
        const p = abs(call.path);
        if (!insideProject(cwd, p)) {
          const answer = ask ? String(await ask(`${c('guard')}: ${p} is outside ${cwd}. Write it anyway? [y/N] `)).trim().toLowerCase() : 'n';
          if (answer !== 'y' && answer !== 'yes') return `refused: ${p} is outside the project. Nothing was written. Ask the user for the change, or start atlias in the directory that owns that file.`;
        }
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, String(call.content ?? ''));
        recordEvent(state.sid, { kind: 'edit', tool: 'write_file', files: [p] });
        if (isCodeFile(p)) { const f = gate.syntaxCheck([p]); if (f.length) return `written, but it does not parse: ${f[0].error}`; }
        return `written ${p}`;
      }
      case 'shell': {
        const cmd = String(call.command || '');
        const why = guard.destructiveReason(cmd);
        if (why) {
          const answer = ask ? String(await ask(`${c('guard')}: ${why}. Run "${clip(cmd, 120)}"? [y/N] `)).trim().toLowerCase() : 'n';
          if (answer !== 'y' && answer !== 'yes') return `refused by the user: ${why}`;
        }
        const r = spawnSync(cmd, { shell: true, cwd, encoding: 'utf8', timeout: 10 * 60 * 1000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
        recordEvent(state.sid, { kind: 'shell', command: clip(cmd, 300), verify: /\b(test|check|lint|compile|build)\b/i.test(cmd) });
        return clip(`exit ${r.status}\n${r.stdout || ''}${r.stderr ? '\n' + r.stderr : ''}`, 12000);
      }
      case 'recall': return recall(cwd, call.query);
      case 'remember': return remember(cwd, call);
      case 'graph_query': return graph.query(cwd, call.question, config().graph.queryBudget) || 'no graph here, or no answer';
      default: return `unknown tool ${call.tool}; the tools are read_file, write_file, list_dir, grep, shell, recall, remember, graph_query`;
    }
  } catch (e) { return `tool ${call.tool} failed: ${e.message}`; }
}
export async function ollamaTurn(state, prompt, ask, say) {
  const cfg = config().agent;
  if (!state.messages.length) state.messages.push({ role: 'system', content: systemPrompt(state.cwd) });
  state.messages.push({ role: 'user', content: prompt });
  const seen = new Map();
  for (let round = 0; round < cfg.maxToolRounds; round++) {
    const reply = await ollamaChat(cfg.ollamaUrl, cfg.ollamaModel, state.messages);
    state.messages.push({ role: 'assistant', content: reply });
    const call = parseToolCall(reply);
    if (!call) return reply.trim();
    const key = JSON.stringify(call);
    seen.set(key, (seen.get(key) || 0) + 1);
    if (seen.get(key) >= config().guard.loopThreshold) {
      state.messages.push({ role: 'user', content: 'atlias guard: that exact tool call has repeated and returns the same result. Change the input or the approach, or answer with what you already know.' });
      continue;
    }
    if (say) say(d(`  tool ${call.tool} ${clip(call.path || call.command || call.query || call.question || '', 80)}`));
    state.messages.push({ role: 'user', content: `Tool result for ${call.tool}:\n${await runTool(state, call, ask)}` });
  }
  return 'atlias: the tool loop reached its round limit. Last thing it said: ' + clip(state.messages[state.messages.length - 1].content, 600);
}

// ---------- the loop ----------
export function newState(cwd, engine) {
  const hostSid = crypto.randomUUID();
  const sid = 'atlias-' + hostSid;
  saveSessionMeta(sid, { host: 'atlias', cwd, source: 'startup', started: Date.now(), engine });
  return { sid, hostSid, cwd, engine, started: false, history: [], messages: [] };
}
export async function turn(state, text, ask, say) {
  const routed = router.prompt({ session_id: state.sid, cwd: state.cwd, prompt: text });
  const extraContext = routed && routed.hookSpecificOutput ? routed.hookSpecificOutput.additionalContext : '';
  const prompt = extraContext ? `${extraContext}\n\n${text}` : text;
  const engineTurn = async (input) => {
    if (state.engine === 'claude') return claudeTurn(state, input);
    if (state.engine === 'codex') return codexTurn(state, input);
    if (state.engine === 'ollama') return ollamaTurn(state, input, ask, say);
    return `echo: ${input}`;
  };
  let reply = await engineTurn(prompt);
  state.history.push({ role: 'user', text }, { role: 'assistant', text: reply });
  const held = gate.stop({ session_id: state.sid, cwd: state.cwd, last_assistant_message: reply });
  if (held && held.decision === 'block' && state.engine !== 'echo') {
    if (say) say(c('gate') + d(': ' + clip(held.reason.split('\n')[0], 110)));
    const second = await engineTurn(held.reason);
    state.history.push({ role: 'user', text: held.reason }, { role: 'assistant', text: second });
    reply = `${reply}\n\n${second}`;
  }
  return reply;
}
export function pickEngine(requested) {
  const want = requested || config().agent.engine;
  const have = detectEngines();
  if (want && want !== 'auto') return have[want] ? want : null;
  for (const e of ['claude', 'codex', 'ollama']) if (have[e]) return e;
  return null;
}
export async function repl(opts = {}) {
  const cwd = process.cwd();
  const out = (s) => process.stdout.write(s + '\n');
  const engine = pickEngine(opts.engine);
  if (!engine) { out(`${c('no engine found')}: install Claude Code (claude), Codex (codex) or run Ollama. --engine echo exercises the loop without a model.`); return 2; }
  const state = newState(cwd, engine);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => rl.question(q);
  if (opts.once) { out(await turn(state, opts.once, ask, out)); rl.close(); dream.distil(state.sid, '', cwd); return 0; }
  out(logo());
  out(d(`engine ${engine}   project ${cwd}   memory shared with Claude Code   /help for commands`));
  if (progress.read(cwd)) out(d('a handoff note from earlier work is here; /progress shows it'));
  for (;;) {
    let line;
    try { line = await rl.question(c('you> ')); } catch { break; }
    const t = String(line || '').trim();
    if (!t) continue;
    if (t === '/exit' || t === '/quit') break;
    if (t === '/help') { out(['/engine claude|codex|ollama|echo   switch engine', '/graph <question>                  ask the knowledge graph', '/recall <query>                    search memory and digests', '/progress [set <next step>]        the handoff note', '/hosts                             harnesses atlias can see', '/doctor                            harness health', '/exit'].join('\n')); continue; }
    if (t.startsWith('/engine ')) { const e = t.slice(8).trim(); if (detectEngines()[e]) { state.engine = e; state.started = false; state.messages = []; out(d(`engine ${e}; the new engine starts a conversation of its own`)); } else out(c(`engine ${e} is not available here`)); continue; }
    if (t.startsWith('/graph ')) { out(graph.query(cwd, t.slice(7), config().graph.queryBudget) || 'no graph here, or no answer'); continue; }
    if (t.startsWith('/recall ')) { out(recall(cwd, t.slice(8))); continue; }
    if (t.startsWith('/progress')) { const rest = t.slice(9).trim(); if (rest.startsWith('set ')) progress.setNext(cwd, rest.slice(4)); out(progress.update(cwd, state.sid, null)); continue; }
    if (t === '/hosts') { out(extra.statusLine()); continue; }
    if (t === '/doctor') { out(hosts.formatDoctor(hosts.doctor(cwd).concat(extra.doctorRows()))); continue; }
    out('\n' + (await turn(state, t, ask, out)) + '\n');
  }
  rl.close();
  const row = dream.distil(state.sid, '', cwd);
  out(d(row ? `session distilled to digest cursor ${row.cursor}; consolidate it with \`atlias dream\`` : 'nothing to distil'));
  return 0;
}
export async function chooser() {
  const out = (s) => process.stdout.write(s + '\n');
  out(logo());
  out('');
  out(`  ${b('[1] sub-harness')}   ${d('link atlias into every harness on this machine; its hooks and MCP server run inside them')}`);
  out(`  ${b('[2] regular agent')} ${d('fly atlias here, in this terminal, with Claude Code, Codex or a local Ollama model as the engine')}`);
  out('');
  out(d('  ' + extra.statusLine()));
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = String(await rl.question(c('  choose 1 or 2: '))).trim();
  rl.close();
  const p = path.join(STATE_DIR, 'config.json');
  const user = readJson(p, {}) || {};
  if (answer === '1' || /^sub/i.test(answer)) {
    user.agent = { ...(user.agent || {}), mode: 'sub-harness' };
    writeJson(p, user);
    out(hosts.installCodex().concat(hosts.installAntigravity(), hosts.installGemini(false), extra.installAll(), hosts.installCompanions()).join('\n'));
    out(hosts.formatDoctor(hosts.doctor(process.cwd()).concat(extra.doctorRows())));
    return 0;
  }
  if (answer === '2' || /^(agent|regular)/i.test(answer)) {
    user.agent = { ...(user.agent || {}), mode: 'agent' };
    writeJson(p, user);
    return repl();
  }
  out(d('nothing chosen; `atlias install` links the harnesses, `atlias agent` flies the ship.'));
  return 0;
}
