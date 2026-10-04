// Protected owner-side grade, launched only after the native phase terminates.
import {workflowCorpus} from './workflow-corpus.mjs';
const [id,index,workspace,nonce]=process.argv.slice(2);
const task=workflowCorpus().find(t=>t.id===id),i=Number(index);
if(!task||!Number.isSafeInteger(i)||i<0||i>=task.phases.length||!workspace||!nonce)throw Error('exact protected phase grade required');
try {await task.grade(workspace,i);console.log(JSON.stringify({nonce,pass:true}));}
catch(error){console.log(JSON.stringify({nonce,pass:false,error:String(error?.message||error).slice(0,2000)}));process.exitCode=1;}
