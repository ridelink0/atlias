// PostToolUse and SubagentStop: record what changed, and speak for one reason
// only - a whole file was read that the knowledge graph could have answered
// (lib/pointer.mjs, which is silent unless every one of its conditions holds).
import path from 'node:path';
import { config, recordEvent, filesFromTool, commandFromTool, isEditTool, isShellTool, looksLikeVerification, isCodeFile, clip, exists, graphPath, readTail } from './core.mjs';
import * as graph from './graph.mjs';
import * as integrity from './integrity.mjs';
import * as pointer from './pointer.mjs';
import { turnEvents } from './gate.mjs';

// Running a program this turn edited is checking it, the rule atlias's own loop
// has used since 3.x (lib/loop.mjs); printing it is not. The hooks did not
// have it, so in Claude Code `python -c "from main import f; print(f(3))"`
// after an edit to main.py counted as no check, and the gate held a reply that
// had checked its work. The file must be named as a file (main.py, app.js) or
// imported as a module (from main import, import main, require('./main')).
export const RUNNER = /(?:^|[\s;&|(\\/"'])(?:node|python[\d.]*|py|deno|bun|tsx|ts-node|ruby|perl|php|bash|sh|pwsh|powershell)(?:\.exe)?["']?\s/i;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function runsEditedFile(command, edited) {
  const cmd = String(command || '');
  if (!RUNNER.test(cmd)) return false;
  for (const f of edited || []) {
    // Split on both separators: a hook on Linux can carry a Windows path, and
    // path.basename there would keep the whole of it.
    const base = String(f).split(/[\\/]/).pop() || '';
    const stem = base.replace(/\.[^.]+$/, '');
    if (!stem) continue;
    if (new RegExp(`(^|[\\s"'\\\\/=(])${escapeRe(base)}($|[\\s"');&|])`).test(cmd)) return true;
    if (new RegExp(`\\b(from\\s+${escapeRe(stem)}\\s+import|import\\s+${escapeRe(stem)}\\b|require\\(\\s*["'][./\\\\]*${escapeRe(stem)}(\\.[a-z]+)?["']\\s*\\))`).test(cmd)) return true;
  }
  return false;
}
function editedThisTurn(sid) {
  const out = [];
  for (const e of turnEvents(sid).turn) if (e.kind === 'edit') out.push(...(e.files || []));
  return out;
}
// `edited`, when given, is the turn's edited files as the caller knows them
// (the transcript recovery below); otherwise the event log is asked.
export function isCheck(command, sid, edited = null) {
  if (looksLikeVerification(command)) return true;
  // The event log is read only for a command that runs an interpreter at all.
  return RUNNER.test(String(command || '')) && runsEditedFile(command, edited || editedThisTurn(sid));
}

export function postTool(payload) {
  const cfg = config();
  const sid = payload.session_id || 'no-session';
  const cwd = payload.cwd || process.cwd();
  const tool = String(payload.tool_name || '');
  const input = payload.tool_input || {};
  if (isEditTool(tool)) {
    const files = filesFromTool(tool, input);
    if (files.length) {
      recordEvent(sid, { kind: 'edit', tool, files });
      if (cfg.graph.autoUpdate && files.some(isCodeFile) && exists(graphPath(cwd))) graph.scheduleUpdate(cwd);
    }
    return null;
  }
  if (isShellTool(tool)) {
    const command = commandFromTool(tool, input);
    if (command) {
      const verify = isCheck(command, sid);
      const ev = { kind: 'shell', command: clip(command, 300), verify };
      // A check is only evidence if we know how it came out, so the gate can
      // hold "the tests pass" against the run that said otherwise.
      if (verify) {
        const v = integrity.verdict(payload);
        ev.outcome = v.outcome;
        if (v.excerpt) ev.excerpt = clip(v.excerpt, 200);
      }
      recordEvent(sid, ev);
    }
  }
  // The one thing PostToolUse ever says: a whole file was read that the graph
  // could have answered. Silent unless every condition in pointer.consider
  // holds, so the common path still costs one regex and a stat.
  return pointer.postTool(payload, cfg);
}

// PostToolUseFailure: the tool call itself failed. For a check, that is a
// failed check, and it is recorded as one.
export function postToolFailure(payload) {
  const sid = payload.session_id || 'no-session';
  const tool = String(payload.tool_name || '');
  if (!isShellTool(tool)) return null;
  const command = commandFromTool(tool, payload.tool_input || {});
  if (!command) return null;
  recordEvent(sid, { kind: 'shell', command: clip(command, 300), verify: isCheck(command, sid), outcome: 'fail', excerpt: clip(String(payload.error || payload.tool_error || 'the tool reported a failure'), 200) });
  return null;
}

// ---------- checks the transcript saw and the log did not ----------
// Under the load of the 2026-09-28 study Claude Code cancelled 80 atlias hook
// calls in 22 of 34 runs. A cancelled PostToolUse leaves a check that ran with
// no record, so the gate said "no check ran" and held a reply that had checked
// its work, one more full-context round. Claude Code hands Stop the session
// transcript, JSONL like the one progress.compactSummary reads: an assistant
// row holds tool_use blocks, a later user row the tool_result for each, with
// is_error set and "Exit code N" leading the content when a command failed
// (seen in this machine's transcripts). Only the tail is read, and a tail that
// does not read cleanly is no answer at all: a half-written last line could be
// the edit that came after the check.
export const TRANSCRIPT_TAIL = 2 * 1024 * 1024;
export function transcriptTurn(transcriptPath, bytes = TRANSCRIPT_TAIL, host = 'claude', sid = null, expectedTurn = null) {
  if (!transcriptPath) return null;
  const text = readTail(transcriptPath, bytes);
  if (!text) return null;
  if (host === 'codex') return codexTranscriptCalls(text, sid, expectedTurn);
  if (host !== 'claude') return null;
  let calls = [];
  let seen = false;
  const results = new Map();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let row;
    try { row = JSON.parse(line); } catch { return null; }
    if (!row || typeof row !== 'object' || row.isSidechain) continue;
    const content = row.message && row.message.content;
    if (row.type === 'assistant' && Array.isArray(content)) {
      seen = true;
      for (const b of content) if (b && b.type === 'tool_use') calls.push(b);
    } else if (row.type === 'user' && content != null) {
      seen = true;
      const blocks = Array.isArray(content) ? content : [];
      const answered = blocks.filter((b) => b && b.type === 'tool_result');
      for (const b of answered) results.set(b.tool_use_id, { block: b, row });
      // A prompt starts the turn over; tool results and meta rows do not.
      if (!answered.length && !row.isMeta && !row.isCompactSummary) { calls = []; results.clear(); }
    }
  }
  if (!seen) return null;
  return calls.map((c) => ({ name: String(c.name || ''), input: c.input || {}, result: results.get(c.id) || null }));
}

// Native Codex drops the process exit status from PostToolUse's stdout, but
// keeps trusted CommandExecution completion metadata in its rollout. Read only
// those host events in the current session/turn; never parse program-printed or
// custom-code-mode text as a claimed exit status.
function codexTranscriptCalls(text, sid, expectedTurn) {
  let rows;
  try { rows = text.split('\n').filter(line => line.trim()).map(JSON.parse); } catch { return null; }
  if (rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) return null;
  const metas = rows.filter(row => row.type === 'session_meta');
  if (metas.length !== 1 || (sid && metas[0].payload?.id !== sid)) return null;
  let turn = null, startMs = null, calls = [];
  const ids = new Set();
  let lastStart = -1;
  for (let i = 0; i < rows.length; i++) if (rows[i].type === 'event_msg' && rows[i].payload?.type === 'task_started') lastStart = i;
  if (lastStart < 0) return null;
  for (const row of rows.slice(lastStart)) {
    const payload = row.payload;
    if (row.type !== 'event_msg' || !payload) continue;
    if (payload.type === 'task_started' && typeof payload.turn_id === 'string') {
      turn = payload.turn_id;
      startMs = Date.parse(row.timestamp);
      if (!Number.isFinite(startMs)) return null;
      calls = [];
      ids.clear();
      continue;
    }
    const item = payload.item;
    if (payload.type !== 'item_completed') continue;
    if (!['FileChange', 'CommandExecution'].includes(item?.type)) continue;
    if (!turn || payload.turn_id !== turn || (sid && payload.thread_id !== sid) || typeof item.id !== 'string' || ids.has(item.id)) return null;
    ids.add(item.id);
    if (!['completed', 'failed'].includes(item.status) || !Number.isFinite(payload.completed_at_ms) || payload.completed_at_ms < startMs || !Number.isFinite(Date.parse(row.timestamp))) return null;
    const completion = { ...row, timestamp: new Date(payload.completed_at_ms).toISOString() };
    if (item.type === 'FileChange') {
      // These completed add/update shapes are observed in the native client.
      // Unknown, failed, renamed or empty changes stay fail-closed.
      const changes = item.changes;
      if (item.status !== 'completed' || !changes || typeof changes !== 'object' || Array.isArray(changes)) return null;
      const entries = Object.entries(changes);
      if (!entries.length || entries.some(([file, change]) => !file.trim() || !change || !['add', 'update'].includes(change.type) || change.move_path != null)) return null;
      calls.push({ name: 'apply_patch', input: { edits: entries.map(([file]) => ({ file_path: file })) }, result: { codex: true, row: completion } });
      continue;
    }
    const argv = item.command;
    if (!Array.isArray(argv) || argv.some(value => typeof value !== 'string')) return null;
    const index = argv.findIndex(value => ['-Command', '-c', '-lc'].includes(value));
    if (index < 1 || index !== argv.length - 2) return null;
    calls.push({ name: 'exec_command', input: { cmd: argv[index + 1] }, result: { codex: true, row: completion } });
  }
  return turn && (!expectedTurn || turn === expectedTurn) ? calls : null;
}

// How a transcript tool result came out, by the rules the hooks use: a failed
// call is a failed check (postToolFailure), anything else goes to verdict.
export function transcriptVerdict(result) {
  if (result?.codex) {
    const item=result.row?.payload?.item;
    if(!item||!Number.isInteger(item.exit_code))return {outcome:'unknown'};
    if(item.status==='failed'&&item.exit_code===0)return {outcome:'unknown'};
    return integrity.verdict({tool_response:{stdout:item.stdout,stderr:item.stderr,exit_code:item.exit_code}});
  }
  const b = result.block;
  const text = typeof b.content === 'string' ? b.content : Array.isArray(b.content) ? b.content.map((p) => (p && typeof p.text === 'string' ? p.text : '')).join('\n') : '';
  if (b.is_error) {
    const m = text.match(/^Exit code (\d+)/);
    if (m) return integrity.verdict({ tool_response: { stdout: text.slice(m[0].length), exit_code: Number(m[1]) } });
    return { outcome: 'fail', excerpt: clip(text.trim() || 'the tool reported a failure', 200) };
  }
  const r = result.row.toolUseResult;
  return integrity.verdict({ tool_response: r && typeof r === 'object' ? r : text });
}

const samePath = (cwd) => (f) => path.resolve(cwd, String(f)).replace(/\\/g, '/').toLowerCase();

// The checks after the turn's last edit that the transcript shows, as shell
// events shaped like the ones postTool records. Empty unless the transcript
// holds every edit the log has for this turn, so it cannot miss the edit that
// came after its check. And the log's order has the last word: a check counts
// only if its result is stamped after the last edit the log recorded. A
// subagent's edit reaches the log through its own hook but not this transcript
// (Claude Code writes a subagent's transcript to a file of its own), and a row
// with no time cannot be placed.
export function checksFromTranscript(transcriptPath, { cwd, sid, turn, host = 'claude', nativeTurn = null }) {
  const calls = transcriptTurn(transcriptPath, TRANSCRIPT_TAIL, host, sid, nativeTurn);
  if (!calls) return [];
  const norm = samePath(cwd);
  const recorded = [];
  let since = 0;
  for (const e of turn) if (e.kind === 'edit') { recorded.push(...(e.files || [])); if (e.t > since) since = e.t; }
  const edited = [];
  let lastEdit = -1;
  calls.forEach((c, i) => { if (isEditTool(c.name)) { lastEdit = i; edited.push(...filesFromTool(c.name, c.input)); } });
  const known = new Set(edited.map(norm));
  if (!recorded.every((f) => known.has(norm(f)))) return [];
  const out = [];
  for (const c of calls.slice(lastEdit + 1)) {
    if (!isShellTool(c.name) || !c.result) continue;
    if (since && !(Date.parse(c.result.row.timestamp) > since)) continue;
    const command = commandFromTool(c.name, c.input);
    if (!command || !isCheck(command, sid, recorded.concat(edited))) continue;
    const v = transcriptVerdict(c.result);
    const ev = { kind: 'shell', command: clip(command, 300), verify: true, outcome: v.outcome, from: 'transcript' };
    if (v.excerpt) ev.excerpt = clip(v.excerpt, 200);
    out.push(ev);
  }
  return out;
}

// Records what checksFromTranscript found and adds it to the turn in hand, so
// the gate and everything after it read it as a recorded check.
export function recoverChecks(payload, turn, host = 'claude') {
  const sid = payload.session_id || 'no-session';
  const found = checksFromTranscript(payload.transcript_path, { cwd: payload.cwd || process.cwd(), sid, turn, host, nativeTurn: payload.turn_id });
  for (const ev of found) {
    recordEvent(sid, ev);
    turn.push({ t: Date.now(), ...ev });
  }
  return found;
}

export function subagentStop(payload) {
  const sid = payload.session_id || 'no-session';
  recordEvent(sid, { kind: 'subagent', agent: payload.agent_type || payload.agent_id || 'unknown', summary: clip(payload.last_assistant_message || '', 200) });
  return null;
}
