// New protocol: native plain vs experimental Atlias bounded patch worker.
// No pooling with earlier studies, no retries, protected grades/cases both arms.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadTaskList, writeFiles } from '../ccstudy/run.mjs';
import { childEnv, readJsonl } from '../ccstudy/lib.mjs';
import { jobsOf, usageOf, flowOf, skillConfigPaths } from './run.mjs';
import { score, tamper } from '../../lib/eval.mjs';
import { behaviorCases } from './behavior-cases.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const USER_RULES = 'The user is Gev. Start replies with "Okay Gev". No emojis. Make only requested changes. Check functionality, then adversarial edge cases. Use node --check, never tsc.\n';
const filesUnder = dir => !fs.existsSync(dir) ? [] : fs.readdirSync(dir,{withFileTypes:true}).flatMap(e => e.isDirectory() ? filesUnder(path.join(dir,e.name)) : e.isFile() ? [path.join(dir,e.name)] : []);
const sync = (bin,args,options={}) => { const p=spawnSync(bin,args,{encoding:'utf8',windowsHide:true,timeout:45000,...options}); if(p.status!==0) throw Error(`${path.basename(bin)} failed; inspect retained output before retry`); return p.stdout.trim(); };
const opt = (args,name,def='') => { const i=args.indexOf(name); return i<0?def:args[i+1]; };
const runExactEnv = (bin,argv,{env,cwd,timeoutMs,maxBuffer}) => new Promise(resolve => {
  // Exact child environment: do not merge filtered keys back from the parent.
  const child=spawn(bin,argv,{env,cwd,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='',bytes=0,overflow=false,timedOut=false;
  child.stdout.on('data',d=>{stdout+=d;bytes+=d.length;if(bytes>maxBuffer){overflow=true;child.kill();}});
  child.stderr.on('data',d=>{stderr+=d;bytes+=d.length;if(bytes>maxBuffer){overflow=true;child.kill();}});
  const timer=setTimeout(()=>{timedOut=true;child.kill();},timeoutMs);
  child.on('error',e=>{clearTimeout(timer);resolve({status:null,stdout,stderr,error:e.code,timedOut,overflow});});
  child.on('close',status=>{clearTimeout(timer);resolve({status,stdout,stderr,timedOut,overflow});});
});
export function brokerRecipe(task) {
  const readPaths=Object.keys(task.files).filter(p => !p.startsWith('archive/'));
  const writePaths=readPaths.filter(p => p.startsWith('src/') && !(task.protect||[]).includes(p));
  if (!readPaths.includes('docs/contract.md') || !readPaths.includes('src/api.mjs') || !readPaths.includes('package.json') || !readPaths.includes('smoke.mjs') || !writePaths.length || readPaths.length>32) throw Error('corpus does not fit declared bounded-job recipe');
  if (readPaths.some(p => Object.hasOwn(task.hidden||{},p))) throw Error('hidden grading material cannot enter packet');
  return {readPaths,writePaths};
}
export async function main(args) {
  const out=path.resolve(opt(args,'--out')),ref=opt(args,'--ref'),native=opt(args,'--codex'),usageCli=opt(args,'--usage-cli','C:/Users/OWNER/Downloads/claude-code-usage-limits/skills/usage-limits/scripts/usage.js');
  if (!opt(args,'--out') || !ref || !native) throw Error('broker-run.mjs --out <new-study> --ref <pinned-source> --codex <native-exe> [--run]');
  const tasks=loadTaskList(path.join(ROOT,'evals/context-heldout/manifest.json'),ROOT).filter(t=>t.id.endsWith('-64'));
  if(tasks.length!==12) throw Error('keep full12family plan');
  const sha=sync('git',['-C',ROOT,'rev-parse',`${ref}^{commit}`]);
  const cases=behaviorCases(), plan={protocol:'bounded-patch-v1; authored diagnostics, not general feature parity',engine:'native Codex CLI',sha,model:'gpt-6.1-sol',effort:'medium',repeats:2,jobs:48,skillsIsolation:'file-path-v1',tasks:tasks.map(t=>({id:t.id,sha256:t.taskSha256,family:t.family,...brokerRecipe(t)})),caseSetSha256:hash(JSON.stringify(cases)),userInstructionsSha256:hash(USER_RULES),grading:'unchanged original protected grader AND same predeclared functional/adversarial cases in BOTH arms',sourceSelection:'complete non-archive visible files; historical archive omitted from bounded packet only; source/contract/prompts unchanged',transport:'plain native prompt vs Atlias full task string in hashed packet/custom bounded-worker instructions; whole transport intentionally differs',paidCredits:false,automaticRetries:false};
  fs.mkdirSync(out,{recursive:true});
  const planFile=path.join(out,'plan.json');
  if(fs.existsSync(planFile) && JSON.stringify(JSON.parse(fs.readFileSync(planFile)))!==JSON.stringify(plan)) throw Error('plan differs; never mutate existing study');
  if(!fs.existsSync(planFile)) fs.writeFileSync(planFile,JSON.stringify(plan,null,2));
  if(!args.includes('--run')) {console.log(JSON.stringify({status:'prepared-unmeasured',calls:0,sha,jobs:48,out}));return;}
  const prior=opt(args,'--prerequisite');
  if(!prior) throw Error('require completed source7d --prerequisite directory before a new model study');
  const priorPlan=JSON.parse(fs.readFileSync(path.join(prior,'plan.json'))),priorRows=readJsonl(path.join(prior,'rows.jsonl'));
  const expected=priorPlan.tasks.flatMap(t=>Array.from({length:priorPlan.repeats},(_,i)=>['plain','atlias'].map(arm=>`${t.id}|${i+1}|${arm}`))).flat();
  if(priorPlan.sha!=='7d4838aab53c69555e84fa30c4ee14866337a80f' || priorPlan.jobs!==48 || priorRows.length!==48 || new Set(priorRows.map(r=>`${r.task}|${r.repeat}|${r.arm}`)).size!==48 || expected.some(k=>!priorRows.some(r=>`${r.task}|${r.repeat}|${r.arm}`===k))) throw Error('source7d planned calls not closed; no new model call');
  const archive=path.join(out,'plugin'),stamp=path.join(out,'plugin-sha.txt');
  if(!fs.existsSync(archive)){fs.mkdirSync(archive);sync('git',['-C',ROOT,'archive','--format=tar','-o',path.join(out,'plugin.tar'),sha]);sync('tar',['-xf',path.join(out,'plugin.tar'),'-C',archive]);fs.writeFileSync(stamp,sha);}
  if(fs.readFileSync(stamp,'utf8')!==sha || !fs.existsSync(path.join(archive,'tools/native-job/run.mjs'))) throw Error('pinned broker archive unavailable');
  const runner=path.join(archive,'tools/native-job/run.mjs'),checker=path.join(archive,'tools/codexstudy/behavior-check.mjs');
  const auth=opt(args,'--auth-file',path.join(process.env.USERPROFILE||process.env.HOME,'.codex/auth.json'));
  const authDoc=JSON.parse(fs.readFileSync(auth)); if(authDoc.OPENAI_API_KEY||!authDoc.tokens?.access_token)throw Error('subscription OAuth required');
  const rowsFile=path.join(out,'rows.jsonl'),old=readJsonl(rowsFile),done=new Set();
  for(const row of old){if(row.sha!==sha || !plan.tasks.some(t=>t.id===row.task&&t.sha256===row.taskSha256))throw Error('saved row provenance differs');const k=`${row.task}|${row.repeat}|${row.arm}`;if(done.has(k))throw Error('duplicate row');done.add(k);}
  for(const job of jobsOf(tasks,2)) {
    const arm=job.arm==='plain'?'plain':'atlias',key=`${job.task.id}|${job.repeat}|${arm}`;if(done.has(key))continue;
    const meter=JSON.parse(sync(process.execPath,[usageCli,'--host','codex','--json']));if(!meter.windows?.length||meter.windows.some(w=>!Number.isFinite(w.percentUsed)))throw Error('fresh quota unavailable');if(meter.windows.some(w=>w.percentUsed>=90)){console.log('Stopped at declared allowance boundary.');break;}
    const base=path.join(out,'runs',job.task.id,`r${job.repeat}-${arm}`);if(fs.existsSync(base))throw Error('unfinished attempt exists; inspect, never silently retry');
    const ws=path.join(base,'ws'),home=path.join(base,'home'),ch=path.join(home,'.codex');fs.mkdirSync(ch,{recursive:true});fs.mkdirSync(ws);writeFiles(ws,job.task.files);
    const family=job.task.family,casesFile=path.join(base,'protected-cases.json');fs.writeFileSync(casesFile,JSON.stringify(cases[family]));
    const env=childEnv(process.env,{home});env.CODEX_HOME=ch;
    let proc,modelWs=ws,attempt=null;
    console.log(`START ${arm} ${job.task.id} r${job.repeat}`);
    if(arm==='atlias') {
      const spec={root:ws,task:job.task.prompt,instructions:[USER_RULES],...brokerRecipe(job.task),model:plan.model,effort:plan.effort,checks:{functional:[process.execPath,'smoke.mjs'],adversarial:[process.execPath,checker,'src/api.mjs',casesFile,path.join(base,'adversarial.json')]}};
      const input=path.join(base,'job.json');fs.writeFileSync(input,JSON.stringify(spec));
      // Its meter runs in the original account context; the runner then creates
      // a separate filtered native-child home before any inference.
      const realHome=process.env.USERPROFILE||process.env.HOME,runnerEnv=childEnv(process.env,{home:realHome});
      runnerEnv.CODEX_HOME=process.env.CODEX_HOME||path.join(realHome,'.codex');
      proc=await runExactEnv(process.execPath,[runner,'--host','codex','--job',input,'--out',path.join(base,'attempt'),'--native',native,'--usage-cli',usageCli,'--subscription-auth',auth,'--run'],{cwd:ROOT,env:runnerEnv,timeoutMs:12*60000,maxBuffer:1024*1024});
      fs.writeFileSync(path.join(base,'runner.stdout'),proc.stdout||'');fs.writeFileSync(path.join(base,'runner.stderr'),proc.stderr||'');
      if(fs.existsSync(path.join(base,'attempt/result.json'))){attempt=JSON.parse(fs.readFileSync(path.join(base,'attempt/result.json')));if(attempt.staged)modelWs=attempt.staged.stage;}
    } else {
      const skills=[path.join(process.env.USERPROFILE||process.env.HOME,'.agents/skills'),path.join(process.env.USERPROFILE||process.env.HOME,'.codex/skills')].flatMap(p=>fs.existsSync(p)?fs.readdirSync(p).filter(n=>fs.existsSync(path.join(p,n,'SKILL.md'))).map(n=>path.join(p,n)):[]);
      const overrides=skillConfigPaths(skills,'file-path-v1').map(f=>`{path=${JSON.stringify(f.replaceAll('\\','/'))},enabled=false}`).join(',');
      fs.writeFileSync(path.join(ch,'AGENTS.md'),USER_RULES);fs.writeFileSync(path.join(ch,'config.toml'),`model_reasoning_effort="medium"\nservice_tier="default"\nskills.config=[${overrides}]\n[features]\nhooks=true\napps=false\n`);
      fs.writeFileSync(path.join(ch,'auth.json'),JSON.stringify(authDoc));
      try{proc=await runExactEnv(native,['--no-daemon','-a','never','exec','--skip-git-repo-check','--ignore-rules','--dangerously-bypass-hook-trust','--json','-s','danger-full-access','-c','features.apps=false','-m',plan.model,'-C',ws,job.task.prompt],{cwd:ws,env,timeoutMs:10*60000,maxBuffer:32*1024*1024});}finally{fs.rmSync(path.join(ch,'auth.json'),{force:true});}
      fs.writeFileSync(path.join(base,'stream.jsonl'),proc.stdout||'');fs.writeFileSync(path.join(base,'stderr.txt'),proc.stderr||'');
    }
    const events=filesUnder(arm==='plain'?path.join(ch,'sessions'):path.join(base,'attempt/home/.codex/sessions')).filter(f=>f.endsWith('.jsonl')).flatMap(readJsonl),usage=usageOf(events);
    const actualModels=[...new Set(events.filter(e=>e.type==='turn_context').map(e=>e.payload.model))];
    let packetDelivered=false,instructionsDelivered=false;
    if(arm==='atlias'&&fs.existsSync(path.join(base,'attempt/packet.json'))){const packet=fs.readFileSync(path.join(base,'attempt/packet.json'),'utf8');packetDelivered=events.some(e=>e.type==='response_item'&&['user','developer'].includes(e.payload?.role)&&(e.payload.content||[]).some(c=>c.text?.includes(packet)));const instruction=fs.readFileSync(path.join(base,'attempt/instructions.md'),'utf8');instructionsDelivered=events.some(e=>e.type==='session_meta'&&e.payload?.base_instructions?.text===instruction);}
    // Restore only omitted historical fixture files after the model ends, never
    // overwrite model source. Protected grading is written only at this point.
    if(arm==='atlias')for(const [file,text]of Object.entries(job.task.files))if(!brokerRecipe(job.task).readPaths.includes(file)&&!fs.existsSync(path.join(modelWs,file)))writeFiles(modelWs,{[file]:text});
    const f=spawnSync(process.execPath,['smoke.mjs'],{cwd:modelWs,env,encoding:'utf8',windowsHide:true,timeout:10000});
    let adversarial;
    const diag=path.join(base,'adversarial.json');
    if(fs.existsSync(diag))adversarial=JSON.parse(fs.readFileSync(diag));else{spawnSync(process.execPath,[checker,path.join(modelWs,'src/api.mjs'),casesFile,diag],{cwd:modelWs,env,encoding:'utf8',windowsHide:true,timeout:15000});if(fs.existsSync(diag))adversarial=JSON.parse(fs.readFileSync(diag));}
    writeFiles(modelWs,job.task.hidden);const grade=score(modelWs,job.task),cheat=tamper(modelWs,job.task);
    const valid=!proc.overflow&&actualModels.length===1&&actualModels[0]===plan.model&&Number.isFinite(usage.promptRaw)&&(arm==='plain'||Boolean(attempt?.protocolValid&&packetDelivered&&instructionsDelivered));
    const row={...usage,...flowOf(events),sha,task:job.task.id,family,taskSha256:job.task.taskSha256,repeat:job.repeat,arm,model:plan.model,effort:plan.effort,valid,solved:grade.pass&&!cheat.files.length&&f.status===0&&adversarial?.passed===adversarial?.cases&&adversarial?.cases>0&&proc.status===0&&!proc.timedOut,originalGrade:grade.pass,functional:f.status===0,adversarialPassed:adversarial?.passed??null,adversarialCases:adversarial?.cases??null,tampered:cheat.files,exitCode:proc.status,timedOut:Boolean(proc.timedOut),proof:{packetDelivered,instructionsDelivered,packetSha256:attempt?.packetSha256??null,authRemoved:arm==='plain'?!fs.existsSync(path.join(ch,'auth.json')):attempt?.authRemoved===true},base,at:new Date().toISOString()};
    fs.appendFileSync(rowsFile,JSON.stringify(row)+'\n');console.log(`${row.solved?'PASS':'FAIL'} ${arm} ${row.task}: raw=${row.promptRaw}, peak=${row.contextPeak}, valid=${row.valid}`);
    if(!valid||proc.status!==0||proc.timedOut)throw Error('protocol/process failure retained; inspect before resuming only unattempted rows');
  }
}
if(process.argv[1]===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
