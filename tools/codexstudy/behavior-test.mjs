import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { behaviorCases } from './behavior-cases.mjs';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gev-behavior-control-'));
const worker = fileURLToPath(new URL('./behavior-worker.mjs', import.meta.url));
let checks = 0;
try {
  const cases = behaviorCases();
  assert.deepEqual(cases, behaviorCases()); checks++;
  assert.equal(Object.keys(cases).length, 12); checks++;
  assert.equal(Object.values(cases).flat().length, 1260); checks++;
  for (const suite of Object.values(cases)) { assert.equal(new Set(suite.map(x => x.id)).size, suite.length); checks++; }
  const run = (name, suite, source) => {
    const api = path.join(root, `${name}.mjs`), input = path.join(root, `${name}.json`), out = path.join(root, `${name}-out.json`);
    fs.writeFileSync(api, source); fs.writeFileSync(input, JSON.stringify(suite));
    const r = spawnSync(process.execPath, [worker, api, input, out], { encoding: 'utf8', timeout: 10000, windowsHide: true });
    assert.equal(r.status, 0, `${name}: ${r.error?.code || ''} ${r.stderr || ''}`); return JSON.parse(fs.readFileSync(out));
  };
  const money = run('money', cases.money, `export function repair(values) { let sum=0n; for(const value of values) { if(typeof value!=='string'||!/^[-]?\\d+(?:\\.\\d{1,2})?$/.test(value))throw new TypeError('price'); const negative=value.startsWith('-'),parts=(negative?value.slice(1):value).split('.');const cents=BigInt(parts[0])*100n+BigInt((parts[1]||'').padEnd(2,'0'));sum+=negative?-cents:cents;}return Number(sum); }`);
  assert.equal(money.passed, money.cases); checks++;
  const query = run('query', cases.query, `export function repair(input) { const result=new Map();for(const pair of input.replace(/^\\?/,'').split('&').filter(Boolean)){const index=pair.indexOf('='),decode=x=>decodeURIComponent(x.replaceAll('+',' ')),key=decode(index<0?pair:pair.slice(0,index)),value=decode(index<0?'':pair.slice(index+1));if(!result.has(key))result.set(key,[]);result.get(key).push(value);}return result; }`);
  assert.equal(query.passed, query.cases); checks++;
  const broken = run('money-broken', cases.money, `export function repair(values) { return values.reduce((s,v)=>s+Math.floor(Number(v)*100),0); }`);
  assert.ok(broken.passed < broken.cases); checks++;
  const mutation = run('versions', [{ id: 'mutate', args: [['2', '1']], expected: { kind: 'value', value: ['1', '2'] } }], `export function repair(values) { return values.sort(); }`);
  assert.equal(mutation.passed, 0); assert.match(mutation.results[0].why, /input mutated/); checks++;
  const throwsNull = run('throws-null', [{ id: 'reject', args: [], expected: { kind: 'throws' } }], 'export function repair(){ throw null; }');
  assert.equal(throwsNull.passed, 1); checks++;
  const wrongType = run('throws-wrong-type', [{ id: 'reject', args: [], expected: { kind: 'throws', name: 'TypeError' } }], 'export function repair(){ throw null; }');
  assert.equal(wrongType.passed, 0); checks++;
  console.log(`${checks} behavioral-audit controls passed;1260 seeded cases;no model quality or token claim.`);
} finally {
  const resolved = fs.realpathSync(root), parent = fs.realpathSync(os.tmpdir());
  assert.equal(path.dirname(resolved), parent); assert.ok(path.basename(resolved).startsWith('gev-behavior-control-'));
  fs.rmSync(resolved, { recursive: true, force: true });
}
