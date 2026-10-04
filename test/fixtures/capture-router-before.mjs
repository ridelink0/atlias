// Captured once from the code BEFORE the visual hint existed, so the suite can
// show that nothing a non-visual prompt sees has changed:
//   git archive <commit before the change> | tar -x -C <dir>
//   node <dir>/test/fixtures/capture-router-before.mjs <dir> > test/fixtures/router-before.json
// For every corpus prompt: classify(p) and what router.prompt() returns with
// the flag unset, in a fresh state directory and an empty project.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
const corpus = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'visual-prompts.json'), 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'router-before-'));
process.env.ATLIAS_HOME = path.join(tmp, 'state');
process.env.CLAUDE_CONFIG_DIR = path.join(tmp, 'claude');
process.env.ATLIAS_NO_DETACH = '1';
for (const k of Object.keys(process.env)) if (k.startsWith('ATLIAS_FLAG_')) delete process.env[k];
fs.mkdirSync(process.env.CLAUDE_CONFIG_DIR, { recursive: true });
const project = path.join(tmp, 'project');
fs.mkdirSync(project, { recursive: true });
const router = await import(pathToFileURL(path.join(root, 'lib', 'router.mjs')).href);
const all = [...Object.values(corpus.visual).flat(), ...Object.values(corpus.nonVisual).flat()];
const out = {};
let n = 0;
for (const p of all) {
  out[p] = { classify: router.classify(p), prompt: router.prompt({ session_id: `before-${++n}`, cwd: project, prompt: p }) };
}
process.stdout.write(JSON.stringify(out, null, 1) + '\n');
fs.rmSync(tmp, { recursive: true, force: true });
