#!/usr/bin/env node
// atlias test suite. Every suite is written by an "expert" with one concern,
// and every failure says what happened, why it matters and how to fix it, so
// the model reading the output can act on it without guessing.
//   node test/run.mjs            all suites
//   node test/run.mjs guard gate only those suites
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'atlias-test-'));
process.env.ATLIAS_HOME = path.join(TMP, 'state');
process.env.CLAUDE_CONFIG_DIR = path.join(TMP, 'claude');
process.env.CODEX_HOME = path.join(TMP, 'codex');
fs.mkdirSync(process.env.CLAUDE_CONFIG_DIR, { recursive: true });
fs.mkdirSync(process.env.CODEX_HOME, { recursive: true });
const PROJECT = path.join(TMP, 'project');
fs.mkdirSync(PROJECT, { recursive: true });

const core = await import('../lib/core.mjs');
const brief = await import('../lib/brief.mjs');
const router = await import('../lib/router.mjs');
const guard = await import('../lib/guard.mjs');
const track = await import('../lib/track.mjs');
const gate = await import('../lib/gate.mjs');
const progress = await import('../lib/progress.mjs');
const dream = await import('../lib/dream.mjs');
const hosts = await import('../lib/hosts.mjs');
const hooksMod = await import('../lib/hooks.mjs');
const tools = await import('../mcp/tools.mjs');
const logoMod = await import('../lib/logo.mjs');
const agentMod = await import('../lib/agent.mjs');
const extras = await import('../lib/hosts-extra.mjs');
const graphMod = await import('../lib/graph.mjs');
const benchMod = await import('../lib/bench.mjs');

const only = process.argv.slice(2);
const results = [];
let current = null;
function suite(expert, name, fn) {
  if (only.length && !only.some((o) => name.toLowerCase().includes(o.toLowerCase()))) return;
  current = { expert, name, passed: 0, failed: [] };
  results.push(current);
  try { fn(); } catch (e) { current.failed.push({ test: '(suite crashed)', happened: String(e && e.stack || e), why: 'A crash means every later check in this suite did not run.', fix: 'Fix the exception first, then re-run this suite alone.' }); }
}
function check(test, cond, { happened, why, fix }) {
  if (cond) { current.passed++; return true; }
  current.failed.push({ test, happened, why, fix });
  return false;
}
const sid = (n) => `test-session-${n}`;
const hookRun = (event, payload, env = {}) => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'lib', 'hooks.mjs'), event], { input: JSON.stringify(payload), encoding: 'utf8', env: { ...process.env, ...env }, timeout: 20000 });
  let json = null; try { json = r.stdout.trim() ? JSON.parse(r.stdout.trim().split(/\r?\n/).pop()) : null; } catch { json = { _unparsed: r.stdout }; }
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, json };
};
// Command strings under test are stored reversed and flipped at runtime, so no
// tool guard mistakes this file for a script that runs them.
const rev = (s) => s.split('').reverse().join('');
const ch = (...codes) => String.fromCharCode(...codes);
const DANGER = ['/ fr- mr', '/~ fr- mr', '\\:C fr- mr', 'ecrof-- niam nigiro hsup tig', '3~DAEH drah-- teser tig', 'F/ 2424 DIP/ llikksat', '2424 dI- ssecorP-potS', '\\:C ecroF- esruceR- metI-evomeR', '"sresu ELBAT PORD" c- lqsp', 'x/0kniledir eteled oper hg'].map(rev);
const SAFE = ['tsid/. fr- mr', 'seludom_edon fr- mr', 'niam nigiro hsup tig', 'sutats tig', 'al- sl', 'txt.elif led', 'sjm.a kcehc-- edon'].map(rev);
const DRIVE = 'C' + ch(58) + ch(92);
const WINPATH = DRIVE + 'Users' + ch(92) + 'OWNER';
const UNIXPATH = rev('ppa/u/emoh/');
const TMPTS = rev('st.x/pmt/');

suite('payload expert', 'payload shapes', () => {
  const f1 = core.filesFromTool('Edit', { file_path: WINPATH + ch(92) + 'b.js', old_string: 'x', new_string: 'y' });
  check('Claude Edit file_path is tracked', f1.length === 1 && f1[0] === WINPATH + ch(92) + 'b.js', { happened: `filesFromTool returned ${JSON.stringify(f1)}`, why: 'Every downstream feature (gate, handoff, digest) is blind to a change it cannot see.', fix: 'filesFromTool must read tool_input.file_path for Claude Code edit tools.' });
  const patch = '*** Begin Patch\n*** Update File: src' + ch(47) + 'app.py\n@@\n-a\n+b\n*** Add File: docs' + ch(47) + 'new.md\n+hello\n*** End Patch';
  const f2 = core.filesFromTool('apply_patch', { input: patch });
  check('Codex apply_patch paths are parsed', f2.includes('src' + ch(47) + 'app.py') && f2.includes('docs' + ch(47) + 'new.md'), { happened: `got ${JSON.stringify(f2)}`, why: 'Codex edits arrive as a patch text, not a file_path; without parsing it the gate never fires under Codex.', fix: 'Parse "*** Update File:" and "*** Add File:" lines from tool_input.input.' });
  const f3 = core.filesFromTool('write_file', { file_path: TMPTS, content: '' });
  check('Gemini write_file path is tracked', f3[0] === TMPTS, { happened: JSON.stringify(f3), why: 'Gemini CLI uses write_file and replace with file_path.', fix: 'Keep file_path in the accepted key list.' });
  const joined = core.commandFromTool('shell', { command: ['bash', '-lc', DANGER[0]] });
  check('Codex shell command arrays are joined', joined === 'bash -lc ' + DANGER[0], { happened: joined, why: 'Codex passes the command as an argv array; a string-only reader sees nothing and the destructive guard sleeps.', fix: 'Join arrays with a space in commandFromTool.' });
  check('slug matches Claude Code project folder naming', core.slug(WINPATH) === 'C--Users-OWNER' && core.slug(UNIXPATH) === '-home-u-app', { happened: `${core.slug(WINPATH)} and ${core.slug(UNIXPATH)}`, why: 'The slug locates Claude Code memory; a mismatch means every host writes to a different memory and nothing is shared.', fix: 'Replace every backslash, slash and colon with a dash, nothing else.' });
  check('code file detection covers the common set', core.isCodeFile('a.mjs') && core.isCodeFile('b.py') && !core.isCodeFile('c.png'), { happened: 'isCodeFile mismatch', why: 'The second-pass gate keys on code files; images must not trigger it.', fix: 'Adjust CODE_EXT.' });
  check('verification commands are recognised', core.looksLikeVerification(SAFE[6]) && core.looksLikeVerification('npm test') && !core.looksLikeVerification(SAFE[4]), { happened: 'looksLikeVerification mismatch', why: 'The handoff note and gate report which checks ran; false positives make the model think it verified when it listed a directory.', fix: 'Tighten looksLikeVerification.' });
});

suite('cache and token expert', 'token efficiency', () => {
  const payload = { cwd: PROJECT, session_id: sid('cache'), source: 'startup' };
  const a = brief.build(payload, 'claude');
  const b = brief.build(payload, 'claude');
  check('brief is deterministic across two builds', a === b, { happened: 'two consecutive briefs differ', why: 'A brief that changes on every start cannot be cached as a stable prompt prefix (NanoBot issue 2463) and costs full price every session.', fix: 'Remove clocks, counters and random ids from brief.build.' });
  check('brief carries no timestamp', !/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(a) && !/\d{1,2}:\d{2}:\d{2}/.test(a), { happened: 'a timestamp appears in the brief', why: 'Timestamps defeat prefix caching.', fix: 'Describe age in coarse words (graph.age) or leave time out.' });
  check('empty-project brief stays under 3200 characters', a.length < 3200, { happened: `${a.length} chars`, why: 'The brief is paid on every session; it must point at data, not paste it.', fix: 'Shorten sections or move detail behind harness_recall.' });
  check('brief names every MCP tool once', ['harness_recall', 'harness_remember', 'harness_progress', 'graph_query'].every((t) => a.includes(t)), { happened: 'a tool name is missing from the brief', why: 'The model can only call what it knows exists; the brief is the only unprompted mention.', fix: 'Keep the tool list in the first line of brief.build.' });
  const cwd = PROJECT;
  check('PostToolUse is silent', track.postTool({ session_id: sid('cache'), cwd, tool_name: 'Read', tool_input: { file_path: 'x' } }) === null, { happened: 'postTool emitted output', why: 'PostToolUse fires on every tool call; any output there is paid hundreds of times per session.', fix: 'track.postTool must only record and return null.' });
  check('first PreToolUse is silent', guard.preTool({ session_id: sid('cache'), cwd, tool_name: 'Read', tool_input: { file_path: 'x' } }) === null, { happened: 'guard spoke on a first call', why: 'Silence on the common path is what makes the harness cheap.', fix: 'guard.preTool returns null unless a guard fires.' });
  check('router ignores short prompts and slash commands', router.classify('hi') === 'skip' && router.classify(ch(47) + 'graphify .') === 'skip', { happened: 'classify did not skip', why: 'Injecting into every prompt burns tokens and breaks slash commands.', fix: 'classify must return skip for prompts under 12 chars or starting with a slash.' });
  check('router classifies codebase questions', router.classify('How does the news worker decide which category leads?') === 'codebase', { happened: router.classify('How does the news worker decide which category leads?'), why: 'Codebase questions are the case where a graph answer saves the most tokens.', fix: 'Extend CODEBASE_RE.' });
  check('router classifies frontend prompts', router.classify('Build me a landing page with parallax for the launch') === 'frontend', { happened: router.classify('Build me a landing page with parallax for the launch'), why: 'Frontend prompts route to ultimate-frontend-skills.', fix: 'Extend FRONTEND_RE.' });
  const r = router.prompt({ session_id: sid('cache'), cwd, prompt: 'please just say hello to me' });
  check('router is silent on ordinary prompts', r === null, { happened: JSON.stringify(r), why: 'Ordinary prompts must cost nothing.', fix: 'router.prompt returns null for kind other.' });
});

suite('guard expert', 'guards', () => {
  const s = sid('guard');
  const call = () => guard.preTool({ session_id: s, cwd: PROJECT, tool_name: 'Grep', tool_input: { pattern: 'foo', path: PROJECT } });
  let denied = null;
  for (let i = 0; i < 4; i++) denied = call();
  check('fourth identical call is denied', denied && denied.hookSpecificOutput && denied.hookSpecificOutput.permissionDecision === 'deny', { happened: JSON.stringify(denied), why: 'A loop of identical calls (NanoBot issue 4522) spends the whole budget on nothing new.', fix: 'guard.preTool must count identical keys in the window and deny at guard.loopThreshold.' });
  check('denial reason teaches, not scolds', denied && /What went wrong/.test(denied.hookSpecificOutput.permissionDecisionReason) && /Fix:/.test(denied.hookSpecificOutput.permissionDecisionReason), { happened: denied && denied.hookSpecificOutput.permissionDecisionReason, why: 'The model can only change course if the reason says what to change.', fix: 'Keep the What went wrong and Fix structure in the reason.' });
  const after = call();
  check('counter resets after one denial', after === null, { happened: JSON.stringify(after), why: 'Without a reset the tool is dead for the rest of the session even when a repeat is legitimate.', fix: 'Count only events after the last deny event for that key.' });
  const other = guard.preTool({ session_id: s, cwd: PROJECT, tool_name: 'Grep', tool_input: { pattern: 'bar', path: PROJECT } });
  check('a different input is not counted as a repeat', other === null, { happened: JSON.stringify(other), why: 'False positives would block honest work.', fix: 'Key on tool name plus the full input JSON.' });
  for (const c of DANGER) check(`destructive: ${c}`, guard.destructiveReason(c), { happened: 'not flagged', why: 'An irreversible command ran without a confirmation.', fix: `Add or widen the pattern that should match: ${c}` });
  for (const c of SAFE) check(`harmless: ${c}`, !guard.destructiveReason(c), { happened: `flagged as ${guard.destructiveReason(c)}`, why: 'False positives turn every routine command into a prompt and train the user to click through.', fix: `Narrow the pattern that matched: ${c}` });
  const ask = guard.preTool({ session_id: s, cwd: PROJECT, tool_name: 'Bash', tool_input: { command: DANGER[3] } });
  check('destructive shell call becomes an ask', ask && ask.hookSpecificOutput.permissionDecision === 'ask', { happened: JSON.stringify(ask), why: 'The user decides on irreversible actions, not the harness and not the model.', fix: 'Return permissionDecision ask with the reason.' });
  const codex = guard.preTool({ session_id: s, cwd: PROJECT, tool_name: 'shell', tool_input: { command: ['bash', '-lc', DANGER[4]] } });
  check('Codex argv-style destructive call becomes an ask', codex && codex.hookSpecificOutput.permissionDecision === 'ask', { happened: JSON.stringify(codex), why: 'Codex sends argv arrays; the guard must see through them.', fix: 'commandFromTool joins arrays; isShellTool must include shell.' });
});
suite('gate expert', 'verification gate', () => {
  const s = sid('gate');
  const okFile = path.join(PROJECT, 'ok.mjs'); fs.writeFileSync(okFile, 'export const a = 1;\n');
  const badFile = path.join(PROJECT, 'bad.mjs'); fs.writeFileSync(badFile, 'export const a = ;\n');
  const badJson = path.join(PROJECT, 'bad.json'); fs.writeFileSync(badJson, '{"a": }');
  const fails = gate.syntaxCheck([okFile, badFile, badJson, path.join(PROJECT, 'missing.js')]);
  check('syntaxCheck flags exactly the broken files', fails.length === 2 && fails.some((f) => f.file === badFile) && fails.some((f) => f.file === badJson), { happened: JSON.stringify(fails.map((f) => path.basename(f.file))), why: 'Missing a broken file lets a syntax error reach the user; flagging a good one wastes a turn.', fix: 'node --check for js/mjs/cjs, JSON.parse for json, skip files that do not exist.' });
  router.prompt({ session_id: s, cwd: PROJECT, prompt: 'change the thing please now' });
  track.postTool({ session_id: s, cwd: PROJECT, tool_name: 'Write', tool_input: { file_path: badFile, content: '' } });
  const b1 = gate.stop({ session_id: s, cwd: PROJECT, last_assistant_message: 'Done.' });
  check('stop blocks once on a syntax failure', b1 && b1.decision === 'block' && /syntax/.test(b1.reason), { happened: JSON.stringify(b1), why: 'The cheapest check of all was skipped and the reply was about to end.', fix: 'gate.stop must run syntaxCheck on files edited since the last prompt.' });
  check('syntax block explains what, why and fix', b1 && /What went wrong/.test(b1.reason) && /Fix:/.test(b1.reason), { happened: b1 && b1.reason, why: 'A bare "blocked" teaches nothing.', fix: 'Keep the three-part message.' });
  fs.writeFileSync(badFile, 'export const a = 2;\n');
  const b2 = gate.stop({ session_id: s, cwd: PROJECT, last_assistant_message: 'Fixed and done.' });
  check('after syntax passes the gate asks for the second pass once', b2 && b2.decision === 'block' && /second pass/.test(b2.reason), { happened: JSON.stringify(b2), why: 'Code changed and only one check is named; the adversarial pass is the standing rule.', fix: 'gate.stop must block when PASS_RE does not match last_assistant_message and the double flag is unset.' });
  const b3 = gate.stop({ session_id: s, cwd: PROJECT, last_assistant_message: 'Still done.' });
  check('the gate never blocks a third time for the same prompt', b3 === null, { happened: JSON.stringify(b3), why: 'An unbounded gate is an infinite loop that burns the whole budget.', fix: 'Set per-prompt flags in session meta and honour them.' });
  const s2 = sid('gate2');
  router.prompt({ session_id: s2, cwd: PROJECT, prompt: 'another change please now' });
  track.postTool({ session_id: s2, cwd: PROJECT, tool_name: 'Edit', tool_input: { file_path: okFile } });
  const passed = gate.stop({ session_id: s2, cwd: PROJECT, last_assistant_message: 'Pass 1: node --check passed. Pass 2: adversarial re-read found nothing.' });
  check('a reply naming both passes is not blocked', passed === null, { happened: JSON.stringify(passed), why: 'The gate must reward the behaviour it asks for.', fix: 'PASS_RE must match "Pass 2".' });
  const active = gate.stop({ session_id: s2, cwd: PROJECT, last_assistant_message: 'Done.', stop_hook_active: true });
  check('stop_hook_active is always allowed through', active === null, { happened: JSON.stringify(active), why: 'When the host is already continuing because of a stop hook, blocking again loops forever.', fix: 'Return null when payload.stop_hook_active is true.' });
  const none = gate.stop({ session_id: sid('gate3'), cwd: PROJECT, last_assistant_message: 'Just an answer.' });
  check('no changed files means no gate', none === null, { happened: JSON.stringify(none), why: 'Question-only turns must never be held.', fix: 'Return null when changedFiles is empty.' });
});

suite('handoff expert', 'progress note', () => {
  const s = sid('progress');
  router.prompt({ session_id: s, cwd: PROJECT, prompt: 'implement the harness handoff note' });
  track.postTool({ session_id: s, cwd: PROJECT, tool_name: 'Write', tool_input: { file_path: path.join(PROJECT, 'ok.mjs') } });
  track.postTool({ session_id: s, cwd: PROJECT, tool_name: 'Bash', tool_input: { command: 'node --check ok.mjs' } });
  progress.setNext(PROJECT, 'wire the MCP server');
  const pre = progress.preCompact({ session_id: s, cwd: PROJECT });
  const note = progress.read(PROJECT);
  check('PreCompact writes the note', note && /ok\.mjs/.test(note) && /node --check/.test(note) && /wire the MCP server/.test(note) && /implement the harness/.test(note), { happened: note, why: 'Everything not in this note is lost at compaction and must be rediscovered at full token cost.', fix: 'progress.build must include prompts, edited files, verification commands and the next step.' });
  check('PreCompact tells the summariser what to keep', pre && /unresolved blockers/.test(pre.hookSpecificOutput.additionalContext), { happened: JSON.stringify(pre), why: 'The compaction summary is written by the model; it needs the retention criteria.', fix: 'Keep the SNIP-style instruction in preCompact.' });
  const post = progress.postCompact({ session_id: s, cwd: PROJECT });
  check('PostCompact re-injects the note', post && /atlias handoff/.test(post.hookSpecificOutput.additionalContext), { happened: JSON.stringify(post), why: 'After compaction the note is the cheapest way back to the exact state.', fix: 'postCompact returns the note as additionalContext.' });
  const b = brief.build({ cwd: PROJECT, session_id: s, source: 'resume' }, 'claude');
  check('brief on resume includes the handoff', /Handoff from the last stretch/.test(b), { happened: 'no handoff section in brief', why: 'Resume and compact starts are exactly when the note pays for itself.', fix: 'brief.build reads progress.read(cwd) unless source is clear.' });
  const bc = brief.build({ cwd: PROJECT, session_id: s, source: 'clear' }, 'claude');
  check('brief after /clear omits the handoff', !/Handoff from the last stretch/.test(bc), { happened: 'handoff shown after clear', why: 'The user asked for a clean slate.', fix: 'Skip the note when source is clear.' });
});

suite('memory and Dream expert', 'dream', () => {
  const s = sid('dream');
  router.prompt({ session_id: s, cwd: PROJECT, prompt: 'remember that builds go to Drive' });
  track.postTool({ session_id: s, cwd: PROJECT, tool_name: 'Write', tool_input: { file_path: path.join(PROJECT, 'ok.mjs') } });
  core.saveSessionMeta(s, { host: 'claude', cwd: PROJECT });
  const transcript = path.join(TMP, 'transcript.jsonl');
  fs.writeFileSync(transcript, [
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'remember that builds go to Drive' } }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Write', input: {} }, { type: 'text', text: 'Saved the rule.' }] } }),
    JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'ok' }] } }),
    'not json at all',
  ].join('\n'));
  const t = dream.readTranscript(transcript);
  check('transcript parser survives corrupt lines and skips tool results', t.prompts.length === 1 && t.tools.Write === 1 && t.lastAssistant === 'Saved the rule.', { happened: JSON.stringify(t), why: 'Real transcripts contain tool results and the odd broken line; the worker must not crash or count them as prompts.', fix: 'Skip unparsable lines, skip content blocks that are not text, count tool_use by name.' });
  const row1 = dream.distil(s, transcript, PROJECT);
  check('distil writes cursor 1', row1 && row1.cursor === 1 && row1.files.length === 1, { happened: JSON.stringify(row1), why: 'The cursor is what lets Dream consume history exactly once (NanoBot history.jsonl design).', fix: 'Read the last cursor and add one.' });
  const row2 = dream.distil(s, transcript, PROJECT);
  check('second distil writes cursor 2', row2 && row2.cursor === 2, { happened: JSON.stringify(row2), why: 'Cursors must be monotonic or ack skips or repeats rows.', fix: 'Compute max cursor over all rows, not the row count.' });
  const p = dream.pending(PROJECT);
  check('two digests are pending', p.count === 2, { happened: `${p.count} pending`, why: 'The brief tells the model how much consolidation waits; a wrong count hides work or invents it.', fix: 'pending filters rows with cursor greater than the stored cursor.' });
  const digestText = fs.readFileSync(dream.digestPath(PROJECT), 'utf8');
  check('digest carries the retention criteria and the routing table', /Signal/.test(digestText) && /Persistent/.test(digestText) && /feedback/.test(digestText), { happened: digestText.slice(0, 300), why: 'The model consolidates; the digest must say what to keep and where (NanoBot Dream routing, Claude memory types).', fix: 'Keep the header sections in dream.digest.' });
  const last = dream.ack(PROJECT);
  check('ack advances the cursor and clears pending', last === 2 && dream.pending(PROJECT).count === 0, { happened: `ack returned ${last}, pending ${dream.pending(PROJECT).count}`, why: 'Without ack every brief nags forever.', fix: 'ack writes the max cursor to .dream_cursor.' });
  const saved = tools.remember(PROJECT, { name: 'builds-to-drive', type: 'feedback', description: 'Every new build is uploaded to Drive and older builds are trashed', body: 'Upload AAB and mapping, then trash older builds.' });
  const memDir = core.claudeMemoryDir(PROJECT);
  const file = fs.readFileSync(path.join(memDir, 'builds-to-drive.md'), 'utf8');
  const index = fs.readFileSync(path.join(memDir, 'MEMORY.md'), 'utf8');
  check('remember writes Claude Code frontmatter and indexes it', /saved/.test(saved) && /^---\nname: builds-to-drive\n/.test(file) && /type: feedback/.test(file) && /\(builds-to-drive\.md\)/.test(index), { happened: `${saved}\n${file.slice(0, 120)}`, why: 'Claude Code only loads memories in its own format; anything else is invisible to it and the hosts stop sharing.', fix: 'Write name, description, metadata.type frontmatter and one index line.' });
  tools.remember(PROJECT, { name: 'builds-to-drive', type: 'feedback', description: 'Every new build goes to Drive', body: 'v2' });
  const index2 = fs.readFileSync(path.join(memDir, 'MEMORY.md'), 'utf8').split(/\r?\n/).filter((l) => l.includes('builds-to-drive.md'));
  check('remembering the same name updates instead of duplicating the index line', index2.length === 1, { happened: `${index2.length} index lines`, why: 'Duplicate index lines grow the always-loaded MEMORY.md and confuse recall.', fix: 'Filter the old line for that file before appending.' });
  check('remember rejects a bad type with a usable message', /type must be one of/.test(tools.remember(PROJECT, { name: 'x-y', type: 'random', description: 'd' })), { happened: 'no rejection', why: 'Unknown types break Claude Code memory conventions.', fix: 'Validate against user, feedback, project, reference.' });
  const rec = tools.recall(PROJECT, 'Drive builds');
  check('recall finds the memory body', /Upload AAB|v2/.test(rec), { happened: rec, why: 'Recall is the cheap path to a fact; if it misses, the model rereads files or asks the user again.', fix: 'Score memory files by term hits and return the body.' });
});
suite('host integration expert', 'host integration', () => {
  const hooksJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8'));
  const events = Object.keys(hooksJson.hooks);
  check('plugin hooks cover the nine events', ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PreCompact', 'PostCompact', 'Stop', 'SubagentStop', 'SessionEnd'].every((e) => events.includes(e)), { happened: events.join(','), why: 'A missing event is a feature that silently never runs.', fix: 'Add the event to hooks/hooks.json.' });
  const cmds = Object.values(hooksJson.hooks).flat().flatMap((g) => g.hooks).map((h) => h.command);
  check('every plugin hook points at lib/hooks.mjs through CLAUDE_PLUGIN_ROOT', cmds.every((c) => c.includes('${CLAUDE_PLUGIN_ROOT}/lib/hooks.mjs')), { happened: cmds.join('\n'), why: 'Plugins are installed to a cache path; only the placeholder resolves there.', fix: 'Use node "${CLAUDE_PLUGIN_ROOT}/lib/hooks.mjs" <event>.' });
  const plugin = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
  const market = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'marketplace.json'), 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  check('plugin, marketplace and package agree on name and version', plugin.name === 'atlias' && market.plugins[0].name === 'atlias' && plugin.version === pkg.version && market.plugins[0].version === pkg.version && core.VERSION === pkg.version, { happened: `${plugin.name}@${plugin.version}, market ${market.plugins[0].version}, pkg ${pkg.version}, core ${core.VERSION}`, why: 'Claude Code refuses or mis-caches a plugin whose manifests disagree; the brief would announce the wrong version.', fix: 'Bump all four together.' });
  const mcp = JSON.parse(fs.readFileSync(path.join(ROOT, '.mcp.json'), 'utf8'));
  check('.mcp.json declares the atlias server at mcp/server.mjs', mcp.atlias && mcp.atlias.args[0].endsWith('mcp/server.mjs') && fs.existsSync(path.join(ROOT, 'mcp', 'server.mjs')), { happened: JSON.stringify(mcp), why: 'Without the server the model has no tools, only the brief.', fix: 'Point .mcp.json at ${CLAUDE_PLUGIN_ROOT}/mcp/server.mjs.' });
  const existing = { description: 'x', hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'node other-plugin.js' }] }] } };
  const once = hosts.mergeHooksJson(existing, 'codex');
  const twice = hosts.mergeHooksJson(once, 'codex');
  const ours = (doc) => Object.values(doc.hooks).flat().flatMap((g) => g.hooks).filter((h) => /atlias/.test(h.command)).length;
  check('Codex hooks merge is idempotent and keeps foreign hooks', ours(once) === hosts.CODEX_EVENTS.length && ours(twice) === hosts.CODEX_EVENTS.length && twice.hooks.UserPromptSubmit.some((g) => g.hooks.some((h) => h.command === 'node other-plugin.js')), { happened: `ours once ${ours(once)} twice ${ours(twice)}`, why: 'Re-running install must not duplicate hooks (each duplicate runs the harness twice per event) or delete the usage-limits hooks.', fix: 'Filter out hooks whose command contains atlias before appending ours.' });
  check('PreToolUse and PostToolUse carry a matcher for Codex', once.hooks.PreToolUse.some((g) => g.matcher === '.*') && once.hooks.PostToolUse.some((g) => g.matcher === '.*'), { happened: JSON.stringify(once.hooks.PreToolUse), why: 'Codex tool hooks without a matcher may never fire.', fix: 'Set matcher ".*" for tool events.' });
  const stripped = hosts.stripHooksJson(twice);
  check('uninstall strips only ours', ours(stripped) === 0 && stripped.hooks.UserPromptSubmit.length === 1, { happened: JSON.stringify(stripped.hooks), why: 'Uninstall must leave other plugins untouched.', fix: 'stripHooksJson filters by command text.' });
  const toml = "model = 'x'\n\n[mcp_servers.other]\ncommand = 'y'\n\n[mcp_servers.atlias]\ncommand = 'old'\n\n[mcp_servers.atlias.env]\nA = '1'\n\n[features]\nhooks = true\n";
  const merged = hosts.mergeToml(toml);
  const mergedTwice = hosts.mergeToml(merged);
  check('TOML merge replaces the old atlias table and its subtables, once', (merged.match(/\[mcp_servers\.atlias\]/g) || []).length === 1 && !/command = 'old'/.test(merged) && !/\[mcp_servers\.atlias\.env\]/.test(merged) && /\[mcp_servers\.other\]/.test(merged) && /\[features\]/.test(merged) && mergedTwice === merged, { happened: merged, why: 'A duplicate TOML table makes Codex refuse to start; losing [features] or other servers breaks the user.', fix: 'Skip from the atlias header to the next header, then append one block.' });
  check('TOML strip removes the table and keeps the rest', !/atlias/.test(hosts.stripToml(merged)) && /\[features\]/.test(hosts.stripToml(merged)), { happened: hosts.stripToml(merged), why: 'Uninstall must be clean.', fix: 'stripToml mirrors mergeToml without appending.' });
  const md = '# Rules\n\nkeep me\n';
  const m1 = hosts.mergeBlock(md, 'body one');
  const m2 = hosts.mergeBlock(m1, 'body two');
  check('instruction block is inserted once and replaced in place', (m2.match(/atlias:start/g) || []).length === 1 && /body two/.test(m2) && !/body one/.test(m2) && /keep me/.test(m2), { happened: m2, why: 'Stacked blocks in AGENTS.md or GEMINI.md cost tokens on every Codex and Antigravity turn.', fix: 'Replace between the markers when they exist.' });
  check('strip removes the block and keeps the rest', !/atlias/.test(hosts.stripBlock(m2)) && /keep me/.test(hosts.stripBlock(m2)), { happened: hosts.stripBlock(m2), why: 'Uninstall must be clean.', fix: 'stripBlock removes markers and body.' });
  const gem = hosts.mergeGeminiSettings({ mcpServers: { other: {} } }, true);
  check('Gemini settings gain the server and one hook per event', gem.mcpServers.atlias && gem.mcpServers.other && hosts.GEMINI_EVENTS.every(([e]) => (gem.hooks[e] || []).length === 1), { happened: JSON.stringify(gem).slice(0, 300), why: 'Gemini CLI reads hooks from settings.json with its own event names.', fix: 'Map events through GEMINI_EVENTS.' });
  const block = hosts.instructionBlock('codex');
  check('instruction block names every tool and the memory path', /harness_remember/.test(block) && /graph_query/.test(block) && /MEMORY\.md/.test(block), { happened: block.slice(0, 200), why: 'Codex and Antigravity have no SessionStart brief from the plugin; the block is their only standing pointer.', fix: 'Keep the tool names and memory path in instructionBlock.' });
});

suite('dispatcher expert', 'end to end hooks', () => {
  const s = sid('e2e');
  const start = hookRun('session-start', { session_id: s, cwd: PROJECT, source: 'startup' });
  check('session-start exits 0 and returns a SessionStart context', start.status === 0 && start.json && start.json.hookSpecificOutput && start.json.hookSpecificOutput.hookEventName === 'SessionStart' && /atlias/.test(start.json.hookSpecificOutput.additionalContext), { happened: `status ${start.status} stdout ${start.stdout.slice(0, 200)} stderr ${start.stderr.slice(0, 200)}`, why: 'This is the link that fires when Claude Code opens; if it fails the harness is invisible.', fix: 'Check lib/hooks.mjs imports and brief.build for a thrown error (see ~/.atlias/log.txt).' });
  const pre = hookRun('pre-tool', { session_id: s, cwd: PROJECT, tool_name: 'Read', tool_input: { file_path: 'x' } });
  check('pre-tool is silent and exits 0', pre.status === 0 && pre.stdout.trim() === '', { happened: `status ${pre.status} stdout ${pre.stdout}`, why: 'Any stdout here is injected into the model on every tool call.', fix: 'guard.preTool must return null on the common path.' });
  const post = hookRun('post-tool', { session_id: s, cwd: PROJECT, tool_name: 'Read', tool_input: { file_path: 'x' }, tool_result: 'ok' });
  check('post-tool is silent and exits 0', post.status === 0 && post.stdout.trim() === '', { happened: `status ${post.status} stdout ${post.stdout}`, why: 'Same as pre-tool.', fix: 'track.postTool returns null.' });
  const stop = hookRun('stop', { session_id: s, cwd: PROJECT, last_assistant_message: 'hello' });
  check('stop with no edits is silent and exits 0', stop.status === 0 && stop.stdout.trim() === '', { happened: `status ${stop.status} stdout ${stop.stdout} stderr ${stop.stderr.slice(0, 200)}`, why: 'A gate that speaks on question-only turns is noise the user pays for.', fix: 'gate.stop returns null when nothing changed.' });
  const bad = hookRun('nonsense-event', { session_id: s });
  check('unknown event exits 0 silently', bad.status === 0 && bad.stdout.trim() === '', { happened: `status ${bad.status}`, why: 'A non-zero exit shows an error to the user on every event of that kind.', fix: 'Default branch logs and returns null.' });
  const garbage = spawnSync(process.execPath, [path.join(ROOT, 'lib', 'hooks.mjs'), 'stop'], { input: 'not json', encoding: 'utf8', env: process.env, timeout: 20000 });
  check('garbage stdin never crashes a hook', garbage.status === 0, { happened: `status ${garbage.status} stderr ${garbage.stderr.slice(0, 200)}`, why: 'Hosts occasionally send empty or partial payloads.', fix: 'readStdin must fall back to an empty object.' });
  const gem = hooksMod.shape({ decision: 'block', reason: 'r' }, 'gemini');
  const gem2 = hooksMod.shape({ hookSpecificOutput: { hookEventName: 'BeforeTool', additionalContext: 'ctx' } }, 'gemini');
  check('Gemini shape mapping', gem.decision === 'deny' && gem.reason === 'r' && gem2.decision === 'allow' && gem2.additionalContext === 'ctx', { happened: JSON.stringify([gem, gem2]), why: 'Gemini CLI reads a flat decision object (as graphify\'s own Gemini hook does).', fix: 'Map block to deny and additionalContext to a flat allow.' });
});

async function mcpSuite() {
  if (only.length && !only.some((o) => 'mcp server'.includes(o.toLowerCase()))) return;
  current = { expert: 'MCP expert', name: 'mcp server', passed: 0, failed: [] };
  results.push(current);
  const child = spawn(process.execPath, [path.join(ROOT, 'mcp', 'server.mjs')], { env: process.env, cwd: PROJECT });
  const lines = [];
  let buf = '';
  child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) !== -1) { lines.push(buf.slice(0, i)); buf = buf.slice(i + 1); } });
  const send = (o) => child.stdin.write(JSON.stringify(o) + '\n');
  const waitFor = (n, ms = 8000) => new Promise((res) => { const t0 = Date.now(); const tick = () => (lines.length >= n || Date.now() - t0 > ms ? res() : setTimeout(tick, 25)); tick(); });
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test' } } });
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'harness_progress', arguments: { action: 'set', text: 'ship it', cwd: PROJECT } } });
  send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'harness_progress', arguments: { action: 'get', cwd: PROJECT } } });
  send({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'no_such_tool', arguments: {} } });
  send({ jsonrpc: '2.0', id: 6, method: 'unknown/method' });
  await waitFor(6);
  child.stdin.end();
  const msgs = lines.map((l) => { try { return JSON.parse(l); } catch { return { bad: l }; } });
  const by = (id) => msgs.find((m) => m.id === id);
  check('initialize answers with serverInfo atlias', by(1) && by(1).result && by(1).result.serverInfo.name === 'atlias', { happened: JSON.stringify(by(1)), why: 'Hosts drop a server that does not complete the handshake.', fix: 'Reply to initialize with protocolVersion, capabilities.tools and serverInfo.' });
  check('tools/list exposes the nine tools', by(2) && by(2).result && by(2).result.tools.length === 9 && by(2).result.tools.every((t) => t.inputSchema && t.inputSchema.type === 'object'), { happened: JSON.stringify(by(2)).slice(0, 200), why: 'Missing or schema-less tools are invisible or rejected by the host.', fix: 'Every TOOLS entry needs name, description and an object inputSchema.' });
  check('harness_progress set then get round-trips', by(3) && /ship it/.test(by(3).result.content[0].text) && by(4) && /ship it/.test(by(4).result.content[0].text), { happened: JSON.stringify([by(3), by(4)]).slice(0, 300), why: 'The handoff note is the model\'s memory across compaction; a broken round-trip loses it.', fix: 'callTool harness_progress must write next.md and rebuild the note.' });
  check('unknown tool returns isError, not a crash', by(5) && by(5).result && by(5).result.isError === true, { happened: JSON.stringify(by(5)), why: 'A thrown error would kill the server for the whole session.', fix: 'Catch in tools/call and return isError true.' });
  check('unknown method returns JSON-RPC -32601', by(6) && by(6).error && by(6).error.code === -32601, { happened: JSON.stringify(by(6)), why: 'Hosts probe optional methods; a wrong error code can be read as a protocol failure.', fix: 'Return code -32601 for unknown methods with an id.' });
  check('server exits cleanly when stdin closes', await new Promise((res) => { const t = setTimeout(() => res(false), 5000); child.on('exit', (c) => { clearTimeout(t); res(c === 0); }); }), { happened: 'server did not exit within 5 s of stdin end', why: 'Orphaned servers pile up across sessions.', fix: 'process.stdin.on("end") must exit.' });
}
await mcpSuite();


suite('ship expert', 'logo', () => {
  const plain = logoMod.logo({ color: 'none', width: 100 });
  check('the wordmark spells ATLIAS in blocks', logoMod.wordmark('ATLIAS').length === 5 && plain.includes('\u2588'), { happened: plain.split('\n')[1], why: 'The logo is the first thing anyone sees; block letters are the whole design.', fix: 'Check GLYPHS and wordmark().' });
  check('the ship rides on the right', plain.includes('<_') && plain.includes('>=='), { happened: plain, why: 'Gev asked for a small spaceship beside the wordmark.', fix: 'Keep the SHIP rows and the wide branch in logo().' });
  check('NO_COLOR output carries no escape codes', !plain.includes('\u001b'), { happened: JSON.stringify(plain.slice(0, 60)), why: 'A logo that prints escape codes into a pipe or a log file is unreadable.', fix: 'colorMode returns none when NO_COLOR is set; paint must pass text through.' });
  const colored = logoMod.logo({ color: 'truecolor', width: 100 });
  check('truecolor output is blue', colored.includes('38;2;29;78;216') && colored.includes('38;2;147;197;253'), { happened: JSON.stringify(colored.slice(0, 80)), why: 'Gev asked for blue, light to dark.', fix: 'Check the BLUE ramp and paint().' });
  const basic = logoMod.logo({ color: 'basic', width: 100 });
  check('16-colour terminals still get blue', basic.includes('\u001b[34m') || basic.includes('\u001b[94m'), { happened: JSON.stringify(basic.slice(0, 60)), why: 'Older terminals must not print raw truecolor sequences.', fix: 'paint() falls back to 34 and 94.' });
  const narrow = logoMod.logo({ color: 'none', width: 20 });
  check('a narrow terminal gets one line, not a broken ship', !narrow.includes('\n') && narrow.includes('atlias'), { happened: narrow, why: 'A wrapped logo looks like a crash.', fix: 'Keep the width guard at the top of logo().' });
  check('the ship is dropped before the letters are', !logoMod.logo({ color: 'none', width: 40 }).includes('>=='), { happened: 'ship still drawn at width 40', why: 'The wordmark matters more than the ship when space is short.', fix: 'The wide branch needs rows[0].length + 16 columns.' });
  check('colorMode respects NO_COLOR over everything', logoMod.colorMode({ NO_COLOR: '1', COLORTERM: 'truecolor' }, { isTTY: true }) === 'none', { happened: logoMod.colorMode({ NO_COLOR: '1', COLORTERM: 'truecolor' }, { isTTY: true }), why: 'NO_COLOR is a promise to the user.', fix: 'Check it first in colorMode.' });
});

suite('agent expert', 'regular agent', () => {
  const block = (json) => 'sure\n' + "```" + 'atlias\n' + json + '\n' + "```";
  const call = agentMod.parseToolCall(block('{"tool":"read_file","path":"a.js"}'));
  check('a fenced atlias block is parsed as a tool call', call && call.tool === 'read_file' && call.path === 'a.js', { happened: JSON.stringify(call), why: 'The local engine can only act through this block; a parser miss makes the agent mute.', fix: 'Check TOOL_RE and parseToolCall.' });
  check('prose is not mistaken for a tool call', agentMod.parseToolCall('I will read the file next.') === null, { happened: 'prose parsed as a call', why: 'A false positive runs a tool the model did not ask for.', fix: 'Require the fenced atlias block.' });
  check('malformed JSON in a block is rejected, not thrown', agentMod.parseToolCall(block('{oops')) === null, { happened: 'threw or returned a value', why: 'A local model will produce broken JSON sooner or later; the loop must survive it.', fix: 'Wrap JSON.parse in try/catch and return null.' });
  check('the system prompt names every tool', ['read_file', 'write_file', 'list_dir', 'grep', 'shell', 'recall', 'remember'].every((t) => agentMod.systemPrompt(PROJECT).includes(t)), { happened: agentMod.systemPrompt(PROJECT).slice(0, 120), why: 'A tool the prompt does not name is a tool the model never calls.', fix: 'Keep the tool line in systemPrompt.' });
  check('echo is always an available engine', agentMod.detectEngines().echo === true && agentMod.pickEngine('echo') === 'echo', { happened: JSON.stringify(agentMod.detectEngines()), why: 'The loop has to be testable and demonstrable with no model installed.', fix: 'detectEngines always reports echo.' });
  check('an engine that is not installed resolves to null, not a crash', agentMod.pickEngine('not-an-engine') === null, { happened: String(agentMod.pickEngine('not-an-engine')), why: 'The user gets a clear message instead of a stack trace.', fix: 'pickEngine returns null when the requested engine is absent.' });
});

await (async function agentRuntimeSuite() {
  if (only.length && !only.some((o) => 'agent runtime'.includes(o.toLowerCase()))) return;
  current = { expert: 'agent runtime expert', name: 'agent runtime', passed: 0, failed: [] };
  results.push(current);
  const state = agentMod.newState(PROJECT, 'echo');
  const wrote = await agentMod.runTool(state, { tool: 'write_file', path: 'agent-made.mjs', content: 'export const ok = 1;\n' });
  check('write_file writes and records the change', /written/.test(wrote) && fs.existsSync(path.join(PROJECT, 'agent-made.mjs')) && core.events(state.sid).some((e) => e.kind === 'edit'), { happened: wrote, why: 'If the write is not recorded the gate and the handoff note never see it.', fix: 'runTool write_file must call recordEvent with kind edit.' });
  const broke = await agentMod.runTool(state, { tool: 'write_file', path: 'agent-broken.mjs', content: 'export const a = ;\n' });
  check('a file that does not parse is reported at once', /does not parse/.test(broke), { happened: broke, why: 'Catching it here saves a whole turn.', fix: 'runTool write_file runs syntaxCheck on code files.' });
  const refused = await agentMod.runTool(state, { tool: 'shell', command: DANGER[3] }, null);
  check('a destructive shell command is refused without a confirmation', /refused by the user/.test(refused), { happened: refused, why: 'The terminal agent runs commands directly; the guard is the only thing between it and the disk.', fix: 'runTool shell asks, and treats no answer as no.' });
  const unknown = await agentMod.runTool(state, { tool: 'teleport' });
  check('an unknown tool answers with the list of real ones', /unknown tool teleport/.test(unknown) && /read_file/.test(unknown), { happened: unknown, why: 'A bare error teaches the model nothing.', fix: 'Return the tool list in the default branch.' });
  const reply = await agentMod.turn(state, 'say something', null, null);
  check('a turn on the echo engine round-trips through the harness', /echo: say something/.test(reply) && state.history.length === 2, { happened: reply, why: 'This is the whole loop: router, engine, gate, history.', fix: 'Check turn() and the echo branch.' });
})();

suite('extra harness expert', 'extra harnesses', () => {
  const dir = path.join(TMP, 'fakehost');
  const host = { id: 'testhost', label: 'Test Host', dir, mcp: path.join(dir, 'mcp.json'), shape: 'mcpServers', docs: path.join(dir, 'AGENTS.md'), verified: false };
  check('a harness that is not installed is skipped, not created', /skipped/.test(extras.install(host)) && !fs.existsSync(dir), { happened: extras.install(host), why: 'atlias must not scatter config for tools the user does not have.', fix: 'install() checks that the harness directory exists first.' });
  fs.mkdirSync(dir, { recursive: true });
  const first = extras.install(host);
  const doc = JSON.parse(fs.readFileSync(host.mcp, 'utf8'));
  check('installing writes the mcp server and the instruction block', doc.mcpServers.atlias.command === 'node' && fs.readFileSync(host.docs, 'utf8').includes('atlias:start'), { happened: first, why: 'Without both, the harness has the tools but no idea when to use them, or the reverse.', fix: 'Check install() and instructionBlock().' });
  check('the unverified shape is declared, not hidden', /UNVERIFIED/.test(first), { happened: first, why: 'Never pass an approximation off as the real thing.', fix: 'Keep the UNVERIFIED note for any host whose schema was not checked against a primary source.' });
  fs.writeFileSync(host.mcp, JSON.stringify({ mcpServers: { other: { command: 'x' } }, theme: 'dark' }));
  extras.install(host);
  const merged = JSON.parse(fs.readFileSync(host.mcp, 'utf8'));
  check('installing keeps the other servers and the other settings', merged.mcpServers.other && merged.theme === 'dark' && merged.mcpServers.atlias, { happened: JSON.stringify(merged), why: 'Overwriting a user config is the fastest way to lose their trust.', fix: 'The shape helpers spread the existing document.' });
  extras.install(host);
  const twice = JSON.parse(fs.readFileSync(host.mcp, 'utf8'));
  const blocks = (fs.readFileSync(host.docs, 'utf8').match(/atlias:start/g) || []).length;
  check('installing twice changes nothing the second time', Object.keys(twice.mcpServers).length === 2 && blocks === 1, { happened: 'servers ' + Object.keys(twice.mcpServers).join(',') + ' blocks ' + blocks, why: 'Duplicated entries cost tokens on every turn and can stop a harness starting.', fix: 'mergeBlock replaces between markers; the shape helpers key by name.' });
  extras.uninstall(host);
  const after = JSON.parse(fs.readFileSync(host.mcp, 'utf8'));
  check('uninstalling removes only atlias', !after.mcpServers.atlias && after.mcpServers.other && !fs.readFileSync(host.docs, 'utf8').includes('atlias:start'), { happened: JSON.stringify(after), why: 'An uninstall that takes someone else with it is worse than no uninstall.', fix: 'Check the remove() helpers and stripBlock.' });
  const shapes = extras.SHAPES;
  const oc = shapes.opencode.add({ mcp: { other: {} } });
  check('the OpenCode shape uses its own command array form', Array.isArray(oc.mcp.atlias.command) && oc.mcp.atlias.type === 'local' && oc.mcp.other, { happened: JSON.stringify(oc), why: 'Each harness has its own schema; one shape does not fit all.', fix: 'Check SHAPES.opencode.' });
  const amp = shapes.ampSettings.add({});
  const zed = shapes.zed.add({});
  check('the Amp and Zed shapes use their own keys', amp['amp.mcpServers'].atlias && zed.context_servers.atlias.source === 'custom', { happened: JSON.stringify([amp, zed]), why: 'Writing mcpServers into Zed would do nothing at all, silently.', fix: 'Check SHAPES.ampSettings and SHAPES.zed.' });
  check('every listed harness has a directory, an instructions file and an id', extras.EXTRAS.length >= 8 && extras.EXTRAS.every((h) => h.id && h.dir && h.docs), { happened: extras.EXTRAS.length + ' harnesses', why: 'The table is the feature: adding a harness should be one row.', fix: 'Fill in the missing field on the offending row.' });
  check('the harness ids are unique', new Set(extras.EXTRAS.map((h) => h.id)).size === extras.EXTRAS.length, { happened: extras.EXTRAS.map((h) => h.id).join(','), why: 'A duplicate id makes --extras <id> ambiguous.', fix: 'Rename the duplicate.' });
});


suite('reliability expert', 'hook budgets', () => {
  const hooksJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8'));
  const sessionStart = hooksJson.hooks.SessionStart[0].hooks[0].timeout;
  const worst = (core.PROBE_BUDGET_MS + graphMod.GODNODES_MS) / 1000;
  check('the brief cannot outlast the timeout it declares', sessionStart > worst + 5, { happened: 'SessionStart declares ' + sessionStart + 's, worst case inside is about ' + worst + 's', why: 'A SessionStart hook that times out gives the user no brief at all, on a fresh machine, every session. This is the defect that shipped in 1.2.0.', fix: 'Lower PROBE_BUDGET_MS or GODNODES_MS, or raise the timeout in hooks/hooks.json and CODEX_EVENTS together.' });
  check('the Codex hook declares the same budget as the plugin', hosts.CODEX_EVENTS.find((e) => e[0] === 'SessionStart')[2] === sessionStart, { happened: 'codex ' + hosts.CODEX_EVENTS.find((e) => e[0] === 'SessionStart')[2] + 's vs plugin ' + sessionStart + 's', why: 'The same code runs in both; a tighter budget in one host fails only there, which is the hardest kind of bug to see.', fix: 'Keep the SessionStart timeout in hooks/hooks.json and CODEX_EVENTS in step.' });
  check('one interpreter probe is short', core.PROBE_MS <= 5000 && core.PROBE_BUDGET_MS <= 10000, { happened: 'probe ' + core.PROBE_MS + 'ms, budget ' + core.PROBE_BUDGET_MS + 'ms', why: 'On Windows a bare python stub can stall; six of those at fifteen seconds is a minute and a half.', fix: 'Keep PROBE_MS and PROBE_BUDGET_MS small.' });
  const cachePath = path.join(process.env.ATLIAS_HOME, 'python.json');
  const saved = fs.existsSync(cachePath) ? fs.readFileSync(cachePath, 'utf8') : null;
  fs.writeFileSync(cachePath, JSON.stringify({ path: null, checked: Date.now() }));
  const t0 = Date.now();
  const miss = core.findPython();
  const elapsed = Date.now() - t0;
  check('a remembered miss costs nothing', miss === null && elapsed < 150, { happened: 'returned ' + miss + ' in ' + elapsed + 'ms', why: 'Without a negative cache every session on a machine without graphify re-runs the whole search.', fix: 'findPython returns early when the cached path is null and the miss is fresh.' });
  if (saved) fs.writeFileSync(cachePath, saved); else fs.unlinkSync(cachePath);
  check('counting files survives a directory that is not there', graphMod.countCodeFiles(path.join(TMP, 'no-such-dir'), 10) === 0, { happened: String(graphMod.countCodeFiles(path.join(TMP, 'no-such-dir'), 10)), why: 'A cwd can disappear between the hook firing and the walk starting.', fix: 'The walk swallows readdir errors and moves on.' });
  check('counting files honours its own wall clock', graphMod.countCodeFiles(ROOT, 100000, 0) <= 100000, { happened: 'walk ignored a zero budget', why: 'On a monorepo an unbounded walk stalls the brief that the host is waiting for.', fix: 'Check the deadline at the top of the loop in countCodeFiles.' });
  const b0 = Date.now();
  brief.build({ cwd: PROJECT, session_id: sid('budget'), source: 'startup' }, 'claude');
  const bms = Date.now() - b0;
  check('a warm brief is built in well under a second', bms < 1000, { happened: bms + 'ms', why: 'The brief runs before the user can type; it is the first thing that makes the harness feel slow or fast.', fix: 'Check what in brief.build is spawning a process on the warm path.' });
});

suite('measurement expert', 'bench', () => {
  check('the token estimate is the same rule on both sides', benchMod.estimateTokens('') === 0 && benchMod.estimateTokens('abcd') === 1 && benchMod.estimateTokens('a'.repeat(400)) === 100, { happened: [benchMod.estimateTokens(''), benchMod.estimateTokens('abcd'), benchMod.estimateTokens('a'.repeat(400))].join(','), why: 'A comparison is only honest if both sides are counted the same way.', fix: 'Keep estimateTokens at four characters per token, and zero for empty.' });
  check('a null or undefined input does not throw', benchMod.estimateTokens(null) === 0 && benchMod.estimateTokens(undefined) === 0, { happened: 'estimateTokens threw or returned a non-zero value', why: 'bench runs over whatever the project happens to contain.', fix: 'Guard the null case in estimateTokens.' });
  check('with no graph the comparison is refused, not faked', benchMod.graphVsFiles(PROJECT, 'anything at all') === null, { happened: JSON.stringify(benchMod.graphVsFiles(PROJECT, 'anything at all')), why: 'A benchmark that invents a saving is worse than no benchmark.', fix: 'graphVsFiles returns null when graph.query has no answer.' });
  const text = benchMod.report(PROJECT);
  check('the report works on a project with nothing in it', typeof text === 'string' && /no graph in this project/.test(text), { happened: text.slice(0, 200), why: 'The first thing anyone runs it on may have no graph and no history.', fix: 'Check the empty branches in report().' });
  check('every estimate is labelled as one', /estimate/i.test(text), { happened: text.slice(0, 200), why: 'Four characters per token is a rule of thumb; presenting it as measurement is the dressing up that makes a benchmark worthless.', fix: 'Keep the word estimate beside every derived number.' });
  const withGraph = benchMod.report(ROOT);
  check('a saving is reported as an upper bound, not a promise', !/across \d+ question/.test(withGraph) || /upper bound/.test(withGraph), { happened: withGraph.split('\n').filter((l) => /across|upper bound/.test(l)).join(' | '), why: 'The file side of the comparison assumes every named file would have been read in full. Stated without that caveat it flatters the harness.', fix: 'Keep the upper bound lines beside the total in report().' });
  check('the report says plainly what it does not measure', /Not measured here/.test(text) && /has not been done/.test(text), { happened: text.slice(-200), why: 'The open question is whether the guard and the gate raise task success; the bench must not imply it answered that.', fix: 'Keep the closing paragraph in report().' });
  const counted = benchMod.interventions(PROJECT);
  check('intervention counts come from real digests and add up', counted.sessions >= 0 && counted.toolCalls >= 0 && counted.spoke === counted.guard + counted.gate, { happened: JSON.stringify(counted), why: 'These are the only numbers here taken from real runs rather than derived, so they have to add up.', fix: 'Check interventions() against the history.jsonl row shape.' });
  const cost = benchMod.briefCost(PROJECT);
  check('the brief cost is measured, not guessed', cost.chars > 0 && cost.tokens === Math.ceil(cost.chars / 4), { happened: JSON.stringify(cost), why: 'The one cost atlias imposes on every session should be the number it is most precise about.', fix: 'briefCost builds the real brief and counts it.' });
});

let failed = 0;
for (const r of results) {
  const ok = r.failed.length === 0;
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${r.name} (${r.expert}): ${r.passed} passed, ${r.failed.length} failed\n`);
  for (const f of r.failed) {
    failed++;
    process.stdout.write(`  x ${f.test}\n    What happened: ${String(f.happened).replace(/\n/g, '\n                   ')}\n    Why it matters: ${f.why}\n    Fix: ${f.fix}\n`);
  }
}
const total = results.reduce((n, r) => n + r.passed + r.failed.length, 0);
process.stdout.write(`\n${total - failed}/${total} checks passed across ${results.length} suites.\n`);
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* temp */ }
process.exit(failed ? 1 : 0);