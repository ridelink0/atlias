// Actual native protocol fixture, zero inference. Full stock tools/instructions.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import crypto from 'node:crypto';
import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
import {nativeInput} from '../../lib/task-context.mjs';import {childEnv} from '../ccstudy/lib.mjs';
const [out,codex,claude]=process.argv.slice(2);if(!out||!codex||!claude)throw Error('usage: context-probe.mjs <unused-output> <codex-exe> <claude-exe>');
if(fs.existsSync(out))throw Error('preserve previous probe');fs.mkdirSync(out,{recursive:true});
const requests=[],results=[],reply='Okay Gev, local protocol fixture only.';
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') { res.writeHead(404); res.end(); return; }
  let raw = ''; for await (const part of req) raw += part;
  const body = JSON.parse(raw);
  if (!/\/messages|\/responses/.test(req.url)) { res.writeHead(404); res.end(); return; }
  requests.push({ url: req.url, body });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  if (req.url.includes('/messages')) {
    const msg = { id: 'msg_gev_fixture', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: reply }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } };
    if (!body.stream) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(msg)); return; }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    send('message_start', { type: 'message_start', message: { ...msg, content: [], stop_reason: null } });
    send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: reply } });
    send('content_block_stop', { type: 'content_block_stop', index: 0 });
    send('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 0 } });
    send('message_stop', { type: 'message_stop' }); res.end(); return;
  }
  res.writeHead(200, { 'Content-Type': 'text/event-stream' });
  const item = { id: 'msg_gev_fixture', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: reply, annotations: [] }] };
  const response = { id: 'resp_gev_fixture', object: 'response', model: body.model, status: 'completed', output: [item], usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 } };
  send('response.created', { type: 'response.created', response: { ...response, status: 'in_progress', output: [] } });
  send('response.output_item.added', { type: 'response.output_item.added', output_index: 0, item: { ...item, status: 'in_progress', content: [] } });
  send('response.content_part.added', { type: 'response.content_part.added', item_id: item.id, output_index: 0, content_index: 0, part: { type: 'output_text', text: '', annotations: [] } });
  send('response.output_text.delta', { type: 'response.output_text.delta', item_id: item.id, output_index: 0, content_index: 0, delta: reply });
  send('response.output_text.done', { type: 'response.output_text.done', item_id: item.id, output_index: 0, content_index: 0, text: reply });
  send('response.content_part.done', { type: 'response.content_part.done', item_id: item.id, output_index: 0, content_index: 0, part: item.content[0] });
  send('response.output_item.done', { type: 'response.output_item.done', output_index: 0, item });
  send('response.completed', { type: 'response.completed', response }); res.end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
try {
  for(const host of ['codex','claude']){
    const folder=path.join(out,host),home=path.join(folder,'home'),ws=path.join(folder,'ws');
    fs.mkdirSync(home,{recursive:true});fs.mkdirSync(path.join(ws,'docs'),{recursive:true});
    fs.writeFileSync(path.join(ws,'docs/contract.md'),'Preserve the complete task and native tools.\n');
    const prompt='Okay Gev\r\nInspect docs/contract.md completely; preserve café and 雪.';
    const prepared=nativeInput(ws,prompt);assert.ok(prepared.context);fs.writeFileSync(path.join(folder,'input.txt'),prepared.input);
    const env=childEnv(process.env,{home});env.CODEX_HOME=path.join(home,'.codex');env.CLAUDE_CONFIG_DIR=path.join(home,'.claude');env.ATLIAS_HOME=path.join(home,'.atlias');env.ATLIAS_FLAG_TASK_CONTEXT='0';
    fs.mkdirSync(env.CODEX_HOME);fs.mkdirSync(env.CLAUDE_CONFIG_DIR);
    let args;
    if(host==='codex'){
      const cache=path.join(process.env.USERPROFILE||process.env.HOME,'.codex/models_cache.json');
      assert.ok(JSON.parse(fs.readFileSync(cache)).models?.some(m=>m.slug==='gpt-6.1-sol'),'actual native model metadata required');
      fs.copyFileSync(cache,path.join(env.CODEX_HOME,'models_cache.json'));
      fs.writeFileSync(path.join(env.CODEX_HOME,'config.toml'),`model = "gpt-6.1-sol"\nmodel_provider = "fixture"\n[features]\napps = false\n[model_providers.fixture]\nname = "Owned protocol fixture"\nbase_url = "http://127.0.0.1:${port}/v1"\nwire_api = "responses"\nrequires_openai_auth = false\n`);
      args=['--no-daemon','-a','never','exec','--json','--skip-git-repo-check','-s','danger-full-access','-c','features.apps=false','-'];
    }else{
      env.ANTHROPIC_BASE_URL=`http://127.0.0.1:${port}`;env.ANTHROPIC_API_KEY='owned-local-fixture-only';
      args=['--bare','--print','--output-format','stream-json','--verbose','--model','claude-sonnet-4-6','--effort','medium','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--setting-sources','','--no-session-persistence'];
    }
    let control;
    for(const [arm,input] of [['control',prompt],['prepared',prepared.input]]){
      const before=requests.length,child=spawn(host==='codex'?codex:claude,args,{cwd:ws,env,windowsHide:true,stdio:['pipe','pipe','pipe']});
      let stdout='',stderr='';child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);child.stdin.on('error',()=>{});child.stdin.end(input);
      const timer=setTimeout(()=>child.kill(),90000);
      const status=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(code,signal)=>resolve({code,signal}));}).finally(()=>clearTimeout(timer));
      fs.writeFileSync(path.join(folder,arm+'-stream.jsonl'),stdout);fs.writeFileSync(path.join(folder,arm+'-stderr.txt'),stderr);
      const captured=requests.slice(before);fs.writeFileSync(path.join(folder,arm+'-requests.json'),JSON.stringify(captured,null,2));
      assert.equal(status.code,0,stderr.slice(-600));assert.ok(captured.length);
      const events=stdout.split('\n').filter(Boolean).flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});
      const output=host==='codex'?events.filter(e=>e.type==='item.completed'&&e.item?.type==='agent_message').at(-1)?.item.text:events.filter(e=>e.type==='result').at(-1)?.result;
      assert.equal(output,reply,'native client must parse the complete local protocol reply');
      for(const request of captured){
        const body=request.body, messages=host==='codex'?body.input:body.messages;
        const texts=messages.filter(x=>x.role==='user').flatMap(x=>typeof x.content==='string'?[x.content]:(x.content||[]).filter(p=>typeof p.text==='string').map(p=>p.text));
        assert.ok(texts.some(text=>text.includes(input)),'entire original/prepared input must reach the actual native request');
        const tools=body.tools||[],instructions=host==='codex'?body.instructions:body.system;
        assert.ok(tools.length>0,'ordinary native tools must remain available');assert.ok(instructions&&JSON.stringify(instructions).length>100,'stock native instruction layer must remain available');
        const surface={tools,instructions};
        if(arm==='control')control=surface;else assert.deepEqual(surface,control,'caller preparation must preserve the complete control tools and stock instructions');
      }
      results.push({host,arm,modelCalls:0,localRequests:captured.length,fullInputDelivered:true,identicalControlSurface:arm==='prepared',inputSha256:hash(input),toolNames:control.tools.map(t=>t.name||t.type),instructionsSha256:hash(JSON.stringify(control.instructions)),status});
      console.log(JSON.stringify(results.at(-1)));
    }
  }
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
fs.writeFileSync(path.join(out,'RESULT.json'),JSON.stringify({modelCalls:0,results,limitations:['Owned local protocol fixture only; no model quality, token savings or subscription usage measurement.','Claude uses --bare with a fake localhost key; OAuth installation and integration parity are unverified.','This proves caller transport preserves the tested native tool/instruction surface, not universal capability parity.']},null,2)+'\n');
