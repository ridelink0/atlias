// Research findings F6 and F7 of the cost-performance review
// (docs/research/Atlias councils and UFS packs.md): the claude engine reads
// what Claude Code spent from `--output-format json`, and, behind
// flags.claudeEffort, passes agent.claudeEffort as --effort and resumes once at
// high effort when the project's own check is red. No real Claude runs: a fake
// `claude` (a node script on a temp PATH) prints canned JSON and logs the
// arguments it was started with. Loaded by test/run.mjs.
import * as settings from '../lib/settings.mjs';

export default async function claudeEngineSuites({ suite, check, core, agentMod, TMP, fs, path }) {
  const FLAG = 'ATLIAS_FLAG_CLAUDE_EFFORT';
  const root = path.join(TMP, 'claude-engine');
  fs.mkdirSync(root, { recursive: true });
  let n = 0;

  // The JSON Claude Code 2.1.284 prints, trimmed to the fields atlias reads.
  const result = (text, u = {}, cost = 0.05) => JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: text, total_cost_usd: cost, usage: { input_tokens: 2, cache_creation_input_tokens: 11607, cache_read_input_tokens: 23176, output_tokens: 14, ...u } });

  // A fake claude that answers from a script of responses, one per call (the
  // last repeats), and appends its arguments to calls.log.
  const fake = (responses) => {
    const dir = path.join(root, `fake${++n}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'responses.json'), JSON.stringify(responses));
    fs.writeFileSync(path.join(dir, 'fake.mjs'), [
      'import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";',
      'const here = path.dirname(fileURLToPath(import.meta.url));',
      'const log = path.join(here, "calls.log");',
      'const seen = fs.existsSync(log) ? fs.readFileSync(log, "utf8").split("\\n").filter(Boolean).length : 0;',
      'fs.appendFileSync(log, JSON.stringify(process.argv.slice(2)) + "\\n");',
      'const all = JSON.parse(fs.readFileSync(path.join(here, "responses.json"), "utf8"));',
      'const r = all[Math.min(seen, all.length - 1)];',
      'try { fs.readFileSync(0); } catch {}',
      'process.stdout.write(r.stdout || ""); process.stderr.write(r.stderr || ""); process.exit(r.status || 0);',
    ].join('\n'));
    if (process.platform === 'win32') fs.writeFileSync(path.join(dir, 'claude.cmd'), '@ECHO off\r\n"%dp0%\\fake.mjs"   %*\r\n');
    else { fs.writeFileSync(path.join(dir, 'claude'), `#!/bin/sh\nexec "${process.execPath}" "${path.join(dir, 'fake.mjs')}" "$@"\n`); fs.chmodSync(path.join(dir, 'claude'), 0o755); }
    return { dir, calls: () => { try { return fs.readFileSync(path.join(dir, 'calls.log'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } } };
  };
  // A project whose only check exits with `code`, found by the gate the way any
  // project's is (a script named check that fails by itself).
  const project = (code) => {
    const dir = path.join(root, `p${++n}`);
    fs.mkdirSync(dir, { recursive: true });
    if (code !== null) fs.writeFileSync(path.join(dir, 'check.js'), `process.exit(${code});\n`);
    return dir;
  };
  // One turn through the real claudeTurn (the real spawn, the fake on PATH), with
  // the flag and agent.claudeEffort as asked; everything is put back after.
  const turn = ({ responses, cwd, flag = null, effort = '' }) => {
    const f = fake(responses);
    const beforePath = process.env.PATH;
    const beforeFlag = process.env[FLAG];
    process.env.PATH = f.dir + path.delimiter + beforePath;
    if (flag === null) delete process.env[FLAG]; else process.env[FLAG] = flag;
    if (effort) settings.set('agent.claudeEffort', effort);
    try {
      const state = agentMod.newState(cwd, 'claude');
      const reply = agentMod.claudeTurn(state, 'fix the bug');
      return { state, reply, calls: f.calls() };
    } finally {
      process.env.PATH = beforePath;
      if (beforeFlag === undefined) delete process.env[FLAG]; else process.env[FLAG] = beforeFlag;
      if (effort) settings.reset('agent.claudeEffort');
    }
  };
  const has = (call, flag, value) => { const i = call.indexOf(flag); return i >= 0 && (value === undefined || call[i + 1] === value); };

  suite('claude engine expert', 'the claude engine records what Claude Code spent (F7)', () => {
    const one = turn({ responses: [{ stdout: result('done, it works', {}, 0.0512) }], cwd: project(null) });
    const [call] = one.calls;
    check('it asks Claude Code for json, not text', one.calls.length === 1 && has(call, '--output-format', 'json') && !call.includes('text'), { happened: JSON.stringify(one.calls), why: 'Text output throws away the token counts and the cost, which is why the ledger could not see the claude engine at all.', fix: 'claudeArgs passes --output-format json.' });
    check('the reply is the result field, not the JSON', one.reply === 'done, it works', { happened: JSON.stringify(one.reply), why: 'The person reading the chat must see the answer, not an object.', fix: 'claudeTurn returns parseClaudeJson(stdout).text.' });
    const s = one.state;
    check('input, cache read and cache write add up to the prompt, cache read is the cached count, output is the output', JSON.stringify(s.promptLog) === '[34785]' && JSON.stringify(s.cacheLog) === '[23176]' && JSON.stringify(s.outLog) === '[14]', { happened: JSON.stringify({ prompt: s.promptLog, cached: s.cacheLog, out: s.outLog }), why: 'These are the fields the tool loop fills for the other engines and eval rows read (promptTotal, cachedTotal, outputTotal); the same shape keeps one report format for every engine.', fix: 'recordClaudeUsage feeds the usage object through loop.cacheReading and pushes promptLog, cacheLog and outLog.' });
    check('the session tally and the cost are kept', s.cache && s.cache.calls === 1 && s.cache.reported === 1 && s.cache.cached === 23176 && s.costUsd === 0.0512, { happened: JSON.stringify({ cache: s.cache, costUsd: s.costUsd }), why: '/status and the saved chat read state.cache; the cost is the one number Claude Code reports that the token counts cannot give.', fix: 'recordClaudeUsage calls loop.countCache and adds total_cost_usd to state.costUsd.' });
    check('/status shows a measurement instead of saying atlias never sees the counts', /cache/.test(agentMod.statusText(s)) && !/never sees their token counts/.test(agentMod.statusText(s)), { happened: agentMod.statusText(s).split('\n')[4], why: 'The line was true only while nothing was recorded.', fix: 'statusText prefers loop.cacheLine(state.cache) when it has calls.' });

    const bad = [
      ['not json at all', 'the tests passed, honest'],
      ['a truncated object', '{"type":"result","result":"half'],
      ['empty output', ''],
      ['json with no result field', JSON.stringify({ usage: { input_tokens: 5, output_tokens: 6 } })],
      ['an array', '[1,2,3]'],
    ];
    for (const [what, stdout] of bad) {
      let t = null, crashed = '';
      try { t = turn({ responses: [{ stdout }], cwd: project(null) }); } catch (e) { crashed = String(e && e.message); }
      const st = t && t.state;
      check(`${what}: no crash, and usage is null, not zero`, !crashed && st && JSON.stringify(st.promptLog) === '[null]' && JSON.stringify(st.cacheLog) === '[null]' && JSON.stringify(st.outLog) === '[null]' && st.costUsd === undefined && st.cache.silent === 1 && st.cache.reported === 0, { happened: crashed || JSON.stringify({ prompt: st.promptLog, cached: st.cacheLog, out: st.outLog, cost: st.costUsd, cache: st.cache }), why: 'A zero would say the run was free and fully uncached; unmeasured must stay null, as it does for an Ollama build that reports nothing.', fix: 'parseClaudeJson returns usage null unless the object has a result string and a usage object; recordClaudeUsage pushes null for it.' });
    }
    const salvage = turn({ responses: [{ stdout: 'the tests passed, honest' }], cwd: project(null) });
    check('output that is not the json is still shown as the reply', salvage.reply === 'the tests passed, honest', { happened: JSON.stringify(salvage.reply), why: 'A host that ignores the format must not turn an answer into nothing.', fix: 'parseClaudeJson falls back to the trimmed stdout.' });
    const partial = turn({ responses: [{ stdout: JSON.stringify({ result: 'ok', usage: { output_tokens: 9 } }) }], cwd: project(null) });
    check('a usage object with only some fields records those and nulls the rest', partial.reply === 'ok' && JSON.stringify(partial.state.outLog) === '[9]' && JSON.stringify(partial.state.cacheLog) === '[null]' && partial.state.costUsd === undefined, { happened: JSON.stringify({ out: partial.state.outLog, cached: partial.state.cacheLog, cost: partial.state.costUsd }), why: 'A missing cached count is silence, not a miss.', fix: 'Read each field on its own.' });
    const p = agentMod.parseClaudeJson(result('hi', {}, 0.5));
    const q = agentMod.parseClaudeJson('{"result":"x","usage":"lots","total_cost_usd":"free"}');
    check('parseClaudeJson reads the reply, usage and cost, and nulls what is not a usage object or a number', p.text === 'hi' && p.usage.output_tokens === 14 && p.cost === 0.5 && q.text === 'x' && q.usage === null && q.cost === null, { happened: JSON.stringify({ p, q }), why: 'A string where an object is expected must read as unmeasured.', fix: 'Check the type of usage and of each cost field.' });
    const ledger = {};
    agentMod.recordClaudeUsage(ledger, { text: '', usage: null, cost: null });
    agentMod.recordClaudeUsage(ledger, p);
    check('recordClaudeUsage keeps one entry per exec, null for the unmeasured one', JSON.stringify(ledger.outLog) === '[null,14]' && JSON.stringify(ledger.promptLog) === '[null,34785]' && ledger.cache.calls === 2 && ledger.cache.silent === 1 && ledger.costUsd === 0.5, { happened: JSON.stringify(ledger), why: 'A run that reported nothing is a null row, and a later one must not shift it.', fix: 'Push null, never skip or zero.' });
    const failed = turn({ responses: [{ status: 1, stderr: 'boom' }], cwd: project(null) });
    check('a failing claude records no usage at all', /claude failed/.test(failed.reply) && !failed.state.promptLog && !failed.state.cache, { happened: JSON.stringify({ reply: failed.reply, prompt: failed.state.promptLog }), why: 'No run happened, so nothing was spent to record.', fix: 'Record only after a successful exec.' });
  });

  suite('claude effort expert', 'flags.claudeEffort: --effort, and one retry at high effort on red (F6)', () => {
    const ok = { stdout: result('changed the code') };
    const setting = agentMod.claudeArgs({ started: false, hostSid: 'sid' }, { effort: 'medium' });
    check('the flag is registered off by default and described, and the setting is empty', core.DEFAULTS.flags.claudeEffort === false && core.DEFAULTS.agent.claudeEffort === '' && settings.DESCRIPTIONS['flags.claudeEffort'] && settings.DESCRIPTIONS['agent.claudeEffort'], { happened: JSON.stringify({ flag: core.DEFAULTS.flags.claudeEffort, setting: core.DEFAULTS.agent.claudeEffort }), why: 'Every flag is off until an arm switches it, and the golden control depends on it.', fix: 'Add it to DEFAULTS.flags and DESCRIPTIONS.' });
    check('claudeArgs passes --effort only when given one', has(setting, '--effort', 'medium') && !agentMod.claudeArgs({ started: false, hostSid: 'sid' }).includes('--effort'), { happened: setting.join(' '), why: 'An unset effort must leave Claude Code on its own default.', fix: 'Add --effort <level> only for a non-empty level.' });

    const off = turn({ responses: [ok], cwd: project(1), effort: 'medium' });
    check('flag off: one exec, no --effort, no check, no retry, even with a red check and the setting made', off.calls.length === 1 && !off.calls[0].includes('--effort') && !off.state.claudeRetries && off.reply === 'changed the code', { happened: JSON.stringify(off.calls), why: 'Off must add nothing; the setting alone does not switch the retry on.', fix: 'claudeTurn reads config().flags.claudeEffort first.' });
    const zero = turn({ responses: [ok], cwd: project(1), flag: '0', effort: 'medium' });
    check('the flag set to 0 from the environment is off', zero.calls.length === 1, { happened: JSON.stringify(zero.calls), why: 'An arm that sets every flag to 0 is the control.', fix: 'Use config().flags, which the environment plumbing fills.' });

    const red = turn({ responses: [ok, { stdout: result('fixed it at high effort', {}, 0.2) }], cwd: project(1), flag: '1', effort: 'medium' });
    check('on and red: the first exec carries the setting, and there is exactly one more, at high effort', red.calls.length === 2 && has(red.calls[0], '--effort', 'medium') && has(red.calls[1], '--effort', 'high'), { happened: JSON.stringify(red.calls), why: 'The point is to pay for high effort only on the tasks that need it, once.', fix: 'After the first exec, run gate.runVisibleCheck and re-exec once with --effort high on outcome fail.' });
    check('the retry resumes the same session and its answer is the reply', has(red.calls[1], '--resume', red.state.hostSid) && red.reply === 'fixed it at high effort' && red.state.claudeRetries === 1, { happened: JSON.stringify({ calls: red.calls[1], reply: red.reply, retries: red.state.claudeRetries }), why: 'A fresh session would re-read everything the first exec already paid for.', fix: 'claudeArgs after state.started resumes hostSid.' });
    check('both execs are in the ledger, cost included', JSON.stringify(red.state.outLog) === '[14,14]' && red.state.cache.calls === 2 && Math.abs(red.state.costUsd - 0.25) < 1e-9, { happened: JSON.stringify({ out: red.state.outLog, cost: red.state.costUsd }), why: 'The retry is the spend F6 is meant to make visible.', fix: 'recordClaudeUsage runs for the retry too.' });

    const still = turn({ responses: [ok], cwd: project(1), flag: '1', effort: 'low' });
    check('a check still red after the retry does not start a third exec', still.calls.length === 2, { happened: `${still.calls.length} exec(s)`, why: 'At most one retry, or the cost is unbounded.', fix: 'Run the check once, retry once, and return.' });
    const noEffort = turn({ responses: [ok], cwd: project(1), flag: '1' });
    check('with no effort set, the first exec passes none and the retry still goes to high', noEffort.calls.length === 2 && !noEffort.calls[0].includes('--effort') && has(noEffort.calls[1], '--effort', 'high'), { happened: JSON.stringify(noEffort.calls), why: 'The retry does not depend on the setting.', fix: 'Only the first exec reads agent.claudeEffort.' });
    const green = turn({ responses: [ok], cwd: project(0), flag: '1', effort: 'medium' });
    check('on and green: one exec, no retry', green.calls.length === 1 && !green.state.claudeRetries, { happened: JSON.stringify(green.calls), why: 'A passing check is the signal not to spend more.', fix: 'Retry only on outcome fail.' });
    const none = turn({ responses: [ok], cwd: project(null), flag: '1', effort: 'medium' });
    check('on with no check in the project: one exec', none.calls.length === 1, { happened: JSON.stringify(none.calls), why: 'No check means no signal; guessing is what the retry must not do.', fix: 'visibleCheck returns null, so no retry.' });
    const high = turn({ responses: [ok], cwd: project(1), flag: '1', effort: 'high' });
    check('already at high effort: no retry', high.calls.length === 1 && has(high.calls[0], '--effort', 'high'), { happened: JSON.stringify(high.calls), why: 'A retry at the same effort is the same run again.', fix: 'Skip the retry when the setting is high, xhigh or max.' });
    const junk = turn({ responses: [ok], cwd: project(0), flag: '1', effort: 'turbo' });
    check('an effort Claude Code does not take is not passed', junk.calls.length === 1 && !junk.calls[0].includes('--effort'), { happened: JSON.stringify(junk.calls), why: 'An unknown level would fail every turn.', fix: 'Pass only low, medium, high, xhigh or max.' });
    const dead = turn({ responses: [ok, { status: 1, stderr: 'boom' }], cwd: project(1), flag: '1' });
    check('a retry that fails to run leaves the first answer standing', dead.calls.length >= 2 && dead.reply === 'changed the code', { happened: JSON.stringify({ reply: dead.reply, calls: dead.calls.length }), why: 'A failed extra attempt must not replace an answer with an error.', fix: 'Take the retry\'s text only when its exec succeeded.' });
  });
}
