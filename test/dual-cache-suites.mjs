import * as core from '../lib/core.mjs';
import { spawnSync } from 'node:child_process';
export default function({suite,check,TMP,fs,path}) {
 suite('dual cache expert','both host caches feed the shared launchers',()=>{
  for(const dir of [core.CLAUDE_DIR,core.CODEX_DIR])if(!path.resolve(dir).startsWith(path.resolve(TMP)+path.sep))throw Error('Cache fixture is not inside the test workspace');
  const create=(home,version,marker)=>{const root=path.join(home,'plugins','cache','atlias','atlias',version);for(const [rel,text]of [['mcp/server.mjs',`console.log('${marker}');`],['lib/hooks.mjs',`console.log('${marker}');`]]){fs.mkdirSync(path.dirname(path.join(root,rel)),{recursive:true});fs.writeFileSync(path.join(root,rel),text);}return root;};
  const oldClaude=create(core.CLAUDE_DIR,'99.1.0','CLAUDE_OLD'),newCodex=create(core.CODEX_DIR,'99.2.0','CODEX_NEW');
  const state=path.join(TMP,'dual-cache-state');fs.mkdirSync(state,{recursive:true});
  const run=(name,text,override='')=>{const file=path.join(state,name);fs.writeFileSync(file,text);return spawnSync(process.execPath,[file,'session-start','--host','codex'],{env:{...process.env,ATLIAS_ROOT:override,ATLIAS_HOME:state,CODEX_HOME:core.CODEX_DIR,CLAUDE_CONFIG_DIR:core.CLAUDE_DIR},encoding:'utf8',input:'{}',windowsHide:true,timeout:15000});};
  const roots=core.installedRoots();check('the runtime lists newer Codex before older Claude copies',roots.indexOf(newCodex)>=0&&roots.indexOf(newCodex)<roots.indexOf(oldClaude),{happened:roots.join(' '),why:'A Codex-only upgrade must not be invisible to the shared resolver.',fix:'Merge both cache lists before sorting versions.'});
  for(const [name,text]of [['server.mjs',core.LAUNCHER_SOURCE],['hooks.mjs',core.HOOKS_LAUNCHER_SOURCE]]){
   const latest=run(name,text);check(name+' chooses the newer Codex copy',latest.status===0&&latest.stdout.trim()==='CODEX_NEW',{happened:latest.stdout||latest.stderr,why:'The generated launcher must match runtime resolution.',fix:'Scan both caches in the durable source.'});
   const explicit=run(name,text,oldClaude);check(name+' preserves explicit root selection',explicit.status===0&&explicit.stdout.trim()==='CLAUDE_OLD',{happened:explicit.stdout||explicit.stderr,why:'An explicit development checkout remains authoritative.',fix:'Keep ATLIAS_ROOT ahead of cache discovery.'});
  }
  const newClaude=create(core.CLAUDE_DIR,'99.3.0','CLAUDE_NEW');
  check('a later Claude upgrade wins globally for both launchers',run('server.mjs',core.LAUNCHER_SOURCE).stdout.trim()==='CLAUDE_NEW'&&run('hooks.mjs',core.HOOKS_LAUNCHER_SOURCE).stdout.trim()==='CLAUDE_NEW',{happened:'reverse upgrade order',why:'Cache enumeration order must not pin either host to an older version.',fix:'Sort the merged cache entries numerically.'});
  fs.rmSync(newClaude,{recursive:true,force:true});
  fs.rmSync(newCodex,{recursive:true,force:true});
  const next=run('server.mjs',core.LAUNCHER_SOURCE);check('a removed Codex copy falls through to the existing Claude copy',next.status===0&&next.stdout.trim()==='CLAUDE_OLD',{happened:next.stdout||next.stderr,why:'Removing one host must not break the other.',fix:'Skip absent roots.'});
  fs.rmSync(oldClaude,{recursive:true,force:true});
 });
}
