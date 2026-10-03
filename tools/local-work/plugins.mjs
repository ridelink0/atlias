import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';
import {manifest} from './knowledge.mjs';

export function pluginInventory(knowledge,query='') {
 const m=manifest(knowledge),term=query.toLowerCase();
 return m.files.filter(r=>r.category.includes('plugins')&&/[/\\](?:\.claude-plugin|\.codex-plugin)[/\\]plugin\.json$/.test(r.source))
  .map(r=>{try{const j=JSON.parse(fs.readFileSync(r.copy,'utf8'));const root=path.dirname(path.dirname(r.source));return {name:j.name||path.basename(root),version:j.version,root,snapshot:r.copy,sourceHash:r.sha256,status:'archived; native host/dependencies require activation check',mcpConfig:fs.existsSync(path.join(root,'.mcp.json'))?path.join(root,'.mcp.json'):null};}catch{return {source:r.source,status:'invalid manifest; held'};}})
  .filter(r=>!term||JSON.stringify(r).toLowerCase().includes(term));
}
export class StdioClient {
 constructor(command,args,{cwd,env,timeout=15000}={}) {
  this.pending=new Map();this.next=0;this.buffer='';this.timeout=timeout;
  this.child=spawn(command,args,{cwd,env,windowsHide:true,stdio:['pipe','pipe','pipe']});
  this.child.stdout.setEncoding('utf8');this.child.stdout.on('data',chunk=>{
   this.buffer+=chunk;if(this.buffer.length>4*1024*1024){this.fail(Error('MCP output exceeds frame limit'));return;}
   let end;while((end=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,end);this.buffer=this.buffer.slice(end+1);let row;try{row=JSON.parse(line);}catch{continue;}
    const p=this.pending.get(row.id);if(!p)continue;this.pending.delete(row.id);clearTimeout(p.timer);row.error?p.reject(Error(JSON.stringify(row.error))):p.resolve(row.result);}
  });
  this.child.stderr.on('data',()=>{});this.child.on('error',e=>this.fail(e));this.child.on('close',()=>this.fail(Error('MCP server exited')));
 }
 fail(error){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error);}this.pending.clear();}
 request(method,params={}) {
  const id=++this.next;return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.pending.delete(id);reject(Error(`MCP ${method} timeout; server not verified`));},this.timeout);
   this.pending.set(id,{resolve,reject,timer});
   this.child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n',e=>{if(e){clearTimeout(timer);this.pending.delete(id);reject(e);}});
  });
 }
 async init(){await this.request('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'atlias-local',version:'1'}});this.child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');return this.request('tools/list');}
 close(){
  this.fail(Error('MCP client closed'));
  if(this.child.exitCode!==null||this.child.signalCode!==null)return Promise.resolve();
  return new Promise(resolve=>{const timer=setTimeout(()=>this.child.kill(),1500);this.child.once('close',()=>{clearTimeout(timer);resolve();});this.child.stdin.end();});
 }
}
export const PLUGIN_TOOLS=[
 {type:'function',function:{name:'plugin_catalog',description:'Search every migrated plugin manifest and its dependency/activation status; does not execute plugin code.',parameters:{type:'object',properties:{query:{type:'string'}}}}},
 {type:'function',function:{name:'mcp_plugin',description:'Use a declared local stdio MCP adapter. action=list returns exact original tool schemas; action=call executes a named tool with its original arguments. Do not invent server/tools.',parameters:{type:'object',properties:{server:{type:'string'},action:{type:'string',enum:['list','call']},plugin_tool:{type:'string'},arguments:{type:'object'}},required:['server','action']}}}
];
export function pluginExecutor(knowledge,servers,env,cwd) {
 const clients=new Map();
 return {close:()=>Promise.all([...clients.values()].map(c=>c.close())),call:async(call)=>{
  if(call.tool==='plugin_catalog')return JSON.stringify(pluginInventory(knowledge,String(call.query||'')));
  const config=servers[call.server];if(!config)throw Error('server not declared locally; inspect plugin_catalog for missing activation/dependencies');
  if(config.command!=='node'||!Array.isArray(config.args)||!config.args.every(a=>typeof a==='string')||config.env&&Object.keys(config.env).some(k=>/TOKEN|SECRET|PASSWORD|API_KEY|AUTH/i.test(k)))throw Error('MCP adapter requires reviewed local Node config without credentials');
  if(!clients.has(call.server)){const c=new StdioClient(process.execPath,config.args,{cwd,env:{...env,...config.env}});clients.set(call.server,c);try{c.catalog=await c.init();}catch(e){await c.close();clients.delete(call.server);throw e;}}
  const c=clients.get(call.server);
  if(call.action==='list')return JSON.stringify(c.catalog);
  if(call.action!=='call'||!c.catalog.tools?.some(t=>t.name===call.name))throw Error('use an exact declared MCP tool name from action=list');
  return JSON.stringify(await c.request('tools/call',{name:call.name,arguments:call.arguments||{}}));
 }};
}
