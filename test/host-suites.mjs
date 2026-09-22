// What each host really sends, pinned to its source. Codex shapes come from
// openai/codex: apply_patch hooks get tool_input {command: "<patch>"}
// (codex-rs/core/src/tools/handlers/apply_patch.rs), shell hooks get tool_name
// "Bash" with {command} and a plain string tool_response with no exit code
// (unified_exec), and PreToolUse fails open on permissionDecision "ask"
// (codex-rs/hooks/src/events/pre_tool_use.rs). Loaded by test/run.mjs.
import * as core from '../lib/core.mjs';
import * as guard from '../lib/guard.mjs';
import * as track from '../lib/track.mjs';
import * as integrity from '../lib/integrity.mjs';
import * as hooksMod from '../lib/hooks.mjs';

export default async function hostSuites({ suite, check, PROJECT }) {
  const NL = String.fromCharCode(10);
  const patch = ['*** Begin Patch', '*** Update File: src/a.js', '@@', '-x', '+y', '*** Add File: b.js', '+z', '*** Delete File: old.js', '*** Update File: c.js', '*** Move to: d.js', '*** End Patch'].join(NL);

  suite('codex payload expert', 'Codex edits are seen', () => {
    const files = core.filesFromTool('apply_patch', { command: patch });
    check('a Codex patch names every file it adds, updates or renames to', ['src/a.js', 'b.js', 'c.js', 'd.js'].every((f) => files.includes(f)) && !files.includes('old.js'), { happened: JSON.stringify(files), why: 'Codex sends the patch in tool_input.command; reading only input or patch left every Codex edit invisible to the gate.', fix: 'Check filesFromTool.' });
    check('a patch with Windows line endings still names its files', core.filesFromTool('apply_patch', { command: patch.split(NL).join('\r\n') }).includes('src/a.js'), { happened: JSON.stringify(core.filesFromTool('apply_patch', { command: patch.split(NL).join('\r\n') })), why: 'Codex runs on Windows too.', fix: 'Trim each captured path.' });
    check('the older input and patch keys still work', core.filesFromTool('apply_patch', { input: patch }).includes('b.js') && core.filesFromTool('apply_patch', { patch }).includes('b.js'), { happened: 'an older shape was dropped', why: 'Not every Codex build is current.', fix: 'Keep input and patch in the list.' });
    check('the patch is not mistaken for a shell command', core.commandFromTool('apply_patch', { command: patch }) === null && core.commandFromTool('Bash', { command: 'npm test' }) === 'npm test', { happened: String(core.commandFromTool('apply_patch', { command: patch })).slice(0, 40), why: 'A patch that adds the text rm -rf to a file would otherwise look like a command.', fix: 'commandFromTool returns null for edit tools.' });
    check('a shell command that merely mentions a patch header is not an edit', core.filesFromTool('Bash', { command: 'echo "*** Update File: x.js is a header"' }).length === 0, { happened: JSON.stringify(core.filesFromTool('Bash', { command: 'echo "*** Update File: x.js is a header"' })), why: 'Only a real patch body starts a line with the header.', fix: 'Anchor the headers at the start of a line.' });
    const sid = 'codex-apply-patch';
    track.postTool({ session_id: sid, cwd: PROJECT, tool_name: 'apply_patch', tool_input: { command: patch }, tool_response: 'Success. Updated the following files:' + NL + 'M src/a.js' });
    const ev = core.events(sid).find((e) => e.kind === 'edit');
    check('a Codex edit reaches the session record the gate reads', ev && ev.tool === 'apply_patch' && ev.files.includes('src/a.js'), { happened: JSON.stringify(ev), why: 'The syntax, placeholder and wiring checks only look at recorded edits.', fix: 'Check track.postTool with a Codex payload.' });
    track.postTool({ session_id: sid, cwd: PROJECT, tool_name: 'Bash', tool_input: { command: 'npm test' }, tool_response: '1 failing' + NL + 'AssertionError: expected 2' });
    const sh = core.events(sid).filter((e) => e.kind === 'shell').pop();
    check('a Codex test run with no exit code is still read as failed from its text', sh && sh.verify && sh.outcome === 'fail', { happened: JSON.stringify(sh), why: 'Codex sends only the output string; the failure text is all there is to go on.', fix: 'integrity.verdict falls back to FAIL_RE.' });
    const quiet = integrity.verdict({ tool_response: 'all good' });
    check('and one with no failure text is unknown, never a pass', quiet.outcome === 'unknown', { happened: JSON.stringify(quiet), why: 'Without an exit code, silence is not proof.', fix: 'Only code 0 is a pass.' });
  });

  suite('approval expert', 'destructive commands on hosts that cannot ask', () => {
    const cmd = 'git push --force origin main';
    const sid = 'codex-destructive';
    const pay = { session_id: sid, cwd: PROJECT, tool_name: 'Bash', tool_input: { command: cmd } };
    check('the command under test is one the guard flags', Boolean(guard.destructiveReason(cmd)), { happened: 'not flagged', why: 'Otherwise the rest of this suite proves nothing.', fix: 'Pick a command destructiveReason flags.' });
    const first = guard.preTool(pay, 'codex');
    check('on Codex it is denied, with an instruction to ask the user', first && first.hookSpecificOutput.permissionDecision === 'deny' && /Ask the user/.test(first.hookSpecificOutput.permissionDecisionReason), { happened: JSON.stringify(first), why: 'Codex runs the command anyway when a hook answers ask.', fix: 'Deny on hosts outside CAN_ASK.' });
    const again = guard.preTool(pay, 'codex');
    check('retrying without the user answering is denied again', again && again.hookSpecificOutput.permissionDecision === 'deny', { happened: JSON.stringify(again), why: 'The model must not approve its own command.', fix: 'Require a prompt event after the deny.' });
    core.recordEvent(sid, { kind: 'prompt', prompt_id: 'user-said-yes', text: 'yes, push it' });
    const allowed = guard.preTool(pay, 'codex');
    check('after the user answers, the identical command goes through', allowed === null, { happened: JSON.stringify(allowed), why: 'Otherwise the guard could never be satisfied on Codex.', fix: 'Allow when a prompt follows the last deny.' });
    const later = guard.preTool(pay, 'codex');
    check('one answer allows one run', later && later.hookSpecificOutput.permissionDecision === 'deny', { happened: JSON.stringify(later), why: 'Yes to one force push is not yes to every force push.', fix: 'Record destructive-confirmed and deny again after it.' });
    const gem = hooksMod.shape(guard.preTool({ ...pay, session_id: 'gemini-destructive' }, 'gemini'), 'gemini');
    check('on Gemini CLI it arrives as a deny, not an allow', gem && gem.decision === 'deny', { happened: JSON.stringify(gem), why: 'shape() turned ask into allow, so the command ran unchallenged.', fix: 'Deny on hosts outside CAN_ASK.' });
    const claude = guard.preTool({ ...pay, session_id: 'claude-destructive' }, 'claude');
    check('Claude Code still gets an ask, which it can show the user', claude && claude.hookSpecificOutput.permissionDecision === 'ask', { happened: JSON.stringify(claude), why: 'Claude Code pauses for the user on ask; a deny there would be a needless extra round.', fix: 'Keep claude in CAN_ASK.' });
  });
}
