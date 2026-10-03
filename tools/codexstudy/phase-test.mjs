import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {phasesOf,phaseArgs,phaseLedger,runPhases} from './phase-protocol.mjs';
let checks=0;const ok=f=>{f();checks++;},bad=f=>ok(()=>assert.throws(f));
const phases=[{id:'establish',prompt:'Gev: exact original requirement: zero is known; null is unknown.'},{id:'verify',prompt:'Gev: verify the requirement after native resume.'},{id:'finish',prompt:'Gev: report actual checks and preserve unsupported facts as unknown.'}];
const sid='11111111-2222-3333-4444-555555555555';
const cumulative=n=>({input_tokens:n,cached_input_tokens:0,output_tokens:10,reasoning_output_tokens:0,total_tokens:n+10});
const pair=(p,n)=>[{type:'started',phase:p.id,promptSha256:p.sha256,sessionId:n===1?null:sid},{type:'finished',phase:p.id,promptSha256:p.sha256,sessionId:sid,valid:true,timedOut:false,exitCode:0,cumulative:cumulative(n*100),peak:n*50}];
ok(()=>assert.equal(phasesOf(phases).length,3));
for(const value of [null,[],[phases[0]],Array(13).fill(phases[0]),[phases[0],phases[0]],[{id:'../escape',prompt:'x'},phases[1]],[{id:'safe',prompt:' '},phases[1]],[{id:'safe',prompt:'x',hidden:true},phases[1]]])bad(()=>phasesOf(value));
const ws=path.join(os.tmpdir(),'Gev phase workspace');
const init=phaseArgs({prompt:phases[0].prompt,model:'gpt-6.1-sol',workspace:ws}),resume=phaseArgs({prompt:phases[1].prompt,model:'gpt-6.1-sol',workspace:ws,sessionId:sid,policy:{limitTokens:20000}});
ok(()=>assert(init.includes('-C')&&init.includes('-s')&&!init.includes('--last')));
ok(()=>assert(resume.includes('resume')&&resume.includes(sid)&&!resume.includes('-C')&&!resume.includes('-s')&&!resume.includes('--last')));
for(const sessionId of ['', '--last', '../escape', 'not-a-uuid'])bad(()=>phaseArgs({prompt:'x',model:'m',workspace:ws,sessionId}));
bad(()=>phaseArgs({prompt:'-',model:'m',workspace:ws}));
ok(()=>{const args=phaseArgs({prompt:'--last',model:'m',workspace:ws,sessionId:sid});assert(args.indexOf('--')<args.indexOf(sid)&&args.indexOf(sid)<args.indexOf('--last'));});
const spec=phasesOf(phases),records=[...pair(spec[0],1),...pair(spec[1],2)];
ok(()=>assert.equal(phaseLedger(records,phases).cumulative.input_tokens,200));
ok(()=>assert.equal(phaseLedger(records,phases).fullNativePeak,100));
ok(()=>assert.equal(phaseLedger(records,phases).next.id,'finish'));
for(const mutate of [r=>r[1].promptSha256='bad',r=>r[2].sessionId=null,r=>r[3].cumulative=cumulative(50),r=>r[1].cumulative.cached_input_tokens=999,r=>r[1].type='bogus',r=>r[1].sessionId='bad',r=>r[1].peak=-1]) {const r=structuredClone(records);mutate(r);bad(()=>phaseLedger(r,phases));}
ok(()=>{const r=structuredClone(records);r[3].sessionId='aaaaaaaa-2222-3333-4444-555555555555';assert.equal(phaseLedger(r,phases).held,true);});
for(const mutate of [r=>r[1].valid=false,r=>r[1].cumulative=null,r=>r[1].peak=null,r=>r[1].exitCode=1,r=>r[1].timedOut=true]){const r=records.slice(0,2).map(x=>structuredClone(x));mutate(r);ok(()=>assert.equal(phaseLedger(r,phases).next,null));}
const root=fs.mkdtempSync(path.join(os.tmpdir(),'Gev-phases-'));
try {
  let calls=0,allowed=1;const folder=path.join(root,'clean'),plan={source:'pinned',driver:'hash',native:'hash',grade:'protected',flags:{apps:false}};
  const launch=async()=>{calls++;return {sessionId:sid,valid:true,timedOut:false,exitCode:0,cumulative:cumulative(calls*100),peak:calls*50};};
  const first=await runPhases({folder,phases,plan,launch,allowance:async()=>allowed-->0});
  ok(()=>assert.equal(first.completed.length,1));ok(()=>assert.equal(first.boundary,true));
  const original=fs.readFileSync(path.join(folder,'phases/establish/input.txt'));
  const done=await runPhases({folder,phases,plan,launch,allowance:async()=>true});
  ok(()=>assert.equal(calls,3));ok(()=>assert.equal(done.cumulative.input_tokens,300));ok(()=>assert.equal(done.fullNativePeak,150));ok(()=>assert.deepEqual(fs.readFileSync(path.join(folder,'phases/establish/input.txt')),original));
  await runPhases({folder,phases,plan,launch,allowance:async()=>true});ok(()=>assert.equal(calls,3));
  await assert.rejects(runPhases({folder,phases,plan:{...plan,source:'changed'},launch,allowance:async()=>true}));checks++;
  const crash=path.join(root,'crash');await assert.rejects(runPhases({folder:crash,phases,plan,launch:async()=>{throw Error('native outcome unknown');},allowance:async()=>true}));checks++;
  await assert.rejects(runPhases({folder:crash,phases,plan,launch,allowance:async()=>true}),/never retry/);checks++;
  ok(()=>assert.equal(calls,3));
  fs.writeFileSync(path.join(folder,'OWNER.lock'),'another owner');await assert.rejects(runPhases({folder,phases,plan,launch,allowance:async()=>true}));checks++;
  ok(()=>assert.equal(fs.readFileSync(path.join(folder,'OWNER.lock'),'utf8'),'another owner'));
  const failure=await runPhases({folder:path.join(root,'failed'),phases,plan,launch:async()=>({...await launch(),valid:false}),allowance:async()=>true});ok(()=>assert(failure.held&&failure.cumulative===null));
} finally {fs.rmSync(root,{recursive:true,force:true});}
console.log(`${checks} Gev phase protocol controls passed; 0 model calls.`);
