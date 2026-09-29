// Authored repair workloads, with small and large context variants. Reference
// implementations are grader fixtures, never written into a model workspace.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const cases = [
  ['money', 'Sum decimal prices in cents without floating-point drift. Accept optional minus signs and one or two decimal places; reject malformed prices with TypeError.',
    'return prices.reduce((s,p)=>s+Math.floor(Number(p)*100),0);',
    `return prices.reduce((s,p)=>{if(typeof p!=='string'||!/^[-]?\\d+(?:\\.\\d{1,2})?$/.test(p))throw new TypeError('price');const neg=p.startsWith('-');const [a,b='']=p.replace(/^-/,'').split('.');return s+(neg?-1:1)*(Number(a)*100+Number(b.padEnd(2,'0')));},0);`,
    `assert.equal(f(['0.29','1.01','-0.05']),125);assert.equal(f(['1','2.5']),350);assert.equal(f([]),0);for(const x of ['NaN','1e2','1.999','',null])assert.throws(()=>f([x]),TypeError);`],
  ['versions', 'Sort dotted numeric versions numerically, preserving input order for equal versions (missing trailing components count as zero). Never mutate the input.',
    'return values.sort();',
    `return values.map((v,i)=>({v,i})).sort((a,b)=>{const x=a.v.split('.').map(Number),y=b.v.split('.').map(Number);for(let j=0;j<Math.max(x.length,y.length);j++){const d=(x[j]||0)-(y[j]||0);if(d)return d;}return a.i-b.i;}).map(x=>x.v);`,
    `const a=['1.10','1.2','1.2.0','0.9','1.2.0.1'];assert.deepEqual(f(a),['0.9','1.2','1.2.0','1.2.0.1','1.10']);assert.deepEqual(a,['1.10','1.2','1.2.0','0.9','1.2.0.1']);assert.deepEqual(f([]),[]);`],
  ['intervals', 'Merge overlapping or touching numeric closed intervals, sorting by start. Reject reversed ranges. Keep inputs unchanged.',
    'return ranges;',
    `const a=ranges.map(([s,e])=>{if(s>e)throw new RangeError('range');return [s,e];}).sort((a,b)=>a[0]-b[0]);const out=[];for(const r of a){const last=out.at(-1);if(last&&r[0]<=last[1])last[1]=Math.max(last[1],r[1]);else out.push(r);}return out;`,
    `const a=[[5,8],[1,3],[3,6],[10,10]];assert.deepEqual(f(a),[[1,8],[10,10]]);assert.deepEqual(a,[[5,8],[1,3],[3,6],[10,10]]);assert.deepEqual(f([]),[]);assert.throws(()=>f([[2,1]]),RangeError);`],
  ['unicode', 'Count Unicode code points after NFC normalization (not UTF-16 units or grapheme clusters). Do not remove whitespace.',
    'return value.length;',
    `return [...value.normalize('NFC')].length;`,
    `assert.equal(f('A'+String.fromCodePoint(0x1f600)+'B'),3);assert.equal(f('e'+String.fromCharCode(0x301)),1);assert.equal(f(' a '),3);assert.equal(f(''),0);assert.equal(f(String.fromCodePoint(0x1f468,0x200d,0x1f469)),3);`],
  ['paths', 'Resolve a slash-separated relative URL path within a virtual root. Decode percent escapes once before splitting; reject absolute paths, backslashes, NUL, and any traversal above the root. Return slash-joined normalized segments.',
    `return value.replaceAll('../','');`,
    `const s=decodeURIComponent(value);if(s.startsWith('/')||s.includes('\\\\')||s.includes('\\0'))throw new Error('path');const a=[];for(const p of s.split('/')){if(!p||p==='.')continue;if(p==='..'){if(!a.length)throw new Error('escape');a.pop();}else a.push(p);}return a.join('/');`,
    `assert.equal(f('a/./b/../c'),'a/c');assert.equal(f(''),'');for(const x of ['../x','a/../../x','%2e%2e/x','/a','a%5cb','x%00y'])assert.throws(()=>f(x));assert.equal(f('a%2fb'),'a/b');`],
  ['merge', 'Apply each config layer in order. Nested plain objects merge recursively; arrays replace and are copied. Return a new object without mutating layers. Reject dangerous keys __proto__, constructor, prototype at every level.',
    'return Object.assign({},...layers);',
    `const clone=v=>Array.isArray(v)?v.map(clone):v&&typeof v==='object'?merge({},v):v;const merge=(a,b)=>{for(const k of Object.keys(b)){if(['__proto__','constructor','prototype'].includes(k))throw new Error('key');const v=b[k];if(v&&typeof v==='object'&&!Array.isArray(v))a[k]=merge(a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k])?a[k]:{},v);else a[k]=clone(v);}return a;};return layers.reduce(merge,{});`,
    `const a={db:{host:'x',ports:[1]},flag:true},b={db:{ports:[2],tls:true}};const r=f([a,b]);assert.deepEqual(r,{db:{host:'x',ports:[2],tls:true},flag:true});r.db.ports.push(3);assert.deepEqual(a.db.ports,[1]);assert.deepEqual(b.db.ports,[2]);const nested={items:[[1],{arr:[2]}]},copy=f([nested]);assert.deepEqual(copy,nested);copy.items[0].push(9);assert.deepEqual(nested.items[0],[1]);assert.throws(()=>f([JSON.parse('{"__proto__":{"evil":1}}')]));assert.throws(()=>f([{x:{constructor:1}}]));assert.throws(()=>f([{items:[{prototype:1}]}]));`],
  ['ttl', 'Given records {key,value,expiresAt} and a supplied now, return last unexpired value per key as an array of [key,value] entries in first-key-seen order. expiresAt null means never expires; expiry at now is expired. Do not use wall-clock time.',
    `return records.filter(x=>!x.expiresAt||x.expiresAt>=now).map(x=>[x.key,x.value]);`,
    `const order=[...new Set(records.map(x=>x.key))],m=new Map();for(const r of records)if(r.expiresAt===null||r.expiresAt>now)m.set(r.key,r.value);return order.filter(k=>m.has(k)).map(k=>[k,m.get(k)]);`,
    `assert.deepEqual(f([{key:'a',value:1,expiresAt:10},{key:'b',value:0,expiresAt:null},{key:'a',value:2,expiresAt:11},{key:'c',value:4,expiresAt:0}],10),[['a',2],['b',0]]);assert.deepEqual(f([],0),[]);assert.deepEqual(f([{key:'a',value:0,expiresAt:1}],1),[]);`],
  ['csv', 'Parse one CSV record: commas separate fields, quoted fields can contain commas and doubled quotes. Preserve empty fields and whitespace. Reject unclosed quotes and non-comma text after a closing quote.',
    `return value.split(',');`,
    `const out=[];let text='',quoted=false,closed=false,start=true;for(let i=0;i<value.length;i++){const c=value[i];if(quoted){if(c==='"'){if(value[i+1]==='"'){text+='"';i++;}else{quoted=false;closed=true;}}else text+=c;}else if(c===','){out.push(text);text='';start=true;closed=false;}else if(closed)throw new Error('csv');else if(c==='"'&&start){quoted=true;start=false;}else{if(c==='"')throw new Error('quote');text+=c;start=false;}}if(quoted)throw new Error('csv');out.push(text);return out;`,
    `assert.deepEqual(f('a,"b,c","d""e",'),['a','b,c','d"e','']);assert.deepEqual(f(''),['']);assert.deepEqual(f(' a , b '),[' a ',' b ']);assert.throws(()=>f('"abc'));assert.throws(()=>f('"a"x'));`],
  ['pagination', 'Paginate an array after a unique string cursor. null cursor starts at zero; unknown cursor throws RangeError. A zero limit is valid. Return {items,next}, where next is the last emitted id only when more items remain. Do not mutate.',
    `const start=cursor?rows.findIndex(x=>x.id===cursor):0;const items=rows.slice(start,start+(limit||10));return {items,next:items.at(-1)?.id||null};`,
    `const i=cursor===null?-1:rows.findIndex(x=>x.id===cursor);if(cursor!==null&&i<0)throw new RangeError('cursor');const items=rows.slice(i+1,i+1+limit);return {items,next:items.length&&i+1+items.length<rows.length?items.at(-1).id:null};`,
    `const a=[{id:'a'},{id:'b'},{id:'c'}];assert.deepEqual(f(a,null,2),{items:a.slice(0,2),next:'b'});assert.deepEqual(f(a,'b',2),{items:[a[2]],next:null});assert.deepEqual(f(a,null,0),{items:[],next:null});assert.throws(()=>f(a,'x',2),RangeError);assert.deepEqual(f([],null,2),{items:[],next:null});`],
  ['topology', 'Return a deterministic topological ordering of graph {node:[dependencies]}. At each step pick the lexically smallest currently ready node. Reject missing dependencies and cycles. Do not mutate graph.',
    'return Object.keys(graph).sort();',
    `const todo=new Set(Object.keys(graph)),done=new Set(),out=[];for(const deps of Object.values(graph))for(const d of deps)if(!todo.has(d))throw new Error('missing');while(todo.size){const ready=[...todo].filter(k=>graph[k].every(d=>done.has(d))).sort();if(!ready.length)throw new Error('cycle');const k=ready[0];todo.delete(k);done.add(k);out.push(k);}return out;`,
    `assert.deepEqual(f({a:['z'],b:[],z:[]}),['b','z','a']);assert.deepEqual(f({}),[]);assert.throws(()=>f({a:['b'],b:['a']}));assert.throws(()=>f({a:['missing']}));assert.deepEqual(f({c:['a','a'],a:[],b:[]}),['a','b','c']);`],
  ['dedupe', 'Deduplicate events by tenant and id, keeping the last value but preserving each composite key first-occurrence order. Keys can include colons; tenants must remain isolated. Do not mutate events.',
    `return [...new Map(events.map(x=>[x.id,x])).values()];`,
    `const m=new Map();for(const x of events)m.set(JSON.stringify([x.tenant,x.id]),x);return [...m.values()];`,
    `const a=[{tenant:'a',id:'b:c',v:1},{tenant:'a:b',id:'c',v:2},{tenant:'a',id:'b:c',v:3},{tenant:'z',id:'c',v:4}];assert.deepEqual(f(a),[a[2],a[1],a[3]]);assert.deepEqual(f([]),[]);assert.equal(a.length,4);`],
  ['query', 'Decode query parameters into a Map of key to array of values. Split each pair on the first equals only; plus means space; missing equals means empty. Ignore empty pairs, preserve duplicate order, and reject invalid escapes.',
    `return new Map(value.split('&').map(x=>x.split('=')));`,
    `const m=new Map(),decode=x=>decodeURIComponent(x.replaceAll('+',' '));for(const p of value.replace(/^\\?/,'').split('&')){if(!p)continue;const i=p.indexOf('='),k=decode(i<0?p:p.slice(0,i)),v=decode(i<0?'':p.slice(i+1));if(!m.has(k))m.set(k,[]);m.get(k).push(v);}return m;`,
    `assert.deepEqual([...f('?a=1&a=2&x=a%3Db+c&flag&&')],[['a',['1','2']],['x',['a=b c']],['flag',['']]]);assert.equal(f('').size,0);assert.throws(()=>f('x=%zz'));assert.deepEqual([...f('__proto__=x')],[['__proto__',['x']]]);`],
];
export function tasks() {
  return cases.flatMap(([family,spec,bug,fix,checks])=>[8,64].map(n=>{
    const id=`context-${family}-${n}`, args={money:'prices',versions:'values',intervals:'ranges',unicode:'value',paths:'value',merge:'layers',ttl:'records,now',csv:'value',pagination:'rows,cursor,limit',topology:'graph',dedupe:'events',query:'value'}[family];
    const files={'package.json':JSON.stringify({type:'module',scripts:{test:'node smoke.mjs'}}),'src/api.mjs':"export { repair } from './policy.mjs';\n",'src/policy.mjs':`export function repair(${args}) { ${bug} }\n`,'smoke.mjs':"import {repair} from './src/api.mjs'; if(typeof repair!=='function')throw new Error('API'); console.log('API loads');\n",'docs/contract.md':spec+'\n'};
    for(let i=0;i<n;i++)files[`archive/module-${String(i).padStart(3,'0')}.md`]=`Archived subsystem ${i}. These historical notes are not the active API contract.\n`+Array.from({length:40},(_,j)=>`Entry ${j}: previous release migration for subsystem ${i}; preserved for context navigation.\n`).join('');
    const grader=`import assert from 'node:assert/strict'; import {repair as f} from './src/api.mjs';\n${checks}\nconsole.log('hidden regressions passed');\n`;
    return {task:{id,family,kind:'multifile-context',prompt:`Fix the active API exported from src/api.mjs to satisfy docs/contract.md. Find and repair the implementation, preserve the API, and verify it. Archived notes are historical. Do not change the contract, API wrapper, package scripts, or smoke.mjs.`,files,hidden:{'grade.mjs':grader},protect:['src/api.mjs','docs/contract.md','package.json','smoke.mjs'],check:['node','grade.mjs'],timeoutMs:15000},reference:{'src/policy.mjs':`export function repair(${args}) { ${fix} }\n`}};
  }));
}
export function writeCorpus(root) {
  const dir=path.join(root,'evals','context-heldout'); fs.mkdirSync(dir,{recursive:true});
  const list=[];for(const {task} of tasks()){const rel=`evals/context-heldout/${task.id}.json`,body=JSON.stringify(task,null,2)+'\n';fs.writeFileSync(path.join(root,rel),body);list.push({id:task.id,file:rel,source:'authored-context',sha256:crypto.createHash('sha256').update(body).digest('hex')});}
  const manifest={seed:'gev-context-2026-09-29',tasks:list};fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify({tasks:writeCorpus(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')).tasks.length}));
