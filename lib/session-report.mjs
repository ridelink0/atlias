// Read-only native accounting. No model calls, settings writes or inferred billing.
import fs from 'node:fs';
import readline from 'node:readline';

const tokenKeys = ['input_tokens','cached_input_tokens','output_tokens','reasoning_output_tokens','total_tokens'];
function usage(value) {
  if(!value || tokenKeys.some(k=>!Number.isSafeInteger(value[k])||value[k]<0)
    || value.cached_input_tokens>value.input_tokens || value.reasoning_output_tokens>value.output_tokens
    || value.total_tokens!==value.input_tokens+value.output_tokens)throw Error('invalid native token counters');
  return Object.fromEntries(tokenKeys.map(k=>[k,value[k]]));
}
function timestamp(value) {const n=Date.parse(value);if(typeof value!=='string'||!Number.isFinite(n))throw Error('valid native timestamp required');return n;}
// Actual Codex task lifecycle fields are UNIX seconds; JSONL timestamps are ISO.
function taskTime(value,fallback) {
  if(value===undefined)return timestamp(fallback);
  if(typeof value==='string')return timestamp(value);
  if(!Number.isSafeInteger(value)||value<0||!Number.isFinite(new Date(value*1000).getTime()))throw Error('valid native task UNIX seconds required');
  return value*1000;
}
function unionMs(intervals) {
  let total=0,start=null,end=null;
  for(const [a,b] of intervals.toSorted?intervals.toSorted((x,y)=>x[0]-y[0]):[...intervals].sort((x,y)=>x[0]-y[0])) {
    if(start===null){start=a;end=b;}else if(a<=end)end=Math.max(end,b);else{total+=end-start;start=a;end=b;}
  }
  return total+(start===null?0:end-start);
}
export async function nativeSessionReport(file) {
  let first=null,last=null,sessionId=null,totals=null,priorTotal=null,regressed=false,peak=0,lines=0,observations=0,contextOnlyUpdates=0,requestObservations=0;
  const started=new Map(),completed=new Set(),intervals=[],limitations=[];
  const requests=new Map(),requestThreads=new Map(),compactRequests=new Set();let lastThread=null,missingCompactUsage=0;
  function requestRecord(record,compaction=false) {
    if(!record){if(compaction)missingCompactUsage++;return;}
    if(typeof record.response_id!=='string'||!record.response_id||record.session_id!==sessionId)throw Error('request usage must identify this native session and response');
    const u=usage(record.usage),thread=usage(record.thread_token_usage),old=requests.get(record.response_id);
    if(old){if(JSON.stringify(old)!==JSON.stringify(u)||JSON.stringify(requestThreads.get(record.response_id))!==JSON.stringify(thread))throw Error('conflicting duplicate native request usage');}
    else {if(lastThread&&tokenKeys.some(k=>thread[k]<lastThread[k]))throw Error('native request lifetime counters decreased');requests.set(record.response_id,u);requestThreads.set(record.response_id,thread);lastThread=thread;}
    if(compaction)compactRequests.add(record.response_id);
  }
  let trailingPartial=false;
  // A live writer may leave ONE unfinished final line. Interior corruption is an error.
  let pending=null;
  function consume(line) {
    if(!line.trim())return;
    if(Buffer.byteLength(line,'utf8')>16*1024*1024)throw Error('native record exceeds bounded parser limit');
    const r=JSON.parse(line.replace(/^\uFEFF/,'')),at=timestamp(r.timestamp);
    first=first===null?at:Math.min(first,at);last=last===null?at:Math.max(last,at);lines++;
    if(r.type==='session_meta') {
      if(sessionId!==null||typeof r.payload?.id!=='string'||!r.payload.id)throw Error('one native session identity required');
      sessionId=r.payload.id;
    }
    if(r.type==='token_usage_record')requestRecord(r.payload);
    if(r.type==='compacted'){
      const compact=r.payload,record=compact?.latest_token_usage_record;
      if(!record||typeof compact.compaction_response_id!=='string'||!compact.compaction_response_id)missingCompactUsage++;
      else {if(record.response_id!==compact.compaction_response_id)throw Error('compaction usage must bind its exact native response');requestRecord(record,true);}
    }
    if(r.type!=='event_msg')return;
    const p=r.payload;
    if(p?.type==='task_started') {
      if(typeof p.turn_id!=='string'||!p.turn_id||started.has(p.turn_id)||completed.has(p.turn_id))throw Error('unique native turn identity required');
      started.set(p.turn_id,taskTime(p.started_at,r.timestamp));
    }
    if(p?.type==='task_complete') {
      if(!started.has(p.turn_id)||completed.has(p.turn_id))throw Error('native completion must match one started turn');
      const a=started.get(p.turn_id),b=taskTime(p.completed_at,r.timestamp);
      if(b<a)throw Error('native completion precedes its start');
      intervals.push([a,b]);completed.add(p.turn_id);
    }
    if(p?.type==='token_count'&&p.info) {
      const next=usage(p.info.total_token_usage),lastUsage=p.info.last_token_usage;
      // Observed after native compaction: all spend fields zero while total_tokens
      // holds a context count. It is NOT a billable request or a spend delta.
      const contextOnly=lastUsage&&tokenKeys.slice(0,-1).every(k=>lastUsage[k]===0)
        &&(lastUsage.cache_write_input_tokens===undefined||lastUsage.cache_write_input_tokens===0)
        &&Number.isSafeInteger(lastUsage.total_tokens)&&lastUsage.total_tokens>0;
      if(contextOnly)contextOnlyUpdates++;
      else {const request=usage(lastUsage);peak=Math.max(peak,request.input_tokens);requestObservations++;}
      if(priorTotal!==null&&tokenKeys.some(k=>next[k]<priorTotal[k]))regressed=true;
      totals=next;priorTotal=next;observations++;
    }
  }
  const stream=fs.createReadStream(file,{encoding:'utf8'}),reader=readline.createInterface({input:stream,crlfDelay:Infinity});
  stream.on('error',()=>reader.close());
  let streamError=null;stream.on('error',e=>{streamError=e;});
  for await(const line of reader){if(pending!==null)consume(pending);pending=line;}
  if(streamError)throw streamError;
  if(pending!==null&&pending.trim()) {
    try {JSON.parse(pending.replace(/^\uFEFF/,''));}catch(e){if(e instanceof SyntaxError)trailingPartial=true;else throw e;}
    if(!trailingPartial)consume(pending);
  }
  if(sessionId===null||first===null)throw Error('native session metadata and records required');
  if(trailingPartial)limitations.push('unfinished final JSON record excluded');
  if(regressed)limitations.push('cumulative native counters decreased; lifetime token total withheld');
  const unclosed=[...started.keys()].filter(k=>!completed.has(k));
  if(unclosed.length)limitations.push('unclosed turns have no completed duration; they may be active or interrupted');
  const summed=Object.fromEntries(tokenKeys.map(k=>[k,0]));
  for(const request of requests.values())for(const k of tokenKeys){summed[k]+=request[k];if(!Number.isSafeInteger(summed[k]))throw Error('native request sum exceeds exact integer accounting');}
  const reconciled=requests.size>0&&!missingCompactUsage&&!trailingPartial&&tokenKeys.every(k=>summed[k]===lastThread[k]);
  if(requests.size&&!reconciled)limitations.push('unique request usage does not reconcile completely; request lifetime total withheld');
  if(missingCompactUsage)limitations.push('native compaction lacks its own request usage; complete request accounting withheld');
  return {schema:'atlias-native-session-report-v1',host:'codex',sessionId,records:lines,
    firstRecord:new Date(first).toISOString(),lastRecord:new Date(last).toISOString(),conversationSpanMs:last-first,
    completedTurns:completed.size,unclosedTurns:unclosed.length,
    completedTurnWallMs:unionMs(intervals),summedCompletedTurnWallMs:intervals.reduce((s,[a,b])=>s+b-a,0),
    nativeUsageObservations:observations,requestUsageObservations:requestObservations,contextOnlyUpdates,
    reportedLifetimeTokens:regressed?null:totals,
    nativePeakRecordedInputTokens:requestObservations?peak:null,
    requestAccounting:{status:reconciled?'reconciled-request-records':requests.size?'incomplete-request-records':'request-records-unavailable',uniqueRequests:requests.size,compactionRequests:compactRequests.size,missingCompactionUsage:missingCompactUsage},
    requestLifetimeTokens:reconciled?summed:null,
    nativePeakAllRecordedRequestInputTokens:requests.size?[...requests.values()].reduce((n,u)=>Math.max(n,u.input_tokens),0):null,
    limitations:[...limitations,'Completed-turn wall time includes tool waits; it is not model compute time or continuously active work.',
      'Reported input includes cached tokens; reasoning is already included in output. These counters are not subscription debits.',
      'Native task lifecycle times use second-resolution UNIX timestamps where supplied.',
      'Context-count-only updates are excluded from request peaks; repeated cumulative totals are never summed.',
      'Legacy event_msg token totals and peaks may exclude compaction. Unique response records include recorded compaction requests when reconciliation succeeds; neither field proves provider billing or unrecorded wire work.',
      'Recorded request input is not proof of full wire tool-schema/context accounting.',
      'No on/off source attribution or account-isolation proof is inferred from this transcript.']};
}

function livePoint(report) {
  const at=report?.snapshotFetchedAt;
  if(!Number.isSafeInteger(at)||!Number.isSafeInteger(report?.now)||report.codexCredits?.enabled!==false)throw Error('live report with original timestamp and paid credits explicitly off required');
  if(!Array.isArray(report.windows)||new Set(report.windows.map(w=>w?.label)).size!==report.windows.length)throw Error('unique core meter windows required');
  if(Number.isFinite(report.now)&&(report.now-at>60000||at-report.now>5000))throw Error('original snapshot was stale when recorded');
  const windows=[];
  for(const [key,label] of [['five_hour','5-hour'],['seven_day','weekly']]) {
    const u=report.utilization?.[key],w=report.windows?.find(x=>x.label===label),reset=Date.parse(u?.resets_at);
    if(!Number.isFinite(u?.utilization)||u.utilization<0||u.utilization>100||!Number.isFinite(reset)||reset<=at
      || !w || w.percentUsed!==u.utilization || w.resetsAt!==reset || w.stale || w.adjusted || w.estimated || w.correctionUnreliable)throw Error('matching authoritative live core meter required');
    // coarse describes the CLI's transcript-derived pace, not the live utilization.
    windows.push({label,used:u.utilization,reset});
  }
  if(typeof report.settings?.model!=='string'||!report.settings.model||typeof report.settings?.effortLevel!=='string'||!report.settings.effortLevel)throw Error('model and effort attribution required');
  return {at,windows,settings:JSON.stringify([report.settings.model,report.settings.effortLevel])};
}
export function accountPace(reports,now=Date.now()) {
  if(!Array.isArray(reports)||!reports.length||!Number.isFinite(now))throw Error('recorded live reports and current time required');
  const points=reports.map(livePoint),latest=points.at(-1),reasons=[];
  if(now-latest.at>60000||latest.at-now>5000)reasons.push('latest observation is not fresh');
  for(let i=1;i<points.length;i++)if(points[i].at<=points[i-1].at)throw Error('strictly chronological unique observations required');
  let start=points.length-1;
  while(start>0&&points[start-1].settings===latest.settings&&points[start-1].windows.every((w,i)=>w.reset===latest.windows[i].reset)&&points[start].windows.every((w,i)=>w.used>=points[start-1].windows[i].used))start--;
  const segment=points.slice(start),elapsed=latest.at-segment[0].at;
  if(segment.length<3)reasons.push('at least three observations in unchanged windows/settings required');
  if(elapsed<5*60000)reasons.push('at least five minutes of observed account pace required');
  const forecasts=latest.windows.map((w,i)=>{
    const delta=w.used-segment[0].windows[i].used;
    if(delta<=1)return {window:w.label,percentUsed:w.used,observedDelta:delta,remainingMsBounds:null,reason:'meter change does not exceed rounding uncertainty'};
    const left=100-w.used,slow=(delta-1)/elapsed,fast=(delta+1)/elapsed;
    const bounds=[Math.max(0,left-1)/fast,Math.max(0,left+1)/slow];
    return {window:w.label,percentUsed:w.used,observedDelta:delta,remainingMsBounds:reasons.length?null:bounds,
      resetAt:new Date(w.reset).toISOString(),resetMayPrecedeExhaustion:w.reset-latest.at<bounds[1]};
  });
  const measured=forecasts.filter(f=>f.remainingMsBounds);
  return {schema:'atlias-account-pace-v1',observations:segment.length,observedWallMs:elapsed,reasons,forecasts,
    estimatedBinding:measured.sort((a,b)=>a.remainingMsBounds[0]-b.remainingMsBounds[0])[0]?.window||null,
    comparisonEligible:false,limitations:'Account-wide recent wall-clock pace, assuming unchanged workload. Rounded meters, local/remote concurrent activity and resets limit prediction. This is no on/off causal comparison, guaranteed working time or token allowance.'};
}
