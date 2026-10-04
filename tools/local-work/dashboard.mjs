import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {claim,atomic} from './runtime.mjs';
import {snapshot} from './progress.mjs';
const assets=path.join(path.dirname(fileURLToPath(import.meta.url)),'dashboard');
export function verifiedWorker(root){
 try{const lease=JSON.parse(fs.readFileSync(path.join(root,'WORKER.lock'),'utf8'));if(!Number.isSafeInteger(lease.pid)||lease.pid<=0)return false;
  if(process.platform!=='win32')return false;
  const r=spawnSync('powershell.exe',['-NoProfile','-Command',`(Get-CimInstance Win32_Process -Filter 'ProcessId=${lease.pid}').CommandLine`],{encoding:'utf8',windowsHide:true,timeout:5000});
  return r.status===0&&r.stdout.includes('worker.mjs')&&r.stdout.replaceAll('\\','/').includes(root.replaceAll('\\','/'));
 }catch{return false;}
}
export function dashboard(root,{port=11436,live=verifiedWorker}={}){
 root=path.resolve(root);let cachedLive=false,lastProbe=0;
 const server=http.createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  if(req.headers.host!==`127.0.0.1:${server.address()?.port}`||req.method!=='GET'){res.writeHead(403);res.end('Local read-only dashboard');return;}
  const allowed={'/':'index.html','/app.js':'app.js','/core.css':'core.css','/site.css':'site.css','/icon.svg':'icon.svg'};
  if(req.url==='/api/progress'){
   if(Date.now()-lastProbe>5000){cachedLive=live(root);lastProbe=Date.now();}
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(snapshot(root,{live:cachedLive})));return;
  }
  const name=allowed[req.url];if(!name){res.writeHead(404);res.end('Not found');return;}
  try{res.setHeader('Content-Type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.svg')?'image/svg+xml':'text/css; charset=utf-8');res.end(fs.readFileSync(path.join(assets,name)));}catch{res.writeHead(500);res.end('Dashboard file unavailable');}
 });
 server.listen(port,'127.0.0.1');return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=path.resolve(process.argv[2]||'D:/harness-work/atlias-local-1003'),release=claim(path.join(root,'DASHBOARD.lock'));
 const server=dashboard(root);server.on('listening',()=>atomic(path.join(root,'DASHBOARD-STATUS.json'),{pid:process.pid,url:'http://127.0.0.1:11436',at:new Date().toISOString()}));
 server.on('error',e=>{release();console.error(e.message);process.exitCode=1;});server.on('close',release);
 const timer=setInterval(()=>{if(fs.existsSync(path.join(root,'DASHBOARD-OFF'))){clearInterval(timer);server.close();}},3000);timer.unref();
}
