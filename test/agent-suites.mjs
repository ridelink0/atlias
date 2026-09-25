// The agent's own tool loop, the OpenAI-compatible engine, the modes and the
// settings, each in a suite of its own. Loaded by test/run.mjs, which owns
// suite(), asyncSuite() and check(). The model is scripted here, so every
// behaviour the loop promises a weak model is exercised without one.
import http from 'node:http';
import * as loop from '../lib/loop.mjs';
import * as settings from '../lib/settings.mjs';

export default async function agentSuites({ suite, asyncSuite, check, core, agentMod, hookRun, PROJECT, TMP, ROOT, fs, path, spawnSync }) {
  const W = path.join(TMP, 'loop-work');
  fs.mkdirSync(W, { recursive: true });
  const NL = String.fromCharCode(10);
  const BS = String.fromCharCode(92);
  const FENCE = '`'.repeat(3);
  const blk = (o) => FENCE + 'atlias' + NL + JSON.stringify(o) + NL + FENCE;
  const fresh = (engine = 'ollama') => agentMod.newState(W, engine);
  // A model that says exactly what the test tells it to, and remembers what
  // it was shown each round.
  const scripted = (replies, seen) => async (messages, tools) => {
    seen.push({ messages: JSON.parse(JSON.stringify(messages)), tools });
    const r = replies.shift();
    if (r === undefined) return { content: 'out of script', calls: [] };
    return typeof r === 'string' ? { content: r, calls: [] } : r;
  };

  suite('tool call repair expert', 'repairing what weak models write', () => {
    const cases = [
      ['single quotes and a trailing comma', "{'tool': 'read_file', 'path': 'a.js',}", (c) => c.tool === 'read_file' && c.path === 'a.js'],
      ['bare keys', '{tool: "shell", command: "npm test"}', (c) => c.tool === 'shell' && c.command === 'npm test'],
      ['Python literals', '{"tool":"todo","items":[{"text":"a","done":False}]}', (c) => c.items[0].done === false],
      ['an object cut off at the token limit', '{"tool":"write_file","path":"a.txt","content":"hello', (c) => c.content === 'hello'],
      ['a raw newline inside a string', '{"tool":"write_file","path":"a.txt","content":"one' + NL + 'two"}', (c) => c.content === 'one' + NL + 'two'],
      ['a regex escape JSON does not allow', '{"tool":"grep","pattern":"' + BS + 'd+"}', (c) => c.pattern === BS + 'd+'],
      ['commas and colons inside a string are left alone', '{"tool":"shell","command":"echo a, b: c",}', (c) => c.command === 'echo a, b: c'],
      ['an apostrophe inside a double-quoted string', '{"tool":"shell","command":"echo it' + "'" + 's"}', (c) => c.command === "echo it's"],
    ];
    for (const [label, raw, ok] of cases) {
      const call = loop.normalizeCall(loop.repairJson(raw));
      check(`repairs ${label}`, Boolean(call) && ok(call), { happened: JSON.stringify(call), why: 'Small models write this shape constantly; a parser that gives up on it turns a correct intention into a wasted round.', fix: 'Check normalizeJson in lib/loop.mjs.' });
    }
    const aliased = loop.parseToolCall('{"name":"bash","arguments":{"cmd":"npm test"}}');
    check('a foreign tool name and argument name are mapped onto ours', aliased && aliased.tool === 'shell' && aliased.command === 'npm test', { happened: JSON.stringify(aliased), why: 'Models trained on other harnesses call bash, str_replace and file_path; refusing them teaches nothing.', fix: 'Check TOOL_ALIASES and ARG_ALIASES.' });
    const tagged = loop.parseToolCall('<tool_call>{"name":"read_file","arguments":"{' + BS + '"path' + BS + '":' + BS + '"a.js' + BS + '"}"}</tool_call>');
    check('arguments sent as a JSON string inside a tool_call tag are read', tagged && tagged.tool === 'read_file' && tagged.path === 'a.js', { happened: JSON.stringify(tagged), why: 'That is how Hermes-style and Qwen-style models write calls.', fix: 'normalizeCall repairs string arguments.' });
    check('a json fence naming one of our tools is a call', (loop.parseToolCall('ok' + NL + FENCE + 'json' + NL + '{"tool":"list_dir","path":"."}' + NL + FENCE) || {}).tool === 'list_dir', { happened: 'not parsed', why: 'Weak models label the fence json more often than atlias.', fix: 'Accept any fence when the tool is ours.' });
    check('a JSON example in an answer is not run', loop.parseToolCall('Your package.json:' + NL + FENCE + 'json' + NL + '{"name":"app","version":"1.0.0"}' + NL + FENCE) === null, { happened: 'parsed as a call', why: 'Running a tool nobody asked for is worse than missing one.', fix: 'Outside an atlias fence the tool must be one of ours.' });
    check('code in an answer is not run', loop.parseToolCall(FENCE + 'js' + NL + 'const x = { a: 1 };' + NL + FENCE) === null, { happened: 'parsed as a call', why: 'Same reason.', fix: 'Require a tool or function name.' });
    const remember = loop.parseToolCall(blk({ tool: 'remember', name: 'n1', type: 'project', description: 'd', body: 'b' }));
    check('a tool argument called name is kept', remember && remember.tool === 'remember' && remember.name === 'n1', { happened: JSON.stringify(remember), why: 'remember takes a name; treating it as the tool name loses the memory.', fix: 'Only read name as the tool when there is no tool key.' });
    const bad = loop.normalizeCall({ function: { name: 'read_file', arguments: '{{{nope' } });
    check('arguments that cannot be repaired are flagged, not guessed', bad && bad._badArgs === '{{{nope', { happened: JSON.stringify(bad), why: 'The model has to be told its arguments were unreadable, or it will think the tool ran.', fix: 'Keep _badArgs when repair fails.' });
  });

  await asyncSuite('reading expert', 'reading in windows', async () => {
    const state = fresh();
    const big = path.join(W, 'big.txt');
    fs.writeFileSync(big, Array.from({ length: 1000 }, (_, i) => 'line ' + (i + 1)).join(NL) + NL);
    const first = await loop.runTool(state, { tool: 'read_file', path: 'big.txt' });
    check('a long file comes back as a numbered window', /lines 1-400 of 1000/.test(first) && first.includes('1' + '\t' + 'line 1') && /offset 401 to continue/.test(first) && !first.includes('line 401'), { happened: first.slice(0, 80) + ' ... ' + first.slice(-80), why: 'A whole large file floods the context; a window with a way to the next one does not.', fix: 'Check the read_file window in runTool.' });
    const tail = await loop.runTool(state, { tool: 'read_file', path: 'big.txt', offset: 990, limit: 50 });
    check('a window at the end stops at the end', /lines 990-1000 of 1000/.test(tail) && !/more lines/.test(tail), { happened: tail.slice(0, 80), why: 'An off-by-one here reads as a missing line.', fix: 'Clamp end to the line count.' });
    const again = await loop.runTool(state, { tool: 'read_file', path: 'big.txt', offset: 990, limit: 50 });
    check('the same window read again unchanged is not sent twice', /unchanged since you read it/.test(again), { happened: again.slice(0, 80), why: 'Re-reading is the commonest waste in a weak model\'s context.', fix: 'Check the reads map in runTool.' });
    fs.appendFileSync(big, 'line 1001' + NL);
    const changed = await loop.runTool(state, { tool: 'read_file', path: 'big.txt', offset: 990, limit: 50 });
    check('a file that changed is read again in full', /lines 990-1001 of 1001/.test(changed), { happened: changed.slice(0, 80), why: 'A stale "unchanged" would hide the very edit being checked.', fix: 'Compare mtime and size.' });
    check('an offset past the end says so', /past the end/.test(await loop.runTool(state, { tool: 'read_file', path: 'big.txt', offset: 5000 })), { happened: 'no message', why: 'An empty result reads as an empty file.', fix: 'Return the line count.' });
    check('a missing file says what to do', /there is no .*list_dir or grep/.test(await loop.runTool(state, { tool: 'read_file', path: 'nope/missing.js' })), { happened: 'no guidance', why: 'A bare ENOENT teaches the model nothing.', fix: 'Map ENOENT to a message with a next step.' });
    check('a directory is pointed at list_dir', /is a directory; use list_dir/.test(await loop.runTool(state, { tool: 'read_file', path: '.' })), { happened: 'no guidance', why: 'EISDIR is not a message a model can act on.', fix: 'Check isDirectory first.' });
  });

  await asyncSuite('editing expert', 'editing by exact replacement', async () => {
    const state = fresh();
    const e = path.join(W, 'e.mjs');
    fs.writeFileSync(e, 'export const a = 1;' + NL + 'export const b = 2;' + NL);
    const ok = await loop.runTool(state, { tool: 'edit_file', path: 'e.mjs', old_string: 'export const a = 1;', new_string: 'export const a = 10;' });
    check('an exact match is replaced and recorded', /edited e\.mjs/.test(ok) && fs.readFileSync(e, 'utf8').includes('a = 10;') && core.events(state.sid).some((x) => x.kind === 'edit' && x.tool === 'edit_file'), { happened: ok, why: 'The gate and the handoff note only see edits that are recorded.', fix: 'Check edit_file in runTool.' });
    check('the edit shows the changed lines back', ok.includes('1' + '\t' + 'export const a = 10;'), { happened: ok, why: 'Seeing the result lets the model catch its own mistake without another read.', fix: 'Keep snippetAround in the reply.' });
    const miss = await loop.runTool(state, { tool: 'edit_file', path: 'e.mjs', old_string: '    export const b = 2;', new_string: 'export const b = 3;' });
    check('a near miss names the line it probably meant', /was not found/.test(miss) && /line 2/.test(miss), { happened: miss, why: 'Wrong indentation is the usual miss; pointing at the line saves a search.', fix: 'Match the trimmed first line.' });
    const numbered = await loop.runTool(state, { tool: 'edit_file', path: 'e.mjs', old_string: '2' + '\t' + 'export const b = 2;', new_string: '2' + '\t' + 'export const b = 20;' });
    check('line numbers copied from a read are stripped', /edited/.test(numbered) && fs.readFileSync(e, 'utf8').includes('b = 20;') && !fs.readFileSync(e, 'utf8').includes('\t'), { happened: numbered, why: 'Copying the number column is the commonest way a weak model breaks an edit.', fix: 'Retry without the NUM prefix.' });
    const before = fs.readFileSync(e, 'utf8');
    const broken = await loop.runTool(state, { tool: 'edit_file', path: 'e.mjs', old_string: 'export const b = 20;', new_string: 'export const b = ;' });
    check('an edit that would break the syntax is refused and undone', /refused/.test(broken) && fs.readFileSync(e, 'utf8') === before, { happened: broken, why: 'A broken file breaks every later check; the harness should never leave one behind.', fix: 'Check guardedWrite.' });
    const e2 = path.join(W, 'e2.mjs');
    fs.writeFileSync(e2, 'export const a = ;' + NL);
    const fix = await loop.runTool(state, { tool: 'edit_file', path: 'e2.mjs', old_string: 'export const a = ;', new_string: 'export const a = 1;' });
    check('an edit to a file that was already broken is kept', /edited/.test(fix) && !/still does not parse/.test(fix) && fs.readFileSync(e2, 'utf8').includes('a = 1;'), { happened: fix, why: 'Refusing edits to broken files would refuse the fix.', fix: 'Only undo when the file parsed before.' });
    const dup = path.join(W, 'dup.txt');
    fs.writeFileSync(dup, 'x();' + NL + 'x();' + NL);
    const two = await loop.runTool(state, { tool: 'edit_file', path: 'dup.txt', old_string: 'x();', new_string: 'y();' });
    check('an ambiguous match is refused with the lines it matched', /matches 2 places/.test(two) && /lines 1, 2/.test(two) && fs.readFileSync(dup, 'utf8') === 'x();' + NL + 'x();' + NL, { happened: two, why: 'Replacing the wrong one of two is a silent bug.', fix: 'Count matches before replacing.' });
    const all = await loop.runTool(state, { tool: 'edit_file', path: 'dup.txt', old_string: 'x();', new_string: 'y();', replace_all: true });
    check('replace_all changes every match', /in 2 places/.test(all) && fs.readFileSync(dup, 'utf8') === 'y();' + NL + 'y();' + NL, { happened: all, why: 'Renames need it.', fix: 'Check the replace_all branch.' });
    const crlf = path.join(W, 'crlf.txt');
    fs.writeFileSync(crlf, 'a\r\nb\r\n');
    const cr = await loop.runTool(state, { tool: 'edit_file', path: 'crlf.txt', old_string: 'a' + NL + 'b', new_string: 'a' + NL + 'c' });
    check('a file with Windows line endings still matches and keeps them', /edited/.test(cr) && fs.readFileSync(crlf, 'utf8') === 'a\r\nc\r\n', { happened: JSON.stringify(fs.readFileSync(crlf, 'utf8')), why: 'Models always write a bare newline; a CRLF file would otherwise never match.', fix: 'Fit old and new strings to the file\'s line ending.' });
    const w = await loop.runTool(state, { tool: 'write_file', path: 'e.mjs', content: 'export const = ;' });
    check('a whole-file write that breaks a parsing file is refused too', /refused/.test(w) && fs.readFileSync(e, 'utf8') === before, { happened: w, why: 'Same guard, other door.', fix: 'write_file goes through guardedWrite.' });
    await loop.runTool(state, { tool: 'read_file', path: 'dup.txt' });
    await loop.runTool(state, { tool: 'edit_file', path: 'dup.txt', old_string: 'y();' + NL + 'y();', new_string: 'z();' + NL + 'z();' });
    const reread = await loop.runTool(state, { tool: 'read_file', path: 'dup.txt' });
    check('a read after the agent\'s own edit is never answered from the dedupe', !/unchanged/.test(reread) && reread.includes('z();'), { happened: reread.slice(0, 120), why: 'Two writes inside one millisecond with the same size look identical by mtime and size.', fix: 'forgetReads on every edit and write.' });
  });

  await asyncSuite('output expert', 'long output keeps its end', async () => {
    const long = 'x'.repeat(50000) + NL + 'FAIL the last line';
    const cut = loop.elide(long, 1000);
    check('the end of long output survives', cut.includes('FAIL the last line') && /cut from the middle/.test(cut) && cut.length < 1200, { happened: cut.length + ' characters, end kept: ' + cut.includes('FAIL the last line'), why: 'Test summaries and stack traces come last; a head-only clip throws away the one line that matters.', fix: 'Check elide.' });
    check('short output is untouched', loop.elide('short', 1000) === 'short', { happened: loop.elide('short', 1000), why: 'Nothing to cut.', fix: 'Return early under the limit.' });
    const state = fresh();
    const node = JSON.stringify(process.execPath);
    const out = await loop.runTool(state, { tool: 'shell', command: `${node} -e "process.stdout.write('a'.repeat(30000)+'the error is here')"` });
    check('a shell command with a long output keeps its last line', out.includes('the error is here') && out.startsWith('exit 0'), { happened: out.slice(0, 40) + ' ... ' + out.slice(-60), why: 'Same reason, through the real tool.', fix: 'shell runs its output through elide.' });
    fs.writeFileSync(path.join(W, 'bad.mjs'), 'export const = 1;' + NL);
    const failed = await loop.runTool(state, { tool: 'shell', command: `${node} --check bad.mjs` });
    const ev = core.events(state.sid).filter((x) => x.kind === 'shell').pop();
    check('a failing check is recorded as a failure', /^exit 1/.test(failed) && ev && ev.verify === true && ev.outcome === 'fail', { happened: JSON.stringify(ev), why: 'The gate refuses a pass claim after a failing run only if the failure was recorded.', fix: 'shell records integrity.verdict for checks.' });
  });

  await asyncSuite('patch expert', 'apply_patch, the Codex edit format', async () => {
    const P = path.join(W, 'patchwork');
    fs.mkdirSync(P, { recursive: true });
    const st = agentMod.newState(P, 'openai');
    fs.writeFileSync(path.join(P, 'a.mjs'), ['export function one() {', '  return 1;', '}', '', 'export function two() {', '  return 2;', '}', ''].join(NL));
    fs.writeFileSync(path.join(P, 'old.txt'), 'bye' + NL);
    fs.writeFileSync(path.join(P, 'move.txt'), 'x' + NL);
    const patch = ['*** Begin Patch', '*** Update File: a.mjs', '@@ export function two() {', '-  return 2;', '+  return 22;', '*** Add File: new.txt', '+hello', '+world', '*** Delete File: old.txt', '*** Update File: move.txt', '*** Move to: moved.txt', '-x', '+y', '*** End Patch'].join(NL);
    const out = await loop.runTool(st, { tool: 'apply_patch', input: patch });
    const a = fs.readFileSync(path.join(P, 'a.mjs'), 'utf8');
    check('one patch adds, updates, deletes and renames', /^Success\. Updated the following files:/.test(out) && a.includes('return 22;') && a.includes('return 1;') && fs.readFileSync(path.join(P, 'new.txt'), 'utf8') === 'hello' + NL + 'world' + NL && !fs.existsSync(path.join(P, 'old.txt')) && !fs.existsSync(path.join(P, 'move.txt')) && fs.readFileSync(path.join(P, 'moved.txt'), 'utf8') === 'y' + NL, { happened: out, why: 'This is the edit format GPT models are trained on; every section type has to land.', fix: 'Check parsePatch, applyUpdate and the apply_patch case.' });
    check('the answer uses the Codex wording models expect', /M a\.mjs/.test(out) && /A new\.txt/.test(out) && /D old\.txt/.test(out) && /M moved\.txt/.test(out), { happened: out, why: 'A model trained on Codex reads that exact reply as success.', fix: 'Keep the Success. Updated the following files: format.' });
    check('the patch is recorded as an edit of every file it touched', core.events(st.sid).some((e) => e.kind === 'edit' && e.tool === 'apply_patch' && e.files.length === 5), { happened: JSON.stringify(core.events(st.sid).filter((e) => e.kind === 'edit')), why: 'The gate checks what was recorded.', fix: 'Record every file in originals.' });
    const undone = loop.undo(st);
    check('undo puts back every file one patch touched', /restored/.test(undone) && fs.readFileSync(path.join(P, 'a.mjs'), 'utf8').includes('return 2;') && fs.existsSync(path.join(P, 'old.txt')) && fs.existsSync(path.join(P, 'move.txt')) && !fs.existsSync(path.join(P, 'new.txt')) && !fs.existsSync(path.join(P, 'moved.txt')), { happened: undone, why: 'A patch is one change, so it is one undo.', fix: 'pushUndo the originals map.' });
    check('undo with nothing left says so', loop.undo(st) === 'nothing to undo', { happened: loop.undo(st), why: 'Silence reads as success.', fix: 'Check undo.' });
    const loose = ['*** Begin Patch', '*** Update File: a.mjs', ' export function one() {', '-  return 1;    ', '+  return 11;', '*** End Patch'].join(NL);
    fs.writeFileSync(path.join(P, 'a.mjs'), fs.readFileSync(path.join(P, 'a.mjs'), 'utf8').replace('  return 1;', '  return 1;'));
    const r2 = await loop.runTool(st, { tool: 'apply_patch', input: loose });
    check('trailing spaces in the patch do not stop it matching', /Success/.test(r2) && fs.readFileSync(path.join(P, 'a.mjs'), 'utf8').includes('return 11;'), { happened: r2, why: 'Weak models add and drop trailing whitespace; Codex matches past it too.', fix: 'Check seekLines passes.' });
    const before = fs.readFileSync(path.join(P, 'a.mjs'), 'utf8');
    const atomic = ['*** Begin Patch', '*** Update File: a.mjs', '-  return 11;', '+  return 111;', '*** Update File: missing.mjs', '-x', '+y', '*** End Patch'].join(NL);
    const r3 = await loop.runTool(st, { tool: 'apply_patch', input: atomic });
    check('a patch that fails anywhere changes nothing anywhere', /not applied/.test(r3) && /Nothing was changed/.test(r3) && fs.readFileSync(path.join(P, 'a.mjs'), 'utf8') === before, { happened: r3, why: 'Half a patch is a broken tree the model then has to discover.', fix: 'Plan every file before writing any.' });
    const nf = ['*** Begin Patch', '*** Update File: a.mjs', '-  return 999;', '+  return 1;', '*** End Patch'].join(NL);
    const r4 = await loop.runTool(st, { tool: 'apply_patch', input: nf });
    check('lines that are not in the file are named in the refusal', /these lines were not found/.test(r4) && /return 999/.test(r4), { happened: r4, why: 'Naming the missing lines is how the model fixes the patch in one try.', fix: 'Check the applyUpdate error.' });
    const breaking = ['*** Begin Patch', '*** Add File: fine.mjs', '+export const ok = 1;', '*** Update File: a.mjs', '-  return 11;', '+  return ;;(', '*** End Patch'].join(NL);
    const r5 = await loop.runTool(st, { tool: 'apply_patch', input: breaking });
    check('a patch that would break the syntax is refused and fully rolled back', /refused/.test(r5) && fs.readFileSync(path.join(P, 'a.mjs'), 'utf8') === before && !fs.existsSync(path.join(P, 'fine.mjs')), { happened: r5, why: 'The file added earlier in the same patch must go too.', fix: 'rollback() every file in originals.' });
    const viaShell = await loop.runTool(st, { tool: 'shell', command: ['apply_patch', ['*** Begin Patch', '*** Add File: shell.txt', '+from the shell', '*** End Patch'].join(NL)] });
    check('apply_patch sent through the shell, the way Codex models do, is applied', /Success/.test(viaShell) && fs.existsSync(path.join(P, 'shell.txt')), { happened: viaShell, why: 'Codex prompts teach {"command":["apply_patch", ...]}; running that as a program would fail.', fix: 'Intercept it in the shell case.' });
    const heredoc = await loop.runTool(st, { tool: 'shell', command: "apply_patch <<'EOF'" + NL + '*** Begin Patch' + NL + '*** Add File: here.txt' + NL + '+doc' + NL + '*** End Patch' + NL + 'EOF' });
    check('and as a heredoc', /Success/.test(heredoc) && fs.readFileSync(path.join(P, 'here.txt'), 'utf8') === 'doc' + NL, { happened: heredoc, why: 'The other common shape.', fix: 'Take the text from Begin Patch on.' });
    const bashArgv = await loop.runTool(st, { tool: 'shell', command: ['bash', '-lc', 'echo argv-ok'] });
    check('a Codex argv command runs its script, not the word bash', /argv-ok/.test(bashArgv) || /exit 127|not recognized|not found/.test(bashArgv), { happened: bashArgv.slice(0, 120), why: 'Joining ["bash","-lc","echo x"] with spaces loses the quoting.', fix: 'Unwrap bash -lc.' });
    check('a patch with no Begin line is refused with the format', /no "\*\*\* Begin Patch" line/.test(await loop.runTool(st, { tool: 'apply_patch', input: 'just some text' })), { happened: 'no format guidance', why: 'The model needs the shape to try again.', fix: 'Check parsePatch.' });
    const twice = ['*** Begin Patch', '*** Update File: a.mjs', '-  return 11;', '+  return 12;', '*** Update File: a.mjs', '-  return 12;', '+  return 13;', '*** End Patch'].join(NL);
    const r6 = await loop.runTool(st, { tool: 'apply_patch', input: twice });
    const parsed = loop.parsePatch(['*** Begin Patch', '*** Update File: x.js', '@@ ctx', ' keep', '-old', '+new', '*** End of File', '*** Delete File: y.js', '*** End Patch'].join('\r\n'));
    check('parsePatch reads sections, context, ops and end-of-file markers, CRLF included', parsed.hunks && parsed.hunks[0].type === 'update' && parsed.hunks[0].chunks[0].context === 'ctx' && parsed.hunks[0].chunks[0].eof === true && parsed.hunks[0].chunks[0].lines.map((l) => l.op).join('') === ' -+' && parsed.hunks[1].type === 'delete', { happened: JSON.stringify(parsed), why: 'Everything else rests on reading the patch right.', fix: 'Check parsePatch.' });
    const upd = loop.applyUpdate('a\r\nb\r\nc\r\n', [{ context: null, lines: [{ op: '-', text: 'b' }, { op: '+', text: 'B' }], eof: false }, { context: null, lines: [{ op: '+', text: 'tail' }], eof: false }]);
    check('applyUpdate keeps the file\'s line endings and appends a chunk of pure additions at the end, as Codex does', upd.text === 'a\r\nB\r\nc\r\ntail\r\n', { happened: JSON.stringify(upd.text), why: 'Mixed line endings make every later diff noisy.', fix: 'Check applyUpdate.' });
    check('two sections for one file build on each other', /Success/.test(r6) && fs.readFileSync(path.join(P, 'a.mjs'), 'utf8').includes('return 13;'), { happened: r6, why: 'The second section describes the file after the first.', fix: 'Keep the pending map.' });
  });

  await asyncSuite('session expert', 'saved sessions, exec, status, diff and review', async () => {
    const S = path.join(W, 'sessions-project');
    fs.mkdirSync(S, { recursive: true });
    const st = agentMod.newState(S, 'echo');
    await agentMod.turn(st, 'first message', null, null);
    agentMod.saveChat(st);
    const listed = agentMod.listChats(S);
    check('a turn is saved and listed for its folder', listed.length === 1 && listed[0].sid === st.sid && fs.existsSync(agentMod.chatPath(st.sid)), { happened: JSON.stringify(listed.map((c) => c.sid)), why: 'Resume only works if every turn is on disk.', fix: 'Check saveChat and listChats.' });
    const back = agentMod.loadChat('last', S);
    const byPart = agentMod.loadChat(st.sid.slice(-12), S);
    check('the last session here, or one named by part of its id, comes back whole', back && back.sid === st.sid && back.history.length === 2 && byPart && byPart.sid === st.sid && agentMod.loadChat('no-such-session-xyz', S) === null, { happened: JSON.stringify(back && { sid: back.sid, turns: back.history.length }), why: 'atlias resume must land on the right conversation or say it cannot.', fix: 'Check loadChat.' });
    const st2 = agentMod.newState(S, 'echo');
    await agentMod.turn(st2, 'second session', null, null);
    agentMod.saveChat(st2);
    const newest = agentMod.listChats(S, 1);
    check('the listing stops at its limit and puts the newest first', newest.length === 1 && newest[0].sid === st2.sid && agentMod.listChats(S).length === 2, { happened: JSON.stringify(newest.map((c) => c.sid)), why: 'Each saved chat holds a whole conversation; reading every one to find the last grows slower with every session.', fix: 'Sort by file time and stop at the limit.' });
    const status = agentMod.statusText(st);
    check('/status names the engine, the session, the turns and the context size', /engine echo/.test(status) && status.includes(st.sid) && /turns 1/.test(status) && /tokens sent per call/.test(status), { happened: status, why: 'It is the first thing to look at when a session feels off.', fix: 'Check statusText.' });
    const once = await agentMod.runOnce({ engine: 'echo', prompt: 'ping' });
    check('runOnce answers and reports the session, the files and the checks', once.code === 0 && once.json.reply === 'echo: ping' && once.json.session && Array.isArray(once.json.files_changed) && Array.isArray(once.json.checks), { happened: JSON.stringify(once.json), why: 'Scripts read this instead of the prose.', fix: 'Check runOnce.' });
    check('resuming a session that does not exist says so', (await agentMod.runOnce({ engine: 'echo', prompt: 'x', resume: 'no-such-session-xyz' })).code === 2, { happened: 'it went ahead', why: 'Silently starting fresh loses the context the user asked for.', fix: 'Return code 2.' });
    const bin = path.join(ROOT, 'bin', 'atlias.mjs');
    const j = spawnSync(process.execPath, [bin, 'exec', '--engine', 'echo', '--json', 'hello', 'there'], { cwd: S, encoding: 'utf8', timeout: 30000 });
    let parsed = null;
    try { parsed = JSON.parse(j.stdout.trim()); } catch { /* checked below */ }
    check('atlias exec --json prints one JSON object', j.status === 0 && parsed && parsed.reply === 'echo: hello there', { happened: j.stdout.slice(0, 200) + j.stderr.slice(0, 200), why: 'That is the scripting interface, as codex exec --json is.', fix: 'Check the exec command.' });
    const piped = spawnSync(process.execPath, [bin, 'exec', '--engine', 'echo'], { cwd: S, input: 'from a pipe', encoding: 'utf8', timeout: 30000 });
    check('atlias exec reads the prompt from a pipe', piped.status === 0 && /echo: from a pipe/.test(piped.stdout), { happened: piped.stdout.slice(0, 200), why: 'echo task | atlias exec is how it slots into scripts.', fix: 'Read stdin when there is no prompt.' });
    const empty = spawnSync(process.execPath, [bin, 'exec'], { cwd: S, input: '', encoding: 'utf8', timeout: 30000 });
    check('atlias exec with no prompt at all prints its usage and fails', empty.status === 2 && /usage: atlias exec/.test(empty.stdout), { happened: 'exit ' + empty.status + ' ' + empty.stdout.slice(0, 120), why: 'An empty prompt sent to a paid engine is money for nothing.', fix: 'Check the empty prompt branch.' });
    check('outside a repository, /diff says so and /review has nothing to review', /^no diff:/.test(agentMod.diffText(path.parse(TMP).root)) && agentMod.reviewPrompt(path.parse(TMP).root) === null, { happened: agentMod.diffText(path.parse(TMP).root).slice(0, 80), why: 'A git error is not a diff.', fix: 'Check diffText.' });
    const repo = path.join(W, 'review-repo');
    fs.mkdirSync(repo, { recursive: true });
    const git = (...a) => spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', ...a], { cwd: repo, encoding: 'utf8' });
    git('init', '-q');
    fs.writeFileSync(path.join(repo, 'calc.js'), 'export const add = (a, b) => a + b;' + NL);
    git('add', '.');
    git('commit', '-q', '-m', 'init');
    fs.writeFileSync(path.join(repo, 'calc.js'), 'export const add = (a, b) => a - b;' + NL);
    fs.writeFileSync(path.join(repo, 'extra.js'), 'export const x = 1;' + NL);
    const diff = agentMod.diffText(repo);
    const review = agentMod.reviewPrompt(repo);
    check('/diff shows changed tracked files and new files', /calc\.js/.test(diff) && /a - b/.test(diff) && /extra\.js/.test(diff), { happened: diff.slice(0, 200), why: 'A new file is a change too.', fix: 'Include git ls-files --others.' });
    check('/review asks for findings with file and line, and no edits', review && /Do not change any files/.test(review) && /file and line/.test(review) && /a - b/.test(review), { happened: String(review).slice(0, 160), why: 'A reviewer that edits is not reviewing.', fix: 'Check reviewPrompt.' });
  });

  await asyncSuite('harness check expert', 'the harness checks, outlines, permissions and stuck loops', async () => {
    const H = path.join(W, 'harness-project');
    fs.mkdirSync(path.join(H, 'src'), { recursive: true });
    fs.writeFileSync(path.join(H, 'src', 'calc.mjs'), ['export function add(a, b) {', '  return a + b;', '}', 'export const sub = (a, b) => a - b;', 'class Store {}', ''].join(NL));
    fs.writeFileSync(path.join(H, 'notes.txt'), 'plain text');
    const out1 = await loop.runTool(agentMod.newState(H, 'openai'), { tool: 'outline', path: 'src/calc.mjs' });
    check('outline lists definitions with their line numbers', /^src\/calc\.mjs/.test(out1) && /\s1\s+export function add/.test(out1) && /\s4\s+export const sub/.test(out1) && /\s5\s+class Store/.test(out1) && !/return a \+ b/.test(out1), { happened: out1, why: 'It lets a model find where to look without reading the file.', fix: 'Check OUTLINE and outlineFile.' });
    const out2 = await loop.runTool(agentMod.newState(H, 'openai'), { tool: 'outline' });
    check('outline of a folder covers its code files and skips the rest', /src\/calc\.mjs/.test(out2) && !/notes\.txt/.test(out2), { happened: out2.slice(0, 200), why: 'A repo map lists code, not every file.', fix: 'Check outlineFolder.' });
    check('outline says so for a file it cannot map', /no outline for this kind of file/.test(await loop.runTool(agentMod.newState(H, 'openai'), { tool: 'outline', path: 'notes.txt' })) && loop.outlineFile(path.join(H, 'notes.txt')) === null, { happened: 'no message', why: 'Silence reads as an empty file.', fix: 'Return the read_file hint.' });
    const P = (files) => { const d = fs.mkdtempSync(path.join(W, 'tc-')); for (const [f, t] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), t); } return d; };
    check('the check is found the way the project says it is tested', loop.detectTestCommand(P({ 'package.json': JSON.stringify({ scripts: { test: 'node t.js' } }) })) === 'npm test' && loop.detectTestCommand(P({ 'package.json': JSON.stringify({ scripts: { test: 'node t.js' } }), 'pnpm-lock.yaml': '' })) === 'pnpm test' && loop.detectTestCommand(P({ 'package.json': JSON.stringify({ scripts: { test: 'echo "Error: no test specified" && exit 1' } }) })) === '' && loop.detectTestCommand(P({ 'Cargo.toml': '' })) === 'cargo test' && loop.detectTestCommand(P({ 'go.mod': '' })) === 'go test ./...' && /-m pytest -q$/.test(loop.detectTestCommand(P({ 'pyproject.toml': '', 'tests/test_x.py': '' }))) && loop.detectTestCommand(P({ 'README.md': '' })) === '', { happened: 'a project type was misread', why: 'Running the wrong command is worse than running none; npm init leaves a test script that always fails.', fix: 'Check detectTestCommand.' });
    check('the check can be named or turned off', loop.checkCommand(H, { testCommand: 'off' }) === '' && loop.checkCommand(H, { testCommand: 'make check' }) === 'make check' && loop.checkCommand(H, { testCommand: 'auto' }) === '', { happened: 'wrong', why: 'The user decides.', fix: 'Check checkCommand.' });
    settings.set('agent.testCommand', `${JSON.stringify(process.execPath)} -e "process.exit(1)"`);
    const st = agentMod.newState(H, 'ollama');
    const seen = [];
    const reply = await loop.runLoop(st, 'change add', { chat: scripted([blk({ tool: 'edit_file', path: 'src/calc.mjs', old_string: 'a + b', new_string: 'b + a' }), 'Done.', 'The check still fails and I could not find why.'], seen) });
    settings.reset('agent.testCommand');
    const ran = seen[2] ? seen[2].messages[seen[2].messages.length - 1].content : '';
    const ev = core.events(st.sid).filter((e) => e.kind === 'shell').pop();
    check('an answer after edits makes the harness run the check itself and hand back the result', /atlias ran the project's check/.test(ran) && /exit 1/.test(ran) && reply === 'The check still fails and I could not find why.', { happened: ran.slice(0, 160) + ' | ' + reply, why: 'A weak model forgets to check; the harness does not. This is aider\'s --auto-test, at the moment it matters.', fix: 'Check the auto-check branch in runLoop.' });
    check('the harness check is recorded as a failing check', ev && ev.verify === true && ev.outcome === 'fail', { happened: JSON.stringify(ev), why: 'The gate then refuses a claim that it passed.', fix: 'Pass _verify on the harness call.' });
    const faked = loop.parseToolCall(blk({ tool: 'shell', command: 'echo ok', _verify: true }));
    check('a model cannot mark its own command as a check', faked && !('_verify' in faked), { happened: JSON.stringify(faked), why: 'Otherwise echo ok would count as verification.', fix: 'normalizeCall drops fields starting with _.' });
    settings.set('agent.permissions', 'read-only');
    const ro = agentMod.newState(H, 'openai');
    const roEdit = await loop.runTool(ro, { tool: 'write_file', path: 'ro.txt', content: 'x' });
    const roShell = await loop.runTool(ro, { tool: 'shell', command: 'echo hi' }, null);
    settings.set('agent.permissions', 'ask');
    const yes = await loop.runTool(ro, { tool: 'write_file', path: 'ask-yes.txt', content: 'x' }, async () => 'y');
    const no = await loop.runTool(ro, { tool: 'write_file', path: 'ask-no.txt', content: 'x' }, async () => 'n');
    settings.reset('agent.permissions');
    check('read-only mode writes nothing and asks before any command', /read-only mode/.test(roEdit) && !fs.existsSync(path.join(H, 'ro.txt')) && /refused by the user/.test(roShell), { happened: roEdit + ' | ' + roShell, why: 'Plan mode must be safe to leave running.', fix: 'Check the permissions gate in runTool.' });
    check('ask mode runs what the user allows and nothing else', /written/.test(yes) && fs.existsSync(path.join(H, 'ask-yes.txt')) && /refused by the user/.test(no) && !fs.existsSync(path.join(H, 'ask-no.txt')), { happened: yes + ' | ' + no, why: 'That is the whole point of asking.', fix: 'Check the ask branch.' });
    const alt = [];
    await loop.runLoop(agentMod.newState(H, 'ollama'), 'loop', { chat: scripted([blk({ tool: 'list_dir', path: 'src' }), blk({ tool: 'list_dir', path: '.' }), blk({ tool: 'list_dir', path: 'src' }), blk({ tool: 'list_dir', path: '.' }), blk({ tool: 'list_dir', path: 'src' }), blk({ tool: 'list_dir', path: '.' }), 'stopped'], alt) });
    check('two calls taking turns are stopped as a loop', alt.some((s) => /back and forth between the same two calls/.test(s.messages[s.messages.length - 1].content)), { happened: 'no guard message', why: 'OpenHands\' stuck detector catches this pattern; repeat counting alone never sees it.', fix: 'Check the recent keys in runLoop.' });
  });

  await asyncSuite('held answer expert', 'the agent says when the gate held an answer', async () => {
    // Replays the live gemma3:4b run: a failing check, then a claim that it passed.
    const G = path.join(W, 'held-project');
    fs.mkdirSync(G, { recursive: true });
    fs.writeFileSync(path.join(G, 'broken.mjs'), 'export const = 1;' + NL);
    const replies = [blk({ tool: 'shell', command: `${JSON.stringify(process.execPath)} --check broken.mjs` }), 'All tests pass now; the bug is fixed.', 'Correction: the check failed, so it is not fixed.'];
    const server = http.createServer((req, res) => { req.resume(); req.on('end', () => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ message: { role: 'assistant', content: replies.shift() || 'nothing more' } })); }); });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    settings.set('agent.ollamaUrl', `http://127.0.0.1:${server.address().port}`);
    let reply = '';
    try {
      const st = agentMod.newState(G, 'ollama');
      reply = await agentMod.turn(st, 'fix it', null, null);
    } finally {
      settings.reset('agent.ollamaUrl');
      server.close();
    }
    const at = reply.indexOf('[atlias held the answer above:');
    check('a claimed pass after a failing check is held, and the output says so between the two answers', at > reply.indexOf('All tests pass') && at < reply.indexOf('Correction:') && /a pass|passed|failed|fail/i.test(reply.slice(at, reply.indexOf(']', at))), { happened: reply.slice(0, 400), why: 'In the live run a reader saw "the bug is fixed" first; without the marker the false claim reads as the result.', fix: 'Check the held marker in turn().' });
  });

  suite('instructions expert', 'project instruction files and /compact', () => {
    const root = path.join(W, 'instr-repo');
    fs.mkdirSync(path.join(root, '.git'), { recursive: true });
    fs.mkdirSync(path.join(root, 'sub', 'deep'), { recursive: true });
    fs.writeFileSync(path.join(root, 'AGENTS.md'), 'ROOT RULE: use tabs');
    fs.writeFileSync(path.join(root, 'sub', 'CLAUDE.md'), 'SUB RULE: no semicolons');
    const text = loop.projectInstructions(path.join(root, 'sub', 'deep'));
    check('instruction files are read from the repository root down, the nearer one last', text.includes('ROOT RULE') && text.includes('SUB RULE') && text.indexOf('ROOT RULE') < text.indexOf('SUB RULE') && /user's own words win/.test(text), { happened: text.slice(0, 200), why: 'The nearer file is the more specific one; it has to come last to win.', fix: 'Check projectInstructions.' });
    const lone = path.join(path.parse(TMP).root === TMP ? TMP : TMP, 'instr-norepo', 'inner');
    fs.mkdirSync(lone, { recursive: true });
    fs.writeFileSync(path.join(TMP, 'instr-norepo', 'AGENTS.md'), 'PARENT RULE');
    check('outside a repository only the working folder counts', !loop.projectInstructions(lone).includes('PARENT RULE'), { happened: loop.projectInstructions(lone).slice(0, 120), why: 'Walking up from a folder that is in no repository would pick up files from the home folder.', fix: 'Only climb inside a repository.' });
    fs.writeFileSync(path.join(root, 'sub', 'deep', 'AGENTS.md'), 'NEAR ' + 'x'.repeat(20000));
    const clipped = loop.projectInstructions(path.join(root, 'sub', 'deep'), 3000);
    check('a huge instruction file is cut to the budget, and says so', clipped.length < 3400 && /characters of this file cut to fit/.test(clipped) && clipped.includes('NEAR'), { happened: clipped.length + ' characters', why: 'The instructions ride on every call.', fix: 'Clip to the budget.' });
    check('the instructions ride in the system prompt', loop.systemPrompt(root, { instructions: 'X RULE HERE', hasGraph: false }).includes('X RULE HERE'), { happened: 'missing', why: 'Instructions the model never sees change nothing.', fix: 'Append them in systemPrompt.' });
    const st = { cwd: root, messages: [{ role: 'system', content: 'sys' }], todo: [{ text: 'a', done: true }], edited: new Set([path.join(root, 'f.js')]) };
    for (let i = 0; i < 12; i++) st.messages.push({ role: 'user', content: 'q' + i }, { role: 'assistant', content: 'a' + i });
    const last = st.messages[st.messages.length - 1];
    const said = loop.compact(st, 8);
    check('/compact keeps the system prompt, notes what it dropped, and keeps the latest messages', /compacted \d+/.test(said) && st.messages[0].content === 'sys' && /compacted away/.test(st.messages[1].content) && /\[x\] a/.test(st.messages[1].content) && /f\.js/.test(st.messages[1].content) && st.messages[st.messages.length - 1] === last && st.messages.length < 26, { happened: said + ' -> ' + st.messages.length + ' messages', why: 'Compaction that loses the plan loses the task.', fix: 'Check compact.' });
    check('it cuts only where the user spoke, so no tool result loses its call', st.messages[3].role === 'user', { happened: st.messages.slice(0, 5).map((m) => m.role).join(','), why: 'A tool message without its call is refused by the API.', fix: 'Cut at a plain user message.' });
    check('a short conversation is left alone', loop.compact({ cwd: root, messages: [{ role: 'system', content: 's' }, { role: 'user', content: 'u' }] }) === 'nothing to compact yet', { happened: 'it compacted', why: 'Nothing to gain.', fix: 'Check the cut search.' });
  });

  suite('command reading expert', 'a program given by its path', () => {
    const cases = [
      ['"C:' + BS + 'Program Files' + BS + 'nodejs' + BS + 'node.exe" --check a.mjs', 'node --check a.mjs'],
      ['./node_modules/.bin/jest --runInBand', 'jest --runInBand'],
      ['/usr/bin/python3 -m pytest', 'python3 -m pytest'],
      ['cd app && "C:' + BS + 'x' + BS + 'node.exe" test/run.mjs', 'cd app && node test/run.mjs'],
      ['node test/run.mjs', 'node test/run.mjs'],
      ['npm test', 'npm test'],
    ];
    for (const [raw, want] of cases) {
      const got = core.programCommand(raw);
      check(`reads ${raw.slice(0, 40)}`, got === want, { happened: got, why: 'A check run through a full path is still a check; missing it makes the gate call an honest run unverified.', fix: 'Check LEAD_PROGRAM in lib/core.mjs.' });
    }
    check('a check run by full path is recognised as a check', core.looksLikeVerification('"C:' + BS + 'Program Files' + BS + 'nodejs' + BS + 'node.exe" --check a.mjs') && core.looksLikeVerification('./node_modules/.bin/vitest run'), { happened: 'not recognised', why: 'Windows agents and npx shims call programs by path all the time.', fix: 'looksLikeVerification tests programCommand too.' });
    check('an argument path is never rewritten', core.looksLikeVerification('node test/run.mjs') && !core.looksLikeVerification('echo C:' + BS + 'x' + BS + 'node.exe'), { happened: 'wrong', why: 'Rewriting arguments would turn test/run.mjs into run.mjs and lose the match, or invent a program that never ran.', fix: 'Only rewrite the program at the head of a segment.' });
  });

  suite('context budget expert', 'context stays small', () => {
    const msgs = [{ role: 'system', content: 's' }, { role: 'user', content: 'task' }];
    for (let i = 0; i < 6; i++) {
      msgs.push({ role: 'assistant', content: i === 0 ? 'w'.repeat(3000) : 'call ' + i });
      msgs.push({ role: 'user', content: 'Tool result for read_file:' + NL + 'result ' + i + NL + 'r'.repeat(2000), _obs: { label: 'read_file f' + i, summary: 'result ' + i } });
    }
    msgs.push({ role: 'assistant', content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'write_file', arguments: JSON.stringify({ path: 'x', content: 'z'.repeat(4000) }) } }] });
    msgs.push({ role: 'tool', tool_call_id: 'c1', content: 'written x', _obs: { label: 'write_file x', summary: 'written x' } });
    const v = loop.view(msgs, 2);
    const obs = v.filter((m, i) => msgs[i]._obs);
    check('old tool results shrink to one line', obs.slice(0, -2).every((m) => /elided to keep the context small/.test(m.content) && m.content.length < 200), { happened: obs.map((m) => m.content.length).join(','), why: 'Observation masking is the cheapest way to keep a long task inside a small model\'s window.', fix: 'Check view().' });
    check('the recent ones stay whole', obs.slice(-2).every((m) => !/elided/.test(m.content)), { happened: obs.slice(-2).map((m) => m.content.slice(0, 40)).join(' | '), why: 'The model is working from them right now.', fix: 'Keep the last keep observations.' });
    check('the stored history is not changed', msgs[3].content.length > 2000 && msgs[2].content.length === 3000, { happened: 'the original messages were modified', why: 'Masking is a view; the history must stay complete.', fix: 'Map to new objects in view().' });
    check('the private bookkeeping never reaches the model', v.every((m) => !('_obs' in m)), { happened: 'an _obs field was sent', why: 'Some endpoints reject unknown fields outright.', fix: 'Strip _obs in view().' });
    check('an old long assistant message is shortened too', v[2].content.length < 1000, { happened: v[2].content.length + ' characters', why: 'A whole file the model wrote twenty rounds ago is dead weight.', fix: 'Elide assistant content before the oldest kept observation.' });
    // Cache stability: evicting one more observation every turn rewrites the
    // prompt prefix every turn, which throws the provider cache away.
    const grow = (n) => { const m = []; for (let i = 0; i < n; i++) { m.push({ role: 'assistant', content: 'call ' + i }); m.push({ role: 'user', content: 'long ' + 'x'.repeat(500), _obs: { label: 'read f' + i, summary: 'r' + i } }); } return m; };
    const pre = (n) => JSON.stringify(loop.view(grow(n), 2, 4).slice(0, 20));
    const evicted = (n) => loop.view(grow(n), 2, 4).filter((m) => /elided to keep/.test(m.content)).length;
    check('the prefix stays byte-identical while the block fills', pre(10) === pre(11) && pre(11) === pre(13) && evicted(10) === 8 && evicted(13) === 8, { happened: `prefix same: ${pre(10) === pre(13)}, evicted ${evicted(10)} then ${evicted(13)}`, why: 'A rewritten prefix is a thrown-away prompt cache: the whole conversation is re-read at full price every turn.', fix: 'view() quantises the eviction boundary to evictBlock.' });
    check('and it does evict once the block is full', evicted(14) === 12 && evicted(9) === 4, { happened: `evicted ${evicted(9)} at nine and ${evicted(14)} at fourteen`, why: 'Holding every observation forever is the other failure: the window fills and the run dies.', fix: 'Check the floor division in view().' });
    check('a missing block size behaves as it always did', JSON.stringify(loop.view(grow(6), 2)) === JSON.stringify(loop.view(grow(6), 2, 1)), { happened: 'the default changed behaviour', why: 'Callers that pass two arguments must keep the old one-at-a-time eviction.', fix: 'Default step to 1.' });
    check('a zero keep setting is treated as one', loop.view(msgs, 0).filter((m, i) => msgs[i]._obs && !/elided/.test(m.content)).length === 1, { happened: 'wrong number kept', why: 'A config value of 0 must not crash or keep everything.', fix: 'Clamp keep to at least 1.' });
  });

  await asyncSuite('planning expert', 'the plan stays in view', async () => {
    const state = fresh();
    const seen = [];
    const reply = await loop.runLoop(state, 'tidy up', { chat: scripted([blk({ tool: 'todo', items: [{ text: 'look around', done: false }, { text: 'report', done: false }] }), blk({ tool: 'list_dir', path: '.' }), 'Nothing needed changing; I only listed the directory.'], seen) });
    check('the todo tool keeps the plan', state.todo.length === 2 && state.todo[0].text === 'look around', { happened: JSON.stringify(state.todo), why: 'The plan is what keeps a weak model on course across many rounds.', fix: 'Check the todo tool.' });
    const sent = seen[2] ? seen[2].messages[seen[2].messages.length - 1].content : '';
    check('every later tool result repeats where the plan stands', /\(plan 0\/2 done; next: look around\)/.test(sent), { happened: sent.slice(-120), why: 'Reciting the goal at the end of the context keeps it in recent attention; that is the point of the tool.', fix: 'Append recitation() to tool results.' });
    check('a final answer with no edits is returned as is', reply === 'Nothing needed changing; I only listed the directory.', { happened: reply, why: 'Nothing to check, nothing to hold.', fix: 'Only nudge after edits.' });
    const st2 = fresh();
    await loop.runTool(st2, { tool: 'todo', items: '- [x] first' + NL + '- [ ] second' });
    check('a plan written as markdown checkboxes is understood', st2.todo.length === 2 && st2.todo[0].done === true && st2.todo[1].done === false && st2.todo[1].text === 'second', { happened: JSON.stringify(st2.todo), why: 'That is how models write lists when they forget the schema.', fix: 'Parse string items.' });
  });

  await asyncSuite('finishing expert', 'no done without a check', async () => {
    fs.writeFileSync(path.join(W, 'w.mjs'), 'export const w = 1;' + NL);
    const node = JSON.stringify(process.execPath);
    const state = fresh();
    const seen = [];
    const reply = await loop.runLoop(state, 'bump w', { chat: scripted([
      blk({ tool: 'edit_file', path: 'w.mjs', old_string: 'w = 1', new_string: 'w = 2' }),
      'Done.',
      blk({ tool: 'shell', command: `${node} --check w.mjs` }),
      'Changed w to 2; node --check w.mjs exited 0.',
    ], seen) });
    const sentAt2 = seen[2] ? seen[2].messages[seen[2].messages.length - 1].content : '';
    check('an answer after an edit with no check is sent back', seen.length === 4 && /ran no check after the last edit/.test(sentAt2), { happened: seen.length + ' model calls; ' + sentAt2.slice(0, 80), why: 'Saying done after an edit nobody ran is the failure this harness exists to stop.', fix: 'Check the unchecked branch in runLoop.' });
    check('and the answer after the check is the one returned', reply === 'Changed w to 2; node --check w.mjs exited 0.', { happened: reply, why: 'The loop must end once the check ran.', fix: 'verifiedAt is set by shell.' });
    const nudges = state.messages.filter((m) => m.role === 'user' && /ran no check after the last edit/.test(m.content));
    check('the nudge is sent once, not every round', nudges.length === 1, { happened: nudges.length + ' nudges stored', why: 'An unbounded nudge is a loop.', fix: 'The nudged flag.' });
    const stubborn = fresh();
    const seen2 = [];
    const r2 = await loop.runLoop(stubborn, 'bump w', { chat: scripted([blk({ tool: 'edit_file', path: 'w.mjs', old_string: 'w = 2', new_string: 'w = 3' }), 'Done.', 'Still done, no check possible.'], seen2) });
    check('a model that still will not check is let go after one nudge', r2 === 'Still done, no check possible.' && seen2.length === 3, { happened: r2 + ' after ' + seen2.length + ' calls', why: 'The gate after the turn is the second line; the loop must not hold forever.', fix: 'One nudge per message.' });
    fs.writeFileSync(path.join(W, 'prog.mjs'), 'console.log(1);' + NL);
    const seen3 = [];
    await loop.runLoop(fresh(), 'fix prog', { chat: scripted([blk({ tool: 'edit_file', path: 'prog.mjs', old_string: 'log(1)', new_string: 'log(2)' }), blk({ tool: 'shell', command: `${node} prog.mjs` }), 'Prints 2 now.'], seen3) });
    check('running the edited program counts as a check', seen3.length === 3, { happened: seen3.length + ' calls', why: 'Running the thing is the most honest check there is.', fix: 'RUNNER plus the edited file name.' });
    const seen4 = [];
    await loop.runLoop(fresh(), 'fix prog', { chat: scripted([blk({ tool: 'edit_file', path: 'prog.mjs', old_string: 'log(2)', new_string: 'log(3)' }), blk({ tool: 'shell', command: 'echo prog.mjs' }), 'Done.', 'ok'], seen4) });
    check('printing the file name is not a check', seen4.length === 4, { happened: seen4.length + ' calls', why: 'Naming a file is not running it.', fix: 'Require a runner before the file name.' });
  });

  await asyncSuite('recovery expert', 'broken blocks and loops', async () => {
    const seen = [];
    const reply = await loop.runLoop(fresh(), 'look', { chat: scripted([FENCE + 'atlias' + NL + '{{oops' + NL + FENCE, blk({ tool: 'list_dir', path: '.' }), 'Listed.'], seen) });
    const corrective = seen[1] ? seen[1].messages[seen[1].messages.length - 1].content : '';
    check('a block that does not parse gets a corrective message, not silence', reply === 'Listed.' && /did not parse/.test(corrective), { happened: reply + ' | ' + corrective.slice(0, 80), why: 'Returning the broken block as the answer ends the task with nothing done.', fix: 'Check the badBlocks branch.' });
    settings.set('agent.maxToolRounds', '3');
    let n = 0;
    const r = await loop.runLoop(fresh(), 'forever', { chat: async () => ({ content: blk({ tool: 'list_dir', path: 'x' + (n++) }), calls: [] }) });
    check('running out of rounds is reported as unfinished', /stopped after 3 tool rounds/.test(r) && /not finished/.test(r), { happened: r, why: 'A limit that reads like an answer is a false done.', fix: 'Check the tail of runLoop.' });
    settings.set('agent.maxToolRounds', '8');
    const seen5 = [];
    await loop.runLoop(fresh(), 'loop', { chat: scripted([...Array(5).fill(blk({ tool: 'list_dir', path: '.' })), 'gave up'], seen5) });
    check('the same call repeated is stopped by the guard', seen5.some((s) => /atlias guard: this exact tool call has repeated/.test(s.messages[s.messages.length - 1].content)), { happened: 'no guard message', why: 'A weak model repeating a call is burning the budget.', fix: 'Check the seen map in runLoop.' });
    settings.reset('agent.maxToolRounds');
    const thrown = await loop.runLoop(fresh(), 'x', { chat: async () => { throw new Error('socket hang up'); } });
    check('a model call that throws is reported, not a crash', /model call failed: socket hang up/.test(thrown), { happened: thrown, why: 'A network blip must not take the terminal down.', fix: 'Wrap chat() in runLoop.' });
  });

  await asyncSuite('wire format expert', 'the openai engine speaks the real wire format', async () => {
    const requests = [];
    let modeName = 'native';
    let failOnce = false;
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (x) => { body += x; });
      req.on('end', () => {
        const json = JSON.parse(body);
        requests.push({ url: req.url, headers: req.headers, body: json });
        const send = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
        if (failOnce) { failOnce = false; send(500, { error: { message: 'overloaded' } }); return; }
        if (modeName === 'native') {
          const hasToolResult = json.messages.some((m) => m.role === 'tool');
          if (!hasToolResult) { send(200, { choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'list_dir', arguments: '{"path":"."}' } }] } }] }); return; }
          send(200, { choices: [{ message: { role: 'assistant', content: 'All listed.' } }] });
          return;
        }
        if (json.tools) { send(400, { error: { message: 'tools are not supported by this model' } }); return; }
        const hasResult = json.messages.some((m) => m.role === 'user' && /^Tool result/.test(m.content));
        send(200, { choices: [{ message: { role: 'assistant', content: hasResult ? 'Listed.' : blk({ tool: 'list_dir', path: '.' }) } }] });
      });
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    try {
      const cfg = { ...core.config().agent, openaiUrl: `http://127.0.0.1:${port}/v1/`, openaiModel: 'test-model' };
      const reply = await loop.runLoop(fresh('openai'), 'list it', { chat: loop.openaiChat(cfg, { ATLIAS_API_KEY: 'k-test' }), native: true });
      const [a, b] = requests;
      check('a native tool call runs and its answer comes back', reply === 'All listed.', { happened: reply, why: 'This is the whole engine.', fix: 'Check openaiChat and runLoop together.' });
      check('the request goes to chat/completions with the model and the key', a && a.url === '/v1/chat/completions' && a.body.model === 'test-model' && a.headers.authorization === 'Bearer k-test', { happened: JSON.stringify(a && { url: a.url, model: a.body.model, auth: a.headers.authorization }), why: 'A trailing slash in the url or a missing header fails every call.', fix: 'Trim trailing slashes; send Bearer.' });
      check('the tools are sent as function schemas', a && Array.isArray(a.body.tools) && a.body.tools.some((t) => t.type === 'function' && t.function.name === 'edit_file' && t.function.parameters.required.includes('old_string')), { happened: JSON.stringify(a && a.body.tools && a.body.tools[1]), why: 'Native calling is only as good as the schema.', fix: 'Check toolSchemas.' });
      const toolMsg = b && b.body.messages.find((m) => m.role === 'tool');
      const asst = b && b.body.messages.find((m) => m.role === 'assistant' && m.tool_calls);
      check('the tool result goes back with its tool_call_id after the assistant call', toolMsg && toolMsg.tool_call_id === 'call_1' && asst && asst.tool_calls[0].id === 'call_1' && b.body.messages.indexOf(asst) < b.body.messages.indexOf(toolMsg), { happened: JSON.stringify(b && b.body.messages.map((m) => m.role)), why: 'The API refuses a tool message whose call it has not seen.', fix: 'Push res.message before the tool results.' });
      requests.length = 0;
      modeName = 'text';
      const st2 = fresh('openai');
      const r2 = await loop.runLoop(st2, 'list it', { chat: loop.openaiChat(cfg, { OPENAI_API_KEY: 'k2' }), native: true });
      check('an endpoint that refuses tools falls back to text blocks', r2 === 'Listed.' && st2.textTools === true && st2.messages[0].content.includes(FENCE + 'atlias'), { happened: r2 + ' textTools=' + st2.textTools, why: 'Local servers often have no tool template; the agent must still work there.', fix: 'Check toolsRefused in runLoop.' });
      check('and it stops sending tools after the refusal', requests.filter((q) => q.body.tools).length === 1, { happened: requests.map((q) => Boolean(q.body.tools)).join(','), why: 'Retrying a refused feature every round doubles the calls.', fix: 'state.textTools sticks for the session.' });
      modeName = 'native';
      failOnce = true;
      const retried = await loop.openaiChat(cfg, { ATLIAS_API_KEY: 'k' }, { sleep: async () => {} })([{ role: 'user', content: 'hi' }], null);
      check('a 500 is retried', retried && !retried.error && Array.isArray(retried.calls), { happened: JSON.stringify(retried).slice(0, 200), why: 'Overloaded endpoints recover in seconds; giving up at once wastes the task.', fix: 'Retry 429 and 5xx twice.' });
    } finally {
      server.close();
    }
    const twoCalls = { status: 200, json: { choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'a1', type: 'function', function: { name: 'list_dir', arguments: '{}' } }, { id: 'a2', type: 'function', function: { arguments: '{}' } }] } }] } };
    const answered = await loop.openaiChat({ openaiUrl: 'http://127.0.0.1:1/v1', openaiModel: 'm' }, {}, { post: async () => twoCalls })([{ role: 'user', content: 'x' }], []);
    check('every tool call id gets an answer, even one with no name', answered.calls.length === 2 && answered.calls.every((c) => c.id) && answered.calls[1].tool === 'unnamed', { happened: JSON.stringify(answered.calls), why: 'The API refuses the next request if any call id in the assistant message has no tool reply.', fix: 'Map nameless calls to an unknown tool instead of dropping them.' });
    check('the openai engine needs a model name', !loop.openaiReady({ openaiModel: '', openaiUrl: 'https://api.openai.com/v1' }, { OPENAI_API_KEY: 'k' }), { happened: 'ready with no model', why: 'Every call would fail with a model-not-found error.', fix: 'Check openaiReady.' });
    check('and a key unless the endpoint is local', loop.openaiReady({ openaiModel: 'm', openaiUrl: 'https://api.openai.com/v1' }, { ATLIAS_API_KEY: 'k' }) && !loop.openaiReady({ openaiModel: 'm', openaiUrl: 'https://api.openai.com/v1' }, {}) && loop.openaiReady({ openaiModel: 'm', openaiUrl: 'http://localhost:1234/v1' }, {}), { happened: 'wrong readiness', why: 'LM Studio and llama.cpp need no key; OpenAI does.', fix: 'Check LOCAL in openaiReady.' });
    check('the atlias key wins over the OpenAI one', loop.apiKey({ ATLIAS_API_KEY: 'a', OPENAI_API_KEY: 'o' }) === 'a', { happened: loop.apiKey({ ATLIAS_API_KEY: 'a', OPENAI_API_KEY: 'o' }), why: 'Pointing atlias at OpenRouter must not require unsetting an OpenAI key.', fix: 'Read ATLIAS_API_KEY first.' });
    check('auto picks the openai engine after claude and codex, before ollama', agentMod.ENGINE_ORDER.join(',') === 'claude,codex,openai,ollama', { happened: agentMod.ENGINE_ORDER.join(','), why: 'A configured endpoint is a deliberate choice; a local Ollama is usually a fallback.', fix: 'Check ENGINE_ORDER.' });
  });

  await asyncSuite('modes expert', 'sub-harness, harness, or both', async () => {
    check('old saved choices read as both', ['ask', 'agent', 'sub-harness', '', undefined].every((v) => settings.normalizeMode(v) === 'both') && settings.normalizeMode('SUB') === 'sub', { happened: ['ask', 'agent', 'sub-harness'].map(settings.normalizeMode).join(','), why: 'Older versions saved the chooser answer without reading it; honouring it now would silently switch hooks off for people who never chose that.', fix: 'Check normalizeMode.' });
    check('typing atlias does what the mode says', settings.bareCommand('both', true) === 'chooser' && settings.bareCommand('sub', true) === 'status' && settings.bareCommand('standalone', true) === 'agent' && settings.bareCommand('standalone', false) === 'help', { happened: ['both', 'sub', 'standalone'].map((m) => settings.bareCommand(m, true)).join(','), why: 'A mode that changes nothing is a setting that does nothing.', fix: 'Check bareCommand.' });
    const refused = settings.setMode('sideways');
    check('an unknown mode is refused with the list', !refused.ok && /both, sub, standalone/.test(refused.text), { happened: refused.text, why: 'A typo must not quietly mean both.', fix: 'Check setMode.' });
    const payload = { session_id: 'modes-test', cwd: PROJECT, source: 'startup', hook_event_name: 'SessionStart' };
    settings.setMode('standalone');
    const quiet = hookRun('session-start', payload);
    check('standalone keeps the hooks silent in other harnesses', settings.hooksActive() === false && quiet.status === 0 && quiet.stdout.trim() === '', { happened: 'exit ' + quiet.status + ', ' + quiet.stdout.slice(0, 120), why: 'Standalone means atlias stays out of Claude Code and Codex sessions entirely.', fix: 'Check the hooksActive guard in hooks.mjs main().' });
    settings.setMode('both');
    const loud = hookRun('session-start', payload);
    check('both brings them back', settings.hooksActive() === true && loud.stdout.trim().length > 0, { happened: loud.stdout.slice(0, 120) || '(nothing)', why: 'Switching back has to work, or nobody dares switch.', fix: 'Same guard.' });
    settings.reset('agent.mode');
  });

  await asyncSuite('settings expert', 'every option can be changed', async () => {
    const undocumented = settings.rows().filter((r) => !r.about).map((r) => r.id);
    check('every setting says what it does', undocumented.length === 0, { happened: undocumented.join(', '), why: 'A setting nobody can understand is a setting nobody changes.', fix: 'Add it to DESCRIPTIONS in lib/settings.mjs.' });
    check('the choice settings refuse what they cannot be', /is one of both, sub, standalone/.test(core.parseSetting('agent', 'mode', 'sideways').error || '') && core.parseSetting('agent', 'engine', 'OpenAI').value === 'openai', { happened: JSON.stringify([core.parseSetting('agent', 'mode', 'sideways'), core.parseSetting('agent', 'engine', 'OpenAI')]), why: 'An engine name with a typo would otherwise mean no engine at all.', fix: 'Check CHOICES in parseSetting.' });
    const set = settings.set('guard.loopThreshold', '7');
    check('a setting is written and read back', set.ok && core.config().guard.loopThreshold === 7 && settings.rows().find((r) => r.id === 'guard.loopThreshold').changed, { happened: set.text, why: 'The text reported must be what took effect.', fix: 'Check settings.set.' });
    const back = settings.reset('guard.loopThreshold');
    const cfgFile = core.readJson(path.join(process.env.ATLIAS_HOME, 'config.json'), {}) || {};
    check('reset returns it to the default and leaves no empty section', back.ok && core.config().guard.loopThreshold === core.DEFAULTS.guard.loopThreshold && !(cfgFile.guard && 'loopThreshold' in cfgFile.guard), { happened: JSON.stringify(cfgFile), why: 'A reset that leaves the key behind is not a reset.', fix: 'Delete the key, and the section when it empties.' });
    const menuRun = async (answers) => { const said = []; const q = [...answers]; await settings.menu(async () => (q.length ? q.shift() : 'q'), (s) => said.push(s)); return said.join(NL); };
    const syntaxIdx = settings.rows().findIndex((r) => r.id === 'verify.syntax') + 1;
    await menuRun([String(syntaxIdx), 'q']);
    check('the menu flips a switch with one keypress', core.config().verify.syntax === false, { happened: String(core.config().verify.syntax), why: 'A switch should not ask for the word false.', fix: 'Toggle booleans in menu().' });
    await menuRun(['r' + syntaxIdx, 'q']);
    check('and resets it with r and the number', core.config().verify.syntax === true, { happened: String(core.config().verify.syntax), why: 'Undo has to be as easy as the change.', fix: 'Check the reset branch in menu().' });
    const modeIdx = settings.rows().findIndex((r) => r.id === 'agent.mode') + 1;
    await menuRun([String(modeIdx), '3', 'q']);
    check('a choice setting is picked from a numbered list', core.config().agent.mode === 'standalone', { happened: String(core.config().agent.mode), why: 'Nobody should have to remember the spelling of a mode.', fix: 'Map the number to row.choices.' });
    settings.reset('agent.mode');
    const said = await menuRun(['999', 'q']);
    check('a number that is not on the list says so', /no setting 999/.test(said), { happened: said.slice(-120), why: 'Silence reads as success.', fix: 'Check the bounds in menu().' });
    const typed = settings.rows().findIndex((r) => r.id === 'agent.maxToolRounds') + 1;
    const bad = await menuRun([String(typed), 'lots', 'q']);
    check('a bad value typed into the menu is refused with the reason', /is a number/.test(bad) && core.config().agent.maxToolRounds === core.DEFAULTS.agent.maxToolRounds, { happened: bad.slice(-160), why: 'The menu must refuse exactly what config set refuses.', fix: 'menu() writes through settings.set.' });
  });

  suite('command line expert', 'the command line speaks modes and settings', () => {
    const cli = (...args) => spawnSync(process.execPath, [path.join(ROOT, 'bin', 'atlias.mjs'), ...args], { encoding: 'utf8', timeout: 30000, env: process.env });
    const m = cli('mode');
    check('atlias mode shows the current mode and the choices', m.status === 0 && /mode both/.test(m.stdout) && /standalone/.test(m.stdout), { happened: m.stdout.slice(0, 160), why: 'The user needs to see what they would be switching to.', fix: 'Check the mode command.' });
    const bad = cli('mode', 'sideways');
    check('a bad mode exits non-zero', bad.status === 2, { happened: 'exit ' + bad.status, why: 'Scripts depend on the exit code.', fix: 'Set exitCode 2 on refusal.' });
    const list = cli('settings', 'list');
    check('atlias settings lists every option with what it does', list.status === 0 && /agent\.keepObservations/.test(list.stdout) && /tool results/.test(list.stdout), { happened: list.stdout.slice(0, 160), why: 'Without a terminal the menu cannot run, so the list is what people see.', fix: 'Check the settings command.' });
    const bare = cli();
    check('typing atlias with no terminal prints the help, which names the new commands', bare.status === 0 && /mode \[both\|sub\|standalone\]/.test(bare.stdout) && /settings \[list\]/.test(bare.stdout) && /shortcut/.test(bare.stdout), { happened: bare.stdout.slice(-400), why: 'A command nobody can discover does not exist.', fix: 'Keep the help lines.' });
    const status = cli('status');
    check('status names the mode', /mode: both/.test(status.stdout), { happened: status.stdout.slice(0, 160), why: 'Knowing which mode is on is the first question when something seems off.', fix: 'Add the mode line to status.' });
  });
}
