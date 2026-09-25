#!/usr/bin/env node
// atlias command line.
//   atlias install [--all|--codex|--antigravity|--gemini [--gemini-hooks]|--claude|--companions]
//   atlias uninstall [--all|--codex|--antigravity|--gemini]
//   atlias doctor | status | brief [--host codex] | test | version
//   atlias shortcut [install|uninstall|status]   the atlias command in any terminal
//   atlias mode [both|sub|standalone] | settings [list]
//   atlias skills [name]   the skills installed here, or one of them in full
//   atlias recall <query> | remember <name> <type> <description> -- <body>
//   atlias progress [set <text>] | dream [show|ack|distil <session-id> [transcript]]
//   atlias graph query|affected|explain|update <arg> | config [set <section.key> <value>]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { VERSION, STATE_DIR, ROOT, readJson, writeJson, DEFAULTS, config, parseSetting, writeLauncher } from '../lib/core.mjs';
import * as hosts from '../lib/hosts.mjs';
import * as brief from '../lib/brief.mjs';
import * as progress from '../lib/progress.mjs';
import * as dream from '../lib/dream.mjs';
import * as graph from '../lib/graph.mjs';
import * as agent from '../lib/agent.mjs';
import * as extra from '../lib/hosts-extra.mjs';
import { logo } from '../lib/logo.mjs';
import * as bench from '../lib/bench.mjs';
import * as shortcut from '../lib/shortcut.mjs';
import * as settings from '../lib/settings.mjs';
import * as skills from '../lib/skills.mjs';
import { recall, remember } from '../mcp/tools.mjs';

const argv = process.argv.slice(2);
// --version and --help are what people type; treat them as the commands.
const FLAG_COMMANDS = { '--version': 'version', '-v': 'version', '--help': 'help', '-h': 'help' };
const cmd = FLAG_COMMANDS[argv[0]] || argv[0] || settings.bareCommand();
const extraIds = () => (argv.includes('--extras') ? argv.slice(argv.indexOf('--extras') + 1).filter((a) => !a.startsWith('--')) : []);
const flag = (f) => argv.includes(f);
// The value after a flag: --engine ollama, --only fix-a-bug.
const optVal = (f) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null; };
const after = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
// --sandbox and --no-sandbox both mean something, so undefined has to stay
// distinguishable from false or the flag could not turn the setting off.
const sandboxFlag = () => (flag('--sandbox') ? true : flag('--no-sandbox') ? false : undefined);
const cwd = process.cwd();
const say = (x) => process.stdout.write((Array.isArray(x) ? x.join('\n') : String(x)) + '\n');
const readOr = (p, fallback) => { try { return fs.readFileSync(p, 'utf8'); } catch { return fallback; } };
// The terminal command. Records this copy first, so a checkout or an npm
// install that is not in the plugin cache can still be found by the launcher.
const shortcutInstall = () => { writeLauncher(ROOT); return shortcut.installShortcut().lines; };
const shortcutUninstall = () => { const r = shortcut.uninstallShortcut(); return r.length ? r.map((f) => `removed ${f}`) : ['terminal command: nothing of ours to remove']; };

switch (cmd) {
  case 'logo': say(logo()); break;
  // Task evaluation: the model works in a scratch copy and a command decides.
  case 'eval': {
    const evals = await import('../lib/eval.mjs');
    const loopMod = await import('../lib/loop.mjs');
    const cfg = config().agent;
    // Positional task ids only: the value after --engine or --only belongs to
    // that flag, not to the task list.
    const taken = new Set();
    for (const f of ['--engine', '--only', '--repeat', '--model']) { const i = argv.indexOf(f); if (i >= 0) taken.add(i + 1); }
    const want = argv.slice(1).filter((a, i) => !a.startsWith('--') && !taken.has(i + 1));
    const only = optVal('--only');
    let tasks = evals.loadTasks();
    if (only) tasks = tasks.filter((t) => t.id === only);
    if (want.length) tasks = tasks.filter((t) => want.includes(t.id));
    if (!tasks.length) { say('no tasks; the corpus is in evals/*.json'); break; }
    const engine = optVal('--engine') || (cfg.openaiModel ? 'openai' : 'ollama');
    // echo is the dry run: it exercises the harness without a model, so a
    // broken corpus or checker shows up before any tokens are spent.
    // --model scores a named model without editing the machine's settings, so
    // two baselines can be taken in a row and the report names which was which.
    const picked = optVal('--model');
    const cfgFor = picked ? { ...cfg, ollamaModel: picked, openaiModel: picked } : cfg;
    const chat = engine === 'echo' ? async () => ({ content: 'echo: no work done' })
      : engine === 'openai' ? loopMod.openaiChat(cfgFor) : loopMod.ollamaChat(cfgFor);
    // One run of a sampling process is not a result: --repeat 3 runs each task
    // three times and reports pass^3 beside pass@3.
    const repeat = Math.max(1, parseInt(optVal('--repeat') || '1', 10) || 1);
    const model = picked || (engine === 'openai' ? cfg.openaiModel : engine === 'ollama' ? cfg.ollamaModel : '');
    say(`${tasks.length} task(s) against ${engine}${repeat > 1 ? `, ${repeat} attempts each` : ''}. The check command decides, not the model.`);
    const report = await evals.runSuite(tasks, { chat, state: agent.newState(cwd, engine), repeat, engineName: engine, model });
    say(evals.format(report));
    process.exitCode = report.passed === report.total ? 0 : 1;
    break;
  }
  case 'bench': say(bench.report(cwd, argv.slice(1).filter((a) => !a.startsWith('--')))); break;
  case 'chooser': process.exitCode = await agent.chooser(); break;
  case 'agent': case 'run': case 'fly': {
    const r = after('--resume');
    process.exitCode = await agent.repl({ engine: after('--engine'), once: after('--once'), resume: flag('--resume') ? (r && !r.startsWith('--') ? r : 'last') : null, sandbox: sandboxFlag() });
    break;
  }
  case 'resume': process.exitCode = await agent.repl({ engine: after('--engine'), resume: argv[1] && !argv[1].startsWith('--') ? argv[1] : 'last', sandbox: sandboxFlag() }); break;
  case 'exec': {
    // The prompt is every word that is not a flag or a flag's value; - or a
    // pipe reads it from stdin, as codex exec does.
    const valued = new Set(['--engine', '--resume']);
    const words = [];
    for (let i = 1; i < argv.length; i++) { if (valued.has(argv[i])) { i++; continue; } if (!argv[i].startsWith('--')) words.push(argv[i]); }
    let prompt = words.join(' ').trim();
    if (prompt === '-' || (!prompt && !process.stdin.isTTY)) { prompt = ''; for await (const chunk of process.stdin) prompt += chunk; prompt = prompt.trim(); }
    if (!prompt) { say('usage: atlias exec "<prompt>" [--engine claude|codex|openai|ollama|echo] [--resume [id]] [--sandbox] [--json]   (or pipe the prompt in)'); process.exitCode = 2; break; }
    const rs = after('--resume');
    const res = await agent.runOnce({ engine: after('--engine'), prompt, resume: flag('--resume') ? (rs && !rs.startsWith('--') ? rs : 'last') : null, sandbox: sandboxFlag() });
    say(flag('--json') ? JSON.stringify(res.json) : res.text);
    process.exitCode = res.code;
    break;
  }
  case 'version': say(`atlias ${VERSION}`); break;
  case 'install': {
    const all = flag('--all') || !argv.slice(1).some((a) => a.startsWith('--'));
    const out = [];
    if (all || flag('--claude')) out.push(...hosts.installClaude(after('--source')));
    if (all || flag('--codex')) out.push(...hosts.installCodex());
    if (all || flag('--antigravity')) out.push(...hosts.installAntigravity());
    if (all || flag('--gemini')) out.push(...hosts.installGemini(flag('--gemini-hooks')));
    if (all || flag('--extras')) out.push(...extra.installAll(extraIds()));
    if (all || flag('--companions')) out.push(...hosts.installCompanions());
    if (all || flag('--shortcut')) out.push(...shortcutInstall());
    say(out); break;
  }
  case 'uninstall': {
    const all = flag('--all') || !argv.slice(1).some((a) => a.startsWith('--'));
    const out = [];
    if (all || flag('--codex')) out.push(...hosts.uninstallCodex());
    if (all || flag('--antigravity')) out.push(...hosts.uninstallAntigravity());
    if (all || flag('--gemini')) out.push(...hosts.uninstallGemini());
    if (all || flag('--extras')) out.push(...extra.uninstallAll(extraIds()));
    if (all || flag('--shortcut')) out.push(...shortcutUninstall());
    out.push('claude code: /plugin uninstall atlias@atlias inside Claude Code');
    say(out); break;
  }
  case 'mode': {
    if (!argv[1]) { say(settings.describeMode()); break; }
    const r = settings.setMode(argv[1]);
    say(r.text);
    process.exitCode = r.ok ? 0 : 2;
    break;
  }
  case 'settings': {
    if (!process.stdin.isTTY || argv[1] === 'list') { say(settings.format()); break; }
    const rl = (await import('node:readline/promises')).createInterface({ input: process.stdin, output: process.stdout });
    process.exitCode = await settings.menu((q) => rl.question(q), say);
    rl.close();
    break;
  }
  case 'shortcut': {
    const sub = argv[1] || 'status';
    if (sub === 'install') say(shortcutInstall());
    else if (sub === 'uninstall' || sub === 'remove') say(shortcutUninstall());
    else if (sub === 'status') {
      const s = shortcut.shortcutStatus();
      const hit = shortcut.whichAtlias();
      say([`launcher: ${s.launcher || 'not written'}`, ...s.shims.map((x) => `command: ${x.file}${x.onPath ? '' : ' (folder not on PATH)'}`), `typing atlias runs: ${hit || 'nothing yet; run atlias shortcut install'}`]);
      process.exitCode = hit ? 0 : 1;
    } else { say('usage: atlias shortcut [install|uninstall|status]'); process.exitCode = 2; }
    break;
  }
  case 'doctor': { const c = hosts.doctor(cwd).concat(extra.doctorRows()); say(hosts.formatDoctor(c)); process.exitCode = c.every((x) => x.ok) ? 0 : 1; break; }
  case 'status': {
    const g = graph.status(cwd);
    const p = dream.pending(cwd);
    say([`atlias ${VERSION}`, `mode: ${settings.mode()} (atlias mode to change it)`, `state: ${STATE_DIR}`, `project: ${cwd}`, `graph: ${g.exists ? `present, updated ${g.age}` : 'none'}`, `dream pending: ${p.count}`, `handoff note: ${progress.read(cwd) ? progress.notePath(cwd) : 'none yet'}`]);
    break;
  }
  case 'brief': say(brief.build({ cwd, session_id: 'cli', source: 'startup' }, after('--host') || 'claude')); break;
  case 'test': { const r = spawnSync(process.execPath, [path.join(ROOT, 'test', 'run.mjs'), ...argv.slice(1)], { stdio: 'inherit' }); process.exitCode = r.status || 0; break; }
  case 'skills': {
    const which = argv.slice(1).filter((a) => !a.startsWith('--')).join(' ').trim();
    if (!which) { say(skills.format(skills.discover(cwd))); break; }
    const one = skills.body(cwd, which);
    if (!one) { say(`no skill matches ${which}; atlias skills lists them`); process.exitCode = 1; break; }
    say(`${one.path}\n\n${one.text}`);
    break;
  }
  case 'recall': say(recall(cwd, argv.slice(1).join(' '))); break;
  case 'remember': {
    const sep = argv.indexOf('--');
    const [name, type, ...desc] = argv.slice(1, sep === -1 ? undefined : sep);
    if (!name || !type) { say('usage: atlias remember <name> <user|feedback|project|reference> <description> -- <body>'); process.exitCode = 2; break; }
    say(remember(cwd, { name, type, description: desc.join(' '), body: sep === -1 ? '' : argv.slice(sep + 1).join(' ') }));
    break;
  }
  case 'progress': {
    if (argv[1] === 'set') { const m = progress.applyNext(cwd, argv.slice(2).join(' ')); say(m || 'next step recorded; no handoff note yet.'); }
    else say(progress.read(cwd) || 'no handoff note yet');
    break;
  }
  case 'dream': {
    if (argv[1] === 'ack') say(`dream: consolidated through cursor ${dream.ack(cwd)}`);
    else if (argv[1] === 'distil') { const row = dream.distil(argv[2] || 'cli', argv[3] || '', cwd); say(row ? `dream: wrote cursor ${row.cursor}` : 'dream: nothing to distil for that session'); }
    else { dream.digest(cwd); say(readOr(dream.digestPath(cwd), 'no digest yet')); }
    break;
  }
  case 'graph': {
    const sub = argv[1]; const arg = argv.slice(2).join(' ');
    if (sub === 'query') say(graph.query(cwd, arg, config().graph.queryBudget) || 'no graph, or no answer');
    else if (sub === 'affected' || sub === 'explain') say(graph.sub(cwd, sub, arg) || 'no graph, or no answer');
    else if (sub === 'update') say(graph.updateNow(cwd) ? 'graph updated' : 'graph update failed (see ~/.atlias/log.txt)');
    else say('usage: atlias graph query|affected|explain|update <arg>');
    break;
  }
  case 'config': {
    const p = path.join(STATE_DIR, 'config.json');
    const user = readJson(p, {}) || {};
    if (argv[1] === 'set' && argv[2]) {
      const [section, key] = argv[2].split('.');
      const parsed = parseSetting(section, key, argv.slice(3).join(' '));
      if (parsed.error) { say(parsed.error); process.exitCode = 2; break; }
      user[section] = { ...(user[section] || {}), [key]: parsed.value };
      writeJson(p, user);
      // Read it back through config() so what is printed is what took effect.
      say(`${argv[2]} = ${JSON.stringify(config()[section][key])}`);
    } else say(JSON.stringify(config(), null, 2));
    break;
  }
  default:
    say([logo(), '', 'atlias                             by mode: ask (both), status (sub), the agent (standalone)', 'agent [--engine claude|codex|openai|ollama|echo] [--once "<prompt>"] [--resume [id]] [--sandbox]', 'exec "<prompt>" [--engine e] [--resume [id]] [--sandbox] [--json]   one prompt, no questions; - or a pipe reads stdin', '  --sandbox                        work in a throwaway git worktree, show the diff at the end, and change the project only if you take it', 'resume [id]                        carry on the last agent session in this folder', 'mode [both|sub|standalone]         what atlias is on this machine', 'settings [list]                    every option, with what it does', 'install [--all|--codex|--antigravity|--gemini [--gemini-hooks]|--claude|--extras [ids]|--companions|--shortcut]', 'uninstall [--all|--codex|--antigravity|--gemini|--extras|--shortcut]', 'shortcut [install|uninstall|status]  the atlias command in any terminal', 'doctor | status | brief [--host codex] | test | bench [question...] | version | logo', 'skills [name]                      the skills installed here, or one of them in full', 'recall <query> | remember <name> <type> <description> -- <body>', 'progress [set <next step>] | dream [ack|distil <session>] | graph query|affected|explain|update <arg>', 'config [set <section.key> <value>]']);
}