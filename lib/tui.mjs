// The terminal screens: the start chooser (`atlias` in mode both), the settings
// screen (`atlias settings`, the chooser's third item, /settings in the agent)
// and the agent's prompt, status line and help. What is drawn is decided by
// pure functions: render*(state, ..., {width, height, color}) returns lines no
// wider than width, and *Reduce(state, key) returns the next state and what to
// do. runScreen is the one part that touches the terminal: raw mode, the
// alternate screen and the hidden cursor, all three put back however the screen
// ends. A terminal that cannot draw one (a pipe, TERM=dumb, a Windows console
// older than VT support) gets the numbered forms instead.
import os from 'node:os';
import readline from 'node:readline';
import { VERSION } from './core.mjs';
import { colorMode, accent, dim, bold, logo } from './logo.mjs';
import * as settingsMod from './settings.mjs';

// ---------- text that fits ----------
const SGR_AT = /\u001b\[[0-9;?]*[A-Za-z]/y;
const SGR_ALL = /\u001b\[[0-9;?]*[A-Za-z]/g;
// Control characters in a value or a message (a CR from a hand-edited config,
// an escape) would move the cursor or break the line, so they print as spaces.
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;
const chars = (s) => Array.from(String(s));
const clean = (s) => String(s == null ? '' : s).replace(CONTROL, ' ');
const cut = (s, n) => { const c = chars(s); if (n <= 0) return ''; if (c.length <= n) return c.join(''); return n > 3 ? c.slice(0, n - 3).join('') + '...' : c.slice(0, n).join(''); };
const tail = (s, n) => { const c = chars(s); return n <= 0 ? '' : c.slice(Math.max(0, c.length - n)).join(''); };
const clamp = (n, lo, hi) => Math.min(Math.max(Number.isFinite(n) ? n : lo, lo), hi);

// Columns a line takes, colour codes not counted. One column per code point:
// East Asian wide characters are counted as one.
export function visibleWidth(line) { return chars(String(line == null ? '' : line).replace(SGR_ALL, '')).length; }
// A line cut to width, colour codes kept, "..." where it was cut, and the colour
// reset after the cut so it does not bleed into the next line.
export function fitLine(line, width) {
  const s = String(line == null ? '' : line);
  if (!(width > 0)) return '';
  if (visibleWidth(s) <= width) return s;
  const keep = width > 3 ? width - 3 : width;
  let out = '';
  let n = 0;
  let i = 0;
  let styled = false;
  while (i < s.length && n < keep) {
    if (s[i] === '\u001b') {
      SGR_AT.lastIndex = i;
      const m = SGR_AT.exec(s);
      if (m) { out += m[0]; i += m[0].length; styled = true; continue; }
    }
    const ch = String.fromCodePoint(s.codePointAt(i));
    out += ch;
    i += ch.length;
    n++;
  }
  return out + (styled ? '\u001b[0m' : '') + (width > 3 ? '...' : '');
}
// Words wrapped to width, at most maxLines, the last one ending in "..." when
// the text went on.
export function wrapText(text, width, maxLines = Infinity) {
  if (!(width > 0) || !(maxLines > 0)) return [];
  const lines = [];
  let cur = '';
  for (let w of clean(text).split(/\s+/).filter(Boolean)) {
    while (chars(w).length > width) {
      if (cur) { lines.push(cur); cur = ''; }
      lines.push(chars(w).slice(0, width).join(''));
      w = chars(w).slice(width).join('');
    }
    if (!w) continue;
    if (!cur) cur = w;
    else if (chars(cur).length + 1 + chars(w).length <= width) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1];
  kept[maxLines - 1] = chars(last).length + 3 <= width ? last + '...' : cut(last + '....', width);
  return kept;
}
// How a setting's value reads on screen.
export function displayValue(v) {
  if (v === '' || v === null || v === undefined) return '(empty)';
  return clean(typeof v === 'string' ? v : JSON.stringify(v));
}

// ---------- keys and glyphs ----------
// readline's (str, key) as one plain object: name for the named keys, ch for
// a character that types.
export function keyOf(str, key) {
  const k = key || {};
  const ctrl = Boolean(k.ctrl);
  const meta = Boolean(k.meta);
  const s = typeof str === 'string' ? str : '';
  const ch = !ctrl && !meta && s && chars(s).length === 1 && !/^[\u0000-\u001f\u007f-\u009f]$/.test(s) ? s : '';
  return { name: k.name || ch, ch, ctrl, meta };
}
const PLAIN = { pointer: '>', updown: 'up/down' };
const FANCY = { pointer: '\u276f', updown: '\u2191\u2193' };
// The arrow and pointer characters only where they are known to render:
// colour on, and not a bare Windows console (Windows Terminal and VS Code set
// WT_SESSION and TERM_PROGRAM). Everywhere else, and with NO_COLOR, ASCII.
export function fancyGlyphs(color, env = process.env, platform = process.platform) {
  return color !== 'none' && (platform !== 'win32' || Boolean(env.WT_SESSION) || env.TERM_PROGRAM === 'vscode');
}
const glyphSet = (fancy, color) => (fancy && color !== 'none' ? FANCY : PLAIN);
const cursorMark = (color) => (color === 'none' ? '_' : '\u001b[7m \u001b[27m');
// The longest of these key lists that fits; the keys matter more than the words.
const firstFit = (options, width) => options.find((o) => chars(o).length <= width) || options[options.length - 1];
// Whether a screen can be drawn here: both ends a terminal that takes raw
// mode, a TERM that is not dumb, and on Windows a console with VT support
// (Windows 10 1511, build 10586, and later).
export function canDrawScreen({ input = process.stdin, output = process.stdout, env = process.env, platform = process.platform, release = os.release() } = {}) {
  if (!input || !output || !input.isTTY || !output.isTTY || typeof input.setRawMode !== 'function') return false;
  if (env.TERM === 'dumb') return false;
  if (platform === 'win32') {
    const build = Number(String(release || '').split('.')[2]);
    if (Number.isFinite(build) && build > 0 && build < 10586) return false;
  }
  return true;
}

// ---------- the start screen ----------
export const CHOOSER_ITEMS = [
  { id: 'sub', label: 'sub-harness', about: 'link atlias into every harness on this machine; its hooks and MCP server run inside them' },
  { id: 'agent', label: 'regular agent', about: 'run atlias in this terminal, with Claude Code, Codex, an OpenAI-compatible model or Ollama as the engine' },
  { id: 'settings', label: 'settings', about: 'the mode, the engine, the checks and every other option' },
];
export function chooserReduce(state, key) {
  const n = CHOOSER_ITEMS.length;
  const sel = clamp(state && state.sel, 0, n - 1);
  const k = key || {};
  const at = (i) => ({ state: { ...state, sel: clamp(i, 0, n - 1) } });
  if (k.ctrl && k.name === 'c') return { state: { ...state, sel }, action: { type: 'quit' } };
  if (k.name === 'up' || k.ch === 'k') return at(sel - 1);
  if (k.name === 'down' || k.ch === 'j') return at(sel + 1);
  if (/^[1-9]$/.test(k.ch) && Number(k.ch) <= n) return at(Number(k.ch) - 1);
  if (k.name === 'return' || k.name === 'enter') return { state: { ...state, sel }, action: { type: 'open', id: CHOOSER_ITEMS[sel].id } };
  if (k.name === 'escape' || k.ch === 'q' || k.ch === 'Q') return { state: { ...state, sel }, action: { type: 'quit' } };
  return { state };
}
// numbered: the form for a terminal that cannot take keys one at a time, every
// item with its description and no pointer, the question asked after it.
export function renderChooser(state, { width = 80, height = 24, color = 'none', fancy = false, status = [], numbered = false } = {}) {
  if (!(width > 0) || !(height > 0)) return [];
  const g = glyphSet(fancy, color);
  const n = CHOOSER_ITEMS.length;
  const sel = clamp(state && state.sel, 0, n - 1);
  const items = CHOOSER_ITEMS.map((it, i) => {
    const on = !numbered && i === sel;
    const label = `[${i + 1}] ${it.label}`;
    if (numbered) return `  ${bold(label.padEnd(19), color)}${dim(clean(it.about), color)}`;
    return `  ${on ? accent(g.pointer, color) : ' '} ${on ? bold(label, color) : label}`;
  });
  const desc = numbered ? [] : [`    ${dim(clean(CHOOSER_ITEMS[sel].about), color)}`];
  const stat = status.filter(Boolean).map((s) => `  ${dim(clean(s), color)}`);
  const foot = numbered ? [] : [`  ${dim(firstFit([`${g.updown} or j/k move   1-${n} jump   enter open   q quit`, `${g.updown} move  1-${n} jump  enter open  q quit`, 'enter open  q quit'], width - 2), color)}`];
  const full = logo({ color, width }).split('\n');
  const small = [` ${bold(`atlias ${VERSION}`, color)}`];
  const build = (banner, withStatus, gaps, withDesc, withFoot) => {
    const out = [];
    const gap = () => { if (gaps) out.push(''); };
    if (banner.length) { out.push(...banner); gap(); }
    out.push(...items);
    if (withDesc && desc.length) { gap(); out.push(...desc); }
    if (withStatus && stat.length) { gap(); out.push(...stat); }
    if (withFoot && foot.length) { gap(); out.push(...foot); }
    return out;
  };
  // A short terminal gives up the banner, then the status, the gaps, the
  // description and the footer, in that order; the list goes last.
  const tries = [[full, 1, 1, 1, 1], [small, 1, 1, 1, 1], [small, 0, 1, 1, 1], [small, 0, 0, 1, 1], [[], 0, 0, 1, 1], [[], 0, 0, 0, 1], [[], 0, 0, 0, 0]];
  let lines = null;
  for (const t of tries) { const l = build(...t); if (l.length <= height) { lines = l; break; } }
  if (!lines) { const start = clamp(sel - Math.floor(height / 2), 0, n - height); lines = items.slice(start, start + height); }
  return lines.map((l) => fitLine(l, width));
}

// ---------- the settings screen ----------
// Every word of the query has to appear in the label, the key, the
// description or the environment variable.
export function filterEntries(list, query) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.filter((e) => { const hay = `${e.label} ${e.id} ${e.about} ${e.env || ''}`.toLowerCase(); return words.every((w) => hay.includes(w)); });
}
function flatten(shown) {
  const flat = [];
  let group;
  shown.forEach((entry, index) => {
    if (entry.group !== group) {
      if (entry.group) { if (flat.length) flat.push({ kind: 'blank' }); flat.push({ kind: 'header', text: entry.group }); }
      group = entry.group;
    }
    flat.push({ kind: 'row', entry, index });
  });
  return flat;
}
// The scroll that keeps the selected row in view, moving as little as it can,
// and showing a section's header when scrolling up onto its first row.
function settle(scroll, selFlat, viewH, flat) {
  if (!(viewH > 0) || selFlat < 0) return 0;
  const maxTop = Math.max(0, flat.length - viewH);
  let s = clamp(scroll, 0, maxTop);
  if (selFlat < s) { s = selFlat; while (s > 0 && flat[s - 1].kind !== 'row' && selFlat - (s - 1) < viewH) s--; }
  if (selFlat >= s + viewH) s = selFlat - viewH + 1;
  // The gap before a header is not worth the top line of the view.
  if (flat[s] && flat[s].kind === 'blank' && s + 1 <= maxTop && selFlat >= s + 1) s++;
  return clamp(s, 0, maxTop);
}
const MIN_LIST = 3;
// Where everything goes at this height. When the terminal is short the
// screen gives up, in order: the gaps, all but one line of description, the
// title, the description, the footer, the search line, and the message line
// (never the line being edited). The list keeps whatever is left.
export function settingsLayout(state, list, { height = 24 } = {}) {
  const shown = filterEntries(list, state.query);
  const flat = flatten(shown);
  const sel = shown.length ? clamp(state.sel, 0, shown.length - 1) : 0;
  const parts = { title: 1, search: 1, gapTop: 1, gapBottom: 1, desc: 3, msg: 1, footer: 1 };
  const used = () => Object.values(parts).reduce((a, b) => a + b, 0);
  const h = Math.max(0, Number.isFinite(height) ? height : 24);
  let listH = h - used();
  for (const [k, v] of [['gapBottom', 0], ['gapTop', 0], ['desc', 1], ['title', 0], ['desc', 0], ['footer', 0], ['search', 0], ['msg', 0]]) {
    if (listH >= MIN_LIST) break;
    if (k === 'msg' && state.edit && h > 0) continue;
    listH += parts[k] - v;
    parts[k] = v;
  }
  listH = Math.max(0, listH);
  const selFlat = shown.length ? flat.findIndex((it) => it.kind === 'row' && it.index === sel) : -1;
  return { shown, flat, sel, selFlat, scroll: settle(state.scroll || 0, selFlat, listH, flat), listH, parts };
}
function describe(e) {
  const env = e.env ? `${e.env}=${typeof e.def === 'boolean' ? '1' : '<value>'} for one run; ` : '';
  return `${env}${clean(e.about).trim() || 'No description yet.'} (${e.id}, default ${displayValue(e.def)})`;
}
function rowLine(e, selected, width, color, g) {
  const gutter = selected ? `${accent(g.pointer, color)} ` : '  ';
  const avail = width - 2;
  if (avail <= 0) return gutter;
  const value = (e.changed && color === 'none' ? '* ' : '') + displayValue(e.value);
  const label = clean(e.label);
  const vLen = chars(value).length;
  const lLen = chars(label).length;
  let l = label;
  let v = value;
  if (lLen + 1 + vLen > avail) {
    const vMax = Math.min(vLen, Math.max(Math.floor(avail / 2), avail - lLen - 1));
    const lMax = avail - vMax - 1;
    if (lMax < 1) return gutter + (selected ? bold(cut(label, avail), color) : cut(label, avail));
    v = cut(value, vMax);
    l = cut(label, lMax);
  }
  const pad = ' '.repeat(Math.max(1, avail - chars(l).length - chars(v).length));
  return gutter + (selected ? bold(l, color) : l) + pad + (e.changed ? accent(v, color) : v);
}
function editLine(edit, width, color) {
  const prefix = `${clean(edit.label)}: `;
  const buf = clean(edit.buffer);
  const room = width - chars(prefix).length - 1;
  const shown = chars(buf).length <= room ? buf : room > 3 ? '...' + tail(buf, room - 3) : tail(buf, room);
  const hint = buf ? '' : dim(`  now ${edit.now}; empty keeps it`, color);
  return accent(prefix, color) + shown + cursorMark(color) + hint;
}
export function renderSettings(state, list, { width = 80, height = 24, color = 'none', fancy = false } = {}) {
  if (!(width > 0) || !(height > 0)) return [];
  const g = glyphSet(fancy, color);
  const { shown, flat, sel, scroll, listH, parts } = settingsLayout(state, list, { height });
  const current = shown[sel];
  const out = [];
  if (parts.title) {
    const left = bold('Settings', color);
    const right = dim(shown.length ? `${sel + 1}/${shown.length}` : '0/0', color);
    const gap = width - visibleWidth(left) - visibleWidth(right);
    out.push(gap >= 1 ? left + ' '.repeat(gap) + right : left);
  }
  if (parts.search) {
    const q = clean(state.query);
    const room = width - 'Search: '.length - 1;
    out.push('Search: ' + (q ? (chars(q).length <= room ? q : tail(q, room)) + (state.edit ? '' : cursorMark(color)) : dim('type to filter', color)));
  }
  if (parts.gapTop) out.push('');
  const view = [];
  if (!shown.length) view.push(`  ${dim(`no setting matches "${clean(state.query)}"`, color)}`);
  else {
    for (let i = scroll; i < Math.min(flat.length, scroll + listH); i++) {
      const it = flat[i];
      if (it.kind === 'blank') view.push('');
      else if (it.kind === 'header') view.push(bold(accent(clean(it.text), color), color));
      else view.push(rowLine(it.entry, it.index === sel, width, color, g));
    }
  }
  while (view.length < listH) view.push('');
  out.push(...view.slice(0, listH));
  if (parts.gapBottom) out.push('');
  if (parts.desc) {
    const d = current ? wrapText(describe(current), Math.max(1, width - 2), parts.desc).map((l) => `  ${dim(l, color)}`) : [];
    while (d.length < parts.desc) d.push('');
    out.push(...d);
  }
  if (parts.msg) {
    const m = state.message;
    if (state.edit) out.push(editLine(state.edit, width, color));
    else if (!m) out.push('');
    else if (m.note) out.push(dim(clean(m.text), color));
    else out.push(m.ok ? accent(`saved: ${clean(m.text)}`, color) : bold(`not saved: ${clean(m.text)}`, color));
  }
  if (parts.footer) {
    const esc = `esc ${state.query ? 'clear' : 'back'}`;
    const keys = state.edit ? 'enter save   esc cancel' : firstFit([`${g.updown} move   enter change   ctrl+r reset   type to search   ${esc}`, `${g.updown} move  enter change  ctrl+r reset  ${esc}`, `enter change  ctrl+r reset  ${esc}`], width);
    out.push(dim(keys, color));
  }
  return out.slice(0, height).map((l) => fitLine(l, width));
}
// Keys in, the next state out, with an action when something has to happen
// outside: set or reset a setting, go back, or quit. Enter toggles a switch,
// moves a choice to the next one, and opens the edit line on a free value.
export function settingsReduce(state, key, list, { page = 10 } = {}) {
  const k = key || {};
  const shown = filterEntries(list, state.query);
  const n = shown.length;
  const sel = n ? clamp(state.sel, 0, n - 1) : 0;
  const base = { ...state, sel, message: null };
  const enter = k.name === 'return' || k.name === 'enter';
  if (k.ctrl && k.name === 'c') return { state: { ...base, edit: null }, action: { type: 'quit' } };
  if (state.edit) {
    const ed = state.edit;
    const unchanged = { note: true, text: `${ed.label} unchanged` };
    if (k.name === 'escape') return { state: { ...base, edit: null, message: unchanged } };
    if (enter) return ed.buffer.trim() ? { state: { ...base, edit: null }, action: { type: 'set', id: ed.id, raw: ed.buffer } } : { state: { ...base, edit: null, message: unchanged } };
    if (k.name === 'backspace') return { state: { ...base, edit: { ...ed, buffer: chars(ed.buffer).slice(0, -1).join('') } } };
    if (k.ch) return { state: { ...base, edit: { ...ed, buffer: ed.buffer + k.ch } } };
    return { state };
  }
  const move = (to) => ({ state: { ...base, sel: n ? clamp(to, 0, n - 1) : 0 } });
  const step = Math.max(1, page | 0);
  if (k.name === 'up') return move(sel - 1);
  if (k.name === 'down') return move(sel + 1);
  if (k.name === 'pageup') return move(sel - step);
  if (k.name === 'pagedown') return move(sel + step);
  if (k.name === 'home') return move(0);
  if (k.name === 'end') return move(n - 1);
  if (k.name === 'escape') return state.query ? { state: { ...base, query: '', sel: 0, scroll: 0 } } : { state: base, action: { type: 'back' } };
  if (enter) {
    const e = shown[sel];
    if (!e) return { state };
    if (typeof e.def === 'boolean') return { state: base, action: { type: 'set', id: e.id, raw: String(!(e.value === true || e.value === 'true')) } };
    if (Array.isArray(e.choices) && e.choices.length) {
      const i = e.choices.findIndex((c) => String(c) === String(e.value));
      return { state: base, action: { type: 'set', id: e.id, raw: String(e.choices[(i + 1) % e.choices.length]) } };
    }
    return { state: { ...base, edit: { id: e.id, label: e.label, now: displayValue(e.value), buffer: '' } } };
  }
  if (k.ctrl && k.name === 'r') { const e = shown[sel]; return e ? { state: base, action: { type: 'reset', id: e.id } } : { state }; }
  if (k.name === 'backspace') return state.query ? { state: { ...base, query: chars(state.query).slice(0, -1).join(''), sel: 0, scroll: 0 } } : { state };
  if (k.ch) {
    // q goes back while the search is empty; after that it is a letter.
    if (!state.query && k.ch === 'q') return { state: base, action: { type: 'back' } };
    if (!state.query && k.ch === ' ') return { state };
    return { state: { ...base, query: (state.query || '') + k.ch, sel: 0, scroll: 0 } };
  }
  return { state };
}
// The settings screen as runScreen drives it. Every change is written at once
// through set() and reset(), so config.json and parseSetting stay the one way
// a setting is written; the list is read again after each.
export function settingsScreen({ load = () => settingsMod.entries(), set = settingsMod.set, reset = settingsMod.reset, color = 'none', fancy = false } = {}) {
  let state = { query: '', sel: 0, scroll: 0, edit: null, message: null };
  let list = load();
  return {
    get state() { return state; },
    render(dims) {
      state = { ...state, scroll: settingsLayout(state, list, dims).scroll };
      return renderSettings(state, list, { ...dims, color, fancy });
    },
    key(k, dims) {
      const lay = settingsLayout(state, list, dims);
      const r = settingsReduce({ ...state, scroll: lay.scroll }, k, list, { page: Math.max(1, lay.listH - 1) });
      state = r.state;
      const a = r.action;
      if (!a) return undefined;
      if (a.type === 'back' || a.type === 'quit') return a;
      let res;
      try { res = a.type === 'set' ? set(a.id, a.raw) : reset(a.id); } catch (e) { res = { ok: false, text: String((e && e.message) || e) }; }
      try { list = load(); } catch { /* keep the list that was on screen */ }
      state = { ...state, message: { ok: Boolean(res && res.ok), text: (res && res.text) || '' } };
      return undefined;
    },
  };
}

// The start screen with the settings screen inside it: Esc or q in settings
// comes back here, ctrl+c leaves both. status is read at every draw, so a mode
// changed in settings shows when the list comes back.
export function chooserScreen({ color = 'none', fancy = false, status = () => [], settings = {} } = {}) {
  let state = { sel: 0 };
  let sub = null;
  return {
    get state() { return state; },
    get inSettings() { return Boolean(sub); },
    render(dims) { return sub ? sub.render(dims) : renderChooser(state, { ...dims, color, fancy, status: typeof status === 'function' ? status() : status }); },
    key(k, dims) {
      if (sub) {
        const r = sub.key(k, dims);
        if (r && r.type === 'quit') return r;
        if (r) sub = null;
        return undefined;
      }
      const r = chooserReduce(state, k);
      state = r.state;
      if (!r.action) return undefined;
      if (r.action.type === 'open' && r.action.id === 'settings') { sub = settingsScreen({ color, fancy, ...settings }); return undefined; }
      return r.action;
    },
  };
}

// ---------- the terminal ----------
// Draws screen until its key() returns something, and resolves with that. The
// terminal is handed back - raw mode as it was, the cursor shown, the main
// screen restored, the listeners that were on the streams back in place - on
// a normal end, ctrl+c, SIGINT, an exception in the screen, and at exit. While
// the screen is up, the keypress and resize listeners already on the streams
// (the agent's own readline) are taken off, so no key is handled twice and
// readline does not redraw its prompt over the screen on a resize.
export function runScreen(screen, { input = process.stdin, output = process.stdout, proc = process } = {}) {
  return new Promise((resolve, reject) => {
    const saved = { keypress: input.listeners('keypress'), resize: output.listeners('resize'), raw: Boolean(input.isRaw), flowing: input.readableFlowing };
    let done = false;
    let restored = false;
    let entered = false;
    let lastReturn = false;
    // One column short of the edge: a line that fills the last column leaves
    // some consoles (Windows conhost among them) wrapping onto the next.
    const dims = () => {
      const c = Number(output.columns);
      const r = Number(output.rows);
      return { width: Number.isFinite(c) && c > 0 ? c - 1 : 79, height: Number.isFinite(r) && r >= 0 ? r : 24 };
    };
    const draw = () => {
      const d = dims();
      const lines = screen.render(d).slice(0, d.height);
      output.write('\u001b[H' + lines.map((l) => '\u001b[2K' + l).join('\r\n') + '\u001b[J');
    };
    const restore = () => {
      if (restored) return;
      restored = true;
      input.removeListener('keypress', onKey);
      output.removeListener('resize', onResize);
      proc.removeListener('SIGINT', onSigint);
      proc.removeListener('exit', restore);
      proc.removeListener('uncaughtExceptionMonitor', restore);
      try { if (typeof input.setRawMode === 'function') input.setRawMode(saved.raw); } catch { /* the terminal is gone */ }
      // Clearing is only for the alternate screen: if raw mode failed before
      // it was entered, the main screen is left as the user had it.
      if (entered) { try { output.write('\u001b[2J\u001b[H\u001b[?25h\u001b[?1049l'); } catch { /* the terminal is gone */ } }
      for (const l of saved.keypress) if (!input.listeners('keypress').includes(l)) input.on('keypress', l);
      for (const l of saved.resize) if (!output.listeners('resize').includes(l)) output.on('resize', l);
      // A stream that was not flowing before is paused again, or stdin would
      // hold the process open after the screen is gone.
      if (saved.flowing !== true && typeof input.pause === 'function') input.pause();
    };
    const finish = (value, error) => {
      if (done) return;
      done = true;
      restore();
      if (error) reject(error);
      else resolve(value);
    };
    function onKey(str, key) {
      if (done) return;
      try {
        const k = keyOf(str, key);
        // A pasted CRLF is one Enter, not two.
        if (k.name === 'enter' && lastReturn) { lastReturn = false; return; }
        lastReturn = k.name === 'return';
        const r = screen.key(k, dims());
        if (r !== undefined && r !== null) { finish(r); return; }
        draw();
      } catch (e) { finish(undefined, e); }
    }
    function onResize() {
      if (done) return;
      try { draw(); } catch (e) { finish(undefined, e); }
    }
    function onSigint() { finish({ type: 'quit', signal: 'SIGINT' }); }
    try {
      for (const l of saved.keypress) input.removeListener('keypress', l);
      for (const l of saved.resize) output.removeListener('resize', l);
      readline.emitKeypressEvents(input);
      input.setRawMode(true);
      entered = true;
      output.write('\u001b[?1049h\u001b[?25l');
      input.on('keypress', onKey);
      output.on('resize', onResize);
      proc.on('SIGINT', onSigint);
      proc.on('exit', restore);
      proc.on('uncaughtExceptionMonitor', restore);
      if (typeof input.resume === 'function') input.resume();
      draw();
    } catch (e) { finish(undefined, e); }
  });
}
// Settings on whatever this terminal can do: the screen where it can be drawn,
// the numbered menu (settings.menu) where it cannot.
export async function openSettings({ ask, out, input = process.stdin, output = process.stdout, env = process.env, platform = process.platform, release = os.release(), proc = process, deps = {} } = {}) {
  if (!canDrawScreen({ input, output, env, platform, release })) return settingsMod.menu(ask, out);
  const color = colorMode(env, output);
  await runScreen(settingsScreen({ color, fancy: fancyGlyphs(color, env, platform), ...deps }), { input, output, proc });
  return 0;
}

// ---------- the agent's own lines ----------
export const REPL_COMMANDS = [
  ['/help', 'this list'],
  ['/status', 'engine, session, context size, plan, cache, usage'],
  ['/engine <name>', 'switch to claude, codex, openai, ollama or echo'],
  ['/permissions [mode]', 'workspace, ask or read-only'],
  ['/diff', 'the uncommitted changes'],
  ['/review', 'the engine reviews the uncommitted changes'],
  ['/undo', 'take back the last change this agent made'],
  ['/compact', 'drop older messages, keep the plan'],
  ['/sessions', 'saved sessions here (atlias resume <id>)'],
  ['/plan', "the agent's current plan"],
  ['/graph <question>', 'ask the knowledge graph'],
  ['/skills [name]', 'the skills installed here, or one in full'],
  ['/recall <query>', 'search memory and digests'],
  ['/progress [set <step>]', 'the handoff note'],
  ['/settings', 'change any option'],
  ['/hosts', 'harnesses atlias can see'],
  ['/doctor', 'harness health'],
  ['/exit', 'leave (also /quit)'],
];
export function replHelp({ width = 80, color = 'none' } = {}) {
  const w = Math.max(...REPL_COMMANDS.map(([cmd]) => cmd.length));
  return REPL_COMMANDS.map(([cmd, what]) => fitLine(`  ${accent(cmd.padEnd(w), color)}  ${dim(what, color)}`, width)).join('\n');
}
export function replPrompt(color = 'none', fancy = false) { return `${accent(glyphSet(fancy, color).pointer, color)} `; }
export function replStatus({ engine, cwd, width = 80, color = 'none' } = {}) {
  return fitLine(dim(`engine ${clean(engine)}   /help for commands   project ${clean(cwd)}   memory shared with Claude Code`, color), width);
}
