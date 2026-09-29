// Council Stage A (lib/council.mjs): the selector, the sequential runner, and
// the replay over saved runs, against a fixture computed by hand. Nothing here
// runs a model. Loaded by test/run.mjs.
import * as council from '../lib/council.mjs';

export default async function councilSuites({ suite, asyncSuite, check }) {
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  // Three tasks, three attempts each (pass/fail and prompt tokens):
  //   T1  P100 P100 P100   T2  F200 P300 F400   T3  F50 F60 F70
  // Rotation 0: alone 1 solved / 350 tokens, council 2 / 780 (T2 takes a1;
  // T3 spends a1 and a2). Rotation 1: 2 / 460 and 2 / 580. Rotation 2: 1 / 570
  // and 2 / 1180 (T2 spends a0, then a1 passes). Means: 4/3 and 2 solved,
  // 460 and 846.67 tokens, 1.8406x.
  const att = { T1: [[1, 100], [1, 100], [1, 100]], T2: [[0, 200], [1, 300], [0, 400]], T3: [[0, 50], [0, 60], [0, 70]] };
  const row = (id, [p, t]) => ({ id, pass: Boolean(p), promptTotal: t });
  const repeat3 = { engine: 'ollama', model: 'qwen2.5-coder:7b', tries: 3, results: Object.entries(att).map(([id, a]) => ({ id, pass: a.every((x) => x[0]), attempts: a.map((x) => row(id, x)) })) };
  const runs = [0, 1, 2].map((k) => ({ engine: 'ollama', model: 'qwen2.5-coder:7b', tries: 1, stamp: { text: 'atlias 3.9.0 @ abc1234' }, results: Object.entries(att).map(([id, a]) => row(id, a[k])) }));

  suite('council', 'the replay over saved runs', () => {
    const x = council.replay([repeat3]);
    check('one --repeat 3 report gives the hand-computed means, gain, tokens and multiplier', !x.error && x.tasks === 3 && x.attempts === 3 && near(x.baseSolved, 4 / 3) && x.councilSolved === 2 && near(x.gained, 2 / 3) && near(x.baseTokens, 460) && near(x.councilTokens, 2540 / 3) && near(x.multiplier, 2540 / 1380) && x.floor === 'inside the noise' && JSON.stringify(x.rotations.map((r) => [r.base, r.council, r.baseTokens, r.councilTokens])) === JSON.stringify([[1, 2, 350, 780], [2, 2, 460, 580], [1, 2, 570, 1180]]),
      { happened: JSON.stringify(x).slice(0, 500), why: 'Step 0 decides whether Stage B is built at all; its arithmetic must be exactly the council\'s spending.', fix: 'replay in lib/council.mjs.' });
    const y = council.replay(runs);
    check('three tries-1 runs of one arm replay the same as one --repeat 3 report', !y.error && JSON.stringify(y.rotations) === JSON.stringify(x.rotations),
      { happened: JSON.stringify(y).slice(0, 300), why: 'Round five\'s MT protocol is three fresh runs with --save, whose rows keep no attempts.', fix: 'attemptsByTask joins tries-1 reports by task id.' });
    const one = council.replay([runs[0]]);
    const arms = council.replay([runs[0], { ...runs[1], model: 'qwen2.5-coder:14b' }]);
    const direct = council.replay([runs[0], { ...runs[1], direct: true }]);
    const builds = council.replay([runs[0], { ...runs[1], stamp: { text: 'atlias 3.9.0 @ def5678' } }]);
    const partial = council.replay([runs[0], runs[1], { ...runs[2], results: runs[2].results.slice(0, 2) }]);
    check('a tries-1 report alone is refused; two models, loop and direct, or two builds are two arms and refused; a task missing from a run is left out and counted', /tries 1/.test(one.error || '') && /two arms/.test(arms.error || '') && /two arms/.test(direct.error || '') && /two builds/.test(builds.error || '') && !partial.error && partial.tasks === 2 && partial.dropped === 1,
      { happened: JSON.stringify({ one: one.error, arms: arms.error, direct: direct.error, builds: builds.error, partial: [partial.tasks, partial.dropped] }), why: 'Resampling one attempt, or mixing arms or builds, would report a gain that is not a council\'s.', fix: 'attemptsByTask.' });
    const joined = council.attemptsByTask(runs);
    const bare = runs.map(({ stamp, ...r }) => r);
    const halfStamped = council.replay([runs[0], bare[1]]);
    const noStamps = council.replay(bare);
    check('attemptsByTask lists each task\'s attempts in run order; a stamped run with an unstamped one is refused, two unstamped runs replay with the caveat', !joined.error && joined.tasks.length === 3 && JSON.stringify(joined.tasks[1].attempts) === JSON.stringify([{ pass: false, tokens: 200 }, { pass: true, tokens: 300 }, { pass: false, tokens: 400 }]) && /no harness stamp/.test(halfStamped.error || '') && !noStamps.error && noStamps.unstamped && /no harness stamp/.test(council.formatReplay(noStamps)),
      { happened: JSON.stringify({ t: joined.tasks && joined.tasks[1], half: halfStamped.error, none: noStamps.unstamped }), why: 'Reports written before stamps existed cannot prove they are one build; the replay must say so rather than assume it.', fix: 'attemptsByTask and formatReplay.' });
    const text = council.formatReplay(x);
    const two = council.formatReplay(council.replay(runs.slice(0, 2)));
    check('the report names the gain, the floor, the multiplier and the oracle caveat, and never more candidates than a task has', /2 with the council/.test(text) && /inside the noise/.test(text) && /1\.84x/.test(text) && /oracle selection/.test(text) && /up to 2 more/.test(text) && /up to 1 more/.test(two) && /council replay: /.test(council.formatReplay(one)),
      { happened: `${text} || ${two}`, why: 'The replay is an upper bound on CanItEdit; the printout must say so beside the number.', fix: 'formatReplay.' });
  });

  suite('council', 'when it convenes and whom it picks', () => {
    check('it convenes only with the flag on, a check named, and that check run and failed', council.shouldConvene({ flagOn: true, check: 'python check.py', checkResult: { pass: false } }) && !council.shouldConvene({ flagOn: false, check: 'x', checkResult: { pass: false } }) && !council.shouldConvene({ flagOn: true, check: null, checkResult: { pass: false } }) && !council.shouldConvene({ flagOn: true, check: 'x', checkResult: { pass: false, timedOut: true } }) && !council.shouldConvene({ flagOn: true, check: 'x', checkResult: { pass: false, ran: false } }) && !council.shouldConvene({ flagOn: true, check: 'x', checkResult: { pass: true } }),
      { happened: 'see the six cases', why: 'A timeout or a check that never started gives no selection signal; resampling on it is a vote.', fix: 'shouldConvene.' });
    check('pick takes the first visible pass that did not tamper, in index order, or none', council.pick([{ i: 1, visiblePass: false }, { i: 2, visiblePass: true, tampered: true }, { i: 3, visiblePass: true }]) === 3 && council.pick([{ i: 1, visiblePass: false }]) === null && council.pick([]) === null,
      { happened: 'see the three cases', why: 'A candidate that rewrote the check would always pass it.', fix: 'pick.' });
  });

  await asyncSuite('council', 'candidates run one at a time and stop at the first green', async () => {
    const trace = [];
    const plan = { 1: { pass: false }, 2: { pass: true, tampered: true } };
    const r = await council.runCandidates({
      count: 2,
      makeDir: (i) => `dir${i}`,
      run: (dir, i) => { trace.push(`run ${i}`); return { promptTotal: 10 * i }; },
      check: (dir) => { trace.push(`check ${dir}`); return { pass: plan[Number(dir.slice(3))].pass }; },
      tampered: (dir) => Boolean(plan[Number(dir.slice(3))].tampered),
      dispose: (dir) => { trace.push(`dispose ${dir}`); },
    });
    check('a red candidate is disposed of, a tampered green one is not chosen, and both costs are kept', r.ran === 2 && r.chosen === null && r.candidates[1].tampered && r.candidates[0].promptTotal === 10 && r.candidates[1].promptTotal === 20 && trace.join('|') === 'run 1|check dir1|dispose dir1|run 2|check dir2|dispose dir2',
      { happened: JSON.stringify({ r, trace }), why: 'Sequential candidates pay extra only on red and only until the first honest green.', fix: 'runCandidates.' });
    const calls = [];
    const w = await council.runCandidates({ count: 2, makeDir: (i) => i, run: (d, i) => { calls.push(i); }, check: () => ({ pass: true }), tampered: () => false });
    check('a green first candidate ends the council: the second never runs, and the winner is not disposed of', w.chosen === 1 && w.ran === 1 && calls.join() === '1',
      { happened: JSON.stringify({ w, calls }), why: 'Stopping at the first pass is what makes the council cheap.', fix: 'runCandidates breaks on the winner.' });
  });
}
