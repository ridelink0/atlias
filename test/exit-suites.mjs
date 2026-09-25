// How a run ends, and the two failures that are not the round budget.
//
// Two things the field does and atlias did not. mini-swe-agent counts
// consecutive malformed model output on a counter of its own, separate from the
// step budget, and leaves with a typed status - so a comparison between
// harnesses can tell a model that ran out of room from one that could never send
// a usable action. And pi-mono and Aider both read finish_reason before running
// anything, because a reply the provider cut off at its output limit can still
// hold JSON that parses: a path cut short or a patch missing its end arrives
// looking perfectly well formed.
//
// Loaded by test/run.mjs, which owns suite(), asyncSuite() and check().
import * as loop from '../lib/loop.mjs';

export default async function exitSuites({ suite, asyncSuite, check, core, agentMod, TMP, fs, path }) {
  const W = path.join(TMP, 'exit-work');
  fs.mkdirSync(W, { recursive: true });
  const NL = String.fromCharCode(10);
  const FENCE = '`'.repeat(3);
  const blk = (o) => FENCE + 'atlias' + NL + JSON.stringify(o) + NL + FENCE;
  const fresh = () => agentMod.newState(W, 'ollama');
  const scripted = (replies) => async () => {
    const r = replies.shift();
    if (r === undefined) return { content: 'out of script', calls: [] };
    return typeof r === 'string' ? { content: r, calls: [] } : r;
  };
  // A tool block holding prose: the fence is there, so the model plainly meant
  // to call a tool, and nothing parses out of it. Checked against parseToolCall
  // rather than assumed - a block cut off mid-JSON does NOT belong here,
  // because repairJson mends it into a real call, which is the whole point of
  // repairJson.
  const brokenBlock = FENCE + 'atlias' + NL + 'I think I should read the file called app.js next.' + NL + FENCE;

  suite('exit reason expert', 'every way out of a run names itself', () => {
    check('the reasons are a closed list', loop.STOP_REASONS.length === 5 && loop.STOP_REASONS.every((r) => typeof r === 'string' && /^[a-z-]+$/.test(r)) && loop.STOP_REASONS.includes('answered') && loop.STOP_REASONS.includes('rounds-exhausted'), { happened: JSON.stringify(loop.STOP_REASONS), why: 'An eval harness can only match on a reason that is one of a known set; free prose is what it had before, and it could not be matched at all.', fix: 'Keep STOP_REASONS and the strings passed to stopWith in step.' });
    const st = fresh();
    check('stopWith records the reason beside the text it returns', loop.stopWith(st, 'answered', 'the reply', 'some detail') === 'the reply' && st.stop.reason === 'answered' && st.stop.detail === 'some detail', { happened: JSON.stringify(st.stop), why: 'The reply is for the person and the reason is for the harness; returning one while dropping the other is how this went unmeasured before.', fix: 'Check stopWith.' });
    check('a detail longer than the field is clipped, not stored whole', loop.stopWith(fresh(), 'model-error', 'x', 'd'.repeat(900)).length === 1 && true, { happened: 'stopWith changed the text it was given', why: 'The reason travels in an eval report; an unbounded detail would put a whole stack trace in a scoreboard row.', fix: 'Keep the clip in stopWith.' });
    const longDetail = fresh();
    loop.stopWith(longDetail, 'model-error', 'x', 'd'.repeat(900));
    check('and the clip is the one the field says it is', longDetail.stop.detail.length <= 300, { happened: longDetail.stop.detail.length + ' characters', why: 'Same reason; this is the check that the number is real.', fix: 'Keep clip(detail, 300) in stopWith.' });
    check('all truncations is a diagnosis of its own', loop.stallReason(['truncated', 'truncated']) === 'truncated-output' && loop.stallReason(['truncated', 'parse']) === 'malformed-output' && loop.stallReason(['edit']) === 'malformed-output' && loop.stallReason([]) === 'malformed-output', { happened: [loop.stallReason(['truncated', 'truncated']), loop.stallReason(['truncated', 'parse']), loop.stallReason(['edit'])].join(','), why: 'A model hitting its output limit needs a shorter reply or a bigger limit; a model that cannot format an action needs a different model. Folding the two together would name the wrong fix.', fix: 'Check stallReason.' });
    const text = loop.stallText(['parse', 'parse', 'edit']);
    check('the text says how many of what, and that it is not the round budget', /3 model replies in a row/.test(text) && /2 tool blocks that did not parse/.test(text) && /1 edit that did not apply/.test(text) && /not the round budget/.test(text) && /agent\.maxBadReplies/.test(text), { happened: text, why: 'The two stops look identical from outside - no answer came back - and the whole value of counting them apart is lost if the message does not say which happened.', fix: 'Check stallText and BAD_REPLY.' });
    check('it counts in words that agree with the number', /^atlias stopped: 1 model reply in a row/.test(loop.stallText(['parse'])) && /1 tool block that did not parse/.test(loop.stallText(['parse'])) && /3 replies the provider cut off/.test(loop.stallText(['truncated', 'truncated', 'truncated'])), { happened: loop.stallText(['parse']) + ' || ' + loop.stallText(['truncated', 'truncated', 'truncated']), why: 'This line is the last thing a failed run says; "1 tool blocks" is the harness sounding careless at the moment it is reporting a failure.', fix: 'Check the one/many pair in BAD_REPLY.' });
    const cut = loop.stallText(['truncated', 'truncated', 'truncated']);
    check('a run of nothing but cut-off replies is told the right fix', /output limit/.test(cut) && /shorter replies/.test(cut) && !/stronger model/.test(cut) && /stronger model/.test(loop.stallText(['parse', 'parse', 'parse'])), { happened: cut, why: 'A model cut off at its output limit is not a model that needs replacing, and a bigger output limit does nothing for a model that cannot format an action. Naming the wrong fix sends the user after the wrong thing, which is worse than naming none.', fix: 'Check the branch on stallReason in stallText.' });
    check('every kind of bad reply has words of its own, in both numbers', Object.keys(loop.BAD_REPLY).length === 3 && Object.values(loop.BAD_REPLY).every((v) => v && v.one.length > 10 && v.many.length > 10 && v.one !== v.many), { happened: JSON.stringify(loop.BAD_REPLY), why: 'A kind with no wording would print its own variable name at the user.', fix: 'Keep BAD_REPLY in step with what runLoop pushes onto bad.' });
    check('the edit tools are named once for both the permission check and the counter', loop.EDIT_TOOLS.has('edit_file') && loop.EDIT_TOOLS.has('write_file') && loop.EDIT_TOOLS.has('apply_patch') && !loop.EDIT_TOOLS.has('shell') && !loop.EDIT_TOOLS.has('read_file'), { happened: [...loop.EDIT_TOOLS].join(','), why: 'Two lists of the edit tools drift, and then a tool is guarded in one place and counted in the other.', fix: 'Keep EDIT_TOOLS as the one list.' });
  });

  suite('truncation expert', 'a reply the provider cut off is not run', () => {
    check('the field is read, and only the spellings that exist', loop.isTruncated('length') && loop.isTruncated('max_tokens') && loop.isTruncated('MAX_TOKENS') && !loop.isTruncated('stop') && !loop.isTruncated('tool_calls') && !loop.isTruncated('') && !loop.isTruncated(null) && !loop.isTruncated(undefined), { happened: ['length', 'stop', 'tool_calls', ''].map((r) => r + '=' + loop.isTruncated(r)).join(' '), why: 'Treating a normal stop as a truncation would refuse every tool call the model ever makes.', fix: 'Check isTruncated and TRUNCATED_FINISH.' });
    check('the spellings are the three that are real, not a guess', loop.TRUNCATED_FINISH.length === 3 && loop.TRUNCATED_FINISH.includes('length') && loop.TRUNCATED_FINISH.includes('max_tokens') && loop.TRUNCATED_FINISH.includes('MAX_TOKENS'), { happened: loop.TRUNCATED_FINISH.join(','), why: 'A made-up finish reason in this list is a value no provider sends, which reads as coverage and is not.', fix: 'Only add a spelling that was seen from a real endpoint.' });
  });

  await asyncSuite('stall expert', 'replies that produce nothing are counted apart from the rounds', async () => {
    // Three broken blocks in a row, with plenty of rounds left: the run has to
    // stop on the counter, not on the budget.
    const st = fresh();
    const reply = await loop.runLoop(st, 'read something', { chat: scripted([brokenBlock, brokenBlock, brokenBlock, 'never reached']) });
    check('three unparsable replies in a row stop the run with a typed reason', st.stop && st.stop.reason === 'malformed-output' && /3 model replies in a row/.test(reply), { happened: JSON.stringify(st.stop) + ' | ' + reply.slice(0, 120), why: 'Without this the run burned all 25 rounds on a model that could not format a call, and then reported the round budget - naming the wrong cause of the failure.', fix: 'Check the bad counter and tooMany in runLoop.' });
    check('and it stopped well before the round budget', st.messages.filter((m) => m.role === 'assistant').length === 3, { happened: st.messages.filter((m) => m.role === 'assistant').length + ' model replies', why: 'The whole point of a separate counter is that it fires long before the step limit does.', fix: 'The counter is checked on each bad reply, not at the end.' });

    // One good move in between clears the count, the way mini-swe-agent resets
    // on any clean step.
    fs.writeFileSync(path.join(W, 'notes.md'), 'a line' + NL);
    const st2 = fresh();
    const reply2 = await loop.runLoop(st2, 'look then answer', { chat: scripted([brokenBlock, brokenBlock, blk({ tool: 'list_dir', path: '.' }), brokenBlock, brokenBlock, 'I looked and here is the answer.']) });
    check('a round that did something clears the count', st2.stop && st2.stop.reason === 'answered' && reply2 === 'I looked and here is the answer.', { happened: JSON.stringify(st2.stop) + ' | ' + reply2.slice(0, 80), why: 'Counting without resetting would kill a long run that stumbled twice early and then worked perfectly, which is most real runs.', fix: 'Check that produced clears bad in runLoop.' });

    // Edits that do not apply are the other way a reply produces nothing: the
    // model keeps sending an old_string that is not in the file.
    const st3 = fresh();
    const miss = blk({ tool: 'edit_file', path: 'notes.md', old_string: 'a line that is not in the file', new_string: 'x' });
    const reply3 = await loop.runLoop(st3, 'change the note', { chat: scripted([miss, miss, miss, 'never reached']) });
    check('three edits in a row that do not apply stop the run too', st3.stop && st3.stop.reason === 'malformed-output' && /3 edits that did not apply/.test(reply3) && st3.stop.detail.includes('did not apply'), { happened: JSON.stringify(st3.stop) + ' | ' + reply3.slice(0, 140), why: 'A weak model that cannot match old_string will send the same failing edit until the rounds run out, and the report blamed the budget.', fix: 'Check deadEdits in runLoop; a failed edit is one that did not move state.editedAt.' });
    check('the file it failed to edit was left alone', fs.readFileSync(path.join(W, 'notes.md'), 'utf8').trim() === 'a line', { happened: fs.readFileSync(path.join(W, 'notes.md'), 'utf8'), why: 'Counting a failed edit must not be confused with letting one through.', fix: 'edit_file returns without writing when old_string is not found.' });

    // An edit that applies is a round that produced something, so the counter
    // must not treat a working edit as a failure.
    const st4 = fresh();
    // Three replies, not two: after an edit with no check the loop asks once
    // more before it lets the answer stand, which is the auto-check nudge doing
    // its job.
    const reply4 = await loop.runLoop(st4, 'change the note', { chat: scripted([blk({ tool: 'edit_file', path: 'notes.md', old_string: 'a line', new_string: 'two lines' }), 'Changed it.', 'There is no check to run in this folder.']) });
    check('an edit that applies is not counted as a failure', st4.stop && st4.stop.reason === 'answered' && /no check to run/.test(reply4) && fs.readFileSync(path.join(W, 'notes.md'), 'utf8').includes('two lines'), { happened: JSON.stringify(st4.stop) + ' | ' + reply4.slice(0, 80), why: 'Reading success from the wording of the result would break the moment the wording changed; this reads the clock the harness already keeps.', fix: 'Check the state.editedAt comparison in runLoop.' });

    // The truncation path, end to end: the provider says length, and the tool
    // call in that reply is refused rather than run.
    const st5 = fresh();
    const cut = { content: '', calls: [{ id: 'call_1', tool: 'write_file', path: 'should-not-exist.txt', content: 'x' }], message: { role: 'assistant', content: '', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'write_file', arguments: '{"path":"should-not-exist.txt","content":"x"' } }] }, finish: 'length', truncated: true };
    const reply5 = await loop.runLoop(st5, 'write a file', { chat: scripted([cut, 'I will keep it shorter.']) });
    const refusal = st5.messages.find((m) => m.role === 'tool' && m.tool_call_id === 'call_1');
    check('a tool call from a cut-off reply is refused, not run', !fs.existsSync(path.join(W, 'should-not-exist.txt')) && refusal && /refused to run/.test(refusal.content) && /finish reason length/.test(refusal.content), { happened: (refusal ? refusal.content.slice(0, 160) : 'no refusal message') + ' | file exists: ' + fs.existsSync(path.join(W, 'should-not-exist.txt')), why: 'Truncated JSON still parses, so the arguments can be quietly wrong - a path cut short writes to the wrong file and the run looks like it worked. pi-mono fails the whole batch for this reason.', fix: 'Check the res.truncated branch in runLoop.' });
    check('the refused call is still answered, so the next request is valid', refusal && refusal.role === 'tool' && refusal.tool_call_id === 'call_1' && reply5 === 'I will keep it shorter.', { happened: JSON.stringify(refusal && { role: refusal.role, id: refusal.tool_call_id }) + ' | ' + reply5, why: 'An unanswered tool_call id makes the whole conversation invalid on the next call, so refusing by silence would end the run with a provider error instead of a retry.', fix: 'Push one tool message per refused call id.' });

    const st6 = fresh();
    await loop.runLoop(st6, 'write a file', { chat: scripted([{ ...cut }, { ...cut }, { ...cut }, 'never reached']) });
    check('three cut-off replies in a row stop the run as a truncation, not as bad formatting', st6.stop && st6.stop.reason === 'truncated-output' && st6.stop.detail === 'finish reason length', { happened: JSON.stringify(st6.stop), why: 'This is the case where the fix is a shorter reply or a bigger output limit, and calling it malformed output would send the user after the wrong thing.', fix: 'Check stallReason where every kind is truncated.' });

    const st7 = fresh();
    const reply7 = await loop.runLoop(st7, 'say hello', { chat: async () => ({ error: 'connection refused' }) });
    check('a failed model call is typed too', st7.stop && st7.stop.reason === 'model-error' && st7.stop.detail === 'connection refused' && /the model call failed/.test(reply7), { happened: JSON.stringify(st7.stop), why: 'An eval row that failed because nothing answered is not a row about the model\'s ability, and a scoreboard that cannot tell them apart is misleading.', fix: 'Check the res.error branch in runLoop.' });

    const st8 = fresh();
    core.config();
    const spin = [];
    for (let i = 0; i < 40; i++) spin.push(blk({ tool: 'list_dir', path: i % 2 ? '.' : 'nowhere-' + i }));
    const reply8 = await loop.runLoop(st8, 'look forever', { chat: scripted(spin) });
    check('running out of rounds is its own reason, distinct from a stall', st8.stop && st8.stop.reason === 'rounds-exhausted' && /tool rounds without a final answer/.test(reply8), { happened: JSON.stringify(st8.stop) + ' | ' + reply8.slice(0, 100), why: 'A model working steadily that simply needs more rounds is the one case where raising maxToolRounds is the right answer, and it has to be distinguishable from the model that sent nothing usable.', fix: 'Check the final return of runLoop.' });

    const st9 = fresh();
    await loop.runLoop(st9, 'say hello', { chat: scripted(['Hello.']) });
    check('a plain answer is a reason as well, so no run is left untyped', st9.stop && st9.stop.reason === 'answered' && loop.STOP_REASONS.includes(st9.stop.reason), { happened: JSON.stringify(st9.stop), why: 'A missing reason on the success path is the one that silently reads as unknown in every passing eval row.', fix: 'Check the answer return in runLoop.' });
  });

  await asyncSuite('eval stop expert', 'the scoreboard carries the reason', async () => {
    const evalMod = await import('../lib/eval.mjs');
    const task = { id: 'stop-reason-probe', name: 'a task the model never acts on', files: { 'x.txt': 'x' + NL }, prompt: 'do nothing usable', check: [process.execPath, '-e', 'process.exit(1)'] };
    const r = await evalMod.runTask(task, { chat: scripted([brokenBlock, brokenBlock, brokenBlock]), state: agentMod.newState(W, 'ollama') });
    check('a failed task says why the agent stopped, in the closed set', r.pass === false && r.stop === 'malformed-output' && loop.STOP_REASONS.includes(r.stop), { happened: JSON.stringify({ pass: r.pass, stop: r.stop, detail: r.stopDetail }), why: 'This is the whole reason for typing the exit: an eval row that fails tells you nothing unless it says whether the model could not act, ran out of rounds, or was cut off.', fix: 'Check runTask in lib/eval.mjs.' });
    check('and the report line shows it', /stopped: malformed-output/.test(evalMod.format({ results: [r], passed: 0, total: 1, ms: 10 })), { happened: evalMod.format({ results: [r], passed: 0, total: 1, ms: 10 }).split(NL)[0], why: 'A field no report prints is a field nobody reads.', fix: 'Check format in lib/eval.mjs.' });
    if (r.workspace) { try { fs.rmSync(r.workspace, { recursive: true, force: true }); } catch { /* left behind on purpose by runTask when a task fails */ } }
  });
}
