#!/usr/bin/env node
import fs from 'node:fs';
import { VERSION } from '../lib/core.mjs';
import * as hosts from '../lib/hosts.mjs';
import * as extras from '../lib/hosts-extra.mjs';
import * as provider from '../lib/provider.mjs';
import * as subharness from '../lib/subharness.mjs';

const args = process.argv.slice(2);
const command = args[0] || 'help';
const say = (value) => process.stdout.write(String(value) + '\n');
const help = `atlias ${VERSION} — shared memory, graph, and verification inside your existing coding host.

Commands:
  atlias install [--claude|--codex|--antigravity|--gemini]
  atlias uninstall [--claude|--codex|--antigravity|--gemini]
  atlias sub --host claude|codex --profile provider.json [--log receipts.jsonl] [--executable cli] -- [native arguments]
  atlias provider check provider.json
  atlias provider usage receipts.jsonl
  atlias doctor
  atlias version`;

function selectedHosts(names) {
  const selected = names.filter((name) => args.includes(`--${name}`));
  const permitted = new Set([...names.map((name) => `--${name}`), ...(command === 'install' ? ['--gemini-hooks'] : [])]);
  const invalid = args.slice(1).filter((arg) => !permitted.has(arg));
  if (invalid.length) throw Error(`Unsupported host option: ${invalid[0]}.`);
  if (!selected.length) throw Error(`Choose a host: ${names.map((name) => `--${name}`).join(', ')}.`);
  if (args.includes('--gemini-hooks') && !selected.includes('gemini')) throw Error('--gemini-hooks requires --gemini.');
  return selected;
}

try {
  if (['help', '--help', '-h'].includes(command)) say(help);
  else if (command === 'version' || command === '--version' || command === '-v') say(`atlias ${VERSION}`);
  else if (command === 'install') {
    const out = [];
    for (const host of selectedHosts(['claude', 'codex', 'antigravity', 'gemini'])) {
      if (host === 'claude') out.push(...hosts.installClaude());
      if (host === 'codex') out.push(...hosts.installCodex());
      if (host === 'antigravity') out.push(...hosts.installAntigravity());
      if (host === 'gemini') out.push(...hosts.installGemini(args.includes('--gemini-hooks')));
    }
    say(out.join('\n'));
  } else if (command === 'uninstall') {
    const out = [];
    for (const host of selectedHosts(['claude', 'codex', 'antigravity', 'gemini'])) {
      if (host === 'claude') out.push('Claude Code plugin: use /plugin uninstall atlias@atlias inside Claude Code.');
      if (host === 'codex') out.push(...hosts.uninstallCodex());
      if (host === 'antigravity') out.push(...hosts.uninstallAntigravity());
      if (host === 'gemini') out.push(...hosts.uninstallGemini());
    }
    say(out.join('\n'));
  } else if (command === 'doctor') {
    say(hosts.formatDoctor(hosts.doctor().concat(extras.doctorRows())));
  } else if (command === 'provider') {
    if (args[1] === 'check' && args[2] && args.length === 3) {
      const profile = provider.load(args[2]);
      say(`Valid ${profile.protocol} profile for model ${profile.model}. Pricing ${profile.pricing ? 'configured' : 'unknown'}; no API call made.`);
    } else if (args[1] === 'usage' && args[2] && args.length === 3) {
      const rows = fs.readFileSync(args[2], 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
      say(JSON.stringify(provider.summarize(rows), null, 2));
    } else throw Error('Use provider check <file> or provider usage <file>.');
  } else if (command === 'sub') {
    const split = args.indexOf('--');
    const options = split < 0 ? args.slice(1) : args.slice(1, split);
    const allowed = new Set(['--host', '--profile', '--log', '--executable']);
    const opts = {};
    for (let i = 0; i < options.length; i += 2) {
      const key = options[i], value = options[i + 1];
      if (!allowed.has(key) || !value || value.startsWith('--') || key in opts) throw Error('Use sub --help for launcher options; native arguments go after --.');
      opts[key] = value;
    }
    if (!opts['--profile']) throw Error('--profile is required.');
    process.exitCode = await subharness.launch({
      host: opts['--host'], file: opts['--profile'], logFile: opts['--log'],
      executable: opts['--executable'], args: split < 0 ? [] : args.slice(split + 1),
    });
  } else throw Error(`Unknown command: ${command}. Run atlias --help.`);
} catch (error) {
  process.stderr.write(`atlias: ${error.message}\n`);
  process.exitCode = 2;
}
