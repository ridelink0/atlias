import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {usageOf,jobsOf,contained,validateResume,limitsOf} from './run.mjs';import {loadTaskList} from '../ccstudy/run.mjs';
import {summarize} from './summary.mjs';
let n=0;const eq=(a,b)=>{assert.deepEqual(a,b);n++;};
const count=(total,last)=>({type:'event_msg',payload:{type:'token_count',info:{total_token_usage:total,last_token_usage:{input_tokens:last}}}});
eq(usageOf([]).promptRaw,null);
const u={input_tokens:123,cached_input_tokens:100,output_tokens:9};
eq(usageOf([count(u,30),count(u,30)]),{promptRaw:123,cachedInput:100,output:9,contextPeak:30,contextMean:30,tokenSamples:1});
eq(usageOf([count({...u,input_tokens:50},20),count(u,40)]).contextMean,30);
const jobs=jobsOf([{id:'a'},{id:'b'}],3);eq(jobs.length,12);eq(jobs.slice(0,2).map(x=>x.arm),['plain','plugin']);eq(jobs.slice(4,6).map(x=>x.arm),['plugin','plain']);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'gev-study-test-'));
const plan={sha:'x',plugin:'atlias',model:'x',effort:'medium',lean:false,tasks:[{id:'a',sha256:'old'}]};
eq(limitsOf([]),{stopPercent:60,timeoutMin:12});
for(const args of [['--stop-percent','NaN'],['--stop-percent','101'],['--timeout-min','Infinity'],['--timeout-min','0']]){assert.throws(()=>limitsOf(args),/finite/);n++;}
validateResume(plan,{...plan,repeats:3});n++;
assert.throws(()=>validateResume(plan,{...plan,tasks:[{id:'a',sha256:'new'}]}),/task hashes/);n++;
const row=(task,arm,promptRaw,solved=true)=>({task,family:task,arm,promptRaw,solved,valid:true,exitCode:0,repeat:1});
const report=summarize([row('a','plain',10),row('a','atlias',20,false),row('b','plain',30),row('b','atlias',40),row('unmatched','atlias',500)]);
eq(report.comparisons[0].pairedStats.atlias,{n:2,solved:1,promptRaw:60,perSolved:60,contextPeak:0});
eq(report.comparisons[0].pairedStats.plain.perSolved,20);
eq(report.comparisons[0].rawRatio.bootLo,null);
eq(summarize([row('a','plain',null)]).excluded.length,1);
eq(summarize([row('a','plain',-1)]).excluded.length,1);
eq(summarize([{...row('a','plain',1),valid:false,invalidReason:'ambiguous contract'}]).excluded[0].reason,'ambiguous contract');
assert.throws(()=>summarize([row('a','plain',1),row('a','plain',1)]),/duplicate/);n++;
eq(summarize([row('a','plain',10),{...row('a','atlias',20),timedOut:true}]).comparisons.length,0);
eq(summarize([row('a','plain',10),row('a','atlias',20),{...row('a','plain',10),repeat:2},{...row('a','atlias',20),repeat:2}]).comparisons[0].semanticFamilies,1);
try{
  assert.throws(()=>contained(root,'../outside'));n++;assert.throws(()=>contained(root,root));n++;
  fs.writeFileSync(path.join(root,'task.json'),JSON.stringify({id:'x'}));fs.writeFileSync(path.join(root,'list.json'),JSON.stringify({tasks:[{id:'x',file:'task.json',sha256:'changed'}]}));assert.throws(()=>loadTaskList(path.join(root,'list.json'),root),/hash/);n++;
}finally{fs.rmSync(root,{recursive:true,force:true});}
console.log(`${n} native benchmark protocol checks passed; no model calls.`);
