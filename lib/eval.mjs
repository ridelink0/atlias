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
  // The edit counters start at zero for every task. The spread is shallow, so a
  // state that already carries an editWhy would hand the same object to every
  // task, each would add into it, and runSuite would then sum the running
  // totals again.
  const st = { ...(state || {}), cwd: dir, messages: [], editTries: 0, editFails: 0, editWhy: {}, promptLog: [], numCtx: 0 };
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
  // Grader files the model must never see (CanItEdit hides its tests upstream)
  // reach the workspace only now, after the model has stopped, and they are
  // written over anything of the same name the run left behind.
  for (const [rel, body] of Object.entries(task.hidden || {})) {
    const p = path.join(dir, rel);
    try { ensureDir(path.dirname(p)); fs.writeFileSync(p, String(body)); } catch { /* score() then fails, which is the honest result */ }
  }
  const verdict = score(dir, task);
  const cheat = tamper(dir, task);
  // Why the agent stopped, in the harness's own words rather than prose an eval
  // report has to guess at: answered, malformed-output, truncated-output,
  // rounds-exhausted, model-error or context-full. A task that fails because the model could
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
    editWhy: st.editWhy || {},
    chars,
    // What the engine read each round, in its own tokens, and the window it read
    // it in (0 when the engine does not say). poly-A kept neither, which is how
    // a 4096-token default went unnoticed through 27 tasks.
    promptTokens: st.promptLog || [],
    peakPrompt: Math.max(0, ...(st.promptLog || []).filter((n) => typeof n === 'number')),
    numCtx: st.numCtx || 0,
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
    editWhy: results.reduce((acc, r) => {
      for (const a of r.attempts || [r]) for (const [k, v] of Object.entries(a.editWhy || {})) acc[k] = (acc[k] || 0) + v;
      return acc;
    }, {}),
    chars: results.reduce((n, r) => n + (r.attempts ? r.attempts.reduce((m, a) => m + (a.chars || 0), 0) : (r.chars || 0)), 0),
    tries,
    numCtx: Math.max(0, ...results.flatMap((r) => (r.attempts || [r]).map((a) => a.numCtx || 0))),
    peakPrompt: Math.max(0, ...results.flatMap((r) => (r.attempts || [r]).map((a) => a.peakPrompt || 0))),
    total: results.length,
    ms: Date.now() - started,
    // Which corpus this score came from: the tier, how much of it ran, and the
    // seed if it was a sample. A saved report that does not carry this cannot be
    // one arm of an A/B, because nothing says the other arm ran the same tasks.
    corpus: opts.corpus || null,
    stamp: opts.stamp === false ? null : harnessStamp(),
    engine: opts.engineName || (opts.state && opts.state.engine) || '',
    model: opts.model || '',
    budget: Number(opts.budget) > 0 ? Math.floor(Number(opts.budget)) : Math.max(1, cfg.maxToolRounds),
  };
}

// ---------- comparing two runs ----------
// Two scores are not a result either. At this corpus size the standard error is
// near sixteen points and one task flipping moves it twelve and a half, and
// published variance on agent benchmarks exceeds one and a half points at
// temperature zero, so "4 of 9 beats 3 of 9" is a sentence with no content.
// What has content is the paired question: of the tasks that changed, how many
// went each way, and would a coin have done that as often?
//
// McNemar's exact test, which is the right one here because the pairs are the
// same tasks under two configurations and the counts are tiny: only the
// disagreements carry information, and with n disagreements the two-sided p is
// the binomial tail at one half.
export function mcnemar(gained, lost) {
  const count = (x) => Math.max(0, Math.floor(Number(x) || 0));
  const b01 = count(gained);
  const b10 = count(lost);
  const n = b01 + b10;
  if (!n) return { n: 0, p: 1 };
  // Each term C(n, k) / 2^n is built in logs: past about a thousand
  // disagreements 2^-n underflows to zero and C(n, k) overflows to Infinity,
  // and their product is NaN, which would print as a p-value.
  let tail = 0;
  let logTerm = -n * Math.LN2;
  const lo = Math.min(b01, b10);
  for (let k = 0; k <= lo; k++) {
    tail += Math.exp(logTerm);
    logTerm += Math.log(n - k) - Math.log(k + 1);
  }
  return { n, p: Math.min(1, 2 * tail) };
}

// How many disagreements, all in one direction, this test needs before it could
// reach a given threshold at all. At alpha 0.05 the answer is six and does not
// depend on the corpus size: five one-way flips give a two-sided exact p of
// 2 x 0.5^5 = 0.0625. It matters most against a baseline that scores zero,
// because then only gains are available: the new arm has to fix six tasks the
// model has already failed before any p below 0.05 is even possible.
export function minFlips(alpha = 0.05) {
  const a = Number(alpha);
  if (!(a > 0) || a >= 1) return Infinity;
  for (let n = 1; n <= 200; n++) if (mcnemar(n, 0).p <= a) return n;
  return Infinity;
}

// The Wilson score interval on one arm's pass rate. "Position: Don't Use the
// CLT in LLM Evals With Fewer Than a Few Hundred Datapoints" (ICML 2025,
// arXiv 2503.01747) recommends Wilson or a Bayesian interval at this size, and
// the reason is visible on the number this harness actually produced: the
// normal interval on 0 of 27 is zero wide, which claims the corpus proved
// something it cannot, while Wilson says 0.0 to 12.5 per cent.
export function wilson(passes, n, z = 1.96) {
  const N = Math.max(0, Math.floor(Number(n) || 0));
  if (!N) return { lo: 0, hi: 1, rate: 0, n: 0 };
  const p = Math.min(1, Math.max(0, (Number(passes) || 0) / N));
  const z2 = z * z;
  const denom = 1 + z2 / N;
  const centre = (p + z2 / (2 * N)) / denom;
  const half = (z / denom) * Math.sqrt((p * (1 - p)) / N + z2 / (4 * N * N));
  return { lo: Math.max(0, centre - half), hi: Math.min(1, centre + half), rate: p, n: N };
}

// Lanczos, so a Beta posterior can be read without a dependency.
function logGamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const g = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  const y = x - 1;
  let a = 0.99999999999980993;
  for (let i = 0; i < g.length; i++) a += g[i] / (y + i + 1);
  const t = y + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (y + 0.5) * Math.log(t) - t + Math.log(a);
}

// Lentz's continued fraction for the incomplete beta, as in Numerical Recipes.
function betaContinued(a, b, x) {
  const TINY = 1e-300, EPS = 3e-16;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

// The regularized incomplete beta: P(X <= x) for X ~ Beta(a, b).
export function betaCdf(x, a, b) {
  if (!(x > 0)) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  // The fraction converges quickly only on one side of the mode, so past it the
  // complement is taken instead.
  return x < (a + 1) / (a + b + 2) ? (front * betaContinued(a, b, x)) / a : 1 - (front * betaContinued(b, a, 1 - x)) / b;
}

// Its inverse by bisection: forty iterations put the answer inside 1e-12, and
// bisection cannot wander off the way Newton can at the ends where these
// posteriors live.
export function betaQuantile(q, a, b) {
  const target = Math.min(1, Math.max(0, Number(q) || 0));
  if (target <= 0) return 0;
  if (target >= 1) return 1;
  let lo = 0, hi = 1;
  for (let i = 0; i < 200 && hi - lo > 1e-12; i++) {
    const mid = (lo + hi) / 2;
    if (betaCdf(mid, a, b) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// The paired interval the ICML paper recommends in place of a normal one: only
// the tasks that disagreed carry information, so the posterior goes on the
// share of those that went forward - a Beta with the Jeffreys prior, which is
// what bayes_evals uses for a rate - and the difference in pass rate is that
// share read back through how much of the corpus disagreed at all.
export function pairedInterval(gained, lost, tasks, { mass = 0.95 } = {}) {
  const count = (x) => Math.max(0, Math.floor(Number(x) || 0));
  const g = count(gained), l = count(lost), N = count(tasks);
  const m = g + l;
  if (!N) return { lo: 0, hi: 0, mean: 0, theta: null, discordant: 0, tasks: 0, why: 'no task is shared by the two runs' };
  if (!m) return { lo: 0, hi: 0, mean: 0, theta: null, discordant: 0, tasks: N, why: 'nothing went either way on any task, so there is no difference to spread' };
  const edge = (1 - Math.min(0.999999, Math.max(0, Number(mass) || 0.95))) / 2;
  const theta = {
    lo: betaQuantile(edge, g + 0.5, l + 0.5),
    hi: betaQuantile(1 - edge, g + 0.5, l + 0.5),
    mean: (g + 0.5) / (m + 1),
  };
  const share = m / N;
  return { lo: (2 * theta.lo - 1) * share, hi: (2 * theta.hi - 1) * share, mean: (g - l) / N, theta, discordant: m, tasks: N };
}

// A paired bootstrap over the same tasks, for the interval rather than the
// verdict: resample which tasks are in the corpus, not which way they went, so
// what it reports is how much of the difference is the corpus's own luck.
export function bootstrapDiff(pairs, rounds = 2000, rng = Math.random) {
  if (!pairs.length) return { lo: 0, hi: 0, mean: 0 };
  // At least one round, or the percentiles below read an empty list.
  rounds = Math.max(1, Math.floor(Number(rounds) || 0));
  // A pair may be two booleans (one attempt each) or two pass fractions (a
  // --repeat run), and a fraction must not be flattened to true/false here.
  const num = (v) => (typeof v === 'number' ? v : v ? 1 : 0);
  const diffs = pairs.map((x) => num(x.b) - num(x.a));
  const means = [];
  for (let r = 0; r < rounds; r++) {
    let sum = 0;
    for (let i = 0; i < diffs.length; i++) sum += diffs[Math.floor(rng() * diffs.length)];
    means.push(sum / diffs.length);
  }
  means.sort((x, y) => x - y);
  const at = (q) => means[Math.min(means.length - 1, Math.max(0, Math.round(q * (means.length - 1))))];
  return { lo: at(0.025), hi: at(0.975), mean: diffs.reduce((a, b) => a + b, 0) / diffs.length };
}

// Aligns two reports by task id and asks the paired question. A task only one
// of the two runs holds is reported as unpaired rather than counted as a
// difference, because a corpus that changed under the comparison is not a
// comparison.
export function compare(a, b, { rounds = 2000, rng = Math.random, alpha = 0.05 } = {}) {
  const byId = (rep) => new Map((rep && rep.results ? rep.results : []).map((r) => [r.id || r.name, r]));
  const A = byId(a), B = byId(b);
  // With --repeat, a task's result is a fraction, not a boolean, and the pairing
  // is on that fraction: a task that fell from two attempts of three to one is
  // one task moving, not two attempts moving. Testing over attempts would treat
  // correlated samples of the same task as independent trials, which is the
  // cheapest way there is to manufacture significance.
  const triesOf = (r) => Math.max(1, Math.floor(Number(r.tries) || 1));
  const fraction = (r) => {
    const t = triesOf(r);
    const passes = Number(r.passes);
    if (t > 1 && Number.isFinite(passes)) return Math.min(1, Math.max(0, passes / t));
    return r.pass ? 1 : 0;
  };
  const pairs = [], onlyA = [], onlyB = [];
  let tries = 1;
  for (const [id, ra] of A) {
    const rb = B.get(id);
    if (!rb) { onlyA.push(id); continue; }
    tries = Math.max(tries, triesOf(ra), triesOf(rb));
    pairs.push({ id, a: fraction(ra), b: fraction(rb), aPass: Boolean(ra.pass), bPass: Boolean(rb.pass) });
  }
  for (const id of B.keys()) if (!A.has(id)) onlyB.push(id);
  const gained = pairs.filter((x) => x.b > x.a);
  const lost = pairs.filter((x) => x.a > x.b);
  const test = mcnemar(gained.length, lost.length);
  const boot = bootstrapDiff(pairs, rounds, rng);
  const mean = (get) => (pairs.length ? pairs.reduce((n, x) => n + get(x), 0) / pairs.length : 0);
  const aPassed = pairs.filter((x) => x.aPass).length;
  const bPassed = pairs.filter((x) => x.bPass).length;
  return {
    pairs: pairs.length,
    aPassed,
    bPassed,
    // The mean pass fraction, which equals the pass count when each task ran
    // once and is the number the pairing above actually used when it did not.
    aRate: mean((x) => x.a),
    bRate: mean((x) => x.b),
    repeated: tries > 1,
    tries,
    gained: gained.map((x) => x.id),
    lost: lost.map((x) => x.id),
    onlyA, onlyB,
    p: test.p,
    changed: test.n,
    boot,
    alpha,
    // What this corpus could never have shown, printed beside what it did show.
    minFlips: minFlips(alpha),
    wilsonA: wilson(aPassed, pairs.length),
    wilsonB: wilson(bPassed, pairs.length),
    paired: pairedInterval(gained.length, lost.length, pairs.length),
    // The honest wording, and the threshold is stated rather than implied.
    verdict: test.n === 0 ? 'nothing changed on any task'
      : test.p > alpha ? 'inside the noise: a coin lands this way about as often'
        : 'a real difference at the usual threshold',
  };
}

export function formatCompare(c, aName = 'A', bName = 'B') {
  const lines = [];
  const unpaired = () => {
    if (c.onlyA.length || c.onlyB.length) lines.push(`Unpaired and therefore ignored: ${[...c.onlyA.map((i) => `${i} only in ${aName}`), ...c.onlyB.map((i) => `${i} only in ${bName}`)].join(', ')}.`);
  };
  // No task in common is not a tie: there is nothing to compare, and printing
  // 0/0, a p of one and an interval of zero would dress that up as a result.
  if (!c.pairs) {
    lines.push(`${aName} and ${bName} share no task, so there is nothing to compare.`);
    unpaired();
    return lines.join('\n');
  }
  const pc = (x) => (x * 100).toFixed(1);
  lines.push(`${aName} ${c.aPassed}/${c.pairs} against ${bName} ${c.bPassed}/${c.pairs}, on the ${c.pairs} task(s) both runs hold.`);
  unpaired();
  if (c.repeated) lines.push(`Paired on each task's pass fraction over ${c.tries} attempts (${pc(c.aRate)} against ${pc(c.bRate)} per cent of attempts): a task counts once, whichever way it moved.`);
  lines.push(`${c.gained.length} task(s) gained${c.gained.length ? ` (${c.gained.join(', ')})` : ''}, ${c.lost.length} lost${c.lost.length ? ` (${c.lost.join(', ')})` : ''}.`);
  // The same exact binomial tail either way; on fractions over tasks it is the
  // sign test, and calling it McNemar would invite the reader to think the
  // attempts were the unit.
  lines.push(`${c.repeated ? 'Paired sign test over tasks (exact binomial)' : 'McNemar exact'} p = ${c.p.toFixed(3)} on ${c.changed} disagreement(s): ${c.verdict}.`);
  // What this corpus could never have shown. A 0/27 baseline has only gains
  // available, so without this line a two-task improvement reads as progress.
  if (c.minFlips) {
    const short = c.changed < c.minFlips;
    lines.push(`Minimum detectable: ${c.minFlips} one-way flips are needed for p < ${c.alpha}; this corpus has ${c.pairs} task(s) and ${c.changed} disagreement(s)${short ? `, so no p below ${c.alpha} was reachable however the tasks fell` : ''}.`);
  }
  if (c.wilsonA && c.wilsonB) lines.push(`Wilson 95 per cent interval on the pass rate: ${aName} ${pc(c.wilsonA.lo)} to ${pc(c.wilsonA.hi)}, ${bName} ${pc(c.wilsonB.lo)} to ${pc(c.wilsonB.hi)}${c.repeated ? ' (on tasks finished on every attempt)' : ''}.`);
  if (c.paired) {
    lines.push(c.paired.discordant
      ? `Paired interval on the ${c.paired.discordant} disagreement(s) (Beta posterior, Jeffreys prior): ${pc(c.paired.mean)} points, 95 per cent ${pc(c.paired.lo)} to ${pc(c.paired.hi)}.`
      : `Paired interval: ${pc(c.paired.mean)} points - ${c.paired.why}.`);
  }
  lines.push(`Paired bootstrap on the pass rate: ${pc(c.boot.mean)} points, 95 per cent interval ${pc(c.boot.lo)} to ${pc(c.boot.hi)}.`);
  // The percentile bootstrap is the number most likely to be quoted from this
  // report and the least trustworthy at this size (arXiv 2503.01747).
  if (c.pairs < 100) lines.push(`That bootstrap is unreliable below about 100 tasks (this corpus has ${c.pairs}); the paired interval above is the one to read.`);
  if (c.pairs < 30) lines.push(`A corpus of ${c.pairs} cannot resolve a small difference: one task flipping moves the score ${(100 / c.pairs).toFixed(1)} points, which is larger than most changes worth arguing about.`);
  return lines.join('\n');
}

export function format(report) {
  const lines = [];
  if (report.stamp) lines.push(`harness: ${report.stamp.text}${report.stamp.dirty ? ` (uncommitted: ${report.stamp.dirtyFiles.join(', ')})` : ''}`);
  const bits = [];
  if (report.engine) bits.push(`engine ${report.engine}`);
  if (report.model) bits.push(`model ${report.model}`);
  if (report.budget) bits.push(`${report.budget} rounds`);
  if (report.numCtx) bits.push(`context ${report.numCtx} tokens, largest prompt ${report.peakPrompt || 0}`);
  if (report.tries > 1) bits.push(`${report.tries} attempts each`);
  if (bits.length) lines.push(`ran with: ${bits.join(', ')}`);
  if (report.corpus) {
    const c = report.corpus;
    lines.push(`corpus: ${c.tier} tier, ${c.tasks} task(s)${c.of && c.of !== c.tasks ? ` of ${c.of}` : ''}${c.seed ? `, sampled with seed "${c.seed}"` : ''}`);
  }
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
    // The causes, worst first. The rate alone says there is a problem; only the
    // distribution says which problem, and a near-miss and a missing file have
    // nothing in common as fixes.
    const why = Object.entries(report.editWhy || {}).sort((a, b) => b[1] - a[1]);
    if (why.length) lines.push(`  why: ${why.map(([k, v]) => `${k} ${v}`).join(', ')}`);
  }
  if (report.chars) {
    const per = report.passed ? `, ${Math.round(report.chars / 1000 / report.passed)}k per task finished` : '';
    lines.push(`context moved: ${Math.round(report.chars / 1000)}k characters${per} (characters, not tokens; the crude quarter puts it near ${Math.round(report.chars / 4000)}k tokens).`);
  }
  if (report.results.some((r) => r.tampered && r.tampered.length)) lines.push('A run that changed a graded file is not a pass, whatever the check exited: the check is only worth its exit code while it is the one the task shipped.');
  if (report.passed < report.total) lines.push('A failure here is the harness or the model, not the checker: the check command is the one a person would run by hand.');
  return lines.join('\n');
}
