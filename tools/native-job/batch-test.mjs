import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {prepareBatch,validateBatch,stageBatch,assertBatchUnchanged,batchStageSnapshot} from '../../lib/native-job-batch.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'gev-native-batch-'));let checks=0;
try{
  const specs=['a','b'].map(id=>{const dir=path.join(root,id);fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'api.mjs'),'export const value=1;');return {id,root:dir,task:'Set value to2; preserve the export.',instructions:['Gev: no emojis; functional then adversarial checks.'],readPaths:['api.mjs'],writePaths:['api.mjs']};});
  const batch=prepareBatch(specs);assert.equal(batch.packet.jobs.length,2);checks++;
  assert.deepEqual(batch.packet.jobs.map(x=>x.packet.task),specs.map(x=>x.task));checks++;
  const response={batchSha256:batch.batchSha256,jobs:batch.jobs.map(({id,job})=>({id,packetSha256:job.packetSha256,edits:[{path:'api.mjs',beforeSha256:job.packet.files[0].sha256,text:'export const value=2;'}]}))};
  assert.equal(validateBatch(batch,JSON.stringify(response)).length,2);checks++;
  for(const mutate of [x=>x.jobs.pop(),x=>x.jobs.push(x.jobs[0]),x=>x.jobs[1].id='a',x=>x.jobs[0].id='unknown',x=>x.jobs[0].packetSha256='bad',x=>x.batchSha256='bad',x=>x.jobs[0].edits[0].path='../escape',x=>x.extra=true]){const changed=structuredClone(response);mutate(changed);assert.throws(()=>validateBatch(batch,JSON.stringify(changed)));checks++;}
  assert.throws(()=>prepareBatch([specs[0],{...specs[1],id:'a'}]));checks++;
  assert.throws(()=>prepareBatch([specs[0],{...specs[1],root:specs[0].root}]));checks++;
  assert.throws(()=>prepareBatch([specs[0],{...specs[1],id:'con'}]));checks++;
  assert.throws(()=>prepareBatch([specs[0]]));checks++;
  assert.throws(()=>stageBatch(batch,JSON.stringify(response),path.join(specs[1].root,'bad-stage')));checks++;
  const stage=stageBatch(batch,JSON.stringify(response),path.join(root,'stage'));
  for(const {id,staged} of stage.stages){assert.equal(fs.readFileSync(path.join(staged.stage,'api.mjs'),'utf8'),'export const value=2;');checks++;assert.equal(fs.readFileSync(path.join(root,id,'api.mjs'),'utf8'),'export const value=1;');checks++;}
  assert.throws(()=>stageBatch(batch,JSON.stringify(response),stage.stage));checks++;
  const snapshot=batchStageSnapshot(batch,stage);
  const other=path.join(stage.stages[1].staged.stage,'api.mjs');
  fs.writeFileSync(other,'export const value=99;');
  assert.notEqual(batchStageSnapshot(batch,stage),snapshot);checks++;
  fs.writeFileSync(other,'export const value=2;');
  assert.equal(batchStageSnapshot(batch,stage),snapshot);checks++;
  fs.writeFileSync(path.join(specs[1].root,'api.mjs'),'concurrent change');
  assert.throws(()=>assertBatchUnchanged(batch));checks++;
  assert.throws(()=>validateBatch(batch,JSON.stringify(response)));checks++;
  console.log(`${checks} independent batch binding/staging controls passed; zero model calls, no efficiency or parity claim.`);
}finally{const resolved=fs.realpathSync(root);if(path.dirname(resolved)!==fs.realpathSync(os.tmpdir())||!path.basename(resolved).startsWith('gev-native-batch-'))throw Error('unexpected cleanup path');fs.rmSync(resolved,{recursive:true,force:true});}
