import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {validateWorkflowOptions} from './workflow-run.mjs';import {workflowCorpus} from './workflow-corpus.mjs';import {childEnv} from '../ccstudy/lib.mjs';
let checks=0;const ok=f=>{f();checks++;};
for(const a of [[],['--prepare'],['--run','--out','owned space'],['--repeat','2','--compact-limit','24000','--stop-percent','100']])ok(()=>assert(validateWorkflowOptions(a)));
for(const a of [['--run','--prepare'],['--prepare','--prepare'],['--paid'],['--out'],['--out','--run'],['--ref','x','--ref','y'],['position'],['--model','other'],['--out','']])ok(()=>assert.throws(()=>validateWorkflowOptions(a)));
const root=fs.mkdtempSync(path.join(os.tmpdir(),'Gev-grade-owner-')),script=fileURLToPath(new URL('./workflow-grade.mjs',import.meta.url));
try {
  for(const task of workflowCorpus())for(let i=0;i<3;i++) {
    const ws=path.join(root,task.id+'-'+i);fs.mkdirSync(ws);const write=files=>{for(const [rel,text] of Object.entries(files)){const f=path.join(ws,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,text);}};
    write(task.initialFiles);for(let j=0;j<=i;j++)write(task.phases[j].changes);write(task.phases[i].reference);
    const nonce='Gev-owned-grade-control',call=()=>spawnSync(process.execPath,[script,task.id,String(i),ws,nonce],{encoding:'utf8',env:childEnv(process.env,{home:path.join(root,'isolated-home')}),cwd:ws,timeout:20000,windowsHide:true});
    let p=call();ok(()=>assert(p.status===0&&JSON.parse(p.stdout.trim()).nonce===nonce&&JSON.parse(p.stdout.trim()).pass===true));
    const file=Object.keys(task.phases[i].reference)[0];fs.writeFileSync(path.join(ws,file),file==='answer.json'?'{}':'process.exit(0);\n');p=call();ok(()=>assert(p.status!==0||!p.stdout.includes('"pass":true')));
  }
}finally{fs.rmSync(root,{recursive:true,force:true});}
console.log(`${checks} Gev workflow option/isolated-grade controls passed; 0 model calls.`);
