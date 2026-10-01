import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { behaviorCases } from './behavior-cases.mjs';
const [study, ledgerFile, out] = process.argv.slice(2);
if (!study || !ledgerFile || !out) throw Error('usage: behavior-audit.mjs <study-dir> <frozen-ledger> <unused-out>');
assert.ok(!fs.existsSync(out), 'Preserve previous diagnostic evidence');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const ledger = fs.readFileSync(ledgerFile), rows = ledger.toString('utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const plan = JSON.parse(fs.readFileSync(path.join(study, 'plan.json')));
assert.equal(fs.readFileSync(path.join(study, 'plugin-sha.txt'), 'utf8').trim(), plan.sha);
const cases = behaviorCases(), worker = fileURLToPath(new URL('./behavior-worker.mjs', import.meta.url));
fs.mkdirSync(path.join(out, 'cases'), { recursive: true });
for (const [family, suite] of Object.entries(cases)) fs.writeFileSync(path.join(out, 'cases', `${family}.json`), JSON.stringify(suite));
const sourceFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry => {
  const file = path.join(dir, entry.name);
  if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) throw Error('unsupported model source entry');
  return entry.isDirectory() ? sourceFiles(file) : [file];
});
const results = [];
for (const row of rows) {
  assert.equal(row.taskSha256, plan.tasks.find(t => t.id === row.task)?.sha256);
  const family = row.family || row.task.replace(/^context-/, '').replace(/-64$/, '');
  assert.ok(cases[family], 'unknown family');
  const base = path.join(out, 'runs', `${row.task}-r${row.repeat}-${row.arm}`), ws = path.join(base, 'ws');
  assert.ok(!fs.existsSync(base), 'duplicate ledger row'); fs.mkdirSync(ws, { recursive: true });
  const original = path.join(row.base, 'ws', 'src'), files = sourceFiles(original);
  const before = files.map(file => ({ path: path.relative(original, file), sha256: hash(fs.readFileSync(file)) }));
  fs.cpSync(original, path.join(ws, 'src'), { recursive: true });
  fs.writeFileSync(path.join(ws, 'package.json'), '{"type":"module"}');
  const home = path.join(base, 'home'); fs.mkdirSync(home);
  const env = { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: path.join(home, '.claude'), ATLIAS_HOME: path.join(home, '.atlias') };
  for (const key of Object.keys(env)) if (/API_KEY|ACCESS_TOKEN|AUTH_TOKEN/.test(key)) delete env[key];
  const output = path.join(base, 'result.json');
  const proc = spawnSync(process.execPath, [worker, path.join(ws, 'src/api.mjs'), path.join(out, 'cases', `${family}.json`), output], { cwd: ws, env, encoding: 'utf8', timeout: 10000, windowsHide: true, maxBuffer: 1024 * 1024 });
  fs.writeFileSync(path.join(base, 'stderr.txt'), proc.stderr || '');
  assert.deepEqual(files.map(file => ({ path: path.relative(original, file), sha256: hash(fs.readFileSync(file)) })), before, 'original model source changed');
  const diagnostic = proc.status === 0 && fs.existsSync(output) ? JSON.parse(fs.readFileSync(output)) : null;
  results.push({ task: row.task, family, repeat: row.repeat, arm: row.arm, originalProtocolEligible: Boolean(row.valid && row.exitCode === 0 && !row.timedOut && Number.isFinite(row.promptRaw)), originalGrade: row.solved, modelSourceSha256: hash(JSON.stringify(before)), auditValid: Boolean(diagnostic), exitCode: proc.status, ...(diagnostic ? diagnostic : { error: 'copied-source audit could not complete; not a quality failure or success' }) });
}
assert.equal(hash(fs.readFileSync(ledgerFile)), hash(ledger), 'frozen ledger changed');
const pairs = [];
for (const a of results.filter(x => x.arm === 'plain')) {
  const b = results.find(x => x.arm === 'atlias' && x.task === a.task && x.repeat === a.repeat);
  if (!b || !a.auditValid || !b.auditValid) continue;
  const map = new Map(a.results.map(x => [x.id, x]));
  assert.deepEqual([...map.keys()].sort(), b.results.map(x => x.id).sort());
  pairs.push({ task: a.task, repeat: a.repeat, originalProtocolEligible: a.originalProtocolEligible && b.originalProtocolEligible, cases: a.cases, plainPassed: a.passed, atliasPassed: b.passed, regressions: b.results.filter(x => !x.passed && map.get(x.id).passed).map(x => x.id), improvements: b.results.filter(x => x.passed && !map.get(x.id).passed).map(x => x.id), differingObservedSerialization: b.results.filter(x => x.observableSha256 !== map.get(x.id).observableSha256).length });
}
const summary = { source: plan.sha, ledgerSha256: hash(ledger), caseSetSha256: hash(JSON.stringify(cases)), modelCalls: 0, callsAudited: results.length, completedAudits: results.filter(x => x.auditValid).length, pairs, limitations: ['Post-hoc finite behavioral probes; original protected graders and recorded grades unchanged.', 'Copied src modules only; missing external imports invalidate the audit rather than count as failure.', 'Version probes use arbitrary-length numeric components, as no component bound appears in the contract.', 'Object outputs compare JSON values; observed serialization differences alone are not contract regressions.', 'Invalid original model calls remain invalid, regardless of this diagnostic.', 'No universal output equivalence, inference token saving or benchmark release gate is established.'] };
for (const [name, data] of Object.entries({ 'summary.json': summary, 'results.json': results })) fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify({ source: plan.sha, calls: results.length, completed: summary.completedAudits, pairs: pairs.length, eligibleRegressions: pairs.filter(x=>x.originalProtocolEligible).reduce((s,x)=>s+x.regressions.length,0), out }));
