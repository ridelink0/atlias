// PreToolUse: two guards, both silent unless they fire.
// 1. Loop guard: the same tool with the same input N times this session is a
//    loop (NanoBot issue 4522); deny once with a teaching reason.
// 2. Destructive guard: commands that cannot be undone are turned into an ask,
//    never a silent allow. Killing a Windows process by PID is in the list because
//    Windows shares one process across many windows.
import { config, recordEvent, eventsTail, sha, clip, filesFromTool, commandFromTool, isShellTool } from './core.mjs';

const EXEMPT = /^(TodoWrite|TodoRead|ListAgents|ReadNotifications|Monitor|AskUserQuestion)$/i;

export const DESTRUCTIVE = [
  { re: /\brm\s+-[a-zA-Z]*[rR][a-zA-Z]*\s+("?~\/?|\/|\$HOME|%USERPROFILE%|\*|\.\.|[A-Za-z]:[\\/]?)("|\s|$)/, why: 'recursive delete aimed at a root, home, parent or drive' },
  { re: /\bgit\s+(reset\s+--hard|push\b[^\n]*\s(--force|-f)\b|clean\s+-[a-zA-Z]*f|checkout\s+--\s+\.|branch\s+-D\b)/, why: 'git command that discards history or work' },
  { re: /\b(taskkill|Stop-Process|kill\s+-9|pkill|killall)\b/i, why: 'process kill; on Windows one process can own many windows, close the specific window instead' },
  { re: /\b(Remove-Item|rd|rmdir|del)\b[^\n]*(-Recurse|\/s)[^\n]*(\s[A-Za-z]:\\?(\s|$)|\\\*|~)/i, why: 'recursive delete aimed at a drive root or home' },
  { re: /\b(format\s+[a-zA-Z]:|mkfs\b|dd\s+if=|>\s*\/dev\/sd)/i, why: 'disk-level destruction' },
  { re: /\b(DROP\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE\s+TABLE)\b/i, why: 'irreversible database statement' },
  { re: /\b(npm\s+publish|gh\s+repo\s+delete|netlify\s+sites:delete)\b/, why: 'outward-facing publish or delete' },
];

export function destructiveReason(cmd) {
  if (!cmd) return null;
  for (const d of DESTRUCTIVE) if (d.re.test(cmd)) return d.why;
  return null;
}

export function preTool(payload) {
  const cfg = config();
  const sid = payload.session_id || 'no-session';
  const tool = String(payload.tool_name || '');
  const input = payload.tool_input || {};
  const key = sha(`${tool}\n${JSON.stringify(input)}`);
  const files = filesFromTool(tool, input);
  const command = commandFromTool(tool, input);
  recordEvent(sid, { kind: 'tool', tool, key, files, command: command ? clip(command, 300) : undefined });

  if (!EXEMPT.test(tool)) {
    const evs = eventsTail(sid);
    let lastDeny = -1;
    for (let i = evs.length - 1; i >= 0; i--) if (evs[i].kind === 'deny' && evs[i].key === key) { lastDeny = i; break; }
    const recent = evs.slice(Math.max(lastDeny + 1, evs.length - cfg.guard.loopWindow)).filter((e) => e.kind === 'tool');
    const same = recent.filter((e) => e.key === key).length;
    if (same >= cfg.guard.loopThreshold) {
      recordEvent(sid, { kind: 'deny', key, tool });
      const reason = `atlias guard: ${tool} has now been called ${same} times this session with exactly the same input${command ? ` (${clip(command, 120)})` : files.length ? ` (${files.join(', ')})` : ''}.\nWhat went wrong: an identical call returns an identical result, so this is a loop, and every pass spends tokens on nothing new.\nFix: read the last result of this call, then either change the input, take a different route to the same fact, or tell the user plainly what cannot be done and why. This one denial resets the counter.`;
      return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } };
    }
  }

  if (cfg.guard.destructive && isShellTool(tool)) {
    const why = destructiveReason(command);
    if (why) {
      recordEvent(sid, { kind: 'destructive', key, tool });
      return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: `atlias guard: ${why}. Confirm with the user before running: ${clip(command, 200)}` } };
    }
  }
  return null;
}
