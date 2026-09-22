// Host adapters. Claude Code gets everything from the plugin itself; Codex,
// Antigravity and Gemini CLI get the same hooks and the same MCP server written
// into their own config files, always inside marked, idempotent blocks.
import path from 'node:path';
import { ROOT, VERSION, CODEX_DIR, GEMINI_DIR, CLAUDE_DIR, START_MARK, END_MARK, readText, writeText, readJson, writeJson, exists, run, findPython, claudeMemoryDir } from './core.mjs';

export const HOOKS_MJS = path.join(ROOT, 'lib', 'hooks.mjs');
export const SERVER_MJS = path.join(ROOT, 'mcp', 'server.mjs');
const q = (p) => `"${p.replace(/\\/g, '/')}"`;
export function hookCommand(event, host) { return `node ${q(HOOKS_MJS)} ${event} --host ${host}`; }

export const CODEX_EVENTS = [
  ['SessionStart', 'session-start', 45], ['UserPromptSubmit', 'prompt', 15], ['PreToolUse', 'pre-tool', 8, '.*'], ['PostToolUse', 'post-tool', 8, '.*'],
  ['PreCompact', 'pre-compact', 15], ['PostCompact', 'post-compact', 10], ['Stop', 'stop', 30], ['SubagentStop', 'subagent-stop', 8], ['SessionEnd', 'session-end', 5],
];
export const GEMINI_EVENTS = [
  ['SessionStart', 'session-start', 20000], ['BeforeAgent', 'prompt', 15000], ['BeforeTool', 'pre-tool', 8000], ['AfterTool', 'post-tool', 8000],
  ['PreCompress', 'pre-compact', 15000], ['AfterAgent', 'stop', 30000], ['SessionEnd', 'session-end', 5000],
];

const isOurs = (h) => h && typeof h.command === 'string' && /atlias/i.test(h.command);
const esc = (s) => s.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');

export function mergeHooksJson(existing, host, events = CODEX_EVENTS) {
  const doc = existing && typeof existing === 'object' ? { ...existing } : {};
  const hooks = { ...(doc.hooks || {}) };
  for (const [event, ours, timeout, matcher] of events) {
    const groups = (hooks[event] || []).map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !isOurs(h)) })).filter((g) => g.hooks.length);
    const group = { hooks: [{ type: 'command', command: hookCommand(ours, host), timeout, statusMessage: 'atlias' }] };
    if (matcher) group.matcher = matcher;
    groups.push(group);
    hooks[event] = groups;
  }
  doc.hooks = hooks;
  return doc;
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
  doc.mcpServers = { ...(doc.mcpServers || {}), atlias: { command: 'node', args: [SERVER_MJS] } };
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
  const block = ['', '[mcp_servers.atlias]', "command = 'node'", `args = ['${SERVER_MJS.replace(/'/g, "''")}']`, 'startup_timeout_sec = 30', ''];
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

export function instructionBlock(host) {
  const label = host === 'codex' ? 'Codex' : host === 'gemini' ? 'Gemini CLI' : 'Antigravity';
  const memIndex = path.join(CLAUDE_DIR, 'projects', '<project-slug>', 'memory', 'MEMORY.md');
  return `## atlias sub-harness (shared with Claude Code)

atlias ${VERSION} links ${label} to the same memory, knowledge graph and working rules Claude Code uses. Its MCP server is registered as \`atlias\`.

- Start of any task: the memory index for the current project is at \`${memIndex}\` (slug = the project path with every separator replaced by a dash). Read it, then read the files it names that the task touches. Save new durable facts with the \`harness_remember\` tool so Claude Code sees them too.
- Codebase question: call \`graph_query\` first (graphify knowledge graph, a few hundred tokens), then open only the files it names. \`graph_affected\` before a risky change, \`graph_explain\` for one symbol.
- Before compaction or a long task, write the next step with \`harness_progress set\`; read the handoff with \`harness_progress get\` when you start.
- \`harness_verify\` syntax-checks changed files. Done means: smallest real check run, then a second adversarial read of every changed file, and the reply names both passes.
- \`harness_digest show\` lists sessions waiting for memory consolidation; fold the durable facts into memory, then \`harness_digest ack\`.
- Never repeat an identical call that already failed; change the input or the approach. Confirm destructive commands with the user.
- CLI: \`node ${q(path.join(ROOT, 'bin', 'atlias.mjs'))} doctor|status|recall|dream\`.`;
}

export function installCodex() {
  const out = [];
  const hooksPath = path.join(CODEX_DIR, 'hooks.json');
  const merged = mergeHooksJson(readJson(hooksPath, {}) || {}, 'codex');
  if (!merged.description) merged.description = 'Hooks for Codex. Managed entries are marked by the script that wrote them.';
  writeJson(hooksPath, merged);
  out.push(`codex hooks: ${hooksPath} (${CODEX_EVENTS.length} events)`);
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
  doc.mcpServers = { ...(doc.mcpServers || {}), atlias: { command: 'node', args: [SERVER_MJS] } };
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
  if (!findPython()) {
    const r = process.platform === 'win32' ? run('py', ['-3', '-m', 'pip', 'install', '--quiet', 'graphifyy'], { timeout: 300000 }) : run('python3', ['-m', 'pip', 'install', '--quiet', 'graphifyy'], { timeout: 300000 });
    out.push(`graphify: ${r.status === 0 && findPython() ? 'installed' : 'not installed (pip install graphifyy by hand)'}`);
  } else out.push('graphify: present');
  const settings = readJson(path.join(CLAUDE_DIR, 'settings.json'), {}) || {};
  const ufs = Object.keys(settings.enabledPlugins || {}).some((k) => k.startsWith('ultimate-frontend-skills@'));
  if (ufs) out.push('ultimate-frontend-skills: enabled');
  else {
    const r1 = run('claude', ['plugin', 'marketplace', 'add', 'ridelink0/ultimate-frontend-skills'], { timeout: 90000 });
    const r2 = r1.status === 0 ? run('claude', ['plugin', 'install', 'ultimate-frontend-skills@ultimate-frontend-skills'], { timeout: 120000 }) : r1;
    out.push(`ultimate-frontend-skills: ${r2.status === 0 ? 'installed' : 'not installed (run /plugin marketplace add ridelink0/ultimate-frontend-skills inside Claude Code)'}`);
  }
  return out;
}

export function doctor(cwd = process.cwd()) {
  const checks = [];
  const add = (name, ok, detail, fix) => checks.push({ name, ok: Boolean(ok), detail, fix });
  const major = parseInt(process.versions.node.split('.')[0], 10);
  add('node 18+', major >= 18, `node ${process.versions.node}`, 'Install Node 18 or newer.');
  const py = findPython();
  add('graphify (python)', py, py || 'no python with graphify', 'pip install graphifyy, or set ATLIAS_PYTHON to the interpreter that has it.');
  add('plugin hooks file', exists(path.join(ROOT, 'hooks', 'hooks.json')), path.join(ROOT, 'hooks', 'hooks.json'), 'Reinstall the plugin; hooks/hooks.json is missing.');
  add('mcp server file', exists(SERVER_MJS), SERVER_MJS, 'Reinstall the plugin; mcp/server.mjs is missing.');
  const settings = readJson(path.join(CLAUDE_DIR, 'settings.json'), {}) || {};
  const enabled = Object.keys(settings.enabledPlugins || {}).filter((k) => settings.enabledPlugins[k]);
  add('claude code plugin enabled', enabled.some((k) => k.startsWith('atlias@')), enabled.filter((k) => k.startsWith('atlias@')).join(', ') || 'not in enabledPlugins', 'Inside Claude Code: /plugin marketplace add ridelink0/atlias, then /plugin install atlias@atlias.');
  add('ultimate-frontend-skills', enabled.some((k) => k.startsWith('ultimate-frontend-skills@')), 'companion skill for frontend work', 'atlias install --companions');
  const codexHooks = readJson(path.join(CODEX_DIR, 'hooks.json'), {}) || {};
  const codexOk = Object.values(codexHooks.hooks || {}).some((gs) => (gs || []).some((g) => (g.hooks || []).some(isOurs)));
  add('codex hooks', codexOk, path.join(CODEX_DIR, 'hooks.json'), 'atlias install --codex');
  add('codex mcp server', /\[mcp_servers\.atlias\]/.test(readText(path.join(CODEX_DIR, 'config.toml')) || ''), path.join(CODEX_DIR, 'config.toml'), 'atlias install --codex');
  const ag = readJson(path.join(GEMINI_DIR, 'config', 'mcp_config.json'), {}) || {};
  add('antigravity mcp server', ag.mcpServers && ag.mcpServers.atlias, path.join(GEMINI_DIR, 'config', 'mcp_config.json'), 'atlias install --antigravity');
  add('antigravity instructions', (readText(path.join(GEMINI_DIR, 'GEMINI.md')) || '').includes(START_MARK), path.join(GEMINI_DIR, 'GEMINI.md'), 'atlias install --antigravity');
  add('shared memory dir', exists(claudeMemoryDir(cwd)), claudeMemoryDir(cwd), 'Created on first harness_remember; nothing to do.');
  add('graph for this project', exists(path.join(cwd, 'graphify-out', 'graph.json')), path.join(cwd, 'graphify-out', 'graph.json'), 'Run /graphify here, or `graphify update .` for an AST-only graph.');
  return checks;
}
export function formatDoctor(checks) {
  return checks.map((c) => `${c.ok ? 'ok  ' : 'FIX '} ${c.name}: ${c.detail}${c.ok ? '' : `\n     -> ${c.fix}`}`).join('\n');
}