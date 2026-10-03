// Independent, model-free behavioral probes. Never replace original grades.
// These finite cases cover the written contracts, not every possible input.
export function behaviorCases() {
  let seed = 0x476576;
  const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  const shuffle = values => { const a = [...values]; for (let i = a.length - 1; i > 0; i--) { const j = random(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const families = {};
  const add = (family, args, value, options = {}) => (families[family] ||= []).push({ id: `${family}-${families[family]?.length || 0}`, args, expected: { kind: 'value', value, ...options } });
  const reject = (family, args, name) => (families[family] ||= []).push({ id: `${family}-${families[family]?.length || 0}`, args, expected: { kind: 'throws', ...(name ? { name } : {}) } });

  add('money', [[]], 0);
  add('money', [['0.29', '-0.01', '01', '-0.00']], 128);
  for (const value of ['', '+1', ' 1', '1 ', '.1', '1.', '1.001', '--1', 'NaN', '1e2', 1, null]) reject('money', [[value]], 'TypeError');
  for (let n = 0; n < 100; n++) {
    const cents = Array.from({ length: random(12) }, () => random(2000001) - 1000000);
    const values = cents.map(x => `${x < 0 ? '-' : ''}${Math.floor(Math.abs(x) / 100)}.${String(Math.abs(x) % 100).padStart(2, '0')}`);
    add('money', [values], cents.reduce((a, b) => a + b, 0));
  }

  const compareVersion = (a, b) => {
    const x = a.split('.').map(BigInt), y = b.split('.').map(BigInt);
    for (let i = 0; i < Math.max(x.length, y.length); i++) { const p = x[i] ?? 0n, q = y[i] ?? 0n; if (p !== q) return p < q ? -1 : 1; }
    return 0;
  };
  for (let n = 0; n < 100; n++) {
    const input = shuffle(['1', '1.0', '01.00', '1.0.0', '1.2', '1.10', `2.${random(100)}`, '2.9007199254740993', '2.9007199254740992']);
    const expected = input.map((value, i) => ({ value, i })).sort((a, b) => compareVersion(a.value, b.value) || a.i - b.i).map(x => x.value);
    add('versions', [input], expected);
  }

  add('intervals', [[]], []);
  reject('intervals', [[[4, 3]]]);
  for (let n = 0; n < 100; n++) {
    const offset = random(100) - 50, count = 1 + random(5), fragments = [], expected = [];
    for (let i = 0; i < count; i++) { const a = offset + i * 10; fragments.push([a, a + 2], [a + 1, a + 3], [a + 3, a + 5], [a + 4, a + 4]); expected.push([a, a + 5]); }
    add('intervals', [shuffle(fragments)], expected);
  }

  const chars = ['a', ' ', '\t', '\n', '\u00e9', 'e\u0301', '\u1100\u1161', String.fromCodePoint(0x10400)];
  for (let n = 0; n < 100; n++) { const value = Array.from({ length: random(25) }, () => chars[random(chars.length)]).join(''); add('unicode', [value], Array.from(value.normalize('NFC')).length); }

  for (const [input, value] of [['', ''], ['a/./b', 'a/b'], ['a//b/', 'a/b'], ['a/%2e%2e/b', 'b'], ['a/%252e%252e/b', 'a/%2e%2e/b']]) add('paths', [input], value);
  for (const input of ['../a', 'a/../../b', '/a', '%2fa', 'a\\b', 'a/%5cb', 'a/%00b', '%', '%GG', '%C0%AF']) reject('paths', [input]);
  for (let n = 0; n < 100; n++) { const a = `part${random(100)}`, b = `tail${random(100)}`; add('paths', [`${a}/gone/.././${b}`], `${a}/${b}`); }

  add('merge', [[]], {});
  for (const key of ['__proto__', 'constructor', 'prototype']) for (const template of ['{"KEY":{"gevAuditPolluted":true}}', '{"safe":{"KEY":1}}', '{"safe":[{"KEY":1}]}']) reject('merge', [[JSON.parse(template.replace('KEY', key))]]);
  for (let n = 0; n < 100; n++) {
    const a = random(100), b = random(100), c = random(100);
    add('merge', [[{ cfg: { x: a, list: [a], nested: { keep: true } } }, { cfg: { y: b, list: [b] } }, { cfg: { x: c }, empty: null }]], { cfg: { x: c, list: [b], nested: { keep: true }, y: b }, empty: null });
  }

  for (let n = 0; n < 100; n++) {
    const now = random(100) - 50, records = Array.from({ length: random(20) }, (_, i) => ({ key: `key${random(5)}`, value: i, expiresAt: random(4) === 0 ? null : now + random(5) - 2 }));
    const expected = [...new Set(records.map(x => x.key))].flatMap(key => { const found = records.filter(x => x.key === key && (x.expiresAt === null || x.expiresAt > now)).at(-1); return found ? [[key, found.value]] : []; });
    add('ttl', [records, now], expected);
  }
  add('ttl', [[{ key: 'a', value: 1, expiresAt: -1 }, { key: 'b', value: 2, expiresAt: null }, { key: 'a', value: 3, expiresAt: null }], 0], [['a', 3], ['b', 2]]);
  add('ttl', [[{ key: 'a', value: 1, expiresAt: null }, { key: 'a', value: 2, expiresAt: 0 }], 0], [['a', 1]]);

  for (const input of ['"abc', '"a"x', '"a" b', 'a,"b']) reject('csv', [input]);
  for (let n = 0; n < 100; n++) {
    const fields = Array.from({ length: 1 + random(10) }, () => Array.from({ length: random(10) }, () => ['a', 'b', ',', '"', ' '][random(5)]).join(''));
    const input = fields.map(x => `"${x.replaceAll('"', '""')}"`).join(',');
    add('csv', [input], fields);
  }
  add('csv', [''], ['']); add('csv', [',,'], ['', '', '']); add('csv', [' a , b '], [' a ', ' b ']);

  for (let n = 0; n < 100; n++) {
    const rows = Array.from({ length: random(12) }, (_, i) => ({ id: i === 0 ? '' : `id${i}`, value: i }));
    const index = rows.length && random(2) ? random(rows.length) : -1, cursor = index < 0 ? null : rows[index].id, limit = random(8), start = index + 1;
    const items = rows.slice(start, start + limit), next = items.length && start + items.length < rows.length ? items.at(-1).id : null;
    add('pagination', [rows, cursor, limit], { items, next });
  }
  reject('pagination', [[{ id: 'known' }], 'missing', 1], 'RangeError');
  add('pagination', [[{ id: '' }, { id: 'next' }], null, 1], { items: [{ id: '' }], next: '' });

  const topo = graph => {
    const done = [], todo = new Set(Object.keys(graph));
    while (todo.size) { const ready = [...todo].filter(key => graph[key].every(dep => done.includes(dep))).sort(); if (!ready.length) throw Error('cycle'); const node = ready[0]; done.push(node); todo.delete(node); }
    return done;
  };
  add('topology', [{}], []); reject('topology', [{ a: ['missing'] }]); reject('topology', [{ a: ['b'], b: ['a'] }]);
  add('topology', [JSON.parse('{"toString":[],"constructor":["toString"]}')], ['toString', 'constructor']);
  for (let n = 0; n < 100; n++) {
    const order = shuffle(['a', 'b', 'c', 'd', 'e', 'f']), graph = {};
    for (let i = 0; i < order.length; i++) graph[order[i]] = order.slice(0, i).filter(() => random(3) === 0);
    add('topology', [graph], topo(graph));
  }

  for (let n = 0; n < 100; n++) {
    const events = Array.from({ length: random(20) }, (_, i) => ({ tenant: ['a', 'a:b', ''][random(3)], id: ['b:c', 'c', '', ':'][random(4)], value: i }));
    const keys = [], expected = [];
    for (const event of events) { const key = JSON.stringify([event.tenant, event.id]), index = keys.indexOf(key); if (index < 0) { keys.push(key); expected.push(event); } else expected[index] = event; }
    add('dedupe', [events], expected);
  }

  for (const input of ['%', 'x=%GG', 'x=%C0%AF']) reject('query', [input]);
  add('query', ['?a=x=y&a=plus+space&empty&'], [['a', ['x=y', 'plus space']], ['empty', ['']]], { map: true });
  for (let n = 0; n < 100; n++) {
    const pairs = Array.from({ length: random(15) }, () => [['a', 'x:y', 'constructor', 'space key'][random(4)], ['v', 'x=y', ' ', '+', '%'][random(5)]]), expected = [];
    for (const [key, value] of pairs) { const entry = expected.find(x => x[0] === key); if (entry) entry[1].push(value); else expected.push([key, [value]]); }
    const encode = x => encodeURIComponent(x).replaceAll('%20', '+');
    const body = pairs.map(([key, value]) => `${encode(key)}=${encode(value)}`).join('&');
    add('query', [(n % 2 ? '?' : '') + body], expected, { map: true });
  }
  return families;
}
