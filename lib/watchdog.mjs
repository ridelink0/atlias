#!/usr/bin/env node
// One command, made to stop. lib/proc.mjs starts this file in place of the
// command itself, and this file starts the command and ends it, with everything
// it started, in three cases:
//   its time limit passes;
//   the process that asked for it goes away (killed, crashed, or just finished
//     without waiting), because on Windows nothing ends a child with its parent;
//   Ctrl+C or a terminate signal reaches this process.
// Ending it means the whole tree: taskkill /T on Windows, the process group on
// the others (the command is started as the leader of a group of its own).
//
// Why it exists: on 2026-09-26 a model-written make_palindrome that never
// returned ran under the eval, spawnSync's timeout ended only the shell that
// ran it, and three pythons held a core each for hours. An orphaned runner kept
// starting more.
//
// Usage: node watchdog.mjs '<json>' where the json is
//   { cmd, args, shell, cwd, timeoutMs, ppid }
// The command's stdout and stderr are passed through. How it ended is written
// as JSON lines on fd 3: first { pid } once it has started, then one verdict
//   { pid, code, signal, timedOut, orphaned, interrupted, error, ms }.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';

const spec = (() => { try { return JSON.parse(process.argv[2] || '{}'); } catch { return {}; } })();
const win = process.platform === 'win32';
const started = Date.now();
const asker = Number(spec.ppid) > 0 ? Number(spec.ppid) : process.ppid;
const firstParent = process.ppid;

function tell(obj) { try { fs.writeSync(3, `${JSON.stringify(obj)}\n`); } catch { /* nobody is reading fd 3 */ } }

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return Boolean(e) && e.code === 'EPERM'; }
}

function endTree(pid) {
  if (!pid) return;
  if (win) {
    try { spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, timeout: 15000, stdio: 'ignore' }); } catch { /* already gone */ }
    return;
  }
  // The command leads its own group, so the negative pid reaches every process
  // it started that did not leave the group on purpose.
  try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ } }
}

let child = null;
let timedOut = false;
let orphaned = false;
let interrupted = '';
let spawnError = '';
let ended = false;

function finish(code, signal) {
  if (ended) return;
  ended = true;
  clearTimeout(limit);
  clearInterval(watch);
  // Output still in flight is given a moment, then the pipes are let go: a
  // process that slipped out of the tree can hold them open for ever, and the
  // caller must not wait on it.
  const release = () => {
    for (const s of [child && child.stdout, child && child.stderr]) { try { if (s) { s.removeAllListeners('data'); s.destroy(); } } catch { /* closed */ } }
    tell({ pid: child ? child.pid : 0, code: typeof code === 'number' ? code : null, signal: signal || null, timedOut, orphaned, interrupted: interrupted || null, error: spawnError || null, dropped, ms: Date.now() - started });
    process.exitCode = typeof code === 'number' ? code : 1;
  };
  let closed = 0;
  const want = child && child.stdout && child.stderr ? 2 : 0;
  if (!want) { release(); return; }
  const grace = setTimeout(release, 1000);
  const onClose = () => { closed++; if (closed >= want) { clearTimeout(grace); release(); } };
  if (child.stdout.readableEnded || child.stdout.destroyed) onClose(); else child.stdout.once('close', onClose);
  if (child.stderr.readableEnded || child.stderr.destroyed) onClose(); else child.stderr.once('close', onClose);
}

const limitMs = Math.max(1, Number(spec.timeoutMs) || 600000);
const limit = setTimeout(() => { timedOut = true; if (child) endTree(child.pid); }, limitMs);
// Checked once a second. Elsewhere a process whose parent died is handed to a
// new parent, so a changed ppid is the signal; Windows keeps the old number, so
// the parent is asked whether it is still there.
const watch = setInterval(() => {
  const gone = win ? !alive(asker) : process.ppid !== firstParent || !alive(asker);
  if (gone && !orphaned) { orphaned = true; if (child) endTree(child.pid); }
}, 1000);

for (const sig of win ? ['SIGINT', 'SIGBREAK', 'SIGTERM'] : ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  try { process.on(sig, () => { interrupted = sig; if (child) endTree(child.pid); }); } catch { /* not on this platform */ }
}

try {
  child = spawn(String(spec.cmd || ''), Array.isArray(spec.args) ? spec.args.map(String) : [], {
    cwd: spec.cwd || undefined,
    shell: Boolean(spec.shell),
    detached: !win,
    windowsHide: true,
    // The null device, as spawnSync's empty input was: a command that waits for
    // input reads end of file instead of hanging until the limit.
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  spawnError = String(e && e.message ? e.message : e);
  finish(null, null);
}

// Output is passed on up to a cap and read and dropped after it. The caller
// buffers what it is given, and a caller that overflows its buffer ends this
// process: under spawnSync that is a kill of the watchdog alone, which would
// orphan the very command it exists to end. A model-written loop that prints
// for ever is ordinary, so the cap is here, where the tree is still in reach.
const CAP = Math.max(1024, Number(spec.maxOutput) || 8 * 1024 * 1024);
let passed = 0;
let dropped = 0;
function forward(stream, sink) {
  stream.on('data', (d) => {
    if (passed + d.length <= CAP) { passed += d.length; sink.write(d); return; }
    const room = Math.max(0, CAP - passed);
    if (room) { passed += room; sink.write(d.subarray(0, room)); }
    if (!dropped) sink.write(`\n[watchdog: output past ${CAP} bytes was dropped]\n`);
    dropped += d.length - room;
  });
}

if (child) {
  if (child.pid) tell({ pid: child.pid });
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);
  child.on('error', (e) => { spawnError = String(e && e.message ? e.message : e); finish(null, null); });
  child.on('exit', (code, signal) => finish(code, signal));
}
