// Explicit, subscription-only experimental runner. Never automatically retry.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { prepareJob, JOB_INSTRUCTIONS, RESPONSE_SCHEMA, stageJob, assertJobUnchanged, digest } from '../../lib/native-job.mjs';
import { verifyStagedJob } from '../../lib/native-job-check.mjs';
import { childEnv, readJsonl } from '../ccstudy/lib.mjs';
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i < 0 ? '' : args[i + 1] || ''; };
const host = opt('--host'), input = opt('--job'), out = opt('--out'), native = opt('--native');
if (!['codex', 'claude'].includes(host) || !input || !out || !native) throw Error('usage: run.mjs --host codex|claude --job <explicit-job.json> --out <unused-directory> --native <executable> [--run]');
const spec = JSON.parse(fs.readFileSync(input)), job = prepareJob(spec);
if (!spec.model || typeof spec.model !== 'string' || !['low','medium','high','xhigh','max'].includes(spec.effort)) throw Error('pin model and effort explicitly');
const outputParent = fs.realpathSync(path.dirname(path.resolve(out))), outputPath = path.join(outputParent, path.basename(out)), outputRelative = path.relative(job.root, outputPath);
if (outputRelative === '' || (!outputRelative.startsWith('..' + path.sep) && outputRelative !== '..' && !path.isAbsolute(outputRelative))) throw Error('attempt output must be outside live workspace');
if (fs.existsSync(out)) throw Error('preserve previous attempt');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'packet.json'), job.serialized);
fs.writeFileSync(path.join(out, 'input-envelope.json'), job.input);
const plan = { host, model: spec.model, effort: spec.effort, packetSha256: job.packetSha256, instructionSha256: digest(JOB_INSTRUCTIONS), native, calls: 0, paidCredits: false, automaticRetries: false, profile: 'experimental-bounded-patch-v1', limitations: ['Reduced native capabilities, not general feature parity.', 'Claude subscription profile delivery remains unverified.', 'Native residual tools require transcript audit; no zero-tool guarantee.', 'Staging/check success does not apply edits to the live project.'] };
fs.writeFileSync(path.join(out, 'plan.json'), JSON.stringify(plan, null, 2));
if (!args.includes('--run')) { console.log(JSON.stringify({ status: 'prepared-unmeasured', modelCalls: 0, out })); process.exit(0); }
// Meter failure, absent windows or an exhausted window fails closed.
const meter = opt('--usage-cli');
if (!meter) throw Error('--run requires the prescribed --usage-cli');
const usageProcess = spawnSync(process.execPath, [meter, '--host', host, '--json'], { encoding: 'utf8', windowsHide: true, timeout: 45000, maxBuffer: 1024 * 1024 });
if (usageProcess.status !== 0) throw Error('fresh allowance unavailable; no native call');
const usage = JSON.parse(usageProcess.stdout), windows = usage.windows;
if (!Array.isArray(windows) || !windows.length || windows.some(w => !Number.isFinite(w.percentUsed) || w.percentUsed >= 90)) throw Error('insufficient fresh allowance; no native call');
const home = path.join(out, 'home'), ws = path.join(out, 'native-ws'); fs.mkdirSync(home); fs.mkdirSync(ws);
const env = childEnv(process.env, { home });
env.CODEX_HOME = path.join(home, '.codex'); env.CLAUDE_CONFIG_DIR = path.join(home, '.claude'); env.ATLIAS_HOME = path.join(home, '.atlias');
fs.mkdirSync(env.CODEX_HOME); fs.mkdirSync(env.CLAUDE_CONFIG_DIR);
const auth = opt('--subscription-auth');
if (!auth) throw Error('explicit subscription-auth required; no API keys');
const authData = JSON.parse(fs.readFileSync(auth));
let authCopy, argv;
const instructions = path.join(out, 'instructions.md'); fs.writeFileSync(instructions, JOB_INSTRUCTIONS);
const schema = path.join(out, 'response-schema.json'); fs.writeFileSync(schema, JSON.stringify(RESPONSE_SCHEMA));
if (host === 'codex') {
  if (authData.OPENAI_API_KEY || !authData.tokens?.access_token) throw Error('Codex subscription auth required; API-key billing refused');
  authCopy = path.join(env.CODEX_HOME, 'auth.json');
  const skills = [path.join(process.env.USERPROFILE || process.env.HOME, '.agents/skills'), path.join(process.env.USERPROFILE || process.env.HOME, '.codex/skills')].flatMap(p => fs.existsSync(p) ? fs.readdirSync(p).map(n => path.join(p, n, 'SKILL.md')).filter(f => fs.existsSync(f)) : []);
  fs.writeFileSync(path.join(env.CODEX_HOME, 'config.toml'), `model = ${JSON.stringify(spec.model)}\nmodel_reasoning_effort = ${JSON.stringify(spec.effort)}\nmodel_instructions_file = ${JSON.stringify(instructions.replaceAll('\\','/'))}\nweb_search = "disabled"\nskills.config = [${skills.map(f => `{path=${JSON.stringify(f.replaceAll('\\','/'))},enabled=false}`).join(',')}]\n[features]\napps=false\nhooks=false\nshell_tool=false\nmulti_agent=false\ngoals=false\ncode_mode.enabled=false\n`);
  argv = ['--no-daemon', '-a', 'never', 'exec', '--skip-git-repo-check', '--ignore-rules', '--json', '--output-schema', schema, '-s', 'read-only', '-C', ws, '-'];
} else {
  if (!authData.claudeAiOauth?.accessToken) throw Error('Claude subscription OAuth required; API-key billing refused');
  authCopy = path.join(env.CLAUDE_CONFIG_DIR, '.credentials.json');
  // Subscription execution must NOT use --bare (that requires an API key).
  argv = ['--print', '--output-format', 'stream-json', '--verbose', '--model', spec.model, '--effort', spec.effort, '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--setting-sources', '', '--disable-slash-commands', '--no-session-persistence', '--system-prompt', JOB_INSTRUCTIONS];
}
let stdout = '', stderr = '', timedOut = false, outputExceeded = false, status, streamBytes = 0;
const streamFile = path.join(out, 'stream.jsonl'), stderrFile = path.join(out, 'stderr.txt');
fs.writeFileSync(streamFile, ''); fs.writeFileSync(stderrFile, '');
try {
  assertJobUnchanged(job);
  fs.writeFileSync(authCopy, JSON.stringify(authData), { flag: 'wx', mode: 0o600 });
  plan.calls = 1; fs.writeFileSync(path.join(out, 'plan.json'), JSON.stringify(plan, null, 2));
  const child = spawn(native, argv, { cwd: ws, env, windowsHide: true, stdio: ['pipe','pipe','pipe'] });
  child.stdout.on('data', d => { fs.appendFileSync(streamFile, d); streamBytes += d.length; if (streamBytes > 8 * 1024 * 1024) { outputExceeded = true; child.kill(); } else stdout += d; });
  child.stderr.on('data', d => { fs.appendFileSync(stderrFile, d); }); child.stdin.on('error', () => {}); child.stdin.end(job.input);
  const timer = setTimeout(() => { timedOut = true; child.kill(); }, 10 * 60000);
  status = await new Promise(resolve => { child.on('error', e => resolve({ code: null, error: e.code })); child.on('close', (code, signal) => resolve({ code, signal })); }); clearTimeout(timer);
} finally {
  if (authCopy) fs.rmSync(authCopy, { force: true });
}
// Oversized streams stay intact on disk; do not parse/accept a truncated tail.
const events = outputExceeded ? [] : readJsonl(streamFile);
const response = host === 'codex' ? events.filter(e => e.type === 'item.completed' && e.item?.type === 'agent_message').at(-1)?.item.text : events.filter(e => e.type === 'result').at(-1)?.result;
const nativeNotices = events.filter(e => e.item?.type === 'error').map(e => e.item.message);
const configurationError = nativeNotices.some(message => /unrecognized configuration setting|invalid.*config|blocked by policy/i.test(message));
const toolEvents = events.filter(e => host === 'codex' ? e.item && !['agent_message', 'reasoning', 'error'].includes(e.item.type) : e.type === 'assistant' && e.message?.content?.some(c => /tool_use/.test(c.type || '')));
const tokenSummary = host === 'codex' ? events.filter(e => e.type === 'turn.completed').at(-1)?.usage : events.filter(e => e.type === 'result').at(-1)?.modelUsage;
let staged = null, verification = null, error = '', qualityFailure = '';
try { if (status.code !== 0 || timedOut || outputExceeded || configurationError || toolEvents.length || typeof response !== 'string') throw Error('native attempt incomplete, misconfigured, tool-using, oversized or malformed; never silently retry'); staged = stageJob(job, response, path.join(out, 'stage')); } catch (e) { error = e.message; }
if (staged && spec.checks) try { verification = verifyStagedJob(job, staged, spec.checks, { env }); if (verification.status !== 'verified-stage') qualityFailure = 'explicit checks failed; no retry or live change'; } catch (e) { error = e.message; }
const result = { ...plan, status, timedOut, outputExceeded, configurationError, nativeNotices, toolEvents: toolEvents.length, nativeReportedUsage: tokenSummary ?? null, responseSha256: typeof response === 'string' ? digest(response) : null, staged, verification, error, qualityFailure, protocolValid: Boolean(staged && !error), authRemoved: !fs.existsSync(authCopy), verified: verification?.status === 'verified-stage', limitation: 'All costs retained, including failed attempts. A completed wrong solution stays protocol-valid and unsolved, not excluded. Token summary needs native transcript reconciliation. Checks are finite and edits are never applied to the live project.' };
fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ host, status: error ? 'retained-protocol-failure' : verification?.status || 'staged-unverified', authRemoved: result.authRemoved, out }));
if (error) process.exitCode = 1;
