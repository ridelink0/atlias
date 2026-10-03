import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hash,reportGrades } from './protocol.mjs';
const ledger=file=>fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(JSON.parse);
export function nativeReport(questions,responses,grades,{solverPlan,judgePlan}){
  if(solverPlan.role!=='closed-book-solver'||judgePlan.role!=='protected-semantic-judge'||!judgePlan.templateSha256||judgePlan.solverHost!==solverPlan.host||judgePlan.solverArm!==solverPlan.arm)throw Error('solver and judge plans must bind the same arm');
  const ids=new Set(questions.map(q=>q.id)),seen=new Set(),answers=new Map();
  for(const row of responses){
    if(!ids.has(row.id)||seen.has(row.id)||row.planSha256!==hash(JSON.stringify(solverPlan))||row.host!==solverPlan.host||row.arm!==solverPlan.arm||hash(row.response)!==row.responseSha256)throw Error('unknown, duplicate or unbound solver row');
    seen.add(row.id);answers.set(row.id,row);
  }
  const valid=[],gradeIds=new Set();
  for(const row of grades){
    if(!ids.has(row.id)||gradeIds.has(row.id)||row.planSha256!==hash(JSON.stringify(judgePlan))||row.host!==solverPlan.host||row.arm!==solverPlan.arm||row.judge!==judgePlan.model)throw Error('unknown, duplicate or unbound judge row');
    gradeIds.add(row.id);const answer=answers.get(row.id);
    if(!answer||row.responseSha256!==answer.responseSha256||row.questionSha256!==answer.questionSha256)throw Error('judge is not bound to actual solver answer');
    if(answer.valid===true&&row.valid===true)valid.push(row);
  }
  const report=reportGrades(questions,valid,{judge:{model:judgePlan.model,promptSha256:judgePlan.templateSha256}});
  const costs=rows=>({attempts:rows.length,invalid:rows.filter(r=>r.valid!==true).length,rawInput:rows.every(r=>Number.isFinite(r.usage?.promptRaw))?rows.reduce((n,r)=>n+r.usage.promptRaw,0):null,cachedInput:rows.every(r=>Number.isFinite(r.usage?.cachedInput))?rows.reduce((n,r)=>n+r.usage.cachedInput,0):null,output:rows.every(r=>Number.isFinite(r.usage?.output))?rows.reduce((n,r)=>n+r.usage.output,0):null});
  return {...report,solverCostIncludingInvalid:costs(responses),judgeCostIncludingInvalid:costs(grades),solverPlan,judgePlan,limitation:'Public600 native closed-book adaptation, not publisher private6000 leaderboard. Imported native evidence needs transcript audit; no score or usage saving from scripted controls. Missing/invalid calls remain costs and never become abstentions. Actual judge differs from publisher when model/template differs.'};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const [prepared,responses,grades,solverPlanFile,judgePlanFile,out]=process.argv.slice(2);
  if(!out||fs.existsSync(out))throw Error('native-report.mjs <prepared600> <frozenresponses> <frozengrades> <solverplan> <judgeplan> <unusedreport.json>');
  const plan=JSON.parse(fs.readFileSync(prepared+'/plan.json')),questions=JSON.parse(fs.readFileSync(prepared+'/questions.json'));
  if(hash(JSON.stringify(questions))!==plan.questionManifestSha256)throw Error('prepared questions changed');
  const judgePlan=JSON.parse(fs.readFileSync(judgePlanFile));
  if(hash(fs.readFileSync(responses))!==judgePlan.responseLedgerSha256)throw Error('judge was not prepared from this exact frozen solver ledger');
  const report=nativeReport(questions,ledger(responses),ledger(grades),{solverPlan:JSON.parse(fs.readFileSync(solverPlanFile)),judgePlan});
  report.solverLedgerSha256=hash(fs.readFileSync(responses));report.judgeLedgerSha256=hash(fs.readFileSync(grades));
  fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({complete:report.complete,graded:report.graded,planned:report.planned,out}));
}
