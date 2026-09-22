#!/usr/bin/env node
// atlias command line.
//   atlias install [--all|--codex|--antigravity|--gemini [--gemini-hooks]|--claude|--companions]
//   atlias uninstall [--all|--codex|--antigravity|--gemini]
//   atlias doctor | status | brief [--host codex] | test | version
//   atlias recall <query> | remember <name> <type> <description> -- <body>
//   atlias progress [set <text>] | dream [show|ack|distil <session-id> [transcript]]
//   atlias graph query|affected|explain|update <arg> | config [set <section.key> <value>]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { VERSION, STATE_DIR, ROOT, readJson, writeJson, DEFAULTS, config } from '../lib/core.mjs';
import * as hosts from '../lib/hosts.mjs';
import * as brief from '../lib/brief.mjs';
import * as progress from '../lib/progress.mjs';
import * as dream from '../lib/dream.mjs';
import * as graph from '../lib/graph.mjs';
import * as agent from '../lib/agent.mjs';
import * as extra from '../lib/hosts-extra.mjs';
import { logo } from '../lib/logo.mjs';
import { recall, remember } from '../mcp/tools.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0] || (process.stdin.isTTY ? 'chooser' : 'help');
const extraIds = () => (argv.includes('--extras') ? argv.slice(argv.indexOf('--extras') + 1).filter((a) => !a.startsWith('--')) : []);
const flag = (f) => argv.includes(f);
const after = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
const cwd = process.cwd();
const say = (x) => process.stdout.write((Array.isArray(x) ? x.join('\n') : String(x)) + '\n');
const readOr = (p, fallback) => { try { return fs.readFileSync(p, 'utf8'); } catch { return fallback; } };

switch (cmd) {
  case 'logo': say(logo()); break;
  case 'chooser': process.exitCode = await agent.chooser(); break;
  case 'agent': case 'run': case 'fly': process.exitCode = await agent.repl({ engine: after('--engine'), once: after('--once') }); break;
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
    say(out); break;
  }
  case 'uninstall': {
    const all = flag('--all') || !argv.slice(1).some((a) => a.startsWith('--'));
    const out = [];
    if (all || flag('--codex')) out.push(...hosts.uninstallCodex());
    if (all || flag('--antigravity')) out.push(...hosts.uninstallAntigravity());
    if (all || flag('--gemini')) out.push(...hosts.uninstallGemini());
    if (all || flag('--extras')) out.push(...extra.uninstallAll(extraIds()));
    out.push('claude code: /plugin uninstall atlias@atlias inside Claude Code');
    say(out); break;
  }
  case 'doctor': { const c = hosts.doctor(cwd).concat(extra.doctorRows()); say(hosts.formatDoctor(c)); process.exitCode = c.every((x) => x.ok) ? 0 : 1; break; }
  case 'status': {
    const g = graph.status(cwd);
    const p = dream.pending(cwd);
    say([`atlias ${VERSION}`, `state: ${STATE_DIR}`, `project: ${cwd}`, `graph: ${g.exists ? `present, updated ${g.age}` : 'none'}`, `dream pending: ${p.count}`, `handoff note: ${progress.read(cwd) ? progress.notePath(cwd) : 'none yet'}`]);
    break;
  }
  case 'brief': say(brief.build({ cwd, session_id: 'cli', source: 'startup' }, after('--host') || 'claude')); break;
  case 'test': { const r = spawnSync(process.execPath, [path.join(ROOT, 'test', 'run.mjs'), ...argv.slice(1)], { stdio: 'inherit' }); process.exitCode = r.status || 0; break; }
  case 'recall': say(recall(cwd, argv.slice(1).join(' '))); break;
  case 'remember': {
    const sep = argv.indexOf('--');
    const [name, type, ...desc] = argv.slice(1, sep === -1 ? undefined : sep);
    if (!name || !type) { say('usage: atlias remember <name> <user|feedback|project|reference> <description> -- <body>'); process.exitCode = 2; break; }
    say(remember(cwd, { name, type, description: desc.join(' '), body: sep === -1 ? '' : argv.slice(sep + 1).join(' ') }));
    break;
  }
  case 'progress': {
    if (argv[1] === 'set') { progress.setNext(cwd, argv.slice(2).join(' ')); say(progress.update(cwd, 'cli', null)); }
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
      if (!DEFAULTS[section] || !(key in DEFAULTS[section])) { say(`unknown key ${argv[2]}; sections: ${Object.keys(DEFAULTS).join(', ')}`); process.exitCode = 2; break; }
      const raw = argv.slice(3).join(' ');
      let val; try { val = JSON.parse(raw); } catch { val = raw; }
      user[section] = { ...(user[section] || {}), [key]: val };
      writeJson(p, user); say(`${argv[2]} = ${JSON.stringify(val)}`);
    } else say(JSON.stringify(config(), null, 2));
    break;
  }
  default:
    say([logo(), '', 'atlias                             choose: sub-harness or regular agent', 'agent [--engine claude|codex|ollama|echo] [--once "<prompt>"]', 'install [--all|--codex|--antigravity|--gemini [--gemini-hooks]|--claude|--extras [ids]|--companions]', 'uninstall [--all|--codex|--antigravity|--gemini]', 'doctor | status | brief [--host codex] | test | version | logo', 'recall <query> | remember <name> <type> <description> -- <body>', 'progress [set <next step>] | dream [ack|distil <session>] | graph query|affected|explain|update <arg>', 'config [set <section.key> <value>]']);
}