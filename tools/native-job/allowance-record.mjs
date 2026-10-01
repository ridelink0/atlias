// Read-only Usage Limits bridge for NEW studies. Never starts model inference.
import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
export function snapshotOf(raw,observedAt=Date.now()){
  if(!Number.isFinite(observedAt))throw Error('finite observation time required');
  const report=JSON.parse(raw.replace(/^\uFEFF/,''));
  if(!Number.isFinite(report.snapshotFetchedAt)||observedAt-report.snapshotFetchedAt>60000||report.snapshotFetchedAt-observedAt>5000)throw Error('fresh actual Codex meter required');
  if(report.codexCredits?.enabled!==false)throw Error('paid credits must be explicitly off');
  if(!Array.isArray(report.windows)||!report.windows.length||report.windows.some(w=>typeof w.label!=='string'||!w.label||!Number.isFinite(w.percentUsed)||w.percentUsed<0||w.percentUsed>100||!Number.isFinite(w.resetsAt)||w.resetsAt<=observedAt||w.stale||w.adjusted||w.coarse||w.estimated||w.correctionUnreliable))throw Error('known unadjusted live windows required');
  if(new Set(report.windows.map(w=>w.label)).size!==report.windows.length)throw Error('unique meter windows required');
  const binding=report.windows.find(w=>w.label==='5-hour');if(!binding||Date.parse(report.utilization?.five_hour?.resets_at)!==binding.resetsAt||report.utilization?.five_hour?.utilization!==binding.percentUsed)throw Error('five-hour reset timestamps must agree');
  return {schema:'atlias-allowance-observation-v1',observedAt,snapshotFetchedAt:report.snapshotFetchedAt,paidCreditsEnabled:false,rawSha256:crypto.createHash('sha256').update(raw).digest('hex'),windows:report.windows.map(w=>({label:w.label,percentUsed:w.percentUsed,resetsAt:w.resetsAt})),settings:report.settings||null,limitations:'Account-wide meter; neither token prices nor process-specific billing. Parent, other chats and remote activity may contribute.'};
}
export function intervalOf(before,after,{isolated=false,completed,required,elapsedMs}={}){
  if(before?.schema!=='atlias-allowance-observation-v1'||after?.schema!==before.schema)throw Error('recorded observation schema required');
  if(!Number.isSafeInteger(completed)||!Number.isSafeInteger(required)||completed<0||required<1||completed>required||!Number.isFinite(elapsedMs)||elapsedMs<0)throw Error('verified task counts and elapsed duration required');
  for(const observation of [before,after])if(observation.paidCreditsEnabled!==false||!Array.isArray(observation.windows)||observation.windows.some(w=>typeof w.label!=='string'||!w.label||!Number.isFinite(w.percentUsed)||w.percentUsed<0||w.percentUsed>100||!Number.isFinite(w.resetsAt))||new Set(observation.windows.map(w=>w.label)).size!==observation.windows.length)throw Error('valid original meter observations required');
  const start=before.windows.find(w=>w.label==='5-hour'),end=after.windows.find(w=>w.label==='5-hour');if(!start||!end)throw Error('five-hour observations required');
  const delta=end.percentUsed-start.percentUsed,reasons=[];
  if(!Number.isFinite(before.observedAt)||!Number.isFinite(after.observedAt)||after.observedAt<before.observedAt)throw Error('chronological observation times required');
  if(elapsedMs>after.observedAt-before.observedAt)throw Error('elapsed duration exceeds observed interval');
  if(start.resetsAt!==end.resetsAt||after.observedAt>=start.resetsAt)reasons.push('natural reset crossed');
  if(!Number.isFinite(delta)||delta<=1)reasons.push('nonpositive or unresolved meter change');
  if(isolated!==true)reasons.push('account activity isolation unverified');
  if(completed!==required)reasons.push('required output checks did not all pass');
  const eligible=reasons.length===0;
  return {eligible,reasons,completed,required,elapsedMs,observedPercentDelta:delta,percentDeltaBounds:eligible?[delta-1,delta+1]:null,completedTasksPerPercent:eligible?completed/delta:null,limitations:'One percentage point is reserved for meter rounding. Elapsed wall time does not establish time to exhaustion or causality; taskwise control parity and account-isolation evidence are separate gates.'};
}
export function appendObservation(ledger,record){
  if(fs.existsSync(ledger)){const prior=fs.readFileSync(ledger,'utf8');if(prior&&!prior.endsWith('\n'))throw Error('preserve partial observation ledger; do not append');for(const line of prior.split('\n').filter(Boolean))if(JSON.parse(line).schema!==record.schema)throw Error('preserve incompatible observation ledger');}
  fs.appendFileSync(ledger,JSON.stringify(record)+'\n',{encoding:'utf8'});
}
export function main(args,env=process.env){
  if(args.length!==4||args.some((v,i)=>v!==['--host','codex','--refresh','--json'][i]))throw Error('use exactly --host codex --refresh --json');
  const ledger=env.ATLIAS_ALLOWANCE_LEDGER;if(!ledger||!ledger.endsWith('.jsonl'))throw Error('operator-owned ATLIAS_ALLOWANCE_LEDGER .jsonl required');
  const result=spawnSync(process.execPath,['C:/Users/OWNER/Downloads/claude-code-usage-limits/skills/usage-limits/scripts/usage.js',...args],{encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:4*1024*1024});
  if(result.status!==0)throw Error('prescribed Usage Limits CLI failed; no inference started: '+(result.error?.message||result.stderr.trim()||'exit '+result.status));
  const record=snapshotOf(result.stdout);appendObservation(ledger,record);process.stdout.write(result.stdout);
}
if(process.argv[1]===fileURLToPath(import.meta.url))main(process.argv.slice(2));
