// Plan the ONE existing heartbeat from a fresh live meter. No model call,
// reset redemption, automation write or Usage Limits feature change.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
export function allowanceSchedule(report, now=Date.now()) {
  if(!Number.isFinite(now)||!Number.isFinite(report?.snapshotFetchedAt)||now-report.snapshotFetchedAt>60000||report.snapshotFetchedAt-now>5000)throw Error('fresh live allowance snapshot required');
  const window=report.windows?.find(w=>w.label==='5-hour');
  const reset=Date.parse(report.utilization?.five_hour?.resets_at);
  if(!Number.isFinite(reset)||reset!==window?.resetsAt||reset<=now)throw Error('future live reset ISO and window timestamp must agree');
  if(!report.windows.length||report.windows.some(w=>!Number.isFinite(w.percentUsed)||w.percentUsed<0||w.percentUsed>100))throw Error('all allowance windows must be known');
  const wake=Math.ceil(reset/60000)*60000+60000;
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hourCycle:'h23',hour:'2-digit',minute:'2-digit'}).formatToParts(wake);
  const hour=Number(parts.find(p=>p.type==='hour').value),minute=Number(parts.find(p=>p.type==='minute').value);
  return {resetUtc:new Date(reset).toISOString(),wakeUtc:new Date(wake).toISOString(),
    resetChicago:new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',dateStyle:'full',timeStyle:'long'}).format(reset),
    rrule:`FREQ=DAILY;BYHOUR=${hour};BYMINUTE=${minute}`,
    startModels:report.windows.every(w=>w.percentUsed<90),
    policy:'One check at the currently verified reset, then re-anchor this SAME heartbeat when a new live reset is observed. A scheduled check never establishes quota or model availability. Recheck fresh time/allowance on wake, including daylight-saving transitions.'};
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(allowanceSchedule(JSON.parse(fs.readFileSync(0,'utf8'))),null,2));
