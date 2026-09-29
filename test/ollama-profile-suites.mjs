// NEXTGEN-5 row 8: the Ollama prompt profile (item 6, flags.ollamaProfile) and
// the honest local default (item 8, code part). The fixed prompt is paid on every
// call, so the cut is counted in characters per call on the echo engine, which
// stands in for Ollama (both use the text-block protocol) and needs no model.
// With the flag off the requests are the ones test/golden.mjs pins byte for byte.
import * as loop from '../lib/loop.mjs';
import * as evals from '../lib/eval.mjs';
import * as settings from '../lib/settings.mjs';

export default async function ollamaProfileSuites({ asyncSuite, check, core, TMP, fs, path }) {
  const FLAG = 'ATLIAS_FLAG_OLLAMA_PROFILE';
  const SKILL = '---\nname: demo-skill\ndescription: a skill the workspace holds, listed in the full prompt\n---\nDo the demo.\n';
  const task = () => ({ id: 'ollama-profile', name: 'ollama-profile', rounds: 3, files: { 'main.py': 'x = 1\n', '.claude/skills/demo-skill/SKILL.md': SKILL }, prompt: 'Fix main.py.', check: ['python3', 'main.py'] });
  // One echo-engine run; returns each request's messages and its size in characters.
  const run = async (engine, flag) => {
    const before = process.env[FLAG];
    if (flag == null) delete process.env[FLAG]; else process.env[FLAG] = flag;
    try {
      const requests = [];
      const chat = async (messages, tools) => { requests.push({ messages: JSON.parse(JSON.stringify(messages)), tools }); return { content: 'echo: no work done' }; };
      await evals.runSuite([task()], { chat, state: { sid: `ollama-profile-${engine}-${flag}`, engine }, stamp: false });
      // The workspace path differs per run and is in the prompt; it is <WS> here.
      const ws = (requests[0].messages[0].content.match(/working in (\S+)\.\n/) || [])[1] || '';
      const norm = requests.map((r) => ({ ...r, messages: JSON.parse(JSON.stringify(r.messages).split(JSON.stringify(ws).slice(1, -1)).join('<WS>')) }));
      return { requests: norm, chars: norm.map((r) => JSON.stringify(r.messages).length), system: norm[0].messages[0].content };
    } finally { if (before == null) delete process.env[FLAG]; else process.env[FLAG] = before; }
  };

  await asyncSuite('ollama profile expert', 'the profile cuts the prompt paid on every call', async () => {
    const off = await run('echo', null);
    const zero = await run('echo', '0');
    const on = await run('echo', '1');
    const perCall = (r) => Math.round(r.chars.reduce((a, b) => a + b, 0) / r.chars.length);
    process.stdout.write(`    prompt characters per call on the echo engine: ${perCall(off)} off, ${perCall(on)} with flags.ollamaProfile (${perCall(off) - perCall(on)} fewer)\n`);
    check('off, an unset flag and a flag set to 0 send the same bytes, with apply_patch, memory tools and the skills index in the prompt', JSON.stringify(off.requests) === JSON.stringify(zero.requests) && /apply_patch/.test(off.system) && /remember\{/.test(off.system) && /demo-skill/.test(off.system), { happened: off.system.slice(0, 300), why: 'The control arm must be the prompt every earlier run saw; test/golden.mjs pins the same bytes.', fix: 'Nothing under flags.ollamaProfile runs while it is off.' });
    check('on, the prompt characters per call fall by at least 1000 and by a third', perCall(on) <= perCall(off) - 1000 && perCall(on) * 3 <= perCall(off) * 2, { happened: `${perCall(off)} characters per call off, ${perCall(on)} on`, why: 'NEXTGEN-5 row 8 aims at the fixed prompt a 7B pays on every call in a 16k window; a cut nobody counted is not a cut.', fix: 'smallPrompt in lib/loop.mjs.' });
    check('on, no apply_patch, no memory tools, no skills index, and exactly one worked edit example', !/apply_patch/.test(on.system) && !/recall\{|remember\{/.test(on.system) && !/demo-skill|Skills installed here/.test(on.system) && (on.system.match(/```atlias/g) || []).length === 1 && /"tool":"edit_file"[^\n]*\\n[^\n]*\\n/.test(on.system), { happened: on.system.slice(0, 900), why: 'NEXTGEN-4 item 6: a 7B cannot write udiff, and every tool and index it is shown is paid for on every call.', fix: 'smallPrompt lists TOOLS without apply_patch, recall and remember, and has no skills index.' });
    const ex = (on.system.match(/```atlias\n([^\n]*(?:\n(?!```)[^\n]*)*)\n```/) || [])[1];
    let parsed = null; try { parsed = JSON.parse(ex); } catch { /* reported below */ }
    check('the worked example is one valid tool call whose new_string spans lines', Boolean(parsed) && parsed.tool === 'edit_file' && /\n/.test(parsed.new_string) && /\n/.test(parsed.old_string), { happened: String(ex).slice(0, 300), why: 'A 7B copies the escaping it is shown; an example that does not parse teaches it to send calls the loop rejects.', fix: 'The example in smallPrompt is JSON with \\n inside the strings.' });
    check('on, the tools it keeps are still listed and the prompt is the same on every build', /read_file\{/.test(on.system) && /edit_file\{/.test(on.system) && /shell\{/.test(on.system) && on.system === (await run('echo', '1')).system, { happened: on.system.slice(-700), why: 'The profile removes advertised tools, not the ones a model needs to finish a task.', fix: 'Only apply_patch, recall and remember are left out.' });
    const claude = await run('openai', '1'); // another engine, the flag on
    check('on, only the ollama engine (and echo, its stand-in) gets the profile', JSON.stringify(claude.requests[0].messages[0]) === JSON.stringify(off.requests[0].messages[0]), { happened: claude.system.slice(0, 200), why: 'The flag is scoped to the local engine; another engine on the same flag gets the full prompt.', fix: 'profileFor(state) checks state.engine.' });
    check('the tools still run when a model calls one the profile does not list', typeof loop.runTool === 'function' && loop.profileFor({ engine: 'echo' }) === false && loop.smallPrompt('/w', { hasGraph: false, instructions: '' }).includes('edit_file') && loop.TOOLS.some((t) => t.name === 'apply_patch') && loop.TOOLS.some((t) => t.name === 'recall'), { happened: loop.TOOL_NAMES.join(','), why: 'The profile changes the prompt, not the tool table.', fix: 'Leave TOOLS whole.' });
  });

  await asyncSuite('ollama profile expert', 'the flag is registered like the others, and the default model can call tools', async () => {
    const before = process.env[FLAG];
    process.env[FLAG] = '1';
    let on; try { on = core.config().flags.ollamaProfile; } finally { if (before == null) delete process.env[FLAG]; else process.env[FLAG] = before; }
    check('flags.ollamaProfile is off by default, reads ATLIAS_FLAG_OLLAMA_PROFILE, and is described', core.DEFAULTS.flags.ollamaProfile === false && core.flagEnvName('ollamaProfile') === FLAG && on === true && Boolean(settings.DESCRIPTIONS['flags.ollamaProfile']), { happened: JSON.stringify([core.DEFAULTS.flags.ollamaProfile, core.flagEnvName('ollamaProfile'), on]), why: 'A study switches a flag for one run through its environment name.', fix: 'DEFAULTS.flags in lib/core.mjs and DESCRIPTIONS in lib/settings.mjs.' });
    check('the default ollamaModel is qwen2.5-coder:7b, the model the published runs used', core.DEFAULTS.agent.ollamaModel === 'qwen2.5-coder:7b', { happened: core.DEFAULTS.agent.ollamaModel, why: 'gemma3:4b was the machine default that a run silently took for the 7B (NEXTGEN-4 correction), and /api/show does not list tools for it.', fix: 'DEFAULTS.agent.ollamaModel in lib/core.mjs.' });
  });
}
