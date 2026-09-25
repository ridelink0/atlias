// Pointer-first enforcement. "Ask the knowledge graph before you open files"
// has been in the brief's working rules since the first version, and a rule
// nothing measures is advice. A symbol-indexed navigation server measured 77
// per cent fewer active tokens for moving by pointer instead of reading whole
// files (docs/NEXTGEN.md), which is the size of what the advice was leaving on
// the table.
//
// So a whole-file read of a file the graph could have answered now costs one
// nudge, the way the gate costs a claim with no check behind it: once, cheaply,
// naming the query that should have run. It never blocks. The read has already
// happened by then and the file is not the enemy; the habit is.
//
// A nudge that fired on every read would be worse than none, so all of this
// has to be true before it speaks:
//   - a graph exists for this project, or there was nothing to ask;
//   - the graph was not already asked this turn, by the model or by the router;
//   - the whole file was taken, not a window of it;
//   - it is a code file, and big enough that asking would have been cheaper;
//   - the user's own prompt did not name it, or the read IS the request;
//   - nothing in this session wrote it, or the graph is the stale one, not you;
//   - nothing has nudged yet this turn, and the session's budget is not spent.
//
// This runs on the host side only (PostToolUse). The agent's own read_file
// already hands back a 400-line window and points at outline for the rest, so
// there is no whole-file read there to enforce against.
import fs from 'node:fs';
import path from 'node:path';
import { config, eventsTail, sessionMeta, saveSessionMeta, exists, graphPath, isCodeFile, filesFromTool, commandFromTool, isShellTool, contextOutput, clip, ROOT } from './core.mjs';

// The read tools the hosts use: Claude Code's Read, Gemini CLI's read_file,
// and the names other harnesses taught models (atlias's own loop maps the same
// set in TOOL_ALIASES).
export const READ_TOOLS = /^(Read|read_file|readfile|read|view|view_file|open_file|cat|get_file_contents)$/i;
// Any of these means a window was asked for, which is the habit already.
export const WINDOW_KEYS = ['offset', 'limit', 'start_line', 'end_line', 'line_start', 'line_end', 'range', 'lines', 'head', 'tail', 'max_lines'];
// Codex reads through the shell, so the same read arrives as a command. Only a
// bare cat of one file counts: a pipe, a redirect or a sed window is something
// else, and mistaking one for a whole-file read is how a nudge becomes noise.
export const SHELL_READ = /^\s*(?:cat|type|Get-Content|gc)\s+(?:-(?:Raw|Encoding)\s+\S+\s+|-Raw\s+)*(?:"([^"]+)"|'([^']+)'|([^\s"'|<>&;]+))\s*$/i;
export const GRAPH_ASK = /graph_(query|explain|affected)|graphify/i;

function inside(cwd, target) {
  const r = path.relative(path.resolve(cwd), path.resolve(target));
  return r === '' || (r !== '..' && !r.startsWith('..' + path.sep) && !path.isAbsolute(r));
}

// The one file a call took as a whole, or null.
export function wholeFileRead(tool, input) {
  const name = String(tool || '');
  const args = input && typeof input === 'object' ? input : {};
  if (READ_TOOLS.test(name)) {
    for (const k of WINDOW_KEYS) { const v = args[k]; if (v !== undefined && v !== null && v !== '' && v !== false) return null; }
    const files = filesFromTool(name, args);
    return files.length === 1 ? files[0] : null;
  }
  if (isShellTool(name)) {
    const cmd = commandFromTool(name, args);
    const m = cmd ? SHELL_READ.exec(cmd) : null;
    return m ? m[1] || m[2] || m[3] : null;
  }
  return null;
}

// Did anything in this turn already ask the graph? A tool call by any of its
// names (the MCP tools arrive prefixed by the host), a graphify command in the
// shell, or the router's own injected answer, which records a graph event.
export function graphAsked(turn) {
  for (const e of turn || []) {
    if (e.kind === 'graph') return true;
    if (GRAPH_ASK.test(String(e.tool || ''))) return true;
    if (GRAPH_ASK.test(String(e.command || ''))) return true;
  }
  return false;
}

// A prompt that names the file is a prompt that already decided which file.
export function namedInPrompt(promptText, file) {
  const t = String(promptText || '');
  if (!t) return false;
  const base = path.basename(String(file || ''));
  if (!base) return false;
  const stem = base.replace(/\.[^.]+$/, '');
  return t.includes(base) || (stem.length >= 4 && t.includes(stem));
}

export function touched(events, file) {
  const want = path.resolve(file);
  for (const e of events || []) {
    if (e.kind !== 'edit') continue;
    for (const f of e.files || []) { try { if (path.resolve(f) === want) return true; } catch { /* an unusable path is not a match */ } }
  }
  return false;
}

// This turn, from the recent end of the log. When the turn's own prompt marker
// has been pushed out of the window the answer is no turn at all: a nudge is a
// convenience and must never pay for a full read of a session's whole history.
export function turnSlice(events) {
  const evs = events || [];
  for (let i = evs.length - 1; i >= 0; i--) {
    if (evs[i].kind !== 'prompt') continue;
    return { promptId: evs[i].prompt_id || 'none', promptText: String(evs[i].text || ''), turn: evs.slice(i + 1) };
  }
  return null;
}

// The query that should have run. The user's own question is the best version
// of it, because that is what the graph exists to answer; with nothing usable
// there, ask about the file itself.
export function question(file, promptText) {
  const p = String(promptText || '').replace(/\s+/g, ' ').trim();
  if (p.length >= 12) return clip(p, 160);
  const stem = path.basename(String(file || '')).replace(/\.[^.]+$/, '') || 'this module';
  return `where is ${stem} used and what depends on it`;
}

export function reason(cwd, file, bytes, q) {
  const shown = (() => { try { return path.relative(cwd, file) || file; } catch { return file; } })();
  const kb = Math.max(1, Math.round(bytes / 1024));
  const cli = path.join(ROOT, 'bin', 'atlias.mjs');
  return [
    `atlias pointer-first: you read the whole of ${shown} (${kb} KB) without asking the graph.`,
    'What went wrong: the working rule is to ask the knowledge graph first and then open only what it names. This project has one. A query costs a few hundred tokens; a whole file costs thousands, and most of what you just read is not about this task.',
    `The query that would have done it: graph_query { question: "${q}" }   (from a shell: node "${cli}" graph query "${q}")`,
    'Fix: nothing is blocked and that read stands. Ask before the next file, then read only the lines the answer names (Read with offset and limit). If you already knew this was the file, carry on - this note is spent for this turn either way.',
  ].join('\n');
}

// The decision, and the only place it is recorded. Returns the nudge or null.
export function consider(payload, cfg = config()) {
  const p = cfg.pointer || {};
  if (!p.nudge) return null;
  const rel = wholeFileRead(payload.tool_name, payload.tool_input || {});
  if (!rel) return null;
  const cwd = payload.cwd || process.cwd();
  if (!exists(graphPath(cwd))) return null;
  const file = path.isAbsolute(rel) ? rel : path.join(cwd, rel);
  if (!isCodeFile(file) || !inside(cwd, file)) return null;
  let bytes = 0;
  try { const st = fs.statSync(file); if (!st.isFile()) return null; bytes = st.size; } catch { return null; }
  if (bytes < p.minBytes) return null;
  const sid = payload.session_id || 'no-session';
  const evs = eventsTail(sid);
  const slice = turnSlice(evs);
  if (!slice) return null;
  if (namedInPrompt(slice.promptText, file) || graphAsked(slice.turn) || touched(evs, file)) return null;
  const meta = sessionMeta(sid);
  const seen = meta.pointer || {};
  if (seen.promptId === slice.promptId) return null;
  if ((seen.spent || 0) >= p.perSession) return null;
  saveSessionMeta(sid, { ...meta, pointer: { promptId: slice.promptId, spent: (seen.spent || 0) + 1 } });
  const q = question(file, slice.promptText);
  return { file, bytes, question: q, text: reason(cwd, file, bytes, q) };
}

// PostToolUse. The read already happened, so this is the channel for a note the
// model should read, not a permission decision.
// The caller already read the config on its way here, so it hands it in rather
// than making every tool call pay for a second read of the same file.
export function postTool(payload, cfg = config()) {
  const n = consider(payload, cfg);
  return n ? contextOutput('PostToolUse', n.text) : null;
}
