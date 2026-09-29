import { sameFlags } from './core.mjs';
// The council, Stage A (docs/research/Atlias councils and UFS packs.md, build
// item 1). No debate and no votes: when the project's own check still fails,
// up to two fresh attempts run one after another and the first that the check
// passes, without touching the check, is kept. That is best-of-N with the
// repository's tests as the filter.
//
// Stage A is the model-free half: the selector, the sequential runner (it takes
// its model call as a function, so it is provider-agnostic and tested with
// scripted ones), and replay(), which simulates the council over eval reports
// that are already saved. atlias eval does not call any of this yet; that hook
// changes lib/eval.mjs, which is in STAMP_FILES, and waits for replay to show
// at least FLOOR one-way flips (Stage B).

// Round five's noise floor (docs/NEXTGEN-5.md:39): fewer flips than this is noise.
export const FLOOR = 6;

// Convene only when the flag is on and a visible check ran and FAILED. An
// 'unfinished' check (timeout, could not start) gives no selection signal, and
// with no check there is nothing to select with: either would be a vote.
export function shouldConvene({ flagOn, check, checkResult } = {}) {
  return Boolean(flagOn) && Boolean(check) && Boolean(checkResult) && checkResult.ran !== false && !checkResult.timedOut && (checkResult.outcome === 'fail' || checkResult.pass === false);
}

// The first candidate whose visible check passed and that did not tamper with
// the check, in index order; null when there is none.
export function pick(candidates) {
  return (candidates || []).find((c) => c && c.visiblePass === true && !c.tampered) || null;
}

const passed = (r) => r === true || Boolean(r && (r.outcome === 'pass' || r.pass === true));

// Run up to `count` fresh candidates in order, never in parallel (one local
// model slot; stopping at the first pass only saves anything when sequential).
//   makeDir(i)          a fresh workspace for candidate i
//   run(dir, i)         does the work there; may return {chars, promptTotal, outputTotal}
//   check(dir, i)       the visible check: {outcome:'pass'} or true when it passes
//   tampered(dir, i)    optional: true when the candidate touched the check or tests
//   dispose(dir, i)     optional: removes a workspace that did not win
// Candidates are numbered from `first` (default 1), because the original
// attempt is candidate 0. Returns {ran, chosen, winnerDir, candidates}; the
// winner's workspace is not disposed.
export async function runCandidates({ count = 2, first = 1, makeDir, run, check, tampered, dispose } = {}) {
  const candidates = [];
  let winner = null;
  for (let n = 0; n < count; n++) {
    const i = first + n;
    const dir = await makeDir(i);
    let out = {}, error = null, visiblePass = false, tam = false;
    try {
      out = (await run(dir, i)) || {};
      visiblePass = passed(await check(dir, i));
      tam = tampered ? Boolean(await tampered(dir, i)) : false;
    } catch (e) { error = String((e && e.message) || e); visiblePass = false; }
    const c = { i, visiblePass, tampered: tam, chars: Number(out.chars) || 0, promptTotal: Number(out.promptTotal) || 0, outputTotal: Number(out.outputTotal) || 0 };
    if (error) c.error = error;
    Object.defineProperty(c, 'dir', { value: dir, enumerable: false });
    candidates.push(c);
    if (pick([c])) { winner = c; break; }
  }
  if (dispose) for (const c of candidates) if (c !== winner) { try { await dispose(c.dir, c.i); } catch { /* a leftover workspace must not fail the run */ } }
  return { ran: candidates.length, chosen: winner ? winner.i : null, winnerDir: winner ? winner.dir : null, candidates };
}

// What replay reads of one attempt: what it cost in the engine's prompt tokens.
const cost = (a) => (typeof a.promptTotal === 'number' && Number.isFinite(a.promptTotal) && a.promptTotal >= 0 ? a.promptTotal : null);


// A replay resamples one arm and one build; combining different builds is an A/B.
export function attemptsByTask(reports) {
  const reps = reports.filter(Boolean);
  if (!reps.length) return { error: 'no report to replay' };
  const arm = r => [r.engine || '', r.model || '', r.direct ? 'direct' : 'loop'].join(' / ');
  const stamp = r => JSON.stringify(r.stamp || null);
  for (const r of reps.slice(1)) {
    if (arm(r) !== arm(reps[0])) return { error: 'these reports are two arms; replay one arm\'s runs' };
    if (stamp(r) !== stamp(reps[0])) return { error: 'these reports are two builds; replay one build\'s runs' };
    if (Boolean(r.flags) !== Boolean(reps[0].flags) || (r.flags && !sameFlags(r.flags, reps[0].flags))) return { error: 'these reports ran with different flags; replay one arm\'s runs' };
  }
  const maps = [];
  for (const rep of reps) {
    const map = new Map();
    for (const row of Array.isArray(rep.results) ? rep.results : []) {
      if (!row.id || map.has(row.id)) return { error: 'missing or duplicate task id in report' };
      map.set(row.id, Array.isArray(row.attempts) && row.attempts.length ? row.attempts : [row]);
    }
    maps.push(map);
  }
  const ids = [...maps[0].keys()].filter(id => maps.every(m => m.has(id)));
  const all = new Set(maps.flatMap(m => [...m.keys()]));
  return { byTask: new Map(ids.map(id => [id, maps.flatMap(m => m.get(id))])), dropped: all.size - ids.length, unstamped: reps.length > 1 && !reps[0].stamp };
}

// Simulate the council over saved eval reports, with no model. A report, or an
// array of them. Per task the attempts are pooled in order: a --repeat N report
// keeps them in row.attempts, and several tries:1 reports (round five's "three
// fresh runs per arm") contribute one row each. Rotation r takes attempt r as
// the baseline and the next `extra` attempts (cyclic) as the council, stopping
// at the first pass; the result is the mean over all rotations. Tokens are the
// engine's prompt tokens, summed for exactly the attempts the council would run.
// It is an upper bound where the visible check differs from the hidden grader,
// because it counts the grader's pass. Returns {ok:false, error} when there is
// nothing to replay.
export function replay(input, { extra = 2 } = {}) {
  const reports = (Array.isArray(input) ? input : [input]).filter(Boolean);
  const got = attemptsByTask(reports);
  if (got.error) return { ok: false, error: got.error };
  const { byTask } = got;
  if (!byTask.size) return { ok: false, error: 'no results in the report' };
  const n = Math.min(...[...byTask.values()].map((l) => l.length));
  if (n < 2) return { ok: false, error: 'a council needs at least 2 attempts per task: give a report saved with --repeat 3, or three reports saved from three runs' };
  if (!Number.isFinite(extra) || extra < 0) return { ok: false, error: 'extra must be a finite nonnegative number' };
  const size = Math.min(1 + Math.floor(extra), n);
  const tasks = [...byTask.values()].map((l) => l.slice(0, n));
  let baseSolved = 0, councilSolved = 0, baseTokens = 0, extraTokens = 0, unrecorded = 0;
  for (let r = 0; r < n; r++) {
    for (const attempts of tasks) {
      const order = Array.from({ length: size }, (_, j) => attempts[(r + j) % n]);
      const base = order[0];
      baseTokens += cost(base) || 0;
      if (cost(base) === null) unrecorded++;
      if (base.pass) { baseSolved++; councilSolved++; continue; }
      for (const a of order.slice(1)) {
        extraTokens += cost(a) || 0;
        if (cost(a) === null) unrecorded++;
        if (a.pass) { councilSolved++; break; }
      }
    }
  }
  const mean = (x) => x / n;
  const out = { ok: true, tasks: tasks.length, attempts: n, councilSize: size, rotations: n, extra: size - 1, dropped: got.dropped, unstamped: got.unstamped };
  out.baseSolved = mean(baseSolved);
  out.councilSolved = mean(councilSolved);
  out.gained = mean(councilSolved - baseSolved);
  out.baseTokens = Math.round(mean(baseTokens));
  out.extraTokens = Math.round(mean(extraTokens));
  out.perSolveBefore = baseSolved ? Math.round(baseTokens / baseSolved) : null;
  out.perSolveAfter = councilSolved ? Math.round((baseTokens + extraTokens) / councilSolved) : null;
  out.multiplier = out.perSolveBefore && out.perSolveAfter ? Math.round((out.perSolveAfter / out.perSolveBefore) * 100) / 100 : null;
  out.unrecorded = Math.round(mean(unrecorded) * 100) / 100;
  out.floor = FLOOR;
  out.clearsFloor = out.gained >= FLOOR;
  return out;
}

const r1 = (x) => String(Math.round(x * 10) / 10);
const kt = (x) => (x == null ? 'n/a' : `${(x / 1000).toFixed(1)}k`);

// The lines `atlias council replay` prints.
export function formatReplay(r) {
  if (!r.ok) return [`atlias council replay: ${r.error}`];
  const lines = [
    `council replay: ${r.tasks} task(s), ${r.attempts} attempt(s) each; attempt 1 is the baseline, the next ${r.extra} are the council, stopping at the first pass; mean over ${r.rotations} rotation(s) (each attempt taken as the first)`,
    `  base solved      ${r1(r.baseSolved)} of ${r.tasks}`,
    `  council solved   ${r1(r.councilSolved)} of ${r.tasks}`,
    `  gained           ${r1(r.gained)} task(s)`,
    `  extra tokens     ${kt(r.extraTokens)} prompt tokens on top of ${kt(r.baseTokens)}`,
    `  per solve        ${kt(r.perSolveBefore)} before, ${kt(r.perSolveAfter)} after${r.multiplier ? `  (${r.multiplier}x)` : ''}`,
    `  verdict          ${r.clearsFloor ? `clears the ${r.floor}-flip floor: the Stage B hook and an MT council arm are worth building` : `inside the noise (under ${r.floor} one-way flips): stop here and spend no GPU hours`}`,
  ];
  if (r.dropped) lines.push(`  note             ${r.dropped} task(s) absent from one report were left out`);
  if (r.unstamped) lines.push('  note             reports carry no harness stamp; the same build is unverified');
  if (r.unrecorded) lines.push(`  note             ${r.unrecorded} attempt(s) per rotation had no recorded prompt tokens and count as 0`);
  lines.push('  oracle selection: an upper bound where the visible check differs from the grader; it counts the hidden grader\'s pass, where the council would see only the visible check');
  return lines;
}
