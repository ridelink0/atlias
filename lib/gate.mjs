// Stop: the verification gate. It speaks only when a reply is about to end
// with unverified changes, at most once per reason per prompt, never when the
// host is already continuing because of a stop hook.
import fs from 'node:fs';
import path from 'node:path';
import { config, events, eventsTail, TURN_TAIL, sessionMeta, saveSessionMeta, run, gitStatusShort, findPython, exists, isCodeFile, clip } from './core.mjs';
import * as progress from './progress.mjs';

export const PASS_RE = /(pass\s*2|second\s+pass|two\s+passes|bug[- ]?check(ed)?\s+twice|adversarial\s+(pass|re-?read|check|hunt))/i;

function lastPrompt(evs) {
  for (let i = evs.length - 1; i >= 0; i--) if (evs[i].kind === 'prompt') return i;
  return -1;
}
export function turnEvents(sid) {
  let evs = eventsTail(sid, TURN_TAIL);
  let start = lastPrompt(evs);
  // A turn with thousands of tool calls pushes its own prompt marker out of the
  // tail. Treating the whole window as this turn would drag in files from
  // earlier turns and collapse every per-prompt flag onto one key, so pay for
  // the full read in the rare case that needs it.
  if (start === -1) {
    const all = events(sid);
    const found = lastPrompt(all);
    if (found !== -1) { evs = all; start = found; }
  }
  return { promptId: start >= 0 ? evs[start].prompt_id : 'none', turn: evs.slice(start + 1), truncated: start === -1 };
}

// git status --short, in the shapes it actually comes back in:
//   ' M lib/x.mjs'   modified
//   '?? new.mjs'     untracked
//   'A  added.mjs'   staged add
//   'R  old -> new'  rename, where only the new path still exists
//   ' M "with space.mjs"'  quoted when the path needs it
export function parseGitStatus(text) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    if (line.length < 4) continue;
    const status = line.slice(0, 2);
    if (status === '!!') continue; // ignored
    let rest = line.slice(3).trim();
    const arrow = rest.indexOf(' -> ');
    if (arrow !== -1) rest = rest.slice(arrow + 4);
    if (status[0] === 'D' || status[1] === 'D') continue; // deleted: nothing to parse
    if (rest.startsWith('"') && rest.endsWith('"')) rest = rest.slice(1, -1);
    if (rest) out.push(rest);
  }
  return out;
}

// What changed on disk that the harness never saw a tool touch. Bounded by
// the start of this turn so a dirty working tree from yesterday is not
// dragged into today's review.
export function shellChangedFiles(cwd, since, deps = {}) {
  const stat = deps.mtime || ((f) => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } });
  const status = deps.run ? (deps.run('git', ['status', '--short'], { cwd, timeout: 3000 }).stdout || '') : gitStatusShort(cwd);
  if (!status) return [];
  const out = [];
  for (const rel of parseGitStatus(status)) {
    const full = path.isAbsolute(rel) ? rel : path.join(cwd, rel);
    if (!isCodeFile(full)) continue;
    if (stat(full) >= since) out.push(full);
  }
  return out;
}

export function changedFiles(turn, cwd) {
  const out = new Set();
  for (const e of turn) if (e.kind === 'edit') for (const f of e.files || []) out.add(path.isAbsolute(f) ? f : path.join(cwd, f));
  return [...out];
}

// What atlias can parse by itself, and what it cannot. Anything not in the
// first list is reported as unchecked rather than quietly passed.
export const PARSEABLE = new Set(['.js', '.mjs', '.cjs', '.json', '.py']);
export function syntaxReport(files) {
  const r = syntaxCheckDetailed(files);
  return r;
}
export function syntaxCheck(files) { return syntaxCheckDetailed(files).failures; }
export function syntaxCheckDetailed(files) {
  const failures = [];
  const checked = [];
  const skipped = [];
  const missing = [];
  let py = null;
  for (const f of files) {
    if (!exists(f)) { missing.push(f); continue; }
    if (!PARSEABLE.has(path.extname(f).toLowerCase())) { skipped.push(f); continue; }
    checked.push(f);
    const ext = path.extname(f).toLowerCase();
    if (['.js', '.mjs', '.cjs'].includes(ext)) {
      const r = run(process.execPath, ['--check', f], { timeout: 10000 });
      if (r.status !== 0) failures.push({ file: f, error: clip((r.stderr || r.error || '').trim(), 400) });
    } else if (ext === '.json') {
      try { JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch (e) { failures.push({ file: f, error: e.message }); }
    } else if (ext === '.py') {
      py = py || findPython() || (process.platform === 'win32' ? 'python' : 'python3');
      const r = run(py, ['-m', 'py_compile', f], { timeout: 15000 });
      if (r.status !== 0 && !r.error) failures.push({ file: f, error: clip((r.stderr || '').trim(), 400) });
    }
  }
  return { failures, checked, skipped, missing };
}

function block(reason) { return { decision: 'block', reason }; }

export function stop(payload) {
  const cfg = config();
  const sid = payload.session_id || 'no-session';
  const cwd = payload.cwd || process.cwd();
  const last = String(payload.last_assistant_message || '');
  const { promptId, turn } = turnEvents(sid);
  const known = changedFiles(turn, cwd);
  // Edits made through the shell never produce an edit event, so ask git.
  const turnStart = turn.length ? (turn[0].t || 0) : 0;
  const unseen = turnStart ? shellChangedFiles(cwd, turnStart).filter((f) => !known.includes(f)) : [];
  const files = known.concat(unseen);
  // A turn that changed nothing has nothing to hand off, and rewriting the note
  // with an empty one would throw away the last turn that did.
  const worthNoting = files.length || turn.some((e) => e.kind === 'shell' || e.kind === 'deny' || e.kind === 'destructive');
  if (worthNoting) { try { progress.update(cwd, sid, last); } catch { /* the note is a convenience */ } }
  if (payload.stop_hook_active) return null;
  if (!files.length) return null;

  const meta = sessionMeta(sid);
  const flags = (meta.gate && meta.gate[promptId]) || {};
  const setFlag = (k) => saveSessionMeta(sid, { ...meta, gate: { ...(meta.gate || {}), [promptId]: { ...flags, [k]: true } } });

  // One report serves both checks below, so nothing is parsed twice, and it
  // is never built at all when the user has turned both checks off.
  const wanted = cfg.verify.syntax || cfg.verify.doublePass;
  const rep = wanted ? syntaxCheckDetailed(files) : { failures: [], checked: [], skipped: [], missing: [] };
  if (cfg.verify.syntax && !flags.syntax) {
    const failures = rep.failures;
    if (failures.length) {
      setFlag('syntax');
      const list = failures.map((f) => `- ${f.file}\n  ${f.error.replace(/\n/g, '\n  ')}`).join('\n');
      return block(`atlias gate (syntax): the reply was about to end with files that do not parse.\n${list}\nWhat went wrong: a change was declared finished without the cheapest possible check.\nWhy it matters: a syntax error fails every caller at once, and the user finds it instead of you.\nFix: repair each file above, re-run the check (node --check, JSON.parse, py_compile), then finish.`);
    }
  }

  const code = files.filter(isCodeFile);
  if (cfg.verify.doublePass && !flags.double && code.length && !PASS_RE.test(last)) {
    setFlag('double');
    const checks = turn.filter((e) => e.kind === 'shell' && e.verify).map((e) => e.command);
    const viaShell = unseen.length ? `\nChanged without an edit tool, found by git: ${unseen.map((f) => path.relative(cwd, f) || f).join(', ')}. These are the ones nobody reviewed.` : '';
    const floor = rep.checked.length ? '' : `\nNote: atlias could not syntax-check any of these files; it parses JavaScript, JSON and Python only. The project's own check is the only floor here, so run it rather than assuming one ran.`;
    return block(`atlias gate (second pass): ${code.length} file(s) changed this turn and the reply names only one bug-check.\nChanged: ${code.map((f) => path.relative(cwd, f) || f).join(', ')}\nChecks run so far: ${checks.length ? checks.join(' | ') : 'none recorded'}\nWhat is missing: the adversarial pass. Re-read each changed file asking where a bug would hide: empty or missing input, Windows paths and encodings, callers that assumed the old behaviour, off-by-one at boundaries, an error path that swallows the failure.${viaShell}${floor}\nFix: do that pass now, correct what it finds, run the smallest real check, then end with one line that names both passes and what each found. This gate asks once per prompt.`);
  }
  return null;
}
