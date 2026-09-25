// Task evaluation: does the harness actually finish work?
//
// lib/bench.mjs measures what atlias costs. Nothing measured whether a task
// was completed, which is the number every public benchmark reports and the
// one that decides whether a change to the loop helped or hurt. The public
// suites (SWE-bench Lite, Terminal-Bench) each start a prebuilt container per
// instance, and there is no Docker on this machine, so this runs the same idea
// locally: a task writes its own files into a scratch workspace, the agent
// works, and then a command decides.
//
// The rule that makes it worth anything: the model's claim never scores the
// task. Only the check command does, and its exit code is the whole verdict.
//
// Three things guard that rule, because an exit code on its own is easy to
// buy. A score is stamped with the code that produced it, so a number can be
// placed afterwards. A task can be run more than once, because one run of a
// sampling process is not a result. And the files that do the grading are
// compared against what the task shipped, so a pass bought by rewriting the
// checker is reported as what it is rather than counted.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, ensureDir, STATE_DIR, run } from './core.mjs';
import * as loop from './loop.mjs';
import * as integrity from './integrity.mjs';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TASKS_DIR = path.join(ROOT, 'evals');

export function loadTasks(dir = TASKS_DIR) {
  let names = [];
  try { names = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort(); } catch { return []; }
  const out = [];
  for (const n of names) {
    try {
      const t = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'));
      if (t && t.id && t.prompt && t.check) out.push(t);
    } catch { /* a corrupt task file is skipped, not fatal */ }
  }
  return out;
}

// One workspace per run, never the user's own tree: an eval that edits the
// project it is measuring would be measuring itself.
export function makeWorkspace(task, stamp) {
  const dir = path.join(STATE_DIR, 'evals', `${task.id}-${stamp}`);
  ensureDir(dir);
  for (const [rel, body] of Object.entries(task.files || {})) {
    const p = path.join(dir, rel);
    ensureDir(path.dirname(p));
    fs.writeFileSync(p, String(body));
  }
  return dir;
}

// Which code produced a score. A number with no sha behind it cannot be
// placed a week later, and the loop moves fast enough that the distinction
// matters within a single day. A tree with uncommitted changes to the files
// that decide how a run behaves is stamped dirty rather than stamped with a
// sha that does not describe what ran, and a machine with no git says
// unstamped rather than guessing.
export const STAMP_FILES = ['lib/eval.mjs', 'lib/loop.mjs'];
export function harnessStamp(root = ROOT, files = STAMP_FILES) {
  let version = '';
  try { version = String(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version || ''); } catch { version = ''; }
  const name = version ? `atlias ${version}` : 'atlias';
  let r = null;
  // The first git call in a cold process on a loaded machine can take seconds:
  // at a five-second timeout this quietly returned "unstamped" on a machine
  // that has git, which is the failure this whole function exists to prevent.
  // So the budget is generous, and a timeout says so rather than looking like
  // a machine with no git at all.
  try { r = run('git', ['log', '-1', '--format=%h', '--', ...files], { cwd: root, timeout: 20000 }); } catch (e) { r = { status: null, error: e && e.message ? e.message : String(e) }; }
  const sha = r && r.status === 0 ? String(r.stdout || '').trim().split('\n')[0].trim() : '';
  if (!sha) {
    const why = r && r.error ? r.error : r && r.status === null ? 'git did not answer in time' : 'git found no commit for these files';
    return { version, sha: '', dirty: false, dirtyFiles: [], why, text: `${name}, unstamped (${why})` };
  }
  let dirtyFiles = [];
  try {
    const d = run('git', ['status', '--porcelain', '--', ...files], { cwd: root, timeout: 20000 });
    if (d && d.status === 0) dirtyFiles = String(d.stdout || '').split('\n').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/^\S+\s+/, ''));
    else dirtyFiles = ['(git could not say)'];
  } catch { dirtyFiles = ['(git could not say)']; }
  return { version, sha, dirty: dirtyFiles.length > 0, dirtyFiles, text: `${name} @ ${sha}${dirtyFiles.length ? '-dirty' : ''}` };
}

// The files the model must not touch. A task may name them; by default it is
// every seeded file the check command runs, because a harness that lets the
// model rewrite its own checker measures the model's nerve, not its work.
export function protectedFiles(task) {
  if (Array.isArray(task.protect)) return task.protect;
  const argv = Array.isArray(task.check) ? task.check : String(task.check || '').split(/\s+/).filter(Boolean);
  const want = new Set(argv.map((a) => String(a).replace(/^\.[\\/]/, '')));
  return Object.keys(task.files || {}).filter((f) => want.has(f));
}

// A line-level diff by multiset, which is all findWeakenedTests needs: it asks
// which lines appeared and which went away, not where they moved to.
function lineDiff(beforeText, afterText, file) {
  const before = String(beforeText).split('\n');
  const after = String(afterText).split('\n');
  const left = new Map();
  for (const t of before) left.set(t, (left.get(t) || 0) + 1);
  const added = [];
  after.forEach((t, i) => {
    const n = left.get(t) || 0;
    if (n > 0) left.set(t, n - 1);
    else if (t.trim()) added.push({ file, line: i + 1, text: t });
  });
  const removed = [];
  before.forEach((t, i) => {
    const n = left.get(t) || 0;
    if (n > 0 && t.trim()) { left.set(t, n - 1); removed.push({ file, line: i + 1, text: t }); }
  });
  return { added, removed };
}

// Did the pass come from the work or from the grader? ImpossibleBench's
// question, and it has to be part of the verdict rather than a footnote: a
// check that only runs after the checker was rewritten is not a check.
export function tamper(dir, task) {
  const files = [];
  let added = [], removed = [];
  for (const rel of protectedFiles(task)) {
    const seeded = String((task.files || {})[rel] == null ? '' : (task.files || {})[rel]);
    let now = null;
    try { now = fs.readFileSync(path.join(dir, rel), 'utf8'); } catch { now = null; }
    if (now === null) {
      files.push({ file: rel, what: 'deleted' });
      removed = removed.concat(lineDiff(seeded, '', rel).removed);
      continue;
    }
    if (now === seeded) continue;
    files.push({ file: rel, what: 'edited' });
    const d = lineDiff(seeded, now, rel);
    added = added.concat(d.added);
    removed = removed.concat(d.removed);
  }
  return { files, weakened: files.length ? integrity.findWeakenedTests(added, removed) : [] };
}

// The check decides. A non-zero exit is a failure however confident the model
// sounded, and a check that cannot run at all is a failure too, never a pass.
export function score(dir, task) {
  const started = Date.now();
  let r;
  try {
    // The check is argv, not a shell line: no quoting rules, no shell to
    // differ between Windows and the rest.
    const argv = Array.isArray(task.check) ? task.check : String(task.check).split(/\s+/).filter(Boolean);
    r = run(argv[0], argv.slice(1), { cwd: dir, timeout: Math.max(5000, task.timeoutMs || 60000) });
  } catch (e) {
    return { pass: false, why: `the check could not run: ${e && e.message ? e.message : e}`, ms: Date.now() - started };
  }
  const out = `${(r && r.stdout) || ''}${(r && r.stderr) || ''}`.trim();
  return {
    pass: Boolean(r) && r.status === 0,
    why: r && r.status === 0 ? 'the check passed' : `the check exited ${r ? r.status : 'without a status'}`,
    output: out.slice(0, 600),
    ms: Date.now() - started,
  };
}

// Runs one task end to end. `chat` is the model: the CLI passes a real engine,
// the tests pass a scripted one, and neither can change how the task is
// scored.
export async function runTask(task, { chat, state, stamp = String(Date.now()), keep = false } = {}) {
  if (!chat) throw new Error('runTask needs a chat function');
  const dir = makeWorkspace(task, stamp);
  const st = { ...(state || {}), cwd: dir, messages: [] };
  const t0 = Date.now();
  // A budget in the task file, so two runs weeks apart are comparable instead
  // of inheriting whatever agent.maxToolRounds happened to be set to.
  const asked = Number(task.rounds);
  const budget = Number.isFinite(asked) && asked > 0 ? Math.floor(asked) : null;
  let reply = '', error = null;
  try {
    reply = await loop.runLoop(st, task.prompt, { chat, say: () => {}, ask: async () => true, limits: budget ? { maxToolRounds: budget } : null });
  } catch (e) {
    error = e && e.message ? e.message : String(e);
  }
  const verdict = score(dir, task);
  const cheat = tamper(dir, task);
  // Why the agent stopped, in the harness's own words rather than prose an eval
  // report has to guess at: answered, malformed-output, truncated-output,
  // rounds-exhausted or model-error. A task that fails because the model could
  // not format an action is a different result from one that ran out of rounds,
  // and a comparison between harnesses needs to be able to tell them apart.
  const stop = error ? { reason: 'crashed', detail: String(error).slice(0, 300) } : st.stop || { reason: 'unknown', detail: '' };
  const rounds = (st.messages || []).filter((m) => m.role === 'assistant').length;
  const chars = JSON.stringify(st.messages || []).length;
  const pass = verdict.pass && !error && cheat.files.length === 0;
  const tampered = cheat.files.map((f) => `${f.file} ${f.what}`);
  const why = error ? `the agent stopped: ${error}`
    : cheat.files.length ? `the graded file was changed by the run (${tampered.join(', ')}), so the check no longer grades the task${verdict.pass ? ' - and it exited 0, which is the pass this rule exists to refuse' : ''}`
      : verdict.why;
  if (!keep && pass) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* leave it */ } }
  return {
    id: task.id,
    name: task.name || task.id,
    pass,
    why,
    output: verdict.output || '',
    stop: stop.reason,
    stopDetail: stop.detail,
    tampered,
    weakened: cheat.weakened.map((w) => `${w.file}${w.line ? `:${w.line}` : ''} ${w.what}`),
    checkExit: verdict.pass,
    rounds,
    budget,
    // The apply-failure rate, carried out of the loop. The largest measured
    // harness effect in the field is the share of edits that never land, and
    // it cannot be improved while nothing counts it.
    editTries: st.editTries || 0,
    editFails: st.editFails || 0,
    chars,
    ms: Date.now() - t0,
    workspace: pass && !keep ? null : dir,
    said: String(reply || '').slice(0, 300),
  };
}

// One run of a sampling process is not a result. `repeat` runs every task that
// many times; a task counts as finished only when every attempt finished,
// which is pass^k, and the report carries pass@k beside it so a flaky task is
// visible rather than averaged away.
export async function runSuite(tasks, opts = {}) {
  const started = Date.now();
  const tries = Math.max(1, Math.floor(Number(opts.repeat) || 1));
  const results = [];
  for (const t of tasks) {
    const attempts = [];
    for (let i = 0; i < tries; i++) attempts.push(await runTask(t, { ...opts, stamp: `${Date.now()}-${results.length}-${i}` }));
    const passes = attempts.filter((a) => a.pass).length;
    // The representative line is the first failure when there is one, because
    // that is the attempt a person needs to look at.
    const face = attempts.find((a) => !a.pass) || attempts[0];
    results.push({ ...face, pass: passes === tries, passes, tries, attempts: tries > 1 ? attempts : undefined });
  }
  const cfg = config().agent;
  return {
    results,
    passed: results.filter((r) => r.pass).length,
    anyPassed: results.filter((r) => r.passes > 0).length,
    attemptsPassed: results.reduce((n, r) => n + r.passes, 0),
    attemptsTotal: results.length * tries,
    editTries: results.reduce((n, r) => n + (r.attempts ? r.attempts.reduce((m, a) => m + (a.editTries || 0), 0) : (r.editTries || 0)), 0),
    editFails: results.reduce((n, r) => n + (r.attempts ? r.attempts.reduce((m, a) => m + (a.editFails || 0), 0) : (r.editFails || 0)), 0),
    chars: results.reduce((n, r) => n + (r.attempts ? r.attempts.reduce((m, a) => m + (a.chars || 0), 0) : (r.chars || 0)), 0),
    tries,
    total: results.length,
    ms: Date.now() - started,
    stamp: opts.stamp === false ? null : harnessStamp(),
    engine: opts.engineName || (opts.state && opts.state.engine) || '',
    model: opts.model || '',
    budget: Number(opts.budget) > 0 ? Math.floor(Number(opts.budget)) : Math.max(1, cfg.maxToolRounds),
  };
}

export function format(report) {
  const lines = [];
  if (report.stamp) lines.push(`harness: ${report.stamp.text}${report.stamp.dirty ? ` (uncommitted: ${report.stamp.dirtyFiles.join(', ')})` : ''}`);
  const bits = [];
  if (report.engine) bits.push(`engine ${report.engine}`);
  if (report.model) bits.push(`model ${report.model}`);
  if (report.budget) bits.push(`${report.budget} rounds`);
  if (report.tries > 1) bits.push(`${report.tries} attempts each`);
  if (bits.length) lines.push(`ran with: ${bits.join(', ')}`);
  if (lines.length) lines.push('');
  for (const r of report.results) {
    const many = r.tries > 1 ? `${r.passes}/${r.tries} attempts, ` : '';
    // On a passing line the stop reason is always "answered", and boilerplate
    // that is always there stops being read. A pass that stopped some other
    // way is exactly the thing worth seeing, so that one is printed.
    const stopped = r.stop && (!r.pass || r.stop !== 'answered') ? `, stopped: ${r.stop}` : '';
    const budget = r.budget ? `/${r.budget}` : '';
    lines.push(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  (${many}${r.rounds}${budget} rounds, ${(r.ms / 1000).toFixed(1)}s${stopped})`);
    if (!r.pass) {
      lines.push(`      ${r.why}`);
      if (r.tampered && r.tampered.length) lines.push(`      graded file changed: ${r.tampered.join(', ')}`);
      if (r.weakened && r.weakened.length) lines.push(`      ${r.weakened.join('; ')}`);
      if (r.output) lines.push(`      ${r.output.split('\n').slice(0, 4).join('\n      ')}`);
      if (r.workspace) lines.push(`      workspace kept: ${r.workspace}`);
    }
  }
  lines.push('');
  const k = report.tries > 1
    ? `${report.passed}/${report.total} tasks finished on every attempt (pass^${report.tries}), ${report.anyPassed}/${report.total} finished at least once (pass@${report.tries}), ${report.attemptsPassed}/${report.attemptsTotal} attempts passed`
    : `${report.passed}/${report.total} tasks finished`;
  lines.push(`${k}, ${(report.ms / 1000).toFixed(1)}s total.`);
  // A score on its own cannot tell two harnesses apart: one measured pair sat
  // inside the noise on pass rate and forty-fold apart on what it cost to get
  // there. So the cost of the score prints beside the score, every time.
  if (report.editTries) {
    const rate = Math.round((report.editFails / report.editTries) * 100);
    lines.push(`edits: ${report.editTries} attempted, ${report.editFails} did not apply (${rate}%).${rate > 10 ? ' Above one in ten, this is the biggest lever available: one adapter took a model from 19.1 to 73.4 per cent on the same benchmark purely by driving apply failures from 69.1 down to under 1.5.' : ''}`);
  }
  if (report.chars) {
    const per = report.passed ? `, ${Math.round(report.chars / 1000 / report.passed)}k per task finished` : '';
    lines.push(`context moved: ${Math.round(report.chars / 1000)}k characters${per} (characters, not tokens; the crude quarter puts it near ${Math.round(report.chars / 4000)}k tokens).`);
  }
  if (report.results.some((r) => r.tampered && r.tampered.length)) lines.push('A run that changed a graded file is not a pass, whatever the check exited: the check is only worth its exit code while it is the one the task shipped.');
  if (report.passed < report.total) lines.push('A failure here is the harness or the model, not the checker: the check command is the one a person would run by hand.');
  return lines.join('\n');
}
