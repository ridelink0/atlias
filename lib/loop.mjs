// The agent's own tool loop, used when atlias drives a model directly (a local
// Ollama model or any OpenAI-compatible endpoint) instead of through claude or
// codex. It is built for the weakest model it will meet, so the harness does
// the work a strong model would otherwise do in its head:
//
//   tool calls     native function calling where the endpoint has it, a fenced
//                  text block where it does not, and a repair pass for the
//                  broken JSON, stray fences and foreign tool names that small
//                  models write.
//   reading        numbered windows of a file, and a note instead of a second
//                  copy when the same window is read again unchanged.
//   editing        exact-text replacement that must match once, with a syntax
//                  guard that puts the file back when an edit would break it.
//   output         the head and the tail of long output, never just the head,
//                  because errors and test summaries come last.
//   context        old tool results shrink to a one-line note (observation
//                  masking); the plan is repeated after every result so it
//                  stays in recent attention.
//   finishing      an answer after an edit with no check since is sent back
//                  once, and running out of rounds is reported as exactly that.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { spawnSync } from 'node:child_process';
import { config, run, recordEvent, clip, isCodeFile, looksLikeVerification, programCommand } from './core.mjs';
import * as gate from './gate.mjs';
import * as guard from './guard.mjs';
import * as graph from './graph.mjs';
import * as integrity from './integrity.mjs';
import { recall, remember } from '../mcp/tools.mjs';

// ---------- the tools ----------
// One table feeds the text prompt, the native schemas and the error messages,
// so a tool cannot be described one way and run another.
export const TOOLS = [
  { name: 'read_file', about: 'read a file as numbered lines, one window at a time', params: { path: 'string', offset: 'integer?', limit: 'integer?' } },
  { name: 'edit_file', about: 'replace old_string with new_string in a file; old_string must match exactly once unless replace_all is true', params: { path: 'string', old_string: 'string', new_string: 'string', replace_all: 'boolean?' } },
  { name: 'write_file', about: 'create a new file, or replace a whole file', params: { path: 'string', content: 'string' } },
  { name: 'list_dir', about: 'list a directory', params: { path: 'string?' } },
  { name: 'grep', about: 'search file contents with a regular expression', params: { pattern: 'string', path: 'string?' } },
  { name: 'shell', about: 'run a command in the project directory; use it to run tests, builds and the program itself', params: { command: 'string' } },
  { name: 'todo', about: 'write your plan as a checklist; send the whole list every time, marking finished items done', params: { items: 'todo[]' } },
  { name: 'recall', about: 'search saved memory and past sessions', params: { query: 'string' } },
  { name: 'remember', about: 'save a durable fact for later sessions', params: { name: 'string', type: 'string', description: 'string', body: 'string' } },
  { name: 'graph_query', about: 'ask the knowledge graph where something lives; cheaper than reading files', params: { question: 'string' } },
];
export const TOOL_NAMES = TOOLS.map((t) => t.name);

// Names other harnesses taught models to use, mapped onto ours.
export const TOOL_ALIASES = {
  read: 'read_file', cat: 'read_file', open_file: 'read_file', view: 'read_file', view_file: 'read_file',
  edit: 'edit_file', str_replace: 'edit_file', replace: 'edit_file', str_replace_editor: 'edit_file', apply_edit: 'edit_file',
  write: 'write_file', create_file: 'write_file', save_file: 'write_file',
  ls: 'list_dir', list_files: 'list_dir', list_directory: 'list_dir',
  search: 'grep', find: 'grep', search_files: 'grep', rg: 'grep',
  bash: 'shell', run: 'shell', exec: 'shell', terminal: 'shell', run_command: 'shell', execute_command: 'shell',
  plan: 'todo', update_plan: 'todo', todo_write: 'todo', todowrite: 'todo',
  memory_search: 'recall', save_memory: 'remember', query_graph: 'graph_query',
};
const ARG_ALIASES = {
  file: 'path', file_path: 'path', filepath: 'path', filename: 'path', dir: 'path', directory: 'path',
  cmd: 'command', old: 'old_string', old_str: 'old_string', old_text: 'old_string', new: 'new_string', new_str: 'new_string', new_text: 'new_string',
  text: 'content', contents: 'content', data: 'content', regex: 'pattern', query_text: 'query', start_line: 'offset', lines: 'limit', todos: 'items', tasks: 'items',
};

function schemaFor(type) {
  const t = type.replace(/\?$/, '');
  if (t === 'todo[]') return { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, done: { type: 'boolean' } }, required: ['text'] } };
  return { type: t };
}
export function toolSchemas(hasGraph = true) {
  return TOOLS.filter((t) => hasGraph || t.name !== 'graph_query').map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.about,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(Object.entries(t.params).map(([k, v]) => [k, schemaFor(v)])),
        required: Object.entries(t.params).filter(([, v]) => !v.endsWith('?')).map(([k]) => k),
      },
    },
  }));
}

// ---------- the prompt ----------
// The first three instructions are the persistence, tool-use and planning
// reminders OpenAI measured on GPT-4.1 for agentic work. The rest is the
// workflow a weak model would not arrive at on its own.
export function systemPrompt(cwd, { native = false, hasGraph = graph.status(cwd).exists } = {}) {
  const lines = [
    `You are atlias, a coding agent working in ${cwd}.`,
    'Keep going until the request is completely resolved before you end your turn. Only stop when you are sure the problem is solved.',
    'If you are not sure about file contents or project structure, use your tools to read files and gather the facts. Do not guess or make up an answer.',
    'Plan before each tool call and reflect on the result of the last one. For work with more than two steps, write the plan with the todo tool first and keep it current.',
    `Work in this order: find the code (${hasGraph ? 'graph_query, ' : ''}grep, list_dir); read only the lines you need (read_file with offset and limit); change it with edit_file, copying old_string exactly without the line numbers; then run the smallest real check with shell (the test, the build, or the program itself) and read its output.`,
    'Never say something works unless a check you ran in this conversation showed it. If you could not check, say so plainly. Never leave placeholders, TODOs or stubs in place of real code.',
    'When the task is done, answer in plain text with no tool call: what changed, and the check you ran with its result.',
  ];
  if (!native) {
    lines.push('To use a tool, reply with ONLY one fenced block and nothing else, for example:', '```atlias', '{"tool":"read_file","path":"src/app.js","offset":1,"limit":200}', '```');
    lines.push('Tools: ' + TOOLS.filter((t) => hasGraph || t.name !== 'graph_query').map((t) => `${t.name}{${Object.keys(t.params).join(',')}} ${t.about}`).join('; ') + '.');
  }
  return lines.join('\n');
}

// ---------- reading what the model wrote ----------
// JSON the way small models write it: single quotes, bare keys, trailing
// commas, Python literals, raw newlines inside strings, bad escapes, and
// objects cut off at the token limit. A tokenizer, not regexes, so text inside
// strings is never rewritten.
function normalizeJson(s) {
  let out = '';
  const stack = [];
  const n = s.length;
  let i = 0;
  while (i < n) {
    const ch = s[i];
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      let body = '';
      while (j < n && s[j] !== ch) {
        const c = s[j];
        if (c === '\\' && j + 1 < n) {
          const nx = s[j + 1];
          if (ch === "'" && nx === "'") body += "'";
          else body += '"\\/bfnrtu'.includes(nx) ? c + nx : '\\\\' + nx;
          j += 2;
          continue;
        }
        if (c === '\n') body += '\\n';
        else if (c === '\r') body += '\\r';
        else if (c === '\t') body += '\\t';
        else if (ch === "'" && c === '"') body += '\\"';
        else body += c;
        j++;
      }
      out += '"' + body + '"';
      i = j + 1;
      continue;
    }
    if (/[0-9-]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[\w.+-]/.test(s[j])) j++;
      out += s.slice(i, j);
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < n && /[\w$-]/.test(s[j])) j++;
      const word = s.slice(i, j);
      let k = j;
      while (k < n && /\s/.test(s[k])) k++;
      const literal = { true: 'true', false: 'false', null: 'null', True: 'true', False: 'false', None: 'null' }[word];
      out += s[k] === ':' ? JSON.stringify(word) : (literal || JSON.stringify(word));
      i = j;
      continue;
    }
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
    else if (ch === ',') {
      let k = i + 1;
      while (k < n && /\s/.test(s[k])) k++;
      if (k >= n || s[k] === '}' || s[k] === ']') { i++; continue; }
    }
    out += ch;
    i++;
  }
  while (stack.length) out += stack.pop();
  return out;
}
export function repairJson(raw) {
  const s = String(raw ?? '').trim().replace(/^```[\w-]*[ \t]*\n?/, '').replace(/\n?```\s*$/, '').trim()
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  if (!s) return null;
  try { return JSON.parse(s); } catch { /* repair below */ }
  try { return JSON.parse(normalizeJson(s)); } catch { return null; }
}
// The first balanced {...} starting at `start`, or the rest when it never closes.
function extractObject(s, start) {
  if (start < 0) return '';
  let depth = 0;
  let quote = null;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return s.slice(start, i + 1);
  }
  return s.slice(start);
}
// Every shape a tool call arrives in, flattened to {tool, ...args}.
// strict: the tool must be one of ours (after aliases), which is what keeps a
// JSON example in an answer from being run.
export function normalizeCall(obj, strict = false) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  let name;
  let args = null;
  let rest = {};
  if (typeof obj.tool === 'string') {
    name = obj.tool;
    rest = { ...obj };
    delete rest.tool;
    if (rest.args && typeof rest.args === 'object') { args = rest.args; delete rest.args; }
  } else if (obj.function && typeof obj.function.name === 'string') {
    name = obj.function.name;
    args = obj.function.arguments;
  } else if (typeof obj.name === 'string' && ('arguments' in obj || 'parameters' in obj || 'input' in obj)) {
    name = obj.name;
    args = obj.arguments ?? obj.parameters ?? obj.input;
  } else return null;
  let bad = null;
  if (typeof args === 'string') { const parsed = repairJson(args); if (parsed && typeof parsed === 'object') args = parsed; else { bad = args; args = null; } }
  const tool = TOOL_ALIASES[name] || TOOL_ALIASES[name.toLowerCase()] || name;
  if (strict && !TOOL_NAMES.includes(tool)) return null;
  const merged = { ...rest, ...(args && typeof args === 'object' ? args : {}) };
  const call = { tool };
  for (const [k, v] of Object.entries(merged)) call[ARG_ALIASES[k] && !(ARG_ALIASES[k] in merged) ? ARG_ALIASES[k] : k] = v;
  if (bad !== null) call._badArgs = bad;
  return call;
}
export const TOOL_RE = /```atlias\s*\n([\s\S]*?)```/;
export function parseToolCall(text) {
  const s = String(text || '');
  const tries = [];
  const fence = /```([\w-]*)[ \t]*\n([\s\S]*?)(?:```|$)/g;
  let m;
  while ((m = fence.exec(s))) tries.push({ body: m[2], strict: m[1] !== 'atlias' });
  const tag = /<tool_call>([\s\S]*?)(?:<\/tool_call>|$)/.exec(s);
  if (tag) tries.push({ body: tag[1], strict: true });
  const t = s.trim();
  if (t.startsWith('{')) tries.push({ body: t, strict: true });
  for (const { body, strict } of tries) {
    const b = body.trim();
    const call = normalizeCall(repairJson(extractObject(b, b.indexOf('{'))), strict);
    if (call) return call;
  }
  return null;
}

// ---------- shaping what goes back to the model ----------
// Keep the head and the tail. Test runners, compilers and stack traces put the
// line that matters at the end, which is exactly what a plain clip throws away.
export function elide(text, max = 10000) {
  const s = String(text ?? '');
  if (s.length <= max) return s;
  const head = Math.floor(max * 0.35);
  const tail = max - head;
  return `${s.slice(0, head)}\n[... ${s.length - max} characters cut from the middle; narrow the command or read a smaller range to see them ...]\n${s.slice(s.length - tail)}`;
}
const rel = (cwd, p) => (path.relative(cwd, p) || p).split(path.sep).join('/');
export function insideProject(cwd, target) {
  const r = path.relative(path.resolve(cwd), path.resolve(target));
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r));
}
export function renderTodo(items) {
  return items.map((t) => `${t.done ? '[x]' : '[ ]'} ${t.text}`).join('\n');
}
function recitation(items) {
  if (!items || !items.length) return '';
  const done = items.filter((t) => t.done).length;
  const next = items.find((t) => !t.done);
  return `\n\n(plan ${done}/${items.length} done${next ? `; next: ${clip(next.text, 120)}` : '; every item is done, so check the work and answer'})`;
}
function prep(state) {
  if (!state.reads) state.reads = new Map();
  if (!state.todo) state.todo = [];
  if (!state.clock) state.clock = 0;
  if (!state.obs) state.obs = 0;
  if (!state.edited) state.edited = new Set();
  if (!Number.isInteger(state.editedAt)) state.editedAt = 0;
  if (!Number.isInteger(state.verifiedAt)) state.verifiedAt = 0;
  return state;
}
export const READ_LINES = 400;
const RUNNER = /(^|[\s;&|(])(node|python3?|py|deno|bun|tsx|ts-node|ruby|perl|php|bash|sh|pwsh|powershell|go run|cargo run|java|dotnet run)\s/i;
function numbered(lines, from) {
  return lines.map((l, i) => `${from + i}\t${l.length > 500 ? l.slice(0, 500) + ' [line cut]' : l}`).join('\n');
}

async function confirmOutside(cwd, p, ask) {
  if (insideProject(cwd, p)) return true;
  const answer = ask ? String(await ask(`guard: ${p} is outside ${cwd}. Write it anyway? [y/N] `)).trim().toLowerCase() : 'n';
  return answer === 'y' || answer === 'yes';
}
const OUTSIDE = (p, cwd) => `refused: ${p} is outside the project. Nothing was written. Ask the user for the change, or start atlias in the directory that owns that file.`;

// Write, then parse. A file that parsed before and does not now is put back;
// a file that was already broken keeps the change, since it may be the fix.
function forgetReads(state, p) {
  for (const k of [...state.reads.keys()]) if (k.startsWith(p + '|')) state.reads.delete(k);
}
function guardedWrite(p, next) {
  const existed = fs.existsSync(p);
  const before = existed ? fs.readFileSync(p, 'utf8') : null;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, next);
  if (!isCodeFile(p)) return { kept: true };
  const after = gate.syntaxCheck([p]);
  if (!after.length) return { kept: true };
  if (!existed) return { kept: true, broken: after[0].error };
  fs.writeFileSync(p, before);
  const was = gate.syntaxCheck([p]);
  if (was.length) { fs.writeFileSync(p, next); return { kept: true, broken: after[0].error }; }
  return { kept: false, broken: after[0].error };
}
function snippetAround(text, index, span) {
  const lines = text.split(/\r?\n/);
  const line = text.slice(0, index).split(/\r?\n/).length;
  const from = Math.max(1, line - 2);
  const to = Math.min(lines.length, line + span + 2);
  return { line, text: numbered(lines.slice(from - 1, to), from) };
}
function searchFiles(root, pattern, limit = 200) {
  let re;
  try { re = new RegExp(pattern); } catch { re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); }
  const out = [];
  const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv', 'venv', 'target']);
  const base = fs.statSync(root).isFile() ? path.dirname(root) : root;
  const scan = (p) => {
    let text;
    try { if (fs.statSync(p).size > 2 * 1024 * 1024) return; text = fs.readFileSync(p, 'utf8'); } catch { return; }
    if (text.includes('\u0000')) return;
    text.split(/\r?\n/).forEach((l, i) => { if (out.length < limit && re.test(l)) out.push(`${rel(base, p)}:${i + 1}:${clip(l, 300)}`); });
  };
  const walk = (dir, depth) => {
    if (out.length >= limit || depth > 12) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (out.length >= limit) return;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!skip.has(e.name)) walk(p, depth + 1); continue; }
      scan(p);
    }
  };
  if (base !== root) scan(root);
  else walk(root, 0);
  return out;
}

export async function runTool(state, call, ask) {
  prep(state);
  const cwd = state.cwd;
  const abs = (p) => (path.isAbsolute(p || '') ? p : path.join(cwd, p || ''));
  state.clock++;
  if (call._badArgs !== undefined) return `the arguments for ${call.tool} were not valid JSON: ${clip(call._badArgs, 300)}. Send them again as one JSON object.`;
  try {
    switch (call.tool) {
      case 'read_file': {
        if (!call.path) return 'read_file needs a path.';
        const p = abs(call.path);
        const st = fs.statSync(p);
        if (st.isDirectory()) return `${rel(cwd, p)} is a directory; use list_dir.`;
        const text = fs.readFileSync(p, 'utf8');
        if (text.slice(0, 8000).includes('\u0000')) return `${rel(cwd, p)} is a binary file (${st.size} bytes); not shown.`;
        const lines = text.split(/\r?\n/);
        if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
        const offset = Math.max(1, parseInt(call.offset, 10) || 1);
        const limit = Math.min(2000, Math.max(1, parseInt(call.limit, 10) || READ_LINES));
        const key = `${p}|${offset}|${limit}`;
        const prev = state.reads.get(key);
        const keep = Math.max(1, config().agent.keepObservations);
        if (prev && prev.mtime === st.mtimeMs && prev.size === st.size && prev.obs >= state.obs - keep) {
          return `unchanged since you read it a moment ago; that result is still above. Read a different range or go on.`;
        }
        state.reads.set(key, { mtime: st.mtimeMs, size: st.size, obs: state.obs });
        if (offset > lines.length) return `${rel(cwd, p)} has ${lines.length} lines; offset ${offset} is past the end.`;
        const end = Math.min(lines.length, offset + limit - 1);
        const more = lines.length - end;
        return `${rel(cwd, p)} lines ${offset}-${end} of ${lines.length}\n${numbered(lines.slice(offset - 1, end), offset)}${more ? `\n[${more} more lines; read_file with offset ${end + 1} to continue]` : ''}`;
      }
      case 'edit_file': {
        if (!call.path) return 'edit_file needs a path.';
        const p = abs(call.path);
        if (!(await confirmOutside(cwd, p, ask))) return OUTSIDE(p, cwd);
        if (!fs.existsSync(p)) return `there is no ${rel(cwd, p)}. Use write_file to create a new file.`;
        const before = fs.readFileSync(p, 'utf8');
        let oldS = String(call.old_string ?? '');
        let newS = String(call.new_string ?? '');
        if (!oldS) return 'old_string is empty. Copy the exact lines to replace from a read_file result, without the line numbers.';
        if (oldS === newS) return 'old_string and new_string are the same; nothing would change.';
        const crlf = before.includes('\r\n');
        const fit = (s) => (crlf ? s.replace(/\r?\n/g, '\r\n') : s);
        const count = (s) => (s ? before.split(fit(s)).length - 1 : 0);
        let hits = count(oldS);
        // Line numbers copied from a read_file result are the commonest miss.
        const NUM = /^[ \t]*\d+\t/;
        if (!hits && oldS.split(/\r?\n/).filter((l) => l).every((l) => NUM.test(l))) {
          const strip = (s) => s.split(/\r?\n/).map((l) => l.replace(NUM, '')).join('\n');
          if (count(strip(oldS))) { oldS = strip(oldS); if (newS.split(/\r?\n/).filter((l) => l).every((l) => NUM.test(l))) newS = strip(newS); hits = count(oldS); }
        }
        if (!hits) {
          const first = (oldS.split(/\r?\n/).find((l) => l.trim()) || '').trim();
          const at = first ? before.split(/\r?\n/).map((l, i) => (l.trim() === first ? i + 1 : 0)).filter(Boolean).slice(0, 5) : [];
          return `old_string was not found in ${rel(cwd, p)}. It has to match the file exactly, indentation included, without line numbers.${at.length ? ` Its first line is at line ${at.join(', ')}; read_file there and copy the text exactly.` : ' read_file the part you mean to change and copy it exactly.'}`;
        }
        const o = fit(oldS);
        const nw = fit(newS);
        if (hits > 1 && !call.replace_all) {
          const starts = [];
          let from = 0;
          for (let k = 0; k < hits && starts.length < 8; k++) { const idx = before.indexOf(o, from); starts.push(before.slice(0, idx).split(/\r?\n/).length); from = idx + o.length; }
          return `old_string matches ${hits} places in ${rel(cwd, p)} (lines ${starts.join(', ')}). Include more surrounding lines so it matches once, or set replace_all to true.`;
        }
        const index = before.indexOf(o);
        const after = call.replace_all ? before.split(o).join(nw) : before.slice(0, index) + nw + before.slice(index + o.length);
        const res = guardedWrite(p, after);
        if (!res.kept) return `refused: that edit would leave ${rel(cwd, p)} unable to parse (${clip(res.broken, 300)}). The file is unchanged. Fix new_string and try again.`;
        recordEvent(state.sid, { kind: 'edit', tool: 'edit_file', files: [p] });
        forgetReads(state, p);
        state.edited.add(p);
        state.editedAt = state.clock;
        const shown = snippetAround(after, index, nw.split(/\r?\n/).length);
        const tail = res.broken ? `\nIt still does not parse: ${clip(res.broken, 300)}` : '';
        return `edited ${rel(cwd, p)}${call.replace_all && hits > 1 ? ` in ${hits} places` : ''}; around line ${shown.line} it now reads:\n${shown.text}${tail}`;
      }
      case 'write_file': {
        if (!call.path) return 'write_file needs a path.';
        const p = abs(call.path);
        if (!(await confirmOutside(cwd, p, ask))) return OUTSIDE(p, cwd);
        const res = guardedWrite(p, String(call.content ?? ''));
        if (!res.kept) return `refused: that content would leave ${rel(cwd, p)} unable to parse (${clip(res.broken, 300)}). The file is unchanged.`;
        recordEvent(state.sid, { kind: 'edit', tool: 'write_file', files: [p] });
        forgetReads(state, p);
        state.edited.add(p);
        state.editedAt = state.clock;
        return res.broken ? `written ${p}, but it does not parse: ${clip(res.broken, 300)}` : `written ${p}`;
      }
      case 'list_dir': {
        const entries = fs.readdirSync(abs(call.path || '.'), { withFileTypes: true }).map((e) => (e.isDirectory() ? e.name + '/' : e.name)).sort();
        return entries.slice(0, 300).join('\n') + (entries.length > 300 ? `\n[${entries.length - 300} more entries]` : '') || '(empty directory)';
      }
      case 'grep': {
        const pattern = String(call.pattern || '');
        if (!pattern) return 'grep needs a pattern.';
        const where = abs(call.path || '.');
        const isFile = fs.statSync(where).isFile();
        const dir = isFile ? path.dirname(where) : where;
        const r = run('git', ['grep', '-n', '-I', '-E', '--untracked', '-e', pattern, '--', ...(isFile ? [path.basename(where)] : [])], { cwd: dir, timeout: 20000 });
        if (r.status === 0) return elide(r.stdout, 8000);
        if (r.status === 1 && !r.stderr) return '(no matches)';
        const found = searchFiles(where, pattern);
        return found.length ? elide(found.join('\n'), 8000) + (found.length >= 200 ? '\n[stopped at 200 matches; narrow the pattern]' : '') : '(no matches)';
      }
      case 'shell': {
        const cmd = String(call.command || '');
        if (!cmd.trim()) return 'shell needs a command.';
        const why = guard.destructiveReason(cmd);
        if (why) {
          const answer = ask ? String(await ask(`guard: ${why}. Run "${clip(cmd, 120)}"? [y/N] `)).trim().toLowerCase() : 'n';
          if (answer !== 'y' && answer !== 'yes') return `refused by the user: ${why}`;
        }
        const r = spawnSync(cmd, { shell: true, cwd, encoding: 'utf8', timeout: 10 * 60 * 1000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
        // Running an edited program counts as checking it; printing it does not.
        const names = [...state.edited].map((f) => path.basename(f));
        const verify = looksLikeVerification(cmd) || (RUNNER.test(programCommand(cmd)) && names.some((n) => cmd.includes(n)));
        const ev = { kind: 'shell', command: clip(cmd, 300), verify };
        if (verify) {
          const v = integrity.verdict({ tool_response: { stdout: r.stdout || '', stderr: r.stderr || '', exit_code: r.status, interrupted: Boolean(r.signal || r.error) } });
          ev.outcome = v.outcome;
          if (v.excerpt) ev.excerpt = v.excerpt;
          state.verifiedAt = state.clock;
        }
        recordEvent(state.sid, ev);
        const head = r.error && r.error.code === 'ETIMEDOUT' ? 'timed out after 10 minutes' : `exit ${r.status}${r.signal ? ` (killed by ${r.signal})` : ''}`;
        return `${head}\n${elide(`${r.stdout || ''}${r.stderr ? (r.stdout ? '\n' : '') + r.stderr : ''}`, 10000)}`;
      }
      case 'todo': {
        const raw = Array.isArray(call.items) ? call.items : typeof call.items === 'string' ? call.items.split(/\r?\n/) : [];
        state.todo = raw.map((it) => (typeof it === 'string'
          ? { text: it.replace(/^\s*(?:[-*]|\d+[.)])?\s*(?:\[[ xX]\]\s*)?/, '').trim(), done: /\[[xX]\]/.test(it) }
          : { text: String((it && (it.text || it.task || it.content || it.title)) || '').trim(), done: Boolean(it && (it.done === true || /^(done|completed|complete)$/i.test(String(it.status || '')))) }))
          .filter((t) => t.text).slice(0, 30);
        return state.todo.length ? `plan saved:\n${renderTodo(state.todo)}` : 'the plan is empty; send items as [{"text":"...","done":false}].';
      }
      case 'recall': return recall(cwd, call.query);
      case 'remember': return remember(cwd, call);
      case 'graph_query': return graph.query(cwd, call.question, config().graph.queryBudget) || 'no graph here, or no answer';
      default: return `unknown tool ${call.tool}; the tools are ${TOOL_NAMES.join(', ')}`;
    }
  } catch (e) {
    if (e && e.code === 'ENOENT') return `${call.tool}: there is no ${call.path ? rel(cwd, abs(call.path)) : 'such file'}. list_dir or grep to find the right path.`;
    return `tool ${call.tool} failed: ${e.message}`;
  }
}

// ---------- context ----------
// What is sent to the model: the conversation with every tool result older
// than the last `keep` shrunk to its first line, and old large tool inputs
// (whole files written) shrunk the same way. The stored history is untouched.
export function view(messages, keep) {
  const k = Math.max(1, parseInt(keep, 10) || 1);
  const obsIdx = [];
  messages.forEach((m, i) => { if (m._obs) obsIdx.push(i); });
  const masked = new Set(obsIdx.slice(0, Math.max(0, obsIdx.length - k)));
  const oldest = obsIdx.length > k ? obsIdx[obsIdx.length - k] : -1;
  return messages.map((m, i) => {
    const { _obs, ...plain } = m;
    if (masked.has(i)) return { ...plain, content: `[${_obs.label}: ${_obs.summary} ... elided to keep the context small; call it again if you need it]` };
    if (plain.role === 'assistant' && i < oldest) {
      if (Array.isArray(plain.tool_calls)) {
        return { ...plain, tool_calls: plain.tool_calls.map((tc) => (tc.function && String(tc.function.arguments || '').length > 1500 ? { ...tc, function: { ...tc.function, arguments: JSON.stringify({ elided: `${String(tc.function.arguments).length} characters of arguments` }) } } : tc)) };
      }
      if (typeof plain.content === 'string' && plain.content.length > 1500) return { ...plain, content: elide(plain.content, 600) };
    }
    return plain;
  });
}

// ---------- the loop ----------
// chat(messages, tools) resolves to { content, calls: [{id, tool, ...args}],
// message } or { error }. tools is null in text mode.
export async function runLoop(state, prompt, { chat, ask, say, native = false } = {}) {
  prep(state);
  const cfg = config().agent;
  const hasGraph = graph.status(state.cwd).exists;
  if (!state.messages.length) state.messages.push({ role: 'system', content: systemPrompt(state.cwd, { native, hasGraph }) });
  state.messages.push({ role: 'user', content: prompt });
  const runStart = state.clock;
  const seen = new Map();
  let nudged = false;
  let badBlocks = 0;
  let lastResult = '';
  const rounds = Math.max(1, cfg.maxToolRounds);
  for (let round = 0; round < rounds; round++) {
    const useNative = native && !state.textTools;
    let res;
    try { res = await chat(view(state.messages, cfg.keepObservations), useNative ? toolSchemas(hasGraph) : null); } catch (e) { res = { error: e && e.message ? e.message : String(e) }; }
    if (res && res.toolsRefused && useNative) {
      // The endpoint rejected native tools: switch this session to text blocks.
      state.textTools = true;
      state.messages[0] = { role: 'system', content: systemPrompt(state.cwd, { native: false, hasGraph }) };
      round--;
      continue;
    }
    if (!res || res.error) return `atlias: the model call failed: ${res ? res.error : 'no response'}`;
    const content = String(res.content || '');
    let calls = Array.isArray(res.calls) ? res.calls.filter((c) => c && c.tool) : [];
    if (!calls.length) { const t = parseToolCall(content); if (t) calls = [t]; }
    state.messages.push(res.message && calls.some((c) => c.id) ? res.message : { role: 'assistant', content });
    if (!calls.length) {
      if (/```atlias/.test(content) && badBlocks < 2) {
        badBlocks++;
        state.messages.push({ role: 'user', content: 'atlias: that tool block did not parse. Send exactly one block holding one JSON object, for example:\n```atlias\n{"tool":"read_file","path":"src/app.js"}\n```' });
        continue;
      }
      const unchecked = state.editedAt > runStart && state.verifiedAt < state.editedAt;
      if (unchecked && !nudged && round < rounds - 1) {
        nudged = true;
        const files = [...state.edited].map((f) => rel(state.cwd, f)).slice(0, 6).join(', ');
        state.messages.push({ role: 'user', content: `atlias: you changed ${files} and ran no check after the last edit. Run the smallest real check now with shell (the test, the build, or the program itself) and read its output before you answer. If no check is possible here, say so plainly in the answer.` });
        continue;
      }
      return content.trim() || 'atlias: the model returned an empty answer.';
    }
    for (const call of calls) {
      const key = JSON.stringify({ ...call, id: undefined });
      seen.set(key, (seen.get(key) || 0) + 1);
      const repeated = seen.get(key) >= config().guard.loopThreshold;
      if (say) say(`  tool ${call.tool} ${clip(call.path || call.command || call.pattern || call.query || call.question || '', 80)}`);
      const result = repeated
        ? 'atlias guard: this exact tool call has repeated and returns the same result each time. Change the input or the approach, or answer with what you already know.'
        : await runTool(state, call, ask);
      lastResult = result;
      const body = result + recitation(state.todo);
      const obs = { label: `${call.tool} ${clip(call.path || call.command || call.pattern || call.query || call.question || '', 60)}`.trim(), summary: clip(result.split('\n')[0], 100) };
      state.obs++;
      if (call.id) state.messages.push({ role: 'tool', tool_call_id: call.id, content: body, _obs: obs });
      else state.messages.push({ role: 'user', content: `Tool result for ${call.tool}:\n${body}`, _obs: obs });
    }
  }
  const plan = state.todo.length ? ` The plan stands at ${state.todo.filter((t) => t.done).length}/${state.todo.length} done.` : '';
  return `atlias stopped after ${rounds} tool rounds without a final answer, so the task is not finished.${plan} The last tool result began: ${clip(lastResult.split('\n')[0], 200)}. Say "continue" to give it more rounds, or raise agent.maxToolRounds with atlias settings.`;
}

// ---------- engines ----------
export function transportFor(url) {
  try { return new URL(url).protocol === 'https:' ? https : http; } catch { return http; }
}
export function postJson(url, body, headers = {}, timeout = 10 * 60 * 1000) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch { resolve({ status: 0, error: `not a url: ${url}` }); return; }
    const data = JSON.stringify(body);
    const req = transportFor(u.href).request({ hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + u.search, method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), ...headers }, timeout }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (x) => { text += x; });
      res.on('end', () => { let json = null; try { json = JSON.parse(text); } catch { /* not json */ } resolve({ status: res.statusCode, json, text }); });
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timed out' }); });
    req.end(data);
  });
}
export function apiKey(env = process.env) { return env.ATLIAS_API_KEY || env.OPENAI_API_KEY || ''; }
const LOCAL = /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i;
// Configured, not probed: a model name, and a key unless the endpoint is local.
export function openaiReady(cfg = config().agent, env = process.env) {
  return Boolean(cfg.openaiModel) && (Boolean(apiKey(env)) || LOCAL.test(String(cfg.openaiUrl || '')));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function openaiChat(cfg = config().agent, env = process.env, deps = {}) {
  const post = deps.post || postJson;
  const wait = deps.sleep || sleep;
  return async (messages, tools) => {
    const url = String(cfg.openaiUrl || '').replace(/\/+$/, '') + '/chat/completions';
    const body = { model: cfg.openaiModel, messages, temperature: 0.2 };
    if (tools) { body.tools = tools; body.tool_choice = 'auto'; }
    const headers = apiKey(env) ? { authorization: `Bearer ${apiKey(env)}` } : {};
    let r;
    for (let attempt = 0; attempt < 3; attempt++) {
      r = await post(url, body, headers);
      if (r.status === 429 || r.status >= 500 || r.status === 0) { if (attempt < 2) { await wait(attempt ? 5000 : 2000); continue; } }
      break;
    }
    if (tools && (r.status === 400 || r.status === 422) && /tool|function/i.test(r.text || '')) return { toolsRefused: true };
    if (r.status !== 200 || !r.json) return { error: `${r.status ? `HTTP ${r.status}` : r.error}: ${clip(r.text || '', 300)}` };
    const msg = (r.json.choices && r.json.choices[0] && r.json.choices[0].message) || {};
    // Every call id the endpoint sent must get an answer, or the next request
    // is refused; a call with no usable name is answered as an unknown tool.
    const calls = (msg.tool_calls || []).map((tc) => {
      const fn = (tc && tc.function) || {};
      const c = normalizeCall({ function: { name: typeof fn.name === 'string' && fn.name ? fn.name : 'unnamed', arguments: fn.arguments ?? '{}' } });
      return { ...c, id: tc && tc.id };
    });
    const message = { role: 'assistant', content: msg.content || '' };
    if (msg.tool_calls && msg.tool_calls.length) message.tool_calls = msg.tool_calls;
    return { content: msg.content || '', calls, message };
  };
}
export function ollamaChat(cfg = config().agent, deps = {}) {
  const post = deps.post || postJson;
  return async (messages) => {
    const r = await post(new URL('/api/chat', cfg.ollamaUrl).href, { model: cfg.ollamaModel, messages, stream: false, options: { temperature: 0.2 } });
    if (r.status !== 200 || !r.json || !r.json.message) return { error: r.error || `ollama returned something unexpected: ${clip(r.text || '', 300)}` };
    return { content: r.json.message.content || '', calls: [] };
  };
}
