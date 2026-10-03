import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {auditPhaseCase} from './phase-audit.mjs';import {phasesOf,sha256} from './phase-protocol.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'Gev-phase-audit-')),sid='11111111-2222-3333-4444-555555555555';
const phases=[{id:'first',prompt:'Gev original first phase'},{id:'second',prompt:'Gev original second phase'},{id:'last',prompt:'Gev original final phase'}],spec=phasesOf(phases);
let checks=0;const ok=f=>{f();checks++;};
function build(folder) {
  fs.mkdirSync(folder);let events=[{type:'session_meta',payload:{id:sid}}],journal=[];
  for(let i=0;i<3;i++) {
    const p=spec[i],dir=path.join(folder,'phases',p.id);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'input.txt'),p.prompt);
    const cumulative={input_tokens:(i+1)*100,cached_input_tokens:0,output_tokens:(i+1)*5,reasoning_output_tokens:0,total_tokens:(i+1)*105};
    events.push({type:'response_item',payload:{role:'user',content:[{text:p.prompt}]}},{type:'event_msg',payload:{type:'token_count',info:{total_token_usage:cumulative,last_token_usage:{...cumulative,input_tokens:100,output_tokens:5,total_tokens:105}}}});
    if(i===2)events.push({type:'event_msg',payload:{type:'token_count',info:{total_token_usage:cumulative,last_token_usage:{input_tokens:0,cached_input_tokens:0,output_tokens:0,reasoning_output_tokens:0,total_tokens:99999}}}});
    const bytes=events.map(e=>JSON.stringify(e)+'\n').join('');fs.writeFileSync(path.join(dir,'full-native-session.jsonl'),bytes);
    const gradeText=JSON.stringify({nonce:'Gev synthetic audit control',pass:true})+'\n';
    const result={phase:p.id,promptSha256:p.sha256,sessionId:sid,valid:true,timedOut:false,exitCode:0,cumulative,peak:100,snapshotSha256:sha256(bytes),proof:{authRemoved:true,inputDelivered:true,pinnedIntact:true},grade:{pass:true,nonce:'Gev synthetic audit control',stdoutSha256:sha256(gradeText)}};
    journal.push({type:'started',phase:p.id,promptSha256:p.sha256,sessionId:i?sid:null},{...result,type:'finished'});
    fs.writeFileSync(path.join(dir,'TERMINAL.json'),JSON.stringify({code:0,timedOut:false}));fs.writeFileSync(path.join(dir,'RESULT.json'),JSON.stringify(result));fs.writeFileSync(path.join(dir,'grade.stdout.txt'),gradeText);
  }
  fs.writeFileSync(path.join(folder,'phases.jsonl'),journal.map(r=>JSON.stringify(r)+'\n').join(''));return journal;
}
try {
  const folder=path.join(root,'valid');build(folder);const result=auditPhaseCase(folder,phases);
  ok(()=>assert.equal(result.complete,true));ok(()=>assert.equal(result.wholeTokens.input_tokens,300));ok(()=>assert.equal(result.fullNativePeak,100));ok(()=>assert.equal(result.results[2].contextOnlyUpdates,1));
  for(const mutate of [
    (d,j)=>j[1].cumulative.input_tokens=1000,
    (d,j)=>j[2].sessionId=null,
    (d,j)=>j[1].snapshotSha256='wrong',
    (d,j)=>j[1].peak=99999,
    (d,j)=>fs.writeFileSync(path.join(d,'phases/first/input.txt'),'shortened'),
    (d,j)=>fs.writeFileSync(path.join(d,'phases/first/grade.stdout.txt'),'{}'),
    (d,j)=>{const f=path.join(d,'phases/second/full-native-session.jsonl'),e=fs.readFileSync(f,'utf8').split('\n').filter(Boolean).map(JSON.parse);e[0].payload.id='aaaaaaaa-2222-3333-4444-555555555555';fs.writeFileSync(f,e.map(v=>JSON.stringify(v)+'\n').join(''));j[3].snapshotSha256=sha256(fs.readFileSync(f));},
    (d,j)=>fs.appendFileSync(path.join(d,'phases/last/full-native-session.jsonl'),'invalid\n'),
  ]){const d=path.join(root,'bad-'+checks),j=build(d);mutate(d,j);fs.writeFileSync(path.join(d,'phases.jsonl'),j.map(v=>JSON.stringify(v)+'\n').join(''));ok(()=>assert.throws(()=>auditPhaseCase(d,phases)));}
  const pending=path.join(root,'pending'),j=build(pending);fs.writeFileSync(path.join(pending,'phases.jsonl'),j.slice(0,3).map(r=>JSON.stringify(r)+'\n').join(''));const held=auditPhaseCase(pending,phases);ok(()=>assert(held.held&&!held.complete&&held.wholeTokens===null&&held.originalAttempts===2));
} finally {fs.rmSync(root,{recursive:true,force:true});}
console.log(`${checks} independent Gev phase-audit controls passed; 0 model calls.`);
