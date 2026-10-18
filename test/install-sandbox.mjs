import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'atlias-install-'));
const home = path.join(sandbox, 'home');
const codex = path.join(home, '.codex');
fs.mkdirSync(codex, { recursive: true });
const hooksPath = path.join(codex, 'hooks.json');
const configPath = path.join(codex, 'config.toml');
const unrelated = { hooks: { UserPromptSubmit: [{ matcher: '*', hooks: [{ type: 'command', command: 'keep-this' }] }] } };
fs.writeFileSync(hooksPath, JSON.stringify(unrelated, null, 2) + '\n');
fs.writeFileSync(configPath, '[model]\nmodel = "keep-this"\n');
const env = {
  ...process.env,
  HOME: home,
  USERPROFILE: home,
  CODEX_HOME: codex,
  CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
  ATLIAS_HOME: path.join(home, '.atlias'),
  XDG_CONFIG_HOME: path.join(home, '.config'),
  LOCALAPPDATA: path.join(home, 'AppData', 'Local'),
};
const cli = (...args) => spawnSync(process.execPath, [path.join(root, 'bin', 'atlias.mjs'), ...args], { env, encoding: 'utf8', timeout: 30000 });

try {
  const first = cli('install', '--codex');
  assert.equal(first.status, 0, first.stderr);
  const firstHooks = fs.readFileSync(hooksPath, 'utf8');
  const firstConfig = fs.readFileSync(configPath, 'utf8');
  assert.match(firstHooks, /"command": "keep-this"/);
  assert.match(firstHooks, /atlias/);
  assert.match(firstConfig, /model = "keep-this"/);
  assert.match(firstConfig, /\[mcp_servers\.atlias\]/);

  const second = cli('install', '--codex');
  assert.equal(second.status, 0, second.stderr);
  assert.equal(fs.readFileSync(hooksPath, 'utf8'), firstHooks, 'installing twice is byte-stable');
  assert.equal(fs.readFileSync(configPath, 'utf8'), firstConfig, 'Codex config is not duplicated');

  const removed = cli('uninstall', '--codex');
  assert.equal(removed.status, 0, removed.stderr);
  assert.match(fs.readFileSync(hooksPath, 'utf8'), /"command": "keep-this"/);
  assert.doesNotMatch(fs.readFileSync(hooksPath, 'utf8'), /atlias/);
  assert.match(fs.readFileSync(configPath, 'utf8'), /model = "keep-this"/);
  assert.doesNotMatch(fs.readFileSync(configPath, 'utf8'), /mcp_servers\.atlias/);
  console.log('atlias install sandbox passed');
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true });
}
