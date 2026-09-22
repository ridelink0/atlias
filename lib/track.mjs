// PostToolUse and SubagentStop: record what changed, never speak.
import { config, recordEvent, filesFromTool, commandFromTool, isEditTool, isShellTool, looksLikeVerification, isCodeFile, clip, exists, graphPath } from './core.mjs';
import * as graph from './graph.mjs';
import * as integrity from './integrity.mjs';

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
      const verify = looksLikeVerification(command);
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
  return null;
}

// PostToolUseFailure: the tool call itself failed. For a check, that is a
// failed check, and it is recorded as one.
export function postToolFailure(payload) {
  const sid = payload.session_id || 'no-session';
  const tool = String(payload.tool_name || '');
  if (!isShellTool(tool)) return null;
  const command = commandFromTool(tool, payload.tool_input || {});
  if (!command) return null;
  recordEvent(sid, { kind: 'shell', command: clip(command, 300), verify: looksLikeVerification(command), outcome: 'fail', excerpt: clip(String(payload.error || payload.tool_error || 'the tool reported a failure'), 200) });
  return null;
}

export function subagentStop(payload) {
  const sid = payload.session_id || 'no-session';
  recordEvent(sid, { kind: 'subagent', agent: payload.agent_type || payload.agent_id || 'unknown', summary: clip(payload.last_assistant_message || '', 200) });
  return null;
}
