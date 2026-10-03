// New authored three-phase work. References and grades remain outside solvers.
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {sha256} from './phase-protocol.mjs';
const replyFile='answer.json';
function factWorkflow(id,records,expectations) {
  const files=Object.fromEntries(records.map((body,i)=>[`sources/revision-${i+1}.json`,JSON.stringify(body,null,2)+'\n']));
  const phases=records.map((_,i)=>({id:'revision-'+(i+1),prompt:`Gev: this is phase ${i+1} of a source verification workflow. ${i===0?'Read the available source.':'Reconcile the new source with the earlier versions; do not treat an archive or superseded claim as current.'} Only sources/revision-${i+1}.json is authoritative now. Write answer.json with exactly {count,region,enabled,revision,support:{file,sha256}}. Preserve zero and false. Use null for facts explicitly unknown in the current source; do not fill them from training or an older revision. revision is the current source revision string, not a guessed number. support.file is its relative path and support.sha256 is the SHA-256 of its exact bytes. Run an actual check of your output. No source files may be edited.`,
    changes:i===0?{}:{[`sources/revision-${i+1}.json`]:files[`sources/revision-${i+1}.json`]},
    reference:{[replyFile]:JSON.stringify({...expectations[i],support:{file:`sources/revision-${i+1}.json`,sha256:sha256(files[`sources/revision-${i+1}.json`])}})+'\n'}}));
  return {id,family:'versioned-factuality',initialFiles:{'sources/revision-1.json':files['sources/revision-1.json']},phases,
    grade:async(ws,i)=>{for(let n=0;n<=i;n++)assert.deepEqual(fs.readFileSync(path.join(ws,`sources/revision-${n+1}.json`)),Buffer.from(files[`sources/revision-${n+1}.json`]));const actual=JSON.parse(fs.readFileSync(path.join(ws,replyFile),'utf8'));const expected=JSON.parse(phases[i].reference[replyFile]);assert.deepEqual(actual,expected);}};
}
function apiWorkflow(id,family,file,start,contracts,references,checks) {
  const phases=contracts.map((contract,i)=>({id:'phase-'+(i+1),prompt:`Gev: implement this complete phase ${i+1} contract in ${file}, retaining earlier behavior unless this contract explicitly changes it. ${contract} Use ordinary native tools to inspect, edit, create meaningful tests and run them. Do not claim unrun checks.`,changes:{},reference:{[file]:references[i]}}));
  return {id,family,initialFiles:{'package.json':'{"type":"module"}\n',[file]:start},phases,
    grade:async(ws,i)=>{assert.equal(fs.readFileSync(path.join(ws,'package.json'),'utf8'),'{"type":"module"}\n');const module=await import(pathToFileURL(path.join(ws,file)).href+'?graded='+randomUUID());for(let n=0;n<=i;n++)await checks[n](module,ws);}};
}
export function workflowCorpus() {
  const facts=(revision,count,region,enabled)=>({revision,count,region,enabled});
  return [
    factWorkflow('regional-provenance',[
      {revision:'draft-A',facts:{count:0,region:null,enabled:false},note:'region is unknown; zero count is observed'},
      {revision:'approved-B',facts:{count:7,region:'west',enabled:false},supersedes:'draft-A'},
      {revision:'retracted-C',facts:{count:null,region:null,enabled:false},supersedes:'approved-B',note:'Count and region retracted; do not retain the old values'}
    ],[facts('draft-A',0,null,false),facts('approved-B',7,'west',false),facts('retracted-C',null,null,false)]),
    factWorkflow('release-negation',[
      {revision:'proposal-4',facts:{count:12,region:'north',enabled:true},note:'only a proposal'},
      {revision:'decision-5',facts:{count:0,region:'north',enabled:false},note:'Decision declines release; proposed count is superseded'},
      {revision:'audit-6',facts:{count:0,region:null,enabled:false},note:'Region now unknown; release remains disabled'}
    ],[facts('proposal-4',12,'north',true),facts('decision-5',0,'north',false),facts('audit-6',0,null,false)]),
    apiWorkflow('revision-merge','editing-and-concurrent-data','src/merge.mjs','export const merge=()=>[];\n',[
      'Export merge(oldRows,newRows). Both are arrays of records with string id and nonnegative safe-integer revision. Return one record per id, choosing the strictly largest revision. Ties retain the first occurrence across oldRows followed by newRows. Keep order of first appearance and object identity; mutate neither input. Preserve all data including false, null, zero and empty strings. Throw TypeError for malformed arrays or records.',
      'Keep merge behavior. Also export byId(rows,id): return the first exact string-id match, including empty string and __proto__, or null when absent. Throw TypeError for a nonstring id. Do not use truthiness for lookup.',
      'Keep merge and byId. Also export active(rows): return records with enabled === true, in original order and with original identities. Never treat a truthy string as true.'
    ],[
      "export function merge(a,b){if(!Array.isArray(a)||!Array.isArray(b))throw new TypeError('arrays');const m=new Map();for(const r of [...a,...b]){if(!r||typeof r.id!=='string'||!Number.isSafeInteger(r.revision)||r.revision<0)throw new TypeError('record');if(!m.has(r.id)||m.get(r.id).revision<r.revision)m.set(r.id,r)}return [...m.values()]}\n",
      "export function merge(a,b){if(!Array.isArray(a)||!Array.isArray(b))throw new TypeError('arrays');const m=new Map();for(const r of [...a,...b]){if(!r||typeof r.id!=='string'||!Number.isSafeInteger(r.revision)||r.revision<0)throw new TypeError('record');if(!m.has(r.id)||m.get(r.id).revision<r.revision)m.set(r.id,r)}return [...m.values()]} export function byId(rs,id){if(typeof id!=='string')throw new TypeError('id');return rs.find(r=>r.id===id)??null}\n",
      "export function merge(a,b){if(!Array.isArray(a)||!Array.isArray(b))throw new TypeError('arrays');const m=new Map();for(const r of [...a,...b]){if(!r||typeof r.id!=='string'||!Number.isSafeInteger(r.revision)||r.revision<0)throw new TypeError('record');if(!m.has(r.id)||m.get(r.id).revision<r.revision)m.set(r.id,r)}return [...m.values()]} export function byId(rs,id){if(typeof id!=='string')throw new TypeError('id');return rs.find(r=>r.id===id)??null} export const active=rs=>rs.filter(r=>r.enabled===true);\n"
    ],[checkMerge,m=>{checkMerge(m);const rows=[{id:'',x:0},{id:'__proto__',x:null}];assert.equal(m.byId(rows,''),rows[0]);assert.equal(m.byId(rows,'__proto__'),rows[1]);assert.equal(m.byId(rows,'absent'),null);assert.throws(()=>m.byId(rows,0),TypeError);},m=>{checkMerge(m);assert.equal(m.byId([{id:''}],'').id,'');const rs=[{enabled:true},{enabled:'true'},{enabled:false},{enabled:1}];assert.deepEqual(m.active(rs),[rs[0]]);assert.equal(m.active(rs)[0],rs[0]);}]),
    apiWorkflow('async-observations','async-errors-and-capability','src/collect.mjs','export async function collect(xs,fn){return Promise.all(xs.map(fn))}\n',[
      'Export async collect(values,fn). Invoke and await fn(value,index) strictly sequentially, preserving returned values and input order without mutating values. Stop immediately on rejection, preserving the exact error object and starting no later items.',
      'Keep collect behavior and add optional third parameter signal. Before any work and before each item, reject with an Error named AbortError when aborted. Check again after each awaited result, including the last result. Cancellation must not return partial output.',
      'Keep collect behavior, including cancellation checks. Also export async settled(values,fn), sequentially. Return records {status:"fulfilled",value} or {status:"rejected",reason} for each item; reason must be the actual original error object. Do not confuse a fulfilled null with rejection.'
    ],[
      'export async function collect(xs,fn){const out=[];for(let i=0;i<xs.length;i++)out.push(await fn(xs[i],i));return out}\n',
      "export async function collect(xs,fn,signal){const check=()=>{if(signal?.aborted){const e=new Error('aborted');e.name='AbortError';throw e}};check();const out=[];for(let i=0;i<xs.length;i++){check();out.push(await fn(xs[i],i));check()}return out}\n",
      "export async function collect(xs,fn,signal){const check=()=>{if(signal?.aborted){const e=new Error('aborted');e.name='AbortError';throw e}};check();const out=[];for(let i=0;i<xs.length;i++){check();out.push(await fn(xs[i],i));check()}return out} export async function settled(xs,fn){const out=[];for(let i=0;i<xs.length;i++){try{out.push({status:'fulfilled',value:await fn(xs[i],i)})}catch(reason){out.push({status:'rejected',reason})}}return out}\n"
    ],[checkCollect,async m=>{await checkCollect(m);await checkAbort(m);},async m=>{await checkCollect(m);await checkAbort(m);const e=Error('original');assert.deepEqual(await m.settled([null,2],async x=>{if(x===2)throw e;return x}),[{status:'fulfilled',value:null},{status:'rejected',reason:e}]);}]),
    apiWorkflow('receipt-verification','process-status-factuality','src/status.mjs','export const status=()=>"passed";\n',[
      'Export status(receipt). Accept only objects with completed:boolean, exitCode:integer|null, and timedOut:boolean. If not completed return "pending". A completed timed-out receipt returns "timeout". A completed exitCode null returns "unknown". A completed exitCode 0 returns "passed"; other integer codes return "failed". Reject malformed fields with TypeError; stdout saying passed never changes the result.',
      'Keep status. Also export summarize(receipts), returning {passed,failed,pending,timeout,unknown} numeric counts, all categories present including zero; use status for each receipt.',
      'Keep status and summarize. Also export allPassed(receipts): true only for a nonempty array whose every receipt status is passed. Empty arrays and pending/unknown receipts must never imply verification succeeded.'
    ],[
      statusSource,
      statusSource+"export function summarize(rs){const out={passed:0,failed:0,pending:0,timeout:0,unknown:0};for(const r of rs)out[status(r)]++;return out}\n",
      statusSource+"export function summarize(rs){const out={passed:0,failed:0,pending:0,timeout:0,unknown:0};for(const r of rs)out[status(r)]++;return out} export const allPassed=rs=>rs.length>0&&rs.every(r=>status(r)==='passed');\n"
    ],[checkStatus,m=>{checkStatus(m);assert.deepEqual(m.summarize([]),{passed:0,failed:0,pending:0,timeout:0,unknown:0});assert.equal(m.summarize([{completed:true,exitCode:0,timedOut:false}]).passed,1);},m=>{checkStatus(m);assert.equal(m.summarize([]).unknown,0);assert.equal(m.allPassed([]),false);assert.equal(m.allPassed([{completed:true,exitCode:null,timedOut:false}]),false);assert.equal(m.allPassed([{completed:true,exitCode:0,timedOut:false}]),true);}]),
    apiWorkflow('unicode-boundaries','encoding-and-source-preservation','src/lines.mjs','export const lines=text=>text.trim().split("\\n");\n',[
      'Export lines(text). Require a string. Remove one leading UTF-8 BOM code point if present. Split on CRLF or LF; ignore whitespace-only lines. Preserve each nonblank line byte-for-byte as a string, including its surrounding spaces and other Unicode. Empty input returns [].',
      'Keep lines. Also export parse(text), parsing every nonblank line as JSON; return all values including null, false, zero and empty string. Invalid JSON must throw; never return a partial array.',
      'Keep lines and parse. Also export sum(text): each parsed value must be an object with a safe-integer value property. Return {sum,count}, including empty {sum:0,count:0}. Reject bad records or unsafe sums with TypeError. Do not coerce strings into numbers.'
    ],[
      "export function lines(t){if(typeof t!=='string')throw new TypeError('text');return t.replace(/^\\uFEFF/,'').split(/\\r?\\n/).filter(x=>x.trim())}\n",
      "export function lines(t){if(typeof t!=='string')throw new TypeError('text');return t.replace(/^\\uFEFF/,'').split(/\\r?\\n/).filter(x=>x.trim())} export const parse=t=>lines(t).map(x=>JSON.parse(x));\n",
      "export function lines(t){if(typeof t!=='string')throw new TypeError('text');return t.replace(/^\\uFEFF/,'').split(/\\r?\\n/).filter(x=>x.trim())} export const parse=t=>lines(t).map(x=>JSON.parse(x));export function sum(t){let sum=0,count=0;for(const r of parse(t)){if(!r||Array.isArray(r)||!Number.isSafeInteger(r.value))throw new TypeError('record');sum+=r.value;if(!Number.isSafeInteger(sum))throw new TypeError('sum');count++}return {sum,count}}\n"
    ],[checkLines,m=>{checkLines(m);assert.deepEqual(m.parse('0\nfalse\nnull\n""\n'),[0,false,null,'']);assert.throws(()=>m.parse('0\nbad'));},m=>{checkLines(m);assert.deepEqual(m.parse('null'),[null]);assert.deepEqual(m.sum(''),{sum:0,count:0});assert.deepEqual(m.sum('{"value":0}\r\n{"value":2}'),{sum:2,count:2});for(const t of ['null','{"value":"2"}','{"value":9007199254740991}\n{"value":1}'])assert.throws(()=>m.sum(t),TypeError);}]),
  ];
}
const statusSource="export function status(r){if(!r||typeof r.completed!=='boolean'||typeof r.timedOut!=='boolean'||!(r.exitCode===null||Number.isInteger(r.exitCode)))throw new TypeError('receipt');return !r.completed?'pending':r.timedOut?'timeout':r.exitCode===null?'unknown':r.exitCode===0?'passed':'failed'}\n";
function checkMerge(m){const a={id:'',revision:0,value:null},b={id:'__proto__',revision:2,value:false},c={id:'',revision:3,value:0},tie={...b,value:'must lose'};const xs=[a,b],ys=[c,tie],before=JSON.stringify([xs,ys]);assert.deepEqual(m.merge(xs,ys),[c,b]);assert.equal(m.merge(xs,ys)[0],c);assert.equal(JSON.stringify([xs,ys]),before);for(const pair of [[null,[]],[[],[{id:'x',revision:-1}]],[[],[{id:2,revision:0}]]])assert.throws(()=>m.merge(...pair),TypeError);}
async function checkCollect(m){let running=0;const xs=[0,null,false],seen=[];assert.deepEqual(await m.collect(xs,async(x,i)=>{assert.equal(running++,0);await Promise.resolve();seen.push(i);running--;return x}),xs);assert.deepEqual(seen,[0,1,2]);const e=Error('original'),calls=[];await assert.rejects(m.collect([1,2,3],async x=>{calls.push(x);if(x===2)throw e;return x}),x=>x===e);assert.deepEqual(calls,[1,2]);}
async function checkAbort(m){const c=new AbortController();c.abort();let calls=0;await assert.rejects(m.collect([1],()=>calls++,c.signal),{name:'AbortError'});assert.equal(calls,0);const d=new AbortController();await assert.rejects(m.collect([1],async()=>{d.abort();return 1},d.signal),{name:'AbortError'});}
function checkStatus(m){for(const [r,v] of [[{completed:false,exitCode:null,timedOut:false},'pending'],[{completed:true,exitCode:null,timedOut:false},'unknown'],[{completed:true,exitCode:0,timedOut:true},'timeout'],[{completed:true,exitCode:1,timedOut:false,stdout:'passed'},'failed'],[{completed:true,exitCode:0,timedOut:false},'passed']])assert.equal(m.status(r),v);for(const bad of [null,{}, {completed:true,exitCode:'0',timedOut:false}])assert.throws(()=>m.status(bad),TypeError);}
function checkLines(m){assert.deepEqual(m.lines('\uFEFF  Alpha\r\n\r\n\u00e9\n'),['  Alpha','\u00e9']);assert.deepEqual(m.lines(''),[]);assert.throws(()=>m.lines(null),TypeError);}
export function solverWorkflow(task) {
  return {id:task.id,family:task.family,initialFiles:task.initialFiles,phases:task.phases.map(({id,prompt,changes})=>({id,prompt,changes}))};
}
