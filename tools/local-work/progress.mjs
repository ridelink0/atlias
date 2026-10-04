// Gev's progress: completed requirements are distinct from completed round steps.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const GOALS=Object.freeze([
 ['factuality','Useful factuality','Independent factuality checks and useful answers'],
 ['capability','Normal capabilities','Ordinary coding and long workflows without reduced tools'],
 ['codex','Codex coverage','Actual Codex activation and matched quality evidence'],
 ['claude','Claude Code coverage','Genuine Claude activation and matched quality evidence'],
 ['tokens','20x fewer tokens','All attempts and compaction costs; ratio at most 0.05'],
 ['context','20x less peak context','Full maximum native request; ratio at most 0.05'],
 ['allowance','25x useful work','Independent subscription allowance experiment']
]);
export const STAGES=['research','plan','code','review','independent-check'];
export function goalQualified(id,audit){
 if(audit?.independent!==true||audit?.status!=='verified'||audit?.normalCapabilities!==true||!Array.isArray(audit.hosts)||!['codex','claude'].every(h=>audit.hosts.includes(h)))return false;
 if(id==='tokens'||id==='context')return audit.fullCostKnown===true&&Number.isFinite(audit.ratio)&&audit.ratio>0&&audit.ratio<=0.05&&audit.sameOrBetter===true&&audit.metric===(id==='tokens'?'total-tokens':'full-native-peak-context');
 if(id==='allowance')return audit.causalMatched===true&&audit.sameOrBetter===true&&Number.isFinite(audit.usefulWorkRatio)&&audit.usefulWorkRatio>=25;
 if(id==='codex'||id==='claude')return audit.genuineActivation===true&&audit.fullDeliveryVerified===true&&audit.sameOrBetter===true;
 return audit.heldOut===true&&audit.sameOrBetter===true;
}
export function percent(done,total){return Number.isFinite(done)&&Number.isFinite(total)&&total>0?Math.max(0,Math.min(100,Math.floor(done/total*100))):0;}
function read(root,file,warnings){try{return JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));}catch(e){if(e.code!=='ENOENT')warnings.push(`${file}: unreadable`);return null;}}
export function snapshot(root,{now=new Date(),live=false}={}){
 const warnings=[],state=read(root,'STATUS.json',warnings),flow=read(root,'WORKFLOW-STATUS.json',warnings),queue=read(root,'JOB-PROGRESS.json',warnings);
 // No model-written self-assessment may advance the whole-goal percentage.
 // Goal promotion requires a separate independent audit; none is qualified yet.
 const pin=read(root,'CONTROLLER-PIN.json',warnings);
 const goals=GOALS.map(([id,title,requirement])=>{
  let verified=false;const record=Array.isArray(pin?.goalAudits)?pin.goalAudits.find(r=>r?.id===id):null;
  if(record){try{const bytes=fs.readFileSync(record.file);if(crypto.createHash('sha256').update(bytes).digest('hex')!==record.sha256)throw Error('changed audit');verified=goalQualified(id,JSON.parse(bytes));if(!verified)warnings.push(`${title}: audit does not meet the requirement`);}catch{warnings.push(`${title}: pinned audit unavailable or changed`);}}
  return {id,title,requirement,verified};
 });
 const verifiedGoals=goals.filter(g=>g.verified).length;
 const round=Number.isSafeInteger(state?.round)&&state.round>=0?state.round:0;
 const currentFlow=flow?.round===round?flow:null;
 const steps=STAGES.map(id=>({id,completed:currentFlow?.steps?.[id]?.completed===true,active:live&&currentFlow?.stage===id}));
 const completed=steps.filter(x=>x.completed).length;
 const attention=read(root,'ATTENTION.json',warnings),held=fs.existsSync(path.join(root,'STOP'));
 return {refreshedAt:now.toISOString(),sourceUpdatedAt:currentFlow?.at||state?.at||null,round,roundPercent:percent(completed,STAGES.length),completedSteps:completed,totalSteps:STAGES.length,steps,goalPercent:percent(verifiedGoals,goals.length),verifiedGoals,totalGoals:goals.length,goals,live,status:held?'Paused for setup':attention?'Needs attention':verifiedGoals===goals.length?'Goal verified':live?'Working locally':'No verified live worker',stage:currentFlow?.stage||'Waiting',failures:Number.isSafeInteger(state?.failures)?state.failures:0,job:queue?.active||null,completedJobs:Array.isArray(queue?.completed)?queue.completed.length:0,warnings};
}
