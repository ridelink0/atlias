// Independent-batch study protocol. These are whole native attempts, not
// twelve invented per-job token observations. No model or quota API here.
export function batchJobs(tasks) {
  if(!Array.isArray(tasks)||tasks.length!==12||tasks.some(t=>!t||typeof t.id!=='string'||!t.id.trim()||typeof t.family!=='string'||!t.family.trim())||new Set(tasks.map(t=>t.id)).size!==12||new Set(tasks.map(t=>t.family)).size!==12)throw Error('keep twelve distinct authored families');
  const plain=repeat=>tasks.map(task=>({key:`r${repeat}-plain-${task.id}`,repeat,arm:'plain',tasks:[task]}));
  const batch=repeat=>({key:`r${repeat}-batch`,repeat,arm:'atlias-batch',tasks:[...tasks]});
  return [...plain(1),batch(1),batch(2),...plain(2)];
}

export function validateBatchRows(rows,plan) {
  const expected=batchJobs(plan.tasks),seen=new Set();
  for(const row of rows){
    const job=expected.find(j=>j.key===row.key);
    if(!job||seen.has(row.key))throw Error('unknown or duplicate whole attempt');seen.add(row.key);
    if(row.sha!==plan.sha||row.model!==plan.model||row.effort!==plan.effort||row.arm!==job.arm||row.repeat!==job.repeat)throw Error('whole attempt provenance differs');
    if(typeof row.valid!=='boolean'||typeof row.timedOut!=='boolean'||(row.exitCode!==null&&!Number.isSafeInteger(row.exitCode)))throw Error('invalid native attempt status');
    const members=row.members;
    if(!Array.isArray(members)||members.length!==job.tasks.length||members.some(m=>!m||![true,false,null].includes(m.solved))||new Set(members.map(m=>m.task)).size!==members.length||job.tasks.some(t=>!members.some(m=>m.task===t.id&&m.taskSha256===t.sha256)))throw Error('whole attempt member coverage differs');
    // A failed attempt can have unknown counters and unavailable grades. Keep
    // it; absence must not become free work or an invented successful solve.
    for(const field of ['promptRaw','cachedInput','output'])if(row[field]!==null&&(!Number.isFinite(row[field])||row[field]<0))throw Error('invalid native usage counter');
    if(row.promptRaw!==null&&row.cachedInput!==null&&row.cachedInput>row.promptRaw)throw Error('cached input exceeds raw native input');
  }
  return {recorded:seen.size,planned:26,closed:seen.size===26};
}

export function wholeBatchCosts(rows,plan) {
  const closure=validateBatchRows(rows,plan);
  const arms=Object.fromEntries(['plain','atlias-batch'].map(arm=>{
    const selected=rows.filter(r=>r.arm===arm),known=selected.filter(r=>['promptRaw','cachedInput','output'].every(f=>r[f]!==null));
    const sum=field=>selected.reduce((n,r)=>n+(r[field]===null?0:r[field]),0);
    const raw=sum('promptRaw'),cached=sum('cachedInput'),output=sum('output');
    const uncached=selected.reduce((n,r)=>n+(r.promptRaw===null||r.cachedInput===null?0:r.promptRaw-r.cachedInput),0);
    return [arm,{attempts:selected.length,unknownCostAttempts:selected.length-known.length,unknownCounters:Object.fromEntries(['promptRaw','cachedInput','output'].map(f=>[f,selected.filter(r=>r[f]===null).length])),raw,cached,output,total:raw+output,uncachedPlusOutput:uncached+output,invalidAttempts:selected.filter(r=>!r.valid).length,solvedMembers:selected.flatMap(r=>r.members).filter(m=>m.solved===true).length}];
  }));
  const qualityPassed=closure.closed&&rows.every(r=>r.valid&&r.exitCode===0&&!r.timedOut&&r.members.every(m=>m.solved===true));
  const costsKnown=Object.values(arms).every(a=>a.unknownCostAttempts===0);
  return {...closure,arms,qualityPassed,costsKnown,ratioEligible:qualityPassed&&costsKnown,
    limitations:['All known counter components, including invalid and failed attempts, are retained once.','Unknown counter components have explicit per-field and per-attempt counts; known subtotals cannot establish savings.','Two batch observations are coupled across their twelve jobs; member counts are not independent cost samples.','Closed finite quality checks do not establish general host capability or subscription usage parity.']};
}
