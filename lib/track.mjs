// PostToolUse and SubagentStop: record what changed, and speak for one reason
// only - a whole file was read that the knowledge graph could have answered
// (lib/pointer.mjs, which is silent unless every one of its conditions holds).
import { config, recordEvent, filesFromTool, commandFromTool, isEditTool, isShellTool, looksLikeVerification, isCodeFile, clip, exists, graphPath } from './core.mjs';
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
export function isCheck(command, sid) {
  if (looksLikeVerification(command)) return true;
  // The event log is read only for a command that runs an interpreter at all.
  return RUNNER.test(String(command || '')) && runsEditedFile(command, editedThisTurn(sid));
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

export function subagentStop(payload) {
  const sid = payload.session_id || 'no-session';
  recordEvent(sid, { kind: 'subagent', agent: payload.agent_type || payload.agent_id || 'unknown', summary: clip(payload.last_assistant_message || '', 200) });
  return null;
}
