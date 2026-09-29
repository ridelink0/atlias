import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { tasks } from './corpus.mjs';
import { score, tamper } from '../../lib/eval.mjs';
import { writeFiles } from '../ccstudy/run.mjs';
let checks=0;
const root=fs.mkdtempSync(path.join(os.tmpdir(),'gev-corpus-'));
try {
  for(const {task,reference} of tasks()){
    const dir=path.join(root,task.id);fs.mkdirSync(dir);writeFiles(dir,task.files);writeFiles(dir,task.hidden);
    assert.equal(score(dir,task).pass,false,`${task.id}: broken seed must fail`);checks++;
    writeFiles(dir,reference);const v=score(dir,task);assert.equal(v.pass,true,`${task.id}: reference ${v.output}`);checks++;
    assert.equal(tamper(dir,task).files.length,0);checks++;
    fs.writeFileSync(path.join(dir,'src/api.mjs'),'export const repair=()=>0;');assert.ok(tamper(dir,task).files.length);checks++;
  }
  console.log(`${checks} corpus checks passed; 24 workloads, 12 semantic families; no model calls.`);
} finally { fs.rmSync(root,{recursive:true,force:true}); }
