import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';
import {prerequisites,recipe,gradingResult,sourceSnapshot,parseRollouts,studyRows,transportProfile,dictionaryPrerequisite} from './batch-run.mjs';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');let checks=0;
assert.deepEqual(transportProfile().runnerFlags,[]);checks++;assert.deepEqual(transportProfile('dictionary-v1').runnerFlags,['--dictionary']);checks++;assert.throws(()=>transportProfile('unknown'));checks++;
const published=new URL('../../evals/results/native-codex/codex-atlias-independent-batch-2026-10-01/',import.meta.url),previousBytes=fs.readFileSync(new URL('rows.jsonl',published)),previousAudit=JSON.parse(fs.readFileSync(new URL('AUDIT.json',published)));
assert.equal(dictionaryPrerequisite(previousAudit,previousBytes).precedingBatchLedgerSha256,hash(previousBytes));checks++;
for(const change of [x=>x.source='other',x=>x.complete=false,x=>x.ledgerSha256='wrong',x=>x.audits.pop(),x=>x.counters.qualityPassed=false,x=>x.counters.costsKnown=false,x=>x.audits[0].authRemoved=false,x=>x.audits[0].members[0].solved=false,x=>x.audits[1]=structuredClone(x.audits[0]),x=>x.audits[0].costs.raw++,x=>x.audits[0].members.pop()]){const x=structuredClone(previousAudit);change(x);assert.throws(()=>dictionaryPrerequisite(x,previousBytes));checks++;}
assert.throws(()=>dictionaryPrerequisite(previousAudit,Buffer.from('changed ledger')));checks++;
const source='d7e614ccfb1d18437d96b0a33f65778989a2d534',candidate='candidate';
const plan={sha:source,jobs:24,repeats:2,model:'gpt-6.1-sol',effort:'medium',tasks:Array.from({length:6},(_,i)=>({id:'task'+i,sha256:'hash'+i}))};
const rows=plan.tasks.flatMap(t=>[1,2].flatMap(repeat=>['plain','atlias'].map(arm=>({task:t.id,repeat,arm,taskSha256:t.sha256,sha:arm==='plain'?'':source,model:plan.model,effort:plan.effort,valid:true,solved:true,exitCode:0,timedOut:false}))));
const bytes=Buffer.from(JSON.stringify(rows)),audit={complete:true,source,ledgerSha256:hash(bytes),audits:rows.map(r=>({...r,fullInputDelivered:true,nativeUsageReconciled:true,authRemoved:true,originalGrade:true,protocolValid:true}))},ci={headSha:candidate,status:'completed',conclusion:'success',jobs:Array.from({length:9},()=>({conclusion:'success'}))};
assert.equal(prerequisites(plan,rows,audit,bytes,ci,candidate).capabilityLedgerSha256,hash(bytes));checks++;
for(const change of [x=>x.p.sha='other',x=>x.p.jobs=23,x=>x.r.pop(),x=>x.r[0].valid=false,x=>x.r[0].solved=false,x=>x.r[0].timedOut=true,x=>x.r[0].exitCode=1,x=>x.r[0].taskSha256='wrong',x=>x.r[0].model='other',x=>x.r[0].sha='other',x=>x.r[1]={...x.r[0]},x=>x.a.ledgerSha256='other',x=>x.a.audits[0].authRemoved=false,x=>x.a.audits[1]={...x.a.audits[0]},x=>x.a.complete=false,x=>x.c.headSha='other',x=>x.c.jobs.pop(),x=>x.c.jobs[0].conclusion='failure',x=>x.c.status='in_progress']){const x=structuredClone({p:plan,r:rows,a:audit,c:ci});change(x);assert.throws(()=>prerequisites(x.p,x.r,x.a,bytes,x.c,candidate));checks++;}
const good={grade:{pass:true},cheat:{files:[]},functional:0,adversarial:{cases:105,passed:105},expectedCases:105,checkerExit:0,exitCode:0,timedOut:false};assert.equal(gradingResult(good),true);checks++;
for(const patch of [{checkerExit:1},{functional:null},{exitCode:1},{timedOut:true},{hiddenPresent:true},{expectedCases:104},{adversarial:null},{adversarial:{cases:0,passed:0}},{adversarial:{cases:105,passed:104}},{cheat:{files:['contract']}},{grade:{pass:false}}]){assert.equal(gradingResult({...good,...patch}),false);checks++;}
const task={id:'encoding',files:{'docs/contract.md':'contract','src/api.mjs':'source','package.json':'{}','smoke.mjs':'smoke','archive/old.mjs':'historical'},hidden:{'protected.mjs':'gold'},protect:['docs/contract.md','package.json','smoke.mjs']};assert.deepEqual(recipe(task).writePaths,['src/api.mjs']);checks++;assert.ok(!recipe(task).readPaths.includes('archive/old.mjs'));checks++;
assert.throws(()=>recipe({...task,hidden:{'src/api.mjs':'gold'}}));checks++;assert.throws(()=>recipe({...task,protect:[...task.protect,'src/api.mjs']}));checks++;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gev-batch-study-'));
try{
  const ws=path.join(tmp,'space unicode-'+String.fromCharCode(233));fs.mkdirSync(ws);for(const [rel,text]of Object.entries(task.files)){fs.mkdirSync(path.dirname(path.join(ws,rel)),{recursive:true});fs.writeFileSync(path.join(ws,rel),text);}
  const members=[{task,modelWs:ws}],before=sourceSnapshot(members);fs.writeFileSync(path.join(ws,'src/api.mjs'),'changed by check');assert.notEqual(sourceSnapshot(members),before);checks++;
  const other=path.join(tmp,'second');for(const [rel,text]of Object.entries(task.files)){fs.mkdirSync(path.dirname(path.join(other,rel)),{recursive:true});fs.writeFileSync(path.join(other,rel),text);}const pair=[...members,{task:{...task,id:'second'},modelWs:other}],pairBefore=sourceSnapshot(pair);fs.writeFileSync(path.join(other,'docs/contract.md'),'cross-job mutation');assert.notEqual(sourceSnapshot(pair),pairBefore);checks++;
  fs.unlinkSync(path.join(ws,'src/api.mjs'));assert.ok(sourceSnapshot(members).includes('ENOENT'));checks++;
  const file=path.join(tmp,'rollout.jsonl');fs.writeFileSync(file,'{"type":"good"}\r\nBROKEN\r\n{"type":"later"}\n');let parsed=parseRollouts([file]);assert.equal(parsed.events.length,2);assert.equal(parsed.errors.length,1);assert.equal(parsed.errors[0].line,2);checks++;
  assert.throws(()=>studyRows(file),/malformed saved ledger/);checks++;assert.deepEqual(studyRows(path.join(tmp,'missing.jsonl')),[]);checks++;
  fs.writeFileSync(file,Buffer.from([255,10]));parsed=parseRollouts([file]);assert.equal(parsed.errors.length,1);assert.equal(parsed.events.length,0);checks++;
  assert.equal(parseRollouts([]).events.length,0);checks++;
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
console.log(`PASS ${checks} independent batch execution controls; zero model calls`);
