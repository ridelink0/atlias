// New phase-preserving study. Every native invocation is an attempt; no retries.
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import {randomUUID} from 'node:crypto';
import {workflowCorpus,solverWorkflow} from './workflow-corpus.mjs';
import {runPhases,phaseArgs,sha256} from './phase-protocol.mjs';
import {assertFreshAllowance,contained,skillConfigPaths,profileEnv,inputReceived} from './run.mjs';
import {childEnv,readJsonl} from '../ccstudy/lib.mjs';import {runAsync} from '../../lib/proc.mjs';import {nativeSessionReport} from '../../lib/session-report.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const opt=(a,k,d='')=>a.includes(k)?a[a.indexOf(k)+1]:d;
export function validateWorkflowOptions(a) {
  const modes=['--run','--prepare'],values=['--out','--ref','--repeat','--compact-limit','--compact-scope','--stop-percent','--timeout-min','--codex','--ci-file','--auth-file','--usage-script'],seen=new Set();
  for(let i=0;i<a.length;i++) {const key=a[i];if(seen.has(key)||!modes.includes(key)&&!values.includes(key))throw Error('duplicate or unknown workflow option');seen.add(key);if(values.includes(key)){const value=a[++i];if(typeof value!=='string'||!value||value.startsWith('--'))throw Error('workflow option requires its exact value');}}
  if(seen.has('--run')&&seen.has('--prepare'))throw Error('choose preparation or inference explicitly, never both');
  return true;
}
const nativeFiles=['codex.exe','codex-code-mode-host.exe','codex-command-runner.exe','codex-windows-sandbox-setup.exe'];
const archivePaths=['.claude-plugin','.codex-plugin','.mcp.json','bin','hooks','lib','mcp','skills','assets','package.json','README.md','LICENSE','docs','evals','test','tools/native-job','tools/source-evidence','tools/omniscience'];
const walk=d=>fs.existsSync(d)?fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]):[];
const pipeline=['tools/codexstudy/workflow-run.mjs','tools/codexstudy/workflow-corpus.mjs','tools/codexstudy/workflow-grade.mjs','tools/codexstudy/phase-protocol.mjs','tools/codexstudy/run.mjs','tools/ccstudy/lib.mjs','tools/native-job/context-policy.mjs',...walk(path.join(ROOT,'lib')).filter(f=>f.endsWith('.mjs')).map(f=>path.relative(ROOT,f).replaceAll('\\','/'))];
function sync(bin,args,opts={}) {const p=spawnSync(bin,args,{encoding:'utf8',windowsHide:true,timeout:120000,...opts});if(p.status!==0)throw Error(String(p.stderr||p.stdout||p.error).slice(-1000));return p.stdout.trim();}
function write(ws,files) {for(const [rel,text] of Object.entries(files)){const p=contained(ws,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text);}}
function pin(file,body){const bytes=JSON.stringify(body,null,2)+'\n';if(fs.existsSync(file)){if(fs.readFileSync(file,'utf8')!==bytes)throw Error('immutable declaration differs; choose a new study');}else fs.writeFileSync(file,bytes,{flag:'wx'});}
function hashes(root){return Object.fromEntries(walk(root).map(f=>{if(fs.lstatSync(f).isSymbolicLink())throw Error('symlink in owned immutable source');return [path.relative(root,f),sha256(fs.readFileSync(f))];}));}
function noLinks(root){return fs.readdirSync(root,{withFileTypes:true}).every(e=>!e.isSymbolicLink()&&(!e.isDirectory()||noLinks(path.join(root,e.name))));}
export async function main(a) {
  validateWorkflowOptions(a);
  const out=path.resolve(opt(a,'--out')),source=sync('git',['-C',ROOT,'rev-parse',opt(a,'--ref','HEAD')+'^{commit}']);
  if(!a.includes('--out')||source!==sync('git',['-C',ROOT,'rev-parse','HEAD']))throw Error('explicit unused study root and current exact source required');
  sync('git',['-C',ROOT,'diff','--exit-code',source,'--',...pipeline]);
  const repeats=Number(opt(a,'--repeat','2')),limit=Number(opt(a,'--compact-limit','24000')),stop=Number(opt(a,'--stop-percent','100')),timeout=Number(opt(a,'--timeout-min','12'));
  if(!Number.isSafeInteger(repeats)||repeats<1||repeats>3||!Number.isFinite(stop)||stop<=0||stop>100||!Number.isFinite(timeout)||timeout<=0)throw Error('invalid declared repeat/quota/timeout');
  const policy={limitTokens:limit,scope:opt(a,'--compact-scope','total')};phaseArgs({prompt:'preflight',workspace:out,model:'gpt-6.1-sol',policy});
  const bin=path.resolve(opt(a,'--codex'));if(!a.includes('--codex')||path.dirname(bin)!==path.join(out,'native'))throw Error('copy pinned executable and all companions into study/native first');
  const native=Object.fromEntries(nativeFiles.map(name=>[name,sha256(fs.readFileSync(path.join(out,'native',name)))]));
  const tasks=workflowCorpus(),publicTasks=tasks.map(solverWorkflow),plan={protocol:'atlias-native-workflows-v1',source,driver:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
    pipeline:Object.fromEntries(pipeline.map(f=>[f,sha256(fs.readFileSync(path.join(ROOT,f)))])),native,nativeVersion:sync(bin,['--version']),model:'gpt-6.1-sol',effort:'medium',
    repeats,workflowPairs:tasks.length*repeats,nativeAttempts:tasks.length*repeats*2*3,policy,stopPercent:stop,timeoutMin:timeout,flags:{lean:true,taskContext:false,apps:false},
    tasks:publicTasks,archivePaths,gradeHash:sha256(fs.readFileSync(path.join(ROOT,'tools/codexstudy/workflow-corpus.mjs'))),order:'alternate whole-workflow arm order by task and repeat',cost:'one final lifetime total per session; maximum full native request input, never peak divided by phases',limitations:['Authored finite workflows are not public benchmarks or universal parity.','Recorded native request input is not full-wire schema/account debit proof.','Protected grading and observed access audits are not a hostile-filesystem sandbox.']};
  fs.mkdirSync(out,{recursive:true});pin(path.join(out,'DECLARATION.json'),plan);
  if(!a.includes('--run')&&!a.includes('--prepare')){console.log(JSON.stringify({nativeAttempts:plan.nativeAttempts,workflowPairs:plan.workflowPairs,source,modelCalls:0}));return;}
  const auth=path.resolve(opt(a,'--auth-file',path.join(process.env.USERPROFILE||process.env.HOME,'.codex/auth.json')));
  if(a.includes('--run')) {
    const ci=JSON.parse(fs.readFileSync(opt(a,'--ci-file'),'utf8'));
    if(ci.headSha!==source||ci.status!=='completed'||ci.conclusion!=='success'||ci.jobs.length!==9||ci.jobs.some(j=>j.conclusion!=='success'))throw Error('own exact-source nine-job CI required before inference');
    const doc=JSON.parse(fs.readFileSync(auth,'utf8'));if(doc.OPENAI_API_KEY||!doc.tokens)throw Error('genuine subscription auth required; paid keys refused');
  }
  const lock=path.join(out,'DRIVER.lock'),fd=fs.openSync(lock,'wx');
  try {
    fs.writeSync(fd,JSON.stringify({pid:process.pid,at:new Date().toISOString()}));fs.fsyncSync(fd);
    const archive=path.join(out,'plugin');if(!fs.existsSync(archive)){fs.mkdirSync(archive);sync('git',['-C',ROOT,'archive','--format=tar','-o',path.join(out,'plugin.tar'),source,...archivePaths]);sync('tar',['-xf',path.join(out,'plugin.tar'),'-C',archive]);pin(path.join(out,'SOURCE.json'),{source,files:hashes(archive)});}
    else {if(JSON.parse(fs.readFileSync(path.join(out,'SOURCE.json'),'utf8')).source!==source)throw Error('archive source changed');}
    const sourceFiles=JSON.parse(fs.readFileSync(path.join(out,'SOURCE.json'),'utf8')).files;
    const intact=()=>JSON.stringify(hashes(archive))===JSON.stringify(sourceFiles)&&pipeline.every(f=>sha256(fs.readFileSync(path.join(ROOT,f)))===plan.pipeline[f])&&nativeFiles.every(f=>sha256(fs.readFileSync(path.join(out,'native',f)))===native[f]);
    if(!intact())throw Error('runtime, archive or protected pipeline changed before inference');
    const globals=[path.join(process.env.USERPROFILE||process.env.HOME,'.agents/skills'),path.join(process.env.USERPROFILE||process.env.HOME,'.codex/skills')].flatMap(d=>fs.existsSync(d)?fs.readdirSync(d).filter(n=>fs.existsSync(path.join(d,n,'SKILL.md'))).map(n=>path.join(d,n)):[]);
    for(let repeat=1;repeat<=repeats;repeat++)for(let ti=0;ti<tasks.length;ti++)for(const arm of (ti+repeat)%2?['plain','atlias']:['atlias','plain']) {
      const task=tasks[ti],base=path.join(out,'runs',task.id,`r${repeat}-${arm}`),home=path.join(base,'home'),ch=path.join(home,'.codex'),ws=path.join(base,'ws');
      const env=childEnv(process.env,{home});env.CODEX_HOME=ch;env.ATLIAS_HOME=path.join(home,'.atlias');if(arm==='atlias')Object.assign(env,profileEnv(true,false));
      if(!fs.existsSync(base)) {
        fs.mkdirSync(ch,{recursive:true});fs.mkdirSync(ws,{recursive:true});write(ws,task.initialFiles);
        const isolated=skillConfigPaths(globals,'file-path-v1').map(p=>`{path=${JSON.stringify(p.replaceAll('\\','/'))},enabled=false}`).join(',');
        fs.writeFileSync(path.join(ch,'config.toml'),`model_reasoning_effort="medium"\nservice_tier="default"\nskills.config=[${isolated}]\n[features]\nhooks=true\napps=false\n`);
        fs.writeFileSync(path.join(ch,'AGENTS.md'),'The user is Gev. Start replies with "Okay Gev". No emojis. Make only requested changes. Check functionality, then adversarial edge cases. Use node --check, never tsc.\n');
        if(arm==='atlias'){sync(process.execPath,[path.join(archive,'bin/atlias.mjs'),'install','--codex'],{env,cwd:ws});fs.cpSync(path.join(archive,'skills'),path.join(ch,'skills'),{recursive:true});}
        pin(path.join(base,'PREPARED.json'),{source,task:task.id,arm,initial:sha256(JSON.stringify(task.initialFiles))});
      } else {if(!fs.existsSync(path.join(base,'PREPARED.json')))throw Error('partial preparation held; never recreate over it');pin(path.join(base,'PREPARED.json'),{source,task:task.id,arm,initial:sha256(JSON.stringify(task.initialFiles))});}
      if(!a.includes('--run'))continue;
      const state=await runPhases({folder:path.join(base,'workflow'),phases:task.phases.map(({id,prompt})=>({id,prompt})),plan:{declaration:sha256(fs.readFileSync(path.join(out,'DECLARATION.json'))),task:task.id,repeat,arm},
        allowance:async()=>{if(!intact())throw Error('pinned pipeline, source or native bytes changed; no new phase');const meter=JSON.parse(sync(process.execPath,[opt(a,'--usage-script','C:/Users/OWNER/Downloads/claude-code-usage-limits/skills/usage-limits/scripts/usage.js'),'--host','codex','--refresh','--json']));assertFreshAllowance(meter);fs.appendFileSync(path.join(base,'quota.jsonl'),JSON.stringify(meter)+'\n');return meter.windows.every(w=>w.percentUsed<stop);},
        launch:async({phase,dir,sessionId})=>{
          const index=task.phases.findIndex(p=>p.id===phase.id);write(ws,task.phases[index].changes);
          const hookBefore=walk(path.join(home,'.atlias/sessions')).filter(f=>f.endsWith('.jsonl')).flatMap(readJsonl).length;
          const args=phaseArgs({sessionId,prompt:phase.prompt,model:plan.model,workspace:ws,policy:arm==='atlias'?policy:null});fs.writeFileSync(path.join(dir,'native-argv.json'),JSON.stringify(args,null,2));
          console.log(`START ${task.id} r${repeat} ${arm} ${phase.id}`);let proc;const started=Date.now();
          try {fs.copyFileSync(auth,path.join(ch,'auth.json'));proc=await runAsync(bin,args,{env,replaceEnv:true,cwd:ws,timeoutMs:timeout*60000,maxBuffer:64*1024*1024});}
          finally {fs.rmSync(path.join(ch,'auth.json'),{force:true});}
          fs.writeFileSync(path.join(dir,'stream.jsonl'),proc.stdout||'');fs.writeFileSync(path.join(dir,'stderr.txt'),proc.stderr||'');fs.writeFileSync(path.join(dir,'TERMINAL.json'),JSON.stringify({code:proc.status,timedOut:proc.timedOut,ms:Date.now()-started}));
          const sessions=walk(path.join(ch,'sessions')).filter(f=>f.endsWith('.jsonl'));if(sessions.length!==1)throw Error('one exact native workflow session required; preserve attempt');
          const snapshot=path.join(dir,'full-native-session.jsonl');fs.copyFileSync(sessions[0],snapshot);const events=readJsonl(snapshot),report=await nativeSessionReport(snapshot);
          fs.writeFileSync(path.join(dir,'ACCOUNTING.json'),JSON.stringify(report,null,2));
          const models=[...new Set(events.filter(e=>e.type==='turn_context').map(e=>e.payload.model).filter(Boolean))],inputDelivered=inputReceived(events,phase.prompt),config=fs.readFileSync(path.join(ch,'config.toml'),'utf8');
          const proof={inputDelivered,hooks:fs.existsSync(path.join(ch,'hooks.json')),mcp:config.includes('[mcp_servers.atlias]'),hookEvents:walk(path.join(home,'.atlias/sessions')).filter(f=>f.endsWith('.jsonl')).flatMap(readJsonl).length-hookBefore,models,sessionId:report.sessionId,authRemoved:!fs.existsSync(path.join(ch,'auth.json')),pinnedIntact:intact(),noSymlinks:noLinks(ws)};
          let valid=inputDelivered&&models.length===1&&models[0]===plan.model&&proof.authRemoved&&proof.pinnedIntact&&proof.noSymlinks&&report.completedTurns===index+1&&report.unclosedTurns===0&&(arm==='plain'?!proof.hooks&&!proof.mcp:proof.hooks&&proof.mcp&&proof.hookEvents>0);
          const captured=path.join(dir,'workspace');if(proof.noSymlinks)fs.cpSync(ws,captured,{recursive:true});
          const workspaceFiles=proof.noSymlinks?hashes(captured):null;if(workspaceFiles)fs.writeFileSync(path.join(dir,'WORKSPACE.json'),JSON.stringify(workspaceFiles,null,2));
          const nonce=randomUUID(),grade=proof.noSymlinks&&proof.pinnedIntact?spawnSync(process.execPath,[path.join(ROOT,'tools/codexstudy/workflow-grade.mjs'),task.id,String(index),captured,nonce],{env:childEnv(process.env,{home:path.join(base,'grade-home')}),cwd:captured,encoding:'utf8',timeout:20000,windowsHide:true}):{status:null,stdout:'',stderr:'Protected source or workspace unsafe; grade withheld.'};
          fs.writeFileSync(path.join(dir,'grade.stdout.txt'),grade.stdout||'');fs.writeFileSync(path.join(dir,'grade.stderr.txt'),grade.stderr||'');
          const verdict=(grade.stdout||'').trim().split('\n').map(line=>{try{return JSON.parse(line);}catch{return null;}}).find(v=>v?.nonce===nonce);
          proof.workspaceRetained=workspaceFiles!==null&&JSON.stringify(hashes(captured))===JSON.stringify(workspaceFiles);if(!proof.workspaceRetained)valid=false;
          const result={sessionId:report.sessionId,exitCode:proc.status,timedOut:proc.timedOut,valid,cumulative:report.reportedLifetimeTokens,peak:report.nativePeakRecordedInputTokens,proof,grade:{pass:grade.status===0&&verdict?.pass===true,status:grade.status,error:verdict?.error??null,nonce,stdoutSha256:sha256(grade.stdout||'')},ms:Date.now()-started,snapshotSha256:sha256(fs.readFileSync(snapshot)),compactions:events.filter(e=>e.type==='compacted').length};
          fs.writeFileSync(path.join(dir,'RESULT.json'),JSON.stringify(result,null,2));console.log(`END ${task.id} ${arm} ${phase.id} valid=${valid} grade=${result.grade.pass}`);return result;
        }});
      pin(path.join(base,state.boundary?'BOUNDARY-'+state.completed.length+'.json':'RESULT.json'),{completed:state.completed.length,held:state.held,cumulative:state.cumulative,fullNativePeak:state.fullNativePeak,allPhaseGrades:state.completed.every(r=>r.grade?.pass===true),boundary:state.boundary});
      if(state.boundary||state.held){console.log('Clean allowance boundary or held attempt; all prior phases retained.');return;}
    }
    if(a.includes('--run'))pin(path.join(out,'CLOSED.json'),{source,nativeAttempts:plan.nativeAttempts,workflowPairs:plan.workflowPairs});
    else console.log(JSON.stringify({prepared:tasks.length*repeats*2,modelCalls:0,source}));
  } finally {fs.closeSync(fd);fs.rmSync(lock);}
}
if(process.argv[1]===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
