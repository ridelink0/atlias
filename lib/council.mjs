// Council, Stage A (docs/research/Atlias councils and UFS packs.md, "Let the
// check pick, not the council"). A council that wins on code is a test filter:
// resample on a red visible check, and let the check pick the first green
// candidate. Stage A is the part that costs nothing: a pure selector, a
// provider-agnostic sequential runner for Stage B to call, and `atlias council
// replay`, which simulates the council over saved runs that are already paid
// for. Nothing here runs during an eval, and no flag turns it on: Stage B (the
// eval hook behind flags.council) is built only if the replay clears round
// five's six-flip floor.
import { sameFlags } from './core.mjs';

// Convene only on a visible check that ran and failed. A timeout, or a check
// that could not start, gives no selection signal: resampling on it is a vote.
export function shouldConvene({ flagOn = false, check = null, checkResult = null } = {}) {
  return Boolean(flagOn && check && checkResult && checkResult.ran !== false && !checkResult.timedOut && checkResult.pass === false);
}

// The first candidate, in index order, whose visible check passed and which did
// not touch the grader's files; null when none did.
export function pick(candidates) {
  for (const c of candidates || []) if (c && c.visiblePass && !c.tampered) return c.i;
  return null;
}

// Up to `count` candidates, one after another (one Ollama slot; the same prompt
// reuses the loaded prefix; stopping at the first pass only saves when the
// candidates run in order). A losing candidate's workspace is disposed of at
// once; the winner's is kept for grading.
export async function runCandidates({ count = 2, makeDir, run, check, tampered, dispose = () => {} }) {
  const candidates = [];
  let chosen = null;
  for (let i = 1; i <= count; i++) {
    const dir = await makeDir(i);
    const cost = (await run(dir, i)) || {};
    const v = (await check(dir)) || {};
    const t = Boolean(await tampered(dir));
    candidates.push({ i, visiblePass: Boolean(v.pass), tampered: t, dir, ...cost });
    if (v.pass && !t) { chosen = i; break; }
    await dispose(dir);
  }
  return { convened: true, ran: candidates.length, chosen, candidates };
}

const tokensOf = (a) => (typeof a.promptTotal === 'number' && Number.isFinite(a.promptTotal) ? a.promptTotal : null);

// Every task's attempts, in order, from either one report run with --repeat 2+
// or several tries-1 reports of the same arm (round five's MT protocol is three
// fresh runs with --save, and those rows keep no attempts list).
export function attemptsByTask(reports) {
  const reps = (reports || []).filter(Boolean);
  if (!reps.length) return { error: 'no report to replay' };
  const armOf = (r) => [r.engine || '', r.model || '', r.direct ? 'direct' : 'loop'].join(' / ');
  for (const r of reps.slice(1)) {
    if (armOf(r) !== armOf(reps[0])) return { error: `these reports are two arms (${armOf(reps[0])} and ${armOf(r)}); replay one arm's runs` };
    if (reps[0].flags && r.flags && !sameFlags(reps[0].flags, r.flags)) return { error: 'these reports ran with different flags, so they are two arms; replay one arm\'s runs' };
    // A council resamples one build. Two runs stamped with different code are
    // two arms, whatever their flags say.
    // A report with no stamp cannot be shown to be the same build as one with
    // a stamp, so that pair is refused too.
    const code = (x) => (x.stamp && x.stamp.text) || '';
    if (code(reps[0]) !== code(r)) return { error: `these reports are two builds (${code(reps[0]) || 'no harness stamp'} and ${code(r) || 'no harness stamp'}), so they are two arms; replay one build's runs` };
  }
  const unstamped = reps.length > 1 && !(reps[0].stamp && reps[0].stamp.text);
  const rowsOf = (r) => (r.results || []).map((row) => ({ id: row.id, attempts: (row.attempts && row.attempts.length ? row.attempts : [row]).map((a) => ({ pass: Boolean(a.pass), tokens: tokensOf(a) })) }));
  if (reps.length === 1) {
    const tries = Number(reps[0].tries) || 1;
    if (tries < 2) return { error: `this report has tries ${tries}: one attempt per task, nothing to resample. Replay a --repeat 3 report, or two or more tries-1 runs of the same arm` };
    return { tasks: rowsOf(reps[0]) };
  }
  const maps = reps.map((r) => new Map(rowsOf(r).map((t) => [t.id, t.attempts])));
  const ids = [...maps[0].keys()].filter((id) => maps.every((m) => m.has(id)));
  const dropped = new Set(maps.flatMap((m) => [...m.keys()]).filter((id) => !ids.includes(id))).size;
  return { tasks: ids.map((id) => ({ id, attempts: maps.flatMap((m) => m.get(id)) })), dropped, unstamped };
}

// The replay: attempt r is the baseline and the next `extra` attempts (in turn,
// wrapping round) are the council, stopping at the first pass, with tokens
// summed as the council would spend them. The result is the mean over every
// rotation, each attempt taken as the first. Its one optimism is selection: the
// saved pass is the hidden grader's, which the council would not see, so on a
// benchmark whose visible check differs from its grader it is an upper bound.
export function replay(reports, { extra = 2 } = {}) {
  const got = attemptsByTask(reports);
  if (got.error) return { error: got.error };
  const tasks = got.tasks.filter((t) => t.attempts.length >= 2);
  if (!tasks.length) return { error: 'no task has two or more attempts to replay' };
  const k = Math.max(...tasks.map((t) => t.attempts.length));
  const rotations = [];
  for (let r = 0; r < k; r++) {
    let base = 0, council = 0, baseTok = 0, councilTok = 0, missing = 0;
    for (const t of tasks) {
      const a = t.attempts;
      const b = a[r % a.length];
      if (b.tokens === null) missing++;
      baseTok += b.tokens || 0;
      councilTok += b.tokens || 0;
      if (b.pass) { base++; council++; continue; }
      for (let j = 1; j <= Math.min(extra, a.length - 1); j++) {
        const c = a[(r + j) % a.length];
        if (c.tokens === null) missing++;
        councilTok += c.tokens || 0;
        if (c.pass) { council++; break; }
      }
    }
    rotations.push({ base, council, gained: council - base, baseTokens: baseTok, councilTokens: councilTok, missingTokens: missing });
  }
  const mean = (f) => rotations.reduce((n, x) => n + f(x), 0) / rotations.length;
  const baseSolved = mean((x) => x.base), councilSolved = mean((x) => x.council);
  const baseTokens = mean((x) => x.baseTokens), councilTokens = mean((x) => x.councilTokens);
  const gained = councilSolved - baseSolved;
  return {
    tasks: tasks.length,
    dropped: got.dropped || 0,
    unstamped: Boolean(got.unstamped),
    attempts: k,
    extra,
    rotations,
    baseSolved,
    councilSolved,
    gained,
    floor: gained >= 6 ? 'clears the six-flip floor' : 'inside the noise',
    baseTokens,
    councilTokens,
    extraTokens: councilTokens - baseTokens,
    perSolveBefore: baseSolved ? baseTokens / baseSolved : null,
    perSolveAfter: councilSolved ? councilTokens / councilSolved : null,
    multiplier: baseTokens ? councilTokens / baseTokens : null,
    missingTokens: rotations.some((x) => x.missingTokens > 0),
  };
}

export function formatReplay(x) {
  if (x.error) return `council replay: ${x.error}`;
  const f1 = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const k = (n) => (n === null ? 'n/a' : `${(n / 1000).toFixed(1)}k`);
  return [
    `council replay: ${x.tasks} task(s), ${x.attempts} attempt(s) each, up to ${Math.min(x.extra, x.attempts - 1)} more per red task; the mean over ${x.rotations.length} rotations (each attempt taken as the first)${x.dropped ? `; ${x.dropped} task(s) not in every report were left out` : ''}.`,
    `solved: ${f1(x.baseSolved)} alone, ${f1(x.councilSolved)} with the council, ${f1(x.gained)} gained (every one a one-way flip): ${x.floor}.`,
    `prompt tokens: ${k(x.baseTokens)} alone, ${k(x.councilTokens)} with the council (+${k(x.extraTokens)}, ${x.multiplier === null ? 'n/a' : `${x.multiplier.toFixed(2)}x`}); per solved task ${k(x.perSolveBefore)} before, ${k(x.perSolveAfter)} after.${x.missingTokens ? ' Some attempts recorded no prompt tokens and count as 0.' : ''}`,
    'oracle selection: an upper bound where the visible check differs from the grader (CanItEdit hides its tests).',
    ...(x.unstamped ? ['these reports carry no harness stamp, so that they ran the same build is not checked.'] : []),
  ].join('\n');
}
