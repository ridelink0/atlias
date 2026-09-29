// HumanEvalFix v2 (NEXTGEN-5 row 7): the check prints the call, the expected
// value and the actual value for a failing assertion, where v1 prints a bare
// AssertionError. The cloud builds the converter against fixture rows (Hugging
// Face is blocked here); the PC regenerates the corpus. These checks hold it to
// three rules: v1 output does not move by a byte, a shape the rewrite cannot
// place keeps its v1 assertion and is counted, and a v2 check run against a
// buggy and a fixed solution says what it should and nothing more.
//
// Loaded by test/run.mjs, which owns asyncSuite() and check().
import { spawnSync } from 'node:child_process';
import * as bench from '../lib/editbench.mjs';
import * as poly from '../lib/polyglot.mjs';
import * as evals from '../lib/eval.mjs';
import { HEFIX_ROWS, HEFIX_JS_ROW } from './fixtures/humanevalfix-rows.mjs';

export default async function hefixV2Suites({ asyncSuite, check, skip, TMP, fs, path }) {
  const golden = JSON.parse(fs.readFileSync(new URL('./fixtures/humanevalfix-v1-golden.json', import.meta.url), 'utf8'));
  const py = poly.resolveRunner('python', { bare: true });
  const exe = py.ok ? py.exe : 'python';
  const W = path.join(TMP, 'hefix-v2-work');
  fs.mkdirSync(W, { recursive: true });
  const v2of = (row) => bench.humanEvalFixTask(row, 'python', { exe, v2: true });
  const rewrite = (n) => bench.rewriteHumanEvalFixTests(HEFIX_ROWS[n].test, HEFIX_ROWS[n].entry_point);

  await asyncSuite('benchmark expert', 'HumanEvalFix v2 leaves v1 byte for byte alone', async () => {
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const v1 = HEFIX_ROWS.map((r) => bench.humanEvalFixTask(r, 'python', { exe: 'python', node: 'node' }));
    const bad = v1.findIndex((t, i) => !same(t, golden.python[i]));
    check('all ten fixture rows convert to exactly the tasks recorded before v2 existed (Python)',
      bad === -1 && v1.length === 10,
      { happened: `row ${bad} differs`, why: 'Row 1 of the plan uses the v1 corpus as the content-free control arm; a v1 task that moved by a byte is a different control.', fix: 'Leave the v1 path of humanEvalFixTask untouched; v2 is opt-in.' });
    check('the JavaScript row and a changed round budget are unchanged too',
      same(bench.humanEvalFixTask(HEFIX_JS_ROW, 'js', { exe: 'python', node: 'node' }), golden.js)
        && same(bench.humanEvalFixTask(HEFIX_ROWS[0], 'python', { exe: 'python', rounds: 20 }), golden.python20),
      { happened: 'differs from test/fixtures/humanevalfix-v1-golden.json', why: 'v2 must not touch the JavaScript converter or the round budget.', fix: 'Keep the v2 branch inside `if (v2)`.' });
    check('v1 carries no v2 marker: same keys, an unrewritten tests.py, no helper',
      v1.every((t) => !('v2' in t) && !t.task.files['tests.py'].includes('_hef_') && t.task.id.startsWith('humanevalfix-python-') && !t.task.id.includes('v2')),
      { happened: JSON.stringify(Object.keys(v1[0])), why: 'A v1 task that leaks a v2 helper is no longer the bare-AssertionError control.', fix: 'Only add the helper and the v2 stats under v2.' });
    check('v2:false is v1',
      same(bench.humanEvalFixTask(HEFIX_ROWS[3], 'python', { exe: 'python', node: 'node', v2: false }), golden.python[3]),
      { happened: 'differs', why: 'The default must be off.', fix: 'v2 defaults to false.' });
  });

  await asyncSuite('benchmark expert', 'HumanEvalFix v2 rewrites the shapes the dataset uses', async () => {
    const t = (n) => rewrite(n).text;
    check('assert f(x) == y prints expected, actual and the call',
      t(0).includes('    _hef_eq("add(1, 2)", add(1, 2), 3)\n') && rewrite(0).rewritten === 3 && rewrite(0).fallbacks.length === 0,
      { happened: t(0), why: 'The dominant shape of the corpus.', fix: 'assert L == R -> _hef_eq(call, L, R).' });
    check('assert f(x) and assert not f(x) become a truthy and a falsy check',
      t(1).includes('_hef_truth("is_odd(3)", is_odd(3), True)') && t(1).includes('_hef_truth("is_odd(4)", is_odd(4), False)'),
      { happened: t(1), why: 'Predicates are asserted bare in HumanEvalPack.', fix: 'assert [not] call -> _hef_truth.' });
    check('assert abs(f(x) - y) < eps and <= eps become a tolerance check, exponent literals included',
      t(2).includes('_hef_close("mean([1, 2, 3])", mean([1, 2, 3]), 2.0, 1e-6, True)')
        && t(2).includes('_hef_close("mean([1e-3, 3e-3])", mean([1e-3, 3e-3]), 2e-3, 1e-9, True)')
        && t(6).includes('_hef_close("candidate(-1)", candidate(-1), -3.0, 1e-6, True)'),
      { happened: `${t(2)}\n${t(6)}`, why: 'Float tasks use abs(...) < 1e-6; the minus in 1e-3 and in a negative operand is not the subtraction.', fix: 'Find exactly one depth-0 binary minus.' });
    check('a call on the right-hand side is reported as the actual, and <= stays non-strict',
      t(3).includes('_hef_eq("sort_desc([1, 2])", [2, 1], sort_desc([1, 2]), 1)') && t(2).includes('_hef_close("mean([2, 3])", 2.5, mean([2, 3]), 1e-6, False, 1)'),
      { happened: `${t(3)}\n${t(2)}`, why: 'Operands keep their order and comparison; only the message knows which side is which.', fix: 'Pass a side flag rather than swapping the operands.' });
    check('an assert spanning lines, a trailing comment, and strings holding ==, a comma and a hash all rewrite',
      t(3).includes('_hef_eq("sort_desc( [3, 1, 2] )", sort_desc(\n        [3, 1, 2]\n    ), [3, 2, 1])')
        && t(5).includes('_hef_eq("join_eq(\\"x\\", \\"y\\")", join_eq("x", "y"), "x==y")  # a, b == c')
        && t(5).includes(`, join_eq('a,b', "#"), 'a,b==#')`),
      { happened: `${t(3)}\n${t(5)}`, why: 'Splitting on the first == or , would cut a string or a call in half.', fix: 'Scan with strings and brackets blanked.' });
    check('asserts inside a loop keep their indentation, and the HumanEval `candidate` name is recognised',
      t(6).includes('        _hef_eq("candidate(i)", candidate(i), i * 3)\n'),
      { happened: t(6), why: 'The entry point is not always the name the check uses.', fix: 'Match the entry point, candidate and the def check parameter.' });
    check('the helper is added only to a tests file it rewrote something in, before test_setup',
      v2of(HEFIX_ROWS[0]).task.files['tests.py'].startsWith(bench.HEFIX_V2_PRELUDE)
        && v2of(HEFIX_ROWS[8]).task.files['tests.py'].startsWith(`${bench.HEFIX_V2_PRELUDE}SEED = 7\n`)
        && bench.humanEvalFixTask({ ...HEFIX_ROWS[0], test: 'def check(add):\n    assert add(1, 1) == 2, "m"\n' }, 'python', { exe, v2: true }).task.files['tests.py'] === 'def check(add):\n    assert add(1, 1) == 2, "m"\n',
      { happened: v2of(HEFIX_ROWS[8]).task.files['tests.py'].slice(0, 120), why: 'A row with nothing to rewrite should be v1 text exactly.', fix: 'Prepend the prelude only when rewritten > 0.' });
  });

  await asyncSuite('benchmark expert', 'HumanEvalFix v2 falls back to the v1 assertion for shapes it cannot rewrite safely', async () => {
    const r4 = rewrite(4), r9 = rewrite(9);
    const lines = (s) => s.split('\n');
    const whys = [...r4.fallbacks, ...r9.fallbacks].map((f) => f.why);
    check('a message, and/or, is, !=, a chain, in, a ternary, no call and a semicolon all fall back, and are counted with a reason',
      r4.fallbacks.length === 7 && r9.fallbacks.length === 2
        && ['a message or a tuple', 'and/or', 'is/in comparison', 'a != comparison', 'chained comparison', 'unsupported syntax', 'no call to the function', 'an assert that does not start its own line'].every((w) => whys.includes(w)),
      { happened: JSON.stringify(whys), why: 'The report must say how much of the corpus stayed v1, or the arm cannot be described honestly.', fix: 'Return { rewritten, fallbacks: [{ line, why, src }] }.' });
    const orig4 = lines(HEFIX_ROWS[4].test), out4 = lines(r4.text);
    const fell = r4.fallbacks.every((f) => out4[f.line - 1] === orig4[f.line - 1] && /^\s*assert /.test(out4[f.line - 1]));
    check('a fallback line is the original text, byte for byte, and keeps its line number',
      fell && out4.length === orig4.length,
      { happened: r4.text, why: 'A fallback is the v1 assertion; anything else grades a different test.', fix: 'Copy the line through untouched.' });
    check('the row whose asserts all fall back is v1 text exactly',
      bench.humanEvalFixTask({ ...HEFIX_ROWS[4], test: HEFIX_ROWS[4].test.replace(/    assert double\(5\) == 10\n/, '') }, 'python', { exe, v2: true }).task.files['tests.py'] === HEFIX_ROWS[4].test.replace(/    assert double\(5\) == 10\n/, ''),
      { happened: 'differs', why: 'No helper without a rewrite.', fix: 'Prelude only when rewritten > 0.' });
    const total = HEFIX_ROWS.map((r) => v2of(r).v2);
    const rewritten = total.reduce((a, s) => a + s.rewritten, 0), fell2 = total.reduce((a, s) => a + s.fallbacks.length, 0);
    check('the fixture rows: 21 assertions rewritten, 9 fall back',
      rewritten === 21 && fell2 === 9,
      { happened: `${rewritten} rewritten, ${fell2} fell back`, why: 'The counts are what the PC will compare its 164-row run to.', fix: 'Review the shape rules if this moved.' });
    const bare = (s) => `def check(f):\n    assert ${s}\n`;
    const shapes = ['f(1) == 2 == 2', 'f(1) > 2', 'not f(1) == 2', 'f(1) == 2, "m"', 'abs(f(1) - 2 + 1) < 1e-3', 'abs(f(1)) < 1e-3', 'abs(f(1) - f(2)) < 1e-3', 'f(1) == f(2)', 'x == y', 'f', 'f(1) + f(2)', 'not not f(1)'];
    const rest = shapes.filter((s) => bench.rewriteHumanEvalFixTests(bare(s), 'f').rewritten !== 0);
    check('a dozen more shapes that could be mis-rewritten all stay v1',
      rest.length === 0,
      { happened: `rewritten: ${rest.join(' | ')}`, why: 'A chain, a sum next to the subtraction, or a call on both sides would report the wrong expected value.', fix: 'Fall back when the shape is not exactly one of the three.' });
    const unbal = bench.rewriteHumanEvalFixTests('def check(f):\n    assert f("(") == 1\n    x = (\n', 'f');
    check('tests that do not parse as balanced Python are passed through whole',
      unbal.rewritten === 0 && unbal.text === 'def check(f):\n    assert f("(") == 1\n    x = (\n' && unbal.fallbacks.length === 1,
      { happened: JSON.stringify(unbal), why: 'The scanner must never guess.', fix: 'Return the text untouched when a bracket or string does not close.' });
  });

  await asyncSuite('benchmark expert', 'HumanEvalFix v2 tasks: identity, no leak, python only', async () => {
    const built = HEFIX_ROWS.map(v2of);
    const v1 = HEFIX_ROWS.map((r) => bench.humanEvalFixTask(r, 'python', { exe }));
    check('v2 ids and kinds never collide with v1',
      built.every((b, i) => b.task.id === `humanevalfix-python-v2-${i}` && b.task.kind === 'humanevalfix-python-v2' && /HumanEvalFix v2/.test(b.task.name) && b.task.id !== v1[i].task.id),
      { happened: built.map((b) => b.task.id).join(' '), why: 'compare pairs by id; a v2 row named like a v1 row would replace the control.', fix: 'id = humanevalfix-python-v2-<n>.' });
    check('only tests.py differs from v1: the solution, the runner, the prompt, the check and the reference are identical',
      built.every((b, i) => b.task.files['solution.py'] === v1[i].task.files['solution.py'] && b.task.files['check.py'] === v1[i].task.files['check.py']
        && b.task.prompt === v1[i].task.prompt && JSON.stringify(b.task.check) === JSON.stringify(v1[i].task.check) && b.reference === v1[i].reference
        && JSON.stringify(b.task.protect) === JSON.stringify(v1[i].task.protect) && b.task.rounds === v1[i].task.rounds),
      { happened: 'a non-test field moved', why: 'v2 changes the check output and nothing else, so a difference in results is the check output.', fix: 'Touch only the tests file.' });
    const leaks = built.filter((b, i) => HEFIX_ROWS[i].canonical_solution.split('\n').map((l) => l.trim()).filter(Boolean)
      .some((l) => b.task.files['tests.py'].includes(l) && !v1[i].task.files['tests.py'].includes(l)));
    check('the fix does not reach the model: no canonical-solution line is in a v2 tests.py that v1 lacks, and the reference stays out of the task',
      leaks.length === 0 && built.every((b, i) => !JSON.stringify(b.task).includes(HEFIX_ROWS[i].canonical_solution.trim()) || JSON.stringify(v1[i].task).includes(HEFIX_ROWS[i].canonical_solution.trim())),
      { happened: leaks.map((b) => b.task.id).join(' '), why: 'The message may show the tests\' own expected value, never the solution.', fix: 'The rewrite reads only row.test.' });
    const js = bench.humanEvalFixTask(HEFIX_JS_ROW, 'js', { v2: true });
    const cr = bench.convertRows([HEFIX_JS_ROW], 'humanevalfix', path.join(W, 'js-v2'), { lang: 'js', v2: true, write: false });
    check('v2 for JavaScript is refused by name, in the task and in the converter',
      /no v2 for js/.test(js.error || '') && cr.ok === false && /Python HumanEvalFix mode/.test(cr.why),
      { happened: `${js.error} / ${cr.why}`, why: 'console.assert rewriting is not built; a silent v1 under a v2 name would corrupt the arm.', fix: 'Refuse v2 unless lang is python.' });
    const ci = bench.convertRows([], 'canitedit', path.join(W, 'ci'), { v2: true, write: false });
    check('v2 with CanItEdit is refused', ci.ok === false && /Python HumanEvalFix mode/.test(ci.why), { happened: ci.why, why: 'v2 is a HumanEvalFix mode.', fix: 'Check kind in convertRows.' });
  });

  if (!py.ok) {
    skip('HumanEvalFix v2: execute generated checks against a buggy and a fixed solution', `python3 is absent (${py.why})`);
    skip('HumanEvalFix v2: convertRows proves every fixture row', `python3 is absent (${py.why})`);
    return;
  }

  // What each fixture's first failing assertion prints against its buggy solution.
  const EXPECT = [
    'expected 1, got -1 for add(0, 1)',
    'expected a truthy value, got False for is_odd(3)',
    'expected 2.0 (within 1e-06), got 1.5 for mean([1, 2, 3])',
    'expected [3, 2, 1], got [1, 2, 3] for sort_desc( [3, 1, 2] )',
    null, // the first failing assert is a fallback: a bare AssertionError
    `expected 'x==y', got 'x=y' for join_eq("x", "y")`,
    'expected 3, got 2 for candidate(i)',
    /^expected \(\[0, 1, 2, .*\.\.\., got \(\[0, 1, 2, .*\.\.\. for span\(400\)$/,
    'expected 3, got 4 for clamp(5, 0, 3)',
    null, // x = 1; assert ident(x) == 1: a fallback
  ];
  const runIn = (built, solution, tag) => {
    const dir = path.join(W, `${tag}-${built.task.id}`);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    for (const [rel, body] of Object.entries({ ...built.task.files, [built.stubName]: solution })) fs.writeFileSync(path.join(dir, rel), body);
    const r = spawnSync(exe, [built.task.check[1]], { cwd: dir, encoding: 'utf8', timeout: 30000, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
    const err = String(r.stderr || '').trim().split(/\r?\n/);
    return { status: r.status, stdout: String(r.stdout || '').trim(), last: err[err.length - 1] || '', stderr: String(r.stderr || '') };
  };

  await asyncSuite('benchmark expert', 'HumanEvalFix v2 checks, executed: buggy prints expected and actual, fixed passes', async () => {
    const wrong = [];
    HEFIX_ROWS.forEach((row, i) => {
      const b = v2of(row);
      const bugged = runIn(b, b.task.files[b.stubName], 'bug');
      const fixed = runIn(b, b.reference, 'fix');
      const want = EXPECT[i];
      const msg = bugged.last.replace(/^AssertionError:?\s?/, '');
      const okMsg = want === null ? bugged.last === 'AssertionError' : want instanceof RegExp ? want.test(msg) : msg === want;
      if (bugged.status === 0 || !/^AssertionError/.test(bugged.last) || !okMsg) wrong.push(`${row.task_id} buggy: status ${bugged.status} last "${bugged.last}"`);
      if (fixed.status !== 0 || fixed.stdout !== 'all tests passed') wrong.push(`${row.task_id} fixed: status ${fixed.status} ${fixed.stdout} ${fixed.stderr.slice(-160)}`);
    });
    check('all ten fixture rows: the buggy solution fails with the expected message, the fixed one passes',
      wrong.length === 0,
      { happened: wrong.join('\n'), why: 'This is the whole point of v2, and a rewrite that fails the reference would refuse the row on the PC.', fix: 'Fix the rewrite or the helper.' });
    const one = v2of(HEFIX_ROWS[0]);
    const r = runIn(one, one.task.files[one.stubName], 'ex');
    check('the printed message is the documented one, from the traceback the model reads',
      r.last === 'AssertionError: expected 1, got -1 for add(0, 1)' && /tests\.py/.test(r.stderr),
      { happened: r.stderr.slice(-300), why: 'The example in the plan: expected 3, got 2 for f(1, 2).', fix: 'raise AssertionError("expected %s, got %s for %s").' });
    const v1 = bench.humanEvalFixTask(HEFIX_ROWS[0], 'python', { exe });
    const r1 = runIn(v1, v1.task.files[v1.stubName], 'v1');
    check('the same buggy solution under v1 prints a bare AssertionError (the control)',
      r1.status !== 0 && r1.last === 'AssertionError',
      { happened: r1.last, why: 'This is what v2 improves on and what the control arm sees.', fix: 'v1 must stay the original assert.' });
    const long = v2of(HEFIX_ROWS[7]);
    const rl = runIn(long, long.task.files[long.stubName], 'long');
    check('a long value is cut, so a huge list does not flood the model',
      rl.last.length < 900 && rl.last.includes('...'),
      { happened: `${rl.last.length} characters`, why: 'A 400-element list would cost more tokens than the message saves.', fix: '_hef_show cuts repr at 300 characters.' });
    const sol = 'def add(x, y):\n    raise ValueError("boom")\n';
    const re = runIn(one, sol, 'raise');
    check('a solution that raises reports its own exception, not an assertion',
      /^ValueError: boom$/.test(re.last),
      { happened: re.last, why: 'The rewrite must not swallow errors.', fix: 'The helper takes evaluated operands; nothing is caught.' });
  });

  await asyncSuite('benchmark expert', 'HumanEvalFix v2 converts and proves every fixture row', async () => {
    const outDir = path.join(W, 'converted-v2');
    const res = bench.convertRows(HEFIX_ROWS, 'humanevalfix', outDir, { lang: 'python', v2: true });
    check('all ten rows are proved (fail as shipped, pass with the reference) and written',
      res.ok && res.wrote.length === 10 && res.refused.length === 0 && fs.readdirSync(outDir).length === 10,
      { happened: JSON.stringify({ wrote: res.wrote.length, refused: res.refused }), why: 'proveTask is what keeps a bad rewrite off the corpus.', fix: 'Fix the rewrite for the refused row.' });
    check('the run counts the rewrites and the fallbacks by reason, and the report says so',
      res.v2 && res.v2.rewritten === 21 && res.v2.fallbacks === 9 && res.v2.byWhy['and/or'] === 1 && /v2: 21 assertion\(s\).*9 kept the v1 assertion/.test(bench.report(res)),
      { happened: `${JSON.stringify(res.v2)}\n${bench.report(res)}`, why: 'The PC needs the fallback count to describe the corpus.', fix: 'Aggregate built.v2 in convertRows and print it in report().' });
    const task = JSON.parse(fs.readFileSync(path.join(outDir, 'humanevalfix-python-v2-0.json'), 'utf8'));
    check('the written task file is the task and carries no rewrite bookkeeping',
      task.id === 'humanevalfix-python-v2-0' && !('v2' in task) && task.files['tests.py'].includes('_hef_eq("add(1, 2)"'),
      { happened: Object.keys(task).join(','), why: 'The corpus format is unchanged.', fix: 'Write built.task only.' });
    const v1res = bench.convertRows(HEFIX_ROWS, 'humanevalfix', path.join(W, 'converted-v1'), { lang: 'python' });
    check('v1 conversion reports no v2 line and writes the v1 ids',
      v1res.wrote.length === 10 && v1res.wrote[0] === 'humanevalfix-python-0' && !('v2' in v1res) && !/v2:/.test(bench.report(v1res)),
      { happened: `${v1res.wrote[0]} ${bench.report(v1res)}`, why: 'v1 output must not change.', fix: 'v2 stats only under v2.' });
    const echo = async () => ({ content: 'echo: no work done' });
    const fail = await evals.runTask(task, { chat: echo, state: {}, stamp: `hv2-${Date.now()}` });
    check('an eval run of a v2 task shows the model the message, and only for a real failure',
      fail.pass === false && /expected 1, got -1 for add\(0, 1\)/.test(fail.output),
      { happened: `${fail.pass} ${fail.why} ${fail.output}`, why: 'What the model reads in its check output is the v2 change.', fix: 'The helper raises with the values.' });
    const solved = await evals.runTask({ ...task, files: { ...task.files, 'solution.py': HEFIX_ROWS[0].declaration + HEFIX_ROWS[0].canonical_solution } }, { chat: echo, state: {}, stamp: `hv2s-${Date.now()}` });
    check('the same v2 task passes with the canonical solution in place', solved.pass === true, { happened: `${solved.why} ${solved.output}`, why: 'v2 passes iff v1 passes.', fix: 'Helpers must compare exactly as the assert did.' });
  });
}
