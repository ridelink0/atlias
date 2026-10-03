// Explicit experiment configuration only. Never edits a user's host settings.
// Compaction may lose facts or cost more tokens; the workflow gate must measure it.
export function contextOverrides(host, policy = null) {
  if (!['codex', 'claude'].includes(host)) throw Error('known native host required');
  if (policy === null) return { argv: [], env: {}, measurement: 'full-native-input' };
  if (!policy || Object.getPrototypeOf(policy) !== Object.prototype) throw Error('plain context policy required');
  const allowed = host === 'codex' ? ['limitTokens', 'scope'] : ['windowTokens', 'percent'];
  if (Object.keys(policy).some(k => !allowed.includes(k))) throw Error('unknown or wrong-host context field');
  const integer = (value, min, max, name) => {
    if (!Number.isSafeInteger(value) || value < min || value > max) throw Error(`invalid ${name}`);
    return value;
  };
  if (host === 'codex') {
    const limit = integer(policy.limitTokens, 1, 2_000_000, 'compaction threshold');
    const scope = Object.hasOwn(policy,'scope') ? policy.scope : 'total';
    if (!['total', 'body_after_prefix'].includes(scope)) throw Error('invalid compaction scope');
    return { argv: ['-c', `model_auto_compact_token_limit=${limit}`, '-c', `model_auto_compact_token_limit_scope="${scope}"`], env: {}, measurement: 'full-native-input' };
  }
  const window = integer(policy.windowTokens, 100_000, 1_000_000, 'Claude auto-compact window');
  const percent = integer(policy.percent, 1, 100, 'Claude compaction percentage');
  return { argv: [], env: { CLAUDE_CODE_AUTO_COMPACT_WINDOW: String(window), CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: String(percent) }, measurement: 'full-native-input' };
}

// Classification of OWNED local fixture requests only, not a production
// authorization gate or proof of real model compaction quality.
export function summaryFixtureRequest(host, body) {
  const last=(body?.input ?? body?.messages)?.at(-1);
  if(host==='codex')return !body?.tools?.length && /summariz|compaction/i.test(JSON.stringify(last));
  if(host!=='claude')return false;
  return Array.isArray(last?.content) && last.content.some(c=>c.type==='text'
    && typeof c.text==='string' && c.text.startsWith('CRITICAL: Respond with TEXT ONLY. Do NOT call any tools.')
    && c.text.includes('Your task is to create a detailed summary of the conversation so far'));
}
