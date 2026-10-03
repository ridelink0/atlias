// Protected semantic-judge preparation, never an answering or judge model call.
import fs from 'node:fs';
import path from 'node:path';
import { hash, semanticJudgeTemplate, renderSemanticJudge } from './protocol.mjs';
const [prepared, responsesFile, publisherCard, out] = process.argv.slice(2);
if (!prepared || !responsesFile || !publisherCard || !out || fs.existsSync(out)) throw Error('usage: judge-prepare.mjs <prepared600-dir> <frozen-response-jsonl> <pinned-publisher-card> <unused-protected-out>');
const plan = JSON.parse(fs.readFileSync(path.join(prepared, 'plan.json'))), questions = JSON.parse(fs.readFileSync(path.join(prepared, 'questions.json'))), gold = JSON.parse(fs.readFileSync(path.join(prepared, 'grader-only/gold.json')));
if (hash(JSON.stringify(questions)) !== plan.questionManifestSha256 || hash(JSON.stringify(gold)) !== plan.goldManifestSha256) throw Error('prepared manifest changed');
const card = fs.readFileSync(publisherCard, 'utf8');
const template = semanticJudgeTemplate(card);
const bytes = fs.readFileSync(responsesFile), responses = bytes.toString('utf8').split('\n').filter(Boolean).map(JSON.parse), seen = new Set(), prompts = [], invalid = [];
const lookup = new Map(questions.map(q => [q.id, q])), answers = new Map(gold.map(g => [g.id, g]));
for (const row of responses) {
  const identity = `${row.host}:${row.arm}:${row.id}`;
  if (!['codex', 'claude'].includes(row.host) || !['plain', 'atlias'].includes(row.arm) || seen.has(identity) || !lookup.has(row.id)) throw Error('unknown or duplicate answer identity; preserve attempts separately');
  seen.add(identity);
  const q = lookup.get(row.id), g = answers.get(row.id);
  if (row.questionSha256 !== q.questionSha256 || g.questionSha256 !== q.questionSha256 || hash(g.answer) !== g.answerSha256) throw Error('answer/gold identity not bound to question');
  if (typeof row.response !== 'string' || row.responseSha256 !== hash(row.response)) throw Error('response bytes not bound to row');
  // Empty valid answers are semantic abstentions; interrupted/invalid runs are
  // retained separately and must never be converted into NOT_ATTEMPTED.
  if (row.valid !== true || row.exitCode !== 0 || row.timedOut !== false || row.toolCalls !== 0) { invalid.push({ identity, reason: 'invalid/unfinished/tool-using response, not an abstention', responseSha256: row.responseSha256 }); continue; }
  const prompt = renderSemanticJudge(template, { question: q.question, target: g.answer, response: row.response });
  prompts.push({ identity, host: row.host, arm: row.arm, id: row.id, questionSha256: q.questionSha256, responseSha256: row.responseSha256, prompt, promptSha256: hash(prompt) });
}
const completeAnswers = ['codex','claude'].flatMap(host => ['plain','atlias'].map(arm => ({ host, arm, validAnswers: prompts.filter(p => p.host === host && p.arm === arm).length, planned: questions.length })));
const manifest = { benchmark: plan.benchmark, dataset: plan.dataset, modelCalls: 0, status: 'judge prompts prepared; semantic judge execution unmeasured', responseLedgerSha256: hash(bytes), publisherCardSha256: hash(card), templateSha256: hash(template), judgePromptsSha256: hash(JSON.stringify(prompts)), completeAnswers, invalid, limitation: 'Imported answer validity is not independently verified native execution. This directory contains gold and MUST remain outside contestant homes/workspaces/context. No score before actual pinned judge execution and complete grading.' };
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'judge-prompts.json'), JSON.stringify(prompts, null, 2));
fs.writeFileSync(path.join(out, 'plan.json'), JSON.stringify(manifest, null, 2));
if (hash(fs.readFileSync(responsesFile)) !== manifest.responseLedgerSha256) throw Error('frozen response ledger changed');
console.log(JSON.stringify({ prompts: prompts.length, invalid: invalid.length, modelCalls: 0, out }));
