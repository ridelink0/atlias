// Separately pinned experimental study. Twenty-four fresh native controls,
// two whole independent-job batches. Never pool historical controls or retry.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadTaskList,writeFiles} from '../ccstudy/run.mjs';
import {childEnv,readJsonl} from '../ccstudy/lib.mjs';
import {assertFreshAllowance,usageOf,flowOf,skillConfigPaths} from './run.mjs';
import {batchJobs,validateBatchRows,wholeBatchCosts} from './batch-protocol.mjs';
import {runAsync} from '../../lib/proc.mjs';
import {score,tamper} from '../../lib/eval.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const HASH=x=>crypto.createHash('sha256').update(x).digest('hex');
const RULES='The user is Gev. Start replies with "Okay Gev". No emojis. Make only requested changes. Check functionality, then adversarial edge cases. Use node --check, never tsc.\n';
const walk=dir=>!fs.existsSync(dir)?[]:fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):e.isFile()?[path.join(dir,e.name)]:[]);
const opt=(args,name,def='')=>{const i=args.indexOf(name);if(i<0)return def;if(!args[i+1]||args[i+1].startsWith('--'))throw Error(`missing ${name} value`);return args[i+1];};
const sync=(bin,args,options={})=>{const r=spawnSync(bin,args,{encoding:'utf8',windowsHide:true,timeout:60000,...options});if(r.status!==0)throw Error(`${path.basename(bin)} failed; preserve and inspect outputs`);return r.stdout;};
export function prerequisites(plan,rows,audit,bytes,ci,sha){
  if(plan.sha!=='d7e614ccfb1d18437d96b0a33f65778989a2d534'||plan.jobs!==24||plan.repeats!==2||plan.tasks?.length!==6||rows.length!==24)throw Error('complete unchanged D7 capability plan required');
  const keys=plan.tasks.flatMap(t=>[1,2].flatMap(repeat=>['plain','atlias'].map(arm=>`${t.id}|${repeat}|${arm}`)));
  if(new Set(rows.map(r=>`${r.task}|${r.repeat}|${r.arm}`)).size!==24||keys.some(k=>!rows.some(r=>`${r.task}|${r.repeat}|${r.arm}`===k))||rows.some(r=>!r.valid||!r.solved||r.timedOut||r.exitCode!==0||r.model!==plan.model||r.effort!==plan.effort||r.taskSha256!==plan.tasks.find(t=>t.id===r.task)?.sha256||r.sha!==(r.arm==='plain'?'':plan.sha)))throw Error('capability quality or provenance gate failed');
  if(!audit?.complete||audit.source!==plan.sha||audit.ledgerSha256!==HASH(bytes)||audit.audits?.length!==24||audit.audits.some(a=>!a.fullInputDelivered||!a.nativeUsageReconciled||!a.authRemoved||!a.originalGrade||!a.protocolValid))throw Error('full frozen capability audit required');
  const auditKeys=audit.audits.map(a=>`${a.task}|${a.repeat}|${a.arm}`);if(new Set(auditKeys).size!==24||keys.some(k=>!auditKeys.includes(k)))throw Error('audit member coverage differs');
  if(ci?.headSha!==sha||ci.status!=='completed'||ci.conclusion!=='success'||ci.jobs?.length!==9||ci.jobs.some(j=>j.conclusion!=='success'))throw Error('candidate exact nine-job CI required');
  return {capabilityLedgerSha256:HASH(bytes),candidateCI:ci.headSha};
}
export function recipe(task){
  const readPaths=Object.keys(task.files||{}).filter(p=>!p.startsWith('archive/'));
  const writePaths=readPaths.filter(p=>p.startsWith('src/')&&!(task.protect||[]).includes(p));
  if(!['docs/contract.md','src/api.mjs','package.json','smoke.mjs'].every(p=>readPaths.includes(p))||!writePaths.length||readPaths.length>32||readPaths.some(p=>Object.hasOwn(task.hidden||{},p)))throw Error('task outside declared bounded batch recipe');
  return {readPaths,writePaths};
}
export function gradingResult({grade,cheat,functional,adversarial,expectedCases,checkerExit,exitCode,timedOut,hiddenPresent=false}){
  return Boolean(grade.pass&&!cheat.files.length&&!hiddenPresent&&functional===0&&checkerExit===0&&Number.isSafeInteger(expectedCases)&&expectedCases>0&&adversarial?.cases===expectedCases&&adversarial.passed===expectedCases&&exitCode===0&&!timedOut);
}
export function sourceSnapshot(members){return JSON.stringify(members.map(m=>({task:m.task.id,files:recipe(m.task).readPaths.map(rel=>{const p=path.join(m.modelWs,rel);try{return {rel,sha256:HASH(fs.readFileSync(p))};}catch(e){return {rel,sha256:null,error:e.code||'read-failure'};}})})));}
export function parseRollouts(files){const events=[],errors=[];for(const file of files){let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(file));}catch(e){errors.push({file,error:e.code||'invalid-encoding'});continue;}for(const [i,line]of text.split('\n').entries()){if(!line.trim())continue;try{events.push(JSON.parse(line));}catch{errors.push({file,line:i+1,error:'invalid-json'});}}}return {events,errors};}
export function studyRows(file){if(!fs.existsSync(file))return [];const parsed=parseRollouts([file]);if(parsed.errors.length)throw Error('malformed saved ledger; preserve it without silent row loss or retries');return parsed.events;}
export async function main(args){
  const output=opt(args,'--out'),ref=opt(args,'--ref'),native=opt(args,'--codex');if(!output||!ref||!native)throw Error('--out --ref --codex required');
  const out=path.resolve(output),sha=sync('git',['-C',ROOT,'rev-parse',`${ref}^{commit}`]).trim(),archive=path.join(out,'plugin');fs.mkdirSync(out,{recursive:true});
  const stamp=path.join(out,'plugin-sha.txt');
  if(!fs.existsSync(archive)){fs.mkdirSync(archive);sync('git',['-C',ROOT,'archive','--format=tar','-o',path.join(out,'plugin.tar'),sha]);sync('tar',['-xf',path.join(out,'plugin.tar'),'-C',archive]);fs.writeFileSync(stamp,sha+'\n');}
  if(!fs.existsSync(stamp)||fs.readFileSync(stamp,'utf8').trim()!==sha)throw Error('preserve archive with missing or different provenance');
  const tasks=loadTaskList(path.join(archive,'evals/context-heldout/manifest.json'),archive).filter(t=>t.id.endsWith('-64'));
  if(tasks.length!==12)throw Error('keep complete twelve-family study');
  const {behaviorCases}=await import(pathToFileURL(path.join(archive,'tools/codexstudy/behavior-cases.mjs'))),cases=behaviorCases();
  if(Object.values(cases).reduce((n,c)=>n+c.length,0)!==1260)throw Error('keep original1260 cases');
  const {prepareBatch}=await import(pathToFileURL(path.join(archive,'lib/native-job-batch.mjs')));
  const plan={protocol:'independent-batch-v1; finite bounded jobs, not general host parity',sha,model:'gpt-6.1-sol',effort:'medium',tasks:tasks.map(t=>({id:t.id,sha256:t.taskSha256,family:t.family,...recipe(t)})),jobs:26,repeats:2,order:batchJobs(tasks).map(j=>j.key),driverSha256:HASH(fs.readFileSync(fileURLToPath(import.meta.url))),caseSetSha256:HASH(JSON.stringify(cases)),userInstructionsSha256:HASH(RULES),paidCredits:false,automaticRetries:false,grading:'original protected grades AND identical1260 predeclared cases in BOTH arms; hidden grading written only AFTER models',accounting:'every whole attempt once, all failed/invalid/unmatched/unknown costs retained; two coupled batch samples',limitations:['Bounded worker uses reduced native tools; normal-host capability and subscription savings require separate evidence.','Native Claude inference and real OAuth activation remain unmeasured.']};
  const planFile=path.join(out,'plan.json');if(fs.existsSync(planFile)){if(JSON.stringify(JSON.parse(fs.readFileSync(planFile)))!==JSON.stringify(plan))throw Error('existing plan differs; never mutate or shrink');}else fs.writeFileSync(planFile,JSON.stringify(plan,null,2)+'\n',{flag:'wx'});
  // Verify packet fit with all original visible source and complete tasks,
  // excluding the same historical archive as the separately published worker.
  const preflight=path.join(out,'preflight');const specs=tasks.map(t=>{const root=path.join(preflight,t.id);if(!fs.existsSync(root))writeFiles(root,t.files);for(const [rel,text]of Object.entries(t.files))if(fs.readFileSync(path.join(root,rel),'utf8')!==text)throw Error('preflight source changed');return {id:t.id,root,task:t.prompt,instructions:[RULES],...recipe(t)};});
  const batch=prepareBatch(specs);fs.writeFileSync(path.join(out,'PREFLIGHT.json'),JSON.stringify({modelCalls:0,jobs:12,batchSha256:batch.batchSha256,inputBytes:Buffer.byteLength(batch.input),cases:1260},null,2)+'\n');
  if(!args.includes('--run')){console.log(JSON.stringify({status:'prepared-unmeasured',planned:26,modelCalls:0,sha,out}));return;}
  for(const rel of ['tools/codexstudy/batch-run.mjs','tools/codexstudy/batch-protocol.mjs','tools/codexstudy/run.mjs','tools/ccstudy/run.mjs','tools/ccstudy/lib.mjs','lib/proc.mjs','lib/eval.mjs']){const archived=fs.readFileSync(path.join(archive,rel),'utf8'),operator=fs.readFileSync(path.join(ROOT,rel),'utf8');if(archived.replaceAll('\r\n','\n')!==operator.replaceAll('\r\n','\n'))throw Error(`operator code differs from pinned source: ${rel}`);}
  const prior=opt(args,'--prerequisite'),auditDir=opt(args,'--capability-audit'),ciFile=opt(args,'--exact-ci');if(!prior||!auditDir||!ciFile)throw Error('capability prerequisite, full audit and exact CI required before inference');
  const priorBytes=fs.readFileSync(path.join(prior,'rows.jsonl')),priorRows=readJsonl(path.join(prior,'rows.jsonl'));
  const auditBytes=fs.readFileSync(path.join(auditDir,'rows.jsonl'));if(!priorBytes.equals(auditBytes))throw Error('prerequisite and frozen audited ledger differ');
  const proof=prerequisites(JSON.parse(fs.readFileSync(path.join(prior,'plan.json'))),priorRows,JSON.parse(fs.readFileSync(path.join(auditDir,'AUDIT.json'))),priorBytes,JSON.parse(fs.readFileSync(ciFile)),sha);
  fs.writeFileSync(path.join(out,'PREREQUISITES.json'),JSON.stringify(proof,null,2)+'\n');
  const auth=opt(args,'--auth-file',path.join(process.env.USERPROFILE||process.env.HOME,'.codex/auth.json')),authDoc=JSON.parse(fs.readFileSync(auth));if(authDoc.OPENAI_API_KEY||!authDoc.tokens?.access_token)throw Error('subscription OAuth required; API billing refused');
  const usageCli=opt(args,'--usage-cli','C:/Users/OWNER/Downloads/claude-code-usage-limits/skills/usage-limits/scripts/usage.js'),rowsFile=path.join(out,'rows.jsonl'),old=studyRows(rowsFile);validateBatchRows(old,plan);
  if(old.some(r=>!r.valid||r.timedOut||r.exitCode!==0))throw Error('retained protocol/process failure; do not resume known-broken configuration');
  const done=new Set(old.map(r=>r.key)),runner=path.join(archive,'tools/native-job/run.mjs'),checker=path.join(archive,'tools/codexstudy/behavior-check.mjs');
  for(const job of batchJobs(tasks)){
    if(done.has(job.key))continue;
    const meter=JSON.parse(sync(process.execPath,[usageCli,'--host','codex','--refresh','--json']));assertFreshAllowance(meter);if(meter.windows.some(w=>w.percentUsed>=90)){console.log('Stopped at declared allowance boundary.');break;}
    const base=path.join(out,'runs',job.key);if(fs.existsSync(base))throw Error('unfinished attempt exists; preserve it, no retries');fs.mkdirSync(base,{recursive:true});
    const home=path.join(base,'home'),ch=path.join(home,'.codex');fs.mkdirSync(ch,{recursive:true});const env=childEnv(process.env,{home});env.CODEX_HOME=ch;
    const members=job.tasks.map(t=>{const ws=path.join(base,'workspaces',t.id);writeFiles(ws,t.files);return {task:t,ws,modelWs:ws};});
    const liveRootsBefore=sourceSnapshot(members);
    let proc,attempt=null,attemptError='',packetDelivered=false,instructionsDelivered=false;console.log(`START ${job.key}`);
    if(job.arm==='atlias-batch'){
      const spec={model:plan.model,effort:plan.effort,jobs:members.map(m=>({id:m.task.id,root:m.ws,task:m.task.prompt,instructions:[RULES],...recipe(m.task)}))},input=path.join(base,'jobs.json');fs.writeFileSync(input,JSON.stringify(spec));
      const realHome=process.env.USERPROFILE||process.env.HOME,runnerEnv=childEnv(process.env,{home:realHome});runnerEnv.CODEX_HOME=process.env.CODEX_HOME||path.join(realHome,'.codex');
      proc=await runAsync(process.execPath,[runner,'--host','codex','--job',input,'--out',path.join(base,'attempt'),'--native',native,'--usage-cli',usageCli,'--subscription-auth',auth,'--run'],{cwd:ROOT,env:runnerEnv,replaceEnv:true,timeoutMs:12*60000,maxBuffer:32*1024*1024});
      if(fs.existsSync(path.join(base,'attempt/result.json')))try{attempt=JSON.parse(fs.readFileSync(path.join(base,'attempt/result.json')));for(const m of members){const stage=attempt.staged?.stages?.find(s=>s.id===m.task.id);if(stage)m.modelWs=stage.staged.stage;}}catch(e){attemptError=e.message;}
    }else{
      const skills=[path.join(process.env.USERPROFILE||process.env.HOME,'.agents/skills'),path.join(process.env.USERPROFILE||process.env.HOME,'.codex/skills')].flatMap(p=>fs.existsSync(p)?fs.readdirSync(p).filter(n=>fs.existsSync(path.join(p,n,'SKILL.md'))).map(n=>path.join(p,n)):[]);
      const overrides=skillConfigPaths(skills,'file-path-v1').map(f=>`{path=${JSON.stringify(f.replaceAll('\\','/'))},enabled=false}`).join(',');
      fs.writeFileSync(path.join(ch,'AGENTS.md'),RULES);fs.writeFileSync(path.join(ch,'config.toml'),`model_reasoning_effort="medium"\nservice_tier="default"\nskills.config=[${overrides}]\n[features]\nhooks=true\napps=false\n`);fs.writeFileSync(path.join(ch,'auth.json'),JSON.stringify(authDoc));
      try{proc=await runAsync(native,['--no-daemon','-a','never','exec','--skip-git-repo-check','--ignore-rules','--dangerously-bypass-hook-trust','--json','-s','danger-full-access','-c','features.apps=false','-m',plan.model,'-C',members[0].ws,members[0].task.prompt],{cwd:members[0].ws,env,replaceEnv:true,timeoutMs:10*60000,maxBuffer:32*1024*1024});}finally{fs.rmSync(path.join(ch,'auth.json'),{force:true});}
    }
    fs.writeFileSync(path.join(base,'runner.stdout'),proc.stdout||'');fs.writeFileSync(path.join(base,'runner.stderr'),proc.stderr||'');
    const sessionRoot=job.arm==='plain'?path.join(ch,'sessions'):path.join(base,'attempt/home/.codex/sessions'),rollouts=walk(sessionRoot).filter(f=>f.endsWith('.jsonl')),{events,errors:rolloutErrors}=parseRollouts(rollouts),usage=usageOf(events);
    const models=[...new Set(events.filter(e=>e.type==='turn_context').map(e=>e.payload.model).filter(Boolean))];
    const plainInputDelivered=job.arm==='plain'&&events.some(e=>e.type==='response_item'&&e.payload?.role==='user'&&(e.payload.content||[]).some(c=>c.text?.includes(members[0].task.prompt)));
    if(job.arm==='atlias-batch'&&fs.existsSync(path.join(base,'attempt/input-envelope.json'))){const input=fs.readFileSync(path.join(base,'attempt/input-envelope.json'),'utf8'),instructions=fs.readFileSync(path.join(base,'attempt/instructions.md'),'utf8');packetDelivered=events.some(e=>e.type==='response_item'&&e.payload?.role==='user'&&(e.payload.content||[]).some(c=>c.text?.includes(input)));instructionsDelivered=events.some(e=>e.type==='session_meta'&&e.payload?.base_instructions?.text===instructions);}
    const beforeChecks=sourceSnapshot(members);
    const grades=members.map(m=>{
      try{
      // Graders, protected cases and gold were absent during inference. Never
      // replace model-edited source with fixture source when restoring archive.
      if(job.arm==='atlias-batch')for(const [rel,text]of Object.entries(m.task.files))if(!recipe(m.task).readPaths.includes(rel)&&!fs.existsSync(path.join(m.modelWs,rel)))writeFiles(m.modelWs,{[rel]:text});
      const caseFile=path.join(base,m.task.id+'-protected-cases.json'),diag=path.join(base,m.task.id+'-adversarial.json');fs.writeFileSync(caseFile,JSON.stringify(cases[m.task.family]));
      const functional=spawnSync(process.execPath,['smoke.mjs'],{cwd:m.modelWs,env,encoding:'utf8',windowsHide:true,timeout:10000});
      const checkerRun=spawnSync(process.execPath,[checker,path.join(m.modelWs,'src/api.mjs'),caseFile,diag],{cwd:m.modelWs,env,encoding:'utf8',windowsHide:true,timeout:15000});
      const adversarial=fs.existsSync(diag)?JSON.parse(fs.readFileSync(diag)):null;
      const hiddenPresent=Object.keys(m.task.hidden||{}).some(rel=>fs.existsSync(path.join(m.modelWs,rel)));writeFiles(m.modelWs,m.task.hidden);const grade=score(m.modelWs,m.task),cheat=tamper(m.modelWs,m.task);
      return {task:m.task.id,taskSha256:m.task.taskSha256,family:m.task.family,solved:gradingResult({grade,cheat,functional:functional.status,adversarial,expectedCases:cases[m.task.family].length,checkerExit:checkerRun.status,exitCode:proc.status,timedOut:proc.timedOut,hiddenPresent}),originalGrade:grade.pass,functional:functional.status===0,adversarialCases:adversarial?.cases??null,adversarialPassed:adversarial?.passed??null,checkerExit:checkerRun.status,hiddenPresent,tampered:cheat.files,modelWs:m.modelWs};
      }catch(e){return {task:m.task.id,taskSha256:m.task.taskSha256,family:m.task.family,solved:false,gradingError:e.message,modelWs:m.modelWs};}
    });
    const checksPreservedSources=beforeChecks===sourceSnapshot(members);if(!checksPreservedSources)for(const g of grades)g.solved=false;
    const liveRootsUnchanged=job.arm==='plain'||liveRootsBefore===sourceSnapshot(members.map(m=>({...m,modelWs:m.ws})));if(!liveRootsUnchanged)for(const g of grades)g.solved=false;
    const authRemoved=job.arm==='plain'?!fs.existsSync(path.join(ch,'auth.json')):attempt?.authRemoved===true;
    const valid=!proc.error&&!attemptError&&liveRootsUnchanged&&!rolloutErrors.length&&models.length===1&&models[0]===plan.model&&[usage.promptRaw,usage.cachedInput,usage.output].every(Number.isFinite)&&authRemoved&&(job.arm==='plain'?plainInputDelivered:Boolean(attempt?.protocolValid&&packetDelivered&&instructionsDelivered));
    const row={...usage,...flowOf(events),key:job.key,sha,model:plan.model,effort:plan.effort,repeat:job.repeat,arm:job.arm,valid,exitCode:proc.status??null,timedOut:Boolean(proc.timedOut),members:grades,proof:{plainInputDelivered,packetDelivered,instructionsDelivered,authRemoved,checksPreservedSources,liveRootsUnchanged,batchSha256:attempt?.batchSha256??null},attemptError,rolloutErrors,base,at:new Date().toISOString()};
    validateBatchRows([...studyRows(rowsFile),row],plan);fs.appendFileSync(rowsFile,JSON.stringify(row)+'\n');fs.writeFileSync(path.join(out,'COSTS.json'),JSON.stringify(wholeBatchCosts(studyRows(rowsFile),plan),null,2)+'\n');console.log(`${valid?'RECORDED':'INVALID'} ${job.key}: solved=${grades.filter(m=>m.solved).length}/${grades.length}, raw=${row.promptRaw}`);
    if(!valid||proc.status!==0||proc.timedOut)throw Error('protocol/process failure retained; remaining configuration held, never retry');
  }
}
if(process.argv[1]===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
