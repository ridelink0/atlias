// Plan the ONE existing heartbeat from a fresh live meter. No model call,
// reset redemption, automation write or Usage Limits feature change.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
export function allowanceSchedule(report, now=Date.now()) {
  if(!Number.isFinite(now)||!Number.isFinite(report?.snapshotFetchedAt)||now-report.snapshotFetchedAt>60000||report.snapshotFetchedAt-now>5000)throw Error('fresh live allowance snapshot required');
  const window=report.windows?.find(w=>w.label==='5-hour');
  const primaryReset=Date.parse(report.utilization?.five_hour?.resets_at);
  if(!Number.isFinite(primaryReset)||primaryReset!==window?.resetsAt||primaryReset<=now)throw Error('future live reset ISO and window timestamp must agree');
  if(!report.windows.length||report.windows.some(w=>!Number.isFinite(w.percentUsed)||w.percentUsed<0||w.percentUsed>100))throw Error('all allowance windows must be known');
  const blocked=report.windows.filter(w=>w.percentUsed>=90);
  if(blocked.some(w=>!Number.isFinite(w.resetsAt)||w.resetsAt<=now))throw Error('future reset required for every blocking window');
  const selected=blocked.length?blocked.reduce((a,b)=>a.resetsAt>=b.resetsAt?a:b):window;
  const reset=selected.resetsAt;
  const weekly=selected.label==='weekly'||selected.key==='seven_day';
  if(!weekly&&selected.label!=='5-hour')throw Error('unsupported blocking window; no schedule guessed');
  if(weekly&&Date.parse(report.utilization?.seven_day?.resets_at)!==reset)throw Error('weekly reset ISO and window timestamp must agree');
  const wake=Math.ceil(reset/60000)*60000+60000;
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hourCycle:'h23',hour:'2-digit',minute:'2-digit',weekday:'short'}).formatToParts(wake);
  const hour=Number(parts.find(p=>p.type==='hour').value),minute=Number(parts.find(p=>p.type==='minute').value);
  const days={Sun:'SU',Mon:'MO',Tue:'TU',Wed:'WE',Thu:'TH',Fri:'FR',Sat:'SA'};
  const day=days[parts.find(p=>p.type==='weekday').value];
  return {resetUtc:new Date(reset).toISOString(),wakeUtc:new Date(wake).toISOString(),
    resetChicago:new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',dateStyle:'full',timeStyle:'long'}).format(reset),
    bindingWindow:selected.label,blockedWindows:blocked.map(w=>w.label),
    rrule:`FREQ=${weekly?'WEEKLY;BYDAY='+day:'DAILY'};BYHOUR=${hour};BYMINUTE=${minute}`,
    startModels:report.windows.every(w=>w.percentUsed<90),
    policy:'One check at the currently verified reset, then re-anchor this SAME heartbeat when a new live reset is observed. A scheduled check never establishes quota or model availability. Recheck fresh time/allowance on wake, including daylight-saving transitions.'};
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(allowanceSchedule(JSON.parse(fs.readFileSync(0,'utf8'))),null,2));
