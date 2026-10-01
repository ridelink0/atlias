import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { factualityTasks,writeFactualityCorpus } from './factuality-corpus.mjs';
import { loadTaskList,writeFiles } from '../ccstudy/run.mjs';
import { score,tamper } from '../../lib/eval.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'gev-factuality-'));let checks=0;
try {
  const manifest=writeFactualityCorpus(root),fixtures=factualityTasks();
  assert.equal(fixtures.length,16);checks++;
  assert.equal(new Set(fixtures.map(x=>x.task.family)).size,8);checks++;
  assert.equal(loadTaskList(path.join(root,'evals/factuality-heldout/manifest.json'),root).length,16);checks++;
  for (const {task,reference} of fixtures) {
    const ws=path.join(root,task.id);fs.mkdirSync(ws);writeFiles(ws,task.files);writeFiles(ws,task.hidden);
    assert.equal(score(ws,task).pass,false);checks++;
    writeFiles(ws,reference);assert.equal(score(ws,task).pass,true);checks++;
    const original=JSON.parse(reference['answer.json']);
    for(const mutation of [{...original,value:'invented'}, {...original,citations:['INVENTED']}, {...original,status:'unknown',value:null,citations:[]}, {...original,extra:'claim'}]) {
      fs.writeFileSync(path.join(ws,'answer.json'),JSON.stringify(mutation));assert.equal(score(ws,task).pass,false,task.id+' mutation must fail');checks++;
    }
    writeFiles(ws,reference);fs.writeFileSync(path.join(ws,'evidence.json'),'[]');assert.equal(tamper(ws,task).files.length,1);checks++;
    assert.ok(!Object.hasOwn(task.files,'protected-grade.mjs'));checks++;
  }
  fs.appendFileSync(path.join(root,manifest.tasks[0].file),' ');assert.throws(()=>loadTaskList(path.join(root,'evals/factuality-heldout/manifest.json'),root),/hash changed/);checks++;
  console.log(`${checks} factuality controls passed; correct answers, useful partial answers, absent/conflicting/stale evidence, false premises, injection and verification provenance; zero model calls.`);
} finally {
  const resolved=fs.realpathSync(root);assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('gev-factuality-'));fs.rmSync(resolved,{recursive:true,force:true});
}
