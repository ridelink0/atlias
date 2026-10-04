import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const [api, cases, out] = process.argv.slice(2);
if (!api || !cases || !out || fs.existsSync(out)) throw Error('usage: behavior-check.mjs <api> <protected-cases> <unused-result>');
const p = spawnSync(process.execPath, [fileURLToPath(new URL('./behavior-worker.mjs', import.meta.url)), api, cases, out], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
if (p.status !== 0 || !fs.existsSync(out)) { console.error('behavioral check incomplete'); process.exitCode = 1; }
else { const result = JSON.parse(fs.readFileSync(out)); console.log(`${result.passed}/${result.cases} independent behavioral cases passed`); if (result.passed !== result.cases || !result.cases) process.exitCode = 1; }
