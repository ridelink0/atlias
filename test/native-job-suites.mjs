import * as bounded from '../lib/native-job.mjs';
import * as checked from '../lib/native-job-check.mjs';
import * as batches from '../lib/native-job-batch.mjs';
import * as dictionary from '../lib/native-job-dictionary.mjs';
import os from 'node:os';
export default function register({suite,check,fs,path}) {
  suite('complete dictionary transport','broker binding preserves every original job',()=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'gev-core-dictionary-'));
    const note=(name,ok)=>check(name,ok,{happened:name,why:'Compact transport cannot discard required task or source information.',fix:'Preserve complete strings and reject unbound edits.'});
    try{
      const specs=['a','b'].map(id=>{const dir=path.join(root,id);fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'api.mjs'),'export const value=1;');return {id,root:dir,task:'Set value to2.',instructions:['Gev: preserve required behavior.'],readPaths:['api.mjs'],writePaths:['api.mjs']};});
      const state=dictionary.prepareDictionary(specs);dictionary.assertDictionaryUnchanged(state);
      const expanded=dictionary.expandDictionary(state.packet);
      note('every complete original task is preserved',expanded.every((x,i)=>x.task===specs[i].task));
      note('identical complete source is interned without truncation',state.packet.strings.filter(s=>s==='export const value=1;').length===1&&expanded.every(x=>x.files[0].text==='export const value=1;'));
      const raw=JSON.stringify({batchSha256:state.batch.batchSha256,jobs:specs.map(s=>({id:s.id,edits:[{fileIndex:0,text:'export const value=2;'}]}))});
      note('broker restores original per-file hash',JSON.parse(dictionary.decodeDictionary(state,raw)).jobs[0].edits[0].beforeSha256===state.batch.jobs[0].job.packet.files[0].sha256);
      const staged=dictionary.stageDictionary(state,raw,path.join(root,'stage'));
      note('replacement stages correctly while live source is preserved',fs.readFileSync(path.join(staged.stages[0].staged.stage,'api.mjs'),'utf8')==='export const value=2;'&&fs.readFileSync(path.join(specs[0].root,'api.mjs'),'utf8')==='export const value=1;');
    }finally{const resolved=fs.realpathSync(root);if(path.dirname(resolved)!==fs.realpathSync(os.tmpdir())||!path.basename(resolved).startsWith('gev-core-dictionary-'))throw Error('unexpected cleanup path');fs.rmSync(resolved,{recursive:true,force:true});}
  });
  suite('independent native batches','complete independent packets and protected stages',()=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'gev-core-batch-'));
    const note=(name,ok)=>check(name,ok,{happened:name,why:'A batch must preserve every job and source rather than hiding failures in aggregate savings.',fix:'Check complete packet binding, disjoint staging and caller-owned verification.'});
    const rejects=fn=>{try{fn();return false}catch{return true}};
    try{
      const specs=['a','b'].map(id=>{const dir=path.join(root,id);fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'api.mjs'),'export const value=1;');return {id,root:dir,task:'Set value to2.',instructions:['Gev: preserve source and run both checks.'],readPaths:['api.mjs'],writePaths:['api.mjs']}});
      const batch=batches.prepareBatch(specs);
      note('every complete task and instruction is retained',batch.packet.jobs.every((x,i)=>x.packet.task===specs[i].task&&JSON.stringify(x.packet.instructions)===JSON.stringify(specs[i].instructions)));
      batches.assertBatchUnchanged(batch);note('original batch source binding validates',true);
      const response={batchSha256:batch.batchSha256,jobs:batch.jobs.map(({id,job})=>({id,packetSha256:job.packetSha256,edits:[{path:'api.mjs',beforeSha256:job.packet.files[0].sha256,text:'export const value=2;'}]}))};
      note('complete replies validate for every member',batches.validateBatch(batch,JSON.stringify(response)).length===2);
      note('missing members cannot be hidden as a successful batch',rejects(()=>batches.validateBatch(batch,JSON.stringify({...response,jobs:response.jobs.slice(0,1)}))));
      const stage=batches.stageBatch(batch,JSON.stringify(response),path.join(root,'stage'));
      const snapshot=batches.batchStageSnapshot(batch,stage);
      for(const {id,job} of batch.jobs){
        const member=stage.stages.find(x=>x.id===id).staged;
        const result=checked.verifyStagedJob(job,member,{functional:[process.execPath,'--check','api.mjs'],adversarial:[process.execPath,'-e','import("./api.mjs").then(m=>{if(m.value!==2)process.exit(1)})']},{env:{}});
        note(`${id} passes real functional and adversarial commands`,result.status==='verified-stage');
        note(`${id} leaves all staged sources unchanged`,batches.batchStageSnapshot(batch,stage)===snapshot);
      }
      fs.writeFileSync(path.join(stage.stages[1].staged.stage,'api.mjs'),'export const value=99;');
      note('a cross-member stage mutation is visible',batches.batchStageSnapshot(batch,stage)!==snapshot);
      note('a stage inside any live member is refused',rejects(()=>batches.stageBatch(batch,JSON.stringify(response),path.join(specs[0].root,'unsafe'))));
      fs.writeFileSync(path.join(specs[1].root,'api.mjs'),'concurrent change');
      note('concurrent change blocks later batch consumption',rejects(()=>batches.assertBatchUnchanged(batch)));
    }finally{const resolved=fs.realpathSync(root);if(path.dirname(resolved)!==fs.realpathSync(os.tmpdir())||!path.basename(resolved).startsWith('gev-core-batch-'))throw Error('unexpected cleanup path');fs.rmSync(resolved,{recursive:true,force:true})}
  });
  suite('bounded native jobs', 'preserve source and verify staged replacements',()=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'gev-core-native-job-'));
    const source=path.join(root,'source');fs.mkdirSync(source);fs.writeFileSync(path.join(source,'api.mjs'),'export const value=1;');
    const note=(name,condition,happened='')=>check(name,condition,{happened,why:'Bounded jobs must preserve source, reject unauthorized edits and verify real staged behavior.',fix:'Repair the bounded job without weakening path, source or check requirements.'});
    const rejects=fn=>{try{fn();return false;}catch{return true;}};
    try{
      const instructions=['The user is Gev. Start replies with Okay Gev. No emojis.'];
      const job=bounded.prepareJob({root:source,task:'Change value to2.',instructions,readPaths:['api.mjs'],writePaths:['api.mjs']});
      note('complete user rules are preserved',JSON.stringify(job.packet.instructions)===JSON.stringify(instructions));
      const envelope=JSON.parse(job.input);
      note('worker receives broker-computed packet hash',envelope.packetSha256===bounded.digest(JSON.stringify(envelope.packet)));
      note('tampered envelope is rejected',rejects(()=>bounded.assertJobUnchanged({...job,input:JSON.stringify({...envelope,packetSha256:bounded.digest('wrong')})})));
      note('normal source path resolves to the actual file',bounded.safeJobPath(source,'api.mjs')===fs.realpathSync(path.join(source,'api.mjs')));
      note('traversal is rejected',rejects(()=>bounded.safeJobPath(source,'../escape')));
      bounded.assertJobUnchanged(job);note('source snapshot validates',true);
      const raw=JSON.stringify({packetSha256:job.packetSha256,edits:[{path:'api.mjs',beforeSha256:job.packet.files[0].sha256,text:'export const value=2;'}]});
      note('source-bound edits accepted',bounded.validateEdits(job,raw).length===1);
      const stage=bounded.stageJob(job,raw,path.join(root,'stage'));
      note('live source remains untouched',fs.readFileSync(path.join(source,'api.mjs'),'utf8')==='export const value=1;');
      note('reusing a stage is rejected',rejects(()=>bounded.stageJob(job,raw,stage.stage)));
      const argv={functional:[process.execPath,'--check','api.mjs'],adversarial:[process.execPath,'-e','import("./api.mjs").then(m=>{if(m.value!==2)process.exit(1)})']};
      const result=checked.verifyStagedJob(job,stage,argv,{env:{}});
      note('both real check passes complete',result.status==='verified-stage'&&result.passes.length===2,JSON.stringify(result));
      const fail=checked.verifyStagedJob(job,stage,{...argv,adversarial:[process.execPath,'-e','process.exit(1)']},{env:{}});
      note('red adversarial check cannot claim verification',fail.status==='failed-stage');
      fs.writeFileSync(path.join(source,'api.mjs'),'Concurrent change');
      note('concurrent source changes stop verification',rejects(()=>checked.verifyStagedJob(job,stage,argv,{env:{}})));
      note('concurrent source changes stop later edits',rejects(()=>bounded.validateEdits(job,raw)));
    }finally{const resolved=fs.realpathSync(root);if(path.dirname(resolved)!==fs.realpathSync(os.tmpdir())||!path.basename(resolved).startsWith('gev-core-native-job-'))throw Error('unexpected cleanup path');fs.rmSync(resolved,{recursive:true,force:true});}
  });
}
