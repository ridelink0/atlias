import * as taskContext from '../lib/task-context.mjs';
import { spawnSync } from 'node:child_process';
export default function({suite,check,TMP,ROOT,fs,path}) {
  suite('task context expert','bounded task context works in Claude Code and Codex',()=>{
    const root=path.join(TMP,'task-context');fs.mkdirSync(path.join(root,'src'),{recursive:true});fs.mkdirSync(path.join(root,'docs'),{recursive:true});
    const write=(rel,text)=>{fs.mkdirSync(path.dirname(path.join(root,rel)),{recursive:true});fs.writeFileSync(path.join(root,rel),text);};
    write('docs/contract.md','Preserve the public API.');write('src/api.mjs',"export { repair } from './policy.mjs';");write('src/policy.mjs','export const repair = x => x;');
    const prompt='Fix src/api.mjs to satisfy docs/contract.md.';
    const packed=taskContext.pack(root,prompt);
    check('requirements precede the complete local dependency group, including sentence-ending paths',packed.includes('--- docs/contract.md ---')&&packed.includes('src/policy.mjs')&&packed.indexOf('docs/contract.md')<packed.indexOf('src/policy.mjs')&&packed.indexOf('src/policy.mjs')<packed.indexOf('src/api.mjs'),{happened:packed,why:'The API re-export alone cannot replace discovery of its implementation.',fix:'Pack the static dependency closure after the requirements.'});
    check('repeated references and import cycles are finite and deduplicated',taskContext.pack(root,prompt+' src/api.mjs').split('--- src/api.mjs ---').length===2,{happened:'duplicate roots',why:'Duplicate files waste prompt budget.',fix:'Deduplicate real paths.'});
    write('src/policy.mjs',"export { repair } from './api.mjs';");check('cyclic dependencies are bounded',taskContext.pack(root,prompt).length<10000,{happened:'cycle',why:'A circular import must not recurse indefinitely.',fix:'Track visiting paths.'});
    write('src/policy.mjs','x'.repeat(4097));const large=taskContext.pack(root,prompt);
    check('an oversized prerequisite rejects the whole source group without truncating requirements',large.includes('Preserve the public API.')&&!large.includes('--- src/api.mjs ---')&&large.includes('Not supplied: src/api.mjs'),{happened:large,why:'A partial source dependency group must not masquerade as complete.',fix:'Commit only fitting whole closures.'});
    write('src/policy.mjs','export const repair = x => x;');write('src/secrets/private.mjs','SECRET_CANARY');write('src/private-api.mjs',"export * from './secrets/private.mjs';");
    check('private dependencies and path traversal are excluded',!taskContext.pack(root,'Read src/private-api.mjs').includes('SECRET_CANARY')&&!taskContext.pack(root,'Read ../outside/file.mjs').includes('outside'),{happened:'private traversal',why:'Context routing must not expose private or outside files.',fix:'Contain real paths and deny private components.'});
    write('src/binary.js',Buffer.from([65,0,66]));write('src/bad.js',Buffer.from([0xff,0xfe]));
    check('binary and invalid UTF-8 files produce no fabricated snapshot',taskContext.pack(root,'Read src/binary.js src/bad.js')==='',{happened:'binary input',why:'Decoded replacement characters would silently alter source.',fix:'Reject binary and invalid UTF-8.'});
    check('unrelated prompts and missing projects add nothing',taskContext.pack(root,'Hello Gev')===''&&taskContext.pack(path.join(root,'missing'),prompt)==='',{happened:'absent context',why:'Routing should be silent without useful explicit context.',fix:'Require named existing task files.'});
    write('src/credentials.json','PRIVATE_CREDENTIAL_CANARY');
    check('credential filenames are private even when explicitly named',taskContext.pack(root,'Read src/credentials.json')==='',{happened:'credential filename',why:'An extension must not evade private-file filtering.',fix:'Deny sensitive basename components before reading.'});
    const outside=path.join(TMP,'outside-pack');fs.mkdirSync(outside,{recursive:true});fs.writeFileSync(path.join(outside,'public.mjs'),'OUTSIDE_CANARY');
    fs.symlinkSync(outside,path.join(root,'src','external'),process.platform==='win32'?'junction':'dir');
    fs.symlinkSync(path.join(root,'src','secrets'),path.join(root,'src','alias'),process.platform==='win32'?'junction':'dir');
    check('external links and aliases into private folders remain excluded',taskContext.pack(root,'Read src/external/public.mjs src/alias/private.mjs')==='',{happened:'real-path boundary',why:'Lexical containment alone permits symlink disclosure.',fix:'Apply containment and privacy checks to the resolved target.'});
    for(let i=0;i<10;i++)write(`src/chain-${i}.mjs`,i<9?`export * from './chain-${i+1}.mjs';`:'export const end = 1;');
    check('a deep dependency chain is refused atomically at the file budget',taskContext.pack(root,'Read docs/contract.md src/chain-0.mjs').includes('Not supplied: src/chain-0.mjs')&&!taskContext.pack(root,'Read src/chain-0.mjs').includes('--- src/chain'),{happened:'dependency limit',why:'Recursive context discovery must stay bounded.',fix:'Bound the dependency traversal and reject partial groups.'});
    write('src/changed.mjs','export const marker = "before";');const before=taskContext.pack(root,'Read src/changed.mjs');write('src/changed.mjs','export const marker = "after";');
    check('each prompt uses current source rather than a stale cached snapshot',before.includes('before')&&taskContext.pack(root,'Read src/changed.mjs').includes('after'),{happened:'stale content',why:'Session context must follow user edits.',fix:'Scope the read cache to one pack operation.'});
    check('Windows separators and bounded output preserve complete file contents',taskContext.pack(root,'Read docs\\contract.md src\\api.mjs').includes('--- docs/contract.md ---')&&packed.length<=10000,{happened:'Windows references',why:'Both host adapters must work with native Windows path syntax.',fix:'Normalize references and cap the complete rendered pack.'});
    write('README.md','Root requirements.');write('policy.test.mjs','export const test = true;');
    check('root files and names with multiple dots are recognized',taskContext.pack(root,'Read README.md and policy.test.mjs.').includes('--- README.md ---')&&taskContext.pack(root,'Read policy.test.mjs.').includes('--- policy.test.mjs ---'),{happened:'root file references',why:'A directory separator is not required for an explicit file reference.',fix:'Recognize relative basenames without matching hidden or outside files.'});
    const hook=(host,on)=>spawnSync(process.execPath,[path.join(ROOT,'lib/hooks.mjs'),'prompt','--host',host],{env:{...process.env,ATLIAS_HOME:path.join(TMP,'pack-state-'+host),ATLIAS_FLAG_TASK_CONTEXT:on?'1':'0',ATLIAS_NO_DETACH:'1'},input:JSON.stringify({session_id:'pack-'+host,cwd:root,prompt}),encoding:'utf8',windowsHide:true,timeout:15000});
    const outputs=['claude','codex'].map(h=>hook(h,true));
    check('both real host hooks deliver the same scoped context',outputs.every(r=>r.status===0&&JSON.parse(r.stdout).hookSpecificOutput.additionalContext===taskContext.pack(root,prompt)),{happened:outputs.map(r=>r.stderr).join(' '),why:'A helper-only check cannot prove the host event is wired.',fix:'Run the real UserPromptSubmit hook in both adapters.'});
    check('flags off preserve silent task routing for both hosts',['claude','codex'].every(h=>{const r=hook(h,false);return r.status===0&&r.stdout==='';}),{happened:'off routing',why:'The control arm and ordinary installs must retain previous behavior.',fix:'Gate packing behind the explicit default-off flag.'});
  });
}
