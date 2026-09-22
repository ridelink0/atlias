// PostToolUse and SubagentStop: record what changed, never speak.
import { config, recordEvent, filesFromTool, commandFromTool, isEditTool, isShellTool, looksLikeVerification, isCodeFile, clip, exists, graphPath } from './core.mjs';
import * as graph from './graph.mjs';

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
    if (command) recordEvent(sid, { kind: 'shell', command: clip(command, 300), verify: looksLikeVerification(command) });
  }
  return null;
}

export function subagentStop(payload) {
  const sid = payload.session_id || 'no-session';
  recordEvent(sid, { kind: 'subagent', agent: payload.agent_type || payload.agent_id || 'unknown', summary: clip(payload.last_assistant_message || '', 200) });
  return null;
}
