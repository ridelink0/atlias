import assert from 'node:assert/strict';
import {allowanceSchedule} from './allowance-schedule.mjs';
let checks=0;
const fixture=(iso,used=0)=>{const reset=Date.parse(iso),now=reset-3600000;return {now,report:{snapshotFetchedAt:now,windows:[{label:'5-hour',percentUsed:used,resetsAt:reset},{label:'weekly',percentUsed:31}],utilization:{five_hour:{resets_at:iso}}}}};
for(const [iso,rule] of [['2026-10-01T16:06:02Z','FREQ=DAILY;BYHOUR=11;BYMINUTE=8'],['2026-10-01T08:49:18Z','FREQ=DAILY;BYHOUR=3;BYMINUTE=51'],['2026-12-01T06:59:50Z','FREQ=DAILY;BYHOUR=1;BYMINUTE=1'],['2026-03-08T08:00:00Z','FREQ=DAILY;BYHOUR=3;BYMINUTE=1'],['2026-11-01T07:00:00Z','FREQ=DAILY;BYHOUR=1;BYMINUTE=1']]){
  const {now,report}=fixture(iso),p=allowanceSchedule(report,now);assert.equal(p.rrule,rule);checks++;
  assert.ok(Date.parse(p.wakeUtc)-Date.parse(p.resetUtc)>=60000);checks++;
}
const {now,report}=fixture('2026-10-01T16:06:02Z');
assert.equal(allowanceSchedule(report,now).startModels,true);checks++;
assert.equal(allowanceSchedule(fixture('2026-10-01T16:06:02Z',100).report,now).startModels,false);checks++;
assert.throws(()=>allowanceSchedule(report,now+60001),/fresh/);checks++;
assert.throws(()=>allowanceSchedule({...report,snapshotFetchedAt:now+5001},now),/fresh/);checks++;
const mismatch=structuredClone(report);mismatch.windows[0].resetsAt++;
assert.throws(()=>allowanceSchedule(mismatch,now),/agree/);checks++;
const unknown=structuredClone(report);unknown.windows[1].percentUsed=null;
assert.throws(()=>allowanceSchedule(unknown,now),/known/);checks++;
assert.throws(()=>allowanceSchedule({...report,snapshotFetchedAt:Date.parse(report.utilization.five_hour.resets_at)},Date.parse(report.utilization.five_hour.resets_at)),/future/);checks++;
const weekly=structuredClone(report);weekly.windows[1]={label:'weekly',key:'seven_day',percentUsed:90,resetsAt:Date.parse('2026-10-07T22:45:56Z')};weekly.utilization.seven_day={resets_at:'2026-10-07T22:45:56Z'};
const weekPlan=allowanceSchedule(weekly,now);assert.equal(weekPlan.bindingWindow,'weekly');assert.equal(weekPlan.rrule,'FREQ=WEEKLY;BYDAY=WE;BYHOUR=17;BYMINUTE=47');assert.equal(weekPlan.startModels,false);checks+=3;
const both=structuredClone(weekly);both.windows[0].percentUsed=90;assert.equal(allowanceSchedule(both,now).resetUtc,'2026-10-07T22:45:56.000Z');checks++;
const missing=structuredClone(weekly);delete missing.windows[1].resetsAt;assert.throws(()=>allowanceSchedule(missing,now),/blocking/);checks++;
const wrongWeek=structuredClone(weekly);wrongWeek.utilization.seven_day.resets_at='2026-10-08T22:45:56Z';assert.throws(()=>allowanceSchedule(wrongWeek,now),/weekly.*agree/);checks++;
const laterPrimary=structuredClone(weekly);laterPrimary.windows[0].percentUsed=90;laterPrimary.windows[0].resetsAt=Date.parse('2026-10-08T03:10:00Z');laterPrimary.utilization.five_hour.resets_at='2026-10-08T03:10:00Z';assert.equal(allowanceSchedule(laterPrimary,now).bindingWindow,'5-hour');checks++;
console.log(`${checks} total schedule controls passed, including the actual weekly blocker; zero models.`);
const extra=structuredClone(weekly);extra.windows.push({label:'unknown',percentUsed:95,resetsAt:Date.parse('2026-10-14T22:45:56Z')});assert.throws(()=>allowanceSchedule(extra,now),/unsupported/);checks++;
console.log(`${checks} allowance schedule controls passed; no model or automation calls.`);
