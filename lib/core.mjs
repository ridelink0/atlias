// atlias - shared runtime for every hook, the CLI and the MCP server.
// Zero dependencies. Node 18+. Windows, macOS and Linux.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const VERSION = '2.1.3';
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
  verify: { syntax: true, doublePass: true },
  guard: { loopThreshold: 4, loopWindow: 30, destructive: true },
  graph: { autoBuild: true, autoUpdate: true, maxFilesForAutoBuild: 4000, queryBudget: 600, godNodes: 8, updateDebounceMs: 60000 },
  brief: { memoryChars: 6000, progressChars: 2400 },
  recall: { budgetChars: 2500, bodyChars: 500 },
  dream: { enabled: true, keepHistory: 400 },
  router: { graph: true, companions: true },
  agent: { mode: 'ask', engine: 'auto', ollamaUrl: 'http://127.0.0.1:11434', ollamaModel: 'gemma3:4b', maxToolRounds: 8 },
};

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

// ---------- processes ----------
export function run(cmd, args = [], opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8', timeout: opts.timeout || 8000, cwd: opts.cwd || undefined,
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

// ---------- tool payload helpers (Claude Code, Codex, Gemini CLI shapes) ----------
export const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.py', '.json', '.go', '.rs', '.java', '.kt', '.swift', '.c', '.cc', '.cpp', '.h', '.hpp', '.cs', '.rb', '.php', '.dart', '.vue', '.svelte', '.sql', '.sh', '.ps1', '.toml', '.yaml', '.yml', '.html', '.css', '.md']);
export function isCodeFile(p) { return CODE_EXT.has(path.extname(String(p || '')).toLowerCase()); }
export function filesFromTool(toolName, input) {
  if (!input || typeof input !== 'object') return [];
  const out = new Set();
  for (const k of ['file_path', 'notebook_path', 'path', 'filePath', 'target_file']) if (typeof input[k] === 'string') out.add(input[k]);
  if (Array.isArray(input.edits)) for (const e of input.edits) if (e && typeof e.file_path === 'string') out.add(e.file_path);
  // Codex apply_patch: "*** Update File: path" / "*** Add File: path"
  const patch = typeof input.input === 'string' ? input.input : (typeof input.patch === 'string' ? input.patch : null);
  if (patch) for (const m of patch.matchAll(/^\*\*\* (?:Update|Add) File: (.+)$/gm)) out.add(m[1].trim());
  return [...out];
}
export function commandFromTool(toolName, input) {
  if (!input || typeof input !== 'object') return null;
  const c = input.command ?? input.cmd ?? null;
  if (Array.isArray(c)) return c.join(' ');
  return typeof c === 'string' ? c : null;
}
export function isEditTool(toolName) { return /^(Write|Edit|MultiEdit|NotebookEdit|apply_patch|write_file|replace|edit_file|create_file)$/i.test(String(toolName || '')); }
export function isShellTool(toolName) { return /^(Bash|PowerShell|shell|exec|exec_command|run_shell_command|run_terminal_cmd|local_shell)$/i.test(String(toolName || '')); }
export function looksLikeVerification(cmd) {
  return /\b(node --check|deno (check|test|lint)|bun test|npm test|pnpm test|yarn test|pytest|python -m py_compile|py_compile|go (test|vet|build)|cargo (test|check|clippy)|jest|vitest|mocha|playwright test|cypress run|eslint|biome (check|lint)|ruff|flake8|mypy|pyright|tsc|swift test|xcodebuild|flutter test|dart (test|analyze)|dotnet test|rspec|phpunit|composer test|mvn (test|verify)|gradle(w)? (test|check)|make (test|check)|ctest|npm run (test|lint|check|build|typecheck)|node .*sweeps|node .*test)/i.test(cmd || '');
}
