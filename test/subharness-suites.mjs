// The sub-harness in Claude Code, held to what it costs. On 2026-09-28 Claude
// Code (Sonnet 5) ran 34 tasks with and without atlias 3.8.0 (the study is in
// D:/harness-work/runs/cc-token-study-0928). Plain Claude Code fixed a
// HumanEvalFix bug in four rounds: read, edit, check, reply. With atlias the
// same task took six, because the gate did not know `python check.py` was a
// check, said "no check ran this turn", asked for the second pass, and the
// model re-ran the passing check before replying. Each check here pins one of
// the changes that study led to.
export default async function subharnessSuites({ suite, check, core, gate, track, router, brief, PROJECT, fs, path }) {
  const sid = (n) => 'subharness-' + n;
  const BS = String.fromCharCode(92);

  suite('Codex completed check recovery', 'use trusted native execution metadata without trusting stdout labels', () => {
    const dir=path.join(path.dirname(PROJECT),'codex-check-rollouts');fs.mkdirSync(dir,{recursive:true});const command='node -e "if(2!==2)throw Error(\'bad\');"';
    const rows=(id,code=0)=>[{type:'session_meta',payload:{id}},{type:'event_msg',payload:{type:'task_started',turn_id:'turn_'+id}},{type:'event_msg',payload:{type:'item_completed',thread_id:id,turn_id:'turn_'+id,completed_at_ms:Date.now()+65000,item:{type:'CommandExecution',id:'exec_'+id,command:['pwsh','-Command',command],status:'completed',stdout:'checked',stderr:'',exit_code:code}}}];
    const save=(id,data,raw='')=>{const f=path.join(dir,id+'.jsonl');fs.writeFileSync(f,data.map((r,i)=>JSON.stringify({timestamp:new Date(Date.now()+60000+i).toISOString(),...r})).join('\n')+'\n'+raw);return f;};
    for(const code of [0,2]){const id='native-'+code;router.prompt({session_id:id,cwd:PROJECT,prompt:'verify'});track.postTool({session_id:id,cwd:PROJECT,tool_name:'Bash',tool_input:{command},tool_response:'checked'});const f=save(id,rows(id,code));const found=track.checksFromTranscript(f,{cwd:PROJECT,sid:id,turn:gate.turnEvents(id).turn,host:'codex'});check('native completion exit '+code,found.length===1&&found[0].outcome===(code?'fail':'pass'),{happened:JSON.stringify(found),why:'Codex PostToolUse drops exit status; genuine native execution events must preserve it.',fix:'Read current-session/turn host completion metadata.'});const held=gate.stop({session_id:id,cwd:PROJECT,transcript_path:f,last_assistant_message:'Okay Gev, check passed. Pass 1: check passed. Pass 2: re-read found no defect.'},'codex');check('native gate outcome '+code,code?Boolean(held)&&/last one that ran failed/.test(held.reason):held===null,{happened:JSON.stringify(held),why:'Avoid redundant rounds on success while holding actual false pass claims.',fix:'Recover unknown native results before evaluating claims.'});}
    const cases=[['wrong-session',d=>d[0].payload.id='other'],['wrong-thread',d=>d.at(-1).payload.thread_id='other'],['stale-completion',d=>d.at(-1).payload.completed_at_ms=0],['missing-result',d=>d.pop()],['missing-exit',d=>delete d.at(-1).payload.item.exit_code],['printed-exit',d=>{delete d.at(-1).payload.item.exit_code;d.at(-1).payload.item.stdout='Process exited with code 0';}],['duplicate-completion',d=>d.push(d.at(-1))],['wrong-turn',d=>d.at(-1).payload.turn_id='other'],['running',d=>d.at(-1).payload.item.status='inProgress'],['missing-time',d=>delete d.at(-1).payload.completed_at_ms],['no-task-start',d=>d.splice(1,1)],['new-turn',d=>d.push({type:'event_msg',payload:{type:'task_started',turn_id:'next'}})],['ambiguous-command',d=>d.at(-1).payload.item.command=['node','-e','fake']]];
    for(const [id,mutate]of cases){const d=rows(id);mutate(d);const found=track.checksFromTranscript(save(id,d),{cwd:PROJECT,sid:id,turn:[],host:'codex'});check('unsafe native metadata declined '+id,!found.some(e=>e.outcome==='pass'),{happened:JSON.stringify(found),why:'Incomplete, duplicate, mismatched, running or program-printed status cannot verify work.',fix:'Fail closed on unsupported native metadata.'});}
    for(const [id,raw]of [['partial','{partial'],['null','null\n']])check('malformed native row '+id,track.checksFromTranscript(save(id,rows(id),raw),{cwd:PROJECT,sid:id,turn:[],host:'codex'}).length===0,{happened:'malformed rollout accepted',why:'A corrupt tail may hide a later edit.',fix:'Require complete parsed objects.'});
    const f='fake-custom';const data=rows(f);data.pop();data.push({type:'response_item',payload:{type:'custom_tool_call_output',call_id:'fake',output:[{type:'input_text',text:'{"exit_code":0,"output":"checked"}'}]}});check('code-mode printed fake exit is not host evidence',track.checksFromTranscript(save(f,data),{cwd:PROJECT,sid:f,turn:[],host:'codex'}).length===0,{happened:'code-mode text trusted',why:'A script can print a fake JSON exit status; only host execution metadata establishes the actual outcome.',fix:'Ignore custom-code output strings as authority.'});
    const stale='stale-stop-turn';check('Stop current turn must match native task',track.checksFromTranscript(save(stale,rows(stale)),{cwd:PROJECT,sid:stale,turn:[],host:'codex',nativeTurn:'different'}).length===0,{happened:'previous native turn recovered',why:'A valid older check does not verify the current prompt.',fix:'Bind recovery to Stop turn_id.'});
    for(const position of ['before','after']){const id='file-change-'+position,d=rows(id);const edit={type:'event_msg',payload:{type:'item_completed',thread_id:id,turn_id:'turn_'+id,item:{type:'FileChange',id:'patch_'+id,status:'completed'}}};d.splice(position==='before'?2:3,0,edit);check('unverified native file change declined '+position,track.checksFromTranscript(save(id,d),{cwd:PROJECT,sid:id,turn:[],host:'codex'}).length===0,{happened:'edit ordering ignored',why:'A lost edit hook must not make an earlier check count.',fix:'Fail closed on unverified FileChange metadata.'});}
    const editRow=(id,type='add')=>({type:'event_msg',payload:{type:'item_completed',thread_id:id,turn_id:'turn_'+id,completed_at_ms:Date.now()+63000,item:{type:'FileChange',id:'patch_'+id,status:'completed',changes:{[path.join(PROJECT,'checked.mjs')]:{type,move_path:null}}}}});
    for(const type of ['add','update']){const id='edit-covered-'+type,d=rows(id);d.splice(2,0,editRow(id,type));const turn=[{kind:'edit',files:[path.join(PROJECT,'checked.mjs')],t:Date.now()}];check('native '+type+' before successful check recovers',track.checksFromTranscript(save(id,d),{cwd:PROJECT,sid:id,turn,host:'codex'}).some(e=>e.outcome==='pass'),{happened:'real edit coverage not recovered',why:'Valid native check after an observed completed edit should count.',fix:'Use genuine completed FileChange paths and preserve chronological coverage.'});}
    const late='actual-later-edit',ld=rows(late);ld.push(editRow(late));check('native edit after check invalidates earlier pass',track.checksFromTranscript(save(late,ld),{cwd:PROJECT,sid:late,turn:[],host:'codex'}).length===0,{happened:'earlier pass accepted after later edit',why:'Every edit requires a subsequent check.',fix:'Respect native edit ordering even if its hook was lost.'});
    for(const [name,mutate]of [['failed',e=>e.payload.item.status='failed'],['empty',e=>e.payload.item.changes={}],['move',e=>Object.values(e.payload.item.changes)[0].move_path='other.mjs'],['delete',e=>Object.values(e.payload.item.changes)[0].type='delete'],['thread',e=>e.payload.thread_id='other']]){const id='bad-edit-'+name,d=rows(id),e=editRow(id);mutate(e);d.splice(2,0,e);check('unsupported native edit declined '+name,track.checksFromTranscript(save(id,d),{cwd:PROJECT,sid:id,turn:[],host:'codex'}).length===0,{happened:'unknown edit accepted',why:'Unverified edit metadata cannot establish current check coverage.',fix:'Decline unsupported edit shapes.'});}
    const multi='next-turn-after-edit',md=rows(multi);md.splice(2,0,editRow(multi));md.push(...rows(multi).slice(1));check('prior turn edit does not poison current checks',track.checksFromTranscript(save(multi,md),{cwd:PROJECT,sid:multi,turn:[],host:'codex'}).some(e=>e.outcome==='pass'),{happened:'prior turn edit affects current recovery',why:'Only the current native turn can verify this prompt.',fix:'Read from the final native task_started marker.'});
    const e='later-edit';check('unseen edits prevent recovery',track.checksFromTranscript(save(e,rows(e)),{cwd:PROJECT,sid:e,turn:[{kind:'edit',files:['unseen.mjs'],t:Date.now()}],host:'codex'}).length===0,{happened:'unseen edit accepted',why:'Verification coverage must include actual changed files.',fix:'Preserve existing edit-coverage checks.'});
  });

  suite('check recognition expert', 'what counts as a check in a host session', () => {
    const yes = [
      'python check.py', 'python .' + BS + 'check.py', 'cd D:' + BS + 'w; python check.py',
      '& "C:' + BS + 'Python313' + BS + 'python.exe" check.py', 'python canitedit_check.py', 'python -u tests.py',
      'python test_parse.py', 'python parse_test.py', 'python3.13 check.py', 'sh ./run_tests.sh', 'pwsh -File .' + BS + 'check.ps1',
      'python "D:' + BS + 'my work' + BS + 'check.py"', 'python -m unittest discover', 'python -c "from main import f; assert f(2) == 3"',
    ];
    const no = ['python checkout.py', 'python main.py', 'python -c "print(1)"', 'echo check.py', 'cat check.py', 'Get-Content check.py', 'python setup.py install', 'python rechecked.py'];
    const missed = yes.filter((c) => !core.looksLikeVerification(c));
    check('a project check script run by name is a check', missed.length === 0, { happened: 'not recognised: ' + missed.join(' | '), why: 'Measured: `python check.py` ran and passed in Claude Code, the gate recorded no check, and the extra turn it forced cost 57 per cent more prompt tokens on the task.', fix: 'SCRIPT_CHECK_RE and INLINE_CHECK_RE in lib/core.mjs.' });
    const wrong = no.filter((c) => core.looksLikeVerification(c));
    check('a script that only shares a word with a check is not one', wrong.length === 0, { happened: 'counted: ' + wrong.join(' | '), why: 'A false check lets a reply claim verification it never did.', fix: 'Only the script name decides: check.py and canitedit_check.py, never checkout.py.' });

    const main = path.join(PROJECT, 'main.py');
    const runs = [
      ['python -c "from main import f; print(f(3))"', true], ['python main.py', true], ['python .' + BS + 'main.py', true], ['python -c "import main; print(main.f(1))"', true],
      ['python -c "import mainframe"', false], ['cat main.py', false], ['python -c "print(1)"', false], ['python domain.py', false],
    ];
    const off = runs.filter(([c, want]) => track.runsEditedFile(c, [main]) !== want).map(([c]) => c);
    const winPath = 'D:' + BS + 'w' + BS + 'main.py';
    const edges = track.runsEditedFile('python main.py; echo done', [main]) && track.runsEditedFile('python main.py', [winPath]) && !track.runsEditedFile('python domain.py', [winPath]);
    check('running the file this turn edited counts, naming it anywhere else does not', off.length === 0 && edges && !track.runsEditedFile('python main.py', []), { happened: 'wrong for: ' + off.join(' | '), why: 'atlias\'s own loop has always counted running an edited program as checking it; the hooks did not, so a reply that had run its code was held for having checked nothing.', fix: 'runsEditedFile in lib/track.mjs.' });

    const s0 = sid('is-check');
    router.prompt({ session_id: s0, cwd: PROJECT, prompt: 'edit main so f rounds up please' });
    const before = track.isCheck('python main.py', s0);
    track.postTool({ session_id: s0, cwd: PROJECT, tool_name: 'Edit', tool_input: { file_path: main } });
    check('isCheck counts running a file only once this turn has edited it, and a check script always', !before && track.isCheck('python main.py', s0) && track.isCheck('python check.py', s0) && !track.isCheck('git status', s0), { happened: JSON.stringify({ before, after: track.isCheck('python main.py', s0) }), why: 'Running a file nobody changed checks nothing this turn did.', fix: 'isCheck reads the turn\'s edit events.' });

    const s = sid('run-edited');
    router.prompt({ session_id: s, cwd: PROJECT, prompt: 'make f in main round up please' });
    track.postTool({ session_id: s, cwd: PROJECT, tool_name: 'Edit', tool_input: { file_path: main } });
    track.postTool({ session_id: s, cwd: PROJECT, tool_name: 'PowerShell', tool_input: { command: 'python -c "from main import f; print(f(3))"' }, tool_response: { stdout: '4', stderr: '' } });
    const ran = core.events(s).filter((e) => e.kind === 'shell').pop();
    track.postTool({ session_id: s, cwd: PROJECT, tool_name: 'PowerShell', tool_input: { command: 'python -c "print(1)"' }, tool_response: { stdout: '1', stderr: '' } });
    const other = core.events(s).filter((e) => e.kind === 'shell').pop();
    check('through the hook, the run of the edited module is recorded as a check and a print is not', ran && ran.verify === true && other && other.verify === false, { happened: JSON.stringify([ran, other]), why: 'The gate reads these events; a check recorded as none is a reply held for nothing.', fix: 'track.postTool uses isCheck(command, sid).' });
  });

  suite('gate cost expert', 'the gate does not buy a round it does not need', () => {
    const file = path.join(PROJECT, 'solution.py');
    fs.writeFileSync(file, 'def f(x):\n    return x + 1\n');
    const start = (name) => { const s = sid(name); router.prompt({ session_id: s, cwd: PROJECT, prompt: 'Fix the bug in f in solution.py please' }); return s; };
    const edit = (s) => track.postTool({ session_id: s, cwd: PROJECT, tool_name: 'Edit', tool_input: { file_path: file } });
    const checkRun = (s, stdout, stderr = '') => track.postTool({ session_id: s, cwd: PROJECT, tool_name: 'PowerShell', tool_input: { command: 'python check.py' }, tool_response: { stdout, stderr } });

    const ed = { kind: 'edit', files: ['solution.py'] };
    const ok = { kind: 'shell', verify: true, command: 'python check.py', outcome: 'unknown' };
    const ls = { kind: 'shell', verify: false, command: 'ls' };
    check('lastVerificationAfterEdit finds the last check after the last edit and nothing before it', gate.lastVerificationAfterEdit([ed, ok, ls]) === ok && gate.lastVerificationAfterEdit([ok, ed]) === null && gate.lastVerificationAfterEdit([ok]) === ok && gate.lastVerificationAfterEdit([]) === null, { happened: JSON.stringify([gate.lastVerificationAfterEdit([ed, ok, ls]), gate.lastVerificationAfterEdit([ok, ed])]), why: 'The second-pass request tells the model no tool call is needed only when this is right.', fix: 'Check lastVerificationAfterEdit in lib/gate.mjs.' });

    const a = start('after');
    edit(a); checkRun(a, 'all tests passed');
    const b = gate.stop({ session_id: a, cwd: PROJECT, last_assistant_message: 'Fixed the off-by-one. All tests pass.' });
    check('a passing check script after the edit is never called "no check ran"', b && !/no check ran/.test(b.reason), { happened: b ? b.reason.slice(0, 300) : '(not held)', why: 'That finding was false in every HumanEvalFix run of the study and cost a round each time.', fix: 'looksLikeVerification must know check scripts.' });
    check('the second pass is still asked for when the reply names one check', b && /second pass/.test(b.reason), { happened: b ? b.reason.slice(0, 200) : '(not held)', why: 'Two passes is the standing rule; the change is what it costs, not whether it holds.', fix: 'Keep the doublePass branch in gate.stop.' });
    check('and it does not ask for the passing check again', b && /already ran after the last edit \(python check\.py\)/.test(b.reason) && /no tool call is needed/.test(b.reason) && !/run the smallest real check/.test(b.reason), { happened: b ? b.reason : '(not held)', why: 'Measured: asked to "run the smallest real check", the model re-ran the check that had just passed, one more round at about 30k prompt tokens.', fix: 'The Fix line in gate.stop reads lastVerificationAfterEdit.' });

    const c = start('before');
    checkRun(c, 'all tests passed'); edit(c);
    const b2 = gate.stop({ session_id: c, cwd: PROJECT, last_assistant_message: 'Changed it.' });
    check('a check that ran before the last edit is asked for again', b2 && /run the smallest real check/.test(b2.reason) && !/already ran after the last edit/.test(b2.reason), { happened: b2 ? b2.reason.slice(-400) : '(not held)', why: 'An edit made after the last check is an edit nobody checked.', fix: 'lastVerificationAfterEdit looks only after the last edit.' });

    const d = start('failed');
    edit(d); checkRun(d, '', 'Traceback (most recent call last):\n  File "check.py", line 3\nAssertionError');
    const b3 = gate.stop({ session_id: d, cwd: PROJECT, last_assistant_message: 'Changed it.' });
    check('a check that failed after the edit is not taken for pass one', b3 && /run the smallest real check/.test(b3.reason) && !/already ran after the last edit/.test(b3.reason), { happened: b3 ? b3.reason.slice(-400) : '(not held)', why: 'A failed check is not a pass, and telling the model no tool call is needed would let it stop on red.', fix: 'The shortcut needs an outcome other than fail.' });

    const e = start('taught-line');
    edit(e); checkRun(e, 'all tests passed');
    const b4 = gate.stop({ session_id: e, cwd: PROJECT, last_assistant_message: 'Fixed the comparison.\nPass 1: python check.py passed. Pass 2: re-read the empty and boundary cases, nothing found.' });
    check('a reply that ends with the line the brief teaches is not held', b4 === null, { happened: JSON.stringify(b4), why: 'The brief now asks for that line so the second pass happens inside the first reply instead of costing a held one.', fix: 'PASS_RE must match what RULES teaches.' });
  });

  suite('cancelled hook expert', 'a check the transcript saw counts when its hook was cancelled', () => {
    // Claude Code cancelled 80 atlias hook calls in 22 of the study's 34 runs.
    // Each session here records the edit through the hook and leaves the check
    // unrecorded, as a cancelled PostToolUse does; the transcript holds what ran.
    const file = path.join(PROJECT, 'solution.py');
    fs.writeFileSync(file, 'def f(x):\n    return x + 1\n');
    const dir = path.join(path.dirname(PROJECT), 'transcripts');
    fs.mkdirSync(dir, { recursive: true });
    let n = 0;
    const prompt = (text) => ({ type: 'user', message: { role: 'user', content: text } });
    const call = (name, input) => { const id = 'toolu_' + (++n); return [id, { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id, name, input }] } }]; };
    const answer = (id, content, isError, toolUseResult) => ({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content, is_error: isError }] }, toolUseResult });
    const editRows = () => { const [id, row] = call('Edit', { file_path: file, old_string: 'x + 1', new_string: 'x + 2' }); return [row, answer(id, 'The file has been updated.', false, { filePath: file })]; };
    const shellRows = (command, stdout, fail = '') => {
      const [id, row] = call('Bash', { command });
      return [row, fail ? answer(id, 'Exit code 1\n' + fail, true, 'Error: Exit code 1\n' + fail) : answer(id, stdout, false, { stdout, stderr: '', interrupted: false, isImage: false })];
    };
    const PASSED = 'all tests passed';
    const FAILED = 'Traceback (most recent call last):\n  File "check.py", line 3\nAssertionError';
    // Claude Code stamps every row. A row is written after the hook events of
    // its turn, so a fixture is stamped after them unless a check says when.
    const write = (name, rows, raw = '', at = Date.now() + 60000) => { const p = path.join(dir, name + '.jsonl'); fs.writeFileSync(p, rows.map((r, i) => JSON.stringify({ timestamp: new Date(at + i).toISOString(), ...r })).join('\n') + '\n' + raw); return p; };
    const turn = (...parts) => [prompt('an earlier question'), ...shellRows('python check.py', PASSED), prompt('Fix the bug in f in solution.py please'), ...parts.flat()];
    const start = (name) => { const s = sid('cancel-' + name); router.prompt({ session_id: s, cwd: PROJECT, prompt: 'Fix the bug in f in solution.py please' }); track.postTool({ session_id: s, cwd: PROJECT, tool_name: 'Edit', tool_input: { file_path: file } }); return s; };
    const stop = (s, last, transcript, host) => gate.stop({ session_id: s, cwd: PROJECT, last_assistant_message: last, ...(transcript === undefined ? {} : { transcript_path: transcript }) }, host);
    const fromTranscript = (s) => core.events(s).filter((e) => e.from === 'transcript');
    const reasonOf = (b) => (b ? b.reason : '(not held)');
    const TAUGHT = 'Fixed the comparison.\nPass 1: python check.py passed. Pass 2: re-read the empty and boundary cases, nothing found.';
    const ONE = 'Fixed the off-by-one. All tests pass.';

    const passing = write('passing', turn(editRows(), shellRows('python check.py', PASSED)));
    const calls = track.transcriptTurn(passing);
    check('the transcript turn starts at the last prompt and pairs each call with its result', Array.isArray(calls) && calls.length === 2 && calls[0].name === 'Edit' && calls[1].name === 'Bash' && calls[1].result && calls[1].result.block.is_error === false, { happened: JSON.stringify(calls && calls.map((c) => [c.name, Boolean(c.result)])), why: 'A call from the turn before, or one with no result, would be taken for a check of this turn.', fix: 'transcriptTurn in lib/track.mjs.' });
    const bad = track.transcriptVerdict({ block: { is_error: true, content: 'Exit code 1\n' + FAILED }, row: {} });
    const quiet = track.transcriptVerdict({ block: { is_error: true, content: 'Exit code 2\nno such option' }, row: {} });
    const good = track.transcriptVerdict({ block: { is_error: false, content: PASSED }, row: { toolUseResult: { stdout: PASSED, stderr: '' } } });
    check('a transcript result is judged by the rules the hooks use', bad.outcome === 'fail' && /Traceback/.test(bad.excerpt) && quiet.outcome === 'fail' && good.outcome !== 'fail', { happened: JSON.stringify([bad, quiet, good]), why: 'A failed check read as a pass would let a reply stop on red.', fix: 'transcriptVerdict: is_error with an exit code goes to integrity.verdict, anything else as PostToolUse would.' });

    const base = start('none');
    const held = stop(base, TAUGHT);
    const a = start('pass');
    const b = stop(a, TAUGHT, passing);
    check('a passing check in the transcript is not held when its hook was cancelled', Boolean(held) && /nothing was run to check it after the last edit/.test(held.reason) && b === null && fromTranscript(a).length === 1 && fromTranscript(a)[0].verify === true, { happened: `without the transcript: ${reasonOf(held).slice(0, 160)} | with it: ${reasonOf(b).slice(0, 160)}`, why: 'The held reply is one more full-context round for a check that ran; in the study that was 80 cancelled hook calls in 22 of 34 runs.', fix: 'gate.stop calls track.recoverChecks before it says no check ran.' });
    const a2 = start('pass-one');
    const b2 = stop(a2, ONE, passing);
    const r2 = track.recoverChecks({ session_id: a2, cwd: PROJECT, transcript_path: passing }, [{ kind: 'edit', files: [file] }]);
    check('and the recovered check is recorded, so the second pass knows it ran', Boolean(b2) && !/no check ran/.test(b2.reason) && /already ran after the last edit \(python check\.py\)/.test(b2.reason) && r2.length === 1 && core.events(a2).filter((e) => e.kind === 'shell' && e.verify).length >= 1, { happened: reasonOf(b2).slice(0, 400), why: 'Later logic reads the event log; a check found only in memory would be "none recorded" to it.', fix: 'recoverChecks records the event and adds it to the turn in hand.' });

    const c = start('fail');
    const failing = write('failing', turn(editRows(), shellRows('python check.py', '', FAILED)));
    const b3 = stop(c, ONE, failing);
    check('a failing check in the transcript is still reported as failing', Boolean(b3) && /the last one that ran failed/.test(b3.reason) && /Traceback/.test(b3.reason) && !/no check ran/.test(b3.reason) && fromTranscript(c).length === 1 && fromTranscript(c)[0].outcome === 'fail', { happened: reasonOf(b3).slice(0, 300), why: 'Recovering the check must recover its result; a failure turned into "no check ran" or into a pass hides the red run.', fix: 'checksFromTranscript takes the outcome from transcriptVerdict.' });

    // The later edit's hook was cancelled too: only the transcript shows it.
    const d = start('edit-after');
    const later = write('edit-after', turn(editRows(), shellRows('python check.py', PASSED), editRows()));
    const b4 = stop(d, 'Fixed it.', later);
    check('an edit after the check in the transcript is still an unchecked edit', Boolean(b4) && /nothing was run to check it after the last edit/.test(b4.reason) && fromTranscript(d).length === 0 && track.transcriptTurn(later).length === 3, { happened: reasonOf(b4).slice(0, 300), why: 'An edit made after the last check is an edit nobody checked, whichever of the two the log missed.', fix: 'checksFromTranscript looks only after the transcript\'s last edit.' });

    // A subagent's edit reaches the log through its own hook but not the main
    // transcript: Claude Code writes a subagent's transcript to a file of its
    // own. The log's order decides, and a row with no time cannot be placed.
    const until = (t) => { while (Date.now() <= t); };
    const h = start('subagent-after');
    const [subId, subRow] = call('Agent', { description: 'tidy', prompt: 'Tidy solution.py' });
    until(core.events(h).filter((e) => e.kind === 'edit').pop().t);
    const at = Date.now();
    const subagent = write('subagent-after', turn(editRows(), shellRows('python check.py', PASSED), [subRow, answer(subId, 'Done.', false, {})]), '', at);
    until(at + 20);
    track.postTool({ session_id: h, cwd: PROJECT, tool_name: 'Edit', tool_input: { file_path: file } });
    const b7 = stop(h, TAUGHT, subagent);
    const k = start('unstamped');
    const unstamped = path.join(dir, 'unstamped.jsonl');
    fs.writeFileSync(unstamped, turn(editRows(), shellRows('python check.py', PASSED)).map((r) => JSON.stringify(r)).join('\n') + '\n');
    const b8 = stop(k, TAUGHT, unstamped);
    check('a check the transcript cannot place after the log\'s last edit is not counted', Boolean(b7) && /nothing was run to check it after the last edit/.test(b7.reason) && fromTranscript(h).length === 0 && reasonOf(b8) === reasonOf(held) && fromTranscript(k).length === 0, { happened: `subagent edit after the check: ${reasonOf(b7).slice(0, 160)} | no timestamps: ${reasonOf(b8).slice(0, 160)}`, why: 'An edit a subagent made after the check is in the log and not in the main transcript; counting the check would pass an edit nobody checked.', fix: 'checksFromTranscript counts only a result stamped after the last edit the log recorded.' });

    const e = start('recorded');
    track.postTool({ session_id: e, cwd: PROJECT, tool_name: 'Bash', tool_input: { command: 'python check.py' }, tool_response: { stdout: PASSED, stderr: '' } });
    const e0 = start('recorded-base');
    track.postTool({ session_id: e0, cwd: PROJECT, tool_name: 'Bash', tool_input: { command: 'python check.py' }, tool_response: { stdout: PASSED, stderr: '' } });
    const b5 = stop(e, ONE, failing);
    const b5base = stop(e0, ONE);
    check('a check the hook recorded is left as it was', reasonOf(b5) === reasonOf(b5base) && fromTranscript(e).length === 0 && track.checksFromTranscript(failing, { cwd: PROJECT, sid: e, turn: [{ kind: 'edit', files: [file] }] }).length === 1, { happened: `${reasonOf(b5).slice(0, 200)} | ${reasonOf(b5base).slice(0, 200)}`, why: 'The transcript is a fallback for a missing record, not a second opinion on one.', fix: 'gate.stop reads the transcript only when lastVerificationAfterEdit finds nothing.' });

    const garbled = write('garbled', turn(editRows(), shellRows('python check.py', PASSED)).slice(0, -1), '{"type":"user","message":{"role":"user","content":[{"type":"tool_re\n');
    const truncated = write('truncated', turn(editRows(), shellRows('python check.py', PASSED)), '{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_x","name":"Edit","input":{"file_pa');
    const filler = [prompt('an earlier question'), prompt('Fix the bug in f in solution.py please'), ...editRows()];
    for (let i = 0; i < 6; i++) { const [id, row] = call('Read', { file_path: file }); filler.push(row, answer(id, 'x'.repeat(400 * 1024), false, {})); }
    const huge = write('huge', filler.concat(shellRows('python check.py', PASSED)));
    const missing = path.join(dir, 'never-written.jsonl');
    const cases = { missing, garbled, truncated, huge, 'another host': passing };
    const off = [];
    for (const [name, p] of Object.entries(cases)) {
      const s = start('as-before-' + name.replace(/ /g, '-'));
      const r = stop(s, TAUGHT, p, name === 'another host' ? 'codex' : undefined);
      if (reasonOf(r) !== reasonOf(held) || fromTranscript(s).length) off.push(`${name}: ${reasonOf(r).slice(0, 120)}`);
    }
    const nothing = ['missing', 'garbled', 'truncated'].every((k) => track.transcriptTurn(cases[k]) === null) && track.checksFromTranscript(huge, { cwd: PROJECT, sid: sid('huge'), turn: [{ kind: 'edit', files: [file] }] }).length === 0;
    check('a transcript that is missing, garbled, cut mid-line, too big to hold the turn, or another host\'s changes nothing', off.length === 0 && nothing, { happened: off.join(' | ') || `transcriptTurn or checksFromTranscript still answered (nothing=${nothing})`, why: 'A half-written line can be the edit after the check, and a tail that lost the edit cannot say what came after it; guessing there would pass an unchecked edit.', fix: 'transcriptTurn returns null on any line that does not parse; checksFromTranscript wants every recorded edit in view; gate.stop reads Claude Code transcripts only.' });

    const f = start('not-checks');
    const other = write('not-checks', turn(editRows(), shellRows('python main.py', '4'), shellRows('python -c "print(1)"', '1')));
    const b6 = stop(f, 'Fixed it.', other);
    const g = sid('cancel-module-run');
    router.prompt({ session_id: g, cwd: PROJECT, prompt: 'Fix the bug in f in solution.py please' });
    const moduleRun = write('module-run', turn(editRows(), shellRows('python -c "from solution import f; print(f(3))"', '5')));
    const viaEdit = track.checksFromTranscript(moduleRun, { cwd: PROJECT, sid: g, turn: [] });
    check('running an unedited file or a bare print is not a check; running the file the transcript edited is', Boolean(b6) && /nothing was run to check it after the last edit/.test(b6.reason) && fromTranscript(f).length === 0 && track.checksFromTranscript(other, { cwd: PROJECT, sid: f, turn: [] }).length === 0 && viaEdit.length === 1, { happened: `${reasonOf(b6).slice(0, 160)} | module run found ${viaEdit.length}`, why: 'The transcript is judged by track.isCheck, the rule the hooks and the agent loop use, with the transcript\'s own edits counted as this turn\'s.', fix: 'checksFromTranscript calls isCheck(command, sid, edited).' });
  });

  suite('brief rounds expert', 'the brief asks for the fewest rounds', () => {
    const cc = brief.build({ cwd: PROJECT, session_id: sid('brief-cc'), source: 'startup' }, 'claude');
    const cx = brief.build({ cwd: PROJECT, session_id: sid('brief-cx'), source: 'startup' }, 'codex');
    check('Claude Code is told to send the edit and its check in one message', /send an edit and the command that checks it in the same message/.test(cc) && /Every tool round re-sends the whole context/.test(cc) && brief.roundsRule('claude') !== brief.roundsRule('codex'), { happened: (cc.match(/Every tool round[^\n]*/) || ['(no rounds rule)'])[0], why: 'Plain Claude Code spent a round on the check alone in every HumanEvalFix task of the study; the pair in one message saves it, and Claude Code runs them in order (probed: a Write then a PowerShell read of the file, one message, the read saw the write).', fix: 'roundsRule(host) in lib/brief.mjs.' });
    check('other hosts are not told what was only checked in Claude Code', !/same message/.test(cx) && !/same message/.test(brief.roundsRule('gemini')) && /Every tool round re-sends the whole context/.test(cx), { happened: (cx.match(/Every tool round[^\n]*/) || ['(no rounds rule)'])[0], why: 'Whether Codex or Gemini CLI run one message\'s calls in order was not checked; telling them to rely on it could run a check before its edit.', fix: 'Only host claude gets the pair clause.' });
    const taught = (cc.match(/"(Pass 1:[^"]+)"/) || [])[1] || '';
    check('the line the brief teaches satisfies the gate', Boolean(taught) && gate.PASS_RE.test(taught), { happened: taught || '(no example line in the brief)', why: 'A brief that teaches a line the gate does not accept buys the held turn it was written to save.', fix: 'Keep the example in RULES in step with PASS_RE in lib/gate.mjs.' });
  });
}
