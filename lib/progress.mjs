// The handoff note: written before compaction and at every reply end, read
// back at SessionStart and after compaction. It is the mechanism Anthropic's
// long-running-agent harness calls the progress file and NanoBot calls the
// consolidator checkpoint: objective, changed files, checks, blockers, next.
import fs from 'node:fs';
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
  const checks = evs.filter((e) => e.kind === 'shell' && e.verify).slice(-5).map((e) => `- ${e.command} (recorded outcome: ${['pass','fail','unknown'].includes(e.outcome) ? e.outcome : 'unknown'})`);
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

// The summary Claude Code wrote at the last compaction, read from the session
// transcript: a compact_boundary system entry, then a user message marked
// isCompactSummary holding the summary text (seen in this machine's own
// transcripts). The hooks documentation gives PostCompact no summary field and
// no say in the result, so this is the channel that can be checked: at
// SessionStart with source "compact", which receives transcript_path. Only the
// end of the file is read; a transcript can run to hundreds of megabytes.
export function compactSummary(transcriptPath, tailBytes = 4 * 1024 * 1024) {
  let text = '';
  try {
    const fd = fs.openSync(transcriptPath, 'r');
    try {
      const size = fs.fstatSync(fd).size;
      const len = Math.min(size, tailBytes);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, size - len);
      text = buf.toString('utf8');
    } finally { fs.closeSync(fd); }
  } catch { return ''; }
  const lines = text.split('\n').filter((l) => l.includes('"isCompactSummary":true'));
  for (let i = lines.length - 1; i >= 0; i--) {
    let row = null;
    try { row = JSON.parse(lines[i]); } catch { continue; }
    const c = row && row.message ? row.message.content : null;
    const s = typeof c === 'string' ? c : Array.isArray(c) ? c.map((p) => (p && typeof p.text === 'string' ? p.text : '')).join('\n') : '';
    if (s.trim()) return s;
  }
  return '';
}

// Text references only, never a semantic validation of a generated summary.
// Recover the original next action unless its complete normalized text occurs;
// word overlap cannot preserve numbers, negations, identifiers or permissions.
export function auditSummary(note, summary) {
  const hay = String(summary || '').toLowerCase().replace(/\\/g, '/');
  const section = (name) => { const m = String(note || '').match(new RegExp(`(?:^|\\r?\\n)## ${name}\\r?\\n([\\s\\S]*?)(?=\\r?\\n## |$)`)); return m ? m[1] : ''; };
  const items = (name) => section(name).split('\n').map((l) => l.replace(/^- /, '').trim()).filter((l) => l && !/^\(|^none|^and \d+ more/.test(l));
  const missing = [];
  let checked = 0;
  for (const f of items('Files changed this session')) {
    checked++;
    const p = f.toLowerCase().replace(/\\/g, '/');
    if (!hay.includes(p) && !hay.includes(path.basename(p))) missing.push(`file changed: ${f}`);
  }
  for (const c of items('Checks run')) {
    checked++;
    if (!hay.includes(c.toLowerCase().replace(/\\/g, '/').slice(0, 30))) missing.push(`check run: ${c}`);
  }
  const next = section('Next').trim();
  if (next && !/^\(not set/.test(next)) {
    checked++;
    const normalize = s => String(s).replace(/\s+/g, ' ').trim();
    if (!normalize(String(summary || '')).includes(normalize(next))) missing.push(`next step: ${next}`);
  }
  return { checked, missing, method: 'text-presence-only', semanticStatus: 'unverified' };
}

// Preserve complete critical sections before bulk file/status metadata. When
// any material is omitted, retain the exact path to the authoritative note.
// A pointer cannot validate meaning; the host must read it before relying on
// missing state. Short notes remain byte-for-byte unchanged.
export function recoveryText(cwd, note, budget) {
  if (typeof note !== 'string') throw new TypeError('text handoff note required');
  // Existing settings accept any finite number, including fractions and zero.
  // Malformed hand-edited settings must not crash the entire startup hook.
  const numeric=typeof budget==='number'||typeof budget==='string'?Number(budget):NaN;
  const limit=Number.isFinite(numeric)?Math.max(0,Math.floor(numeric)):0;
  if (note.length <= limit) return note;
  const pointer=`Handoff excerpt is incomplete. Read the original state at ${notePath(cwd)} before resuming; do not infer missing check outcomes.\n`;
  const sections=[...note.matchAll(/(?:^|\r?\n)## ([^\r\n]+)\r?\n([\s\S]*?)(?=\r?\n## |$)/g)];
  const priorities=['Next','Checks run','Objective (latest prompts)'];
  let result=pointer;
  for (const name of priorities) {
    const found=sections.find(s=>s[1]===name);if(!found)continue;
    const block=`\n## ${name}\n${found[2].trim()}\n`;
    if(result.length+block.length<=limit)result+=block;
  }
  // The full path is irreducible: at exceptionally tiny budgets the pointer
  // itself exceeds the requested soft budget, rather than truncating its id.
  return result;
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
  return { hookSpecificOutput: { hookEventName: 'PostCompact', additionalContext: `[atlias handoff]\n${recoveryText(cwd, note, 4000)}` } };
}
