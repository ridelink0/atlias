// Round six, NEXTGEN-5 row 6: the direct arm (atlias eval --direct). One prompt,
// whole files back, the visible check, at most one repair, then the loop's own
// grading. Driven by scripted models. Loaded by test/run.mjs.
import { spawnSync } from 'node:child_process';
import * as direct from '../lib/direct.mjs';
import * as evals from '../lib/eval.mjs';
import * as bench from '../lib/editbench.mjs';

export default async function directSuites({ suite, asyncSuite, check, skip }) {
  const NL = String.fromCharCode(10);
  const F = '`'.repeat(3);
  const block = (lang, body) => [F + lang, body, F].join(NL);

  suite('direct arm', 'reading the files a reply sends', () => {
    const ed = ['solution.py'];
    const all = ['solution.py', 'tests.py', 'check.py'];
    const heading = direct.parseFiles(['Here you go.', '### solution.py', block('python', 'def f():' + NL + '    return 1')].join(NL), ed, all);
    const info = direct.parseFiles(block('python path=solution.py', 'x = 2'), ed, all);
    const bare = direct.parseFiles(['I fixed it, e.g. the sign.', block('python', 'x = 3')].join(NL), ed, all);
    const twice = direct.parseFiles([block('python', 'x = 4'), 'Better:', block('python', 'x = 5')].join(NL), ed, all);
    const prot = direct.parseFiles(['### tests.py', block('python', 'assert True'), '### solution.py', block('python', 'x = 6')].join(NL), ed, all);
    const none = direct.parseFiles('I would change the sign.', ed, all);
    check('a heading, an info string, a lone block for the one editable file, and the last block wins; "e.g." is no file name', heading.files.get('solution.py') === 'def f():' + NL + '    return 1' + NL && info.files.get('solution.py') === 'x = 2' + NL && bare.files.get('solution.py') === 'x = 3' + NL && bare.refused.length === 0 && twice.files.get('solution.py') === 'x = 5' + NL,
      { happened: JSON.stringify([...heading.files, ...info.files, ...bare.files, ...twice.files, bare.refused]), why: 'A 7B answers in whichever of these shapes it likes; each must land on the file it meant.', fix: 'parseFiles in lib/direct.mjs.' });
    check('a block for a protected file is refused and not written; a reply with no block has no file', prot.files.size === 1 && prot.files.get('solution.py') === 'x = 6' + NL && prot.refused.join() === 'tests.py' && none.files.size === 0,
      { happened: JSON.stringify({ prot: [...prot.files], refused: prot.refused, none: none.files.size }), why: 'The grader files decide the task; the direct arm must not let a reply rewrite them.', fix: 'parseFiles: only editable files are kept.' });
  });

  suite('direct arm', 'the prompt and the visible check', () => {
    const hefix = { prompt: 'Fix add.', files: { 'solution.py': 'x', 'tests.py': 'y', 'check.py': 'z' }, protect: ['tests.py', 'check.py'], check: ['C:\\Python\\python.exe', 'check.py'] };
    const cie = { prompt: 'Edit main.py.', files: { 'main.py': 'x' }, protect: [], hidden: { 'canitedit_check.py': 'a', 'canitedit_tests.py': 'b' }, check: ['python', 'canitedit_check.py'] };
    const p = direct.directPrompt(hefix);
    check('HumanEvalFix\'s check is visible, CanItEdit\'s hidden one is not; the prompt shows every shipped file and names what may change', direct.visibleCheck(hefix) === 'python check.py' && direct.visibleCheck(cie) === null && /### tests\.py/.test(p) && /### check\.py/.test(p) && /You may change only: solution\.py\./.test(p) && /this check runs: python check\.py/.test(p) && !/canitedit_tests/.test(direct.directPrompt(cie)),
      { happened: p.slice(0, 400), why: 'Row 6 is one prompt with the files and the visible check; CanItEdit\'s tests stay hidden as upstream.', fix: 'visibleCheck and directPrompt in lib/direct.mjs.' });
    check('editableFiles is every shipped file the task does not protect', direct.editableFiles(hefix).join() === 'solution.py' && direct.editableFiles(cie).join() === 'main.py',
      { happened: JSON.stringify([direct.editableFiles(hefix), direct.editableFiles(cie)]), why: 'What the prompt says may change and what parseFiles keeps are the same list.', fix: 'editableFiles in lib/direct.mjs.' });
  });

  await asyncSuite('direct arm', 'a model that fails is a model error, asked once', async () => {
    const st = { promptLog: [], cacheLog: [], outLog: [], childPids: [], editTries: 0 };
    let calls = 0;
    const reply = await direct.runDirect(st, { prompt: 'Fix it.', files: { 'a.py': 'x = 1' }, check: ['python', 'a.py'] }, { chat: async () => { calls++; return { error: 'connection refused' }; }, dir: '.', check: () => ({ pass: true }) });
    check('runDirect stops on a failed call with model-error, after one call, having written nothing', reply === '' && calls === 1 && st.stop.reason === 'model-error' && /connection refused/.test(st.stop.detail) && st.direct.wrote.length === 0 && st.editTries === 0,
      { happened: JSON.stringify({ reply, calls, stop: st.stop, direct: st.direct }), why: 'A down server is not a wrong answer: the row must say model-error, as the loop does.', fix: 'runDirect: st.stop on res.error.' });
  });

  const py = spawnSync('python', ['--version'], { encoding: 'utf8' });
  if (py.status !== 0) { skip('direct arm', 'a direct run is graded like the loop', 'no python on PATH'); return; }
  await asyncSuite('direct arm', 'a direct run is graded like the loop', async () => {
    const task = (id) => ({
      id, kind: 'humanevalfix-python', name: id, rounds: 14, protect: ['tests.py', 'check.py'],
      files: { 'solution.py': 'def add(a, b):' + NL + '    return a - b' + NL, 'tests.py': 'assert add(1, 2) == 3' + NL, 'check.py': bench.pythonRunner('solution.py', 'tests.py') },
      prompt: 'Fix the bug in add in solution.py. Run: python check.py.', check: ['python', 'check.py'], timeoutMs: 60000,
    });
    const scripted = (replies) => { const q = [...replies]; return async () => ({ content: q.shift() || 'nothing', usage: { prompt_eval_count: 100, eval_count: 20 } }); };
    const wrong = ['### solution.py', block('python', 'def add(a, b):' + NL + '    return a * b')].join(NL);
    const right = ['### solution.py', block('python', 'def add(a, b):' + NL + '    return a + b')].join(NL);
    const first = await evals.runTask(task('d1'), { chat: scripted([right]), direct: true, reap: false });
    const repaired = await evals.runTask(task('d2'), { chat: scripted([wrong, right]), direct: true, reap: false });
    const failed = await evals.runTask(task('d3'), { chat: scripted([wrong, wrong]), direct: true, reap: false });
    check('right first time: one call, passed; wrong then right: the one repair passes; wrong twice: two calls and a fail, no third', first.pass && first.direct.calls === 1 && !first.direct.repaired && repaired.pass && repaired.direct.calls === 2 && repaired.direct.repaired && !failed.pass && failed.direct.calls === 2 && failed.rounds === 2,
      { happened: JSON.stringify([first, repaired, failed].map((r) => ({ pass: r.pass, direct: r.direct, rounds: r.rounds, stop: r.stop, why: r.why }))).slice(0, 600), why: 'Row 6: at most one repair, and the loop\'s grading decides.', fix: 'runDirect in lib/direct.mjs, runTask in lib/eval.mjs.' });
    const cheat = await evals.runTask(task('d4'), { chat: scripted([['### tests.py', block('python', 'assert True'), '### solution.py', block('python', 'def add(a, b):' + NL + '    return 0')].join(NL), wrong]), direct: true, reap: false });
    check('a reply that rewrites tests.py does not reach the file, and the task still fails on its real tests', !cheat.pass && cheat.direct.refused.includes('tests.py') && !/tampered|was changed by the run/.test(cheat.why),
      { happened: JSON.stringify({ pass: cheat.pass, why: cheat.why, direct: cheat.direct }).slice(0, 400), why: 'A direct arm that let a reply replace the grader would score cheats.', fix: 'parseFiles refuses protected files.' });
    const hidden = { id: 'd5', kind: 'canitedit-lazy', name: 'd5', rounds: 12, protect: [], files: { 'main.py': 'def sub(a, b):' + NL + '    return a + b' + NL }, hidden: { 'canitedit_tests.py': 'assert sub(3, 1) == 2' + NL, 'canitedit_check.py': bench.pythonRunner('main.py', 'canitedit_tests.py') }, prompt: 'Edit main.py so sub subtracts.', check: ['python', 'canitedit_check.py'], timeoutMs: 60000 };
    const cie = await evals.runTask(hidden, { chat: scripted([['### main.py', block('python', 'def sub(a, b):' + NL + '    return a - b')].join(NL), 'never asked']), direct: true, reap: false });
    check('with the check hidden there is one call and no repair, and the hidden tests grade it', cie.pass && cie.direct.calls === 1 && !cie.direct.repaired,
      { happened: JSON.stringify({ pass: cie.pass, why: cie.why, direct: cie.direct }), why: 'CanItEdit hides its tests upstream; the direct arm cannot run them before grading.', fix: 'visibleCheck returns null for a hidden check script.' });
    const rep = await evals.runSuite([task('d6')], { chat: scripted([right]), direct: true, reap: false, stamp: false });
    check('the report says it is the direct arm, and a loop report does not', rep.direct === true && /direct arm/.test(evals.format(rep)) && rep.passed === 1,
      { happened: JSON.stringify({ direct: rep.direct, passed: rep.passed }), why: 'A direct run and a loop run are two arms; the saved report must say which it is, and --resume refuses to mix them.', fix: 'runSuite report and format() in lib/eval.mjs.' });
  });
}
