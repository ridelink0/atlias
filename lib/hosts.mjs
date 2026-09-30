// Host adapters. Claude Code gets everything from the plugin itself; Codex,
// Antigravity and Gemini CLI get the same hooks and the same MCP server written
// into their own config files, always inside marked, idempotent blocks.
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { whichAtlias, launcherPath, CLI_LAUNCHER_SOURCE } from './shortcut.mjs';
import { ROOT, VERSION, CODEX_DIR, GEMINI_DIR, CLAUDE_DIR, START_MARK, END_MARK, readText, writeText, readJson, writeJson, exists, run, findPython, claudeMemoryDir, writeLauncher, writeHooksLauncher, isVersionedPath, LAUNCHER, installedRoots, config, ufsCopies, ufsInstallPlan, idrCopies, idrInstallPlan } from './core.mjs';

const VISUAL_ON = ['compact', 'subagent'];
export const HOOKS_MJS = path.join(ROOT, 'lib', 'hooks.mjs');
export const SERVER_MJS = path.join(ROOT, 'mcp', 'server.mjs');
// What goes into a host config: the launcher when this copy sits at a path
// that will expire with the next update, the file itself when it will not.
export function serverPathForConfig() {
  if (!isVersionedPath(ROOT)) return SERVER_MJS;
  try { return writeLauncher(ROOT); } catch { return SERVER_MJS; }
}
// The same rule for the hooks: a versioned copy writes ~/.atlias/hooks.mjs and
// the hosts point there, so an update cannot strand every hook.
export function hooksPathForConfig() {
  if (!isVersionedPath(ROOT)) return HOOKS_MJS;
  try { return writeHooksLauncher(ROOT); } catch { return HOOKS_MJS; }
}
// And for the CLI line in the instruction blocks: ~/.atlias/cli.mjs.
export function cliPathForConfig() {
  const direct = path.join(ROOT, 'bin', 'atlias.mjs');
  if (!isVersionedPath(ROOT)) return direct;
  try {
    const launcher = launcherPath();
    if (!exists(launcher)) writeText(launcher, CLI_LAUNCHER_SOURCE);
    return launcher;
  } catch { return direct; }
}
const q = (p) => `"${p.replace(/\\/g, '/')}"`;
export function hookCommand(event, host) { return `node ${q(hooksPathForConfig())} ${event} --host ${host}`; }

// The tool hooks get 30 seconds, as Stop does. A host cancels a command hook
// that reaches its timeout and drops its output, and under the load of the
// 3.8.1 study Claude Code cancelled 80 atlias hook calls at 8 seconds; a
// cancelled PostToolUse leaves a check that ran unrecorded. The matcher stays
// ".*" for Codex: which tool names Codex hands its hooks is not established
// here, so nothing is narrowed on a guess.
export const CODEX_EVENTS = [
  ['SessionStart', 'session-start', 45], ['UserPromptSubmit', 'prompt', 15], ['PreToolUse', 'pre-tool', 30, '.*'], ['PostToolUse', 'post-tool', 30, '.*'],
  ['PreCompact', 'pre-compact', 15], ['PostCompact', 'post-compact', 10], ['Stop', 'stop', 30], ['SubagentStop', 'subagent-stop', 8], ['SessionEnd', 'session-end', 5],
];
export const GEMINI_EVENTS = [
  ['SessionStart', 'session-start', 20000], ['BeforeAgent', 'prompt', 15000], ['BeforeTool', 'pre-tool', 30000], ['AfterTool', 'post-tool', 30000],
  ['PreCompress', 'pre-compact', 15000], ['AfterAgent', 'stop', 30000], ['SessionEnd', 'session-end', 5000],
];

const isOurs = (h) => h && typeof h.command === 'string' && /atlias/i.test(h.command);
const esc = (s) => s.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
// TOML has two string forms and only one of them takes escapes. A literal
// string cannot contain an apostrophe at any price, so a path that has one
// has to be written as a basic string instead.
export function tomlString(value) {
  const v = String(value);
  if (!v.includes("'")) return "'" + v + "'";
  return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

export function mergeHooksJson(existing, host, events = CODEX_EVENTS, provided = new Set()) {
  const doc = existing && typeof existing === 'object' ? { ...existing } : {};
  const hooks = { ...(doc.hooks || {}) };
  for (const [event, ours, timeout, matcher] of events) {
    const groups = (hooks[event] || []).map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !isOurs(h)) })).filter((g) => g.hooks.length);
    if (!provided.has(event)) {
      const group = { hooks: [{ type: 'command', command: hookCommand(ours, host), timeout, statusMessage: 'atlias' }] };
      if (matcher) group.matcher = matcher;
      groups.push(group);
    }
    hooks[event] = groups;
  }
  doc.hooks = hooks;
  return doc;
}

// The native plugin and a manual install can register the same hooks twice.
// Only opt-in lean installs reuse a verified native registration. Unknown CLI
// metadata, missing copies or incomplete matchers retain the global coverage.
export function nativeCodexHookEvents({ probe = () => run('codex', ['plugin', 'list', '--marketplace', 'atlias', '--json'], { timeout: 5000 }), dir = CODEX_DIR } = {}) {
  const covered = new Set();
  try {
    const result = probe();
    if (result.status !== 0) return covered;
    const installed = JSON.parse(result.stdout).installed;
    if (!Array.isArray(installed)) return covered;
    const plugin = installed.find(p => p.pluginId === 'atlias@atlias' && p.installed === true && p.enabled === true);
    if (!plugin || !/^\d+\.\d+\.\d+$/.test(plugin.version)) return covered;
    const root = path.join(dir, 'plugins', 'cache', 'atlias', 'atlias', plugin.version);
    const manifest = readJson(path.join(root, '.codex-plugin', 'plugin.json'));
    if (manifest?.name !== 'atlias' || !exists(path.join(root, 'lib', 'hooks.mjs'))) return covered;
    // A stale native copy may still misidentify Codex as Claude. Reusing its
    // registration must never discard newer host/guard fixes from this copy.
    const sources = (base, rel = 'lib', budget = { left: 512 }) => {
      if (rel.split(path.sep).length > 16) throw Error('native source depth');
      const entries = fs.readdirSync(path.join(base, rel), { withFileTypes: true });
      budget.left -= entries.length;
      if (budget.left < 0) throw Error('native source count');
      return entries.flatMap(e => e.isDirectory() ? sources(base, path.join(rel, e.name), budget) : [path.join(rel, e.name)]).sort();
    };
    const runtimeDirs = ['lib', 'mcp', 'skills', 'scripts', 'py'].filter(rel => exists(path.join(ROOT, rel)));
    const ours = ['package.json', ...runtimeDirs.flatMap(rel => sources(ROOT, rel))].sort();
    const theirs = ['package.json', ...runtimeDirs.flatMap(rel => sources(root, rel))].sort();
    if (JSON.stringify(ours) !== JSON.stringify(theirs) || ours.some(file => fs.statSync(path.join(ROOT, file)).size !== fs.statSync(path.join(root, file)).size || !fs.readFileSync(path.join(ROOT, file)).equals(fs.readFileSync(path.join(root, file))))) return covered;
    const hooks = readJson(path.join(root, 'hooks', 'hooks.json'))?.hooks;
    if (!hooks || typeof hooks !== 'object') return covered;
    const settings = readText(path.join(dir, 'config.toml')) || '';
    const trusted = (key) => {
      let active = false, block = '';
      for (const line of settings.split(/\r?\n/)) {
        if (/^\s*\[/.test(line)) {
          const header = /^\s*\[hooks\.state\.(["'])(.*?)\1\]\s*(?:#.*)?$/.exec(line);
          active = header?.[2] === key;
        } else if (active) block += line + '\n';
      }
      return /^\s*trusted_hash\s*=\s*["']sha256:[a-f0-9]{64}["']\s*(?:#.*)?$/m.test(block)
        && !/^\s*(?:enabled\s*=\s*false|disabled\s*=\s*true)\s*(?:#.*)?$/m.test(block);
    };
    for (const [event, name] of CODEX_EVENTS) {
      if (!Array.isArray(hooks[event])) continue;
      const expected = new RegExp('^node\\s+"\\$\\{(?:CLAUDE|CODEX)_PLUGIN_ROOT\\}/lib/hooks\\.mjs"\\s+' + name + '(?:\\s+--host\\s+codex)?\\s*$');
      const eventKey = event.replace(/[A-Z]/g, (letter, i) => (i ? '_' : '') + letter.toLowerCase());
      if (hooks[event].some((g, i) => g && g.enabled !== false && g.disabled !== true && (g.matcher == null || g.matcher === '.*') && Array.isArray(g.hooks) && g.hooks.some((h, j) => h?.type === 'command' && h.enabled !== false && h.disabled !== true && expected.test(h.command || '') && trusted(`atlias@atlias:hooks/hooks.json:${eventKey}:${i}:${j}`)))) covered.add(event);
    }
  } catch { /* inability to prove native coverage leaves the global hooks */ }
  return covered;
}
export function stripHooksJson(existing) {
  const doc = existing && typeof existing === 'object' ? { ...existing } : {};
  const hooks = {};
  for (const [event, groups] of Object.entries(doc.hooks || {})) {
    const kept = (groups || []).map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !isOurs(h)) })).filter((g) => g.hooks.length);
    if (kept.length) hooks[event] = kept;
  }
  doc.hooks = hooks;
  return doc;
}
export function mergeGeminiSettings(existing, withHooks) {
  const doc = existing && typeof existing === 'object' ? { ...existing } : {};
  doc.mcpServers = { ...(doc.mcpServers || {}), atlias: { command: 'node', args: [serverPathForConfig()] } };
  if (withHooks) {
    const hooks = { ...(doc.hooks || {}) };
    for (const [event, ours, timeout] of GEMINI_EVENTS) {
      const groups = (hooks[event] || []).map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !isOurs(h)) })).filter((g) => g.hooks.length);
      groups.push({ hooks: [{ type: 'command', name: `atlias ${ours}`, command: hookCommand(ours, 'gemini'), timeout }] });
      hooks[event] = groups;
    }
    doc.hooks = hooks;
  }
  return doc;
}
function dropAtliasTables(text) {
  const out = [];
  let skipping = false;
  for (const l of String(text || '').split(/\r?\n/)) {
    if (/^\s*\[mcp_servers\.atlias(\.|\])/.test(l)) { skipping = true; continue; }
    if (skipping && /^\s*\[/.test(l)) skipping = false;
    if (!skipping) out.push(l);
  }
  return out;
}
export function mergeToml(text) {
  const out = dropAtliasTables(text);
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  const block = ['', '[mcp_servers.atlias]', "command = 'node'", `args = [${tomlString(serverPathForConfig())}]`, 'env_vars = ["ATLIAS_FLAG_LEAN_BRIEF"]', 'startup_timeout_sec = 30', ''];
  return out.concat(block).join('\n');
}
export function stripToml(text) { return dropAtliasTables(text).join('\n').replace(/\n{3,}/g, '\n\n'); }
export function mergeBlock(text, body) {
  const t = String(text || '');
  const block = `${START_MARK}\n${body.trim()}\n${END_MARK}`;
  const re = new RegExp(`${esc(START_MARK)}[\\s\\S]*?${esc(END_MARK)}`);
  if (re.test(t)) return t.replace(re, () => block);
  return `${t.replace(/\s*$/, '')}\n\n${block}\n`;
}
export function stripBlock(text) {
  const re = new RegExp(`\\n*${esc(START_MARK)}[\\s\\S]*?${esc(END_MARK)}\\n*`);
  return String(text || '').replace(re, '\n');
}

// Accepts either a host id or a display name, so a caller with a proper name
// for its harness can pass it straight through rather than being told it is
// Antigravity.
export const HOST_NAMES = { claude: 'Claude Code', codex: 'Codex', gemini: 'Gemini CLI', antigravity: 'Antigravity' };
export function instructionBlock(host, { lean = Boolean(config().flags?.leanBrief) } = {}) {
  const label = HOST_NAMES[host] || String(host || 'this agent');
  const memIndex = path.join(CLAUDE_DIR, 'projects', '<project-slug>', 'memory', 'MEMORY.md');
  if (host === 'codex' && lean) return `## atlias sub-harness (shared with Claude Code)

atlias ${VERSION}; MCP \`atlias\`; shared Claude Code memory. Reuse SessionStart context and rules.

- If SessionStart says no saved memory, skip recall/index reads. Otherwise use its index; if absent or truncated, read \`${memIndex}\` (slug: project path separators to dashes), then relevant bodies. Save facts: \`harness_remember\`.
- When a graph exists: \`graph_query\` first, then named files; no graph, read active files. Risky changes: \`graph_affected\`; one symbol: \`graph_explain\`.
- Fetch \`harness_progress get\` only when resuming without a supplied handoff. Save next step before compaction/long work: \`harness_progress set\`.
- \`harness_verify\`: syntax floor. Run the smallest real check, then adversarially re-read every changed file; report both passes.
- \`harness_digest show\`: consolidate facts, then \`harness_digest ack\`.
- Do not repeat identical failed calls. Confirm destructive commands with Gev.
- CLI: \`node ${q(cliPathForConfig())} doctor|status|recall|dream\`.`;
  return `## atlias sub-harness (shared with Claude Code)

atlias ${VERSION} links ${label} to the same memory, knowledge graph and working rules Claude Code uses. Its MCP server is registered as \`atlias\`.

- Start of any task: the memory index for the current project is at \`${memIndex}\` (slug = the project path with every separator replaced by a dash). Read it, then read the files it names that the task touches. Save new durable facts with the \`harness_remember\` tool so Claude Code sees them too.
- Codebase question: call \`graph_query\` first (graphify knowledge graph, a few hundred tokens), then open only the files it names. \`graph_affected\` before a risky change, \`graph_explain\` for one symbol.
- Before compaction or a long task, write the next step with \`harness_progress set\`; read the handoff with \`harness_progress get\` when you start.
- \`harness_verify\` syntax-checks changed files. Done means: smallest real check run, then a second adversarial read of every changed file, and the reply names both passes.
- \`harness_digest show\` lists sessions waiting for memory consolidation; fold the durable facts into memory, then \`harness_digest ack\`.
- Never repeat an identical call that already failed; change the input or the approach. Confirm destructive commands with the user.
- CLI: \`node ${q(cliPathForConfig())} doctor|status|recall|dream\`.`;
}

export function installCodex() {
  const out = [];
  const hooksPath = path.join(CODEX_DIR, 'hooks.json');
  const native = config().flags?.leanBrief ? nativeCodexHookEvents() : new Set();
  const merged = mergeHooksJson(readJson(hooksPath, {}) || {}, 'codex', CODEX_EVENTS, native);
  if (!merged.description) merged.description = 'Hooks for Codex. Managed entries are marked by the script that wrote them.';
  writeJson(hooksPath, merged);
  out.push(native.size ? `codex hooks: ${hooksPath} (${CODEX_EVENTS.length - native.size} global events; ${native.size} supplied by the enabled native plugin)` : `codex hooks: ${hooksPath} (${CODEX_EVENTS.length} events)`);
  const tomlPath = path.join(CODEX_DIR, 'config.toml');
  writeText(tomlPath, mergeToml(readText(tomlPath) || ''));
  out.push(`codex mcp: [mcp_servers.atlias] in ${tomlPath}`);
  const agents = path.join(CODEX_DIR, 'AGENTS.md');
  writeText(agents, mergeBlock(readText(agents) || '', instructionBlock('codex')));
  out.push(`codex instructions: block in ${agents}`);
  return out;
}
export function uninstallCodex() {
  const hooksPath = path.join(CODEX_DIR, 'hooks.json');
  if (exists(hooksPath)) writeJson(hooksPath, stripHooksJson(readJson(hooksPath, {})));
  const tomlPath = path.join(CODEX_DIR, 'config.toml');
  if (exists(tomlPath)) writeText(tomlPath, stripToml(readText(tomlPath)));
  const agents = path.join(CODEX_DIR, 'AGENTS.md');
  if (exists(agents)) writeText(agents, stripBlock(readText(agents)));
  return ['codex: hooks, mcp server and instruction block removed'];
}
export function installAntigravity() {
  const out = [];
  const mcpPath = path.join(GEMINI_DIR, 'config', 'mcp_config.json');
  const doc = readJson(mcpPath, {}) || {};
  doc.mcpServers = { ...(doc.mcpServers || {}), atlias: { command: 'node', args: [serverPathForConfig()] } };
  writeJson(mcpPath, doc);
  out.push(`antigravity mcp: ${mcpPath}`);
  const gem = path.join(GEMINI_DIR, 'GEMINI.md');
  writeText(gem, mergeBlock(readText(gem) || '', instructionBlock('antigravity')));
  out.push(`antigravity instructions: block in ${gem} (Antigravity has no hook API; memory, graph and rules arrive through MCP and this block)`);
  return out;
}
export function uninstallAntigravity() {
  const mcpPath = path.join(GEMINI_DIR, 'config', 'mcp_config.json');
  const doc = readJson(mcpPath);
  if (doc && doc.mcpServers) { delete doc.mcpServers.atlias; writeJson(mcpPath, doc); }
  const gem = path.join(GEMINI_DIR, 'GEMINI.md');
  if (exists(gem)) writeText(gem, stripBlock(readText(gem)));
  return ['antigravity: mcp server and instruction block removed'];
}
export function installGemini(withHooks) {
  const p = path.join(GEMINI_DIR, 'settings.json');
  writeJson(p, mergeGeminiSettings(readJson(p, {}) || {}, withHooks));
  return [`gemini cli: mcp server${withHooks ? ' and hooks (output shape UNVERIFIED against Gemini docs; remove with uninstall --gemini if a hook misbehaves)' : ''} in ${p}`];
}
export function uninstallGemini() {
  const p = path.join(GEMINI_DIR, 'settings.json');
  const doc = readJson(p);
  if (!doc) return ['gemini cli: nothing installed'];
  if (doc.mcpServers) delete doc.mcpServers.atlias;
  const stripped = stripHooksJson(doc);
  if (Object.keys(stripped.hooks).length) doc.hooks = stripped.hooks; else delete doc.hooks;
  writeJson(p, doc);
  return ['gemini cli: mcp server and hooks removed'];
}
const tail = (r) => r.error || (r.stderr || r.stdout).trim().split(/\r?\n/).pop() || 'failed';

// Start a server the way a host would and read back what it says it is.
// Existing is not the same as working, and the difference is invisible
// until a host quietly has no tools.
export function probeServer(serverPath, timeout = 10000) {
  if (!exists(serverPath)) return { ok: false, detail: 'not there' };
  const hello = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'atlias doctor', version: VERSION } } }) + '\n';
  const r = run(process.execPath, [serverPath], { timeout, input: hello });
  try {
    const line = (r.stdout || '').trim().split(/\r?\n/).find((l) => l.includes('serverInfo'));
    const info = JSON.parse(line).result.serverInfo;
    return { ok: true, detail: `answers as ${info.name} ${info.version}` };
  } catch { return { ok: false, detail: ((r.stderr || r.stdout || 'no answer').trim().split(/\r?\n/)[0] || '').slice(0, 120) }; }
}
export function installClaude(source) {
  const out = [];
  const src = source || ROOT;
  const r1 = run('claude', ['plugin', 'marketplace', 'add', src], { timeout: 90000 });
  out.push(`claude plugin marketplace add ${src}: ${r1.status === 0 ? 'ok' : tail(r1)}`);
  const r2 = run('claude', ['plugin', 'install', 'atlias@atlias'], { timeout: 120000 });
  out.push(`claude plugin install atlias@atlias: ${r2.status === 0 ? 'ok' : tail(r2)}`);
  if (r1.status !== 0 || r2.status !== 0) out.push('If the claude CLI is not on PATH, run inside Claude Code: /plugin marketplace add ridelink0/atlias, then /plugin install atlias@atlias');
  return out;
}
export function installCompanions() {
  const out = [];
  // A cached "not found" from an earlier session must not decide an install:
  // look again, pipx and venv copies included, before adding a second graphify.
  if (!findPython({ fresh: true })) {
    const r = process.platform === 'win32' ? run('py', ['-3', '-m', 'pip', 'install', '--quiet', 'graphifyy'], { timeout: 300000 }) : run('python3', ['-m', 'pip', 'install', '--quiet', 'graphifyy'], { timeout: 300000 });
    out.push(`graphify: ${r.status === 0 && findPython({ fresh: true }) ? 'installed' : 'not installed (pip install graphifyy by hand)'}`);
  } else out.push('graphify: present');
  // Never a second copy: any copy under any of UFS's names, even one that is
  // only switched off, means there is nothing to install.
  const plan = ufsInstallPlan(ufsCopies());
  const idrPlan = idrInstallPlan(idrCopies(), plan);
  if (!plan.install) out.push(plan.say);
  else {
    const r1 = run('claude', ['plugin', 'marketplace', 'add', 'ridelink0/ultimate-frontend-skills'], { timeout: 90000 });
    const r2 = r1.status === 0 ? run('claude', ['plugin', 'install', 'ultimate-frontend-skills@ultimate-frontend-skills'], { timeout: 120000 }) : r1;
    out.push(`ultimate-frontend-skills: ${r2.status === 0 ? 'installed' : 'not installed (run /plugin marketplace add ridelink0/ultimate-frontend-skills inside Claude Code)'}`);
  }
  // atlias never installs image-deep-research itself; it says where the copy is
  // or how one arrives.
  out.push(idrPlan.say);
  return out;
}

// Chrome candidates on this machine for the fix text of a failed browser row.
function browserCandidates(home) {
  if (process.platform !== 'linux') return [];
  const found = [];
  for (const [root, sub] of [['/opt/pw-browsers', 'chrome-linux/chrome'], [path.join(home, '.cache', 'ms-playwright'), 'chrome-linux/chrome']]) {
    let names = [];
    try { names = fs.readdirSync(root).filter((n) => n.startsWith('chromium-')).sort(); } catch { /* absent */ }
    for (const n of names) { const p = path.join(root, n, sub); if (exists(p)) found.push(p); }
  }
  return found;
}
// Runs image-deep-research's own browser lookup, so the check agrees with what
// the skill will do. spawn, uid and home are injectable for tests.
export function idrBrowserRow(dir, deps = {}) {
  const spawn = deps.spawn || spawnSync;
  const uid = 'uid' in deps ? deps.uid : process.getuid?.();
  const home = deps.home || os.homedir();
  const code = `import(${JSON.stringify(pathToFileURL(path.join(dir, 'scripts', 'browser.mjs')).href)}).then(async (m) => { const b = await m.findBrowser(); process.stdout.write(b ? String(b) : ''); }).catch(() => {});`;
  const r = spawn(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', timeout: 5000 });
  const found = String((r && r.stdout) || '').trim();
  if (found) return { ok: true, detail: found, fix: '' };
  const near = deps.candidates || browserCandidates(home);
  let fix = 'Set IDR_BROWSER to a Chrome or Chromium binary.';
  if (near.length) fix += ` Found: ${near.join(', ')}.`;
  if (uid === 0) fix += ' Chrome needs --no-sandbox as root (IDR 1.1.0 adds it).';
  return { ok: false, detail: 'image-deep-research finds no browser', fix };
}

// NEXTGEN-4 item 8: a doctor row for the Ollama model the agent drives, when
// an Ollama server answers for it. A model whose /api/show capabilities do not
// list "tools" was not trained to call tools (gemma3:4b is one), and it was the
// default until round six. No server, or no such model pulled: no row, because
// most users of the plugin never run the Ollama engine.
export async function ollamaDoctorRows(cfg, deps = {}) {
  const post = deps.post || (async (url, body) => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2000);
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
      return { status: r.status, json: await r.json().catch(() => null) };
    } catch { return null; } finally { clearTimeout(t); }
  });
  const model = cfg && cfg.ollamaModel;
  if (!model || !cfg.ollamaUrl) return [];
  let r = null;
  try { r = await post(new URL('/api/show', cfg.ollamaUrl).href, { model }); } catch { r = null; }
  if (!r || r.status !== 200 || !r.json || !Array.isArray(r.json.capabilities)) return [];
  const caps = r.json.capabilities.map(String);
  const tools = caps.includes('tools');
  return [{ name: 'ollama model calls tools', ok: tools, detail: `${model}: ${caps.join(', ') || 'no capabilities listed'}`, fix: `${model} does not list tools in /api/show, so it was not trained to call them: ollama pull qwen2.5-coder:7b, then atlias settings (agent.ollamaModel).` }];
}

export function doctor(cwd = process.cwd(), deps = {}) {
  const checks = [];
  const add = (name, ok, detail, fix) => checks.push({ name, ok: Boolean(ok), detail, fix });
  const major = parseInt(process.versions.node.split('.')[0], 10);
  add('node 18+', major >= 18, `node ${process.versions.node}`, 'Install Node 18 or newer.');
  const py = findPython();
  add('graphify (python)', py, py || 'no python with graphify', 'pip install graphifyy, or set ATLIAS_PYTHON to the interpreter that has it.');
  add('plugin hooks file', exists(path.join(ROOT, 'hooks', 'hooks.json')), path.join(ROOT, 'hooks', 'hooks.json'), 'Reinstall the plugin; hooks/hooks.json is missing.');
  add('mcp server file', exists(SERVER_MJS), SERVER_MJS, 'Reinstall the plugin; mcp/server.mjs is missing.');
  // Enablement can live in either settings file, and reading one of them told
  // some users to reinstall a plugin they already had.
  const enabledMap = { ...((readJson(path.join(CLAUDE_DIR, 'settings.json'), {}) || {}).enabledPlugins || {}), ...((readJson(path.join(CLAUDE_DIR, 'settings.local.json'), {}) || {}).enabledPlugins || {}) };
  const enabled = Object.keys(enabledMap).filter((k) => enabledMap[k]);
  add('claude code plugin enabled', enabled.some((k) => k.startsWith('atlias@')), enabled.filter((k) => k.startsWith('atlias@')).join(', ') || 'not in enabledPlugins', 'Inside Claude Code: /plugin marketplace add ridelink0/atlias, then /plugin install atlias@atlias.');
  const ufsOn = ufsCopies({ cwd }).filter((copy) => copy.loaded);
  add('ultimate-frontend-skills', ufsOn.length > 0, ufsOn.map((copy) => copy.where).join(', ') || 'companion skill for frontend work', 'atlias install --companions');
  if (ufsOn.length > 1) add('one copy of ultimate-frontend-skills', false, `${ufsOn.length} copies load: ${ufsOn.map((copy) => copy.where).join(', ')}`, 'Keep one: disable or remove the others, or two sets of the same skills compete for every frontend prompt.');
  // The model reads this list through harness_status, so the mcp server asks for
  // it without these rows, and a missing image-deep-research is a failing row
  // (and a non-zero exit from `atlias doctor`) only for someone who switched
  // flags.visualHint on; with it off, nothing changes for a machine without one.
  const idr = deps.idrRows === false ? [] : deps.idr || idrCopies({ cwd });
  const idrOn = idr.filter((copy) => copy.loaded);
  if (deps.idrRows !== false && (idrOn.length || VISUAL_ON.includes(config().flags.visualHint))) add('image-deep-research', idrOn.length > 0, idrOn.map((copy) => copy.where).join(', ') || 'companion skill for visual research', 'atlias install --companions');
  if (idrOn.length > 1) add('one copy of image-deep-research', false, `${idrOn.length} copies load: ${idrOn.map((copy) => copy.where).join(', ')}`, 'Keep one: with ultimate-frontend-skills on, uninstall the standalone plugin, or two sets of the same skill compete for every visual prompt.');
  if (idrOn.length) add('node 22+ for image-deep-research', major >= 22, `node ${process.versions.node}`, 'Install Node 22 or newer; image-deep-research needs it.');
  const idrDir = idrOn.find((copy) => copy.dir);
  if (idrDir) { const b = idrBrowserRow(idrDir.dir, deps); add('browser for image-deep-research', b.ok, b.detail, b.fix); }
  const codexHooks = readJson(path.join(CODEX_DIR, 'hooks.json'), {}) || {};
  const codexOurs = Object.values(codexHooks.hooks || {}).flatMap((gs) => (gs || []).flatMap((g) => (g.hooks || []).filter(isOurs)));
  // A hook that names a versioned plugin folder works today and breaks with the
  // next update, so it is not "ok" - the doctor used to pass it.
  const codexExpiring = codexOurs.filter((h) => isVersionedPath(h.command));
  add('codex hooks', codexOurs.length > 0 && codexExpiring.length === 0, codexExpiring.length ? `${codexExpiring.length} hook(s) point into a versioned plugin folder that the next update removes` : path.join(CODEX_DIR, 'hooks.json'), 'atlias install --codex');
  add('codex mcp server', /\[mcp_servers\.atlias\]/.test(readText(path.join(CODEX_DIR, 'config.toml')) || ''), path.join(CODEX_DIR, 'config.toml'), 'atlias install --codex');
  const ag = readJson(path.join(GEMINI_DIR, 'config', 'mcp_config.json'), {}) || {};
  add('antigravity mcp server', ag.mcpServers && ag.mcpServers.atlias, path.join(GEMINI_DIR, 'config', 'mcp_config.json'), 'atlias install --antigravity');
  add('antigravity instructions', (readText(path.join(GEMINI_DIR, 'GEMINI.md')) || '').includes(START_MARK), path.join(GEMINI_DIR, 'GEMINI.md'), 'atlias install --antigravity');
  // Host configs point at the launcher. If it is gone, every one of them
  // loses its tools and no host says why.
  const codexPoints = (readText(path.join(CODEX_DIR, 'config.toml')) || '').includes(LAUNCHER.replace(/\\/g, '\\'));
  const anyPoints = codexPoints || exists(LAUNCHER);
  if (anyPoints) {
    add('launcher', exists(LAUNCHER), LAUNCHER, 'Host configs point here. Run atlias install again from the installed copy to rewrite it.');
    add('launcher can find a copy', installedRoots().length > 0, `${installedRoots().length} installed copy(ies)`, 'No copy of atlias has an mcp/server.mjs. Reinstall the plugin.');
    const probe = probeServer(LAUNCHER);
    add('launcher actually starts', probe.ok, probe.detail, 'The file is there but a host would get nothing from it. Run atlias install again from the installed copy, and check that node is on PATH for that host.');
  }
  // The command people type. Any atlias on PATH counts, ours or npm's.
  const typed = whichAtlias();
  add('terminal command', typed, typed || 'typing atlias finds nothing', 'atlias shortcut install, then open a new terminal.');
  add('shared memory dir', exists(claudeMemoryDir(cwd)), claudeMemoryDir(cwd), 'Created on first harness_remember; nothing to do.');
  add('graph for this project', exists(path.join(cwd, 'graphify-out', 'graph.json')), path.join(cwd, 'graphify-out', 'graph.json'), 'Run /graphify here, or `graphify update .` for an AST-only graph.');
  return checks;
}
export function formatDoctor(checks) {
  return checks.map((c) => `${c.ok ? 'ok  ' : 'FIX '} ${c.name}: ${c.detail}${c.ok ? '' : `\n     -> ${c.fix}`}`).join('\n');
}
