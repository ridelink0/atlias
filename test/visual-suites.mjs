// image-deep-research as a silent companion (flags.visualHint, default off).
// Every check here is deterministic and spends no model tokens. The claim under
// test is twofold: with the flag off, or on a prompt that is not visual, nothing
// the model sees changes by a byte; with it on, a visual prompt gets one short
// pointer, once per session, chosen from what is installed.
export default async function ({ suite, check, core, brief, router, hosts, TMP, ROOT, fs, path }) {
  const { DESCRIPTIONS } = await import('../lib/settings.mjs');
  const { TOOLS } = await import('../mcp/tools.mjs');
  const FLAG = 'ATLIAS_FLAG_VISUAL_HINT';
  const withEnv = (vars, fn) => {
    const before = {};
    for (const k of Object.keys(vars)) { before[k] = process.env[k]; if (vars[k] == null) delete process.env[k]; else process.env[k] = vars[k]; }
    try { return fn(); } finally { for (const k of Object.keys(vars)) { if (before[k] == null) delete process.env[k]; else process.env[k] = before[k]; } }
  };
  const fx = path.join(ROOT, 'test', 'fixtures');
  const corpus = JSON.parse(fs.readFileSync(path.join(fx, 'visual-prompts.json'), 'utf8'));
  const before = JSON.parse(fs.readFileSync(path.join(fx, 'router-before.json'), 'utf8'));
  const visual = Object.values(corpus.visual).flat();
  const nonVisual = Object.values(corpus.nonVisual).flat();
  const hard = [...corpus.nonVisual['code-with-image-words'], ...corpus.nonVisual['near-miss-visual']];
  let n = 0;
  const dir = (files = {}) => {
    const root = path.join(TMP, 'visual', `f${++n}`);
    for (const [rel, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), typeof text === 'string' ? text : JSON.stringify(text)); }
    fs.mkdirSync(path.join(root, 'claude'), { recursive: true });
    fs.mkdirSync(path.join(root, 'home'), { recursive: true });
    fs.mkdirSync(path.join(root, 'proj'), { recursive: true });
    return { root, deps: { claudeDir: path.join(root, 'claude'), home: path.join(root, 'home'), cwd: path.join(root, 'proj') } };
  };
  const SKILL = '# image-deep-research\nRun with --compact for one numbered sheet.\n';
  const PLAIN = '# image-deep-research\nContact sheets.\n';
  const UFS = 'ultimate-frontend-skills@ultimate-frontend-skills';
  // installPath has to name the fixture's own folder, so write it after the fact.
  const withBundle = (skillText) => {
    const f = dir();
    const ip = path.join(f.root, 'ufs');
    fs.mkdirSync(path.join(f.root, 'claude', 'plugins'), { recursive: true });
    fs.writeFileSync(path.join(f.root, 'claude', 'settings.json'), JSON.stringify({ enabledPlugins: { [UFS]: true } }));
    fs.writeFileSync(path.join(f.root, 'claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ plugins: { [UFS]: [{ installPath: ip }] } }));
    if (skillText != null) { fs.mkdirSync(path.join(ip, 'skills', 'image-deep-research'), { recursive: true }); fs.writeFileSync(path.join(ip, 'skills', 'image-deep-research', 'SKILL.md'), skillText); }
    return f;
  };

  suite('visual router expert', 'a visual prompt is routed by strong phrases and never steals code or frontend prompts', () => {
    const oldBehaviour = [...visual, ...nonVisual].every((p) => router.classify(p) === before[p].classify);
    check('classify(p) with no options equals the pre-change result for the whole corpus', oldBehaviour, { happened: [...visual, ...nonVisual].filter((p) => router.classify(p) !== before[p].classify).slice(0, 3).join(' | '), why: 'The visual class only exists behind the flag; every caller of classify(p) must see what it saw before.', fix: 'classify defaults to { visual: false } and only then reaches VISUAL_RE.' });
    check('classify(p, { visual: false }) never returns visual', [...visual, ...nonVisual].every((p) => router.classify(p, { visual: false }) !== 'visual'), { happened: 'a prompt classified visual with the option off', why: 'Off must mean off.', fix: 'Test visual && VISUAL_RE first.' });
    const hit = visual.filter((p) => router.classify(p, { visual: true }) === 'visual');
    check('with the option on, at least 90% of the visual corpus classifies visual', hit.length >= Math.ceil(visual.length * 0.9), { happened: `${hit.length}/${visual.length}; missed: ${visual.filter((p) => !hit.includes(p)).slice(0, 4).join(' | ')}`, why: 'A hint that rarely fires is not a feature.', fix: 'Extend VISUAL_RE with the missed phrase, strong phrases only.' });
    const wrong = nonVisual.filter((p) => router.classify(p, { visual: true }) === 'visual');
    check('no non-visual prompt, hard negatives included, classifies visual', wrong.length === 0 && hard.length >= 20, { happened: wrong.join(' | '), why: 'A visual hint on a code or frontend prompt is noise the user pays for.', fix: 'Tighten VISUAL_RE or extend CODE_GUARD_RE.' });
    const both = [...visual, ...nonVisual].filter((p) => router.VISUAL_RE.test(p) && router.FRONTEND_RE.test(p));
    check('a prompt matching both VISUAL_RE and FRONTEND_RE classifies frontend', both.length >= 2 && both.every((p) => router.classify(p, { visual: true }) === 'frontend'), { happened: `${both.length} such prompts; ${both.map((p) => router.classify(p, { visual: true })).join(',')}`, why: 'A frontend build has its own companion; the visual hint must not replace it.', fix: 'The visual check requires !FRONTEND_RE.test(p).' });
    check('the code guard catches extensions, src/ and the code words', ['a.tsx', 'x.py', 'src/app', 'the function', 'a component', 'test', 'endpoint', 'bug', 'error', 'defined', 'refactor'].every((w) => router.CODE_GUARD_RE.test(`about ${w} here`)) && !router.CODE_GUARD_RE.test('find images of harbours at dawn'), { happened: 'CODE_GUARD_RE missed a word or matched plain prose', why: 'It is what keeps code prompts that mention images out of the visual route.', fix: 'CODE_GUARD_RE lists extensions, src/ and the seven words.' });
    check('the corpus is big enough: 30+ visual, 60+ non-visual, labelled by category', visual.length >= 30 && nonVisual.length >= 60 && Object.keys(corpus.visual).length >= 8 && Object.keys(corpus.nonVisual).length >= 6, { happened: `${visual.length} visual, ${nonVisual.length} non-visual`, why: 'The zero-cost claim is only as strong as its corpus.', fix: 'Add prompts to test/fixtures/visual-prompts.json and re-capture router-before.json (test/fixtures/capture-router-before.mjs).' });
  });

  suite('visual cost expert', 'with the flag off, or on a non-visual prompt, the model sees the same bytes as before', () => {
    const proj = path.join(TMP, 'visual', 'cost');
    fs.mkdirSync(proj, { recursive: true });
    const run = (flag, p, i) => withEnv({ [FLAG]: flag }, () => JSON.stringify(router.prompt({ session_id: `vcost-${flag}-${i}`, cwd: proj, prompt: p })));
    const noUfs = core.ufsCopies({ cwd: proj }).length === 0;
    const bad = [];
    nonVisual.forEach((p, i) => {
      const off = run(null, p, i);
      const stored = JSON.stringify(before[p].prompt);
      // A frontend hint depends on what this run's Claude directory holds, so it
      // is compared with the stored capture only when nothing is installed.
      if ((before[p].classify !== 'frontend' || noUfs) && off !== stored) bad.push(`off ${p}`);
      for (const flag of ['off', 'compact', 'subagent']) if (run(flag, p, i) !== off) bad.push(`${flag} ${p}`);
    });
    check('for every non-visual prompt, prompt() is byte-identical to router-before.json with the flag off, compact and subagent', bad.length === 0, { happened: bad.slice(0, 3).join(' | '), why: 'Non-visual prompts must cost nothing extra.', fix: 'Only a prompt classified visual may return the visual hint.' });
    const off = visual.map((p, i) => run('off', p, i)).concat(visual.map((p, i) => run(null, p, i)));
    check('with the flag off, a visual prompt gets exactly what it got before', visual.every((p, i) => off[i] === JSON.stringify(before[p].prompt) || before[p].classify === 'frontend') && off.every((o) => !o.includes('image-deep-research')), { happened: off.find((o) => o.includes('image-deep-research')) || 'a visual prompt differs from router-before.json', why: 'Default off means nothing the model sees may change.', fix: 'cfg.flags.visualHint !== off gates the visual class.' });
    check('the flag is registered off, with its three choices and an environment name', core.DEFAULTS.flags.visualHint === 'off' && core.CHOICES.flags.visualHint.join() === 'off,compact,subagent' && core.flagEnvName('visualHint') === FLAG && core.parseSetting('flags', 'visualHint', 'Compact').value === 'compact' && Boolean(core.parseSetting('flags', 'visualHint', 'on').error) && ['0', 'false', 'no', 'Off'].every((v) => core.parseSetting('flags', 'visualHint', v).value === 'off'), { happened: JSON.stringify(core.DEFAULTS.flags), why: 'A typo in a flag must be refused, not read as the default.', fix: 'DEFAULTS.flags.visualHint and CHOICES.flags.visualHint in lib/core.mjs.' });
    check('the settings screen describes the flag', typeof DESCRIPTIONS['flags.visualHint'] === 'string' && DESCRIPTIONS['flags.visualHint'].length > 40, { happened: String(DESCRIPTIONS['flags.visualHint']), why: 'Every registered flag has a line in the settings screen.', fix: 'DESCRIPTIONS in lib/settings.mjs.' });
    const cwd = path.join(TMP, 'visual', 'lazy');
    fs.mkdirSync(cwd, { recursive: true });
    const seen = [];
    const real = fs.accessSync;
    fs.accessSync = (p, ...rest) => { seen.push(String(p)); return real(p, ...rest); };
    let lazy, eager;
    try {
      withEnv({ [FLAG]: 'compact' }, () => { nonVisual.forEach((p, i) => router.prompt({ session_id: `vlazy-${i}`, cwd, prompt: p })); });
      lazy = seen.filter((p) => p.includes('image-deep-research')).length;
      withEnv({ [FLAG]: 'compact' }, () => router.prompt({ session_id: 'vlazy-visual', cwd, prompt: visual[0] }));
      eager = seen.filter((p) => p.includes('image-deep-research')).length;
    } finally { fs.accessSync = real; }
    check('detection is lazy: no image-deep-research lookup for non-visual prompts, one for a visual one', lazy === 0 && eager > 0, { happened: `${lazy} lookups over ${nonVisual.length} non-visual prompts, ${eager} after one visual`, why: 'A file check on every prompt is a cost paid by everyone.', fix: 'Call idrCopies only inside the visual branch of prompt().' });
  });

  suite('visual brief expert', 'the session brief does not change with image-deep-research or with the flag', () => {
    const f = dir();
    const project = f.deps.cwd;
    const build = (flag) => withEnv({ [FLAG]: flag }, () => brief.build({ cwd: project, session_id: `vbrief-${++n}`, source: 'startup' }, 'claude'));
    const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(project, rel)), { recursive: true }); fs.writeFileSync(path.join(project, rel), text); };
    const states = [];
    const snap = (label) => states.push([label, build(null), build('off'), build('compact'), build('subagent')]);
    snap('absent');
    put('.claude/skills/image-deep-research/SKILL.md', SKILL);
    snap('standalone skills');
    put('.claude/settings.json', JSON.stringify({ enabledPlugins: { 'image-deep-research@x': true } }));
    snap('standalone skills and plugin (duplicated)');
    const first = states[0][1];
    const differ = states.flatMap(([label, ...bs]) => bs.map((b, i) => (b === first ? null : `${label}/${i}`))).filter(Boolean);
    check('brief.build bytes are equal across IDR absent, standalone and duplicated, flag unset, off, compact and subagent', differ.length === 0 && states.every(([, ...bs]) => bs.length === 4), { happened: differ.join(', '), why: 'lib/brief.mjs is untouched; the brief is paid on every request and must not learn about IDR.', fix: 'Do not read idrCopies from brief.mjs.' });
    const g = dir();
    const p2 = g.deps.cwd;
    const b2 = (flag) => withEnv({ [FLAG]: flag }, () => brief.build({ cwd: p2, session_id: `vbrief-${++n}`, source: 'startup' }, 'claude'));
    fs.mkdirSync(path.join(p2, '.claude', 'skills', 'ultimate-frontend-skills'), { recursive: true });
    fs.writeFileSync(path.join(p2, '.claude', 'skills', 'ultimate-frontend-skills', 'SKILL.md'), '# UFS');
    const ufsOnly = b2(null);
    fs.mkdirSync(path.join(p2, '.claude', 'skills', 'ultimate-frontend-skills', 'skills', 'image-deep-research'), { recursive: true });
    fs.writeFileSync(path.join(p2, '.claude', 'skills', 'ultimate-frontend-skills', 'skills', 'image-deep-research', 'SKILL.md'), SKILL);
    check('brief.build bytes are equal for UFS with and without a bundled copy, flag off and on', [null, 'off', 'compact', 'subagent'].every((x) => b2(x) === ufsOnly), { happened: 'the brief differs', why: 'A bundled copy is not a new companion line.', fix: 'Leave lib/brief.mjs alone.' });
    check('lib/brief.mjs names no image-deep-research', !/image-deep-research|idrCopies|visualHint/.test(fs.readFileSync(path.join(ROOT, 'lib', 'brief.mjs'), 'utf8')), { happened: 'brief.mjs mentions IDR', why: 'The brief is the one text every request pays for.', fix: 'Keep the hint in lib/router.mjs.' });
  });

  suite('visual detection expert', 'idrCopies finds each way image-deep-research arrives and idrInstallPlan never installs', () => {
    const none = core.idrCopies(dir().deps);
    check('no copy anywhere gives an empty list', none.length === 0, { happened: JSON.stringify(none), why: 'Absent must be absent.', fix: 'idrCopies lists only what exists.' });
    const sk = dir({ 'proj/.claude/skills/image-deep-research/SKILL.md': SKILL, 'home/.agents/skills/image-deep-research/SKILL.md': PLAIN });
    const skCopies = core.idrCopies(sk.deps);
    const loadedSk = skCopies.find((c) => c.loaded), agentsSk = skCopies.find((c) => !c.loaded);
    check('a skills folder loads (project) or does not (~/.agents), with dir and compact read from SKILL.md', skCopies.length === 2 && loadedSk.kind === 'skills' && loadedSk.compact === true && loadedSk.dir === path.join(sk.deps.cwd, '.claude', 'skills', 'image-deep-research') && agentsSk.compact === false, { happened: JSON.stringify(skCopies), why: 'compact picks the hint text; loaded picks the plan.', fix: 'Mirror ufsCopies for skills folders.' });
    const pl = dir({ 'claude/settings.json': { enabledPlugins: { 'image-deep-research@ridelink0': true } }, 'claude/plugins/installed_plugins.json': { plugins: { 'image-deep-research@ridelink0': ['__x__'], 'image-deep-research@other': [{ installPath: '__y__' }] } } });
    const plCopies = core.idrCopies(pl.deps);
    check('a plugin key in enabledPlugins loads; one only in installed_plugins.json does not', plCopies.length === 2 && plCopies[0].kind === 'plugin' && plCopies[0].loaded === true && plCopies[1].loaded === false && plCopies[0].dir === null, { happened: JSON.stringify(plCopies), why: 'Enabled means loaded; installed and off means enable it.', fix: 'Read enabledPlugins and installed_plugins.json.' });
    const bc = withBundle(SKILL), bp = withBundle(PLAIN), bo = withBundle(null);
    const c1 = core.idrCopies(bc.deps), c2 = core.idrCopies(bp.deps), c3 = core.idrCopies(bo.deps);
    const dirOf = (f) => path.join(f.root, 'ufs', 'skills', 'image-deep-research');
    check('a bundled copy is found through the UFS installPath, with compact read', c1.length === 1 && c1[0].kind === 'bundled' && c1[0].loaded && c1[0].dir === dirOf(bc) && c1[0].compact === true && c2[0].compact === false, { happened: JSON.stringify([c1, c2]), why: 'UFS 6.5.0+ bundles IDR; that is the copy to point at.', fix: 'Resolve installPath (string, or the first array element) and check skills/image-deep-research/SKILL.md.' });
    check('an old UFS gives a bundled entry with dir null and compact null, not loaded', c3.length === 1 && c3[0].kind === 'bundled' && c3[0].dir === null && c3[0].compact === null && c3[0].loaded === false && c3[0].known === true, { happened: JSON.stringify(c3), why: 'A UFS without the skill is the "update it" case.', fix: 'dir and compact are null when SKILL.md is missing.' });
    const asString = dir({ 'claude/settings.json': { enabledPlugins: { [UFS]: true } } });
    fs.mkdirSync(path.join(asString.root, 'claude', 'plugins'), { recursive: true });
    fs.mkdirSync(path.join(asString.root, 'u2', 'skills', 'image-deep-research'), { recursive: true });
    fs.writeFileSync(path.join(asString.root, 'u2', 'skills', 'image-deep-research', 'SKILL.md'), SKILL);
    fs.writeFileSync(path.join(asString.root, 'claude', 'plugins', 'installed_plugins.json'), JSON.stringify({ plugins: { [UFS]: path.join(asString.root, 'u2') } }));
    check('an installPath given as a plain string is accepted', core.idrCopies(asString.deps).some((c) => c.kind === 'bundled' && c.loaded), { happened: JSON.stringify(core.idrCopies(asString.deps)), why: 'installed_plugins.json has shipped both shapes.', fix: 'Accept a string or an array whose first element has installPath.' });
    const off = { install: false }, on = { install: true };
    const plans = [
      core.idrInstallPlan([], on), core.idrInstallPlan([], off), core.idrInstallPlan(skCopies, off), core.idrInstallPlan(c1, off), core.idrInstallPlan(c3, off), core.idrInstallPlan(plCopies.slice(1), off), core.idrInstallPlan([...c1, ...skCopies.filter((c) => c.loaded)], on),
    ];
    check('idrInstallPlan never returns install: true', plans.every((p) => p.install === false && typeof p.say === 'string' && p.say.length > 0), { happened: JSON.stringify(plans), why: 'atlias never runs claude plugin install image-deep-research.', fix: 'Every branch returns { install: false, say }.' });
    check('the plan says: comes with UFS, present, update UFS, enable it, keep one', /comes with ultimate-frontend-skills/.test(plans[0].say) && /present \(/.test(plans[2].say) && /present \(/.test(plans[3].say) && /update ultimate-frontend-skills \(6\.5\.0\+ bundles it\)/.test(plans[4].say) && /enable it/.test(plans[5].say) && /loaded 2 times .*keep one; with ultimate-frontend-skills on, uninstall the standalone plugin/.test(plans[6].say), { happened: plans.map((p) => p.say).join(' || '), why: 'These are the texts the user reads from atlias install --companions.', fix: 'Use the wording in the spec.' });
    check('installCompanions never runs an image-deep-research install', !/plugin['", ]+install['", ]+image-deep-research/.test(fs.readFileSync(path.join(ROOT, 'lib', 'hosts.mjs'), 'utf8')) && /idrInstallPlan/.test(fs.readFileSync(path.join(ROOT, 'lib', 'hosts.mjs'), 'utf8')), { happened: 'hosts.mjs installs it, or does not call the plan', why: 'IDR arrives with UFS.', fix: 'installCompanions appends idrInstallPlan(...).say only.' });
  });

  suite('visual hint expert', 'a visual prompt gets one short pointer, once per session, chosen from what is installed', () => {
    const states = { compact: [{ loaded: true, compact: true, kind: 'skills' }], plain: [{ loaded: true, compact: false, kind: 'skills' }], mixed: [{ loaded: true, compact: true }, { loaded: true, compact: false }], old: [{ kind: 'bundled', loaded: false, known: true }], unknown: [{ kind: 'bundled', loaded: false, known: false }] };
    const st = (k, ufsLoaded) => router.visualState(states[k] || [], ufsLoaded ? [{ loaded: true }] : []);
    check('state selection: compact, plain (also when copies disagree), old UFS, absent, and unknown UFS says nothing', st('compact') === 'compact' && st('plain') === 'plain' && st('mixed') === 'plain' && st('old', true) === 'old' && st('none') === 'absent' && st('unknown', true) === null, { happened: ['compact', 'plain', 'mixed', 'old', 'none', 'unknown'].map((k) => `${k}=${st(k, k === 'old' || k === 'unknown')}`).join(' '), why: 'Never offer an install of what is already loaded, never call a UFS old that may bundle it.', fix: 'router.visualState.' });
    const texts = [];
    for (const v of ['compact', 'subagent']) for (const s of ['compact', 'plain', 'absent', 'old']) texts.push([v, s, router.visualHintText(v, s)]);
    check('every hint text is at most 200 characters after the [atlias] tag, and none is empty', texts.every(([, , t]) => t.startsWith('[atlias] Visual research') && t.length <= 200), { happened: texts.map(([v, s, t]) => `${v}/${s}=${t.length}`).join(' '), why: 'The hint is paid once per session and has to stay small.', fix: 'Shorten visualHintText.' });
    const t = (v, s) => router.visualHintText(v, s);
    check('the five texts say what the spec says', /--compact first \(one numbered sheet, at most 1,334 image tokens\)/.test(t('compact', 'compact')) && /image-deep-research --compact in a subagent/.test(t('subagent', 'compact')) && /image-deep-research in a subagent/.test(t('subagent', 'plain')) && !/--compact/.test(t('subagent', 'plain')) && /read its contact sheets before any single image/.test(t('compact', 'plain')) && /not installed.*atlias install --companions.*bundles it/.test(t('compact', 'absent')) && /predates its bundled image-deep-research \(6\.5\.0\+\)/.test(t('subagent', 'old')), { happened: texts.map(([, , x]) => x).join('\n'), why: 'The wording is the feature.', fix: 'Use the spec texts.' });
    const f = dir({ '.claude/skills/image-deep-research/SKILL.md': SKILL });
    const sid = 'vonce-1';
    const first = withEnv({ [FLAG]: 'compact' }, () => router.prompt({ session_id: sid, cwd: f.root, prompt: visual[0] }));
    const second = withEnv({ [FLAG]: 'compact' }, () => router.prompt({ session_id: sid, cwd: f.root, prompt: visual[1] }));
    const hints = core.events(sid).filter((e) => e.kind === 'hint' && e.hint === 'visual');
    const ctx = first && first.hookSpecificOutput && first.hookSpecificOutput.additionalContext;
    check('two visual prompts in one session: the first returns the hint, the second null, one hint:visual event', first && first.hookSpecificOutput.hookEventName === 'UserPromptSubmit' && /--compact first/.test(ctx) && second === null && hints.length === 1 && hints[0].variant === 'compact', { happened: JSON.stringify({ first, second, hints }), why: 'A pointer repeated every turn is a tax.', fix: 'meta.hintedVisual, recordEvent kind hint.' });
    const sub = withEnv({ [FLAG]: 'subagent' }, () => router.prompt({ session_id: 'vonce-2', cwd: f.root, prompt: visual[2] }));
    check('the subagent variant is chosen by the flag', sub && /in a subagent/.test(sub.hookSpecificOutput.additionalContext) && core.events('vonce-2').some((e) => e.hint === 'visual' && e.variant === 'subagent'), { happened: JSON.stringify(sub), why: 'The flag value is the arm.', fix: 'Pass cfg.flags.visualHint as the variant.' });
    const bare = dir();
    const absent = withEnv({ [FLAG]: 'compact' }, () => router.prompt({ session_id: 'vonce-3', cwd: bare.root, prompt: visual[3] }));
    const absentCtx = absent && absent.hookSpecificOutput.additionalContext;
    check('with nothing installed the hint offers atlias install --companions (when no UFS loads here)', core.ufsCopies({ cwd: bare.root }).some((c) => c.loaded) || (/not installed/.test(absentCtx) && /atlias install --companions/.test(absentCtx)), { happened: String(absentCtx), why: 'The absent state is the offer.', fix: 'visualState returns absent with no IDR and no UFS.' });
  });

  suite('visual doctor expert', 'atlias doctor checks image-deep-research, its Node and its browser', () => {
    const stub = (body) => { const d = dir({ 'idr/scripts/browser.mjs': body }); return path.join(d.root, 'idr'); };
    const good = stub("export function findBrowser() { return '/x/chrome'; }\n");
    const miss = stub('export async function findBrowser() { return null; }\n');
    const row = (checks, name) => checks.find((c) => c.name === name);
    const doc = (idr, extra = {}) => hosts.doctor(path.join(TMP, 'visual', 'doctor'), { idr, ...extra });
    const copy = (d, extra = {}) => ({ kind: 'skills', name: 'image-deep-research', where: d || '/none', loaded: true, dir: d, compact: true, ...extra });
    const a = doc([copy(good)], { uid: 1000 });
    check('a stub browser.mjs returning /x/chrome gives an ok browser row', row(a, 'browser for image-deep-research') && row(a, 'browser for image-deep-research').ok && /\/x\/chrome/.test(row(a, 'browser for image-deep-research').detail), { happened: JSON.stringify(row(a, 'browser for image-deep-research')), why: 'The check uses IDR\'s own lookup, so it agrees with the skill.', fix: 'hosts.idrBrowserRow imports dir/scripts/browser.mjs and calls findBrowser().' });
    const b = doc([copy(miss)], { uid: 1000, candidates: [] });
    const br = row(b, 'browser for image-deep-research');
    check('a stub returning null gives a failed row whose fix names IDR_BROWSER, and no root note for a normal user', br && !br.ok && /IDR_BROWSER/.test(br.fix) && !/no-sandbox/.test(br.fix), { happened: JSON.stringify(br), why: 'The fix must say what to set.', fix: 'Name IDR_BROWSER in the fix.' });
    const c = doc([copy(miss)], { uid: 0, candidates: ['/opt/pw-browsers/chromium-1/chrome-linux/chrome'] });
    const cr = row(c, 'browser for image-deep-research');
    check('uid 0 adds the --no-sandbox note, and a known chromium is named', /Chrome needs --no-sandbox as root \(IDR 1\.1\.0 adds it\)/.test(cr.fix) && /chromium-1/.test(cr.fix), { happened: cr.fix, why: 'Chrome refuses to start as root without it.', fix: 'Append the note when process.getuid() is 0.' });
    const none = doc([]);
    check('with no copy loaded there is one failing image-deep-research row and no node or browser row', row(none, 'image-deep-research') && !row(none, 'image-deep-research').ok && row(none, 'image-deep-research').fix === 'atlias install --companions' && !row(none, 'node 22+ for image-deep-research') && !row(none, 'browser for image-deep-research') && !row(none, 'one copy of image-deep-research'), { happened: JSON.stringify(none.filter((x) => /image/.test(x.name))), why: 'Rows appear only when they can be answered.', fix: 'Gate the rows on loaded copies and dir.' });
    const two = doc([copy(good), copy(null, { where: '/other' })], { uid: 1000 });
    check('two loaded copies add the failing one-copy row; a loaded copy adds the node row', row(two, 'one copy of image-deep-research') && !row(two, 'one copy of image-deep-research').ok && row(two, 'node 22+ for image-deep-research') && row(two, 'node 22+ for image-deep-research').ok === (parseInt(process.versions.node, 10) >= 22), { happened: JSON.stringify(two.filter((x) => /image/.test(x.name))), why: 'Two copies compete for every visual prompt; IDR needs Node 22.', fix: 'See hosts.doctor.' });
    const unknownDir = doc([copy(null)], { uid: 1000 });
    check('a loaded copy whose folder is unknown gets no browser row', !row(unknownDir, 'browser for image-deep-research') && row(unknownDir, 'image-deep-research').ok, { happened: JSON.stringify(unknownDir.filter((x) => /image/.test(x.name))), why: 'There is no browser.mjs to ask.', fix: 'Only run the lookup when dir is known.' });
  });

  suite('visual surface expert', 'no new skill, tool or hook surface', () => {
    const skills = fs.readdirSync(path.join(ROOT, 'skills')).filter((d) => fs.existsSync(path.join(ROOT, 'skills', d, 'SKILL.md'))).sort();
    const names = TOOLS.map((t) => t.name).join();
    check('the MCP tools/list names are the pre-change ten', names === 'harness_recall,harness_remember,harness_progress,harness_verify,harness_digest,graph_query,graph_affected,graph_explain,harness_bench,harness_status', { happened: names, why: 'Every tool schema is paid on every request.', fix: 'Add no tool for this.' });
    check('the skills/*/SKILL.md set is the pre-change one (double-check, harness)', skills.join() === 'double-check,harness', { happened: skills.join(), why: 'Claude Code lists every skill description on every request.', fix: 'Do not add a skill for this.' });
  });
}
