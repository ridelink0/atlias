// Owned scripted provider. No real model, subscription auth or user settings.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
import {childEnv,readJsonl} from '../ccstudy/lib.mjs';
import {nativeSessionReport} from '../../lib/session-report.mjs';
import {summaryFixtureRequest} from '../native-job/context-policy.mjs';
import {runPhases,phaseArgs,sha256} from './phase-protocol.mjs';
const [out,bin]=process.argv.slice(2);
if (!out || !bin || !path.isAbsolute(out) || fs.existsSync(out)) throw Error('unused absolute output and copied native executable required');
fs.mkdirSync(out,{recursive:true});
const ws=path.join(out,'workspace');fs.mkdirSync(ws);
const phases=[{id:'establish',prompt:'Gev owned fixture: retain this exact requirement through later phases: count=0 is KNOWN; region=null is UNKNOWN; do not invent a region.'},
  {id:'verify',prompt:'Gev second phase: run one shell check, then state the original count and region requirements without inventing a value.'},
  {id:'finish',prompt:'Gev final phase: retain earlier requirements and report the actual shell check outcome.'}];
const fullReply='Okay Gev, count=0 is KNOWN; region=null is UNKNOWN; no region value was invented.';
let active;
const server=http.createServer(async(req,res)=>{
  let raw='';for await(const b of req)raw+=b;const body=JSON.parse(raw);
  const compact=summaryFixtureRequest('codex',body),tool=!compact&&active.phase==='verify'&&!active.toolSent;
  if(tool)active.toolSent=true;
  const request={body,url:req.url,phase:active.phase,compact,tool,input:active.requests.length===0?30000:1000};active.requests.push(request);
  fs.writeFileSync(path.join(active.folder,'requests.json'),JSON.stringify(active.requests,null,2));
  const n=active.requests.length,item=tool?{id:'fc_gev_'+n,type:'function_call',name:'exec_command',call_id:'call_gev_'+n,arguments:JSON.stringify({cmd:"Write-Output 'Gev phase check passed; count=0; region=UNKNOWN'",max_output_tokens:80})}
    :{id:'msg_gev_'+n,type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:compact?phases[0].prompt:fullReply,annotations:[]}]};
  const response={id:'resp_gev_'+n,object:'response',model:body.model,status:'completed',output:[item],usage:{input_tokens:request.input,output_tokens:10,total_tokens:request.input+10,input_tokens_details:{cached_tokens:0}}};
  res.writeHead(200,{'Content-Type':'text/event-stream'});const send=(type,v)=>res.write(`event: ${type}\ndata: ${JSON.stringify({type,...v})}\n\n`);
  send('response.created',{response:{...response,status:'in_progress',output:[]}});send('response.output_item.added',{output_index:0,item});send('response.output_item.done',{output_index:0,item});send('response.completed',{response});res.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port,results=[];let surface;
try {
  for(const [name,policy] of [['control',null],['early',{limitTokens:20000,scope:'total'}]]) {
    const folder=path.join(out,name),home=path.join(folder,'home'),codexHome=path.join(home,'.codex');fs.mkdirSync(codexHome,{recursive:true});
    const env=childEnv(process.env,{home});env.CODEX_HOME=codexHome;
    fs.copyFileSync(path.join(process.env.USERPROFILE||process.env.HOME,'.codex/models_cache.json'),path.join(codexHome,'models_cache.json'));
    fs.writeFileSync(path.join(codexHome,'config.toml'),`model = "gpt-6.1-sol"\nmodel_reasoning_effort = "medium"\nmodel_provider = "fixture"\n[features]\napps = false\n[model_providers.fixture]\nname = "Gev owned phase fixture"\nbase_url = "http://127.0.0.1:${port}/v1"\nwire_api = "responses"\nrequires_openai_auth = false\nrequest_max_retries = 0\nstream_max_retries = 0\n`);
    active={folder,requests:[],phase:'',toolSent:false};
    const plan={nativeSha256:sha256(fs.readFileSync(bin)),driverSha256:sha256(fs.readFileSync(new URL(import.meta.url))),policy,syntheticUsage:true,modelCalls:0};
    const state=await runPhases({folder:path.join(folder,'workflow'),phases,plan,allowance:async()=>true,launch:async({phase,dir,sessionId})=>{
      active.phase=phase.id;const args=phaseArgs({sessionId,prompt:phase.prompt,model:'gpt-6.1-sol',workspace:ws,policy});fs.writeFileSync(path.join(dir,'argv.json'),JSON.stringify(args,null,2));
      const child=spawn(bin,args,{env,cwd:ws,windowsHide:true,stdio:['ignore','pipe','pipe']});
      child.stdout.on('data',b=>fs.appendFileSync(path.join(dir,'stdout.jsonl'),b));child.stderr.on('data',b=>fs.appendFileSync(path.join(dir,'stderr.txt'),b));
      const status=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(code,signal)=>resolve({code,signal}));});
      fs.writeFileSync(path.join(dir,'TERMINAL.json'),JSON.stringify(status));
      const frames=readJsonl(path.join(dir,'stdout.jsonl')),tid=frames.find(e=>e.type==='thread.started')?.thread_id;
      const walk=d=>fs.existsSync(d)?fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]):[];
      const rollouts=walk(path.join(codexHome,'sessions')).filter(f=>f.endsWith('.jsonl'));assert.equal(rollouts.length,1);
      const snapshot=path.join(dir,'full-native-session.jsonl');fs.copyFileSync(rollouts[0],snapshot);
      const report=await nativeSessionReport(snapshot);fs.writeFileSync(path.join(dir,'ACCOUNTING.json'),JSON.stringify(report,null,2));
      assert.equal(report.sessionId,tid);assert.equal(report.completedTurns,phases.findIndex(p=>p.id===phase.id)+1);assert.equal(report.unclosedTurns,0);
      const delivered=readJsonl(snapshot).some(e=>e.type==='response_item'&&e.payload?.role==='user'&&JSON.stringify(e.payload.content).includes(phase.prompt));assert(delivered,'full phase prompt delivered');
      const expected=active.requests.reduce((sum,r)=>sum+r.input,0);assert.equal(report.reportedLifetimeTokens.input_tokens,expected,'all synthetic requests including summaries accounted once');
      assert.equal(report.reportedLifetimeTokens.output_tokens,active.requests.length*10);
      assert(frames.some(e=>e.type==='item.completed'&&JSON.stringify(e).includes(fullReply)),'scripted final answer parsed');
      return {sessionId:tid,exitCode:status.code,timedOut:false,valid:status.code===0&&delivered,cumulative:report.reportedLifetimeTokens,peak:report.nativePeakRecordedInputTokens,snapshotSha256:sha256(fs.readFileSync(snapshot)),modelCalls:0,syntheticUsage:true};
    }});
    assert.equal(state.completed.length,3);assert.equal(state.held,false);
    const normal=active.requests.filter(r=>!r.compact);const first={tools:normal[0].body.tools,instructions:normal[0].body.instructions};
    if(!surface)surface=first;else assert.deepEqual(first,surface,'control and early native tools/foundation retained');
    for(const r of normal)assert.deepEqual({tools:r.body.tools,instructions:r.body.instructions},surface,'native resume/postcompact surface retained');
    assert.equal(active.requests.filter(r=>r.compact).length,name==='early'?1:0);
    const last=JSON.parse(fs.readFileSync(path.join(folder,'workflow/phases/finish/ACCOUNTING.json')));
    assert.equal(last.completedTurns,3);assert.equal(state.cumulative.input_tokens,last.reportedLifetimeTokens.input_tokens);
    const result={name,policy,phases:3,requests:active.requests.length,compactions:active.requests.filter(r=>r.compact).length,cumulative:state.cumulative,fullNativePeak:state.fullNativePeak,checksPassed:true,modelCalls:0,syntheticUsage:true,nativeSha256:plan.nativeSha256};
    fs.writeFileSync(path.join(folder,'RESULT.json'),JSON.stringify(result,null,2));results.push(result);console.log(JSON.stringify(result));
  }
} finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
fs.writeFileSync(path.join(out,'RESULT.json'),JSON.stringify({results,modelCalls:0,syntheticUsage:true,limitations:['Scripted answers and counters do not establish model quality, real token/context/account savings or genuine OAuth.','Native custom-provider metadata differs from genuine subscription metadata; this only checks the owned tested surface.','Requirements in scripted summaries are protocol fixtures, not evidence that a real model preserves them.']},null,2));
