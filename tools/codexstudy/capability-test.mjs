import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {capabilityTasks,writeCapabilityCorpus} from './capability-corpus.mjs';
import {writeFiles,loadTaskList} from '../ccstudy/run.mjs';
import {score,tamper} from '../../lib/eval.mjs';
import {prepareJob} from '../../lib/native-job.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'gev-capability-controls-'));
let checks=0;
try {
  const fixtures=capabilityTasks();assert.equal(fixtures.length,6);checks++;
  assert.equal(new Set(fixtures.map(x=>x.task.id)).size,6);checks++;
  const manifest=writeCapabilityCorpus(root),loaded=loadTaskList(path.join(root,'evals/capability-heldout/manifest.json'),root);
  assert.deepEqual(loaded.map(x=>x.id),fixtures.map(x=>x.task.id));checks++;
  assert.deepEqual(writeCapabilityCorpus(root),manifest);checks++;
  for(const {task,reference} of fixtures){
    const base=path.join(root,task.id);fs.mkdirSync(base);writeFiles(base,task.files);
    assert.equal(fs.existsSync(path.join(base,'protected-grade.mjs')),false);checks++;
    writeFiles(base,task.hidden);
    assert.equal(score(base,task).pass,false,task.id+' broken seed must fail');checks++;
    writeFiles(base,reference);
    const result=score(base,task);assert.equal(result.pass,true,task.id+': '+result.output);checks++;
    assert.equal(tamper(base,task).files.length,0);checks++;
    // A successful implementation cannot hide a broken writable source.
    const first=Object.keys(reference)[0];fs.writeFileSync(path.join(base,first),'throw new Error("mutant");\n');
    assert.equal(score(base,task).pass,false,task.id+' mutant must fail');checks++;
    writeFiles(base,reference);
    fs.writeFileSync(path.join(base,'docs/contract.md'),'Weakened contract');
    assert.ok(tamper(base,task).files.some(x=>x.file==='docs/contract.md'));checks++;
  }
  // Real limitations of bounded-patch v1: neither new-file nor >32-file jobs
  // may silently masquerade as the full native workflow.
  const creation=fixtures[0],newRoot=path.join(root,'admission-new');fs.mkdirSync(newRoot);writeFiles(newRoot,creation.task.files);
  assert.throws(()=>prepareJob({root:newRoot,task:creation.task.prompt,instructions:['Gev'],readPaths:Object.keys(creation.task.files),writePaths:['src/strict.mjs']}));checks++;
  const large=fixtures.find(x=>x.task.family==='large-dependency-discovery'),largeRoot=path.join(root,'admission-large');fs.mkdirSync(largeRoot);writeFiles(largeRoot,large.task.files);
  assert.throws(()=>prepareJob({root:largeRoot,task:large.task.prompt,instructions:['Gev'],readPaths:Object.keys(large.task.files),writePaths:['src/module-39.mjs']}));checks++;
  const source=path.join(root,manifest.tasks[0].file);fs.appendFileSync(source,' ');
  assert.throws(()=>loadTaskList(path.join(root,'evals/capability-heldout/manifest.json'),root),/hash changed/);checks++;
  console.log(`${checks} capability controls passed; six new workflow families; zero model calls. Bounded-worker parity remains unproved.`);
} finally {
  const resolved=fs.realpathSync(root);
  if(path.dirname(resolved)!==fs.realpathSync(os.tmpdir())||!path.basename(resolved).startsWith('gev-capability-controls-'))throw Error('unexpected cleanup path');
  fs.rmSync(resolved,{recursive:true,force:true});
}
