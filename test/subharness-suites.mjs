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

  suite('brief rounds expert', 'the brief asks for the fewest rounds', () => {
    const cc = brief.build({ cwd: PROJECT, session_id: sid('brief-cc'), source: 'startup' }, 'claude');
    const cx = brief.build({ cwd: PROJECT, session_id: sid('brief-cx'), source: 'startup' }, 'codex');
    check('Claude Code is told to send the edit and its check in one message', /send an edit and the command that checks it in the same message/.test(cc) && /Every tool round re-sends the whole context/.test(cc) && brief.roundsRule('claude') !== brief.roundsRule('codex'), { happened: (cc.match(/Every tool round[^\n]*/) || ['(no rounds rule)'])[0], why: 'Plain Claude Code spent a round on the check alone in every HumanEvalFix task of the study; the pair in one message saves it, and Claude Code runs them in order (probed: a Write then a PowerShell read of the file, one message, the read saw the write).', fix: 'roundsRule(host) in lib/brief.mjs.' });
    check('other hosts are not told what was only checked in Claude Code', !/same message/.test(cx) && !/same message/.test(brief.roundsRule('gemini')) && /Every tool round re-sends the whole context/.test(cx), { happened: (cx.match(/Every tool round[^\n]*/) || ['(no rounds rule)'])[0], why: 'Whether Codex or Gemini CLI run one message\'s calls in order was not checked; telling them to rely on it could run a check before its edit.', fix: 'Only host claude gets the pair clause.' });
    const taught = (cc.match(/"(Pass 1:[^"]+)"/) || [])[1] || '';
    check('the line the brief teaches satisfies the gate', Boolean(taught) && gate.PASS_RE.test(taught), { happened: taught || '(no example line in the brief)', why: 'A brief that teaches a line the gate does not accept buys the held turn it was written to save.', fix: 'Keep the example in RULES in step with PASS_RE in lib/gate.mjs.' });
  });
}
