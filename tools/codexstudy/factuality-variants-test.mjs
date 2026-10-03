import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {factualityVariants,writeFactualityVariants} from './factuality-variants-corpus.mjs';
import {factualityTasks} from './factuality-corpus.mjs';
import {loadTaskList,writeFiles} from '../ccstudy/run.mjs';import {score,tamper} from '../../lib/eval.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'gev-provenance-variants-'));let checks=0;
try {
  const original=JSON.stringify(factualityTasks()),fixtures=factualityVariants(),manifest=writeFactualityVariants(root);
  assert.equal(fixtures.length,12);checks++;assert.equal(new Set(fixtures.map(f=>f.task.id)).size,12);checks++;assert.equal(new Set(fixtures.map(f=>f.task.family)).size,4);checks++;
  assert.equal(loadTaskList(path.join(root,'evals/factuality-variants-heldout/manifest.json'),root).length,12);checks++;
  for(const {task,reference} of fixtures){
    const ws=path.join(root,task.id);fs.mkdirSync(ws);writeFiles(ws,task.files);writeFiles(ws,task.hidden);assert.equal(score(ws,task).pass,false);checks++;
    writeFiles(ws,reference);assert.equal(score(ws,task).pass,true);checks++;
    const answer=JSON.parse(reference['answer.json']),evidence=JSON.parse(task.files['evidence.json']);
    assert.deepEqual(answer.citations,[...answer.citations].sort());assert.ok(answer.citations.every(id=>evidence.some(r=>r.id===id)));checks++;
    for(const bad of [{...answer,value:'fabricated'}, {...answer,citations:['UNSUPPLIED']}, {...answer,extra:'unsupported claim'}, {...answer,status:'supported',value:'invented',citations:[]}]){
      fs.writeFileSync(path.join(ws,'answer.json'),JSON.stringify(bad));assert.equal(score(ws,task).pass,false,task.id);checks++;
    }
    if(answer.citations.length){fs.writeFileSync(path.join(ws,'answer.json'),JSON.stringify({...answer,citations:[]}));assert.equal(score(ws,task).pass,false);checks++;}
    if(answer.status==='supported'||answer.status==='partial'){fs.writeFileSync(path.join(ws,'answer.json'),JSON.stringify({status:'unknown',value:null,citations:[]}));assert.equal(score(ws,task).pass,false);checks++;}
    writeFiles(ws,reference);fs.writeFileSync(path.join(ws,'evidence.json'),'[]');assert.equal(tamper(ws,task).files.length,1);checks++;assert.ok(!Object.hasOwn(task.files,'protected-grade.mjs'));checks++;
  }
  assert.equal(JSON.stringify(factualityTasks()),original);checks++;
  fs.appendFileSync(path.join(root,manifest.tasks[0].file),' ');assert.throws(()=>loadTaskList(path.join(root,'evals/factuality-variants-heldout/manifest.json'),root),/hash changed/);checks++;
  console.log(checks+' independent provenance controls passed;12 variants/4 families,zero model calls,original16 cases unchanged.');
} finally {const resolved=fs.realpathSync(root);assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('gev-provenance-variants-'));fs.rmSync(resolved,{recursive:true,force:true});}
