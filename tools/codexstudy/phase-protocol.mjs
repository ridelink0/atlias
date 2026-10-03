// Durable multi-turn workflow protocol. No provider, model or settings writes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {contextOverrides} from '../native-job/context-policy.mjs';
export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const id = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value);
export function phasesOf(phases) {
  if (!Array.isArray(phases) || phases.length < 2 || phases.length > 12) throw Error('need 2..12 full workflow phases');
  const seen = new Set();
  return phases.map(p => {
    if (!p || Object.getPrototypeOf(p) !== Object.prototype || Object.keys(p).some(k => !['id','prompt'].includes(k))
      || !id(p.id) || seen.has(p.id) || typeof p.prompt !== 'string' || !p.prompt.trim() || Buffer.byteLength(p.prompt) > 524288) throw Error('unique phase ids and complete bounded prompts required');
    seen.add(p.id);return {id:p.id,prompt:p.prompt,sha256:sha256(p.prompt)};
  });
}
export function phaseArgs({sessionId=null,prompt,model,workspace,policy=null}) {
  if (typeof prompt !== 'string' || !prompt.trim() || typeof model !== 'string' || !model || typeof workspace !== 'string' || !path.isAbsolute(workspace)) throw Error('full prompt, model and absolute workspace required');
  if (sessionId !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) throw Error('exact native UUID required; never resume --last');
  const prefix = ['--no-daemon','-a','never',...contextOverrides('codex',policy).argv,'-c','features.apps=false'];
  const shared = ['--json','--skip-git-repo-check','--ignore-rules','--dangerously-bypass-hook-trust','-m',model];
  // exec resume does not accept -C or -s. The owner supplies cwd and the same
  // explicit sandbox permission as the initial invocation.
  if(prompt==='-')throw Error('literal stdin sentinel needs a separately verified stdin transport');
  return sessionId === null ? [...prefix,'exec',...shared,'-s','danger-full-access','-C',workspace,'--',prompt]
    : [...prefix,'exec','resume',...shared,'--dangerously-bypass-approvals-and-sandbox','--',sessionId,prompt];
}
const keys = ['input_tokens','cached_input_tokens','output_tokens','reasoning_output_tokens','total_tokens'];
function tokens(t) {
  if (!t || keys.some(k => !Number.isSafeInteger(t[k]) || t[k] < 0) || t.cached_input_tokens > t.input_tokens
    || t.reasoning_output_tokens > t.output_tokens || t.total_tokens !== t.input_tokens+t.output_tokens) throw Error('valid cumulative native counters required');
  return Object.fromEntries(keys.map(k => [k,t[k]]));
}
export function phaseLedger(records,phases) {
  const spec = phasesOf(phases);let pending=null,sessionId=null,prior=null,peak=null,held=false;const completed=[];
  for (const r of records) {
    const p = spec[completed.length];
    if (!p || !r || r.phase !== p.id || r.promptSha256 !== p.sha256) throw Error('journal differs from protected phase order or prompt');
    if (r.type === 'started') {
      if (pending || held || r.sessionId !== sessionId) throw Error('duplicate attempt, held continuation or changed session');
      pending=r;
    } else if (r.type === 'finished') {
      if (!pending || typeof r.valid !== 'boolean' || typeof r.timedOut !== 'boolean' || !(r.exitCode === null || Number.isSafeInteger(r.exitCode))) throw Error('one terminal receipt per attempt required');
      if (r.sessionId !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.sessionId)) throw Error('invalid native identity');
      if (sessionId !== null && r.sessionId !== sessionId) held=true;
      if (r.cumulative !== null) {
        const next=tokens(r.cumulative);if (prior && keys.some(k => next[k] < prior[k])) throw Error('cumulative counters regressed; preserve journal and audit');
        prior=next;
      } else held=true;
      if (!(r.peak === null || Number.isSafeInteger(r.peak) && r.peak >= 0)) throw Error('invalid full native peak');
      if (r.peak === null) held=true;else peak=Math.max(peak ?? 0,r.peak);
      if (!r.valid || r.timedOut || r.exitCode !== 0 || r.sessionId === null) held=true;
      sessionId=r.sessionId;completed.push(r);pending=null;
    } else throw Error('unknown journal record');
  }
  return {completed,pending,sessionId,held:held || pending !== null,next:held || pending ? null : spec[completed.length] ?? null,
    cumulative:held || pending ? null : prior,fullNativePeak:held || pending ? null : peak};
}
function append(file,value) {
  const fd=fs.openSync(file,'a');try {fs.writeSync(fd,JSON.stringify(value)+'\n');fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
}
export async function runPhases({folder,phases,plan,launch,allowance}) {
  const spec=phasesOf(phases);
  if (!path.isAbsolute(folder) || !plan || typeof launch !== 'function' || typeof allowance !== 'function') throw Error('explicit owner, pinned plan, launcher and fresh allowance gate required');
  const serialized=JSON.stringify({protocol:'atlias-native-phases-v1',plan,phases:spec});
  fs.mkdirSync(folder,{recursive:true});
  const lock=path.join(folder,'OWNER.lock'),fd=fs.openSync(lock,'wx');
  try {
    fs.writeSync(fd,JSON.stringify({pid:process.pid,at:new Date().toISOString()}));fs.fsyncSync(fd);
    const pin=path.join(folder,'PLAN.json');
    if (fs.existsSync(pin)) {if (fs.readFileSync(pin,'utf8') !== serialized+'\n') throw Error('pinned workflow plan changed');}
    else fs.writeFileSync(pin,serialized+'\n',{flag:'wx'});
    const journal=path.join(folder,'phases.jsonl');
    const records=fs.existsSync(journal)?fs.readFileSync(journal,'utf8').split('\n').filter(Boolean).map(JSON.parse):[];
    let state=phaseLedger(records,phases);
    if (state.held) throw Error('unfinished or invalid native attempt held; never retry');
    while (state.next) {
      if (!await allowance()) return {...state,boundary:true};
      const phase=state.next,dir=path.join(folder,'phases',phase.id);fs.mkdirSync(dir,{recursive:true});
      fs.writeFileSync(path.join(dir,'input.txt'),phase.prompt,{flag:'wx'});
      const started={type:'started',phase:phase.id,promptSha256:phase.sha256,sessionId:state.sessionId,at:new Date().toISOString()};
      append(journal,started);records.push(started);
      // A thrown launcher leaves a durable pending attempt and all its files.
      // Its spend is unknown, not zero. An operator audits it; no automatic retry.
      const result=await launch({phase,dir,sessionId:state.sessionId});
      const finished={...result,type:'finished',phase:phase.id,promptSha256:phase.sha256,at:new Date().toISOString()};
      append(journal,finished);records.push(finished);state=phaseLedger(records,phases);
      if (state.held) return {...state,boundary:false};
    }
    return {...state,boundary:false};
  } finally {fs.closeSync(fd);fs.rmSync(lock);}
}
