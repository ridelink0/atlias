import fs from 'node:fs';import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readJsonl,pairedRatio} from '../ccstudy/lib.mjs';
export function summarize(rows){
  const keys=new Set();for(const r of rows){const k=`${r.task}|${r.repeat}|${r.arm}`;if(keys.has(k))throw new Error(`duplicate benchmark row ${k}`);keys.add(k);}
  const excluded=rows.filter(r=>!r.valid||!Number.isFinite(r.promptRaw)||r.promptRaw<0||r.exitCode!==0||r.timedOut);
  const valid=rows.filter(r=>!excluded.includes(r));const arms=[...new Set(valid.map(r=>r.arm))];
  const stats={};for(const arm of arms){const xs=valid.filter(r=>r.arm===arm),solved=xs.filter(r=>r.solved).length;stats[arm]={n:xs.length,solved,promptRaw:xs.reduce((s,r)=>s+r.promptRaw,0),perSolved:solved?xs.reduce((s,r)=>s+r.promptRaw,0)/solved:null,peak:Math.max(...xs.map(r=>r.contextPeak||0))};}
  const comparisons=[];const control=new Map(valid.filter(r=>r.arm==='plain').map(r=>[`${r.task}|${r.repeat}`,r]));
  for(const arm of arms.filter(a=>a!=='plain')){
    const pairs=valid.filter(r=>r.arm===arm&&control.has(`${r.task}|${r.repeat}`)).map(b=>({a:control.get(`${b.task}|${b.repeat}`),b}));
    // Bootstrap semantic families, not correlated context variants or repeats.
    const families=new Map();for(const {a,b}of pairs){const f=families.get(a.family)||{a:0,b:0};f.a+=a.promptRaw;f.b+=b.promptRaw;families.set(a.family,f);}
    const ratio=pairedRatio([...families.values()]);delete ratio.perTask;
    if(families.size<6){ratio.bootLo=null;ratio.bootHi=null;ratio.tLo=null;ratio.tHi=null;ratio.warning='pilot only: fewer than six semantic families; no credible confidence interval';}
    const pairedStats={};for(const side of ['a','b']){const xs=pairs.map(p=>p[side]),solved=xs.filter(r=>r.solved).length,tokens=xs.reduce((s,r)=>s+r.promptRaw,0);pairedStats[side==='a'?'plain':arm]={n:xs.length,solved,promptRaw:tokens,perSolved:solved?tokens/solved:null,contextPeak:xs.length?Math.max(...xs.map(r=>r.contextPeak||0)):null};}
    comparisons.push({arm,pairedRuns:pairs.length,semanticFamilies:families.size,pairedStats,rawRatio:ratio,plainOnly:pairs.filter(p=>p.a.solved&&!p.b.solved).map(p=>p.a.task),pluginOnly:pairs.filter(p=>!p.a.solved&&p.b.solved).map(p=>p.b.task)});
  }return {stats,comparisons,excluded:excluded.map(r=>({task:r.task,arm:r.arm,reason:r.invalidReason||'invalid protocol, missing usage, timeout, or nonzero CLI exit'}))};
}
const file=process.argv[2];if(process.argv[1]===fileURLToPath(import.meta.url)&&file){const result=summarize(readJsonl(file));fs.writeFileSync(path.join(path.dirname(file),'summary.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));}
