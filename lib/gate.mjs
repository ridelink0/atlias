// Stop: the verification gate. It speaks only when a reply is about to end
// with unverified changes, at most once per reason per prompt, never when the
// host is already continuing because of a stop hook.
import fs from 'node:fs';
import path from 'node:path';
import { config, events, sessionMeta, saveSessionMeta, run, findPython, exists, isCodeFile, clip } from './core.mjs';
import * as progress from './progress.mjs';

export const PASS_RE = /(pass\s*2|second\s+pass|two\s+passes|bug[- ]?check(ed)?\s+twice|adversarial\s+(pass|re-?read|check|hunt))/i;

export function turnEvents(sid) {
  const evs = events(sid);
  let start = -1;
  for (let i = evs.length - 1; i >= 0; i--) if (evs[i].kind === 'prompt') { start = i; break; }
  return { promptId: start >= 0 ? evs[start].prompt_id : 'none', turn: evs.slice(start + 1) };
}

export function changedFiles(turn, cwd) {
  const out = new Set();
  for (const e of turn) if (e.kind === 'edit') for (const f of e.files || []) out.add(path.isAbsolute(f) ? f : path.join(cwd, f));
  return [...out];
}

export function syntaxCheck(files) {
  const failures = [];
  let py = null;
  for (const f of files) {
    if (!exists(f)) continue;
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
  return failures;
}

function block(reason) { return { decision: 'block', reason }; }

export function stop(payload) {
  const cfg = config();
  const sid = payload.session_id || 'no-session';
  const cwd = payload.cwd || process.cwd();
  const last = String(payload.last_assistant_message || '');
  const { promptId, turn } = turnEvents(sid);
  const files = changedFiles(turn, cwd);
  try { progress.update(cwd, sid, last); } catch { /* the note is a convenience */ }
  if (payload.stop_hook_active) return null;
  if (!files.length) return null;

  const meta = sessionMeta(sid);
  const flags = (meta.gate && meta.gate[promptId]) || {};
  const setFlag = (k) => saveSessionMeta(sid, { ...meta, gate: { ...(meta.gate || {}), [promptId]: { ...flags, [k]: true } } });

  if (cfg.verify.syntax && !flags.syntax) {
    const failures = syntaxCheck(files);
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
    return block(`atlias gate (second pass): ${code.length} file(s) changed this turn and the reply names only one bug-check.\nChanged: ${code.map((f) => path.relative(cwd, f) || f).join(', ')}\nChecks run so far: ${checks.length ? checks.join(' | ') : 'none recorded'}\nWhat is missing: the adversarial pass. Re-read each changed file asking where a bug would hide: empty or missing input, Windows paths and encodings, callers that assumed the old behaviour, off-by-one at boundaries, an error path that swallows the failure.\nFix: do that pass now, correct what it finds, run the smallest real check, then end with one line that names both passes and what each found. This gate asks once per prompt.`);
  }
  return null;
}
