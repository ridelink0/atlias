import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {workflowCorpus,solverWorkflow} from './workflow-corpus.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'Gev-heldout-workflows-'));let positive=0,negative=0;
const write=(ws,files)=>{for(const [name,text] of Object.entries(files)){const p=path.join(ws,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text);}};
try {
  const tasks=workflowCorpus();assert.equal(new Set(tasks.map(t=>t.id)).size,6);
  for(const task of tasks){const ws=path.join(root,task.id);fs.mkdirSync(ws);write(ws,task.initialFiles);
    const publicTask=solverWorkflow(task);assert(!JSON.stringify(publicTask).includes('reference'));assert(!('grade' in publicTask));
    for(let i=0;i<3;i++){const phase=task.phases[i];write(ws,phase.changes);write(ws,phase.reference);await task.grade(ws,i);positive++;
      const file=Object.keys(phase.reference)[0],correct=fs.readFileSync(path.join(ws,file));
      if(file==='answer.json'){const body=JSON.parse(correct);body.enabled=!body.enabled;fs.writeFileSync(path.join(ws,file),JSON.stringify(body));}
      else fs.writeFileSync(path.join(ws,file),'export const broken=true;\n');
      await assert.rejects(task.grade(ws,i));negative++;fs.writeFileSync(path.join(ws,file),correct);
      if(file==='answer.json'){
        for(const field of ['count','region','revision','support']){const body=JSON.parse(correct);body[field]=field==='support'?{file:'archive.json',sha256:'invented'}:'invented';fs.writeFileSync(path.join(ws,file),JSON.stringify(body));await assert.rejects(task.grade(ws,i));negative++;}fs.writeFileSync(path.join(ws,file),correct);
        const source=path.join(ws,'sources/revision-'+(i+1)+'.json'),bytes=fs.readFileSync(source);fs.writeFileSync(source,'{}');await assert.rejects(task.grade(ws,i));negative++;fs.writeFileSync(source,bytes);
      }else{
        const pkg=path.join(ws,'package.json');fs.writeFileSync(pkg,'{}');await assert.rejects(task.grade(ws,i));negative++;fs.writeFileSync(pkg,'{"type":"module"}\n');
      }
    }
  }
} finally {fs.rmSync(root,{recursive:true,force:true});}
console.log(`${positive} positive and ${negative} negative Gev held-out phase grades passed; 0 model calls.`);
