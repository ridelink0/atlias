import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {nativeSessionReport,accountPace} from '../../lib/session-report.mjs';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gev-session-report-')),file=path.join(tmp,'café with spaces.jsonl');
const now=1790979000000,iso=n=>new Date(n).toISOString();let count=0;
const tokens=(input=100,cached=80,output=10)=>({input_tokens:input,cached_input_tokens:cached,output_tokens:output,reasoning_output_tokens:2,total_tokens:input+output});
const event=(type,payload,at=now)=>({type:'event_msg',timestamp:iso(at),payload:{type,...payload}});
const meta={type:'session_meta',timestamp:iso(now),payload:{id:'gev-native-fixture'}};
const start=(id,at)=>event('task_started',{turn_id:id,started_at:iso(at)},at);
const done=(id,at)=>event('task_complete',{turn_id:id,completed_at:iso(at)},at);
const usage=(total=tokens(),last=tokens())=>event('token_count',{info:{total_token_usage:total,last_token_usage:last}},now+1000);
const write=rows=>fs.writeFileSync(file,rows.map(JSON.stringify).join('\n')+'\n');
const check=(a,b)=>{assert.deepEqual(a,b);count++;};
const reject=async rows=>{write(rows);await assert.rejects(nativeSessionReport(file));count++;};
write([meta,start('a',now),start('b',now+100),usage(),usage(),done('a',now+1000),done('b',now+1200),start('unfinished',now+1500)]);
const r=await nativeSessionReport(file);check(r.completedTurns,2);check(r.unclosedTurns,1);check(r.completedTurnWallMs,1200);check(r.summedCompletedTurnWallMs,2100);check(r.conversationSpanMs,1500);check(r.reportedLifetimeTokens.total_tokens,110);check(r.nativePeakRecordedInputTokens,100);check(r.nativeUsageObservations,2);
// Printed host-shaped metadata in a tool result never becomes an accounting event.
write([meta,{type:'response_item',timestamp:iso(now),payload:{type:'function_call_output',output:JSON.stringify(usage(tokens(900000)))}}]);check((await nativeSessionReport(file)).reportedLifetimeTokens,null);
write([meta,usage(tokens(200)),usage(tokens(100))]);check((await nativeSessionReport(file)).reportedLifetimeTokens,null);
write([meta,usage(tokens(200,190)),usage(tokens(190,180,40))]);check((await nativeSessionReport(file)).reportedLifetimeTokens,null);
write([meta]);fs.appendFileSync(file,'\n');check((await nativeSessionReport(file)).limitations.includes('unfinished final JSON record excluded'),false);
const contextOnly={input_tokens:0,cached_input_tokens:0,output_tokens:0,reasoning_output_tokens:0,total_tokens:22328};
write([meta,usage(tokens(),contextOnly)]);const contextReport=await nativeSessionReport(file);check(contextReport.contextOnlyUpdates,1);check(contextReport.nativePeakRecordedInputTokens,null);check(contextReport.reportedLifetimeTokens.total_tokens,110);
write([meta,start('a',now),done('a',now+10),start('b',now+30),done('b',now+50)]);check((await nativeSessionReport(file)).completedTurnWallMs,30);
await reject([]);await reject([start('a',now)]);await reject([meta,meta]);await reject([meta,done('a',now)]);await reject([meta,start('a',now),start('a',now)]);await reject([meta,start('a',now),done('a',now-1)]);await reject([meta,start('a',now),done('a',now+1),done('a',now+2)]);
for(const invalid of [-1,null,1.5,Number.MAX_SAFE_INTEGER+1]){const t=tokens();t.input_tokens=invalid;await reject([meta,usage(t)]);}
await reject([meta,usage(tokens(10,20))]);const t=tokens();t.reasoning_output_tokens=11;await reject([meta,usage(t)]);
write([meta]);fs.appendFileSync(file,'{"timestamp":');check((await nativeSessionReport(file)).limitations.includes('unfinished final JSON record excluded'),true);
fs.writeFileSync(file,JSON.stringify(meta)+'\n{broken\n'+JSON.stringify(usage())+'\n');await assert.rejects(nativeSessionReport(file));count++;
fs.writeFileSync(file,'\uFEFF'+JSON.stringify(meta)+'\r\n'+JSON.stringify(usage())+'\r\n');check((await nativeSessionReport(file)).sessionId,'gev-native-fixture');
await assert.rejects(nativeSessionReport(path.join(tmp,'missing.jsonl')));count++;
const nativeStart=start('seconds',now),nativeEnd=done('seconds',now+2000);nativeStart.payload.started_at=now/1000;nativeEnd.payload.completed_at=now/1000+2;
write([meta,nativeStart,nativeEnd]);check((await nativeSessionReport(file)).completedTurnWallMs,2000);
for(const bad of [-1,NaN,0.1,Number.MAX_SAFE_INTEGER]){const s=structuredClone(nativeStart);s.payload.started_at=bad;await reject([meta,s]);}
const report=(at,p=10,w=20,reset=now+3600000)=>({now:at,snapshotFetchedAt:at,codexCredits:{enabled:false},settings:{model:'gpt-6.1-sol',effortLevel:'high'},utilization:{five_hour:{utilization:p,resets_at:iso(reset)},seven_day:{utilization:w,resets_at:iso(now+7*86400000)}},windows:[{label:'5-hour',percentUsed:p,resetsAt:reset,coarse:true},{label:'weekly',percentUsed:w,resetsAt:now+7*86400000,coarse:true}]});
const points=[report(now-600000,10,20),report(now-300000,15,21),report(now,20,22)];
const pace=accountPace(points,now);check(pace.observedWallMs,600000);check(pace.observations,3);check(pace.comparisonEligible,false);check(pace.estimatedBinding,'5-hour');assert.ok(pace.forecasts[0].remainingMsBounds[0]<pace.forecasts[0].remainingMsBounds[1]);count++;
check(accountPace([points.at(-1)],now).forecasts.every(f=>f.remainingMsBounds===null),true);
check(accountPace(points,now+60001).forecasts.every(f=>f.remainingMsBounds===null),true);
check(accountPace(points,now-5001).forecasts.every(f=>f.remainingMsBounds===null),true);
check(accountPace([report(now-1000,10),report(now-500,15),report(now,20)],now).forecasts[0].remainingMsBounds,null);
check(accountPace([report(now-600000,10),report(now-300000,10),report(now,11)],now).forecasts[0].remainingMsBounds,null);
const resets=structuredClone(points);resets[2]=report(now,1,22,now+7200000);check(accountPace(resets,now).observations,1);
const changed=structuredClone(points);changed[2].settings.effortLevel='medium';check(accountPace(changed,now).observations,1);
const resetUsed=structuredClone(points);resetUsed[2]=report(now,1,22);check(accountPace(resetUsed,now).observations,1);
for(const mutate of [x=>x.codexCredits.enabled=true,x=>x.windows[0].stale=true,x=>x.windows[0].estimated=true,x=>x.windows[0].percentUsed=99,x=>x.utilization.five_hour.utilization=null,x=>x.settings=null]){const p=structuredClone(points);mutate(p[2]);assert.throws(()=>accountPace(p,now));count++;}
for(const mutate of [x=>x.windows.push(x.windows[0]),x=>x.now+=60001,x=>delete x.now,x=>x.settings.model={},x=>x.settings.effortLevel=[]]){const p=structuredClone(points);mutate(p[2]);assert.throws(()=>accountPace(p,now));count++;}
assert.throws(()=>accountPace([points[0],points[0],points[2]],now));count++;assert.throws(()=>accountPace([...points].reverse(),now));count++;
write([meta,usage()]);const cli=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../bin/atlias.mjs');
const run=args=>spawnSync(process.execPath,[cli,'session-report',...args],{encoding:'utf8',windowsHide:true,timeout:30000});
let out=run(['--host','codex','--transcript',file,'--json']);check(out.status,0);check(JSON.parse(out.stdout).session.completedTurns,0);
for(const args of [[],['--host','claude','--transcript',file],['--host','codex','--transcript',file,'--unknown'],['--host','codex','--transcript',file,'--json','--json'],['--host','codex','--transcript']]){out=run(args);check(out.status,1);check(out.stdout,'');}
out=run(['--help']);check(out.status,0);assert.match(out.stdout,/Read-only/);count++;
console.log(`${count} session timing/account-pace controls passed; zero models, settings writes or allowance claims.`);
