// Driver controls use Node as an intentionally invalid native executable.
// They never reach a model or a real subscription credential.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gev-native-runner-'));
let checks = 0;
try {
  const source = path.join(root, 'source'); fs.mkdirSync(source); fs.writeFileSync(path.join(source, 'api.mjs'), 'export const value=1;');
  const spec = { root: source, task: 'Change value to2.', instructions: ['The user is Gev. No emojis.'], readPaths: ['api.mjs'], writePaths: ['api.mjs'], model: 'gpt-6.1-sol', effort: 'medium' };
  const input = path.join(root, 'job.json'); fs.writeFileSync(input, JSON.stringify(spec));
  const meter = path.join(root, 'fake-meter.mjs'); fs.writeFileSync(meter, 'console.log(JSON.stringify({windows:[{label:"fixture",percentUsed:0}]}))');
  const auth = path.join(root, 'fake-auth.json'); fs.writeFileSync(auth, JSON.stringify({ tokens: { access_token: 'fixture-no-actual-token' } }));
  const runner = fileURLToPath(new URL('./run.mjs', import.meta.url));
  const run = (out, flags = []) => spawnSync(process.execPath, [runner, '--host', 'codex', '--job', input, '--out', out, '--native', process.execPath, ...flags], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  const prepared = path.join(root, 'prepared'), a = run(prepared);
  assert.equal(a.status, 0, a.stderr); checks++;
  assert.equal(JSON.parse(fs.readFileSync(path.join(prepared, 'plan.json'))).calls, 0); checks++;
  assert.equal(fs.existsSync(path.join(prepared, 'home')), false); checks++;
  assert.notEqual(run(prepared).status, 0); checks++;
  assert.notEqual(run(path.join(source, 'unsafe-output')).status, 0); checks++;
  const failed = path.join(root, 'failed'), b = run(failed, ['--run', '--usage-cli', meter, '--subscription-auth', auth]);
  assert.equal(b.status, 1, b.stderr); checks++;
  const result = JSON.parse(fs.readFileSync(path.join(failed, 'result.json')));
  assert.equal(result.calls, 1); checks++;
  assert.equal(result.authRemoved, true); checks++;
  assert.equal(result.verified, false); checks++;
  assert.equal(result.staged, null); checks++;
  assert.equal(fs.existsSync(path.join(failed, 'home/.codex/auth.json')), false); checks++;
  assert.equal(fs.readFileSync(path.join(source, 'api.mjs'), 'utf8'), 'export const value=1;'); checks++;
  fs.writeFileSync(meter, 'console.log(JSON.stringify({windows:[{percentUsed:100}]}))');
  const blocked = path.join(root, 'blocked'), c = run(blocked, ['--run', '--usage-cli', meter, '--subscription-auth', auth]);
  assert.equal(c.status, 1); checks++;
  assert.equal(JSON.parse(fs.readFileSync(path.join(blocked, 'plan.json'))).calls, 0); checks++;
  assert.equal(fs.existsSync(path.join(blocked, 'home')), false); checks++;
  const second=path.join(root,'second');fs.mkdirSync(second);fs.writeFileSync(path.join(second,'api.mjs'),'export const value=1;');
  fs.writeFileSync(input,JSON.stringify({model:spec.model,effort:spec.effort,jobs:[{...spec,id:'a'},{...spec,root:second,id:'b'}]}));
  const batchOut=path.join(root,'batch-prepared'),batchPrepared=run(batchOut);
  assert.equal(batchPrepared.status,0,batchPrepared.stderr);checks++;
  const batchPlan=JSON.parse(fs.readFileSync(path.join(batchOut,'plan.json')));
  assert.equal(batchPlan.profile,'experimental-independent-batch-v1');checks++;
  assert.equal(batchPlan.jobs.length,2);checks++;
  assert.equal(batchPlan.calls,0);checks++;
  assert.notEqual(run(path.join(second,'unsafe-batch-output')).status,0);checks++;
  const partial={model:spec.model,effort:spec.effort,jobs:[{...spec,id:'a',checks:{functional:['node','--check','api.mjs'],adversarial:['node','--check','api.mjs']}},{...spec,root:second,id:'b'}]};
  fs.writeFileSync(input,JSON.stringify(partial));assert.notEqual(run(path.join(root,'partial-checks')).status,0);checks++;
  console.log(`${checks} native-runner preparation/failure/accounting controls passed; zero model calls.`);
} finally {
  const resolved = fs.realpathSync(root); assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir())); assert.ok(path.basename(resolved).startsWith('gev-native-runner-'));
  fs.rmSync(resolved, { recursive: true, force: true });
}
