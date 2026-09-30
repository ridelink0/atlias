#!/usr/bin/env node
// Native Codex, plain vs one installed plugin. No substitute model or API key.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadTaskList, writeFiles } from '../ccstudy/run.mjs';
import { childEnv, readJsonl } from '../ccstudy/lib.mjs';
import { score, tamper } from '../../lib/eval.mjs';
import { runAsync } from '../../lib/proc.mjs';
import {flagEnvName} from '../../lib/core.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const opt=(a,k,d='')=>a.includes(k)?a[a.indexOf(k)+1]:d;
export function validateResume(old,plan){if(['sha','plugin','model','effort','lean'].some(k=>old[k]!==plan[k])||Boolean(old.taskContext)!==Boolean(plan.taskContext)||JSON.stringify(old.tasks)!==JSON.stringify(plan.tasks))throw new Error('resume would mix plugin/model/effort/flags or task hashes; choose a new output directory');if(Number.isSafeInteger(old.repeats)&&plan.repeats<old.repeats)throw new Error('resume cannot decrease repeats; retain or extend the existing plan');}
export function limitsOf(a){const stopPercent=Number(opt(a,'--stop-percent','60')),timeoutMin=Number(opt(a,'--timeout-min','12'));if(!Number.isFinite(stopPercent)||stopPercent<=0||stopPercent>100||!Number.isFinite(timeoutMin)||timeoutMin<=0)throw new Error('stop percentage must be in (0,100] and timeout minutes must be positive and finite');return {stopPercent,timeoutMin};}
export function profileEnv(lean,taskContext=false){return {...(lean?{[flagEnvName('leanBrief')]:'1',[flagEnvName('gateRunsCheck')]:'1'}:{}),...(taskContext?{[flagEnvName('taskContext')]:'1'}:{})};}
export function taskContextReceived(events){return events.some(r=>r.type==='response_item'&&r.payload?.type==='message'&&['developer','user'].includes(r.payload.role)&&JSON.stringify(r.payload.content).includes('[atlias task context]'));}
function sync(bin,args,options={}){const r=spawnSync(bin,args,{encoding:'utf8',windowsHide:true,timeout:120000,...options});if(r.status!==0)throw new Error(`${bin} failed: ${(r.stderr||r.stdout||r.error||'').toString().slice(-700)}`);return r.stdout.trim();}
export function usageOf(rows){
  const counts=rows.filter(r=>r.type==='event_msg'&&r.payload?.type==='token_count'&&r.payload.info);
  const total=counts.at(-1)?.payload.info.total_token_usage;
  if(!total)return {promptRaw:null,cachedInput:null,output:null,contextPeak:null,contextMean:null,tokenSamples:0};
  const seen=new Set(),ctx=[];
  for(const r of counts){const key=JSON.stringify(r.payload.info.total_token_usage);if(seen.has(key))continue;seen.add(key);const n=r.payload.info.last_token_usage?.input_tokens;if(Number.isFinite(n))ctx.push(n);}
  return {promptRaw:total.input_tokens??null,cachedInput:total.cached_input_tokens??null,output:total.output_tokens??null,contextPeak:ctx.length?Math.max(...ctx):null,contextMean:ctx.length?ctx.reduce((a,b)=>a+b,0)/ctx.length:null,tokenSamples:ctx.length};
}
export function flowOf(rows){
  const ids=new Set(),calls=[];
  for(const r of rows){const c=r.type==='response_item'?r.payload:null;if(!c||!['function_call','custom_tool_call'].includes(c.type))continue;const id=c.call_id||c.id;if(id&&ids.has(id))continue;if(id)ids.add(id);calls.push(c);}
  const waits=calls.filter(c=>/(^|\.)wait$/.test(c.name||''));
  const delays=waits.map(c=>{try{return JSON.parse(c.arguments||'{}').yield_time_ms;}catch{return null;}}).filter(n=>Number.isFinite(n)&&n>=0);
  return {outerToolCalls:calls.length,waitCalls:waits.length,shortWaitCalls:delays.filter(n=>n>=0&&n<10000).length,minRequestedWaitMs:delays.length?Math.min(...delays):null};
}
export function jobsOf(tasks,repeats){
  const jobs=[];for(let repeat=1;repeat<=repeats;repeat++)for(let i=0;i<tasks.length;i++){
    const arms=(i+repeat)%2?['plain','plugin']:['plugin','plain'];
    for(const arm of arms)jobs.push({task:tasks[i],repeat,arm});
  }return jobs;
}
export function contained(root,rel){const p=path.resolve(root,rel);if(p===root||!p.startsWith(path.resolve(root)+path.sep))throw new Error(`unsafe task path ${rel}`);return p;}
function filesUnder(root){if(!fs.existsSync(root))return [];return fs.readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?filesUnder(path.join(root,e.name)):[path.join(root,e.name)]);}
async function run(bin,args,{env,cwd,stream,stderr,timeoutMs}){
  const r=await runAsync(bin,args,{env,cwd,timeoutMs,maxBuffer:32*1024*1024});
  fs.writeFileSync(stream,r.stdout||'');fs.writeFileSync(stderr,r.stderr||'');
  return {code:r.status,timedOut:r.timedOut};
}
export async function main(a){
  const {stopPercent,timeoutMin}=limitsOf(a);
  const list=path.resolve(opt(a,'--tasks')),taskRoot=path.resolve(opt(a,'--task-root',ROOT));
  const variant=opt(a,'--variant');
  const tasks=loadTaskList(list,taskRoot).filter(t=>!variant||t.id.endsWith(`-${variant}`)).slice(0,Number(opt(a,'--pairs','6')));
  const repo=path.resolve(opt(a,'--plugin-repo',ROOT)),ref=opt(a,'--ref','HEAD');
  const sha=sync('git',['-C',repo,'rev-parse',`${ref}^{commit}`]);
  const plugin=JSON.parse(sync('git',['-C',repo,'show',`${sha}:.claude-plugin/plugin.json`]));
  const repeats=Number(opt(a,'--repeat','1'));
  if(!Number.isSafeInteger(repeats)||repeats<1||repeats>3||!tasks.length)throw new Error('need tasks and 1..3 repeats');
  for(const t of tasks)for(const rel of [...Object.keys(t.files||{}),...Object.keys(t.hidden||{}),...(t.protect||[])])contained(path.resolve('task-root'),rel);
  const out=path.resolve(opt(a,'--out','D:/harness-work/runs/codex-plugin-study'));
  const model=opt(a,'--model','gpt-6.1-sol'),effort=opt(a,'--effort','medium');
  const lean=a.includes('--lean');
  const taskContext=a.includes('--task-context');
  const plan={engine:'native Codex CLI',plugin:plugin.name,sha,model,effort,lean,taskContext,repeats,tasks:tasks.map(t=>({id:t.id,sha256:t.taskSha256,family:t.family})),jobs:jobsOf(tasks,repeats).length,order:'alternate plain/plugin order by task and repeat',paidCredits:'account setting must remain off'};
  fs.mkdirSync(out,{recursive:true});
  const planFile=path.join(out,'plan.json');
  if(fs.existsSync(planFile)&&fs.existsSync(path.join(out,'rows.jsonl')))validateResume(JSON.parse(fs.readFileSync(planFile)),plan);
  fs.writeFileSync(planFile,JSON.stringify(plan,null,2)+'\n');
  if(!a.includes('--run')){console.log(JSON.stringify(plan,null,2));return;}
  const bin=opt(a,'--codex','codex');
  const auth=path.resolve(opt(a,'--auth-file',path.join(process.env.USERPROFILE||process.env.HOME,'.codex','auth.json')));
  const authDoc=JSON.parse(fs.readFileSync(auth,'utf8'));
  if(authDoc.OPENAI_API_KEY||!authDoc.tokens)throw new Error('subscription login required; API-key billing is refused');
  const archive=path.join(out,'plugin');
  const archiveStamp=path.join(out,'plugin-sha.txt');
  if(!fs.existsSync(archive)){fs.mkdirSync(archive);sync('git',['-C',repo,'archive','--format=tar','-o',path.join(out,'plugin.tar'),sha]);sync('tar',['-xf',path.join(out,'plugin.tar'),'-C',archive]);fs.writeFileSync(archiveStamp,sha+'\n');}
  else if(!fs.existsSync(archiveStamp)||fs.readFileSync(archiveStamp,'utf8').trim()!==sha)throw new Error('archived plugin provenance missing or changed; preserve this run and choose a new output directory');
  const rowsFile=path.join(out,'rows.jsonl'),old=readJsonl(rowsFile);
  for(const row of old){const task=plan.tasks.find(t=>t.id===row.task);if(!task||task.sha256!==row.taskSha256)throw new Error('saved row task hash differs from the plan');}
  const done=new Set(old.map(r=>`${r.task}|${r.repeat}|${r.arm==='plain'?'plain':'plugin'}`));
  for(const job of jobsOf(tasks,repeats)){
    if(done.has(`${job.task.id}|${job.repeat}|${job.arm}`))continue;
    // Read the account meter before each run. Parent and test calls share it.
    const meter=JSON.parse(sync(process.execPath,[opt(a,'--usage-script','C:/Users/OWNER/Downloads/claude-code-usage-limits/skills/usage-limits/scripts/usage.js'),'--host','codex','--json']));
    const windows=meter.windows||[];
    if(!windows.length)throw new Error('quota windows unavailable; no model call started');
    if(windows.some(w=>!Number.isFinite(w.percentUsed)))throw new Error('quota percentage unknown; no model call started');
    if(windows.some(w=>w.percentUsed>=stopPercent)) {console.log('Stopped at requested account allowance boundary.');break;}
    const base=path.join(out,'runs',job.task.id,`r${job.repeat}-${job.arm}`);
    if(fs.existsSync(base))throw new Error(`unfinished run exists: ${base}; preserve and inspect it before retrying`);
    const home=path.join(base,'home'),ws=path.join(base,'ws'),codexHome=path.join(home,'.codex');fs.mkdirSync(codexHome,{recursive:true});fs.mkdirSync(ws,{recursive:true});
    writeFiles(ws,job.task.files);
    const env=childEnv(process.env,{home});env.CODEX_HOME=codexHome;env.ATLIAS_HOME=path.join(home,'.atlias');
    if(job.arm==='plugin')Object.assign(env,profileEnv(lean,taskContext));
    const globalSkills=[path.join(process.env.USERPROFILE||process.env.HOME,'.agents','skills'),path.join(process.env.USERPROFILE||process.env.HOME,'.codex','skills')].flatMap(root=>fs.existsSync(root)?fs.readdirSync(root).filter(n=>fs.existsSync(path.join(root,n,'SKILL.md'))).map(n=>path.join(root,n)):[]);
    const overrides=globalSkills.map(p=>`{ path = ${JSON.stringify(p.replaceAll('\\','/'))}, enabled = false }`).join(', ');
    fs.writeFileSync(path.join(codexHome,'config.toml'),`model_reasoning_effort = "${effort}"\nservice_tier = "default"\nskills.config = [${overrides}]\n[features]\nhooks = true\napps = false\n`);
    fs.writeFileSync(path.join(codexHome,'AGENTS.md'),'The user is Gev. Start replies with "Okay Gev". No emojis. Make only requested changes. Check functionality, then adversarial edge cases. Use node --check, never tsc.\n');
    if(job.arm==='plugin'){
      if(plugin.name==='atlias'){
        sync(process.execPath,[path.join(archive,'bin/atlias.mjs'),'install','--codex'],{env,cwd:ws});
        fs.cpSync(path.join(archive,'skills'),path.join(codexHome,'skills'),{recursive:true});
      }else{
        sync(bin,['plugin','marketplace','add',archive],{env,cwd:ws});
        sync(bin,['plugin','add',`${plugin.name}@${plugin.name}`],{env,cwd:ws});
      }
    }
    fs.copyFileSync(auth,path.join(codexHome,'auth.json'));
    const args=['--no-daemon','-a','never','exec','--skip-git-repo-check','--ignore-rules','--dangerously-bypass-hook-trust','--json','-s','danger-full-access','-c','features.apps=false','-m',model,'-C',ws,job.task.prompt];
    const started=Date.now();console.log(`START ${job.task.id} r${job.repeat} ${job.arm}`);
    let proc;
    try {proc=await run(bin,args,{env,cwd:ws,stream:path.join(base,'stream.jsonl'),stderr:path.join(base,'stderr.txt'),timeoutMs:timeoutMin*60000});}
    finally {fs.rmSync(path.join(codexHome,'auth.json'),{force:true});}
    const rollouts=filesUnder(path.join(codexHome,'sessions')).filter(f=>f.endsWith('.jsonl'));
    const events=rollouts.flatMap(readJsonl),usage=usageOf(events);
    writeFiles(ws,job.task.hidden);const grade=score(ws,job.task),cheat=tamper(ws,job.task);
    const hookLogs=filesUnder(path.join(home,'.atlias','sessions')).filter(f=>f.endsWith('.jsonl'));
    const configText=fs.readFileSync(path.join(codexHome,'config.toml'),'utf8');
    const proof={hooksConfigured:fs.existsSync(path.join(codexHome,'hooks.json')),mcpConfigured:configText.includes('[mcp_servers.atlias]'),hookEvents:hookLogs.flatMap(readJsonl).length,skills:fs.existsSync(path.join(codexHome,'skills')),pluginEnabled:configText.includes(`[plugins.${JSON.stringify(`${plugin.name}@${plugin.name}`)}]`)};
    const streamRows=readJsonl(path.join(base,'stream.jsonl'));
    const blocked=streamRows.some(r=>/blocked by policy|workspace is read-only/.test(JSON.stringify(r)));
    const actualModels=[...new Set(events.filter(r=>r.type==='turn_context').map(r=>r.payload.model).filter(Boolean))];
    const valid=!blocked&&actualModels.length===1&&actualModels[0]===model&&(job.arm==='plain'?!proof.hooksConfigured&&!proof.mcpConfigured:(plugin.name==='atlias'?proof.hooksConfigured&&proof.mcpConfigured&&proof.hookEvents>0:proof.pluginEnabled));
    const row={...usage,...flowOf(events),task:job.task.id,family:job.task.family||job.task.id,repeat:job.repeat,arm:job.arm==='plain'?'plain':plugin.name,sha:job.arm==='plain'?'':sha,taskSha256:job.task.taskSha256,model,effort,lean:job.arm==='plugin'&&lean,cliVersion:sync(bin,['--version'],{env}),solved:grade.pass&&!cheat.files.length&&!proc.timedOut&&proc.code===0,valid,proof,checkOutput:grade.output,tampered:cheat.files,exitCode:proc.code,timedOut:proc.timedOut,ms:Date.now()-started,base,compactions:events.filter(r=>r.type==='compacted').length,at:new Date().toISOString()};
    row.taskContext=job.arm==='plugin'&&taskContext;
    row.proof.taskContextDelivered=taskContextReceived(events);
    row.proof.taskContextGenerated=hookLogs.flatMap(readJsonl).some(r=>r.kind==='task-context');
    if(row.taskContext&&!(row.proof.taskContextDelivered&&row.proof.taskContextGenerated)){row.valid=false;row.invalidReason='task-context flag requested but generated and delivered prompt context were not both recorded';}
    fs.appendFileSync(rowsFile,JSON.stringify(row)+'\n');console.log(`${row.solved?'PASS':'FAIL'} ${row.arm} ${row.task}: raw=${row.promptRaw}, peak=${row.contextPeak}, valid=${valid}`);
    // The account token is never retained in benchmark artifacts after the call.
    fs.rmSync(path.join(codexHome,'auth.json'),{force:true});
    if(!row.valid||usage.promptRaw===null||proc.timedOut||proc.code!==0)throw new Error('pilot/protocol failed; inspect retained artifacts before spending again');
  }
}
if(process.argv[1]===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
