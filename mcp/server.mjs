#!/usr/bin/env node
// atlias MCP server: newline-delimited JSON-RPC 2.0 over stdio, no dependencies.
// The same tools reach Claude Code (plugin .mcp.json), Codex (config.toml) and
// Antigravity / Gemini CLI (mcp_config.json / settings.json).
import { VERSION, log } from '../lib/core.mjs';
import { TOOLS, callTool } from './tools.mjs';

let buf = '';
const send = (obj) => process.stdout.write(JSON.stringify(obj) + '\n');
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

export function handle(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') return reply(id, { protocolVersion: (params && params.protocolVersion) || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'atlias', version: VERSION } });
  if (typeof method === 'string' && method.startsWith('notifications/')) return;
  if (method === 'ping') return reply(id, {});
  if (method === 'tools/list') return reply(id, { tools: TOOLS });
  if (method === 'tools/call') {
    const name = params && params.name;
    try {
      const text = callTool(name, (params && params.arguments) || {});
      return reply(id, { content: [{ type: 'text', text: String(text) }], isError: false });
    } catch (e) {
      log(`tool ${name} failed: ${e.stack || e}`);
      return reply(id, { content: [{ type: 'text', text: `atlias ${name}: ${e.message}` }], isError: true });
    }
  }
  if (method === 'resources/list') return reply(id, { resources: [] });
  if (method === 'prompts/list') return reply(id, { prompts: [] });
  if (id !== undefined) return fail(id, -32601, `method not found: ${method}`);
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg; try { msg = JSON.parse(line); } catch { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }); continue; }
    try { handle(msg); } catch (e) { log(`rpc failed: ${e.stack || e}`); if (msg.id !== undefined) fail(msg.id, -32603, e.message); }
  }
});
process.stdin.on('end', () => process.exit(0));