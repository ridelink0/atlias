// Real native clients against an owned HTTP fixture; zero inference calls.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { prepareJob, JOB_INSTRUCTIONS, validateEdits, digest } from '../../lib/native-job.mjs';
import { childEnv } from '../ccstudy/lib.mjs';
const [out, codex, claude] = process.argv.slice(2);
if (!out || !codex || !claude || fs.existsSync(out)) throw Error('usage: probe.mjs <unused-out> <native-codex> <native-claude>');
fs.mkdirSync(out, { recursive: true });
const source = path.join(out, 'source'); fs.mkdirSync(source);
fs.writeFileSync(path.join(source, 'api.mjs'), 'export const value = 1;');
const job = prepareJob({ root: source, task: 'Change value to2.', instructions: ['The user is Gev. Start replies with Okay Gev. No emojis.', 'Functional verification then an adversarial hunt; preserve concurrent edits.'], readPaths: ['api.mjs'], writePaths: ['api.mjs'] });
const reply = JSON.stringify({ packetSha256: job.packetSha256, edits: [{ path: 'api.mjs', beforeSha256: job.packet.files[0].sha256, text: 'export const value = 2;' }] });
const requests = [], results = [];
const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') { res.writeHead(404); res.end(); return; }
  let raw = ''; for await (const part of req) raw += part;
  const body = JSON.parse(raw);
  if (!/\/messages|\/responses/.test(req.url)) { res.writeHead(404); res.end(); return; }
  requests.push({ url: req.url, body });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  if (req.url.includes('/messages')) {
    const msg = { id: 'msg_gev_fixture', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: reply }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } };
    if (!body.stream) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(msg)); return; }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    send('message_start', { type: 'message_start', message: { ...msg, content: [], stop_reason: null } });
    send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: reply } });
    send('content_block_stop', { type: 'content_block_stop', index: 0 });
    send('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 0 } });
    send('message_stop', { type: 'message_stop' }); res.end(); return;
  }
  res.writeHead(200, { 'Content-Type': 'text/event-stream' });
  const item = { id: 'msg_gev_fixture', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: reply, annotations: [] }] };
  const response = { id: 'resp_gev_fixture', object: 'response', model: body.model, status: 'completed', output: [item], usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 } };
  send('response.created', { type: 'response.created', response: { ...response, status: 'in_progress', output: [] } });
  send('response.output_item.added', { type: 'response.output_item.added', output_index: 0, item: { ...item, status: 'in_progress', content: [] } });
  send('response.content_part.added', { type: 'response.content_part.added', item_id: item.id, output_index: 0, content_index: 0, part: { type: 'output_text', text: '', annotations: [] } });
  send('response.output_text.delta', { type: 'response.output_text.delta', item_id: item.id, output_index: 0, content_index: 0, delta: reply });
  send('response.output_text.done', { type: 'response.output_text.done', item_id: item.id, output_index: 0, content_index: 0, text: reply });
  send('response.content_part.done', { type: 'response.content_part.done', item_id: item.id, output_index: 0, content_index: 0, part: item.content[0] });
  send('response.output_item.done', { type: 'response.output_item.done', output_index: 0, item });
  send('response.completed', { type: 'response.completed', response }); res.end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
try {
  for (const host of (process.argv.includes('--claude-only') ? ['claude'] : process.argv.includes('--codex-only') ? ['codex'] : ['codex', 'claude'])) {
    const folder = path.join(out, host), home = path.join(folder, 'home'), ws = path.join(folder, 'ws');
    fs.mkdirSync(home, { recursive: true }); fs.mkdirSync(ws);
    const env = childEnv(process.env, { home });
    env.CODEX_HOME = path.join(home, '.codex'); env.CLAUDE_CONFIG_DIR = path.join(home, '.claude'); env.ATLIAS_HOME = path.join(home, '.atlias');
    fs.mkdirSync(env.CODEX_HOME); fs.mkdirSync(env.CLAUDE_CONFIG_DIR);
    if (host === 'codex') {
      const cachedModels = path.join(process.env.USERPROFILE, '.codex/models_cache.json');
      if (!fs.existsSync(cachedModels)) throw Error('real native model metadata required for this fixture');
      const cache = JSON.parse(fs.readFileSync(cachedModels));
      assert.ok(cache.models?.some(m => m.slug === 'gpt-6.1-sol'), 'pinned native model missing from cache');
      fs.copyFileSync(cachedModels, path.join(env.CODEX_HOME, 'models_cache.json'));
    }
    const instructionFile = path.join(folder, 'instructions.md'); fs.writeFileSync(instructionFile, JOB_INSTRUCTIONS);
    let args;
    if (host === 'codex') {
      const skillFiles = [path.join(process.env.USERPROFILE, '.agents/skills'), path.join(process.env.USERPROFILE, '.codex/skills')].flatMap(p => fs.existsSync(p) ? fs.readdirSync(p).map(n => path.join(p, n, 'SKILL.md')).filter(f => fs.existsSync(f)) : []);
      fs.writeFileSync(path.join(env.CODEX_HOME, 'config.toml'), `model = "gpt-6.1-sol"\nmodel_reasoning_effort = "medium"\nmodel_provider = "fixture"\nmodel_instructions_file = ${JSON.stringify(instructionFile.replaceAll('\\','/'))}\nweb_search = "disabled"\nskills.config = [${skillFiles.map(f => `{ path = ${JSON.stringify(f.replaceAll('\\','/'))}, enabled = false }`).join(',')}]\n[features]\napps = false\nhooks = false\nshell_tool = false\nmulti_agent = false\ngoals = false\ncode_mode.enabled = false\n[model_providers.fixture]\nname = "Owned local fixture"\nbase_url = "http://127.0.0.1:${port}/v1"\nwire_api = "responses"\nrequires_openai_auth = false\n`);
      args = ['--no-daemon', '-a', 'never', 'exec', '--skip-git-repo-check', '--ignore-rules', '--json', '-s', 'read-only', '-C', ws, '-'];
    } else {
      env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}`;
      env.ANTHROPIC_API_KEY = 'owned-local-fixture-not-a-paid-key';
      env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1';
      env.DISABLE_TELEMETRY = '1';
      // Bare is ONLY for this fake-key localhost fixture; it disables startup
      // prefetch/auth discovery. It cannot be used for subscription inference.
      args = ['--bare', '--print', '--output-format', 'stream-json', '--verbose', '--model', 'claude-sonnet-4-6', '--effort', 'medium', '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--setting-sources', '', '--disable-slash-commands', '--no-session-persistence', '--system-prompt', JOB_INSTRUCTIONS];
    }
    const before = requests.length;
    const child = spawn(host === 'codex' ? codex : claude, args, { cwd: ws, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => stdout += d); child.stderr.on('data', d => stderr += d);
    child.stdin.on('error', () => {}); child.stdin.end(job.input);
    // Only terminate this owned child handle on timeout, never a Windows PID.
    const timer = setTimeout(() => child.kill(), 90000);
    const status = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', (code, signal) => resolve({ code, signal })); }); clearTimeout(timer);
    fs.writeFileSync(path.join(folder, 'stream.jsonl'), stdout); fs.writeFileSync(path.join(folder, 'stderr.txt'), stderr);
    const captured = requests.slice(before); fs.writeFileSync(path.join(folder, 'requests.json'), JSON.stringify(captured, null, 2));
    const bodies = captured.map(r => r.body), last = bodies.at(-1);
    assert.equal(status.code, 0, `${host}: signal=${status.signal} ${stderr.slice(-600)}`); assert.ok(last, 'actual native request absent');
    const texts = host === 'codex' ? last.input.flatMap(x => (x.content || []).filter(p => typeof p.text === 'string').map(p => p.text)) : last.messages.flatMap(x => Array.isArray(x.content) ? x.content.filter(p => typeof p.text === 'string').map(p => p.text) : [x.content]);
    assert.ok(texts.some(text => text.includes(job.serialized)), 'complete packet not delivered');
    assert.ok(texts.some(text => text.includes(job.input)), 'hash-bound input envelope not delivered');
    const instructions = host === 'codex' ? last.instructions : JSON.stringify(last.system);
    assert.ok(host === 'codex' ? instructions === JOB_INSTRUCTIONS : (last.system || []).some(p => p.text === JOB_INSTRUCTIONS), 'replacement instructions not delivered exactly');
    const events = stdout.split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
    const notices = events.filter(e => e.item?.type === 'error').map(e => e.item.message);
    assert.ok(!notices.some(message => /unrecognized configuration setting|invalid.*config/i.test(message)), 'native configuration error must not be ignored');
    const output = host === 'codex' ? events.filter(e => e.type === 'item.completed' && e.item?.type === 'agent_message').at(-1)?.item.text : events.filter(e => e.type === 'result').at(-1)?.result;
    assert.equal(output, reply); validateEdits(job, output);
    results.push({ host, modelCalls: 0, localRequests: bodies.length, completePacketDelivered: true, replacementInstructionsDelivered: true, parsedAndValidated: true, nativeNotices: notices, metadataParity: notices.some(m => /fallback metadata/.test(m)) ? 'not established; owned custom provider uses fallback metadata' : 'unmeasured', packetSha256: job.packetSha256, instructionSha256: digest(JOB_INSTRUCTIONS), instructionsChars: instructions.length, inputChars: JSON.stringify(host === 'codex' ? last.input : last.messages).length, toolsChars: JSON.stringify(last.tools || []).length, toolNames: (last.tools || []).map(t => t.name || t.type), status });
    console.log(JSON.stringify(results.at(-1)));
  }
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
fs.writeFileSync(path.join(out, 'RESULT.json'), JSON.stringify({ modelCalls: 0, results, limitation: 'Owned local fixture, no inference. Metadata is not model-token saving or general feature parity; no live user configuration or auth was copied. Native profile remains experimental.' }, null, 2));
