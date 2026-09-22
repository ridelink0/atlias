// graphify bridge. The graph is the cheapest way into a codebase: a query
// costs a few hundred tokens where a file walk costs thousands. Everything here
// degrades to "no graph" silently when graphify or python is missing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, graphify, graphPath, exists, mtime, readJson, writeJson, projectDir, tryLock, unlock, detach, findPython, log, clip, isCodeFile, HOME } from './core.mjs';

const HOOKS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'hooks.mjs');
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'outputs', '.next', '.expo', 'android', 'ios', 'graphify-out', '__pycache__', '.venv', 'venv', 'target', 'coverage', '.gradle', 'Pods']);

export function age(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 2) return 'in the last minute';
  if (m < 120) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} hours ago` : `${Math.round(h / 24)} days ago`;
}

export function countCodeFiles(cwd, max) {
  let n = 0;
  const stack = [cwd];
  while (stack.length && n <= max) {
    const dir = stack.pop();
    let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of ents) {
      if (e.isDirectory()) { if (!SKIP.has(e.name) && !e.name.startsWith('.')) stack.push(path.join(dir, e.name)); }
      else if (isCodeFile(e.name)) { n++; if (n > max) break; }
    }
  }
  return n;
}

export function status(cwd) {
  const gp = graphPath(cwd);
  const cfg = config();
  if (exists(gp)) return { exists: true, path: gp, age: age(mtime(gp)) };
  const norm = (p) => path.resolve(String(p)).replace(/[\\/]+$/, '').toLowerCase();
  const home = norm(cwd) === norm(HOME);
  const canBuild = !home && Boolean(findPython()) && countCodeFiles(cwd, 20) >= 5 && countCodeFiles(cwd, cfg.graph.maxFilesForAutoBuild) <= cfg.graph.maxFilesForAutoBuild;
  return { exists: false, path: gp, canBuild };
}

export function godNodes(cwd, n) {
  const gp = graphPath(cwd);
  const cache = path.join(projectDir(cwd), 'godnodes.json');
  const c = readJson(cache);
  if (c && c.mtime === mtime(gp) && c.n === n) return c.text;
  const r = graphify(['god-nodes', '--top', String(n), '--graph', gp], { timeout: 15000, cwd });
  if (r.status !== 0) { log(`god-nodes failed: ${r.stderr || r.error}`); return ''; }
  const text = r.stdout.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^(god nodes|top|most connected)/i.test(l)).slice(0, n).map((l) => l.replace(/\s+/g, ' ')).join('; ');
  writeJson(cache, { mtime: mtime(gp), n, text });
  return text;
}

export function query(cwd, question, budget) {
  const gp = graphPath(cwd);
  if (!exists(gp)) return null;
  const r = graphify(['query', question, '--budget', String(budget || 600), '--graph', gp], { timeout: 12000, cwd });
  if (r.status !== 0) { log(`graph query failed: ${clip(r.stderr || r.error, 300)}`); return null; }
  const out = r.stdout.trim();
  if (!out || /^(no (relevant )?(nodes|results|matches)|nothing found)/i.test(out)) return null;
  return clip(out, 5000);
}

export function sub(cwd, cmd, arg, extra = []) {
  const gp = graphPath(cwd);
  if (!exists(gp)) return null;
  const r = graphify([cmd, arg, '--graph', gp, ...extra], { timeout: 15000, cwd });
  return r.status === 0 ? clip(r.stdout.trim(), 6000) : null;
}

// ---- background update with debounce and a single worker per project ----
export function dirtyPath(cwd) { return path.join(projectDir(cwd), '.graph_dirty'); }
export function isDirty(cwd) { return exists(dirtyPath(cwd)); }
export function scheduleUpdate(cwd, opts = {}) {
  try { fs.writeFileSync(dirtyPath(cwd), String(Date.now())); } catch { return false; }
  const lock = path.join(projectDir(cwd), '.graph.lock');
  if (!tryLock(lock, 15 * 60 * 1000)) return true; // a worker is already waiting
  const ok = detach([HOOKS, 'graph-worker', cwd, opts.build ? 'build' : 'update'], { cwd, env: { ATLIAS_GRAPH_LOCK: lock } });
  if (!ok) unlock(lock);
  return ok;
}
export function updateNow(cwd) {
  try { fs.unlinkSync(dirtyPath(cwd)); } catch { /* not dirty */ }
  const r = graphify(['update', cwd], { timeout: 10 * 60 * 1000, cwd });
  if (r.status !== 0) log(`graphify update failed in ${cwd}: ${clip(r.stderr || r.error, 400)}`);
  return r.status === 0;
}
export function worker([cwd, mode]) {
  cwd = cwd || process.cwd();
  const cfg = config();
  const lock = process.env.ATLIAS_GRAPH_LOCK || path.join(projectDir(cwd), '.graph.lock');
  const wait = mode === 'build' ? 2000 : cfg.graph.updateDebounceMs;
  setTimeout(() => {
    try {
      let rounds = 0;
      do { updateNow(cwd); rounds++; } while (isDirty(cwd) && rounds < 3);
    } catch (e) { log(`graph worker failed: ${e.stack || e}`); } finally { unlock(lock); }
  }, wait);
}
