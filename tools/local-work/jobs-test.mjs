import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {nextJob,saveJob,validateJobs,targetHashes,implementationHashes,acceptJob,actionCue,jobIdentity,jobExecutor,repairJob} from './jobs.mjs';import {hash} from './migrate.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'gev-jobs-'));let n=0;const c=(name,fn)=>{fn();n++;console.log('PASS '+name);};
try{
 const check=path.join(root,'independent.mjs');fs.writeFileSync(check,'assertion');const job={id:'evidence',title:'Evidence windows',contract:'Full source hash; accurate complete lines',targets:['evidence.mjs'],check:{file:check,sha256:hash(fs.readFileSync(check)),args:[]}};
 c('new queue selects first task',()=>assert.equal(nextJob(root,[job]).job.id,'evidence'));
 saveJob(root,{completed:[]},job,{round:1});c('unsuccessful phase retains SAME task',()=>assert.equal(nextJob(root,[job]).job.id,'evidence'));
 saveJob(root,{completed:[],active:{id:job.id,initialTargets:[['evidence.mjs',null]]}},job,{round:2});c('interruption preserves original implementation baseline',()=>assert.deepEqual(nextJob(root,[job]).state.active.initialTargets,[['evidence.mjs',null]]));
 saveJob(root,{completed:[]},job,{accepted:true,round:2,receipt:'retained'});c('accepted task advances',()=>assert.equal(nextJob(root,[job]).job,undefined));
 c('changed contract cannot inherit old acceptance',()=>assert(nextJob(root,[{...job,contract:'New contract'}]).job));
 c('missing target cannot count as changed implementation',()=>assert.deepEqual(targetHashes(root,job),[['evidence.mjs',null]]));
 fs.writeFileSync(path.join(root,'evidence.mjs'),'Gev');c('actual implementation hash captured',()=>assert.equal(targetHashes(root,job)[0][1],hash(Buffer.from('Gev'))));
 c('advice at fifth read',()=>assert.match(actionCue(5,job),/IMPLEMENT|implement/));c('no repeated advice between boundaries',()=>assert.equal(actionCue(6,job),''));
 for(const targets of [['../evil.mjs'],['C:/evil.mjs'],['a\\b.mjs'],[],['test.txt']])c('unsafe target refused',()=>assert.throws(()=>validateJobs([{...job,targets}])));
 c('duplicate queue IDs refused',()=>assert.throws(()=>validateJobs([job,job])));c('missing contract refused',()=>assert.throws(()=>validateJobs([{...job,contract:''}])));
 const result=await acceptJob(job,root,{}, {run:async(program,args)=>({code:0,program,args})});c('exact pinned check invoked',()=>assert.deepEqual(result.args,[check]));
 fs.appendFileSync(check,'changed');await assert.rejects(acceptJob(job,root,{}),/changed/);n++;
 c('definition binds full contract',()=>assert.notEqual(jobIdentity(job),jobIdentity({...job,title:'Other'})));
 fs.mkdirSync(path.join(root,'tools'));const before=implementationHashes(root);fs.writeFileSync(path.join(root,'LOCAL-PROGRESS.md'),'Handoff only');c('handoff alone is not implementation',()=>assert.deepEqual(implementationHashes(root),before));
 fs.writeFileSync(path.join(root,'tools','real.mjs'),'export const value=0');c('new untracked source counts as actual implementation',()=>assert.notDeepEqual(implementationHashes(root),before));
 fs.writeFileSync(check,'assertion');let calls=0;const execute=jobExecutor(job,async()=>{calls++;return 'executed';});const state={cwd:root};
 const read=JSON.parse(await execute(state,{tool:'read_file',path:check}));c('public pinned engineering acceptance readable',()=>assert.equal(read.text,'1: assertion'));c('public read did not delegate unsafe outside access',()=>assert.equal(calls,0));
 assert.match(await execute(state,{tool:'read_file',path:check,offset:0}),/safe integer/);n++;
 assert.equal(await execute(state,{tool:'write_file',path:'evidence.mjs',content:'x'}),'executed');n++;
 assert.equal(await execute(state,{tool:'write_file',path:'LOCAL-PROGRESS.md',content:'Gev'}),'executed');n++;
 for(const p of ['test_debug.mjs','test/original.mjs','../outside.mjs',check]){assert.match(await execute(state,{tool:'write_file',path:p}),/only/);n++;}
 fs.appendFileSync(check,'changed');await assert.rejects(execute(state,{tool:'read_file',path:check}),/changed/);n++;

 let attempts=[],feedbacks=[],inspections=0;
 const repair=await repairJob({run:async(feedback,i)=>{feedbacks.push(feedback);return 'model answer '+i;},inspect:async()=>({stopReason:'answered',accepted:++inspections===2,check:{code:inspections===2?0:1,stderr:'empty source rejected'},handoffChanged:inspections===2,targetChanged:true}),record:r=>attempts.push(r)});
 c('unverified model final receives actual failure feedback',()=>assert.match(feedbacks[1],/empty source rejected/));
 c('same engineering repair keeps initial failed receipt',()=>assert.deepEqual(attempts.map(r=>r.accepted),[false,true]));
 c('independent acceptance stops further repairs',()=>assert.equal(repair,'model answer 1'));
 let runs=0;await repairJob({run:async()=>{runs++;return 'unproved';},inspect:async()=>({stopReason:'answered',accepted:false,check:{code:1}}),record:()=>{},maxRepairs:2});c('persistent failures bounded to declared slices',()=>assert.equal(runs,3));
 for(const stopReason of ['model-error','context-full','operator-stop']){runs=0;await repairJob({run:async()=>runs++,inspect:async()=>({stopReason,accepted:false}),record:()=>{}});c('terminal '+stopReason+' never repeated',()=>assert.equal(runs,1));}
 runs=0;await repairJob({run:async()=>runs++,inspect:async()=>({stopReason:'answered',unsafe:true,accepted:false}),record:()=>{}});c('protected-change observation prevents repairs',()=>assert.equal(runs,1));
 runs=0;await repairJob({run:async()=>runs++,inspect:async()=>({}),record:()=>{},halt:()=>true});c('operator stop starts no attempt',()=>assert.equal(runs,0));
 let halted=false;runs=0;await repairJob({run:async()=>runs++,inspect:async()=>({stopReason:'answered',accepted:false}),record:()=>{halted=true;},halt:()=>halted});c('operator stop after failure prevents next attempt',()=>assert.equal(runs,1));
 for(const maxRepairs of [-1,5,1.5,'2',NaN]){await assert.rejects(repairJob({maxRepairs}));n++;}
 await assert.rejects(repairJob({run:async()=>{throw Error('provider error');},inspect:async()=>({}),record:()=>{}}),/provider error/);n++;
 await assert.rejects(repairJob({run:async()=>'',inspect:async()=>{throw Error('check changed');},record:()=>{}}),/check changed/);n++;
 await assert.rejects(repairJob({run:async()=>'',inspect:async()=>({}),record:()=>{throw Error('disk failed');}}),/disk failed/);n++;
}finally{fs.rmSync(root,{recursive:true,force:true});}
console.log(`PASS ${n} durable engineering task controls`);
