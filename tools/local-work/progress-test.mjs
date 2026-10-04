import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {once} from 'node:events';import {snapshot,percent,STAGES,goalQualified} from './progress.mjs';import {dashboard} from './dashboard.mjs';
import http from 'node:http';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const catalog=JSON.parse(fs.readFileSync(path.join(repo,'tools/local-work/dashboard/benchmarks.json'),'utf8'));
const root=fs.mkdtempSync(path.join(os.tmpdir(),'gev-progress-'));let checks=0;
const check=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
try{
 check('five published studies with unmeasured host/account/public gates',()=>assert.deepEqual([catalog.schema,catalog.rows.length,catalog.unmeasured.length],[1,5,3]));
 for(const row of catalog.rows){
  check('published report bytes pinned '+row.id,()=>assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,row.report))).digest('hex'),row.reportSHA256));
  check('whole numeric pairs retained '+row.id,()=>{for(const pair of Object.values(row.counts))assert(pair.length===2&&pair.every(n=>Number.isSafeInteger(n)&&n>0));});
  check('published totals and GitHub report link '+row.id,()=>{assert(row.counts.total.every((n,i)=>n>row.counts.raw[i]));assert(row.url.endsWith(row.report));assert.equal(new URL(row.url).origin,'https://github.com');});
 }
 check('adverse progressive compaction cost remains visible',()=>assert(catalog.rows[0].counts.total[1]>catalog.rows[0].counts.total[0]&&catalog.rows[0].counts.uncached[1]>catalog.rows[0].counts.uncached[0]));
 check('factuality original quality loss retained',()=>assert.equal(catalog.rows[3].quality,'30/32 vs 29/32'));
 check('batch token saving cannot imply 20x context',()=>{const r=catalog.rows[4];assert(r.counts.total[0]/r.counts.total[1]>20&&r.counts.peak[0]/r.counts.peak[1]<5);assert(r.limitations.includes('Reduced tools'));});
 const write=(name,value)=>fs.writeFileSync(path.join(root,name),JSON.stringify(value));
 check('missing state reports no progress',()=>assert.equal(snapshot(root).roundPercent,0));
 check('whole goal remains unproved',()=>assert.deepEqual([snapshot(root).goalPercent,snapshot(root).totalGoals],[0,7]));
 write('STATUS.json',{round:12,status:'running'});write('WORKFLOW-STATUS.json',{round:12,stage:'code',steps:{research:{completed:true},plan:{completed:true}},at:'2026-10-04T00:00:00Z'});
 const now=new Date('2026-10-04T01:00:00Z');const s=snapshot(root,{now,live:true});
 check('round number and independently distinct percentage',()=>assert.deepEqual([s.round,s.roundPercent,s.goalPercent],[12,40,0]));
 check('last refresh differs from source update',()=>assert.deepEqual([s.refreshedAt,s.sourceUpdatedAt],[now.toISOString(),'2026-10-04T00:00:00Z']));
 check('only running step active',()=>assert.deepEqual(s.steps.filter(x=>x.active).map(x=>x.id),['code']));
 check('stopped worker has no active step',()=>assert(!snapshot(root).steps.some(x=>x.active)));
 write('WORKFLOW-STATUS.json',{round:11,steps:Object.fromEntries(STAGES.map(x=>[x,{completed:true}]))});
 check('stale previous round cannot show current completion',()=>assert.equal(snapshot(root).roundPercent,0));
 write('GOAL-PROGRESS.json',{goalPercent:100,verifiedGoals:7});check('model self-claims do not advance goal',()=>assert.equal(snapshot(root).goalPercent,0));
 const audit={independent:true,status:'verified',normalCapabilities:true,hosts:['codex','claude'],fullCostKnown:true,ratio:0.05,sameOrBetter:true,metric:'total-tokens'};
 check('exact 20x token boundary permitted',()=>assert(goalQualified('tokens',audit)));
 for(const patch of [{ratio:0.051},{ratio:0},{ratio:NaN},{ratio:'0.01'},{normalCapabilities:false},{hosts:['codex']},{hosts:{}},{hosts:'codex claude'},{fullCostKnown:false},{sameOrBetter:false},{metric:'input-characters'},{independent:false}])check('unqualified goal evidence rejected',()=>assert(!goalQualified('tokens',{...audit,...patch})));
 const auditFile=path.join(root,'audit.json');write('audit.json',audit);write('CONTROLLER-PIN.json',{goalAudits:[{id:'tokens',file:auditFile,sha256:crypto.createHash('sha256').update(fs.readFileSync(auditFile)).digest('hex')}]});
 check('pinned independent audit advances one requirement',()=>assert.deepEqual([snapshot(root).goalPercent,snapshot(root).verifiedGoals],[14,1]));
 fs.appendFileSync(auditFile,' ');check('changed audit fails closed',()=>assert.equal(snapshot(root).goalPercent,0));
 write('CONTROLLER-PIN.json',{goalAudits:{find:'malformed'}});check('malformed audit registry cannot crash progress',()=>assert.equal(snapshot(root).goalPercent,0));
 for(const [n,d,expected] of [[-1,5,0],[10,5,100],[3,5,60],[1,0,0],[NaN,5,0],[1,Infinity,0],['3',5,0]])check('bounded finite percentage',()=>assert.equal(percent(n,d),expected));
 write('JOB-PROGRESS.json',{active:{title:'Evidence delivery'},completed:[{}]});check('actual task progress reported separately',()=>assert.equal(snapshot(root).completedJobs,1));
 fs.writeFileSync(path.join(root,'STATUS.json'),'invalid');check('malformed status surfaced',()=>assert(snapshot(root).warnings.includes('STATUS.json: unreadable')));
 fs.writeFileSync(path.join(root,'STOP'),'pause');check('operator stop visible',()=>assert.equal(snapshot(root).status,'Paused for setup'));fs.unlinkSync(path.join(root,'STOP'));
 const server=dashboard(root,{port:0,live:()=>true});await once(server,'listening');try{
  const url=`http://127.0.0.1:${server.address().port}`;
  const response=await fetch(url+'/api/progress');check('actual local status endpoint succeeds',()=>assert.equal(response.status,200));check('no browser cache',()=>assert.equal(response.headers.get('cache-control'),'no-store'));check('no embedding/external scripts',()=>assert(response.headers.get('content-security-policy').includes("frame-ancestors 'none'")));
  const json=await response.json();check('endpoint round and timestamp real',()=>assert.equal(json.live,true));
  const benchmarks=await fetch(url+'/api/benchmarks').then(r=>r.json());check('real benchmark endpoint preserves all published rows',()=>assert.deepEqual(benchmarks,catalog));
  check('benchmark readings cannot advance goal percentage',()=>assert.equal(json.goalPercent,0));
  const page=await fetch(url).then(r=>r.text());for(const id of ['goal-percent','round-percent','round-number','refreshed','benchmarks','unmeasured'])check('required UI output '+id,()=>assert(page.includes(`id="${id}"`)));
  for(const route of ['/CONFIG.json','/../CONFIG.json','/api/progress?path=CONFIG.json']){assert.equal((await fetch(url+route)).status,404);checks++;}
  const rejected=await new Promise((resolve,reject)=>{http.get(url,{headers:{host:'evil.example'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject);});
  assert.equal(rejected,403);checks++;
  assert.equal((await fetch(url+'/api/progress',{method:'POST'})).status,403);checks++;
 }finally{await new Promise(r=>server.close(r));}
}finally{fs.rmSync(root,{recursive:true,force:true});}
console.log(`PASS ${checks} progress and real HTTP controls`);
