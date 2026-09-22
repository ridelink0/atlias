// What atlias costs and what it replaces, measured on the project in front of
// you. No model is called: every number here is either a byte count taken from
// disk or a token estimate derived from one, and the estimates are labelled.
import fs from 'node:fs';
import path from 'node:path';
import { config, readJsonl, projectDir, clip } from './core.mjs';
import * as graph from './graph.mjs';
import * as brief from './brief.mjs';

// Four characters to a token is the rough rule for English and for code. It is
// an estimate, it is never presented as anything else, and it is the same
// estimate on both sides of every comparison here, so the ratio holds even
// where the absolute numbers drift.
export function estimateTokens(text) {
  const n = String(text == null ? '' : text).length;
  return n === 0 ? 0 : Math.ceil(n / 4);
}

export function briefCost(cwd, host = 'claude') {
  const text = brief.build({ cwd, session_id: 'bench', source: 'startup' }, host);
  return { chars: text.length, tokens: estimateTokens(text) };
}

// A graph answer names the files it came from. The comparison is that answer
// against the cost of opening those same files, which is what the model would
// otherwise have had to do.
export function graphVsFiles(cwd, question) {
  const answer = graph.query(cwd, question, config().graph.queryBudget);
  if (!answer) return null;
  const named = new Set();
  for (const m of answer.matchAll(/src=([^\s\]]+)/g)) named.add(m[1]);
  let bytes = 0;
  let read = 0;
  for (const rel of named) {
    const full = path.isAbsolute(rel) ? rel : path.join(cwd, rel);
    try { bytes += fs.statSync(full).size; read++; } catch { /* the graph can name a file that has since moved */ }
  }
  const answerTokens = estimateTokens(answer);
  const fileTokens = Math.ceil(bytes / 4);
  return { question, answerTokens, fileTokens, filesNamed: named.size, filesMeasured: read, saved: fileTokens - answerTokens };
}

// How often the harness actually spoke, taken from the session digests it has
// already written for this project.
export function interventions(cwd) {
  const rows = readJsonl(path.join(projectDir(cwd), 'history.jsonl'));
  let toolCalls = 0;
  let guard = 0;
  let gate = 0;
  for (const r of rows) {
    for (const n of Object.values(r.tools || {})) toolCalls += Number(n) || 0;
    guard += (r.blocks && r.blocks.guard) || 0;
    gate += (r.blocks && r.blocks.gate) || 0;
  }
  return { sessions: rows.length, toolCalls, guard, gate, spoke: guard + gate };
}

export function report(cwd, questions = []) {
  const out = [];
  const b = briefCost(cwd);
  out.push('atlias bench for ' + cwd);
  out.push('');
  out.push('Fixed cost, once per session');
  out.push('  session brief: ' + b.chars + ' characters, about ' + b.tokens + ' tokens (estimate, four characters per token)');
  out.push('');
  const qs = questions.length ? questions : ['how does this project handle errors', 'what is the entry point of this project'];
  if (!graph.status(cwd).exists) {
    out.push('Graph answer versus opening the files');
    out.push('  no graph in this project, so nothing to measure. Build one with /graphify, or with the graph update command.');
  } else {
    out.push('Graph answer versus opening the files it names');
    let savedTotal = 0;
    let measured = 0;
    for (const q of qs) {
      const r = graphVsFiles(cwd, q);
      if (!r) { out.push('  "' + clip(q, 60) + '": the graph had no answer'); continue; }
      measured++;
      savedTotal += r.saved;
      out.push('  "' + clip(q, 60) + '"');
      out.push('    answer about ' + r.answerTokens + ' tokens, the ' + r.filesMeasured + ' file(s) it named about ' + r.fileTokens + ' tokens, difference about ' + r.saved + ' tokens');
    }
    if (measured) {
      out.push('  across ' + measured + ' question(s): about ' + savedTotal + ' tokens not spent opening files (estimate)');
      out.push('  this is an upper bound: it assumes every file the graph named would otherwise');
      out.push('  have been opened in full, and a model often reads fewer of them, or only parts.');
    }
  }
  out.push('');
  const i = interventions(cwd);
  out.push('How often the harness spoke, from its own session digests');
  if (!i.sessions) out.push('  no sessions recorded for this project yet.');
  else {
    out.push('  sessions ' + i.sessions + ', tool calls ' + i.toolCalls + ', guard denials ' + i.guard + ', gate blocks ' + i.gate);
    out.push('  it interrupted ' + i.spoke + ' time(s) in ' + i.toolCalls + ' tool call(s)' + (i.toolCalls ? ', about ' + ((i.spoke / i.toolCalls) * 100).toFixed(1) + ' per cent' : ''));
  }
  out.push('');
  out.push('Not measured here: whether the guard and the gate change how often a task actually succeeds.');
  out.push('That needs the same tasks run with the harness on and off, and it has not been done.');
  return out.join('\n');
}
