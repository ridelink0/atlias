// The council, Stage A (docs/research/Atlias councils and UFS packs.md, build
// item 1): flags.council, the selector and sequential runner in lib/council.mjs,
// and `atlias council replay`, which simulates the check-selected retry over
// saved eval reports with no model. Stage B (the hook in atlias eval) is not
// built, so acceptance tests A2-A7 and A10 wait for it; A1 is the existing golden
// check in test/control-suites.mjs (council is registered, off, and it passes
// unchanged); A8, A9 and A11 are
// here, and the runner is tested with scripted candidates.
import * as council from '../lib/council.mjs';
import * as settings from '../lib/settings.mjs';

export default async function councilSuites({ asyncSuite, check, core, ROOT, TMP, fs, path, spawnSync }) {
  const FIX = path.join(ROOT, 'test', 'fixtures');
  const load = (n) => JSON.parse(fs.readFileSync(path.join(FIX, n), 'utf8'));
  const cli = (...args) => spawnSync(process.execPath, [path.join(ROOT, 'bin', 'atlias.mjs'), 'council', ...args], { encoding: 'utf8', env: { ...process.env, ATLIAS_HOME: path.join(TMP, 'state-council') }, timeout: 20000 });

  await asyncSuite('council expert', 'a replay compares fresh attempts from one build and one arm', async () => {
    const report = (sha = 'same') => ({ engine: 'ollama', model: 'qwen', stamp: { text: `atlias @ ${sha}` }, flags: core.flagStamp(), results: [{ id: 'a', pass: false, promptTotal: 10 }, { id: 'b', pass: true, promptTotal: 20 }] });
    const a = report(), b = report();
    const pooled = council.attemptsByTask([a, b]);
    check('same build pools the two attempts; another build is refused', pooled.byTask.get('a').length === 2 && Boolean(council.replay([a, report('other')]).error), { happened: JSON.stringify(council.replay([a, report('other')])), why: 'An A/B comparison is not a fresh retry of the same harness.', fix: 'attemptsByTask checks provenance before pooling.' });
    check('missing provenance, another model, a direct arm, and duplicate task ids are refused', Boolean(council.replay([a, { ...b, stamp: null }]).error) && Boolean(council.replay([a, { ...b, model: 'other' }]).error) && Boolean(council.replay([a, { ...b, direct: true }]).error) && Boolean(council.replay([{ ...a, results: [a.results[0], a.results[0]] }, b]).error), { happened: 'four mismatched provenance cases', why: 'Pooling them invents evidence for a council that never ran.', fix: 'Reject different arms, builds and duplicate ids.' });
    const partial = council.replay([a, { ...b, results: [b.results[0]] }]);
    check('partial reports keep only shared tasks and count the dropped task', partial.ok && partial.tasks === 1 && partial.dropped === 1, { happened: JSON.stringify(partial), why: 'An interrupted run cannot count missing attempts as failures or successes.', fix: 'Intersect task ids across reports.' });
    const zero = council.replay([a, b], { extra: 0 });
    check('zero retries spends no extra tokens, and invalid retry counts are refused', zero.ok && zero.extraTokens === 0 && zero.gained === 0 && Boolean(council.replay([a, b], { extra: Infinity }).error), { happened: JSON.stringify(zero), why: 'The model-free cost ledger must count exactly the attempts requested.', fix: 'Validate extra and preserve zero.' });
  });

  await asyncSuite('council expert', 'the flag is registered, off, and reads its environment name (A8)', async () => {
    check('flags.council is off by default, described, and listed in settings', core.DEFAULTS.flags.council === false && Boolean(settings.DESCRIPTIONS['flags.council']) && /3x/.test(settings.DESCRIPTIONS['flags.council']) && settings.GROUPS.some(([, ids]) => ids.includes('flags.council')),
      { happened: JSON.stringify([core.DEFAULTS.flags.council, settings.DESCRIPTIONS['flags.council']]), why: 'Every round-five change lands behind a flag that is off, so the control arm stays the control.', fix: 'DEFAULTS.flags in lib/core.mjs; DESCRIPTIONS, LABELS and GROUPS in lib/settings.mjs.' });
    const on = core.envFlags({ ATLIAS_FLAG_COUNCIL: '1' }), bad = core.envFlags({ ATLIAS_FLAG_COUNCIL: 'maybe' });
    check('ATLIAS_FLAG_COUNCIL=1 turns it on; =maybe is reported and not applied', core.flagEnvName('council') === 'ATLIAS_FLAG_COUNCIL' && on.values.council === true && bad.bad.length === 1 && !('council' in bad.values),
      { happened: JSON.stringify({ on, bad }), why: 'The PC switches arms by environment; a value that is neither on nor off must not run an arm nobody asked for.', fix: 'Register council in DEFAULTS.flags; envFlags does the rest.' });
  });

  await asyncSuite('council expert', 'shouldConvene and pick select by the check, never by a vote', async () => {
    const fail = { outcome: 'fail' };
    check('it convenes only with the flag on, a check found, and a failed result', council.shouldConvene({ flagOn: true, check: { programs: ['node'] }, checkResult: fail }) === true
      && !council.shouldConvene({ flagOn: false, check: {}, checkResult: fail })
      && !council.shouldConvene({ flagOn: true, check: null, checkResult: fail })
      && !council.shouldConvene({ flagOn: true, check: {}, checkResult: { outcome: 'pass' } })
      && !council.shouldConvene({ flagOn: true, check: {}, checkResult: { outcome: 'unfinished' } })
      && !council.shouldConvene({ flagOn: true, check: {} }),
      { happened: 'see the cases', why: 'No check means a vote; an unfinished check gives no signal to select with; a passing check needs no help.', fix: 'shouldConvene requires flagOn, a check, and checkResult.outcome === "fail".' });
    const noSignal = [{ outcome: 'unfinished', pass: false }, { outcome: 'pass', pass: false }, { pass: false }, { outcome: 'fail', timedOut: true }, { outcome: 'fail', ran: false }, { outcome: 'fail', pass: true }];
    check('unfinished, missing, timed-out and contradictory results cannot authorize retries', noSignal.every(checkResult => !council.shouldConvene({ flagOn: true, check: {}, checkResult }))
      && council.shouldConvene({ flagOn: true, check: {}, checkResult: { outcome: 'fail', ran: true, pass: false } }),
      { happened: 'six no-signal cases and a real failed check', why: 'A generic false pass field also describes timeouts and missing checks; retrying those spends model calls without a selection signal.', fix: 'Require the explicit fail outcome and reject conflicting pass, timeout or not-run markers.' });
    const picked = council.pick([{ i: 1, visiblePass: false }, { i: 2, visiblePass: true, tampered: true }, { i: 3, visiblePass: true }, { i: 4, visiblePass: true }]);
    check('pick takes the first visible pass without tamper, in index order, else null', picked && picked.i === 3 && council.pick([{ i: 1, visiblePass: true, tampered: true }, { i: 2, visiblePass: false }]) === null && council.pick([]) === null,
      { happened: JSON.stringify(picked), why: 'A candidate that rewrote the test to exit 0 passes the check and must still lose.', fix: 'pick filters on visiblePass === true and !tampered, and returns the first.' });
  });

  // A scripted council: attempt i edits its workspace as scripts[i] says.
  const scripted = (scripts, { tamper = {} } = {}) => {
    const calls = [], made = [];
    return {
      calls, made,
      opts: {
        count: 2,
        makeDir: (i) => { const d = fs.mkdtempSync(path.join(TMP, `council-c${i}-`)); made.push(d); return d; },
        run: async (dir, i) => { calls.push(i); const s = scripts[i]; fs.writeFileSync(path.join(dir, 'result.txt'), s.ok ? 'right' : 'wrong'); return { chars: s.chars, promptTotal: s.prompt, outputTotal: 5 }; },
        check: (dir) => ({ outcome: fs.readFileSync(path.join(dir, 'result.txt'), 'utf8') === 'right' ? 'pass' : 'fail' }),
        tampered: (dir, i) => Boolean(tamper[i]),
        dispose: (dir) => fs.rmSync(dir, { recursive: true, force: true }),
      },
    };
  };
  const left = (s) => s.made.filter((d) => fs.existsSync(d));

  await asyncSuite('council expert', 'runCandidates runs in order and stops at the first pass (A3)', async () => {
    const s = scripted({ 1: { ok: false, chars: 10, prompt: 100 }, 2: { ok: true, chars: 20, prompt: 200 }, 3: { ok: true, chars: 30, prompt: 300 } });
    s.opts.count = 3;
    const r = await council.runCandidates(s.opts);
    check('candidate 1 wrong, 2 right: chosen 2, ran 2, candidate 3 never called', r.chosen === 2 && r.ran === 2 && s.calls.join() === '1,2' && r.candidates.map((c) => c.visiblePass).join() === 'false,true',
      { happened: JSON.stringify({ r, calls: s.calls }), why: 'Sequential, stop-at-first-pass is the whole cost argument: extra tokens only on red, and only until green.', fix: 'runCandidates awaits each candidate in turn and breaks on the first pick().' });
    check('the winner is kept and the losing workspace is removed', left(s).length === 1 && left(s)[0] === r.winnerDir,
      { happened: JSON.stringify({ left: left(s), winner: r.winnerDir }), why: 'A council must not leave a workspace per attempt behind.', fix: 'dispose every candidate that is not the winner.' });
    check('the cost of every candidate that ran is recorded and sums', r.candidates.reduce((n, c) => n + c.promptTotal, 0) === 300 && r.candidates.reduce((n, c) => n + c.chars, 0) === 30,
      { happened: JSON.stringify(r.candidates), why: 'atlias compare must see the true cost of the retry.', fix: 'Carry chars, promptTotal and outputTotal from run() into each candidate.' });
    fs.rmSync(r.winnerDir, { recursive: true, force: true });
  });

  await asyncSuite('council expert', 'a candidate that tampered with the check does not win (A4), and nobody winning leaves nothing (A5)', async () => {
    const s = scripted({ 1: { ok: true, chars: 1, prompt: 1 }, 2: { ok: true, chars: 1, prompt: 1 } }, { tamper: { 1: true } });
    const r = await council.runCandidates(s.opts);
    check('candidate 1 passes but tampered, candidate 2 wins', r.chosen === 2 && r.candidates[0].tampered === true && r.candidates[0].visiblePass === true && r.ran === 2,
      { happened: JSON.stringify(r), why: 'Rewriting test.mjs to exit 0 passes the visible check and proves nothing.', fix: 'pick() skips tampered candidates; runCandidates keeps going past them.' });
    fs.rmSync(r.winnerDir, { recursive: true, force: true });
    const n = scripted({ 1: { ok: false, chars: 1, prompt: 1 }, 2: { ok: false, chars: 1, prompt: 1 } });
    const none = await council.runCandidates(n.opts);
    check('nobody wins: chosen null, ran 2, no workspace left', none.chosen === null && none.winnerDir === null && none.ran === 2 && left(n).length === 0,
      { happened: JSON.stringify({ none, left: left(n) }), why: 'The caller then scores the original workspace exactly as today.', fix: 'Dispose every candidate when there is no winner.' });
    const boom = scripted({ 1: { ok: false, chars: 1, prompt: 1 }, 2: { ok: true, chars: 1, prompt: 1 } });
    const orig = boom.opts.run; boom.opts.run = async (d, i) => { if (i === 1) throw new Error('model gone'); return orig(d, i); };
    const rb = await council.runCandidates(boom.opts);
    check('a candidate whose run throws counts as a fail, not a crash', rb.chosen === 2 && rb.candidates[0].error === 'model gone',
      { happened: JSON.stringify(rb), why: 'An engine error in one resample must not lose the others.', fix: 'Catch around run and check inside runCandidates.' });
    fs.rmSync(rb.winnerDir, { recursive: true, force: true });
  });

  await asyncSuite('council expert', 'replay does the arithmetic by hand (A9)', async () => {
    // t1 fails, fails, passes; t2 always passes; t3 never passes; 100 prompt tokens an attempt.
    // Rotation 0: base solves t2; the council adds t1 (200 tokens) and spends 200 on t3.
    // Rotation 1: t1 fails then passes (100), t3 200: 300 extra. Rotation 2: base solves t1 and t2; only t3 spends 200.
    // base solved 4/3, council solved 2, gained 2/3; extra 900/3 = 300; per solve 900/4 = 225 and 1800/6 = 300, 1.33x.
    const r = council.replay(load('council-replay-tries3.json'));
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    check('a tries:3 report gives the hand-computed gain, tokens and multiplier', r.ok && r.tasks === 3 && near(r.baseSolved, 4 / 3) && near(r.councilSolved, 2) && near(r.gained, 2 / 3) && r.baseTokens === 300 && r.extraTokens === 300 && r.perSolveBefore === 225 && r.perSolveAfter === 300 && r.multiplier === 1.33 && r.clearsFloor === false,
      { happened: JSON.stringify(r), why: 'Step 0 decides whether any GPU hour is spent; the arithmetic must be what a person gets by hand.', fix: 'replay: rotate the baseline over every attempt, run the next two in order, stop at the first pass, mean over rotations.' });
    const three = council.replay([load('council-replay-run1.json'), load('council-replay-run2.json'), load('council-replay-run3.json')]);
    check('three tries:1 reports replay to the same arithmetic and disclose their missing provenance', three.ok && three.unstamped && !r.unstamped && JSON.stringify({ ...three, unstamped: r.unstamped }) === JSON.stringify(r),
      { happened: JSON.stringify(three), why: 'A row keeps its attempts only when tries > 1; refusing three separate runs would refuse the very data Step 0 is for.', fix: 'Pool the rows of several reports per task id.' });
    const one = council.replay(load('council-replay-run1.json'));
    check('a single tries:1 report is refused', one.ok === false && /at least 2 attempts/.test(one.error),
      { happened: JSON.stringify(one), why: 'One attempt per task holds no resample to replay.', fix: 'Refuse when a task has fewer than two attempts.' });
    const many = (n) => ({ tries: 3, results: Array.from({ length: n }, (_, k) => ({ id: `x${k}`, attempts: [false, false, true].map((p) => ({ pass: p, promptTotal: 10 })) })) });
    const at = council.replay(many(9)), under = council.replay(many(6));
    check('the six-flip floor: 9 such tasks gain exactly 6 and clear it, 6 gain 4 and do not', at.gained === 6 && at.clearsFloor === true && under.gained === 4 && under.clearsFloor === false,
      { happened: JSON.stringify([at.gained, under.gained]), why: 'Under six one-way flips is inside round five\'s noise.', fix: 'clearsFloor is gained >= FLOOR (6).' });
    const text = council.formatReplay(r).join('\n');
    check('the printout names every figure the spec asks for', /3 task/.test(text) && /base solved/.test(text) && /council solved/.test(text) && /gained/.test(text) && /extra tokens/.test(text) && /per solve/.test(text) && /1\.33x/.test(text) && /inside the noise/.test(text) && /oracle selection: an upper bound/.test(text),
      { happened: text, why: 'The PC reads this output to decide Step 1.', fix: 'formatReplay lines.' });
  });

  await asyncSuite('council expert', 'atlias council replay reads saved reports (A9, the command)', async () => {
    const ok = cli('replay', path.join(FIX, 'council-replay-tries3.json'));
    check('one --repeat 3 report prints the replay and exits 0', ok.status === 0 && /council replay: 3 task/.test(ok.stdout) && /inside the noise/.test(ok.stdout),
      { happened: `${ok.status} ${ok.stdout}${ok.stderr}`, why: 'This is the command the PC runs over its saved MT reports.', fix: 'case "council" in bin/atlias.mjs.' });
    const j = cli('replay', '--json', ...[1, 2, 3].map((k) => path.join(FIX, `council-replay-run${k}.json`)));
    let parsed = null; try { parsed = JSON.parse(j.stdout); } catch { /* reported below */ }
    check('three tries:1 reports with --json print the result as JSON', j.status === 0 && parsed && parsed.ok && parsed.perSolveAfter === 300,
      { happened: `${j.status} ${j.stdout}${j.stderr}`, why: 'Scripts read the JSON.', fix: '--json prints replay() as JSON.' });
    const refused = cli('replay', path.join(FIX, 'council-replay-run1.json'));
    check('a lone tries:1 report is refused with exit 1', refused.status === 1 && /at least 2 attempts/.test(refused.stdout),
      { happened: `${refused.status} ${refused.stdout}`, why: 'Silently printing a zero gain would read as "stop here" when there was nothing to replay.', fix: 'exit 1 when replay returns ok:false.' });
    const nofile = cli('replay', path.join(FIX, 'no-such-report.json'));
    const usage = cli();
    check('a missing file and no arguments are reported, not crashed on', nofile.status === 1 && /could not read/.test(nofile.stdout) && usage.status === 1 && /usage: atlias council replay/.test(usage.stdout),
      { happened: `${nofile.status} ${nofile.stdout} | ${usage.status} ${usage.stdout}`, why: 'A typo in a path must say so.', fix: 'Catch the read and print usage.' });
  });
}
