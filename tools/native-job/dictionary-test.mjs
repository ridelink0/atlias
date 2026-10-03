import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {prepareDictionary,expandDictionary,assertDictionaryUnchanged,decodeDictionary,stageDictionary,DICTIONARY_RESPONSE_SCHEMA,DICTIONARY_INSTRUCTIONS} from '../../lib/native-job-dictionary.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'gev-dictionary-'));let n=0;
try{
  const specs=['a','b'].map(id=>{const dir=path.join(root,id);fs.mkdirSync(dir);fs.writeFileSync(dir+'/api.mjs','\uFEFFexport const value=1;\r\n');fs.writeFileSync(dir+'/contract.md','Preserve Unicode '+String.fromCharCode(233)+'.\r\n');return {id,root:dir,task:'Set value to2.',instructions:['Gev: preserve full required behavior.'],readPaths:['contract.md','api.mjs'],writePaths:['api.mjs']};});
  const state=prepareDictionary(specs);assert.equal(state.packet.strings.length,4);n++;const expanded=expandDictionary(state.packet);assert.equal(expanded[0].files[1].text,'\uFEFFexport const value=1;\r\n');n++;assert.equal(expanded[1].task,specs[1].task);n++;assert.deepEqual(expanded[0].instructions,specs[0].instructions);n++;
  assert.ok(Buffer.byteLength(state.input)<Buffer.byteLength(state.batch.input));n++;
  const reply={batchSha256:state.batch.batchSha256,jobs:specs.map(s=>({id:s.id,edits:[{fileIndex:1,text:'export const value=2;'}]}))};
  const decoded=JSON.parse(decodeDictionary(state,JSON.stringify(reply)));assert.equal(decoded.jobs[0].edits[0].beforeSha256,state.batch.jobs[0].job.packet.files[1].sha256);n++;
  for(const mutate of [x=>x.batchSha256='wrong',x=>x.jobs.pop(),x=>x.jobs.push(x.jobs[0]),x=>x.jobs[1].id='a',x=>x.jobs[1].id='unknown',x=>x.jobs[0].extra=true,x=>x.jobs[0].edits[0].fileIndex=-1,x=>x.jobs[0].edits[0].fileIndex=2,x=>x.jobs[0].edits[0].fileIndex=0.5,x=>x.jobs[0].edits[0].fileIndex='1',x=>x.jobs[0].edits[0].fileIndex=0,x=>x.jobs[0].edits[0].text=2,x=>x.jobs[0].edits[0].text='bad\0text',x=>x.jobs[0].edits.push(x.jobs[0].edits[0]),x=>x.jobs[0].edits[0].beforeSha256='forged',x=>x.extra=true]){const x=structuredClone(reply);mutate(x);assert.throws(()=>decodeDictionary(state,JSON.stringify(x)));n++;}
  const noEdit={batchSha256:state.batch.batchSha256,jobs:specs.map(s=>({id:s.id,edits:[]}))};assert.equal(JSON.parse(decodeDictionary(state,JSON.stringify(noEdit))).jobs.length,2);n++;
  for(const raw of [null,'','null','[]','{', ' '.repeat(512*1024+1)]){assert.throws(()=>decodeDictionary(state,raw));n++;}
  assert.throws(()=>expandDictionary(null));n++;assert.throws(()=>prepareDictionary([]));n++;
  const twelve=Array.from({length:12},(_,i)=>{const dir=path.join(root,'full-'+i);fs.mkdirSync(dir);fs.writeFileSync(dir+'/api.mjs','export const value=1;');return {...specs[0],id:'job-'+i,root:dir,readPaths:['api.mjs']};});
  const full=prepareDictionary(twelve);assert.equal(expandDictionary(full.packet).length,12);n++;assert.equal(full.packet.strings.length,3);n++;
  const fullReply=JSON.stringify({batchSha256:full.batch.batchSha256,jobs:twelve.map(s=>({id:s.id,edits:[]}))});assert.equal(JSON.parse(decodeDictionary(full,fullReply)).jobs.length,12);n++;
  for(const mutate of [x=>x.jobs[0].task=-1,x=>x.jobs[0].task=99,x=>x.jobs[0].task=0.1,x=>x.jobs[0].instructions=['0'],x=>x.jobs[0].files[0].body=-1,x=>x.jobs[0].files[0].writable='true',x=>x.jobs[1].id='a',x=>x.jobs[0].files.push(x.jobs[0].files[0]),x=>x.jobs[0].extra=1,x=>x.extra=1]){const p=structuredClone(state.packet);mutate(p);assert.throws(()=>expandDictionary(p));n++;}
  const original=state.packet.strings[0];state.packet.strings[0]='Changed task';assert.throws(()=>assertDictionaryUnchanged(state));n++;state.packet.strings[0]=original;
  const stage=stageDictionary(state,JSON.stringify(reply),path.join(root,'staged'));assert.equal(fs.readFileSync(stage.stages[0].staged.stage+'/api.mjs','utf8'),'export const value=2;');n++;assert.equal(fs.readFileSync(specs[0].root+'/api.mjs','utf8'),'\uFEFFexport const value=1;\r\n');n++;
  assert.throws(()=>stageDictionary(state,JSON.stringify(reply),stage.stage));n++;
  fs.writeFileSync(specs[1].root+'/contract.md','concurrent edit');assert.throws(()=>decodeDictionary(state,JSON.stringify(reply)));n++;
  assert.equal(DICTIONARY_RESPONSE_SCHEMA.properties.jobs.items.properties.edits.items.properties.fileIndex.type,'integer');n++;assert.ok(DICTIONARY_INSTRUCTIONS.includes('Never call tools'));n++;
}finally{const resolved=fs.realpathSync(root);assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('gev-dictionary-'));fs.rmSync(resolved,{recursive:true,force:true});}
console.log(`${n} full-data dictionary binding/staging controls passed; zero model calls; token savings unmeasured`);
