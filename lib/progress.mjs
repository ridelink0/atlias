// The handoff note: written before compaction and at every reply end, read
// back at SessionStart and after compaction. It is the mechanism Anthropic's
// long-running-agent harness calls the progress file and NanoBot calls the
// consolidator checkpoint: objective, changed files, checks, blockers, next.
import path from 'node:path';
import { projectDir, eventsTail, TURN_TAIL, readText, writeText, gitStatusShort, clip } from './core.mjs';

export function notePath(cwd) { return path.join(projectDir(cwd), 'progress.md'); }
export function nextPath(cwd) { return path.join(projectDir(cwd), 'next.md'); }
export function read(cwd) { return readText(notePath(cwd)); }
export function setNext(cwd, text) { writeText(nextPath(cwd), String(text || '').trim() + '\n'); }

// Recording the next step must never cost the rest of the note. When a note
// already exists, only its Next section is rewritten; the files, checks and
// prompts in it were written by a session that knew them and this caller,
// which is usually a tool call with no session of its own, does not.
export function applyNext(cwd, text) {
  setNext(cwd, text);
  const existing = read(cwd);
  if (!existing) return null;
  const at = existing.indexOf('\n## Next\n');
  const head = at === -1 ? existing.replace(/\s*$/, '') : existing.slice(0, at);
  const updated = `${head}\n## Next\n${String(text || '').trim() || '(not set)'}\n`;
  writeText(notePath(cwd), updated);
  return updated;
}

export function build(cwd, sid, lastMessage) {
  const evs = eventsTail(sid, TURN_TAIL);
  const prompts = evs.filter((e) => e.kind === 'prompt').slice(-4).map((e) => `- ${clip(e.text, 140)}`);
  const all = [...new Set(evs.filter((e) => e.kind === 'edit').flatMap((e) => e.files || []))];
  const files = all.slice(-15);
  const checks = evs.filter((e) => e.kind === 'shell' && e.verify).slice(-5).map((e) => `- ${e.command}`);
  const blocks = evs.filter((e) => e.kind === 'deny' || e.kind === 'destructive').length;
  const git = gitStatusShort(cwd).trim().split(/\r?\n/).filter(Boolean).slice(0, 12).join('\n');
  const next = readText(nextPath(cwd));
  const out = [];
  out.push(`# atlias handoff for ${cwd}`);
  out.push(`\n## Objective (latest prompts)\n${prompts.length ? prompts.join('\n') : '- (none recorded this session)'}`);
  const more = all.length - files.length;
  out.push(`\n## Files changed this session\n${files.length ? files.map((f) => `- ${f}`).join('\n') + (more > 0 ? `\n- and ${more} more earlier in the session` : '') : '- none'}`);
  out.push(`\n## Checks run\n${checks.length ? checks.join('\n') : '- none recorded'}`);
  if (blocks) out.push(`\n## Guard events\n- ${blocks} call(s) were denied or turned into an ask this session; do not retry them unchanged.`);
  if (git) out.push(`\n## git status --short\n\`\`\`\n${git}\n\`\`\``);
  if (lastMessage) out.push(`\n## Last reply (clipped)\n${clip(String(lastMessage).trim(), 400)}`);
  out.push(`\n## Next\n${next ? next.trim() : '(not set; write it with harness_progress set when the plan changes)'}`);
  return out.join('\n') + '\n';
}

export function update(cwd, sid, lastMessage) {
  const text = build(cwd, sid, lastMessage);
  writeText(notePath(cwd), text);
  return text;
}

export function preCompact(payload) {
  const cwd = payload.cwd || process.cwd();
  const sid = payload.session_id || 'no-session';
  update(cwd, sid, null);
  return { hookSpecificOutput: { hookEventName: 'PreCompact', additionalContext: `atlias: keep in the summary the active objective, current status, results that constrain later work, unresolved blockers, the next action and every exact identifier it needs (paths, commands, ids). A handoff note was saved at ${notePath(cwd)} and is re-injected after compaction.` } };
}

export function postCompact(payload) {
  const cwd = payload.cwd || process.cwd();
  const note = read(cwd);
  if (!note) return null;
  return { hookSpecificOutput: { hookEventName: 'PostCompact', additionalContext: `[atlias handoff]\n${clip(note, 4000)}` } };
}
