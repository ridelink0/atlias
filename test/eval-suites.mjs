// The eval harness, checked against a scripted model so the result is the
// same on every machine. What these prove is not that a model is clever: it is
// that the scoreboard cannot be talked into a pass.
import fs from 'node:fs';
import path from 'node:path';
import * as evals from '../lib/eval.mjs';
import * as agentMod from '../lib/agent.mjs';

const NL = String.fromCharCode(10);
const blk = (obj) => '```atlias' + NL + JSON.stringify(obj) + NL + '```';
// A scripted model: each call returns the next reply in the list.
const scripted = (replies) => {
  let i = 0;
  return async () => ({ content: replies[Math.min(i++, replies.length - 1)] });
};

const FIX = {
  id: 'eval-selftest',
  name: 'a one-line fix',
  files: {
    'sum.js': 'export function two() { return 1; }' + NL,
    'test.mjs': "import { two } from './sum.js';" + NL + 'process.exit(two() === 2 ? 0 : 1);' + NL,
  },
  prompt: 'Make node test.mjs pass.',
  check: ['node', 'test.mjs'],
};

export default function register({ asyncSuite, check }) {
  asyncSuite('harness scoreboard expert', 'a task is scored by the check, not the claim', async () => {
    const state = agentMod.newState(process.cwd(), 'echo');

    // 1. A model that does the work passes.
    const good = await evals.runTask(FIX, {
      state,
      chat: scripted([
        blk({ tool: 'write_file', path: 'sum.js', content: 'export function two() { return 2; }' + NL }),
        'Fixed it.',
      ]),
    });
    check('a task the model really fixes passes', good.pass, { happened: `${good.pass} - ${good.why}`, why: 'If a correct run cannot pass, the scoreboard is useless and every later number is noise.', fix: 'Check score() and the task check command.' });

    // 2. A model that only says it fixed it fails. This is the whole point.
    const liar = await evals.runTask(FIX, { state, chat: scripted(['Done. The test passes now.']) });
    check('a claim with no work behind it fails', !liar.pass, { happened: `${liar.pass} - ${liar.why}`, why: 'Every benchmark that trusts the model own word measures confidence, not work.', fix: 'score() must read the check exit code and nothing else.' });
    check('and the failure says what the check did', /exited [0-9]/.test(liar.why), { happened: liar.why, why: 'A failure nobody can read is a failure nobody fixes.', fix: 'Keep the exit code in why.' });

    // 3. A failed run keeps its workspace so the failure can be looked at.
    check('a failed task keeps its workspace', Boolean(liar.workspace) && fs.existsSync(liar.workspace), { happened: String(liar.workspace), why: 'The first question after a failure is what the files actually looked like.', fix: 'Only remove the workspace on a pass.' });
    try { fs.rmSync(liar.workspace, { recursive: true, force: true }); } catch { /* best effort */ }

    // 4. A check that cannot run at all is a failure, never a pass.
    const broken = await evals.runTask({ ...FIX, id: 'eval-selftest-nocheck', check: ['definitely-not-a-program-xyz'] }, { state, chat: scripted(['nothing to do']) });
    check('a check that cannot run is a failure', !broken.pass, { happened: `${broken.pass} - ${broken.why}`, why: 'A missing checker silently passing everything is the worst possible failure of a scoreboard.', fix: 'run() returning no status must score false.' });
    try { fs.rmSync(broken.workspace, { recursive: true, force: true }); } catch { /* best effort */ }

    // 5. The task files on disk are what the task said they were.
    const dir = evals.makeWorkspace(FIX, 'shape');
    check('the workspace is built from the task', fs.readFileSync(path.join(dir, 'sum.js'), 'utf8').includes('return 1'), { happened: 'the seeded file was wrong', why: 'A task that starts from the wrong files measures nothing.', fix: 'Check makeWorkspace.' });
    check('and it is not the project being measured', !dir.startsWith(process.cwd()), { happened: dir, why: 'An eval that edits the repo it is testing corrupts the thing it measures.', fix: 'Workspaces live under the state directory.' });
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }

    // 6. The shipped corpus loads and every task can be scored.
    const tasks = evals.loadTasks();
    check('the shipped tasks load', tasks.length >= 3, { happened: `${tasks.length} tasks`, why: 'A suite with no tasks reports a perfect score.', fix: 'Check evals/*.json.' });
    check('every shipped task names a check and a prompt', tasks.every((t) => t.prompt && t.check && t.files), { happened: tasks.map((t) => t.id).join(','), why: 'A task without a check cannot fail, so it cannot mean anything.', fix: 'Each evals/*.json needs files, prompt and check.' });
    // The corpus must start failing, or fixing nothing would score a pass.
    const starts = tasks.map((t) => {
      const d = evals.makeWorkspace(t, 'start');
      const s = evals.score(d, t);
      try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
      return s.pass;
    });
    check('every shipped task fails before the work is done', starts.every((p) => p === false), { happened: tasks.map((t, i) => `${t.id}:${starts[i] ? 'passes' : 'fails'}`).join(' '), why: 'A task that already passes measures nothing and quietly inflates the score.', fix: 'Seed the workspace with the bug, not the fix.' });

    // 7. A whole suite counts what happened, and the report says it plainly.
    // One script per task: a shared one would hand the second task the first
    // task's leftovers, which is a flaw in the test, not in the runner.
    let step = 0;
    const perTask = async () => ({ content: step++ % 2 === 0 ? blk({ tool: 'write_file', path: 'sum.js', content: 'export function two() { return 2; }' + NL }) : 'done' });
    const suite = await evals.runSuite([FIX, { ...FIX, id: 'eval-selftest-2' }], { state, chat: perTask });
    check('a suite counts the passes, not the attempts', suite.total === 2 && suite.passed === 2, { happened: `${suite.passed}/${suite.total}`, why: 'The score is the only output anybody reads; if the arithmetic is wrong nothing else matters.', fix: 'Check runSuite.' });

    const text = evals.format({ results: [{ name: 'a', pass: true, rounds: 2, ms: 1000 }, { name: 'b', pass: false, why: 'the check exited 1', output: 'boom', rounds: 3, ms: 2000, workspace: 'D:/w' }], passed: 1, total: 2, ms: 3000 });
    check('the report names the failure and where to look', /FAIL {2}b/.test(text) && text.includes('the check exited 1') && text.includes('D:/w') && text.includes('1/2 tasks finished'), { happened: text.slice(0, 160), why: 'A score with no way back to the failure is a number nobody can act on.', fix: 'Check format().' });
    check('and a clean sweep says nothing about failures', !/A failure here/.test(evals.format({ results: [{ name: 'a', pass: true, rounds: 1, ms: 10 }], passed: 1, total: 1, ms: 10 })), { happened: 'the failure note appeared on a perfect run', why: 'Boilerplate that is always there stops being read.', fix: 'Only add the note when something failed.' });
  });
}
