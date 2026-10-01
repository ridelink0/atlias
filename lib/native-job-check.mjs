import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertJobUnchanged, digest, safeJobPath } from './native-job.mjs';
// Checks are explicit caller-owned argv, never supplied by the model response.
export function verifyStagedJob(job, staged, checks, { env, timeoutMs = 60000 } = {}) {
  if (!env || !Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000 || !checks || ['functional','adversarial'].some(k => !Array.isArray(checks[k]) || !checks[k].length || checks[k].some(x => typeof x !== 'string' || x.includes('\0')))) throw Error('explicit bounded functional and adversarial argv/environment required');
  if (['functional','adversarial'].some(k => /^(?:tsc|tsc\.cmd|tsc\.exe)$/i.test(path.basename(checks[k][0])))) throw Error('Gev forbids tsc; use real checks');
  if (staged.packetSha256 !== job.packetSha256 || staged.liveWorkspaceWritten !== false) throw Error('stage is not bound to job');
  const expected = job.packet.files.map(file => ({ path: file.path, sha256: digest(staged.edits.find(e => e.path === file.path)?.text ?? file.text) }));
  const stageUnchanged = () => {
    for (const file of expected) if (digest(fs.readFileSync(safeJobPath(staged.stage, file.path))) !== file.sha256) throw Error('staged source changed during checks');
  };
  assertJobUnchanged(job); stageUnchanged();
  const passes = [];
  for (const kind of ['functional','adversarial']) {
    const argv = checks[kind], start = Date.now();
    const p = spawnSync(argv[0], argv.slice(1), { cwd: staged.stage, env, windowsHide: true, timeout: timeoutMs, encoding: 'utf8', maxBuffer: 1024 * 1024 });
    passes.push({ kind, argv, exitCode: p.status, error: p.error?.code ?? null, stdout: p.stdout || '', stderr: p.stderr || '', ms: Date.now() - start, passed: p.status === 0 && !p.error });
    assertJobUnchanged(job); stageUnchanged();
  }
  return { status: passes.every(p => p.passed) ? 'verified-stage' : 'failed-stage', passes, liveWorkspaceWritten: false, packetSha256: job.packetSha256, limitation: 'Finite caller checks, not universal quality or a hostile-code security sandbox. Original project remains unchanged.' };
}
