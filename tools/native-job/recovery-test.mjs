import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const isolated=fs.mkdtempSync(path.join(os.tmpdir(),'Gev-recovery-'));
process.env.ATLIAS_HOME=isolated;process.env.HOME=isolated;process.env.USERPROFILE=isolated;
const {auditSummary,recoveryText,build:buildNote,notePath,postCompact}=await import('../../lib/progress.mjs');
const {recordEvent}=await import('../../lib/core.mjs');
const {build:brief}=await import('../../lib/brief.mjs');
const next='Preserve count=0 as known and region=null as unknown; do not invent a region.';
const note='# Gev handoff\n\n## Files changed this session\n- src/status.mjs\n\n## Checks run\n- node test/status.mjs\n\n## Next\n'+next+'\n';
let checks=0;const ok=f=>{f();checks++;};
ok(()=>assert.equal(auditSummary(note,note).missing.length,0));
for(const changed of ['Preserve count=9 as known and region=west as unknown; invent a region.','Preserve count=0 as known and region=null as unknown; invent a region.','Preserve count=0 as known and region=null as unknown; do not invent a Region.','Never '+next]) {
  const summary='src/status.mjs; node test/status.mjs; '+changed;
  // Literal quoting can contain the original text while negating its intent.
  // This API never claims semantic fidelity, even for a literal match.
  const audit=auditSummary(note,summary);ok(()=>assert.equal(audit.semanticStatus,'unverified'));
  if(!changed.startsWith('Never '))ok(()=>assert(audit.missing.some(s=>s.startsWith('next step:'))));
}
const cwd='D:/Gev recovery project',bulk='# Gev handoff\n\n## Files changed this session\n'+Array(500).fill('- bulk/file.mjs').join('\n')+'\n\n## Checks run\n- node verify.mjs (recorded outcome: fail)\n\n## Next\n'+next+'\n';
for(const budget of [256,500,2000,4000]){const text=recoveryText(cwd,bulk,budget);ok(()=>assert(text.includes('Read the original state at ')));ok(()=>assert(text.length<=budget||text.startsWith('Handoff excerpt is incomplete.')));if(budget>=500){ok(()=>assert(text.includes(next)));ok(()=>assert(text.includes('recorded outcome: fail')));}}
ok(()=>assert.equal(recoveryText(cwd,note,4000),note));
ok(()=>assert.equal(recoveryText(cwd,'',4000),''));
ok(()=>assert.equal(recoveryText(cwd,'\uFEFF'+note,4000),'\uFEFF'+note));
const windowsBulk=bulk.replace(/\n/g,'\r\n');
ok(()=>assert(recoveryText(cwd,windowsBulk,500).includes(next)));
ok(()=>assert(recoveryText(cwd,windowsBulk,500).includes('recorded outcome: fail')));
ok(()=>assert(auditSummary(note.replace(/\n/g,'\r\n'),note).missing.length===0));
ok(()=>assert(auditSummary(note.replace(/\n/g,'\r\n'),note.replace(next,next.replace('count=0','count=9'))).missing.some(s=>s.startsWith('next step:'))));
ok(()=>assert(recoveryText(cwd,'## Next\n'+next+'\n\n## Files changed this session\n'+'x'.repeat(5000),500).includes(next)));
const huge=note.replace(next,'Gev exact identifier '+ 'x'.repeat(5000));const text=recoveryText(cwd,huge,4000);ok(()=>assert(!text.includes('Gev exact identifier')));ok(()=>assert(text.includes('Read the original state at ')));
for(const budget of [0,-1,NaN,1.5,undefined,null,Infinity,'4000','not a number'])ok(()=>assert(recoveryText(cwd,note,budget).includes('Read the original state at ')||budget==='4000'&&recoveryText(cwd,note,budget)===note));
ok(()=>assert.throws(()=>recoveryText(cwd,null,4000),TypeError));
const project=path.join(isolated,'project');fs.mkdirSync(project);const sid='Gev-recovery-outcomes';
recordEvent(sid,{kind:'shell',command:'node verify.mjs',verify:true,outcome:'fail'});
recordEvent(sid,{kind:'shell',command:'node other.mjs',verify:true});
const built=buildNote(project,sid,null);ok(()=>assert(built.includes('recorded outcome: fail')));ok(()=>assert(built.includes('recorded outcome: unknown')&&!built.includes('recorded outcome: pass')));
fs.mkdirSync(path.dirname(notePath(project)),{recursive:true});fs.writeFileSync(notePath(project),bulk);
fs.writeFileSync(path.join(isolated,'config.json'),JSON.stringify({brief:{progressChars:500},graph:{autoBuild:false,autoUpdate:false}}));
for(const host of ['codex','claude']){const output=brief({cwd:project,session_id:sid,source:'resume'},host);ok(()=>assert(output.includes(next)));ok(()=>assert(output.includes('Read the original state at ')));ok(()=>assert(output.includes('recorded outcome: fail')));}
ok(()=>assert(postCompact({cwd:project}).hookSpecificOutput.additionalContext.includes(next)));
fs.rmSync(isolated,{recursive:true,force:true});
console.log(`${checks} Gev recovery controls passed; zero model calls.`);
