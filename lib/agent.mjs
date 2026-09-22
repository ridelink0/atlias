// atlias as a regular agent: the same harness, flown from a terminal of its own.
// One ship, four engines: Claude Code (claude -p), Codex (codex exec), any
// OpenAI-compatible endpoint, or a local Ollama model. The last two run on
// atlias's own tool loop (lib/loop.mjs). The guard, the gate, the graph
// router, the handoff note and Dream all run here exactly as they do in a host.
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { config, saveSessionMeta, clip } from './core.mjs';
import { logo, colorMode, accent, dim, bold } from './logo.mjs';
import * as router from './router.mjs';
import * as gate from './gate.mjs';
import * as progress from './progress.mjs';
import * as dream from './dream.mjs';
import * as graph from './graph.mjs';
import * as hosts from './hosts.mjs';
import * as extra from './hosts-extra.mjs';
import * as loop from './loop.mjs';
import * as settings from './settings.mjs';
import { recall } from '../mcp/tools.mjs';

export { TOOL_RE, parseToolCall, systemPrompt, insideProject, runTool, transportFor } from './loop.mjs';

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
  return { claude: ok('claude'), codex: ok('codex'), openai: loop.openaiReady(), ollama: ollamaAlive(config().agent.ollamaUrl), echo: true };
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
// The two engines atlias drives itself, through its own tool loop.
export function ollamaTurn(state, prompt, ask, say) {
  return loop.runLoop(state, prompt, { chat: loop.ollamaChat(config().agent), ask, say, native: false });
}
export function openaiTurn(state, prompt, ask, say) {
  const cfg = config().agent;
  return loop.runLoop(state, prompt, { chat: loop.openaiChat(cfg), ask, say, native: cfg.nativeTools !== false });
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
    if (state.engine === 'openai') return openaiTurn(state, input, ask, say);
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
export const ENGINE_ORDER = ['claude', 'codex', 'openai', 'ollama'];
export function pickEngine(requested) {
  const want = requested || config().agent.engine;
  const have = detectEngines();
  if (want && want !== 'auto') return have[want] ? want : null;
  for (const e of ENGINE_ORDER) if (have[e]) return e;
  return null;
}
export const NO_ENGINE = 'install Claude Code (claude) or Codex (codex), run Ollama, or point atlias at any OpenAI-compatible endpoint: atlias config set agent.openaiModel <model> with ATLIAS_API_KEY or OPENAI_API_KEY set (and agent.openaiUrl for anything but OpenAI). --engine echo exercises the loop without a model.';
export async function repl(opts = {}) {
  const cwd = process.cwd();
  const out = (s) => process.stdout.write(s + '\n');
  const engine = pickEngine(opts.engine);
  if (!engine) { out(`${c('no engine found')}: ${NO_ENGINE}`); return 2; }
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
    if (t === '/help') { out(['/engine claude|codex|openai|ollama|echo   switch engine', '/graph <question>                  ask the knowledge graph', '/recall <query>                    search memory and digests', '/progress [set <next step>]        the handoff note', '/plan                              the agent\'s current plan', '/settings                          change any option', '/hosts                             harnesses atlias can see', '/doctor                            harness health', '/exit'].join('\n')); continue; }
    if (t.startsWith('/engine ')) { const e = t.slice(8).trim(); if (detectEngines()[e]) { state.engine = e; state.started = false; state.messages = []; state.textTools = false; out(d(`engine ${e}; the new engine starts a conversation of its own`)); } else out(c(`engine ${e} is not available here`)); continue; }
    if (t.startsWith('/graph ')) { out(graph.query(cwd, t.slice(7), config().graph.queryBudget) || 'no graph here, or no answer'); continue; }
    if (t.startsWith('/recall ')) { out(recall(cwd, t.slice(8))); continue; }
    if (t.startsWith('/progress')) { const rest = t.slice(9).trim(); if (rest.startsWith('set ')) progress.setNext(cwd, rest.slice(4)); out(progress.update(cwd, state.sid, null)); continue; }
    if (t === '/plan') { out(state.todo && state.todo.length ? loop.renderTodo(state.todo) : 'no plan yet; the agent writes one with its todo tool'); continue; }
    if (t === '/settings') { await settings.menu(ask, out); continue; }
    if (t === '/hosts') { out(extra.statusLine()); continue; }
    if (t === '/doctor') { out(hosts.formatDoctor(hosts.doctor(cwd).concat(extra.doctorRows()))); continue; }
    out('\n' + (await turn(state, t, ask, out)) + '\n');
  }
  rl.close();
  const row = dream.distil(state.sid, '', cwd);
  out(d(row ? `session distilled to digest cursor ${row.cursor}; consolidate it with \`atlias dream\`` : 'nothing to distil'));
  return 0;
}

// What typing atlias with nothing after it shows. It asks every time; the
// mode setting (atlias mode sub|standalone) is what makes it stop asking.
export async function chooser() {
  const out = (s) => process.stdout.write(s + '\n');
  out(logo());
  out('');
  out(`  ${b('[1] sub-harness')}   ${d('link atlias into every harness on this machine; its hooks and MCP server run inside them')}`);
  out(`  ${b('[2] regular agent')} ${d('fly atlias here, in this terminal, with Claude Code, Codex, an OpenAI-compatible model or Ollama as the engine')}`);
  out(`  ${b('[3] settings')}      ${d('the mode, the engine, the checks and every other option')}`);
  out('');
  out(d('  ' + extra.statusLine()));
  out(d(`  mode ${settings.mode()}: atlias mode sub or standalone makes this screen go straight to one of them`));
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = String(await rl.question(c('  choose 1, 2 or 3: '))).trim();
  if (answer === '3' || /^set/i.test(answer)) {
    const code = await settings.menu((q) => rl.question(q), out);
    rl.close();
    return code;
  }
  rl.close();
  if (answer === '1' || /^sub/i.test(answer)) {
    out(hosts.installCodex().concat(hosts.installAntigravity(), hosts.installGemini(false), extra.installAll(), hosts.installCompanions()).join('\n'));
    out(hosts.formatDoctor(hosts.doctor(process.cwd()).concat(extra.doctorRows())));
    return 0;
  }
  if (answer === '2' || /^(agent|regular)/i.test(answer)) return repl();
  out(d('nothing chosen; `atlias install` links the harnesses, `atlias agent` flies the ship, `atlias settings` changes options.'));
  return 0;
}
