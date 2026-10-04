// Round six, NEXTGEN-5 row 7: HumanEvalFix v2, a check that prints what a failed
// assert compared. v1's runner must stay byte for byte what the main tier's
// corpus was built with, and v2 must fail and pass exactly where v1 does.
// Loaded by test/run.mjs.
import { spawnSync } from 'node:child_process';
import * as bench from '../lib/editbench.mjs';
import * as tiers from '../lib/tiers.mjs';

export default async function explainSuites({ suite, check, skip, TMP, fs, path }) {
  const NL = String.fromCharCode(10);
  suite('hefix v2', 'v1 is unchanged and v2 is opt-in', () => {
    const v1 = bench.pythonRunner('solution.py', 'tests.py');
    check('without explain the runner is v1: the joined-source exec and nothing that rewrites asserts', v1 === bench.pythonRunner('solution.py', 'tests.py', { explain: false }) && v1.split(NL).length === 11 && v1.includes('exec(compile(src, "solution.py + tests.py", "exec"), mod.__dict__)') && !/Explain|atlias_cmp|import ast/.test(v1),
      { happened: v1.slice(0, 300), why: 'The main tier\'s 164 tasks and every baseline run used this runner; v2 is a separate corpus, not a change to v1.', fix: 'pythonRunner: explain defaults to false and returns the v1 lines untouched.' });
    const t = tiers.TIERS.hefix2;
    check('the hefix2 tier names the v2 corpus and how to regenerate it', t && t.dirs[0] === 'evals/humanevalfix/python-v2' && t.expect === 164 && /--explain/.test(t.regenerate.join(' ')),
      { happened: JSON.stringify(t || null).slice(0, 300), why: 'Row 7 runs atlias three times on v2 against the main tier\'s v1 rows.', fix: 'TIERS.hefix2 in lib/tiers.mjs.' });
  });

  const py = spawnSync('python', ['--version'], { encoding: 'utf8' });
  if (py.status !== 0) { skip('hefix v2', 'the v2 check explains a failure', 'no python on PATH'); return; }
  suite('hefix v2', 'the v2 check explains a failure', () => {
    let n = 0;
    const runTask = (solution, tests) => {
      const d = path.join(TMP, 'hefix-v2', `t${++n}`);
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, 'solution.py'), solution);
      fs.writeFileSync(path.join(d, 'tests.py'), tests);
      fs.writeFileSync(path.join(d, 'check.py'), bench.pythonRunner('solution.py', 'tests.py', { explain: true }));
      const r = spawnSync('python', ['check.py'], { cwd: d, encoding: 'utf8' });
      return { status: r.status, out: String(r.stdout || ''), err: String(r.stderr || '') };
    };
    // The program is two lines and a newline, so in the joined module (program,
    // a blank line, tests) the tests start at line 5 and this assert is line 6.
    const tests = ['def check(candidate):', '    assert candidate(1, 2) == 3', '    assert candidate(2, 2) > 3, "four"', '    assert candidate(0, 0) == 0', 'check(add)', ''].join(NL);
    const buggy = runTask(['def add(a, b):', '    return a - b', ''].join(NL), tests);
    check('a failed == says expected and got, and points at the tests\' line in the joined module', buggy.status === 1 && /assert candidate\(1, 2\) == 3: expected 3, got -1/.test(buggy.err) && /solution\.py \+ tests\.py", line 6, in check/.test(buggy.err),
      { happened: buggy.err.slice(-400), why: 'Row 7: a bare AssertionError is the hardest failure for a 7B to repair; the v2 check says what came back.', fix: 'explainRunner in lib/editbench.mjs.' });
    const half = runTask(['def add(a, b):', '    return 2 if a == 2 else a + b', ''].join(NL), tests);
    check('another comparison names both sides and keeps the assert\'s own message', half.status === 1 && /assert candidate\(2, 2\) > 3: left side 2, right side 3 \(four\)/.test(half.err),
      { happened: half.err.slice(-300), why: 'Only == reads as expected/got; the rest name both sides.', fix: 'atlias_cmp.' });
    const truthy = runTask(['def ok():', '    return []', ''].join(NL), ['assert ok()', ''].join(NL));
    check('an assert that is not a comparison says what the value was', truthy.status === 1 && /assert ok\(\): the value was \[\]/.test(truthy.err),
      { happened: truthy.err.slice(-300), why: 'Every assert explains itself, not only comparisons.', fix: 'atlias_truth.' });
    const fixed = runTask(['def add(a, b):', '    return a + b', ''].join(NL), tests);
    check('a correct program passes v2 exactly as it would pass v1', fixed.status === 0 && /all tests passed/.test(fixed.out),
      { happened: `${fixed.status} ${fixed.out} ${fixed.err.slice(-200)}`, why: 'v2 must change what a failure says, never whether a task passes.', fix: 'The rewrite evaluates the same expressions in the same order.' });
    const lazy = runTask('def ok():\n    return True\n', 'assert ok() == True, 1 / 0\nassert ok(), 1 / 0\n');
    check('a passing assert never evaluates its message', lazy.status === 0,
      { happened: lazy.err.slice(-300), why: 'Python evaluates an assertion message only on failure; evaluating it eagerly can fail a correct solution.', fix: 'Pass the message as a lambda and invoke it only after the assertion fails.' });
  });
}
