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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDir, STATE_DIR, run } from './core.mjs';
import * as loop from './loop.mjs';

export const TASKS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'evals');

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
  let reply = '', error = null;
  try {
    reply = await loop.runLoop(st, task.prompt, { chat, say: () => {}, ask: async () => true });
  } catch (e) {
    error = e && e.message ? e.message : String(e);
  }
  const verdict = score(dir, task);
  const rounds = (st.messages || []).filter((m) => m.role === 'assistant').length;
  const chars = JSON.stringify(st.messages || []).length;
  const pass = verdict.pass && !error;
  if (!keep && pass) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* leave it */ } }
  return {
    id: task.id,
    name: task.name || task.id,
    pass,
    why: error ? `the agent stopped: ${error}` : verdict.why,
    output: verdict.output || '',
    rounds,
    chars,
    ms: Date.now() - t0,
    workspace: pass && !keep ? null : dir,
    said: String(reply || '').slice(0, 300),
  };
}

export async function runSuite(tasks, opts = {}) {
  const started = Date.now();
  const results = [];
  for (const t of tasks) results.push(await runTask(t, { ...opts, stamp: `${Date.now()}-${results.length}` }));
  return { results, passed: results.filter((r) => r.pass).length, total: results.length, ms: Date.now() - started };
}

export function format(report) {
  const lines = [];
  for (const r of report.results) {
    lines.push(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  (${r.rounds} rounds, ${(r.ms / 1000).toFixed(1)}s)`);
    if (!r.pass) {
      lines.push(`      ${r.why}`);
      if (r.output) lines.push(`      ${r.output.split('\n').slice(0, 4).join('\n      ')}`);
      if (r.workspace) lines.push(`      workspace kept: ${r.workspace}`);
    }
  }
  lines.push('');
  lines.push(`${report.passed}/${report.total} tasks finished, ${(report.ms / 1000).toFixed(1)}s total.`);
  if (report.passed < report.total) lines.push('A failure here is the harness or the model, not the checker: the check command is the one a person would run by hand.');
  return lines.join('\n');
}
