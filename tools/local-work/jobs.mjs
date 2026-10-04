// Gev's durable engineering tasks. Independent acceptance never grades old studies.
import fs from 'node:fs';import path from 'node:path';
import {atomic,child} from './runtime.mjs';import {hash} from './migrate.mjs';
export function validateJobs(jobs){
 if(!Array.isArray(jobs))throw Error('engineering jobs must be an array');
 const ids=new Set();for(const job of jobs){
  if(!/^[a-z0-9-]+$/.test(job.id||'')||ids.has(job.id)||typeof job.title!=='string'||!job.title.trim()||typeof job.contract!=='string'||!job.contract.trim())throw Error('invalid or duplicate engineering job');ids.add(job.id);
  if(!Array.isArray(job.targets)||!job.targets.length||job.targets.some(p=>typeof p!=='string'||path.isAbsolute(p)||p.includes('..')||/[\\:\r\n\0]/.test(p)||!p.endsWith('.mjs')))throw Error('invalid job target');
  if(!job.check?.file||!Array.isArray(job.check.args)||job.check.args.some(x=>typeof x!=='string')||!/^[a-f0-9]{64}$/.test(job.check.sha256||''))throw Error('job needs a pinned independent acceptance check');
 }
 return jobs;
}
export function jobIdentity(job){return hash(Buffer.from(JSON.stringify(job)));}
export function nextJob(root,jobs){
 validateJobs(jobs);const file=path.join(root,'JOB-PROGRESS.json');
 const state=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{completed:[]};
 if(!Array.isArray(state.completed))throw Error('invalid job progress');
 const job=jobs.find(j=>!state.completed.some(c=>c.id===j.id&&c.definition===jobIdentity(j)));
 return {state,job};
}
export function targetHashes(workspace,job){return job.targets.map(p=>[p,fs.existsSync(path.join(workspace,p))?hash(fs.readFileSync(path.join(workspace,p))):null]);}
export function implementationHashes(workspace){
 const rows=[];function walk(folder){if(!fs.existsSync(folder))return;for(const e of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=path.join(folder,e.name);if(e.isSymbolicLink())continue;if(e.isDirectory()&&!['node_modules','.git'].includes(e.name))walk(p);else if(e.isFile()&&/\.(?:mjs|js|py|ps1|html|css)$/.test(e.name))rows.push([path.relative(workspace,p),hash(fs.readFileSync(p))]);}}
 for(const folder of ['lib','tools','bin'])walk(path.join(workspace,folder));return rows;
}
export async function acceptJob(job,workspace,env,{run=child}={}){
 if(hash(fs.readFileSync(job.check.file))!==job.check.sha256)throw Error('independent job check changed');
 return run('node',[job.check.file,...job.check.args],workspace,env);
}
export function saveJob(root,selected,job,{accepted=false,round,receipt,initialTargets}={}){
 const completed=[...selected.completed];if(accepted&&!completed.some(c=>c.id===job.id&&c.definition===jobIdentity(job)))completed.push({id:job.id,title:job.title,definition:jobIdentity(job),round,receipt,at:new Date().toISOString()});
 atomic(path.join(root,'JOB-PROGRESS.json'),{completed,active:accepted?null:{...(selected.active?.id===job.id?selected.active:{}),id:job.id,title:job.title,round,...(initialTargets?{initialTargets}:{})},at:new Date().toISOString()});
}
export function actionCue(reads,job){return reads>0&&reads%5===0?`\nController direction: ${reads} read-only calls without an edit. Finish the declared task ${job.title}. Target: ${job.targets.join(', ')}. Use the existing evidence to implement, run the visible acceptance check, adversarially inspect, and write LOCAL-PROGRESS.md. Further reads must resolve a specific missing fact; do not restart archive research.`:'';}
export function jobExecutor(job,base){
 return async(state,call,ask)=>{
  if(call.tool==='read_file'&&path.resolve(state.cwd,call.path||'.')===path.resolve(job.check.file)){
   const bytes=fs.readFileSync(job.check.file);if(hash(bytes)!==job.check.sha256)throw Error('public engineering check changed');
   const offset=call.offset??1,limit=call.limit??200;if(!Number.isSafeInteger(offset)||offset<1||!Number.isSafeInteger(limit)||limit<1)return 'Public acceptance read needs positive safe integer offset/limit.';
   const lines=bytes.toString('utf8').split(/\r?\n/),selected=lines.slice(offset-1,offset-1+Math.min(limit,200));
   return JSON.stringify({path:job.check.file,sourceHash:job.check.sha256,totalLines:lines.length,returnedLineCount:selected.length,endLine:selected.length?offset+selected.length-1:null,text:selected.map((s,i)=>`${offset+i}: ${s}`).join('\n'),publicEngineeringAcceptance:true});
  }
  if(['write_file','edit_file','apply_patch'].includes(call.tool)){
   const paths=call.tool==='apply_patch'?(await import('../../lib/loop.mjs')).parsePatch(String(call.input||'')).hunks?.flatMap(h=>[h.path,...(h.moveTo?[h.moveTo]:[])])||[]:[call.path];
   const allowed=new Set([...job.targets,'LOCAL-PROGRESS.md']);
   if(!paths.length||paths.some(p=>typeof p!=='string'||!allowed.has(path.relative(state.cwd,path.resolve(state.cwd,p)).replaceAll('\\','/'))))return `This engineering task permits source edits only to ${job.targets.join(', ')} and LOCAL-PROGRESS.md. Run the declared public acceptance instead of creating unrelated debug files. Original files remain protected.`;
  }
  return base(state,call,ask);
 };
}
