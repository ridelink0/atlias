import crypto from 'node:crypto';
export const DATASET = Object.freeze({ name: 'ArtificialAnalysis/AA-Omniscience-Public', revision: 'e4883edbb9f5ccf2b2a8fdc6fb65e01a58e99849', csvSha256: '1e04603dafa3bd0d16d8151f07a5eb74c43d90c3a85d2fca120da2359174d02f', questions: 600, license: 'Apache-2.0', source: 'https://huggingface.co/datasets/ArtificialAnalysis/AA-Omniscience-Public' });
export const hash = text => crypto.createHash('sha256').update(text).digest('hex');
export const PUBLISHER_CARD_SHA256 = 'e75f912ebd1c5ea40b47692a98bc684e13da32af226694024f4a94eab7327481';
export function semanticJudgeTemplate(card) {
  if (hash(card) !== PUBLISHER_CARD_SHA256) throw Error('publisher card differs from pinned revision');
  const match = card.match(/OMNISCIENCE_GRADER_TEMPLATE = """([\s\S]*?)"""/);
  if (!match || !['{question}', '{target}', '{predicted_answer}'].every(key => match[1].includes(key))) throw Error('publisher semantic grading template absent');
  return match[1];
}
export function renderSemanticJudge(template, { question, target, response }) {
  if (typeof template !== 'string' || [question,target,response].some(x => typeof x !== 'string')) throw Error('semantic judge text fields required');
  return template.replace(/\{question\}|\{target\}|\{predicted_answer\}/g, key => ({ '{question}': question, '{target}': target, '{predicted_answer}': response })[key]);
}

export function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, '');
  const pushField = () => { row.push(field); field = ''; closed = false; };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
      else field += char;
    } else if (char === ',') pushField();
    else if (char === '\r' || char === '\n') { if (char === '\r' && text[i + 1] === '\n') i++; pushField(); rows.push(row); row = []; }
    else if (char === '"' && field === '' && !closed) quoted = true;
    else { if (closed || char === '"') throw Error('malformed CSV quote boundary'); field += char; }
  }
  if (quoted) throw Error('unclosed CSV quote');
  if (field !== '' || row.length || closed) { pushField(); rows.push(row); }
  if (!rows.length) throw Error('empty CSV');
  const [headers, ...body] = rows;
  if (new Set(headers).size !== headers.length) throw Error('duplicate CSV column');
  return body.map(fields => { if (fields.length !== headers.length) throw Error('CSV column count differs'); return Object.fromEntries(headers.map((key, i) => [key, fields[i]])); });
}

export function prepareDataset(bytes) {
  if (hash(bytes) !== DATASET.csvSha256) throw Error('dataset bytes differ from pinned revision');
  const records = parseCsv(bytes.toString('utf8'));
  if (records.length !== DATASET.questions) throw Error('expected complete public600 dataset');
  const questions = [], gold = [], ids = new Set();
  for (const row of records) {
    for (const key of ['domain', 'topic', 'subtopic', 'question_id', 'question', 'answer']) if (typeof row[key] !== 'string' || !row[key].trim()) throw Error('missing dataset field: ' + key);
    const questionSha256 = hash(JSON.stringify([row.domain, row.topic, row.subtopic, row.question_id, row.question]));
    const id = `aa-public-${questionSha256}`;
    if (ids.has(id)) throw Error('duplicate question identity'); ids.add(id);
    questions.push({ id, domain: row.domain, topic: row.topic, subtopic: row.subtopic, upstreamId: row.question_id, question: row.question, questionSha256 });
    gold.push({ id, questionSha256, answer: row.answer, answerSha256: hash(row.answer) });
  }
  return { dataset: DATASET, questions, gold };
}

// Publisher's Apache-2.0 public answering template, with explicit attribution
// in tools/omniscience/README.md. Gold answers are not inputs to this function.
export function questionPrompt(question) {
  if (!question || ['domain', 'subtopic', 'question'].some(k => typeof question[k] !== 'string')) throw Error('question fields required');
  return `You are answering questions about ${question.domain}, and in particular ${question.subtopic}.\nYou will be given a question, answer with JUST the answer (no explanation).\nIf you do not know the answer, or you need more context or tools to answer the question,\nbe clear about this - it is better that you say this than get the wrong answer.\n\n${question.question}`;
}

export function metrics(labels) {
  const counts = { CORRECT: 0, INCORRECT: 0, PARTIAL_ANSWER: 0, NOT_ATTEMPTED: 0 };
  for (const label of labels) { if (!Object.hasOwn(counts, label)) throw Error('unknown or missing judge label'); counts[label]++; }
  const n = labels.length, incorrectOrUnknown = counts.INCORRECT + counts.PARTIAL_ANSWER + counts.NOT_ATTEMPTED;
  return { n, counts, accuracy: n ? counts.CORRECT / n : null, hallucinationRate: incorrectOrUnknown ? counts.INCORRECT / incorrectOrUnknown : null, omniscienceIndex: n ? 100 * (counts.CORRECT - counts.INCORRECT) / n : null, attemptRate: n ? (n - counts.NOT_ATTEMPTED) / n : null };
}

export function reportGrades(questions, grades, { judge } = {}) {
  if (!judge || typeof judge.model !== 'string' || !judge.model || typeof judge.promptSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(judge.promptSha256)) throw Error('pinned judge model and prompt required');
  const ids = new Map(questions.map(q => [q.id, q]));
  if (!ids.size || ids.size !== questions.length) throw Error('missing or duplicate plan identities');
  if (questions.some(q => typeof q.id !== 'string' || !q.id || !/^[a-f0-9]{64}$/.test(q.questionSha256 || ''))) throw Error('plan identity must pin question bytes');
  const seen = new Set();
  for (const grade of grades) {
    if (seen.has(grade.id) || !ids.has(grade.id)) throw Error('unknown or duplicate grade identity');
    if (grade.questionSha256 !== ids.get(grade.id).questionSha256 || !/^[a-f0-9]{64}$/.test(grade.responseSha256 || '')) throw Error('grade not bound to question and response');
    seen.add(grade.id);
  }
  const complete = seen.size === ids.size;
  return { planned: ids.size, graded: seen.size, complete, judge, measuredMetrics: complete ? metrics(grades.map(g => g.label)) : null, partialMetrics: metrics(grades.map(g => g.label)), missing: [...ids.keys()].filter(id => !seen.has(id)), warning: 'Imported labels are not independently verified judge executions. A public600 native-host adaptation is not the private6000 publisher leaderboard. Accuracy, abstentions, costs and protocol must accompany hallucination rate.' };
}
