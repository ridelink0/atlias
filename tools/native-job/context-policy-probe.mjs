// Owned localhost protocol fixture: SCRIPTED replies and SYNTHETIC usage only.
// No real model, OAuth, paid key, user setting mutation or savings measurement.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {childEnv} from '../ccstudy/lib.mjs';
import {contextOverrides,summaryFixtureRequest} from './context-policy.mjs';

const [out,codex,claude] = process.argv.slice(2);
if (!out || !codex || fs.existsSync(out)) throw Error('unused output directory and pinned Codex executable required');
for (const exe of [codex,claude].filter(Boolean)) assert(fs.statSync(exe).isFile());
fs.mkdirSync(out,{recursive:true});
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const prompt = 'Gev local protocol fixture: run one shell check. Preserve this requirement after compaction: an unsupported claim remains UNKNOWN. Then report completion.';
const reply = 'Okay Gev, local context fixture complete; unsupported claim remains UNKNOWN.';
const all = [], results = [];
let active;
const server = http.createServer(async (req,res) => {
  let raw='';for await (const part of req) raw+=part;
  let body;try {body=JSON.parse(raw);} catch {res.writeHead(400);res.end();return;}
  const request={url:req.url,body};active.requests.push(request);all.push(request);
  fs.writeFileSync(path.join(active.folder,'requests.json'),JSON.stringify(active.requests,null,2));
  if (req.url.endsWith('/compact')) {res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'Owned fixture cannot synthesize encrypted remote compaction',type:'fixture_error'}}));return;}
  const first=active.requests.length===1;
  // The ordinary task itself mentions compaction, and stock instructions may
  // describe it. Require the native no-tools summary surface as well.
  const compact=summaryFixtureRequest(active.host,body);
  active.events.push({request:active.requests.length,first,compact});
  res.writeHead(200,{'Content-Type':'text/event-stream'});
  const send=(type,v)=>res.write(`event: ${type}\ndata: ${JSON.stringify({type,...v})}\n\n`);
  if (active.host==='claude') {
    const tools=body.tools || [];
    const name=tools.some(t=>t.name==='PowerShell')?'PowerShell':'Bash';
    const input={command:name==='PowerShell'?"Write-Output 'Gev context fixture'":"echo 'Gev context fixture'",description:'Owned local context fixture'};
    const block=first?{type:'tool_use',id:'tool_gev_context',name,input}:{type:'text',text:compact?prompt:reply};
    const msg={id:'msg_gev_context_'+active.requests.length,type:'message',role:'assistant',model:body.model,content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:compact?1000:30000,output_tokens:10,cache_creation_input_tokens:0,cache_read_input_tokens:0}};
    send('message_start',{message:msg});
    send('content_block_start',{index:0,content_block:first?{...block,input:{}}:{type:'text',text:''}});
    send('content_block_delta',{index:0,delta:first?{type:'input_json_delta',partial_json:JSON.stringify(input)}:{type:'text_delta',text:block.text}});
    send('content_block_stop',{index:0});
    send('message_delta',{delta:{stop_reason:first?'tool_use':'end_turn',stop_sequence:null},usage:{output_tokens:10}});send('message_stop',{});res.end();return;
  }
  const item=first?{id:'fc_gev_context',type:'function_call',name:'exec_command',call_id:'call_gev_context',arguments:JSON.stringify({cmd:"Write-Output 'Gev context fixture'",max_output_tokens:50})}:{id:'msg_gev_context_'+active.requests.length,type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:compact?prompt:reply,annotations:[]}]};
  const response={id:'resp_gev_context_'+active.requests.length,object:'response',model:body.model,status:'completed',output:[item],usage:{input_tokens:first?30000:1000,output_tokens:10,total_tokens:first?30010:1010,input_tokens_details:{cached_tokens:0}}};
  send('response.created',{response:{...response,status:'in_progress',output:[]}});send('response.output_item.added',{output_index:0,item});send('response.output_item.done',{output_index:0,item});send('response.completed',{response});res.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
try {
  if (process.argv.includes('--claude-only') && !claude) throw Error('pinned Claude executable required');
  for (const host of (process.argv.includes('--claude-only')?['claude']:claude?['codex','claude']:['codex'])) {
    let stock;
    // The command writes nothing. Keep its owned workspace identical so native
    // CWD instruction differences cannot masquerade as a capability change.
    const ws=path.join(out,host+'-workspace');fs.mkdirSync(ws);
    const profiles=host==='codex'?[['control',null],['total',{limitTokens:20000,scope:'total'}],['body',{limitTokens:20000,scope:'body_after_prefix'}]]:[['control',null],['early',{windowTokens:100000,percent:20}]];
    for (const [name,policy] of profiles) {
      const folder=path.join(out,host+'-'+name),home=path.join(folder,'home');fs.mkdirSync(home,{recursive:true});
      active={host,folder,requests:[],events:[]};const overrides=contextOverrides(host,policy);const env=childEnv(process.env,{home});
      env.CODEX_HOME=path.join(home,'.codex');env.CLAUDE_CONFIG_DIR=path.join(home,'.claude');fs.mkdirSync(env.CODEX_HOME);fs.mkdirSync(env.CLAUDE_CONFIG_DIR);
      let args;
      if (host==='codex') {
        fs.copyFileSync(path.join(process.env.USERPROFILE||process.env.HOME,'.codex/models_cache.json'),path.join(env.CODEX_HOME,'models_cache.json'));
        fs.writeFileSync(path.join(env.CODEX_HOME,'config.toml'),`model = "gpt-6.1-sol"\nmodel_reasoning_effort = "medium"\nmodel_provider = "fixture"\n[features]\napps = false\n[model_providers.fixture]\nname = "Owned protocol fixture"\nbase_url = "http://127.0.0.1:${port}/v1"\nwire_api = "responses"\nrequires_openai_auth = false\nrequest_max_retries = 0\nstream_max_retries = 0\n`);
        args=['--no-daemon','-a','never',...overrides.argv,'exec','--json','--skip-git-repo-check','-s','danger-full-access','-'];
      } else {
        env.ANTHROPIC_BASE_URL=`http://127.0.0.1:${port}`;env.ANTHROPIC_API_KEY='owned-local-fixture-only';
        Object.assign(env,overrides.env);
        args=['--bare','--print','--input-format','stream-json','--output-format','stream-json','--verbose','--model','claude-sonnet-4-6','--effort','medium','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--setting-sources','','--no-session-persistence'];
      }
      const child=spawn(host==='codex'?codex:claude,args,{cwd:ws,env,windowsHide:true,stdio:['pipe','pipe','pipe']});
      let buffer='',turns=0;
      const user=text=>JSON.stringify({type:'user',message:{role:'user',content:text}})+'\n';
      child.stdout.on('data',b=>{
        fs.appendFileSync(path.join(folder,'stdout.jsonl'),b);
        if(host!=='claude')return;
        buffer+=b;let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);let e;try{e=JSON.parse(line);}catch{continue;}
          if(e.type==='result'){turns++;if(turns===1&&!e.is_error)child.stdin.write(user('Gev second completed-user group: retain the unsupported-claim UNKNOWN requirement and report completion again.'));else child.stdin.end();}
        }
      });
      child.stderr.on('data',b=>fs.appendFileSync(path.join(folder,'stderr.txt'),b));child.stdin.on('error',()=>{});
      if(host==='claude')child.stdin.write(user(prompt));else child.stdin.end(prompt);
      // Never terminate a Windows process by PID. Observe this owning handle if
      // a native client stalls; a timeout is not a terminal receipt or a retry.
      const status=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(code,signal)=>resolve({code,signal}));});
      const result={host,name,policy,overrides,status,modelCalls:0,syntheticUsage:true,requests:active.requests.length,events:active.events,nativeSha256:hash(fs.readFileSync(host==='codex'?codex:claude)),checksPassed:false};
      fs.writeFileSync(path.join(folder,'RESULT.json'),JSON.stringify(result,null,2));
      assert.equal(status.code,0);assert(active.requests.length>=2&&active.requests.length<=5);
      const first=active.requests[0].body,surface={tools:first.tools,instructions:host==='codex'?first.instructions:first.system};assert(surface.tools.length>0);assert(JSON.stringify(surface.instructions).length>100);
      if (!stock) stock=surface;else assert.deepEqual(surface,stock,'policy must retain native stock tools and foundation instructions');
      const messages=first.input ?? first.messages;assert(JSON.stringify(messages).includes(prompt),'complete original question');
      const terminal=fs.readFileSync(path.join(folder,'stdout.jsonl'),'utf8');assert(terminal.includes('Gev context fixture'),'real native shell result recorded');assert(terminal.includes(reply),'complete scripted reply parsed');
      if(host==='claude'){
        assert.equal(turns,2,'two completed original user groups');
        const frames=terminal.split('\n').filter(Boolean).map(JSON.parse);
        result.nativeCompactionBoundaries=frames.filter(e=>e.type==='system'&&e.subtype==='compact_boundary').length;
        result.nativeCompactionFailures=frames.filter(e=>e.type==='system'&&e.compact_result==='failed').map(e=>e.compact_error);
        assert.equal(result.nativeCompactionBoundaries,name==='early'?1:0,'actual native compact-boundary proof');
        const done=frames.filter(e=>e.type==='result'),cumulative=done.at(-1).modelUsage;
        result.syntheticAccountedInputTokens=Object.values(cumulative).reduce((n,u)=>n+u.inputTokens,0);
        result.syntheticPerTurnInputTokens=done.reduce((n,e)=>n+e.usage.input_tokens,0);
        const expected=result.events.reduce((n,e)=>n+(e.compact?1000:30000),0);
        assert.equal(result.syntheticAccountedInputTokens,expected,'include compact requests through cumulative modelUsage');
        assert.equal(Object.values(cumulative).reduce((n,u)=>n+u.outputTokens,0),result.requests*10);
        if(name==='early')assert.equal(result.syntheticAccountedInputTokens-result.syntheticPerTurnInputTokens,1000,'per-turn usage alone omits the scripted compaction request');
      }
      if (host==='codex') {
        assert.equal(result.events.filter(e=>e.compact).length,name==='total'?1:0);
        for (const r of active.requests.filter((_,i)=>!result.events[i].compact)) assert.deepEqual({tools:r.body.tools,instructions:r.body.instructions},stock,'native post-compaction surface retained');
        const done=terminal.split('\n').filter(Boolean).map(JSON.parse).find(e=>e.type==='turn.completed');assert.equal(done.usage.input_tokens,30000+(active.requests.length-1)*1000,'include synthetic compaction request cost');
      }
      result.checksPassed=true;fs.writeFileSync(path.join(folder,'RESULT.json'),JSON.stringify(result,null,2));results.push(result);console.log(JSON.stringify({host,name,requests:result.requests,compactions:host==='claude'?result.nativeCompactionBoundaries:result.events.filter(e=>e.compact).length,checksPassed:true,modelCalls:0}));
    }
  }
} finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
fs.writeFileSync(path.join(out,'RESULT.json'),JSON.stringify({results,modelCalls:0,syntheticUsage:true,limitations:['Owned scripted protocol behavior only; fabricated counters are never model-token or quota evidence.','Custom Codex provider uses fallback metadata; tested control surface is not genuine subscription metadata parity.','Claude bare/fake-local-key mode does not prove real OAuth, model quality, compaction activation or normal integration.','Thresholds are not hard peak caps; compaction quality, useful answers, factuality, full peak and all real costs require a new pinned study.']},null,2)+'\n');
