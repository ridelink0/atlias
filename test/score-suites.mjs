// The public score package (docs/NEXTGEN-5.md ranked-plan row 3, cloud part):
// `atlias score pack` and `atlias score verify`. The reports are small JSON
// fixtures in runSuite's shape, over a corpus written into the temp folder, so
// no model runs. The statistics are checked against hand-computed values, not
// against the code that produces them.
import * as evals from '../lib/eval.mjs';
import * as score from '../lib/score.mjs';

export default async function scoreSuites({ asyncSuite, check, ROOT, TMP, fs, path, spawnSync }) {
  const base = path.join(TMP, 'score');
  const corpusDir = path.join(base, 'corpus');
  fs.mkdirSync(corpusDir, { recursive: true });
  const ids = ['t1', 't2', 't3', 't4', 't5', 't6', 't7'];
  for (const id of ids) {
    fs.writeFileSync(path.join(corpusDir, `${id}.json`), JSON.stringify({
      id, name: id, prompt: `fix ${id}`, check: ['node', 'test.mjs'],
      files: { 'sum.js': `export const ${id} = 1;\n`, 'test.mjs': `process.exit(0); // ${id}\n` },
    }, null, 1));
  }
  // Arm a solves t1 and t2; arm b solves t1 and t3..t7. Five tasks gained, one
  // lost (t2), one solved by both, none by neither: six discordant tasks, and
  // the exact two-sided p is 2 x (C(6,0) + C(6,1)) / 2^6 = 14/64 = 0.21875.
  const report = (passing, extra = {}) => ({
    tries: 1, total: ids.length, passed: passing.length, engine: 'ollama', model: 'qwen2.5-coder:7b',
    corpus: { tier: 'corpus', tasks: 7, of: 7, sample: 0, seed: '' }, budgetSet: false, budget: 25,
    stamp: { version: '3.8.1', sha: 'abc1234', dirty: false, text: 'atlias 3.8.1 @ abc1234' },
    flags: { values: { council: false }, changed: [], from: {}, env: {}, unknown: [], bad: [] },
    results: ids.map((id, i) => ({ id, name: id, pass: passing.includes(id), rounds: 3 + i, promptTotal: 100, outputTotal: 10 })),
    ...extra,
  });
  const fileA = path.join(base, 'arm-a.json'), fileB = path.join(base, 'arm-b.json');
  fs.writeFileSync(fileA, JSON.stringify(report(['t1', 't2'])));
  fs.writeFileSync(fileB, JSON.stringify(report(['t1', 't3', 't4', 't5', 't6', 't7'], { flags: { values: { council: true }, changed: ['council'], from: { council: 'ATLIAS_FLAG_COUNCIL' }, env: {}, unknown: [], bad: [] } })));
  const cli = (...args) => spawnSync(process.execPath, [path.join(ROOT, 'bin', 'atlias.mjs'), 'score', ...args], { encoding: 'utf8', env: { ...process.env, ATLIAS_HOME: path.join(TMP, 'state-score') }, timeout: 30000 });
  const near = (x, y, e = 1e-9) => Math.abs(x - y) < e;
  const readJson = (d, n) => JSON.parse(fs.readFileSync(path.join(d, n), 'utf8'));
  // a fresh pack each time, so one test's tampering never reaches the next
  let n = 0;
  const fresh = (files = [fileA, fileB]) => { const d = path.join(base, `pack-${++n}`); score.pack(files, d, { corpus: corpusDir }); return d; };

  await asyncSuite('score expert', 'the numbers are the hand-computed ones', async () => {
    const w = evals.wilson(5, 10);
    check('Wilson 95% on 5 of 10 is 0.2366 to 0.7634', near(w.lo, 0.2366, 5e-5) && near(w.hi, 0.7634, 5e-5),
      { happened: JSON.stringify(w), why: 'The published score carries this interval; a wrong one claims more or less than the corpus proved.', fix: 'lib/eval.mjs wilson().' });
    const z = 1.96, z2 = z * z, closed = (k, N) => { const p = k / N; const c = (2 * N * p + z2) / (2 * (N + z2)); const h = (z * Math.sqrt(z2 + 4 * N * p * (1 - p))) / (2 * (N + z2)); return [c - h, c + h]; };
    const dir = fresh();
    const st = readJson(dir, 'stats.json');
    const [loA, hiA] = closed(2, 7), [loB, hiB] = closed(6, 7);
    check('the pack carries the closed-form Wilson interval for 2 of 7 and 6 of 7', near(st.arms[0].wilson95[0], loA) && near(st.arms[0].wilson95[1], hiA) && near(st.arms[1].wilson95[0], loB) && near(st.arms[1].wilson95[1], hiB) && st.arms[0].passed === 2 && st.arms[1].passed === 6,
      { happened: JSON.stringify(st.arms), why: 'stats.json is what a reader quotes.', fix: 'lib/score.mjs computeStats().' });
    check('0 of 27 has an upper bound of z^2 / (27 + z^2) = 12.5 per cent', near(score.computeStats(Array.from({ length: 27 }, (_, i) => ({ arm: 'x', task: `k${i}`, pass: false, rounds: 1, promptTokens: null })), ['x']).arms[0].wilson95[1], z2 / (27 + z2)),
      { happened: 'differs', why: 'A zero score is not a zero-width interval.', fix: 'use evals.wilson.' });
    const p = st.paired;
    check('paired: 5 gained, 1 lost, 1 both, 0 neither, McNemar exact p = 14/64', p && p.gained === 5 && p.lost === 1 && p.bothPass === 1 && p.bothFail === 0 && p.discordant === 6 && near(p.p, 0.21875),
      { happened: JSON.stringify(p), why: 'Two-sided exact binomial tail at one half over the six tasks that changed.', fix: 'lib/score.mjs computeStats() and evals.mcnemar().' });
    const five = score.computeStats([...['a', 'b', 'c', 'd', 'e'].flatMap((t) => [{ arm: 'x', task: t, pass: false, rounds: 1, promptTokens: 1 }, { arm: 'y', task: t, pass: true, rounds: 1, promptTokens: 1 }])], ['x', 'y']).paired;
    check('five one-way flips give p = 2 x 0.5^5 = 0.0625, not below 0.05', five.gained === 5 && five.lost === 0 && near(five.p, 0.0625),
      { happened: JSON.stringify(five), why: 'Round five names six one-way flips as the floor.', fix: 'evals.mcnemar().' });
    check('prompt tokens per solved task: 700 over 2 solved is 350; 700 over 6 is 116.67', st.arms[0].tokensPerSolved === 350 && near(st.arms[1].tokensPerSolved, 700 / 6),
      { happened: JSON.stringify(st.arms.map((a) => a.tokensPerSolved)), why: 'Everything spent, failures included, over the tasks solved.', fix: 'computeStats().' });
    const none = score.computeStats([{ arm: 'x', task: 'a', pass: false, rounds: 1, promptTokens: 50 }], ['x']).arms[0];
    check('no solved task means no tokens-per-solved, not a division by zero', none.tokensPerSolved === null,
      { happened: String(none.tokensPerSolved), why: 'Infinity in a published table is not a number.', fix: 'null when nothing was solved.' });
  });

  await asyncSuite('score expert', 'pack writes the lock, the rows, the stats, the summary and the commands', async () => {
    const dir = fresh();
    const lock = readJson(dir, 'lock.json');
    const rows = fs.readFileSync(path.join(dir, 'rows.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    const md = fs.readFileSync(path.join(dir, 'SCORE.md'), 'utf8');
    const t1 = lock.corpus.tasks.find((t) => t.id === 't1');
    check('the lock pins the atlias version, git sha, engine, model and flags', lock.atlias.version === JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version && /^[0-9a-f]{40}$/.test(lock.atlias.gitSha) && lock.arms[0].engine === 'ollama' && lock.arms[0].model === 'qwen2.5-coder:7b' && lock.arms[1].flags.changed[0] === 'council',
      { happened: JSON.stringify({ atlias: lock.atlias, arms: lock.arms.map((a) => [a.engine, a.model]) }), why: 'A score nobody can tie to code and settings cannot be reproduced.', fix: 'lib/score.mjs pack().' });
    check('the lock lists every task id with the sha256 of each of its files', lock.corpus.tasks.length === 7 && t1 && /^[0-9a-f]{64}$/.test(t1.sha256) && Object.keys(t1.files).join() === 'sum.js,test.mjs' && t1.files['sum.js'] === score.taskDigest(JSON.parse(fs.readFileSync(path.join(corpusDir, 't1.json'), 'utf8'))).files['sum.js'],
      { happened: JSON.stringify(t1), why: 'Verify checks these against the corpus.', fix: 'taskDigest().' });
    check('rows.jsonl has task, pass, rounds and prompt tokens for each arm and task', rows.length === 14 && rows[0].arm === 'arm-a' && rows[0].task === 't1' && rows[0].pass === true && rows[0].rounds === 3 && rows[0].promptTokens === 100 && rows[8].arm === 'arm-b' && rows.filter((r) => r.arm === 'arm-b' && r.pass).length === 6,
      { happened: JSON.stringify(rows.slice(0, 2)), why: 'The per-task rows are the evidence the statistics stand on.', fix: 'armRows().' });
    check('SCORE.md states the rates, the paired p and both commands', /2 of 7/.test(md) && /6 of 7/.test(md) && /p = 0\.2188/.test(md) && /atlias score verify/.test(md) && /ATLIAS_FLAG_COUNCIL=1 atlias eval --engine ollama --model qwen2\.5-coder:7b --corpus /.test(md) && /atlias eval --engine ollama --model qwen2\.5-coder:7b --corpus [^\n]* --save arm-a\.json/.test(md) && /atlias compare reports\/arm-a\.json reports\/arm-b\.json/.test(md),
      { happened: md.slice(0, 1400), why: 'A stranger reads this file and nothing else.', fix: 'renderScore() and rerunCommand().' });
    check('the reports it was built from are inside the folder', fs.existsSync(path.join(dir, 'reports', 'arm-a.json')) && fs.existsSync(path.join(dir, 'reports', 'arm-b.json')),
      { happened: fs.readdirSync(dir).join(), why: 'Self-contained means the folder can be handed over alone.', fix: 'pack().' });
    let threw = '';
    try { score.pack([fileA, fileA], path.join(base, 'dup'), { corpus: corpusDir }); } catch (e) { threw = e.message; }
    let missing = '';
    try { score.pack([fileA], path.join(base, 'nocorpus'), { corpus: path.join(base, 'empty') }); } catch (e) { missing = e.message; }
    check('two arms with one name, or a corpus that lacks the tasks, refuse to pack', /different names/.test(threw) && /has no task/.test(missing),
      { happened: JSON.stringify({ threw, missing }), why: 'A pack over the wrong corpus would pin nothing.', fix: 'pack() validation.' });
  });

  await asyncSuite('score expert', 'the corpus source and the re-run command say exactly what to run', async () => {
    check('a direct-arm report regenerates a direct-arm command', /--direct/.test(score.rerunCommand({ arm: 'direct', engine: 'ollama', direct: true }, { kind: 'tier', ref: 'main' })), { happened: score.rerunCommand({ arm: 'direct', direct: true }, { kind: 'tier', ref: 'main' }), why: 'Omitting --direct re-runs a different harness protocol.', fix: 'Keep direct in the lock and command.' });
    const shipped = score.corpusSource(), inTree = score.corpusSource({ corpus: path.join(ROOT, 'evals', 'polyglot') }), tier = score.corpusSource({ tier: 'main' });
    check('the corpus source is shipped, a repo-relative dir (posix slashes), or a tier', shipped.kind === 'shipped' && inTree.kind === 'dir' && inTree.ref === 'evals/polyglot' && tier.kind === 'tier' && tier.ref === 'main' && score.corpusSource({ corpus: corpusDir }).ref === corpusDir,
      { happened: JSON.stringify([shipped, inTree, tier]), why: 'The lock must point at the corpus the same way on every machine.', fix: 'corpusSource().' });
    check('loadCorpus reads the fixture corpus and the shipped one, and an unknown tier as nothing', score.loadCorpus({ kind: 'dir', ref: corpusDir }).length === 7 && score.loadCorpus(score.corpusSource()).length === evals.loadTasks().length && score.loadCorpus({ kind: 'tier', ref: 'no-such-tier' }).length === 0,
      { happened: String(score.loadCorpus({ kind: 'dir', ref: corpusDir }).length), why: 'Verify hashes what this returns.', fix: 'loadCorpus().' });
    const arm = { arm: 'x', engine: 'ollama', model: 'm', tries: 3, budgetSet: true, budget: 12, corpus: { sample: 5, seed: 's' }, flags: { values: { council: true, ollamaProfile: false }, changed: ['council', 'ollamaProfile'] } };
    check('rerunCommand carries flags as environment, engine, model, tier or corpus, sample and seed, repeat, rounds and --save', score.rerunCommand(arm, { kind: 'tier', ref: 'main' }) === 'ATLIAS_FLAG_COUNCIL=1 ATLIAS_FLAG_OLLAMA_PROFILE=0 atlias eval --engine ollama --model m --tier main --sample 5 --seed s --repeat 3 --rounds 12 --save x.json'
      && score.rerunCommand({ arm: 'y', engine: 'echo', tries: 1 }, { kind: 'shipped', ref: 'evals' }) === 'atlias eval --engine echo --save y.json',
      { happened: score.rerunCommand(arm, { kind: 'tier', ref: 'main' }), why: 'The re-run has to be the run, or it is a different measurement.', fix: 'rerunCommand().' });
    const dir = fresh();
    check('renderScore over the lock and stats is byte for byte the SCORE.md that pack wrote', score.renderScore(readJson(dir, 'lock.json'), readJson(dir, 'stats.json')) === fs.readFileSync(path.join(dir, 'SCORE.md'), 'utf8'),
      { happened: 'differs', why: 'Verify relies on it.', fix: 'renderScore() must be a pure function of the lock and the stats.' });
  });

  await asyncSuite('score expert', 'verify passes an untouched pack and fails on any change', async () => {
    const ok = score.verify(fresh());
    check('an untouched pack verifies', ok.ok && ok.problems.length === 0, { happened: JSON.stringify(ok), why: 'Verify that fails on a good pack is noise.', fix: 'lib/score.mjs verify().' });
    const coordinated = fresh();
    const alteredRows = fs.readFileSync(path.join(coordinated, 'rows.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    alteredRows.find((r) => r.arm === 'arm-a' && r.task === 't2').pass = false;
    const alteredLock = readJson(coordinated, 'lock.json');
    const alteredStats = score.computeStats(alteredRows, alteredLock.arms.map((a) => a.arm));
    fs.writeFileSync(path.join(coordinated, 'rows.jsonl'), alteredRows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    fs.writeFileSync(path.join(coordinated, 'stats.json'), JSON.stringify(alteredStats, null, 2) + '\n');
    fs.writeFileSync(path.join(coordinated, 'SCORE.md'), score.renderScore(alteredLock, alteredStats));
    check('coordinated edits to rows, statistics and summary fail against the original reports', score.verify(coordinated).problems.some((p) => /does not match the original reports/.test(p)), { happened: JSON.stringify(score.verify(coordinated)), why: 'Recomputing altered rows alone lets a false result verify itself.', fix: 'Derive the expected rows from the hashed original reports.' });
    const one = score.pack([fileA], path.join(base, 'one'), { corpus: corpusDir });
    check('a single-arm pack has no paired block and verifies', one.stats.paired === null && score.verify(path.join(base, 'one')).ok, { happened: JSON.stringify(one.stats.paired), why: 'A score is one arm.', fix: 'computeStats().' });

    const d1 = fresh();
    const rowsPath = path.join(d1, 'rows.jsonl');
    fs.writeFileSync(rowsPath, fs.readFileSync(rowsPath, 'utf8').replace('"task":"t2","pass":true', '"task":"t2","pass":false'));
    const v1 = score.verify(d1);
    check('an edited row fails, and the message names the recomputed count', !v1.ok && v1.problems.some((p) => /stats\.json does not match the rows: recomputed arm-a 1\/7/.test(p)),
      { happened: JSON.stringify(v1), why: 'The rows are the evidence; flipping one must not go unnoticed.', fix: 'verify() recomputes from rows.jsonl.' });

    const d2 = fresh();
    const st = readJson(d2, 'stats.json'); st.arms[1].passed = 7;
    fs.writeFileSync(path.join(d2, 'stats.json'), JSON.stringify(st, null, 2) + '\n');
    check('an edited stats.json fails', !score.verify(d2).ok, { happened: 'verified', why: 'Stats are recomputed, not trusted.', fix: 'verify().' });

    const d3 = fresh();
    fs.appendFileSync(path.join(d3, 'SCORE.md'), '\nWe solved everything.\n');
    check('an edited SCORE.md fails', score.verify(d3).problems.some((p) => /SCORE\.md/.test(p)), { happened: 'verified', why: 'The summary is what people read.', fix: 'verify() re-renders it.' });

    const d4 = fresh();
    const alt = path.join(base, 'corpus-changed');
    fs.mkdirSync(alt, { recursive: true });
    for (const f of fs.readdirSync(corpusDir)) fs.copyFileSync(path.join(corpusDir, f), path.join(alt, f));
    const t3 = JSON.parse(fs.readFileSync(path.join(alt, 't3.json'), 'utf8'));
    t3.files['sum.js'] = 'export const t3 = 2;\n';
    fs.writeFileSync(path.join(alt, 't3.json'), JSON.stringify(t3));
    const v4 = score.verify(d4, { corpus: alt });
    check('a changed task file fails and names the task and the file', !v4.ok && v4.problems.some((p) => /task t3 changed since the pack was built: sum\.js/.test(p)) && score.verify(d4, { corpus: corpusDir }).ok,
      { happened: JSON.stringify(v4), why: 'A score on a corpus that moved is a different score.', fix: 'verify() re-hashes each task.' });

    const d5 = fresh();
    fs.rmSync(path.join(corpusDir, 't7.json'));
    const v5 = score.verify(d5);
    fs.writeFileSync(path.join(corpusDir, 't7.json'), JSON.stringify({ id: 't7', name: 't7', prompt: 'fix t7', check: ['node', 'test.mjs'], files: { 'sum.js': 'export const t7 = 1;\n', 'test.mjs': 'process.exit(0); // t7\n' } }, null, 1));
    check('a task removed from the corpus fails', v5.problems.some((p) => /task t7 is no longer in the corpus/.test(p)) && score.verify(d5).ok,
      { happened: JSON.stringify(v5), why: 'Dropped tasks are how a score is quietly flattered.', fix: 'verify().' });

    const d6 = fresh();
    fs.appendFileSync(path.join(d6, 'reports', 'arm-a.json'), ' ');
    check('an edited copy of a report fails', score.verify(d6).problems.some((p) => /reports\/arm-a\.json changed/.test(p)), { happened: 'verified', why: 'The reports are what the rows came from.', fix: 'verify().' });
  });

  await asyncSuite('score expert', 'the command line packs, verifies, and exits 1 on a mismatch', async () => {
    const out = path.join(base, 'cli-pack');
    const p = cli('pack', fileA, fileB, '--out', out, '--corpus', corpusDir);
    const v = cli('verify', out);
    const rowsPath = path.join(out, 'rows.jsonl');
    fs.writeFileSync(rowsPath, fs.readFileSync(rowsPath, 'utf8').replace('"task":"t1","pass":true', '"task":"t1","pass":false'));
    const bad = cli('verify', out);
    const usage = cli('pack', fileA);
    check('pack exits 0 and writes SCORE.md; verify exits 0; after an edit verify exits 1 and says why; no --out is usage', p.status === 0 && fs.existsSync(path.join(out, 'SCORE.md')) && v.status === 0 && /verified/.test(v.stdout) && bad.status === 1 && /does NOT verify/.test(bad.stdout) && /recomputed/.test(bad.stdout) && usage.status === 1 && /usage: atlias score pack/.test(usage.stdout),
      { happened: JSON.stringify({ p: [p.status, p.stdout, p.stderr], v: [v.status, v.stdout], bad: [bad.status, bad.stdout], usage: [usage.status, usage.stdout] }), why: 'The exit code is what a script and a stranger rely on.', fix: "the 'score' case in bin/atlias.mjs." });
  });
}
