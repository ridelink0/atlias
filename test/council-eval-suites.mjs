import { runTask } from '../lib/eval.mjs';

// Real workspace/check integration with scripted chats; no provider calls.
export default async function register({ asyncSuite, check, TMP, fs, path }) {
  const blk = obj => '```atlias\n' + JSON.stringify(obj) + '\n```';
  let stamp = 0;
  const task = () => ({ id: 'council-eval', prompt: 'Make two() return 2; preserve the tests.', rounds: 4,
    files: { 'package.json': '{"type":"module"}', 'sum.js': 'export const two = () => 1;',
      'test.mjs': "import {two} from './sum.js'; process.exit(two() === 2 ? 0 : 1);" },
    hidden: { 'hidden.mjs': "import {two} from './sum.js'; process.exit(two() === 2 ? 0 : 1);" },
    protect: ['test.mjs', 'package.json'], check: ['node', 'hidden.mjs'],
  });
  const exercise = async (scripts, { on = true, keep = false, engine = 'codex', change = t => t, missingUsage = false, cleanupFail = null, direct = false, failAttempt = -1 } = {}) => {
    const work = path.join(TMP, `council-eval-${++stamp}`); fs.mkdirSync(work);
    const t = change(task()); let attempt = -1, turn = 0, calls = 0;
    const starts = []; let hiddenAbsent = true;
    const chat = async messages => {
      if (!messages.some(m => m.role === 'assistant')) { attempt++; turn = 0; starts.push(messages.filter(m => m.role === 'user').map(m => m.content)); }
      for (const name of fs.readdirSync(work)) if (fs.existsSync(path.join(work, name, 'hidden.mjs'))) hiddenAbsent = false;
      const script = scripts[Math.min(attempt, scripts.length - 1)];
      calls++;
      if (attempt === failAttempt) throw new Error('fixture provider failed');
      const content = turn++ === 0 ? (direct ? '### sum.js\n```javascript\n' + script.content + '\n```' : blk(script)) : 'The edit is complete.';
      return { content, ...(missingUsage && attempt === 1 && (missingUsage === true || turn === 2) ? {} : { usage: { prompt_tokens: 100, completion_tokens: 10, prompt_tokens_details: { cached_tokens: 20 } } }) };
    };
    const before = process.env.ATLIAS_FLAG_COUNCIL;
    const remove = fs.rmSync;
    if (cleanupFail !== null) fs.rmSync = (target, opts) => {
      if (String(target).startsWith(work) && opts?.recursive && (cleanupFail === 'winner' ? fs.existsSync(path.join(target,'hidden.mjs')) : String(target).endsWith(`-c${cleanupFail}`))) throw new Error('fixture workspace locked');
      return remove(target, opts);
    };
    process.env.ATLIAS_FLAG_COUNCIL = on ? '1' : '0';
    let row;
    try { row = await runTask(t, { chat, state: { engine }, stamp: `council-${stamp}`, work, keep, reap: false, direct }); }
    finally { fs.rmSync = remove; if (before === undefined) delete process.env.ATLIAS_FLAG_COUNCIL; else process.env.ATLIAS_FLAG_COUNCIL = before; }
    return { row, work, calls, starts, hiddenAbsent, task: t, dirs: fs.readdirSync(work) };
  };
  const write = n => ({ tool: 'write_file', path: 'sum.js', content: `export const two = () => ${n};` });

  await asyncSuite('council eval expert', 'council recovery uses fresh sequential attempts and records every cost', async () => {
    for (const engine of ['codex', 'claude']) {
      const r = await exercise([write(1), write(2), write(3)], { engine });
      check(`${engine}: first retry wins, later retry never runs`, r.row.pass && r.row.council?.chosen === 1 && r.row.council.ran === 1 && r.calls === 6 && r.starts.length === 2,
        { happened: JSON.stringify(r.row), why: 'Stop on the first verified candidate and spend no third attempt.', fix: 'Use fresh sequential candidates before hidden grading.' });
      check(`${engine}: fresh prompt, no failure feedback, hidden graders absent`, r.hiddenAbsent && r.starts.every(xs => xs.length === 1 && xs[0] === r.task.prompt),
        { happened: JSON.stringify(r.starts), why: 'Resampling must not receive grader data or the previous conversation.', fix: 'Reset state and delay hidden file injection.' });
      check(`${engine}: all rounds, tokens and edit costs count`, r.row.rounds === 6 && r.row.promptTotal === 600 && r.row.outputTotal === 60 && r.row.cachedTotal === 120 && r.row.editTries === 2
        && r.row.chars === r.row.council.candidates.reduce((n,c) => n + c.chars,0) && r.dirs.length === 0,
        { happened: JSON.stringify(r.row), why: 'Keeping only winner cost would make retries look artificially cheap.', fix: 'Aggregate every attempted state and remove non-winning workspaces.' });
    }
  });
  await asyncSuite('council eval expert', 'council rejects a changed selector and grades only the selected workspace', async () => {
    const tam = await exercise([write(1), { tool: 'write_file', path: 'test.mjs', content: 'process.exit(0);' }, write(2)], { change: t => ({ ...t, protect: ['package.json'] }) });
    check('a tampered visible pass loses; second fresh retry wins', tam.row.pass && tam.row.council?.chosen === 2 && tam.row.council.ran === 2 && tam.row.council.candidates[1].tampered && tam.row.council.candidates[1].visiblePass,
      { happened: JSON.stringify(tam.row), why: 'The selector must be the seeded test even if task.protect names another grader.', fix: 'Pin the seeded visible check and compare its bytes as well as protected files.' });
    const hidden = await exercise([write(1), write(2), write(3)], { change: t => ({ ...t, hidden: { 'hidden.mjs': "import {two} from './sum.js'; process.exit(two() === 3 ? 0 : 1);" } }) });
    check('a visible winner still fails the hidden grader; no hidden-feedback retry', !hidden.row.pass && hidden.row.council?.chosen === 1 && hidden.calls === 6 && hidden.hiddenAbsent,
      { happened: JSON.stringify(hidden.row), why: 'Visible recovery is not the final grade and must not exploit hidden tests.', fix: 'Run the protected hidden score only after selection.' });
  });
  await asyncSuite('council eval expert', 'council keeps the original when none wins and respects keep', async () => {
    const none = await exercise([write(1), write(4), write(5)]);
    check('both retries fail, original is graded and retry workspaces are removed', !none.row.pass && none.row.council?.chosen === null && none.row.council.ran === 2 && none.dirs.length === 1
      && /=> 1/.test(fs.readFileSync(path.join(none.row.workspace,'sum.js'),'utf8')) && none.row.promptTotal === 900,
      { happened: JSON.stringify(none.row), why: 'Failure must preserve the original result and every retry cost.', fix: 'Select only a valid winner; clean losers.' });
    const kept = await exercise([write(1), write(4), write(2)], { keep: true });
    check('keep retains all workspaces; only the winner receives hidden files', kept.row.pass && kept.row.council.chosen === 2 && kept.dirs.length === 3
      && kept.dirs.filter(d => fs.existsSync(path.join(kept.work,d,'hidden.mjs'))).length === 1,
      { happened: JSON.stringify({ row: kept.row, dirs: kept.dirs }), why: 'Kept artifacts should explain every attempt without leaking graders during selection.', fix: 'Keep non-winners only when requested and inject hidden files once.' });
  });
  await asyncSuite('council eval expert', 'council does nothing without a failing seeded selector', async () => {
    const off = await exercise([write(1),write(2)], { on: false });
    const firstPass = await exercise([write(2),write(1)]);
    const absent = await exercise([write(1),write(2)], { change: t => { delete t.files['test.mjs']; return t; } });
    const added = await exercise([{ tool:'write_file',path:'test.mjs',content:'process.exit(1);' },write(2)], { change: t => { delete t.files['test.mjs']; return t; } });
    check('flag off, passing first, absent and model-created selectors spend no retry', [off,firstPass,absent,added].every(r => !r.row.council && r.calls === 3) && !off.row.pass && firstPass.row.pass,
      { happened: JSON.stringify([off,firstPass,absent,added].map(r=>({calls:r.calls,council:r.row.council,pass:r.row.pass}))), why: 'No authentic failed visible check means there is no selection signal.', fix: 'Pin only a seeded selector before any model call.' });
    const unknown = await exercise([write(1),write(2)], { missingUsage: 'partial' });
    check('an unreported retry cost stays unknown instead of becoming a saving', unknown.row.pass && unknown.row.promptTotal === null && unknown.row.outputTotal === null && unknown.row.council.candidates[1].promptTotal === null,
      { happened: JSON.stringify(unknown.row), why: 'Recorded cost from only one attempt is not total cost.', fix: 'Propagate missing counters across the council total.' });
  });
  await asyncSuite('council eval expert', 'an unfinished visible selector cannot spend a council retry', async () => {
    const timeout = await exercise([write(1),write(2)], { change: t => ({ ...t, timeoutMs: 5000,
      files: { ...t.files, 'test.mjs': 'setTimeout(() => process.exit(1), 6500);' } }) });
    check('the real visible-check timeout is unfinished and makes no extra chat call', !timeout.row.council && timeout.calls === 3 && timeout.starts.length === 1,
      { happened: JSON.stringify(timeout.row), why: 'A timeout gives no signal to choose a fresh solution.', fix: 'Convene only on the explicit failed outcome.' });
  });
  await asyncSuite('council eval expert', 'workspace cleanup errors remain visible without losing the selected grade', async () => {
    const loser = await exercise([write(1),write(4),write(2)], { cleanupFail: 1 });
    const winner = await exercise([write(1),write(2)], { cleanupFail: 'winner' });
    check('a locked loser is reported and the valid selected candidate is still graded', loser.row.pass && loser.row.council.chosen === 2 && loser.row.council.cleanupErrors?.[0].i === 1 && loser.dirs.length === 1,
      { happened: JSON.stringify(loser.row), why: 'Cleanup failure must neither erase the grade nor pretend every workspace disappeared.', fix: 'Record disposal failures alongside selection.' });
    check('a locked winning workspace retains its path and cleanup reason', winner.row.pass && winner.row.workspace && fs.existsSync(winner.row.workspace) && winner.row.council.cleanupErrors?.some(e=>e.step==='winner'),
      { happened: JSON.stringify(winner.row), why: 'A retained artifact cannot be reported as a removed workspace.', fix: 'Return the actual remaining path when winner cleanup fails.' });
  });
  await asyncSuite('council eval expert', 'direct attempts and failed provider calls keep honest council totals', async () => {
    const direct = await exercise([write(1), write(2), write(3)], { direct: true });
    check('direct recovery counts both whole-file calls and keeps fresh hidden-free prompts', direct.row.pass && direct.row.council?.chosen === 1 && direct.calls === 2
      && direct.row.rounds === 2 && direct.row.promptTotal === 200 && direct.row.outputTotal === 20 && direct.row.editTries === 2
      && direct.starts.length === 2 && JSON.stringify(direct.starts[0]) === JSON.stringify(direct.starts[1]) && direct.hiddenAbsent && direct.dirs.length === 0,
      { happened: JSON.stringify(direct.row), why: 'The direct arm must count the original as well as the selected fresh attempt.', fix: 'Use the same direct runner for each candidate and sum every attempt.' });
    const failed = await exercise([write(1), write(4), write(2)], { failAttempt: 1 });
    check('a provider failure cannot win or manufacture a known total cost', failed.row.pass && failed.row.council?.chosen === 2 && failed.row.council.ran === 2
      && failed.row.council.candidates[1].visiblePass === false && failed.row.council.candidates[1].promptTotal === null
      && failed.row.promptTotal === null && failed.row.outputTotal === null && failed.row.cachedTotal === null && failed.dirs.length === 0,
      { happened: JSON.stringify(failed.row), why: 'A failed call gives neither a verified candidate nor a measured token total.', fix: 'Retain its failed attempt and propagate unknown cost while grading the valid winner.' });
  });
}
