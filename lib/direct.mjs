// NEXTGEN-5 row 6: the direct arm. One prompt holding the task and its files,
// the whole of each changed file back in the reply, the task's own check run
// when the workspace can run it, and at most one repair with that check's
// output. No tools, no loop. It exists to answer one question: is atlias's tool
// loop what holds a 7B to 51 of 162 HumanEvalFix and 8 of 88 CanItEdit tasks,
// when the same model family is published at 73.8 and 48.1 single-shot?
// `atlias eval --direct` runs it; the grading after it is the loop's grading.
import fs from 'node:fs';
import path from 'node:path';
import { cacheReading } from './loop.mjs';

export const DIRECT_SYSTEM = [
  'You are a careful programmer. You are given a task and the files it concerns.',
  'Answer with the complete new content of every file you change: for each one, a line "### <file name>" and then one fenced code block holding the whole file.',
  'Send whole files, never a diff or a fragment, and do not send files you did not change.',
].join('\n');

// Which files the model may change: every file the task ships that it does not
// protect. Hidden grader files are not in task.files and never reach the prompt.
export function editableFiles(task) {
  const protect = new Set(task.protect || []);
  return Object.keys(task.files || {}).filter((f) => !protect.has(f));
}

// Whether the task's check can run before grading: not when the script it runs
// is a hidden grader file (CanItEdit's), which reaches the workspace only after
// the model has stopped.
export function visibleCheck(task) {
  const argv = Array.isArray(task.check) ? task.check : String(task.check || '').split(/\s+/).filter(Boolean);
  if (!argv.length) return null;
  const hidden = new Set(Object.keys(task.hidden || {}));
  if (argv.slice(1).some((a) => hidden.has(a) || hidden.has(path.basename(a)))) return null;
  return argv.map((a, i) => (i === 0 ? path.basename(a).replace(/\.exe$/i, '') : a)).join(' ');
}

const langOf = (f) => ({ py: 'python', js: 'javascript', ts: 'typescript', rs: 'rust', go: 'go', java: 'java', cpp: 'cpp', c: 'c', rb: 'ruby' }[path.extname(f).slice(1)] || '');

export function directPrompt(task, editable = editableFiles(task), check = visibleCheck(task)) {
  const parts = [String(task.prompt || '').trim(), '', 'The files:'];
  for (const [name, body] of Object.entries(task.files || {})) {
    parts.push('', `### ${name}`, '```' + langOf(name), String(body).replace(/\n$/, ''), '```');
  }
  parts.push('', `You may change only: ${editable.join(', ')}.`);
  if (check) parts.push(`After your answer this check runs: ${check}. If it fails you get its output once, to send corrected files.`);
  return parts.join('\n');
}

// The files a reply sends, by name. A fenced block belongs to the file its info
// string names, else to the last line before it that names one (a "### x.py"
// heading, "**x.py**", "x.py:"), else, when only one file may change, to that
// one. The last block for a file wins. A block for a file the model may not
// change is refused and reported, never written.
// Only the task's own file names count as names, so "e.g." in a sentence is not
// taken for a file.
export function parseFiles(text, editable, all = editable) {
  const files = new Map();
  const refused = [];
  const src = String(text || '').replace(/\r\n/g, '\n');
  const names = [...new Set([...editable, ...all])];
  const pick = (t) => names.find((f) => f === t || path.basename(f) === path.basename(t));
  const known = (s) => {
    const hits = [];
    for (const tok of String(s).split(/[\s`*:"'()[\]]+/)) {
      const t = pick(tok.replace(/^(path|file|filename)=/i, '').replace(/^\.\//, '').replace(/[.,;]+$/, ''));
      if (t) hits.push(t);
    }
    return hits;
  };
  const re = /(^|\n)(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\n\2[ \t]*(?=\n|$)/g;
  let m, last = 0;
  while ((m = re.exec(src))) {
    const before = src.slice(last, m.index).split('\n').filter((l) => l.trim());
    last = m.index + m[0].length;
    let name = known(m[3]).pop();
    for (let i = before.length - 1; !name && i >= 0; i--) name = known(before[i]).pop();
    if (!name && editable.length === 1) name = editable[0];
    if (!name) continue;
    if (!editable.includes(name)) { refused.push(name); continue; }
    files.set(name, m[4].endsWith('\n') ? m[4] : `${m[4]}\n`);
  }
  return { files, refused };
}

function logUsage(st, res) {
  const read = cacheReading(res.usage);
  st.promptLog.push(read ? read.prompt : null);
  st.cacheLog.push(read && read.cached !== null && read.cached !== undefined ? read.cached : null);
  const u = res.usage || {};
  const wrote = [u.eval_count, u.completion_tokens, u.output_tokens].find((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0);
  st.outLog.push(wrote === undefined ? null : wrote);
  if (Number(u.num_ctx) > 0) st.numCtx = Number(u.num_ctx);
}

// One task, direct. `check(dir)` is the eval's own scorer, passed in so this
// module does not import eval.mjs. Returns the last reply; sets st.stop the way
// runLoop does, so the row reads the same.
export async function runDirect(st, task, { chat, dir, check }) {
  const editable = editableFiles(task);
  const visible = visibleCheck(task);
  st.messages = [{ role: 'system', content: DIRECT_SYSTEM }, { role: 'user', content: directPrompt(task, editable, visible) }];
  st.direct = { calls: 0, wrote: [], refused: [], repaired: false, checks: [] };
  let reply = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    let res;
    try { res = await chat(st.messages, null); } catch (e) { res = { error: e && e.message ? e.message : String(e) }; }
    st.direct.calls++;
    if (!res || res.error) {
      st.stop = { reason: res && res.contextFull ? 'context-full' : 'model-error', detail: String((res && res.error) || 'no response').slice(0, 300) };
      return reply;
    }
    logUsage(st, res);
    reply = String(res.content || '');
    st.messages.push({ role: 'assistant', content: reply });
    const got = parseFiles(reply, editable, Object.keys(task.files || {}));
    st.direct.refused.push(...got.refused);
    for (const [rel, body] of got.files) {
      fs.writeFileSync(path.join(dir, rel), body);
      st.direct.wrote.push(rel);
      st.editTries++;
    }
    let why = '';
    if (!got.files.size) why = `your reply held no file I could read. Send each changed file as a line "### <file name>" and one fenced code block with the whole file. You may change only: ${editable.join(', ')}.`;
    else if (visible) {
      const v = check(dir);
      if (v && v.pid) st.childPids.push(v.pid);
      st.direct.checks.push(Boolean(v && v.pass));
      if (v && v.pass) { st.stop = { reason: 'answered', detail: 'direct: the check passed' }; return reply; }
      why = `the check failed (${v ? v.why : 'it did not run'}):\n${v && v.output ? v.output : ''}\n\nSend the whole corrected file(s) the same way.`;
    } else { st.stop = { reason: 'answered', detail: 'direct: no check before grading' }; return reply; }
    if (attempt === 0) { st.direct.repaired = true; st.messages.push({ role: 'user', content: `The answer is not done: ${why}` }); }
    else st.stop = { reason: got.files.size ? 'answered' : 'malformed-output', detail: got.files.size ? 'direct: the one repair was used' : 'direct: no file in the reply' };
  }
  return reply;
}
