import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';import {atomic,claim,localUrl} from './runtime.mjs';import {workerEnv} from './worker.mjs';import {hash} from './migrate.mjs';

const root=path.resolve(process.argv[2]||'D:/harness-work/atlias-local-1003');
const env=workerEnv(root),cfg=JSON.parse(fs.readFileSync(path.join(root,'CONFIG.json'),'utf8'));
localUrl(cfg.url);
if(!cfg.ollamaSHA256||hash(fs.readFileSync(cfg.ollamaExecutable))!==cfg.ollamaSHA256)throw Error('local runtime executable changed');
const release=claim(path.join(root,'SUPERVISOR.lock'));let worker=null,server=null;
const controller=path.dirname(fileURLToPath(import.meta.url));
function alive(pid){try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}}
function launch(command,args,log,childEnv){const fd=fs.openSync(path.join(root,log),'a');const p=spawn(command,args,{cwd:root,env:childEnv,windowsHide:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);p.on('error',e=>atomic(path.join(root,'ATTENTION.json'),{at:new Date().toISOString(),error:e.message}));return p;}
async function tick(){
 if(fs.existsSync(path.join(root,'STOP')))return false;
 if(fs.existsSync(path.join(root,'ATTENTION.json'))){atomic(path.join(root,'SUPERVISOR-STATUS.json'),{at:new Date().toISOString(),status:'attention-required; checkpoints retained'});return true;}
 let service=false;try{const r=await fetch(new URL('/api/version',cfg.url),{signal:AbortSignal.timeout(5000)});service=r.ok;}catch{}
 if(!service){
  if(!server||server.exitCode!==null)server=launch(cfg.ollamaExecutable,['serve'],'OLLAMA-supervisor.log',{...env,OLLAMA_HOST:new URL(cfg.url).host,OLLAMA_MODELS:cfg.modelDirectory,OLLAMA_NO_CLOUD:'1',OLLAMA_NUM_PARALLEL:'1',OLLAMA_MAX_LOADED_MODELS:'1',OLLAMA_CONTEXT_LENGTH:String(cfg.context),OLLAMA_FLASH_ATTENTION:'1',OLLAMA_KV_CACHE_TYPE:'q8_0'});
  atomic(path.join(root,'SUPERVISOR-STATUS.json'),{at:new Date().toISOString(),status:'waiting-for-local-runtime'});return true;
 }
 const lock=path.join(root,'WORKER.lock');let hasWorker=false;
 if(fs.existsSync(lock)){const data=JSON.parse(fs.readFileSync(lock,'utf8'));hasWorker=alive(data.pid);}
 if(!hasWorker&&(!worker||worker.exitCode!==null))worker=launch(process.execPath,[path.join(controller,'worker.mjs'),root],'WORKER.log',env);
 atomic(path.join(root,'SUPERVISOR-STATUS.json'),{at:new Date().toISOString(),status:hasWorker?'worker-active':'worker-launch-requested',cloudInference:false});return true;
}
try{while(await tick())await new Promise(r=>setTimeout(r,30000));}
finally{release();}
