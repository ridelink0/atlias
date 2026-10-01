import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {snapshotOf,intervalOf,appendObservation,main} from './allowance-record.mjs';
const now=1790893000000,reset=now+3600000;
const report=()=>({snapshotFetchedAt:now,codexCredits:{enabled:false},utilization:{five_hour:{utilization:20,resets_at:new Date(reset).toISOString()}},windows:[{label:'5-hour',percentUsed:20,resetsAt:reset},{label:'weekly',percentUsed:50,resetsAt:reset+86400000}],settings:{model:'gpt-6.1-sol',effortLevel:'medium'}});
let checks=0;const reject=(r,message)=>{assert.throws(()=>snapshotOf(JSON.stringify(r),now),message);checks++;};
const before=snapshotOf('\uFEFF'+JSON.stringify(report()),now);assert.equal(before.windows[0].percentUsed,20);assert.equal(before.paidCreditsEnabled,false);checks+=2;
for(const enabled of [true,null,undefined]){const r=report();r.codexCredits.enabled=enabled;reject(r,/paid/);}
for(const time of [now-60001,now+5001,null,undefined]){const r=report();r.snapshotFetchedAt=time;reject(r,/fresh/);}
for(const time of [now-60000,now+5000]){const r=report();r.snapshotFetchedAt=time;assert.ok(snapshotOf(JSON.stringify(r),now));checks++;}
for(const windows of [[],null,undefined]){const r=report();r.windows=windows;reject(r,/windows/);}
for(const percent of [-1,101,null,undefined]){const r=report();r.windows[1].percentUsed=percent;reject(r,/windows/);}
for(const percent of [0,90,100]){const r=report();r.windows[0].percentUsed=percent;r.utilization.five_hour.utilization=percent;assert.equal(snapshotOf(JSON.stringify(r),now).windows[0].percentUsed,percent);checks++;}
for(const flag of ['stale','adjusted','coarse','estimated','correctionUnreliable']){const r=report();r.windows[0][flag]=true;reject(r,/windows/);}
for(const resetAt of [now,null,undefined]){const r=report();r.windows[0].resetsAt=resetAt;reject(r,/windows/);}
const mismatch=report();mismatch.utilization.five_hour.resets_at=new Date(reset+1).toISOString();reject(mismatch,/agree/);
assert.throws(()=>snapshotOf('{',now),SyntaxError);assert.throws(()=>snapshotOf(JSON.stringify(report()),NaN),/finite/);checks+=2;
const r=report();r.snapshotFetchedAt=now+60000;r.windows[0].percentUsed=30;r.utilization.five_hour.utilization=30;const after=snapshotOf(JSON.stringify(r),now+60000),options={isolated:true,completed:12,required:12,elapsedMs:59000};
const valid=intervalOf(before,after,options);assert.equal(valid.eligible,true);assert.deepEqual(valid.percentDeltaBounds,[9,11]);assert.equal(valid.completedTasksPerPercent,1.2);checks+=3;
const unknown=intervalOf(before,after,{...options,isolated:false});assert.equal(unknown.eligible,false);assert.equal(unknown.completedTasksPerPercent,null);checks+=2;
assert.equal(intervalOf(before,after,{...options,completed:11}).eligible,false);checks++;
for(const percent of [0,20,21]){const x=structuredClone(after);x.windows[0].percentUsed=percent;assert.equal(intervalOf(before,x,options).eligible,false);checks++;}
const refill=structuredClone(after);refill.windows[0].resetsAt=reset+3600000;assert.equal(intervalOf(before,refill,options).eligible,false);checks++;
for(const bad of [{completed:13},{completed:-1},{required:0},{elapsedMs:-1},{elapsedMs:Infinity}]){assert.throws(()=>intervalOf(before,after,{...options,...bad}),/counts/);checks++;}
assert.throws(()=>main(['--host','claude'],{}),/exactly/);assert.throws(()=>main(['--host','codex','--refresh','--json'],{}),/LEDGER/);checks+=2;

const mismatchPercent=report();mismatchPercent.utilization.five_hour.utilization=21;reject(mismatchPercent,/agree/);
for(const bad of [null,101,NaN]){const x=structuredClone(after);x.windows[0].percentUsed=bad;assert.throws(()=>intervalOf(before,x,options),/original/);checks++;}
const unknownPaid=structuredClone(after);unknownPaid.paidCreditsEnabled=null;assert.throws(()=>intervalOf(before,unknownPaid,options),/original/);checks++;
assert.throws(()=>intervalOf(before,after,{...options,elapsedMs:60001}),/exceeds/);checks++;
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'gev-allowance-observation-')),ledger=path.join(temp,'café observation.jsonl');appendObservation(ledger,before);appendObservation(ledger,after);assert.equal(fs.readFileSync(ledger,'utf8').trim().split('\n').length,2);checks++;
for(const bad of ['{','{}\n',JSON.stringify({schema:before.schema})+'\n',JSON.stringify(before)]){fs.writeFileSync(ledger,bad);assert.throws(()=>appendObservation(ledger,after));assert.equal(fs.readFileSync(ledger,'utf8'),bad);checks+=2;}
// Retain the temporary malformed-ledger fixtures for inspection. No model calls.
const duplicates=report();duplicates.windows.push(duplicates.windows[0]);reject(duplicates,/unique/);
assert.throws(()=>main(['--host codex --refresh --json'],{}),/exactly/);checks++;
for(const label of ['',null,undefined]){const r=report();r.windows[1].label=label;reject(r,/windows/);}
console.log(checks+' allowance observation controls passed; zero model calls');
