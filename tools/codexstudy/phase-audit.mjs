// Independent read-only reconciliation; never executes answers or graders.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {sha256,phasesOf} from './phase-protocol.mjs';
const fields=['input_tokens','cached_input_tokens','output_tokens','reasoning_output_tokens','total_tokens'];
function strict(file) {return fs.readFileSync(file,'utf8').split('\n').filter(s=>s.trim()).map(line=>JSON.parse(line.replace(/^\uFEFF/,'')));}
function counters(v) {assert(v&&fields.every(k=>Number.isSafeInteger(v[k])&&v[k]>=0));assert(v.cached_input_tokens<=v.input_tokens&&v.reasoning_output_tokens<=v.output_tokens&&v.total_tokens===v.input_tokens+v.output_tokens);return Object.fromEntries(fields.map(k=>[k,v[k]]));}
export function auditPhaseCase(folder,phases,{scripted=false}={}) {
  const spec=phasesOf(phases),journal=strict(path.join(folder,'phases.jsonl'));let cursor=0,session=null,previous=null,previousTotals=null,peak=null;const results=[];
  for(let i=0;i<journal.length;i+=2) {
    const start=journal[i],finish=journal[i+1],p=spec[cursor];assert(p&&start.type==='started'&&start.phase===p.id&&start.promptSha256===p.sha256&&start.sessionId===session);
    if(!finish)return {complete:false,held:true,unknownAttempt:p.id,originalAttempts:cursor+1,results,wholeTokens:null,fullNativePeak:null};
    assert(finish.type==='finished'&&finish.phase===p.id&&finish.promptSha256===p.sha256);
    const dir=path.join(folder,'phases',p.id),bytes=fs.readFileSync(path.join(dir,'full-native-session.jsonl'));
    assert.equal(fs.readFileSync(path.join(dir,'input.txt'),'utf8'),p.prompt);assert.equal(sha256(bytes),finish.snapshotSha256);
    if(previous)assert(bytes.subarray(0,previous.length).equals(previous),'native resume must retain the original recorded prefix');
    previous=bytes;
    const events=strict(path.join(dir,'full-native-session.jsonl')),meta=events.filter(e=>e.type==='session_meta');assert.equal(meta.length,1);assert.equal(meta[0].payload.id,finish.sessionId);
    if(session)assert.equal(finish.sessionId,session);session=finish.sessionId;
    assert(events.some(e=>e.type==='response_item'&&e.payload?.role==='user'&&e.payload.content.some(c=>typeof c.text==='string'&&c.text.includes(p.prompt))),'complete original phase input recorded');
    const samples=events.filter(e=>e.type==='event_msg'&&e.payload?.type==='token_count'&&e.payload.info).map(e=>e.payload.info);
    let total=null,prior=null,observed=0,contextOnly=0;
    for(const info of samples) {
      const next=counters(info.total_token_usage);if(prior)assert(fields.every(k=>next[k]>=prior[k]),'native cumulative regression');prior=next;total=next;
      const last=info.last_token_usage;
      if(last&&fields.slice(0,-1).every(k=>last[k]===0)&&Number.isSafeInteger(last.total_tokens)&&last.total_tokens>0&&(last.cache_write_input_tokens===undefined||last.cache_write_input_tokens===0)){contextOnly++;continue;}
      const request=counters(last);peak=Math.max(peak??0,request.input_tokens);observed++;
    }
    assert.deepEqual(total,finish.cumulative);assert.equal(peak,finish.peak);if(previousTotals&&total)assert(fields.every(k=>total[k]>=previousTotals[k]));previousTotals=total;
    const terminal=JSON.parse(fs.readFileSync(path.join(dir,'TERMINAL.json'),'utf8'));assert.equal(terminal.code,finish.exitCode);
    if(!scripted){assert.equal(terminal.timedOut,finish.timedOut);const original=JSON.parse(fs.readFileSync(path.join(dir,'RESULT.json'),'utf8'));assert.deepEqual(original.cumulative,finish.cumulative);assert.deepEqual(original.grade,finish.grade);assert.equal(original.valid,finish.valid);
      // Preserve the original grade receipt. This audit does not execute or
      // reinterpret the model's answer, even if a later grader would differ.
      const gradeText=fs.readFileSync(path.join(dir,'grade.stdout.txt'),'utf8'),verdicts=gradeText.split('\n').flatMap(s=>{try{return [JSON.parse(s)];}catch{return [];}});
      assert.equal(sha256(gradeText),finish.grade.stdoutSha256);
      if(finish.grade.pass)assert(verdicts.some(v=>v.pass===true&&v.nonce===finish.grade.nonce));
      assert(finish.proof.authRemoved);if(finish.valid)assert(finish.proof.inputDelivered&&finish.proof.pinnedIntact);
    }
    results.push({phase:p.id,valid:finish.valid,originalGrade:finish.grade??null,lifetimeTokens:total,recordedFullPeak:peak,recordedCompactions:events.filter(e=>e.type==='compacted').length,contextOnlyUpdates:contextOnly,usageObservations:observed,snapshotSha256:finish.snapshotSha256});cursor++;
  }
  const held=results.some(r=>!r.valid||r.lifetimeTokens===null)||journal.some(r=>r.type==='finished'&&(r.exitCode!==0||r.timedOut));
  return {complete:cursor===spec.length&&!held,held,originalAttempts:cursor,results,reportedWholeNativeTokens:previousTotals,wholeTokens:held?null:previousTotals,fullNativePeak:cursor?peak:null,scripted,
    limitations:['Whole session totals are counted once, not added across phase snapshots.','Recorded input is not full-wire tool-schema accounting or subscription debit proof.','Original grades retained; no answer execution or regrading.']};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const [folder,plan]=process.argv.slice(2);const p=JSON.parse(fs.readFileSync(plan,'utf8'));console.log(JSON.stringify(auditPhaseCase(path.resolve(folder),p.phases.map(({id,prompt})=>({id,prompt}))),null,2));}
