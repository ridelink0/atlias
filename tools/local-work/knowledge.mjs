import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash} from './migrate.mjs';

export function manifest(root) {
  const file=path.join(root,'MANIFEST.json'),bytes=fs.readFileSync(file);
  if(hash(bytes)!==fs.readFileSync(path.join(root,'MANIFEST.sha256'),'utf8').trim()) throw Error('knowledge manifest changed');
  return JSON.parse(bytes);
}
export function search(root,query,limit=12) {
  if(!query?.trim()) throw Error('a nonempty query is required');
  const terms=query.toLowerCase().split(/\s+/).filter(Boolean),m=manifest(root);
  const file=path.join(root,'SEARCH.jsonl');
  if(fs.existsSync(file)&&fs.existsSync(path.join(root,'SEARCH-RECEIPT.json'))){
    const bytes=fs.readFileSync(file),receipt=JSON.parse(fs.readFileSync(path.join(root,'SEARCH-RECEIPT.json')));
    if(hash(bytes)!==receipt.indexHash||hash(fs.readFileSync(path.join(root,'MANIFEST.json')))!==receipt.manifestHash)throw Error('search index changed');
    const hits=bytes.toString('utf8').trim().split('\n').filter(Boolean).map(JSON.parse).map(r=>({...r,score:terms.reduce((n,t)=>n+((r.source+' '+r.text).toLowerCase().includes(t)?1:0),0)})).filter(r=>r.score===terms.length&&!inactive(r.source,query)).sort((a,b)=>priority(b,terms)-priority(a,terms)||a.source.localeCompare(b.source)||a.offset-b.offset).slice(0,Math.max(1,Math.min(50,limit)));
    if(hits.length)return hits.map(({text,...r})=>({...r,excerpt:text.slice(0,700)}));
  }
  return m.files.map((r,id)=>({id,category:r.category,source:r.source,copy:r.copy,
    score:terms.reduce((n,t)=>n+(r.source.toLowerCase().includes(t)?1:0),0)}))
    .filter(r=>r.score&&!inactive(r.source,query)).sort((a,b)=>b.score-a.score||priority(b,terms)-priority(a,terms)||a.source.localeCompare(b.source)).slice(0,Math.max(1,Math.min(50,limit)));
}
export function inactive(source,query){return /[\\/]\.trash[\\/]/i.test(source)&&!query.toLowerCase().includes('trash');}
export function priority(row,terms){return terms.reduce((n,t)=>n+(row.source.toLowerCase().includes(t)?10:0),0)+(/research|atlias-docs|reference-gray|reference-claude/i.test(row.category||'')?5:0);}
export function read(root,id,offset=1,limit=100) {
  if(!Number.isSafeInteger(id)||id<0)throw Error('id must be a nonnegative safe integer');
  if(!Number.isSafeInteger(offset)||offset<1)throw Error('offset must be a positive safe integer');
  if(!Number.isSafeInteger(limit)||limit<1)throw Error('limit must be a positive safe integer');
  const m=manifest(root),r=m.files[id];
  if(!r)throw Error('unknown knowledge file id');
  const p=path.resolve(r.copy),base=path.resolve(root)+path.sep;
  const real=fs.realpathSync(p),realBase=fs.realpathSync(root)+path.sep;
  if(!p.startsWith(base)||!real.startsWith(realBase))throw Error('knowledge path escapes snapshot');
  const bytes=fs.readFileSync(p);if(hash(bytes)!==r.sha256)throw Error('knowledge file changed');
  if(bytes.includes(0))throw Error('binary file; use its original native tool');
  const lines=bytes.length?bytes.toString('utf8').split(/\r?\n/):[];
  const selected=lines.slice(offset-1,offset-1+Math.min(200,limit));
  return {source:r.source,sha256:r.sha256,lines:lines.length,offset,
    returnedLineCount:selected.length,endLine:selected.length?offset+selected.length-1:null,
    complete:offset===1&&selected.length===lines.length,
    text:selected.map((s,i)=>`${offset+i}: ${s}`).join('\n')};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [root,action,...a]=process.argv.slice(2);
  console.log(JSON.stringify(action==='read'?read(root,Number(a[0]),a[1]===undefined?1:Number(a[1]),a[2]===undefined?100:Number(a[2])):search(root,a.join(' ')),null,2));
}
