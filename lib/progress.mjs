// The handoff note: written before compaction and at every reply end, read
// back at SessionStart and after compaction. It is the mechanism Anthropic's
// long-running-agent harness calls the progress file and NanoBot calls the
// consolidator checkpoint: objective, changed files, checks, blockers, next.
import path from 'node:path';
import { projectDir, events, readText, writeText, run, exists, clip } from './core.mjs';

export function notePath(cwd) { return path.join(projectDir(cwd), 'progress.md'); }
export function nextPath(cwd) { return path.join(projectDir(cwd), 'next.md'); }
export function read(cwd) { return readText(notePath(cwd)); }
export function setNext(cwd, text) { writeText(nextPath(cwd), String(text || '').trim() + '\n'); }

export function build(cwd, sid, lastMessage) {
  const evs = events(sid);
  const prompts = evs.filter((e) => e.kind === 'prompt').slice(-6).map((e) => `- ${e.text}`);
  const files = [...new Set(evs.filter((e) => e.kind === 'edit').flatMap((e) => e.files || []))].slice(-30);
  const checks = evs.filter((e) => e.kind === 'shell' && e.verify).slice(-5).map((e) => `- ${e.command}`);
  const blocks = evs.filter((e) => e.kind === 'deny' || e.kind === 'destructive').length;
  let git = '';
  if (exists(path.join(cwd, '.git'))) {
    const r = run('git', ['status', '--short'], { cwd, timeout: 3000 });
    if (r.status === 0) git = r.stdout.trim().split(/\r?\n/).filter(Boolean).slice(0, 20).join('\n');
  }
  const next = readText(nextPath(cwd));
  const out = [];
  out.push(`# atlias handoff for ${cwd}`);
  out.push(`\n## Objective (latest prompts)\n${prompts.length ? prompts.join('\n') : '- (none recorded this session)'}`);
  out.push(`\n## Files changed this session\n${files.length ? files.map((f) => `- ${f}`).join('\n') : '- none'}`);
  out.push(`\n## Checks run\n${checks.length ? checks.join('\n') : '- none recorded'}`);
  if (blocks) out.push(`\n## Guard events\n- ${blocks} call(s) were denied or turned into an ask this session; do not retry them unchanged.`);
  if (git) out.push(`\n## git status --short\n\`\`\`\n${git}\n\`\`\``);
  if (lastMessage) out.push(`\n## Last reply (clipped)\n${clip(String(lastMessage).trim(), 700)}`);
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
