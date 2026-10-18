import fs from 'node:fs';
import path from 'node:path';

// Resolve npm's Windows command shims without passing arguments through a shell.
export function resolveCommand(cmd, args, { platform = process.platform, env = process.env, read = (file) => fs.readFileSync(file, 'utf8') } = {}) {
  if (platform !== 'win32') return { file: cmd, args };
  for (const dir of String(env.PATH || env.Path || '').split(';').filter(Boolean)) {
    let text;
    try { text = read(path.win32.join(dir, cmd + '.cmd')); } catch { continue; }
    const match = /"%dp0%\\([^"]+)"\s+%\*/.exec(text);
    if (!match) continue;
    const target = path.win32.join(dir, match[1]);
    return /\.[cm]?js$/i.test(target) ? { file: process.execPath, args: [target, ...args] } : { file: target, args };
  }
  return { file: cmd, args };
}
