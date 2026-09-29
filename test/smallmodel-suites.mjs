// Round six, NEXTGEN-5 row 8: the small-model prompt profile (NEXTGEN-4 item 6,
// flags.smallProfile), model-card sampling (item 8, flags.modelSampling) and
// window-sized tool results (item 8, flags.ctxBudget), each off by default and
// acting only on the Ollama engine; plus the honest default model. Every flag
// case checks the same call with the flag off, which must be the code as it
// was. Loaded by test/run.mjs.
import * as loop from '../lib/loop.mjs';
import * as settings from '../lib/settings.mjs';

export default async function smallModelSuites({ asyncSuite, suite, check, core, agentMod, TMP, fs, path }) {
  const withEnv = async (vars, fn) => {
    const before = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
    for (const [k, v] of Object.entries(vars)) { if (v == null) delete process.env[k]; else process.env[k] = v; }
    try { return await fn(); } finally { for (const [k, v] of Object.entries(before)) { if (v == null) delete process.env[k]; else process.env[k] = v; } }
  };

  suite('small model', 'the three flags are registered like every round-five flag, and the default model can call tools', () => {
    const ids = { smallProfile: 'ATLIAS_FLAG_SMALL_PROFILE', modelSampling: 'ATLIAS_FLAG_MODEL_SAMPLING', ctxBudget: 'ATLIAS_FLAG_CTX_BUDGET' };
    const rows = Object.keys(ids).map((k) => settings.rows().find((r) => r.id === `flags.${k}`));
    check('each flag is off by default, described, and switched from the environment', Object.keys(ids).every((k, i) => core.DEFAULTS.flags[k] === false && rows[i] && rows[i].env === ids[k] && /Ollama/.test(rows[i].about)),
      { happened: JSON.stringify(rows), why: 'NEXTGEN-5\'s merge rule: every behaviour change lands off, behind a key the study scripts can set per arm.', fix: 'DEFAULTS.flags in lib/core.mjs and DESCRIPTIONS in lib/settings.mjs.' });
    check('the default Ollama model is qwen2.5-coder:7b, not gemma3:4b', core.DEFAULTS.agent.ollamaModel === 'qwen2.5-coder:7b',
      { happened: core.DEFAULTS.agent.ollamaModel, why: 'NEXTGEN-4 item 8 and NEXTGEN-5 row 3: gemma3:4b does not list tools in /api/show, and every published atlias number is qwen2.5-coder:7b.', fix: 'DEFAULTS.agent.ollamaModel in lib/core.mjs.' });
  });

  suite('small model', 'the small profile prompt', () => {
    const d = path.join(TMP, 'smallmodel', 'prompt');
    fs.mkdirSync(d, { recursive: true });
    const full = loop.systemPrompt(d, { native: false, hasGraph: false, instructions: '' });
    const small = loop.systemPrompt(d, { native: false, hasGraph: false, instructions: '', small: true });
    const toolLine = (p) => p.split('\n').find((l) => l.startsWith('Tools: ')) || '';
    check('the small prompt names no apply_patch, no recall and no remember; the full one still does', !/apply_patch/.test(small) && !/\brecall\{/.test(toolLine(small)) && !/\bremember\{/.test(toolLine(small)) && /apply_patch/.test(full) && /\brecall\{/.test(toolLine(full)) && /\bremember\{/.test(toolLine(full)),
      { happened: toolLine(small).slice(0, 400), why: 'A 7B cannot write a unified diff (Diff-XYZ, 0.03 exact match) and small models do better with fewer tools.', fix: 'SMALL_PROFILE_DROPS in systemPrompt.' });
    const examples = (small.match(/"tool":"edit_file"/g) || []).length;
    let parsed = null;
    try { parsed = JSON.parse(loop.SMALL_EDIT_EXAMPLE); } catch { /* checked below */ }
    check('the small prompt holds exactly one edit example, parseable, with a multi-line new_string, and no read_file example', examples === 1 && small.includes(loop.SMALL_EDIT_EXAMPLE) && parsed && parsed.tool === 'edit_file' && parsed.new_string.split('\n').length > 1 && !/"tool":"read_file"/.test(small) && /"tool":"read_file"/.test(full),
      { happened: `examples ${examples}; ${loop.SMALL_EDIT_EXAMPLE}`, why: 'Item 6: one compact worked edit_file example in the escaping the parser expects.', fix: 'SMALL_EDIT_EXAMPLE in systemPrompt.' });
    check('the small prompt is shorter than the full one', small.length < full.length,
      { happened: `${small.length} vs ${full.length}`, why: 'The profile exists to cut fixed prompt bulk on a small window.', fix: 'systemPrompt small branch.' });
  });

  await asyncSuite('small model', 'the small profile acts only on an Ollama chat with the flag on, and its example is read as an edit', async () => {
    const d = path.join(TMP, 'smallmodel', 'loop');
    fs.mkdirSync(d, { recursive: true });
    const once = async (flag, tagged) => withEnv({ ATLIAS_FLAG_SMALL_PROFILE: flag }, async () => {
      const chat = async () => ({ content: 'Nothing to do here.', calls: [] });
      if (tagged) chat.engine = 'ollama';
      const st = agentMod.newState(d, 'ollama');
      await loop.runLoop(st, 'say hello', { chat, say: () => {}, ask: async () => true, limits: { maxToolRounds: 2 } });
      return String(st.messages[0].content);
    });
    const onOllama = await once('1', true);
    const onOther = await once('1', false);
    const offOllama = await once('0', true);
    const unset = await once(null, true);
    check('flag on + Ollama chat: small prompt; flag on + another engine, flag off, or unset: the full prompt', !/apply_patch/.test(onOllama) && /apply_patch/.test(onOther) && /apply_patch/.test(offOllama) && offOllama === unset,
      { happened: [onOllama, onOther, offOllama].map((p) => p.length).join(' / '), why: 'The golden flags-off fingerprint must stay byte-identical, and no other engine\'s requests may change.', fix: 'runLoop: small = chat.engine === \'ollama\' && flags.smallProfile.' });
    // The worked example, sent back verbatim as the model's reply, must land.
    const e = path.join(TMP, 'smallmodel', 'example');
    fs.mkdirSync(e, { recursive: true });
    fs.writeFileSync(path.join(e, 'calc.py'), 'def add(a, b):\n    return a - b\n');
    const replies = ['```atlias\n' + loop.SMALL_EDIT_EXAMPLE + '\n```', 'Done.', 'No check here.'];
    await withEnv({ ATLIAS_FLAG_SMALL_PROFILE: '1' }, async () => {
      const chat = async () => ({ content: replies.shift() || 'Done.', calls: [] });
      chat.engine = 'ollama';
      await loop.runLoop(agentMod.newState(e, 'ollama'), 'fix add', { chat, say: () => {}, ask: async () => true, limits: { maxToolRounds: 4 } });
    });
    const after = fs.readFileSync(path.join(e, 'calc.py'), 'utf8');
    check('the example, sent back as a reply, is parsed and applied as one edit_file call', /total = a \+ b/.test(after) && /return total/.test(after),
      { happened: after, why: 'An example the parser would refuse teaches the refusal.', fix: 'Spell SMALL_EDIT_EXAMPLE with JSON.stringify.' });
  });

  await asyncSuite('small model', 'model-card sampling reaches the Ollama request only with the flag on', async () => {
    check('samplingFor: qwen2.5-coder on = 0.7 / 0.8 / 20 / 1.1; off, or a model with no profile = temperature 0.2', JSON.stringify(loop.samplingFor('qwen2.5-coder:7b', true)) === JSON.stringify({ temperature: 0.7, top_p: 0.8, top_k: 20, repeat_penalty: 1.1 }) && JSON.stringify(loop.samplingFor('qwen2.5-coder:7b', false)) === JSON.stringify({ temperature: 0.2 }) && JSON.stringify(loop.samplingFor('gemma3:4b', true)) === JSON.stringify({ temperature: 0.2 }) && JSON.stringify(loop.samplingFor('qwen2.5-coder', true)).includes('top_k'),
      { happened: JSON.stringify(loop.samplingFor('qwen2.5-coder:7b', true)), why: 'qwen2.5-coder\'s generation_config.json names these; the model card warns against greedy-ish sampling.', fix: 'SAMPLING_PROFILES in lib/loop.mjs.' });
    const bodies = [];
    const post = async (url, body) => {
      if (/\/api\/show$/.test(url)) return { status: 200, json: { model_info: { 'qwen2.context_length': 32768 } } };
      bodies.push(body);
      return { status: 200, json: { message: { role: 'assistant', content: 'ok' }, prompt_eval_count: 10, eval_count: 2 } };
    };
    const cfg = { ...core.DEFAULTS.agent, ollamaModel: 'qwen2.5-coder:7b' };
    const on = loop.ollamaChat(cfg, { post, flags: { modelSampling: true } });
    const off = loop.ollamaChat(cfg, { post, flags: { modelSampling: false } });
    await on([{ role: 'user', content: 'hi' }]);
    await off([{ role: 'user', content: 'hi' }]);
    const [a, b] = bodies.map((x) => x.options);
    check('flag on sends top_p/top_k/repeat_penalty at 0.7; flag off sends exactly temperature 0.2 beside num_ctx and num_predict', a && a.temperature === 0.7 && a.top_k === 20 && a.top_p === 0.8 && a.repeat_penalty === 1.1 && b && JSON.stringify(Object.keys(b).sort()) === JSON.stringify(['num_ctx', 'num_predict', 'temperature']) && b.temperature === 0.2,
      { happened: JSON.stringify(bodies.map((x) => x.options)), why: 'The flag-off request must be the request every baseline run sent.', fix: 'ollamaChat options: { ...sampling, num_ctx, num_predict }.' });
    check('the chat ollamaChat returns says it is Ollama\'s', on.engine === 'ollama' && off.engine === 'ollama',
      { happened: String(on.engine), why: 'runLoop reads chat.engine to keep the small-model flags off every other engine.', fix: 'chatFn.engine = \'ollama\' in ollamaChat.' });
  });

  suite('small model', 'window-sized tool results', () => {
    const base = { ...core.DEFAULTS.agent };
    const at = (ctx, predict = 2048, outputBudget = 10000) => loop.ctxOutputBudget({ ...base, ollamaNumCtx: ctx, ollamaNumPredict: predict, outputBudget });
    check('the 16384/2048 default keeps the 10000 budget; 4096 gets 1536; a window smaller than the reply gets the 500 floor', at(16384) === 10000 && at(4096) === 1536 && at(1024) === 500 && at(65536, 2048, 20000) === 20000,
      { happened: [at(16384), at(4096), at(1024), at(65536, 2048, 20000)].join(', '), why: 'Item 8: one read_file (3x the base) must not fill a small window, and the default must not change.', fix: 'ctxOutputBudget in lib/loop.mjs.' });
  });
}
