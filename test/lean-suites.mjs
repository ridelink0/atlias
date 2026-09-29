// Round five, row 4: the lean brief (flags.leanBrief). The brief is paid on every
// request of a session, so each cut is counted in characters here. Measured on
// an empty project in Claude Code: 1357 characters off, 961 lean.
const NL = String.fromCharCode(10);

export default async function ({ suite, check, brief, TMP, ROOT, fs, path }) {
  const withEnv = (vars, fn) => {
    const before = {};
    for (const k of Object.keys(vars)) { before[k] = process.env[k]; if (vars[k] == null) delete process.env[k]; else process.env[k] = vars[k]; }
    try { return fn(); } finally { for (const k of Object.keys(vars)) { if (before[k] == null) delete process.env[k]; else process.env[k] = before[k]; } }
  };
  const LEAN = 'ATLIAS_FLAG_LEAN_BRIEF';
  let n = 0;
  const project = (files = {}) => {
    const dir = path.join(TMP, 'lean', `p${++n}`);
    fs.mkdirSync(dir, { recursive: true });
    for (const [rel, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); }
    return dir;
  };
  const build = (dir, host, vars) => withEnv({ [LEAN]: null, ...vars }, () => brief.build({ cwd: dir, session_id: `lean-${++n}`, source: 'startup' }, host));
  const TOOL_NAMES = ['harness_recall', 'harness_remember', 'harness_progress', 'harness_verify', 'harness_digest', 'graph_query', 'graph_affected', 'graph_explain'];

  suite('lean brief expert', 'the lean brief cuts what every request pays for', () => {
    const empty = project();
    const off = build(empty, 'claude', {});
    const zero = build(empty, 'claude', { [LEAN]: '0' });
    const lean = build(empty, 'claude', { [LEAN]: '1' });
    check('off, the brief is the one every earlier arm saw', off === zero && TOOL_NAMES.every((t) => off.split(NL)[0].includes(t)) && /## Companions/.test(off) && /The gate holds a reply without that line/.test(off), { happened: off.slice(0, 300), why: 'The baseline arm is the control for every flag of the round only if an unset flag and a flag set to 0 both give today\'s brief.', fix: 'brief.build changes nothing unless flags.leanBrief is on.' });
    const first = lean.split(NL)[0];
    check('lean, the first line lists no tool names and no CLI path', !TOOL_NAMES.some((t) => first.includes(t)) && !first.includes('atlias.mjs') && /MCP server "atlias"/.test(first), { happened: first, why: 'Claude Code lists the MCP server\'s tool names itself and loads the rest on demand; repeating eight names is paid on every request.', fix: 'The lean first line names the server only.' });
    check('lean, there is no Companions section when it asks nothing of the model', !/## Companions/.test(lean) && !/graphify missing|ultimate-frontend-skills off/.test(lean), { happened: (lean.match(/## Companions[^]*?(\n\n|$)/) || ['(none)'])[0], why: 'What is installed or missing is for the user and atlias doctor; the model can do nothing with it on every request.', fix: 'Lean keeps the section only for a companion loaded twice or usage-limits.' });
    const dup = project({ '.claude/skills/ultimate-frontend-skills/SKILL.md': '# UFS', '.claude/settings.json': '{"enabledPlugins":{"ultimate-frontend-skills@ridelink0":true}}' });
    const leanDup = build(dup, 'claude', { [LEAN]: '1' });
    check('lean, a companion loaded twice is still said, and only that', /## Companions\nultimate-frontend-skills loaded 2 times .*keep one\.$/m.test(leanDup) && !/graphify missing|graphify ok/.test(leanDup), { happened: (leanDup.match(/## Companions\n[^\n]*/) || ['(none)'])[0], why: 'Two copies of a skill load twice on every request; that is the one companion fact the model should act on.', fix: 'Keep lines that say keep one or usage-limits on.' });
    check('doneRule is the old rule with no flag and loses the gate sentence when lean', brief.doneRule() === brief.RULES[2] && !/The gate holds/.test(brief.doneRule({ lean: true })) && /The gate holds/.test(brief.doneRule()), { happened: brief.doneRule({ lean: true }), why: 'The flag changes only its own part of the rule.', fix: 'doneRule in lib/brief.mjs.' });
    check('lean, the pass line is taught once, without the sentence explaining the gate', lean.split('"Pass 1: <check> passed. Pass 2: <what the re-read found>."').length === 2 && !/The gate holds a reply without that line/.test(lean) && /Done means verified: run the smallest real check/.test(lean), { happened: (lean.match(/- Done means[^\n]*/) || ['(no done rule)'])[0], why: 'The double-check skill and the gate\'s own hold message both explain the line; the brief needs only the line the gate accepts.', fix: 'doneRule({ lean: true }) in lib/brief.mjs.' });
    check('lean, the Claude Code brief is at least 350 characters shorter, under 1000, and the same on every build', lean.length <= off.length - 350 && lean.length < 1000 && lean === build(empty, 'claude', { [LEAN]: '1' }), { happened: `${off.length} characters off, ${lean.length} lean`, why: 'NEXTGEN-5 row 4 aims at the fixed text paid on every request; a cut nobody counted is not a cut, and a brief that changes between builds cannot be cached as a prompt prefix.', fix: 'Check what brief.build adds under leanBrief.' });
    const offCodex = build(empty, 'codex', {});
    const leanCodex = build(empty, 'codex', { [LEAN]: '1' });
    check('lean does the same for the other hosts, and keeps their memory section', leanCodex.length <= offCodex.length - 350 && /## Memory/.test(leanCodex) && !TOOL_NAMES.some((t) => leanCodex.split(NL)[0].includes(t)), { happened: `${offCodex.length} off, ${leanCodex.length} lean`, why: 'Codex has no shared memory of its own; the section is how it finds harness_remember.', fix: 'Only the tool line, Companions and the done rule change.' });
  });

  suite('lean brief expert', 'the skills the plugin ships describe themselves briefly', () => {
    // Claude Code lists every skill's description on every request. The plugin's
    // SKILL.md files are static, so no flag can switch them per arm: this cut
    // lands for every arm, and is kept to wording, with each trigger kept.
    const desc = (name) => (/^description: "(.*)"$/m.exec(fs.readFileSync(path.join(ROOT, 'skills', name, 'SKILL.md'), 'utf8')) || [])[1] || '';
    const dc = desc('double-check');
    const at = desc('harness');
    const triggers = /done/.test(dc) && /second pass/.test(dc) && /bug-check/.test(dc) && /memory/.test(at) && /recall/.test(at) && /knowledge graph/.test(at) && /handoff/.test(at);
    check('each shipped skill description is 200 characters or fewer and still names what it is for', dc.length <= 200 && at.length <= 200 && triggers, { happened: `double-check ${dc.length}, atlias ${at.length}; triggers ${triggers ? 'kept' : 'lost'}: ${dc} | ${at}`, why: 'They were 307 and 354 characters, listed on every request of every session; and a description is how the model decides to load a skill, so a shorter one that loses its trigger is a skill that never loads.', fix: 'Shorten the description line of each skills/*/SKILL.md, keeping its triggers.' });
  });
}
