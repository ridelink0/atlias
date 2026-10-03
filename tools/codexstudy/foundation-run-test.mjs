import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {validateFoundationOptions,foundationProtocolValid,observedProtectedAccess} from './foundation-run.mjs';import {workflowCorpus} from './workflow-corpus.mjs';import {childEnv} from '../ccstudy/lib.mjs';
let checks=0;const ok=f=>{f();checks++;};
for(const a of [[],['--prepare'],['--run','--out','owned space'],['--repeat','2','--stop-percent','100']])ok(()=>assert(validateFoundationOptions(a)));
for(const a of [['--run','--prepare'],['--prepare','--prepare'],['--paid'],['--compact-limit','24000'],['--compact-scope','total'],['--out'],['--out','--run'],['--ref','x','--ref','y'],['position'],['--model','other'],['--out','']])ok(()=>assert.throws(()=>validateFoundationOptions(a)));
const valid={exitCode:0,timedOut:false,candidateDelivered:true,requestStatus:'reconciled-request-records',inputDelivered:true,models:['gpt-6.1-sol'],model:'gpt-6.1-sol',authRemoved:true,pinnedIntact:true,noSymlinks:true,completedTurns:3,expectedTurns:3,unclosedTurns:0,hooks:true,mcp:true,hookEvents:1,arm:'atlias'};
ok(()=>assert(foundationProtocolValid(valid)));
for(const changed of [{exitCode:1},{exitCode:null},{timedOut:true},{candidateDelivered:false},{requestStatus:'incomplete-request-records'},{inputDelivered:false},{models:[]},{models:['other']},{models:['gpt-6.1-sol','other']},{authRemoved:false},{pinnedIntact:false},{noSymlinks:false},{completedTurns:2},{unclosedTurns:1},{hooks:false},{mcp:false},{hookEvents:0},{hookEvents:1.5},{arm:'invented'}])ok(()=>assert(!foundationProtocolValid({...valid,...changed})));
ok(()=>assert(foundationProtocolValid({...valid,arm:'plain',hooks:false,mcp:false,hookEvents:0})));
ok(()=>assert(!foundationProtocolValid({...valid,arm:'plain'})));
for(const args of ['node workflow-grade.mjs','type D:/private/workflow-corpus.mjs','Get-Content D:\\owner\\evals\\gold.json','cat /owner/grade-home/result'])ok(()=>assert(observedProtectedAccess([{type:'response_item',payload:{type:'function_call',arguments:args}}])));
ok(()=>assert(!observedProtectedAccess([{type:'response_item',payload:{type:'function_call',arguments:'node --check src/status.mjs'}}])));
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
