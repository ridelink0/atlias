import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [api, suiteFile, outputFile] = process.argv.slice(2);
const suite = JSON.parse(fs.readFileSync(suiteFile));
const { repair } = await import(pathToFileURL(api));
assert.equal(typeof repair, 'function', 'API must export repair');
const family = path.basename(suiteFile, '.json');
const immutable = new Set(['versions', 'intervals', 'merge', 'pagination', 'topology', 'dedupe']);
const results = [];
for (const test of suite) {
  const args = structuredClone(test.args), before = JSON.stringify(args);
  let value, error, rejected = false, passed = true, why = '';
  try { value = repair(...args); } catch (e) { rejected = true; error = e; }
  try {
    if (test.expected.kind === 'throws') { assert.ok(rejected, 'required rejection absent'); if (test.expected.name) assert.equal(error?.name, test.expected.name); }
    else {
      assert.equal(rejected, false, 'unexpected rejection');
      if (test.expected.map) { assert.ok(value instanceof Map, 'must return a Map'); value = [...value]; }
      assert.deepEqual(JSON.parse(JSON.stringify(value)), test.expected.value, 'contract output differs');
    }
    if (immutable.has(family)) assert.equal(JSON.stringify(args), before, 'input mutated');
    assert.equal(Object.prototype.gevAuditPolluted, undefined, 'prototype polluted');
    if (test.expected.kind === 'value' && Array.isArray(test.args[0]) && value && !Array.isArray(value) && typeof value === 'object') {
      // Only the merge contract requires arrays in its output to be copies.
      if (family === 'merge') {
        const inputArrays = [];
        const walk = (x, visit) => { if (x && typeof x === 'object') { visit(x); for (const child of Object.values(x)) walk(child, visit); } };
        walk(args, x => { if (Array.isArray(x)) inputArrays.push(x); });
        walk(value, x => { if (Array.isArray(x)) assert.ok(!inputArrays.includes(x), 'merge output aliases input array'); });
      }
    }
  } catch (e) { passed = false; why = String(e.message).split('\n')[0]; }
  let observable;
  try { observable = JSON.stringify(rejected ? { throws: error?.name ?? typeof error } : { value }); } catch { observable = 'unserializable'; }
  results.push({ id: test.id, passed, ...(why ? { why } : {}), observableSha256: crypto.createHash('sha256').update(observable).digest('hex') });
}
fs.writeFileSync(outputFile, JSON.stringify({ cases: suite.length, passed: results.filter(x => x.passed).length, results }) + '\n');
