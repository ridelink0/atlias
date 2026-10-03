import fs from 'node:fs';import path from 'node:path';import readline from 'node:readline';import {fileURLToPath} from 'node:url';
import {manifest} from './knowledge.mjs';import {hash} from './migrate.mjs';

export function userText(row) {
 if(row.type==='event_msg'&&row.payload?.type==='user_message')return String(row.payload.message||'');
 const message=row.type==='response_item'?row.payload:row.message;
 if(message?.role==='user'||row.type==='user'){
  const c=message?.content;if(typeof c==='string')return c;
  if(Array.isArray(c))return c.filter(x=>['text','input_text'].includes(x.type)).map(x=>x.text||'').join('\n');
 }
 return '';
}
export async function build(root) {
 const m=manifest(root),out=path.join(root,'SEARCH.jsonl');if(fs.existsSync(out))throw Error('search index already frozen');
 const stream=fs.createWriteStream(out,{flags:'wx'});let docs=0,prompts=0;
 async function emit(row){if(!stream.write(JSON.stringify(row)+'\n'))await new Promise(resolve=>stream.once('drain',resolve));}
 for(let id=0;id<m.files.length;id++){
  const f=m.files[id];
  if(/\.jsonl$/i.test(f.copy)&&/sessions/.test(f.category)){
   const lines=readline.createInterface({input:fs.createReadStream(f.copy),crlfDelay:Infinity});let line=0,previous='';
   for await(const text of lines){line++;let row;try{row=JSON.parse(text);}catch{continue;}const message=userText(row);if(!message.trim())continue;
    const digest=hash(message);if(digest===previous)continue;previous=digest;
    // Full original text stays in the byte-verified snapshot at this exact line.
    await emit({id,offset:line,category:f.category,source:f.source,text:message.slice(0,5000),contentHash:digest,truncated:message.length>5000});prompts++;
   }
  } else if(/\.md$/i.test(f.copy)&&f.bytes<256000){const bytes=fs.readFileSync(f.copy);await emit({id,offset:1,category:f.category,source:f.source,text:bytes.toString('utf8').slice(0,5000),truncated:bytes.length>5000});docs++;}
 }
 await new Promise((resolve,reject)=>{stream.on('error',reject);stream.end(resolve);});
 const receipt={manifestHash:hash(fs.readFileSync(path.join(root,'MANIFEST.json'))),indexHash:hash(fs.readFileSync(out)),documents:docs,userPrompts:prompts,at:new Date().toISOString()};
 fs.writeFileSync(path.join(root,'SEARCH-RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));return receipt;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await build(path.resolve(process.argv[2]));
