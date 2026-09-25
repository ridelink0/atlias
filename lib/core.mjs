// atlias - shared runtime for every hook, the CLI and the MCP server.
// Zero dependencies. Node 18+. Windows, macOS and Linux.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const VERSION = '3.1.0';
export const NAME = 'atlias';
export const HOME = os.homedir();
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const STATE_DIR = process.env.ATLIAS_HOME || path.join(HOME, '.atlias');
export const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(HOME, '.claude');
export const CODEX_DIR = process.env.CODEX_HOME || path.join(HOME, '.codex');
export const GEMINI_DIR = path.join(HOME, '.gemini');
export const START_MARK = `<!-- ${NAME}:start -->`;
export const END_MARK = `<!-- ${NAME}:end -->`;

export const DEFAULTS = {
  verify: { syntax: true, doublePass: true, integrity: true, stubs: true, weakenedTests: true, unwired: true },
  guard: { loopThreshold: 4, loopWindow: 30, destructive: true },
  graph: { autoBuild: true, autoUpdate: true, maxFilesForAutoBuild: 4000, queryBudget: 600, godNodes: 8, updateDebounceMs: 60000 },
  brief: { memoryChars: 6000, progressChars: 2400 },
  recall: { budgetChars: 2500, bodyChars: 500 },
  dream: { enabled: true, keepHistory: 400 },
  router: { graph: true, companions: true },
  usage: { show: true },
  agent: { mode: 'both', engine: 'auto', ollamaUrl: 'http://127.0.0.1:11434', ollamaModel: 'gemma3:4b', openaiUrl: 'https://api.openai.com/v1', openaiModel: '', nativeTools: true, maxToolRounds: 25, keepObservations: 4, evictBlock: 4, testCommand: 'auto', permissions: 'workspace' },
};
// Settings that take one of a fixed set of values; anything else is refused
// with the list, because a typo here would otherwise quietly mean the default.
export const CHOICES = { agent: { mode: ['both', 'sub', 'standalone'], engine: ['auto', 'claude', 'codex', 'openai', 'ollama', 'echo'], permissions: ['workspace', 'ask', 'read-only'] } };

// ---------- files ----------
export function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); return p; }
export function readText(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
export function readJson(p, fallback = null) {
  const t = readText(p);
  if (t == null) return fallback;
  try { return JSON.parse(t.replace(/^\uFEFF/, '')); } catch { return fallback; }
}
export function writeText(p, text) {
  ensureDir(path.dirname(p));
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, text);
  try { fs.renameSync(tmp, p); } catch { fs.copyFileSync(tmp, p); fs.unlinkSync(tmp); }
}
export function writeJson(p, obj) { writeText(p, JSON.stringify(obj, null, 2) + '\n'); }
export function appendLine(p, line) { ensureDir(path.dirname(p)); fs.appendFileSync(p, line.replace(/\r?\n/g, ' ') + '\n'); }
export function readLines(p) { const t = readText(p); return t ? t.split(/\r?\n/).filter(Boolean) : []; }
export function readJsonl(p) {
  const out = [];
  for (const l of readLines(p)) { try { out.push(JSON.parse(l)); } catch { /* skip corrupt line */ } }
  return out;
}
export function mtime(p) { try { return fs.statSync(p).mtimeMs; } catch { return 0; } }
export function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }
export function sha(s) { return crypto.createHash('sha1').update(s).digest('hex').slice(0, 16); }
export function clip(s, n) { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '\u2026' : s; }

// ---------- config and state ----------
export function config() {
  const user = readJson(path.join(STATE_DIR, 'config.json'), {}) || {};
  const out = {};
  for (const k of Object.keys(DEFAULTS)) out[k] = { ...DEFAULTS[k], ...(user[k] || {}) };
  return out;
}
// A setting has the type its default has. Anything else is refused with the
// reason, rather than stored and quietly misread later.
export function parseSetting(section, key, raw) {
  if (!DEFAULTS[section] || !(key in DEFAULTS[section])) return { error: `unknown key ${section}.${key}; sections: ${Object.keys(DEFAULTS).join(', ')}` };
  const want = typeof DEFAULTS[section][key];
  const text = String(raw == null ? '' : raw).trim();
  if (!text) return { error: `${section}.${key} needs a value (a ${want})` };
  let value;
  try { value = JSON.parse(text); } catch { value = text; }
  if (want === 'number') {
    const n = Number(value);
    if (!Number.isFinite(n)) return { error: `${section}.${key} is a number; got ${JSON.stringify(value)}` };
    return { value: n };
  }
  if (want === 'boolean') {
    if (value === true || value === 'true') return { value: true };
    if (value === false || value === 'false') return { value: false };
    return { error: `${section}.${key} is true or false; got ${JSON.stringify(value)}` };
  }
  const choices = CHOICES[section] && CHOICES[section][key];
  if (choices) {
    const v = String(value).toLowerCase();
    return choices.includes(v) ? { value: v } : { error: `${section}.${key} is one of ${choices.join(', ')}; got ${JSON.stringify(text)}` };
  }
  return { value: typeof value === typeof DEFAULTS[section][key] ? value : text };
}

export function log(msg) {
  try {
    const p = path.join(STATE_DIR, 'log.txt');
    ensureDir(STATE_DIR);
    if (mtime(p) && fs.statSync(p).size > 1024 * 1024) fs.renameSync(p, p + '.1');
    fs.appendFileSync(p, `${new Date().toISOString()} ${msg}\n`);
  } catch { /* logging must never break a hook */ }
}
// Claude Code names a project folder after its path with every separator replaced by a dash
// (C:\Users\OWNER -> C--Users-OWNER, /home/u/app -> -home-u-app).
export function slug(cwd) { return String(cwd || process.cwd()).replace(/[\\/:]/g, '-'); }
export function projectDir(cwd) { return ensureDir(path.join(STATE_DIR, 'projects', slug(cwd))); }
export function sessionDir() { return ensureDir(path.join(STATE_DIR, 'sessions')); }
export function sessionEvents(id) { return path.join(sessionDir(), `${safeId(id)}.jsonl`); }
export function sessionMetaPath(id) { return path.join(sessionDir(), `${safeId(id)}.json`); }
export function sessionMeta(id) { return readJson(sessionMetaPath(id), {}) || {}; }
export function saveSessionMeta(id, meta) { writeJson(sessionMetaPath(id), meta); }
export function safeId(id) { return String(id || 'no-session').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80); }
// A single append under about four kilobytes lands whole even when several
// processes write at once; a longer one can interleave with another and
// corrupt both lines. Two sessions in one project, or a hook and a
// subagent's hook, are the ordinary case here, not the exotic one.
export const EVENT_MAX = 3500;
export function trimEvent(ev) {
  let out = { ...ev };
  if (Array.isArray(out.files) && out.files.length > 20) out = { ...out, files: out.files.slice(0, 20), moreFiles: out.files.length - 20 };
  let line = JSON.stringify(out);
  if (line.length <= EVENT_MAX) return out;
  if (Array.isArray(out.files)) {
    while (out.files.length > 1 && line.length > EVENT_MAX) {
      out = { ...out, files: out.files.slice(0, out.files.length - 1), moreFiles: (out.moreFiles || 0) + 1 };
      line = JSON.stringify(out);
    }
  }
  if (line.length > EVENT_MAX && typeof out.command === "string") {
    out = { ...out, command: out.command.slice(0, 200), commandTruncated: true };
    line = JSON.stringify(out);
  }
  if (line.length > EVENT_MAX) out = { t: out.t, kind: out.kind, tool: out.tool, key: out.key, oversized: true };
  return out;
}
export function recordEvent(id, ev) { appendLine(sessionEvents(id), JSON.stringify(trimEvent({ t: Date.now(), ...ev }))); }
export function events(id) { return readJsonl(sessionEvents(id)); }
// Read the last `bytes` of a file without pulling the whole thing into
// memory, dropping the first line because it is probably cut in half.
export function readTail(p, bytes) {
  let fd = null;
  try {
    fd = fs.openSync(p, 'r');
    const size = fs.fstatSync(fd).size;
    const start = Math.max(0, size - bytes);
    const len = size - start;
    if (len <= 0) return '';
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, start);
    const text = buf.toString('utf8');
    if (start === 0) return text;
    const nl = text.indexOf('\n');
    return nl === -1 ? '' : text.slice(nl + 1);
  } catch { return ''; } finally { if (fd !== null) { try { fs.closeSync(fd); } catch { /* already gone */ } } }
}
// What the guard and the gate need: the recent end of the session, not all
// of it. 64 KB is roughly a thousand events.
export const GUARD_TAIL = 64 * 1024;
export const TURN_TAIL = 256 * 1024;
export function eventsTail(id, bytes = GUARD_TAIL) {
  const out = [];
  for (const line of readTail(sessionEvents(id), bytes).split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* a half-written line at the edge */ }
  }
  return out;
}
// Where Claude Code keeps its own memory for this project. Every host shares it, so one memory.
export function claudeMemoryDir(cwd) { return path.join(CLAUDE_DIR, 'projects', slug(cwd), 'memory'); }

// ---------- stdin and stdout for hooks ----------
export async function readStdin() {
  if (process.stdin.isTTY) return {};
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return { _raw: raw }; }
}
export function emit(obj) { process.stdout.write(JSON.stringify(obj) + '\n'); }
export function contextOutput(eventName, text, extra = {}) {
  if (!text) return null;
  return { hookSpecificOutput: { hookEventName: eventName, additionalContext: text }, ...extra };
}

// ---------- host detection ----------
export function detectHost(argv = process.argv) {
  const i = argv.indexOf('--host');
  if (i !== -1 && argv[i + 1]) return argv[i + 1];
  if (process.env.CLAUDE_PLUGIN_ROOT || process.env.CLAUDE_PROJECT_DIR || process.env.CLAUDE_CODE_SESSION_ID) return 'claude';
  if (process.env.CODEX_HOME || process.env.CODEX_SANDBOX || process.env.CODEX_THREAD_ID) return 'codex';
  if (process.env.GEMINI_CLI || process.env.GEMINI_SESSION_ID) return 'gemini';
  return 'claude';
}
export const HOST_LABEL = { claude: 'Claude Code', codex: 'Codex', gemini: 'Gemini CLI', antigravity: 'Antigravity' };

// ---------- where this copy lives ----------
// A path that contains a version number is a path that expires. The state
// directory does not, so host configs point there and the launcher finds
// whichever copy is installed now.
export const LAUNCHER = path.join(STATE_DIR, 'server.mjs');
export const ROOT_RECORD = path.join(STATE_DIR, 'root.json');
export function isVersionedPath(dir) {
  return /[\\/](?:\d+\.\d+\.\d+)[\\/]/.test(String(dir) + path.sep);
}
// Every installed copy, newest version first, so a removed one is skipped.
export function installedRoots() {
  const out = [];
  if (process.env.ATLIAS_ROOT) out.push(process.env.ATLIAS_ROOT);
  const cache = path.join(CLAUDE_DIR, 'plugins', 'cache', 'atlias', 'atlias');
  try {
    const versions = fs.readdirSync(cache).filter((d) => /^\d+\.\d+\.\d+$/.test(d));
    versions.sort((a, b) => {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);
      return pb[0] - pa[0] || pb[1] - pa[1] || pb[2] - pa[2];
    });
    for (const v of versions) out.push(path.join(cache, v));
  } catch { /* no plugin install */ }
  const recorded = readJson(ROOT_RECORD);
  if (recorded && recorded.root) out.push(recorded.root);
  out.push(ROOT);
  return [...new Set(out)].filter((d) => exists(path.join(d, 'mcp', 'server.mjs')));
}
export function writeLauncher(root = ROOT) {
  ensureDir(STATE_DIR);
  writeJson(ROOT_RECORD, { root, version: VERSION, written: new Date().toISOString() });
  writeText(LAUNCHER, LAUNCHER_SOURCE);
  return LAUNCHER;
}
// The hooks get the same treatment as the MCP server. Codex's hooks.json used
// to name lib/hooks.mjs inside the versioned plugin folder, so every hook would
// have died with the next update. The file name ends in hooks.mjs on purpose:
// lib/hooks.mjs runs its main() only when argv[1] does.
export const HOOKS_LAUNCHER = path.join(STATE_DIR, 'hooks.mjs');
export function writeHooksLauncher(root = ROOT) {
  ensureDir(STATE_DIR);
  writeJson(ROOT_RECORD, { root, version: VERSION, written: new Date().toISOString() });
  writeText(HOOKS_LAUNCHER, HOOKS_LAUNCHER_SOURCE);
  return HOOKS_LAUNCHER;
}
// The launcher, verbatim. Kept as data so the tests can read it and assert
// that it imports nothing from a path with a version number in it.
export const LAUNCHER_SOURCE = "#!/usr/bin/env node\n// Written by atlias. Host configs point here because this path never changes\n// while the installed copy moves with every version. Nothing below imports\n// from a versioned path: depending on one is the failure this file exists to\n// prevent.\nimport fs from 'node:fs';\nimport os from 'node:os';\nimport path from 'node:path';\nimport { pathToFileURL } from 'node:url';\n\nconst home = os.homedir();\nconst state = process.env.ATLIAS_HOME || path.join(home, '.atlias');\nconst claude = process.env.CLAUDE_CONFIG_DIR || path.join(home, '.claude');\nconst candidates = [];\nif (process.env.ATLIAS_ROOT) candidates.push(process.env.ATLIAS_ROOT);\n// Newest installed version first, so an update takes effect immediately.\nconst cache = path.join(claude, 'plugins', 'cache', 'atlias', 'atlias');\ntry {\n  const versions = fs.readdirSync(cache).filter((d) => /^\\d+\\.\\d+\\.\\d+$/.test(d));\n  versions.sort((a, b) => {\n    const A = a.split('.').map(Number);\n    const B = b.split('.').map(Number);\n    return B[0] - A[0] || B[1] - A[1] || B[2] - A[2];\n  });\n  for (const v of versions) candidates.push(path.join(cache, v));\n} catch { /* not installed as a plugin */ }\n// Then whichever copy wrote this launcher, which covers a checkout.\ntry {\n  const recorded = JSON.parse(fs.readFileSync(path.join(state, 'root.json'), 'utf8'));\n  if (recorded && recorded.root) candidates.push(recorded.root);\n} catch { /* no record */ }\n\nconst root = candidates.find((dir) => {\n  try { fs.accessSync(path.join(dir, 'mcp', 'server.mjs')); return true; } catch { return false; }\n});\nif (!root) {\n  process.stderr.write('atlias: no installed copy found. Reinstall the plugin, or set ATLIAS_ROOT to a checkout.\\n');\n  process.exit(1);\n}\nawait import(pathToFileURL(path.join(root, 'mcp', 'server.mjs')).href);\n";

// ---------- processes ----------
export function run(cmd, args = [], opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8', timeout: opts.timeout || 8000, cwd: opts.cwd || undefined, input: opts.input,
    windowsHide: true, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', ...(opts.env || {}) },
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error ? String(r.error.message || r.error) : null };
}
// Fire-and-forget worker that outlives the hook (SessionEnd only gets 1.5 s).
export function detach(args, opts = {}) {
  try {
    const child = spawn(process.execPath, args, { detached: true, stdio: 'ignore', windowsHide: true, cwd: opts.cwd || undefined, env: { ...process.env, ...(opts.env || {}) } });
    child.unref();
    return true;
  } catch (e) { log(`detach failed: ${e.message}`); return false; }
}
// A lock that expires, so a crashed worker never wedges the harness.
export function tryLock(p, ttlMs = 10 * 60 * 1000) {
  try {
    const st = fs.statSync(p);
    if (Date.now() - st.mtimeMs < ttlMs) return false;
    fs.unlinkSync(p);
  } catch { /* no lock */ }
  try { fs.writeFileSync(p, String(process.pid), { flag: 'wx' }); return true; } catch { return false; }
}
export function unlock(p) { try { fs.unlinkSync(p); } catch { /* gone */ } }

// ---------- python and graphify ----------
// One probe, the whole search, and how long a miss is remembered. These are
// exported because the tests assert that the work fits inside the SessionStart
// timeout the plugin declares.
export const PROBE_MS = 4000;
export const PROBE_BUDGET_MS = 9000;
export const MISS_CACHE_MS = 60 * 60 * 1000;
export function findPython() {
  const cachePath = path.join(STATE_DIR, 'python.json');
  const cached = readJson(cachePath);
  if (cached && cached.path && exists(cached.path) && Date.now() - (cached.checked || 0) < 24 * 3600 * 1000) return cached.path;
  // A machine without graphify must not pay for the search on every session.
  if (cached && cached.path === null && Date.now() - (cached.checked || 0) < MISS_CACHE_MS) return null;
  const cands = [];
  if (process.env.ATLIAS_PYTHON) cands.push(process.env.ATLIAS_PYTHON);
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local');
    for (const v of ['Python314', 'Python313', 'Python312', 'Python311']) cands.push(path.join(local, 'Programs', 'Python', v, 'python.exe'));
    cands.push('python', 'py');
  } else cands.push('python3', 'python');
  const started = Date.now();
  for (const c of cands) {
    if (Date.now() - started > PROBE_BUDGET_MS) break;
    if (path.isAbsolute(c) && !exists(c)) continue; // never spawn what is not on disk
    const args = c === 'py' ? ['-3', '-c', 'import graphify,sys;print(sys.executable)'] : ['-c', 'import graphify,sys;print(sys.executable)'];
    const r = run(c, args, { timeout: PROBE_MS });
    if (r.status === 0 && r.stdout.trim()) {
      const found = r.stdout.trim().split(/\r?\n/).pop();
      writeJson(cachePath, { path: found, checked: Date.now() });
      return found;
    }
  }
  writeJson(cachePath, { path: null, checked: Date.now() });
  return null;
}
export function graphify(args, opts = {}) {
  const py = findPython();
  if (!py) return { status: 127, stdout: '', stderr: 'graphify: no python with graphify installed (pip install graphifyy)', error: 'missing' };
  return run(py, ['-m', 'graphify', ...args], { timeout: opts.timeout || 20000, cwd: opts.cwd });
}
export function graphPath(cwd) { return path.join(cwd || process.cwd(), 'graphify-out', 'graph.json'); }

// Both the handoff note and the search for edits made outside the tools want
// the same git status, in the same process, milliseconds apart. Run it once.
const gitMemo = new Map();
export function gitStatusShort(cwd, deps = {}) {
  const runner = deps.run || run;
  const now = deps.now || Date.now();
  const hit = gitMemo.get(cwd);
  if (hit && now - hit.at < 2000) return hit.text;
  // The repository check applies to the real runner only: a caller that hands
  // in its own runner is explicitly asking for it to be used.
  if (!deps.run && !exists(path.join(cwd, '.git'))) { gitMemo.set(cwd, { at: now, text: '' }); return ''; }
  const r = runner('git', ['status', '--short'], { cwd, timeout: 3000 });
  const text = r.status === 0 ? r.stdout : '';
  gitMemo.set(cwd, { at: now, text });
  return text;
}
export function clearGitMemo() { gitMemo.clear(); }

// ---------- tool payload helpers (Claude Code, Codex, Gemini CLI shapes) ----------
export const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.py', '.json', '.go', '.rs', '.java', '.kt', '.swift', '.c', '.cc', '.cpp', '.h', '.hpp', '.cs', '.rb', '.php', '.dart', '.vue', '.svelte', '.sql', '.sh', '.ps1', '.toml', '.yaml', '.yml', '.html', '.css', '.md']);
export function isCodeFile(p) { return CODE_EXT.has(path.extname(String(p || '')).toLowerCase()); }
export function filesFromTool(toolName, input) {
  if (!input || typeof input !== 'object') return [];
  const out = new Set();
  for (const k of ['file_path', 'notebook_path', 'path', 'filePath', 'target_file']) if (typeof input[k] === 'string') out.add(input[k]);
  if (Array.isArray(input.edits)) for (const e of input.edits) if (e && typeof e.file_path === 'string') out.add(e.file_path);
  // Codex apply_patch. Its hooks receive tool_input {command: "<patch>"}
  // (codex-rs/core/src/tools/handlers/apply_patch.rs); older builds used input
  // or patch. Added, updated and renamed files are edits; deleted ones are not.
  const patch = [input.command, input.input, input.patch].find((v) => typeof v === 'string' && /^\*\*\* (?:Begin Patch|Update File:|Add File:)/m.test(v));
  if (patch) for (const m of patch.matchAll(/^\*\*\* (?:Update File|Add File|Move to): (.+)$/gm)) out.add(m[1].trim());
  return [...out];
}
export function commandFromTool(toolName, input) {
  if (!input || typeof input !== 'object') return null;
  // apply_patch carries its patch in command; it is an edit, not a shell command.
  if (isEditTool(toolName)) return null;
  const c = input.command ?? input.cmd ?? null;
  if (Array.isArray(c)) return c.join(' ');
  return typeof c === 'string' ? c : null;
}
export function isEditTool(toolName) { return /^(Write|Edit|MultiEdit|NotebookEdit|apply_patch|write_file|replace|edit_file|create_file)$/i.test(String(toolName || '')); }
export function isShellTool(toolName) { return /^(Bash|PowerShell|shell|exec|exec_command|run_shell_command|run_terminal_cmd|local_shell)$/i.test(String(toolName || '')); }
const VERIFY_RE = /\b(node --check|deno (check|test|lint)|bun test|npm test|pnpm test|yarn test|pytest|python -m py_compile|py_compile|go (test|vet|build)|cargo (test|check|clippy)|jest|vitest|mocha|playwright test|cypress run|eslint|biome (check|lint)|ruff|flake8|mypy|pyright|tsc|swift test|xcodebuild|flutter test|dart (test|analyze)|dotnet test|rspec|phpunit|composer test|mvn (test|verify)|gradle(w)? (test|check)|make (test|check)|ctest|npm run (test|lint|check|build|typecheck)|node .*sweeps|node .*test)/i;
// A program given by its path ("C:\Program Files\nodejs\node.exe",
// ./node_modules/.bin/jest) is the same program as its bare name. Only the
// program at the start of each command segment is rewritten; arguments such as
// test/run.mjs are left alone, because the checks above match on them.
const LEAD_PROGRAM = /(^|&&|\|\||[;|(])(\s*)(?:"(?:[^"]*[\\/])?([\w.+-]+?)(?:\.exe|\.cmd|\.bat)?"|(?:[A-Za-z]:)?[^\s"]*[\\/]([\w.+-]+?)(?:\.exe|\.cmd|\.bat)?)(?=\s|$)/gi;
export function programCommand(cmd) {
  return String(cmd || '').replace(LEAD_PROGRAM, (m, lead, space, quoted, unquoted) => lead + space + (quoted || unquoted));
}
export function looksLikeVerification(cmd) {
  return VERIFY_RE.test(cmd || '') || VERIFY_RE.test(programCommand(cmd));
}

// The hooks launcher is the server launcher pointed at lib/hooks.mjs, so the
// two can never drift apart in how they pick the installed copy.
export const HOOKS_LAUNCHER_SOURCE = LAUNCHER_SOURCE.split("'mcp', 'server.mjs'").join("'lib', 'hooks.mjs'");
