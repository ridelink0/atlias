import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { loadTaskList, writeFiles } from '../ccstudy/run.mjs';
import { brokerRecipe } from './broker-run.mjs';
import { prepareJob } from '../../lib/native-job.mjs';
import { fileURLToPath } from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const tasks=loadTaskList(path.join(repo,'evals/context-heldout/manifest.json'),repo).filter(t=>t.id.endsWith('-64'));
const root=fs.mkdtempSync(path.join(os.tmpdir(),'gev-broker-protocol-'));let checks=0;const sizes=[];
try {
  assert.equal(tasks.length,12);checks++;
  for(const task of tasks){
    const recipe=brokerRecipe(task),ws=path.join(root,task.id);fs.mkdirSync(ws);writeFiles(ws,task.files);
    assert.deepEqual(recipe.writePaths,['src/policy.mjs']);checks++;
    assert.equal(recipe.readPaths.length,5);checks++;
    assert.ok(recipe.readPaths.every(p=>!Object.hasOwn(task.hidden,p)));checks++;
    const job=prepareJob({root:ws,task:task.prompt,instructions:['The user is Gev. No emojis.'],...recipe});
    assert.equal(job.packet.task,task.prompt);checks++;
    assert.equal(job.packet.files.find(f=>f.path==='docs/contract.md').text,task.files['docs/contract.md']);checks++;
    sizes.push(Buffer.byteLength(job.serialized));
  }
  assert.throws(()=>brokerRecipe({...tasks[0],files:{'src/api.mjs':'x'}}));checks++;
  assert.throws(()=>brokerRecipe({...tasks[0],protect:[...tasks[0].protect,'src/policy.mjs']}));checks++;
  assert.throws(()=>brokerRecipe({...tasks[0],hidden:{...tasks[0].hidden,'docs/contract.md':'private'}}));checks++;
  console.log(`${checks} broker protocol/recipe controls passed;12 full contracts;packet bytes${Math.min(...sizes)}..${Math.max(...sizes)};zero model calls or token-saving claim.`);
}finally{const resolved=fs.realpathSync(root);assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('gev-broker-protocol-'));fs.rmSync(resolved,{recursive:true,force:true});}
