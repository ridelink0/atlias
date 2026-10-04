import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {discoveryCatalog,discoveryCall} from '../../mcp/discovery.mjs';
const root=fileURLToPath(new URL('../..',import.meta.url)),temp=fs.mkdtempSync(path.join(os.tmpdir(),'gev-discovery-'));
process.env.ATLIAS_HOME=path.join(temp,'state');
const {TOOLS,toolCatalog,callTool}=await import('../../mcp/tools.mjs');
let checks=0;const check=f=>{f();checks++};
const sample=s=>s.enum?.[0]??(s.type==='object'?Object.fromEntries((s.required||[]).map(k=>[k,sample(s.properties[k])])):s.type==='array'?[]:s.type==='integer'?1:s.type==='boolean'?true:'Gev fixture');
try {
  check(()=>assert.deepEqual(toolCatalog(false,false),TOOLS));
  for(const lean of [false,true]) {
    const original=toolCatalog(lean,false),facade=toolCatalog(lean,true);
    check(()=>assert.equal(facade.length,1));
    check(()=>assert.deepEqual(facade,discoveryCatalog(original)));
    check(()=>assert.deepEqual(JSON.parse(discoveryCall(original,()=>assert.fail('list executed a tool'),{action:'list'})),original.map(({name,description})=>({name,description}))));
    for(const tool of original) {
      check(()=>assert.deepEqual(JSON.parse(discoveryCall(original,()=>assert.fail('describe executed a tool'),{action:'describe',tool:tool.name})),tool));
      const args=sample(tool.inputSchema);args.fixtureExtra='preserve original additional properties';
      check(()=>assert.deepEqual(discoveryCall(original,(name,input)=>({name,input}),{action:'call',tool:tool.name,arguments:args}),{name:tool.name,input:args}));
      for(const required of tool.inputSchema.required||[]) {
        const missing={...args};delete missing[required];
        check(()=>assert.throws(()=>discoveryCall(original,()=>assert.fail('invalid input executed'),{action:'call',tool:tool.name,arguments:missing}),/required/));
      }
    }
    check(()=>assert(Buffer.byteLength(JSON.stringify(facade))<Buffer.byteLength(JSON.stringify(original))));
  }
  for(const input of [null,[],{}, {action:'call',tool:'harness'}, {action:'call',tool:'__proto__'}, {action:'describe',tool:'harness_progress',arguments:{}}, {action:'list',tool:'harness_progress'}, {action:'list',arguments:{}}, {action:'list',extra:1}, {action:'call',tool:'harness_progress',arguments:null}, {action:'call',tool:'harness_progress',arguments:[]}, {action:'call',tool:'harness_progress',arguments:{action:'destroy'}}, {action:'call',tool:'harness_verify',arguments:{paths:[1]}}, {action:'call',tool:'graph_query',arguments:{question:'Gev',budget:1.5}}, {action:'call',tool:'graph_query',arguments:{question:'Gev',budget:Infinity}}])check(()=>assert.throws(()=>discoveryCall(TOOLS,()=>assert.fail('bad input dispatched'),input)));
  check(()=>assert.equal(callTool('harness',{action:'call',tool:'harness_progress',arguments:{action:'get',cwd:temp}}),callTool('harness_progress',{action:'get',cwd:temp})));
  for(const enabled of [false,true]) {
    const requests=[{id:1,method:'initialize',params:{}},{id:2,method:'tools/list'}, {id:3,method:'tools/call',params:{name:'harness',arguments:{action:'describe',tool:'harness_progress'}}}, {id:4,method:'tools/call',params:{name:'harness',arguments:{action:'call',tool:'harness_progress',arguments:{action:'get',cwd:temp}}}}, {id:5,method:'tools/call',params:{name:'harness',arguments:{action:'call',tool:'unknown'}}}, {id:6,method:'tools/call',params:{name:'harness_progress',arguments:{action:'get',cwd:temp}}}, {id:7,method:'ping'}];
    const result=spawnSync(process.execPath,[path.join(root,'mcp/server.mjs')],{encoding:'utf8',input:'null\n[]\n'+requests.map(r=>JSON.stringify({jsonrpc:'2.0',...r})).join('\n')+'\n',env:{...process.env,ATLIAS_FLAG_MCP_DISCOVERY:enabled?'1':'0'},windowsHide:true,timeout:10000});
    check(()=>assert.equal(result.status,0,result.stderr));const replies=result.stdout.trim().split('\n').map(JSON.parse),by=id=>replies.find(r=>r.id===id);
    check(()=>assert.equal(replies.filter(r=>r.error?.code===-32600).length,2));
    check(()=>assert.equal(by(2).result.tools.length,enabled?1:10));
    check(()=>assert.deepEqual(JSON.parse(by(3).result.content[0].text),TOOLS.find(t=>t.name==='harness_progress')));
    check(()=>assert.deepEqual(by(4).result,by(6).result));
    check(()=>assert.equal(by(5).result.isError,true));
    check(()=>assert.deepEqual(by(7).result,{}));
  }
  console.log(JSON.stringify({checks,modelCalls:0,originalCatalogBytes:Buffer.byteLength(JSON.stringify(toolCatalog(true,false))),facadeBytes:Buffer.byteLength(JSON.stringify(toolCatalog(true,true))),limitations:'Catalog bytes and scripted protocol checks do not prove native activation, model savings or normal capability parity.'}));
} finally {fs.rmSync(temp,{recursive:true,force:true});}
