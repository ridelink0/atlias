import * as bounded from '../lib/native-job.mjs';
import * as checked from '../lib/native-job-check.mjs';
import os from 'node:os';
export default function register({suite,check,fs,path}) {
  suite('bounded native jobs', 'preserve source and verify staged replacements',()=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'gev-core-native-job-'));
    const source=path.join(root,'source');fs.mkdirSync(source);fs.writeFileSync(path.join(source,'api.mjs'),'export const value=1;');
    const note=(name,condition,happened='')=>check(name,condition,{happened,why:'Bounded jobs must preserve source, reject unauthorized edits and verify real staged behavior.',fix:'Repair the bounded job without weakening path, source or check requirements.'});
    const rejects=fn=>{try{fn();return false;}catch{return true;}};
    try{
      const instructions=['The user is Gev. Start replies with Okay Gev. No emojis.'];
      const job=bounded.prepareJob({root:source,task:'Change value to2.',instructions,readPaths:['api.mjs'],writePaths:['api.mjs']});
      note('complete user rules are preserved',JSON.stringify(job.packet.instructions)===JSON.stringify(instructions));
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
