// The public score package (docs/NEXTGEN-5.md ranked-plan row 3, cloud part).
// `atlias score pack <report.json...> --out <dir>` turns one or two saved eval
// reports (atlias eval --save) into a folder a stranger can read and re-check:
//   lock.json   what ran: atlias version and git sha, engine, model, flags, and
//               the corpus task ids with the sha256 of each task's files
//   rows.jsonl  one row per arm and task: pass, rounds, prompt tokens
//   stats.json  pass count and rate with a Wilson 95% interval, prompt tokens
//               per solved task, and with two arms the paired McNemar counts
//   SCORE.md    the same, in words, with the re-score and re-run commands
//   reports/    the reports it was built from
// `atlias score verify <dir>` recomputes stats.json and SCORE.md from the lock
// and the rows, checks the lock against the corpus files as they are now, and
// reports every mismatch (exit 1). The statistics are lib/eval.mjs's own
// (wilson, mcnemar); nothing here re-derives them.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { wilson, mcnemar, harnessStamp, loadTasks, ROOT } from './eval.mjs';
import { flagEnvName } from './core.mjs';
import { tierTasks } from './tiers.mjs';

export const SCORE_FORMAT = 1;
const sha = (data) => crypto.createHash('sha256').update(data).digest('hex');
const sorted = (o) => Object.fromEntries(Object.keys(o || {}).sort().map((k) => [k, o[k]]));
const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

// A task's identity: every seeded file by content, and the prompt and check
// that grade it. Renaming the task file or reordering keys changes nothing.
export function taskDigest(task) {
  const files = {};
  for (const [name, body] of Object.entries(task.files || {})) files[name] = sha(String(body));
  const whole = sha(JSON.stringify({ files: sorted(files), prompt: task.prompt || '', check: task.check || null, protect: task.protect || null }));
  return { id: task.id, sha256: whole, files: sorted(files) };
}

// Where the tasks of a pack live: the shipped evals folder, a directory or a
// tier. A directory inside this checkout is stored relative to it.
export function corpusSource({ corpus = '', tier = '' } = {}) {
  if (tier) return { kind: 'tier', ref: tier };
  if (corpus) {
    const abs = path.resolve(corpus);
    const rel = path.relative(ROOT, abs);
    return { kind: 'dir', ref: rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel.split(path.sep).join('/') : abs };
  }
  return { kind: 'shipped', ref: 'evals' };
}
export function loadCorpus(src) {
  if (src.kind === 'tier') { const t = tierTasks(src.ref); return t.ok ? t.tasks : []; }
  return loadTasks(src.kind === 'shipped' ? undefined : path.resolve(ROOT, src.ref));
}

function armRows(arm, report) {
  return (report.results || []).map((r) => {
    const runs = r.attempts && r.attempts.length ? r.attempts : [r];
    const sum = (k) => { const v = runs.map((a) => num(a[k])).filter((x) => x !== null); return v.length ? v.reduce((n, x) => n + x, 0) : null; };
    return { arm, task: r.id || r.name, pass: Boolean(r.pass), rounds: sum('rounds'), promptTokens: sum('promptTotal') };
  });
}

// Everything in stats.json is a function of the rows, so verify can rebuild it.
export function computeStats(rows, arms) {
  const per = arms.map((arm) => {
    const mine = rows.filter((r) => r.arm === arm);
    const passed = mine.filter((r) => r.pass).length;
    const tok = mine.map((r) => r.promptTokens).filter((x) => x !== null);
    const total = tok.length ? tok.reduce((n, x) => n + x, 0) : null;
    const w = wilson(passed, mine.length);
    return { arm, tasks: mine.length, passed, rate: w.rate, wilson95: [w.lo, w.hi], promptTokens: total, tokensRecorded: tok.length, tokensPerSolved: total !== null && passed > 0 ? total / passed : null };
  });
  const out = { arms: per, paired: null };
  if (arms.length === 2) {
    const a = new Map(rows.filter((r) => r.arm === arms[0]).map((r) => [r.task, r.pass]));
    const b = new Map(rows.filter((r) => r.arm === arms[1]).map((r) => [r.task, r.pass]));
    let bothPass = 0, bothFail = 0, gained = 0, lost = 0;
    for (const [id, pa] of a) {
      if (!b.has(id)) continue;
      const pb = b.get(id);
      if (pa && pb) bothPass++; else if (!pa && !pb) bothFail++; else if (pb) gained++; else lost++;
    }
    const t = mcnemar(gained, lost);
    out.paired = { a: arms[0], b: arms[1], tasks: bothPass + bothFail + gained + lost, bothPass, bothFail, gained, lost, discordant: t.n, p: t.p };
  }
  return out;
}

function gitInfo() {
  const git = (args) => { try { const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', timeout: 20000 }); return r.status === 0 ? String(r.stdout || '').trim() : null; } catch { return null; } };
  const head = git(['rev-parse', 'HEAD']);
  const st = git(['status', '--porcelain']);
  return { gitSha: head || '', dirty: st === null ? null : st.length > 0 };
}

const envPrefix = (flags) => ((flags && flags.changed) || []).map((k) => `${flagEnvName(k)}=${flags.values[k] === true ? 1 : flags.values[k] === false ? 0 : flags.values[k]}`).join(' ');
export function rerunCommand(arm, src) {
  const c = arm.corpus || {};
  const parts = [envPrefix(arm.flags), 'atlias eval'].filter(Boolean);
  if (arm.engine) parts.push(`--engine ${arm.engine}`);
  if (arm.model) parts.push(`--model ${arm.model}`);
  if (arm.direct) parts.push('--direct');
  if (src.kind === 'tier') parts.push(`--tier ${src.ref}`); else if (src.kind === 'dir') parts.push(`--corpus ${src.ref}`);
  if (c.sample) parts.push(`--sample ${c.sample}`, `--seed ${c.seed}`);
  if (arm.tries > 1) parts.push(`--repeat ${arm.tries}`);
  if (arm.budgetSet) parts.push(`--rounds ${arm.budget}`);
  parts.push(`--save ${arm.arm}.json`);
  return parts.join(' ');
}

export function pack(files, out, { corpus = '', tier = '', names = [] } = {}) {
  if (files.length < 1 || files.length > 2) throw new Error('give one report (a score) or two (an A/B)');
  if (!out) throw new Error('--out <dir> is required');
  const reports = files.map((f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { throw new Error(`could not read ${f}: ${e.message}`); } });
  const arms = files.map((f, i) => (names[i] || path.basename(f).replace(/\.json$/i, '')).replace(/[^A-Za-z0-9._-]/g, '_'));
  if (new Set(arms).size !== arms.length) throw new Error(`the two arms need different names (${arms[0]}); pass --names a,b`);
  reports.forEach((r, i) => { if (!r || !Array.isArray(r.results) || !r.results.length) throw new Error(`${files[i]} is not an eval report with results`); });
  const rows = reports.flatMap((r, i) => armRows(arms[i], r));
  const src = corpusSource({ corpus, tier });
  const byId = new Map(loadCorpus(src).map((t) => [t.id, t]));
  const ids = [...new Set(rows.map((r) => r.task))].sort();
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) throw new Error(`the corpus (${src.kind} ${src.ref}) has no task ${missing.join(', ')}: pass the --corpus or --tier the reports ran on`);
  const armInfo = reports.map((r, i) => ({
    arm: arms[i], report: `reports/${arms[i]}.json`, reportSha256: '', engine: r.engine || '', model: r.model || '', flags: r.flags || null,
    stamp: r.stamp ? { version: r.stamp.version || '', sha: r.stamp.sha || '', dirty: Boolean(r.stamp.dirty), text: r.stamp.text || '' } : null, direct: Boolean(r.direct),
    corpus: r.corpus || null, tries: r.tries || 1, budget: r.budget || 0, budgetSet: Boolean(r.budgetSet),
  }));
  fs.mkdirSync(path.join(out, 'reports'), { recursive: true });
  reports.forEach((r, i) => {
    const text = fs.readFileSync(files[i]);
    fs.writeFileSync(path.join(out, armInfo[i].report), text);
    armInfo[i].reportSha256 = sha(text);
  });
  const h = harnessStamp();
  const lock = {
    format: SCORE_FORMAT,
    atlias: { version: h.version, ...gitInfo(), harness: h.text },
    corpus: { ...src, tasks: ids.map((id) => taskDigest(byId.get(id))) },
    arms: armInfo,
    commands: { rescore: 'atlias score verify <this folder>', rerun: armInfo.map((a) => rerunCommand(a, src)), compare: arms.length === 2 ? `atlias compare reports/${arms[0]}.json reports/${arms[1]}.json` : '' },
  };
  const stats = computeStats(rows, arms);
  fs.writeFileSync(path.join(out, 'lock.json'), JSON.stringify(lock, null, 2) + '\n');
  fs.writeFileSync(path.join(out, 'rows.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  fs.writeFileSync(path.join(out, 'stats.json'), JSON.stringify(stats, null, 2) + '\n');
  fs.writeFileSync(path.join(out, 'SCORE.md'), renderScore(lock, stats));
  return { lock, stats, rows };
}

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const fmtN = (x) => (x === null ? 'not recorded' : Math.round(x).toLocaleString('en-US'));
export function renderScore(lock, stats) {
  const L = [];
  L.push('# Atlias score', '');
  L.push(`Built by atlias ${lock.atlias.version || '(unknown version)'}${lock.atlias.gitSha ? ` at git ${lock.atlias.gitSha.slice(0, 12)}${lock.atlias.dirty ? ' (uncommitted changes)' : ''}` : ' (no git sha)'}. `
    + 'Each task is one fixed coding job with a check command; a task counts as solved only when that check passes on the untouched test files. '
    + `The corpus is ${lock.corpus.tasks.length} task(s) (${lock.corpus.kind} ${lock.corpus.ref}); lock.json pins each task by the sha256 of its files.`, '');
  L.push('## Result', '', '| arm | engine | model | solved | rate | Wilson 95% | prompt tokens per solved task |', '|---|---|---|---|---|---|---|');
  for (const s of stats.arms) {
    const a = lock.arms.find((x) => x.arm === s.arm) || {};
    L.push(`| ${s.arm} | ${a.engine || '-'} | ${a.model || '-'} | ${s.passed} of ${s.tasks} | ${pct(s.rate)} | ${pct(s.wilson95[0])} to ${pct(s.wilson95[1])} | ${fmtN(s.tokensPerSolved)} |`);
  }
  L.push('', 'The interval is wide because the corpus is small. Read a rate as a range, and one task flipping as noise unless the paired test below says otherwise.', '');
  if (stats.paired) {
    const p = stats.paired;
    L.push('## Paired comparison', '', `Same ${p.tasks} task(s) under both arms. ${p.a} to ${p.b}: ${p.gained} gained, ${p.lost} lost, ${p.bothPass} solved by both, ${p.bothFail} by neither.`,
      p.discordant ? `McNemar exact test on the ${p.discordant} task(s) that changed: two-sided p = ${p.p.toFixed(4)}.` : 'No task changed, so there is no difference to test (p = 1).', '');
  }
  L.push('## What ran', '');
  for (const a of lock.arms) L.push(`- ${a.arm}: ${a.stamp ? a.stamp.text : 'no harness stamp in the report'}; flags: ${a.flags && a.flags.changed && a.flags.changed.length ? a.flags.changed.map((k) => `${k}=${JSON.stringify(a.flags.values[k])}`).join(', ') : 'none set, every flag at its default'}; ${a.tries > 1 ? `${a.tries} attempts per task, all must pass` : 'one attempt per task'}.`);
  L.push('', '## Re-score (no model, no tokens)', '', 'Recomputes every number above from rows.jsonl and checks each task file against the lock. Exit 1 on any mismatch.', '', '```', lock.commands.rescore, '```', '');
  L.push('## Re-run (uses the model)', '', 'From a checkout of atlias at the sha above, on the same corpus:', '', '```', ...lock.commands.rerun);
  if (lock.commands.compare) L.push(lock.commands.compare);
  L.push('```', '', 'Then `atlias score pack <the new report.json...> --out <dir>` and compare the new SCORE.md with this one. A re-run lands inside the run-to-run spread, not on the same number.', '');
  L.push('## Files', '', '- `lock.json` version, git sha, engine, model, flags, task ids with file hashes, commands', '- `rows.jsonl` task, pass, rounds, prompt tokens, per arm', '- `stats.json` the statistics', '- `reports/` the eval reports these came from', '');
  return L.join('\n');
}

// Returns { ok, problems, notes }; the CLI prints them and exits 1 when not ok.
export function verify(dir, { corpus = '', tier = '' } = {}) {
  const problems = [], notes = [];
  const read = (n) => { try { return fs.readFileSync(path.join(dir, n), 'utf8'); } catch { problems.push(`${n} is missing`); return null; } };
  const json = (n) => { const t = read(n); if (t === null) return null; try { return JSON.parse(t); } catch (e) { problems.push(`${n} is not valid JSON: ${e.message}`); return null; } };
  const lock = json('lock.json'), stats = json('stats.json'), rowsText = read('rows.jsonl'), scoreMd = read('SCORE.md');
  if (!lock || !stats || rowsText === null) return { ok: false, problems, notes };
  let rows = [];
  try { rows = rowsText.split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch (e) { problems.push(`rows.jsonl has a line that is not JSON: ${e.message}`); return { ok: false, problems, notes }; }
  const arms = (lock.arms || []).map((a) => a.arm);
  const again = computeStats(rows, arms);
  if (JSON.stringify(again) !== JSON.stringify(stats)) {
    const brief = (s) => `${(s.arms || []).map((x) => `${x.arm} ${x.passed}/${x.tasks}`).join(', ')}${s.paired ? `, paired ${s.paired.gained} gained ${s.paired.lost} lost p=${Number(s.paired.p).toFixed(4)}` : ''}`;
    problems.push(`stats.json does not match the rows: recomputed ${brief(again)}; the file says ${brief(stats)}`);
  }
  if (scoreMd !== null && scoreMd !== renderScore(lock, again)) problems.push('SCORE.md is not what the lock and the rows say (it was edited, or the stats were)');
  const lockIds = ((lock.corpus && lock.corpus.tasks) || []).map((t) => t.id);
  const rowIds = [...new Set(rows.map((r) => r.task))];
  for (const id of rowIds) if (!lockIds.includes(id)) problems.push(`rows.jsonl has task ${id}, which lock.json does not list`);
  for (const id of lockIds) if (!rowIds.includes(id)) problems.push(`lock.json lists task ${id}, which has no row`);
  for (const r of rows) if (!arms.includes(r.arm)) problems.push(`row for task ${r.task} names arm ${r.arm}, which lock.json does not have`);
  const expectedRows = [];
  for (const a of lock.arms || []) {
    let buf = null;
    try { buf = fs.readFileSync(path.join(dir, a.report)); } catch { problems.push(`${a.report} is missing`); }
    if (buf && sha(buf) !== a.reportSha256) problems.push(`${a.report} changed since the pack was built`);
    if (buf) {
      try { expectedRows.push(...armRows(a.arm, JSON.parse(buf.toString('utf8')))); }
      catch { problems.push(`${a.report} is not a valid report`); }
    }
  }
  if (JSON.stringify(rows) !== JSON.stringify(expectedRows)) problems.push('rows.jsonl does not match the original reports');
  const src = corpus || tier ? corpusSource({ corpus, tier }) : { kind: lock.corpus.kind, ref: lock.corpus.ref };
  const byId = new Map(loadCorpus(src).map((t) => [t.id, t]));
  if (!byId.size) problems.push(`no tasks found in the corpus (${src.kind} ${src.ref}); pass --corpus <dir> or --tier <name> to point at it`);
  else for (const t of lock.corpus.tasks || []) {
    const now = byId.get(t.id);
    if (!now) { problems.push(`task ${t.id} is no longer in the corpus`); continue; }
    const d = taskDigest(now);
    if (d.sha256 === t.sha256) continue;
    const changed = [...new Set([...Object.keys(t.files || {}), ...Object.keys(d.files)])].filter((f) => (t.files || {})[f] !== d.files[f]);
    problems.push(`task ${t.id} changed since the pack was built: ${changed.length ? changed.join(', ') : 'its prompt or check'}`);
  }
  const now = harnessStamp();
  if (lock.atlias && now.version && lock.atlias.version !== now.version) notes.push(`this checkout is atlias ${now.version}; the pack was built by ${lock.atlias.version}`);
  return { ok: problems.length === 0, problems, notes };
}
