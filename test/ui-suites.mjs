// The terminal screens: the start chooser, the settings screen and the agent's
// prompt and help. Rendering and key handling are pure, so they are checked
// here at fixed sizes; runScreen is driven through fake terminal streams, and
// every write a screen makes goes to an in-memory config, never the real one.
// Loaded by test/run.mjs, which owns suite(), asyncSuite() and check().
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import readline from 'node:readline';
import * as tui from '../lib/tui.mjs';
import * as settings from '../lib/settings.mjs';

const GEV_SHIP = 'Gev, looking at the start screen: "remove the space ship, it looks super weird here".';
const GEV_CONFIG = 'Gev: "also fix config of atlias, its way to complicated and not like claude codes, simple and easy to navigate."';
const GEV_UI = 'Gev: "really just fix the whole UI and UX of that on terminal for atlias."';
const ESC = String.fromCharCode(27);

// Settings kept in memory: set() goes through parseSetting like the real one,
// reset() puts the default back, and every call is recorded.
function memorySettings(core) {
  const mem = JSON.parse(JSON.stringify(core.DEFAULTS));
  const calls = [];
  return {
    calls,
    mem,
    load: () => settings.entries(settings.rows(mem)),
    set: (id, raw) => {
      calls.push(['set', id, raw]);
      const [s, k] = String(id).split('.');
      const p = core.parseSetting(s, k, raw);
      if (p.error) return { ok: false, text: p.error };
      mem[s][k] = p.value;
      return { ok: true, text: `${id} = ${JSON.stringify(p.value)}` };
    },
    reset: (id) => {
      calls.push(['reset', id]);
      const [s, k] = String(id).split('.');
      mem[s][k] = core.DEFAULTS[s][k];
      return { ok: true, text: `${id} = ${JSON.stringify(mem[s][k])} (default)` };
    },
  };
}
// A terminal made of streams: raw mode is a flag, every write is kept.
function fakeTerm({ columns = 80, rows = 24, tty = true } = {}) {
  const input = new PassThrough();
  input.isTTY = tty;
  input.isRaw = false;
  input.rawCalls = [];
  if (tty) input.setRawMode = (v) => { input.isRaw = Boolean(v); input.rawCalls.push(Boolean(v)); return input; };
  const output = new EventEmitter();
  output.isTTY = tty;
  output.columns = columns;
  output.rows = rows;
  output.chunks = [];
  output.write = (s) => { output.chunks.push(String(s)); return true; };
  const proc = new EventEmitter();
  return { input, output, proc };
}
const KEYS = {
  up: [undefined, { name: 'up' }],
  down: [undefined, { name: 'down' }],
  pageup: [undefined, { name: 'pageup' }],
  pagedown: [undefined, { name: 'pagedown' }],
  home: [undefined, { name: 'home' }],
  end: [undefined, { name: 'end' }],
  enter: ['\r', { name: 'return' }],
  esc: [ESC, { name: 'escape' }],
  backspace: ['\u007f', { name: 'backspace' }],
  ctrlC: ['\u0003', { name: 'c', ctrl: true }],
  ctrlR: ['\u0012', { name: 'r', ctrl: true }],
};
const charKey = (c) => [c, { name: /^[a-z0-9]$/i.test(c) ? c.toLowerCase() : undefined, sequence: c }];
const keyFor = (k) => (typeof k === 'string' && k.length === 1 ? charKey(k) : KEYS[k]);
const K = (k) => tui.keyOf(...keyFor(k));
const press = (t, k) => { const [s, key] = keyFor(k); t.input.emit('keypress', s, { sequence: s, ...key }); };
const tick = () => new Promise((r) => setImmediate(r));
// A screen that never ends would leave the whole run on an unsettled await;
// after a few seconds it reads as { type: 'timeout' } and its check fails.
const within = (p, ms = 3000) => new Promise((resolve) => {
  const timer = setTimeout(() => resolve({ type: 'timeout' }), ms);
  p.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); resolve({ type: 'error', error: String(e && e.message) }); });
});
// The last frame drawn, as the lines a person would see.
const lastFrame = (t) => {
  const frames = t.output.chunks.filter((c) => c.startsWith(ESC + '[H'));
  const f = frames[frames.length - 1] || '';
  return f.split('\r\n').map((l) => l.split(ESC + '[2K').join('').split(ESC + '[H').join('').split(ESC + '[J').join(''));
};
const since = (t, mark) => t.output.chunks.slice(mark).join('');
const status = ['no extra harnesses detected on this machine', 'mode both: atlias mode sub or standalone skips this screen'];
const hasShip = (lines) => lines.some((l) => l.includes('<_') || l.includes('>==') || l.includes('\\__/'));
const allAscii = (lines) => lines.every((l) => /^[\x20-\x7e]*$/.test(l));

export default async function uiSuites({ suite, asyncSuite, check, core, ROOT, fs, path }) {
  const cfgFile = path.join(process.env.ATLIAS_HOME, 'config.json');
  const cfgBefore = fs.existsSync(cfgFile) ? fs.readFileSync(cfgFile, 'utf8') : null;

  suite('start screen expert', 'the start screen is a list that fits, with no ship', () => {
    const sizes = [40, 80, 120];
    const renders = sizes.flatMap((w) => [0, 1, 2].flatMap((sel) => ['none', 'truecolor'].map((color) => ({ w, sel, color, lines: tui.renderChooser({ sel }, { width: w, height: 24, color, status }) }))));
    const wide = renders.filter((r) => r.lines.some((l) => tui.visibleWidth(l) > r.w));
    check('every line of the chooser fits at 40, 80 and 120 columns', wide.length === 0, { happened: wide.map((r) => `${r.w} cols ${r.color}: ${r.lines.map((l) => tui.visibleWidth(l)).join(',')}`).join(' | '), why: `The descriptions ran off the right edge of the terminal. ${GEV_UI}`, fix: 'renderChooser passes every line through fitLine(line, width).' });
    check('the chooser draws no ship', renders.every((r) => !hasShip(r.lines)), { happened: renders.filter((r) => hasShip(r.lines)).map((r) => r.lines.join('\n')).slice(0, 1).join(''), why: GEV_SHIP, fix: 'The banner is logo() with the SHIP rows gone.' });
    const at80 = tui.renderChooser({ sel: 0 }, { width: 79, height: 24, color: 'none', status });
    check('it lists sub-harness, regular agent and settings as 1, 2 and 3', ['[1] sub-harness', '[2] regular agent', '[3] settings'].every((s) => at80.some((l) => l.includes(s))), { happened: at80.join('\n'), why: 'The three ways in are the whole screen.', fix: 'Check CHOOSER_ITEMS.' });
    const marked = at80.filter((l) => /^\s*> \[\d\]/.test(l));
    check('the highlighted item is marked and the others are not', marked.length === 1 && marked[0].includes('[1] sub-harness'), { happened: marked.join(' | ') || '(nothing marked)', why: 'A list you move through has to show where you are.', fix: 'renderChooser puts the pointer on state.sel only.' });
    const second = tui.renderChooser({ sel: 1 }, { width: 200, height: 24, color: 'none', status });
    const about = (id) => tui.CHOOSER_ITEMS.find((i) => i.id === id).about;
    check('only the highlighted item has its description shown', second.some((l) => l.includes(about('agent'))) && !second.some((l) => l.includes(about('sub'))) && !second.some((l) => l.includes(about('settings'))), { happened: second.join('\n'), why: 'One short line for the item under the pointer keeps the screen quiet.', fix: 'desc in renderChooser is CHOOSER_ITEMS[sel].about.' });
    check('the footer states the keys', at80.some((l) => /move/.test(l) && /1-3 jump/.test(l) && /enter open/.test(l) && /q quit/.test(l)), { happened: at80.slice(-2).join(' | '), why: 'Keys nobody is told about are keys nobody uses.', fix: 'Keep the footer in renderChooser.' });
    check('with NO_COLOR the chooser has no escape codes and only ASCII of its own', !at80.join('\n').includes(ESC) && allAscii(at80.slice(8)), { happened: JSON.stringify(at80.slice(8)), why: 'NO_COLOR and a pipe must get plain text.', fix: 'Colour goes through logo.mjs, which passes text through in mode none, and the pointer is > without colour.' });
    const shortOnes = [18, 12, 6, 3, 2, 1].map((h) => ({ h, lines: tui.renderChooser({ sel: 2 }, { width: 79, height: h, color: 'none', status }) }));
    check('a short terminal keeps the list and never gets more lines than it has', shortOnes.every((r) => r.lines.length <= r.h && r.lines.some((l) => l.includes('[3] settings'))) && tui.renderChooser({ sel: 0 }, { width: 79, height: 0 }).length === 0, { happened: shortOnes.map((r) => `${r.h}: ${r.lines.length}`).join(', '), why: 'A screen taller than the terminal scrolls its own top away.', fix: 'renderChooser drops the banner, status, gaps, description and footer in turn.' });
    let s = { sel: 0 };
    const steps = [];
    for (const k of ['down', 'down', 'down', 'up', 'k', 'j', '1', '3']) { s = tui.chooserReduce(s, K(k)).state; steps.push(s.sel); }
    check('up/down and j/k move, stopping at the ends, and 1-3 jump', steps.join(',') === '1,2,2,1,0,1,0,2', { happened: steps.join(','), why: 'The keys the footer names have to do what it says.', fix: 'Check chooserReduce.' });
    const open = tui.chooserReduce({ sel: 1 }, K('enter'));
    const quits = ['q', 'esc', 'ctrlC'].map((k) => tui.chooserReduce({ sel: 0 }, K(k)).action);
    check('enter opens the highlighted item and q, esc and ctrl+c quit', open.action && open.action.type === 'open' && open.action.id === 'agent' && quits.every((a) => a && a.type === 'quit') && !tui.chooserReduce({ sel: 0 }, K('3')).action, { happened: JSON.stringify({ open: open.action, quits }), why: 'A digit only moves; enter is the one key that commits.', fix: 'Check chooserReduce.' });
    const numbered = tui.renderChooser({ sel: 0 }, { width: 79, height: Infinity, color: 'none', status, numbered: true });
    check('without a keypress terminal every item shows its description and no pointer', ['sub', 'agent', 'settings'].every((id) => numbered.some((l) => l.includes(about(id).slice(0, 20)))) && !numbered.some((l) => /^\s*> /.test(l)) && numbered.every((l) => tui.visibleWidth(l) <= 79), { happened: numbered.join('\n'), why: 'The numbered question needs every choice explained, still within the width.', fix: 'renderChooser with numbered: true.' });
  });

  suite('settings screen expert', 'settings read like Claude Code\'s config', () => {
    const list = settings.entries();
    const rows = settings.rows();
    const ids = list.map((e) => e.id);
    check('every setting is on the screen exactly once', ids.length === rows.length && new Set(ids).size === ids.length && rows.every((r) => ids.includes(r.id)), { happened: `${ids.length} entries for ${rows.length} settings`, why: 'A setting the screen does not show can only be changed by hand.', fix: 'entries() places every row, listed in GROUPS or not.' });
    const top = list.slice(0, 10).map((e) => e.label).join(', ');
    check('the most-used settings come first', top === 'Mode, Engine, Permissions, Sandbox, Ollama model, Ollama URL, OpenAI model, OpenAI URL, Test command, Show usage', { happened: top, why: GEV_CONFIG, fix: 'The first group of GROUPS in lib/settings.mjs.' });
    const groups = list.map((e) => e.group).filter((g, i, a) => a.indexOf(g) === i);
    check('the rest are grouped under short headers, flags last under Experimental', groups.join('|') === '|Checks|Guards|Knowledge graph|Brief and memory|Agent limits|Experimental' && list.filter((e) => e.section === 'flags').every((e) => e.group === 'Experimental') && list.slice(-list.filter((e) => e.section === 'flags').length).every((e) => e.section === 'flags'), { happened: groups.join('|'), why: 'Forty-nine keys in one list is what made config hard to navigate.', fix: 'Add a new key to GROUPS and LABELS in lib/settings.mjs.' });
    const unlabelled = list.filter((e) => !settings.LABELS[e.id] || e.group === 'Other').map((e) => e.id);
    check('every setting has a readable label and a group', unlabelled.length === 0, { happened: unlabelled.join(', '), why: 'agent.ollamaNumPredict is a key, not a label.', fix: 'Add it to LABELS and GROUPS in lib/settings.mjs.' });
    const fake = settings.entries([...settings.rows(), { id: 'zeta.newThing', section: 'zeta', key: 'newThing', value: 1, def: 1, changed: false, choices: null, about: '', env: '' }, { id: 'flags.brandNew', section: 'flags', key: 'brandNew', value: false, def: false, changed: false, choices: [true, false], about: '', env: 'ATLIAS_FLAG_BRAND_NEW' }]);
    check('a setting nobody labelled still shows, under Other, with flags kept last', fake.some((e) => e.id === 'zeta.newThing' && e.group === 'Other' && e.label === 'New thing') && fake[fake.length - 1].id === 'flags.brandNew' && fake[fake.length - 1].group === 'Experimental', { happened: fake.slice(-5).map((e) => `${e.id}:${e.group}:${e.label}`).join(', '), why: 'A new setting must never be hidden by a list that forgot it.', fix: 'entries() puts unplaced rows in Other, and unplaced flags in Experimental after it.' });

    const base = { query: '', sel: 0, scroll: 0, edit: null, message: null };
    const long = { ...base, sel: 7, message: { ok: false, text: 'agent.maxToolRounds is a number; got "lots"' } };
    const editing = { ...base, sel: 4, edit: { id: 'agent.ollamaModel', label: 'Ollama model', now: 'gemma3:4b', buffer: 'x'.repeat(300) } };
    const mem = memorySettings(core);
    mem.mem.agent.openaiUrl = 'https://' + 'very-long-host.'.repeat(20) + 'example/v1';
    mem.mem.verify.syntax = false;
    const memList = mem.load();
    const states = [base, long, editing, { ...base, query: 'ollama' }, { ...base, query: 'nothing matches this' }, { ...base, sel: 999 }];
    const bad = [];
    for (const w of [40, 80, 120]) for (const h of [24, 10]) for (const color of ['none', 'truecolor']) for (const st of states) {
      const lines = tui.renderSettings(st, memList, { width: w, height: h, color, fancy: true });
      if (lines.some((l) => tui.visibleWidth(l) > w) || lines.length > h) bad.push(`${w}x${h} ${color} ${JSON.stringify(st).slice(0, 40)}: ${lines.map((l) => tui.visibleWidth(l)).join(',')}`);
    }
    check('settings never draw past the width or the height, at 40, 80 and 120 columns', bad.length === 0, { happened: bad.slice(0, 3).join(' | '), why: `A line that wraps breaks every row under it. ${GEV_UI}`, fix: 'renderSettings passes every line through fitLine and cuts the value, then the label.' });
    const plain = tui.renderSettings(base, memList, { width: 79, height: 24, color: 'none' });
    const markedRows = plain.filter((l) => l.startsWith('> '));
    const afterDown = tui.renderSettings(tui.settingsReduce(base, K('down'), memList).state, memList, { width: 79, height: 24, color: 'none' }).filter((l) => l.startsWith('> '));
    check('the selected row is marked, and only that one', markedRows.length === 1 && /^> Mode\s+both$/.test(markedRows[0]) && afterDown.length === 1 && /^> Engine\s+auto$/.test(afterDown[0]), { happened: JSON.stringify({ first: markedRows, afterDown }), why: 'A list you move through has to show where you are.', fix: 'rowLine puts the pointer on the selected row only.' });
    const syntaxRow = tui.renderSettings({ ...base, query: 'syntax' }, memList, { width: 79, height: 24, color: 'none' }).find((l) => /Syntax check/.test(l));
    const syntaxColour = tui.renderSettings({ ...base, query: 'syntax' }, memList, { width: 79, height: 24, color: 'truecolor' }).find((l) => /Syntax check/.test(l));
    check('a changed value is marked: accent colour, or a * without colour', /\* false$/.test(syntaxRow || '') && /38;2;96;165;250m(\* )?false/.test(syntaxColour || '') && !/\*/.test(syntaxColour || ''), { happened: JSON.stringify({ syntaxRow, syntaxColour }), why: 'What differs from the default is what someone looks for first.', fix: 'rowLine: accent() on a changed value, and "* " before it in mode none.' });
    check('with NO_COLOR the settings screen has no escape codes and is plain ASCII', states.every((st) => { const l = tui.renderSettings(st, memList, { width: 80, height: 24, color: 'none', fancy: true }); return !l.join('\n').includes(ESC) && allAscii(l); }), { happened: JSON.stringify(tui.renderSettings(editing, memList, { width: 80, height: 24, color: 'none', fancy: true }).slice(-3)), why: 'NO_COLOR and a terminal that cannot show the arrows must still read cleanly.', fix: 'glyphSet gives ASCII when color is none; the cursor is _ there.' });

    // The reducer checks run on an in-memory config, so what other suites left
    // in the test config.json cannot move them.
    const fresh = memorySettings(core).load();
    let q = base;
    for (const c of 'ollama') q = tui.settingsReduce(q, K(c), fresh).state;
    const found = tui.filterEntries(fresh, q.query).map((e) => e.id);
    check('typing filters by label, key and description', q.query === 'ollama' && found.includes('agent.ollamaModel') && found.includes('agent.ollamaUrl') && !found.includes('agent.mode') && found.includes('agent.engine') && tui.filterEntries(list, 'loopWindow').map((e) => e.id).join() === 'guard.loopWindow' && tui.filterEntries(list, 'destructive commands').some((e) => e.id === 'guard.destructive') && tui.filterEntries(list, 'ATLIAS_FLAG_LEAN').map((e) => e.id).join() === 'flags.leanBrief', { happened: JSON.stringify({ query: q.query, found }), why: GEV_CONFIG, fix: 'filterEntries matches every word against label, id, about and env.' });
    const none = { ...base, query: 'nothing matches this' };
    const noneLines = tui.renderSettings(none, list, { width: 79, height: 24, color: 'none' });
    check('a search with no match says so, and enter and reset do nothing', noneLines.some((l) => l.includes('no setting matches "nothing matches this"')) && noneLines[0].endsWith('0/0') && !tui.settingsReduce(none, K('enter'), list).action && !tui.settingsReduce(none, K('ctrlR'), list).action, { happened: noneLines.slice(0, 5).join(' | '), why: 'An empty list must not act on a row nobody can see.', fix: 'settingsReduce returns no action when nothing is shown.' });
    const typedQ = tui.settingsReduce(base, K('q'), list);
    const qInQuery = tui.settingsReduce({ ...base, query: 'x' }, K('q'), list);
    const escClears = tui.settingsReduce({ ...base, query: 'x' }, K('esc'), list);
    const escBack = tui.settingsReduce(base, K('esc'), list);
    const bs = tui.settingsReduce({ ...base, query: 'ab' }, K('backspace'), list);
    check('q and esc go back, esc clears a search first, and q types once a search has begun', typedQ.action && typedQ.action.type === 'back' && !qInQuery.action && qInQuery.state.query === 'xq' && !escClears.action && escClears.state.query === '' && escBack.action && escBack.action.type === 'back' && bs.state.query === 'a' && tui.settingsReduce(base, K('ctrlC'), list).action.type === 'quit', { happened: JSON.stringify({ typedQ: typedQ.action, qInQuery: qInQuery.state.query, escClears: escClears.state.query, escBack: escBack.action }), why: 'Leaving has to be one key, and searching for "query" must not leave.', fix: 'Check the escape and q branches of settingsReduce.' });

    const sandboxAt = fresh.findIndex((e) => e.id === 'agent.sandbox');
    const toggle = tui.settingsReduce({ ...base, sel: sandboxAt }, K('enter'), fresh);
    const cycle = tui.settingsReduce({ ...base, sel: 0 }, K('enter'), fresh);
    const edit = tui.settingsReduce({ ...base, sel: fresh.findIndex((e) => e.id === 'agent.ollamaModel') }, K('enter'), fresh);
    check('enter toggles a switch, moves a choice on, and opens an edit line on a free value', toggle.action && toggle.action.type === 'set' && toggle.action.id === 'agent.sandbox' && toggle.action.raw === 'true' && cycle.action && cycle.action.id === 'agent.mode' && cycle.action.raw === 'sub' && !edit.action && edit.state.edit && edit.state.edit.id === 'agent.ollamaModel' && edit.state.edit.buffer === '', { happened: JSON.stringify({ toggle: toggle.action, cycle: cycle.action, edit: edit.state.edit }), why: 'A switch should not ask for the word false, and nobody should have to spell a mode.', fix: 'Check the enter branch of settingsReduce.' });
    const reset = tui.settingsReduce({ ...base, sel: 3 }, K('ctrlR'), fresh);
    check('ctrl+r resets the selected setting, and the footer says so', reset.action && reset.action.type === 'reset' && reset.action.id === fresh[3].id && plain.some((l) => /ctrl\+r reset/.test(l)), { happened: JSON.stringify(reset.action), why: 'Undo has to be as easy as the change, and discoverable.', fix: 'The ctrl+r branch of settingsReduce and the footer in renderSettings.' });

    const tm = memorySettings(core);
    const tall = tm.load();
    const walker = tui.settingsScreen({ load: tm.load, set: tm.set, reset: tm.reset });
    const small = { width: 79, height: 12 };
    const seen = [];
    const onScreen = () => { const lines = walker.render(small); return lines.length <= 12 && lines.filter((l) => l.startsWith('> ')).length === 1 && lines.some((l) => l.startsWith('> ' + tall[walker.state.sel].label)); };
    for (let i = 0; i < tall.length + 3; i++) { walker.key(K('down'), small); seen.push(onScreen()); }
    const atEnd = walker.state.sel;
    for (let i = 0; i < tall.length + 3; i++) { walker.key(K('up'), small); seen.push(onScreen()); }
    check('the view scrolls to keep the selected row on screen, stopping at both ends', seen.every(Boolean) && atEnd === tall.length - 1 && walker.state.sel === 0 && walker.state.scroll === 0, { happened: JSON.stringify({ lost: seen.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0).slice(0, 5), atEnd, back: walker.state.sel, scroll: walker.state.scroll }), why: 'A selection that walks off the screen is a list you cannot see.', fix: 'settle() in lib/tui.mjs keeps the selected row inside [scroll, scroll + listH).' });
    const lay24 = tui.settingsLayout(base, tall, { height: 24 });
    const lay10 = tui.settingsLayout(base, tall, { height: 10 });
    const layEnd = tui.settingsLayout({ ...base, sel: tall.length - 1 }, tall, { height: 24 });
    check('the list gets what the title, search, description and footer leave, and the last row scrolls to the bottom', lay24.listH === 15 && lay24.parts.desc === 3 && lay10.parts.gapTop === 0 && lay10.parts.gapBottom === 0 && lay10.listH === 3 && layEnd.selFlat === layEnd.flat.length - 1 && layEnd.scroll + layEnd.listH === layEnd.flat.length, { happened: JSON.stringify({ h24: [lay24.listH, lay24.parts], h10: [lay10.listH, lay10.parts], end: [layEnd.scroll, layEnd.listH, layEnd.flat.length] }), why: 'At 24 rows nine lines are fixed and the list gets fifteen; a short terminal gives up gaps before rows.', fix: 'Check the parts and the drop order in settingsLayout.' });
    const end = tui.settingsReduce(base, K('end'), tall).state;
    const pg = tui.settingsReduce(base, K('pagedown'), tall, { page: 5 }).state;
    const home = tui.settingsReduce(end, K('home'), tall).state;
    const endLines = tui.renderSettings(end, tall, { width: 79, height: 12, color: 'none' });
    check('End, Home and PgDn jump, and End shows the last row', end.sel === tall.length - 1 && endLines.some((l) => l.startsWith('> ' + tall[tall.length - 1].label)) && pg.sel === 5 && home.sel === 0 && tui.settingsReduce(pg, K('pageup'), tall, { page: 5 }).state.sel === 0, { happened: JSON.stringify({ end: end.sel, pg: pg.sel, home: home.sel }), why: 'Forty-nine rows need more than one step at a time.', fix: 'Check the home, end, pageup and pagedown branches.' });
    const tiny = [0, 1, 2, 3, 5, 8].map((h) => ({ h, lines: tui.renderSettings(base, tall, { width: 79, height: h, color: 'none' }), editLines: tui.renderSettings(editing, tall, { width: 79, height: h, color: 'none' }) }));
    check('a terminal of any height, zero included, gets no more lines than it has', tiny.every((r) => r.lines.length <= r.h && r.editLines.length <= r.h) && tiny[0].lines.length === 0 && tiny[1].editLines.some((l) => l.startsWith('Ollama model: ')) && tiny[3].lines.some((l) => l.startsWith('> Mode')), { happened: tiny.map((r) => `${r.h}: ${r.lines.length}/${r.editLines.length}`).join(', '), why: 'A screen taller than the terminal scrolls its own top away; the line being typed must stay.', fix: 'settingsLayout gives up the gaps, description, title, footer and search in turn, never the edit line.' });
    const bare = [{ id: 'x.y', section: 'x', key: 'y', label: 'Undescribed', group: '', value: 'v', def: 'v', changed: false, choices: null, about: '', env: '' }];
    let bareLines = [];
    try { bareLines = tui.renderSettings(base, bare, { width: 79, height: 24, color: 'none' }); } catch (e) { bareLines = [String(e)]; }
    check('a setting with no description still draws, and says it has none', bareLines.some((l) => /No description yet/.test(l)) && bareLines.some((l) => l.startsWith('> Undescribed')), { happened: bareLines.join(' | '), why: 'A missing sentence must not crash the screen or leave it blank.', fix: 'describe() falls back to "No description yet."' });
    const dirty = memorySettings(core);
    dirty.mem.agent.ollamaModel = 'a\r\nb' + ESC + '[31mred';
    const dirtyLines = tui.renderSettings({ ...base, sel: 4 }, dirty.load(), { width: 79, height: 24, color: 'none' });
    check('a value holding CR, LF or an escape cannot break a line or colour the screen', dirtyLines.every((l) => !/[\r\n]/.test(l) && !l.includes(ESC)) && dirtyLines.some((l) => /a {2}b \[31mred/.test(l)), { happened: JSON.stringify(dirtyLines.filter((l) => /Ollama model/.test(l))), why: 'config.json is edited by hand, often with CRLF editors on Windows.', fix: 'displayValue passes values through clean().' });
  });

  suite('settings screen expert', 'enter, esc and ctrl+r go through set and reset', () => {
    const m = memorySettings(core);
    const scr = tui.settingsScreen({ load: m.load, set: m.set, reset: m.reset });
    const dims = { width: 79, height: 24 };
    const run = (keys) => { for (const k of keys) scr.key(K(k), dims); return scr.render(dims); };
    run(['down', 'down', 'down', 'enter']);
    check('enter on a switch saves it at once through set()', m.calls.length === 1 && m.calls[0].join() === 'set,agent.sandbox,true' && m.mem.agent.sandbox === true && scr.render(dims).some((l) => /saved: agent\.sandbox = true/.test(l)), { happened: JSON.stringify(m.calls), why: 'Changes save at once, through the one path that validates them.', fix: 'settingsScreen calls set(id, raw) for a set action and reloads the list.' });
    run(['home', 'enter', 'enter', 'enter']);
    check('enter on Mode cycles both, sub, standalone and back', m.calls.slice(1).map((c) => c[2]).join() === 'sub,standalone,both' && m.mem.agent.mode === 'both', { happened: JSON.stringify(m.calls.slice(1)), why: 'Nobody should have to remember the spelling of a mode.', fix: 'The choices branch of settingsReduce moves to the next of e.choices.' });
    const n0 = m.calls.length;
    let lines = run(['down', 'down', 'down', 'down', 'enter', 'q', 'w', 'e', 'n', 'esc']);
    check('esc on the edit line cancels and writes nothing', m.calls.length === n0 && m.mem.agent.ollamaModel === core.DEFAULTS.agent.ollamaModel && !scr.state.edit && lines.some((l) => /Ollama model unchanged/.test(l)), { happened: JSON.stringify({ calls: m.calls.slice(n0), edit: scr.state.edit }), why: 'Esc is the way out of a mistake; a cancel that saves is worse than none.', fix: 'The escape branch of the edit line clears state.edit and returns no action.' });
    run(['enter', 'enter']);
    check('enter on an empty edit line keeps the old value', m.calls.length === n0 && m.mem.agent.ollamaModel === core.DEFAULTS.agent.ollamaModel, { happened: JSON.stringify(m.calls.slice(n0)), why: 'Opening the line by mistake must cost nothing.', fix: 'An empty buffer returns no action.' });
    lines = run(['enter', 'q', 'w', 'e', 'n', '3', ':', '8', 'b', 'backspace', 'b', 'enter']);
    check('typing a value and enter saves exactly what was typed', m.calls.length === n0 + 1 && m.calls[n0].join() === 'set,agent.ollamaModel,qwen3:8b' && m.mem.agent.ollamaModel === 'qwen3:8b' && lines.some((l) => /saved: agent\.ollamaModel = "qwen3:8b"/.test(l)), { happened: JSON.stringify(m.calls.slice(n0)), why: 'The edit line is the only way to set a model name here.', fix: 'Check the edit branch of settingsReduce.' });
    scr.key(K('ctrlR'), dims);
    check('ctrl+r calls reset() for the selected setting', m.calls[m.calls.length - 1].join() === 'reset,agent.ollamaModel' && m.mem.agent.ollamaModel === core.DEFAULTS.agent.ollamaModel, { happened: JSON.stringify(m.calls.slice(-1)), why: 'The reset key has to put the default back through the same path atlias config uses.', fix: 'settingsScreen calls reset(id) for a reset action.' });
    const typed = tui.settingsScreen({ load: m.load, set: m.set, reset: m.reset });
    for (const k of ['m', 'a', 'x', 't', 'o', 'o', 'l', 'r', 'enter', 'l', 'o', 't', 's', 'enter']) typed.key(K(k), dims);
    const refused = typed.render(dims);
    check('a value set() refuses is shown with the reason and not saved', refused.some((l) => /not saved: agent\.maxToolRounds is a number/.test(l)) && m.mem.agent.maxToolRounds === core.DEFAULTS.agent.maxToolRounds, { happened: refused.filter((l) => /saved/.test(l)).join(' | ') || refused.join(' | '), why: 'The screen must refuse exactly what atlias config set refuses, and say why.', fix: 'Show res.text when res.ok is false.' });
    const throwing = tui.settingsScreen({ load: m.load, set: () => { throw new Error('ENOSPC: no space left on device'); }, reset: m.reset });
    for (const k of ['down', 'down', 'down', 'enter']) throwing.key(K(k), dims);
    check('a write that throws (a full disk) is shown as not saved, not a crash', throwing.render(dims).some((l) => /not saved: ENOSPC/.test(l)), { happened: throwing.render(dims).slice(-3).join(' | '), why: 'C: filling up is a real case on this machine; the screen must say so and stay up.', fix: 'settingsScreen catches around set() and reset().' });
    const now = fs.existsSync(cfgFile) ? fs.readFileSync(cfgFile, 'utf8') : null;
    check('none of this touched the real config.json', now === cfgBefore, { happened: String(now).slice(0, 200), why: 'The tests drive fakes; a test that writes the user\'s settings is a bug.', fix: 'Pass load, set and reset from memorySettings.' });
  });

  await asyncSuite('terminal expert', 'the screen always gives the terminal back', async () => {
    const restoredIn = (t, mark) => { const s = since(t, mark); return s.includes(ESC + '[?25h') && s.includes(ESC + '[?1049l'); };
    const quiet = (m = memorySettings(core)) => tui.settingsScreen({ load: m.load, set: m.set, reset: m.reset });
    let t = fakeTerm();
    let p = tui.runScreen(quiet(), t);
    const upNow = t.input.isRaw && since(t, 0).includes(ESC + '[?1049h') && since(t, 0).includes(ESC + '[?25l');
    let mark = t.output.chunks.length;
    press(t, 'q');
    let r = await within(p);
    check('the screen takes the alternate screen, hides the cursor and sets raw mode, and q gives all three back', upNow && r && r.type === 'back' && !t.input.isRaw && restoredIn(t, mark) && t.input.readableFlowing !== true && t.proc.listenerCount('SIGINT') === 0 && t.proc.listenerCount('exit') === 0, { happened: JSON.stringify({ upNow, r, raw: t.input.isRaw, flowing: t.input.readableFlowing, tailWrites: since(t, mark).slice(-40) }), why: 'A terminal left in raw mode with no cursor is broken until it is closed.', fix: 'runScreen restore() puts raw mode, the cursor and the main screen back, and pauses stdin again.' });
    t = fakeTerm();
    p = tui.runScreen(quiet(), t);
    mark = t.output.chunks.length;
    press(t, 'ctrlC');
    r = await within(p);
    check('ctrl+c leaves and restores', r && r.type === 'quit' && !t.input.isRaw && restoredIn(t, mark), { happened: JSON.stringify(r), why: 'Raw mode turns ctrl+c into a key; it still has to get people out.', fix: 'settingsReduce answers ctrl+c with quit.' });
    t = fakeTerm();
    p = tui.runScreen(quiet(), t);
    mark = t.output.chunks.length;
    t.proc.emit('SIGINT');
    r = await within(p);
    check('a SIGINT from outside leaves and restores', r && r.type === 'quit' && r.signal === 'SIGINT' && !t.input.isRaw && restoredIn(t, mark), { happened: JSON.stringify(r), why: 'kill -INT must not leave the terminal raw.', fix: 'runScreen listens for SIGINT while the screen is up.' });
    t = fakeTerm();
    let draws = 0;
    p = tui.runScreen({ render: () => { if (++draws > 1) throw new Error('render broke'); return ['x']; }, key: () => undefined }, t);
    mark = t.output.chunks.length;
    press(t, 'a');
    const err = await within(p.then(() => 'resolved', (e) => e.message));
    check('an exception in the screen restores the terminal before it surfaces', err === 'render broke' && !t.input.isRaw && restoredIn(t, mark) && t.input.listenerCount('keypress') === 0, { happened: JSON.stringify({ err, raw: t.input.isRaw }), why: 'The error has to be printed on the main screen, where it can be read, with the terminal usable.', fix: 'onKey catches and finishes with the error; finish() restores first.' });
    t = fakeTerm();
    t.input.setRawMode = () => { throw new Error('EIO: raw mode refused'); };
    const rawErr = await within(tui.runScreen(quiet(), t).then(() => 'resolved', (e) => e.message));
    check('a terminal that refuses raw mode gets an error and its screen left alone', rawErr === 'EIO: raw mode refused' && !t.output.chunks.join('').includes(ESC + '[2J') && t.input.listenerCount('keypress') === 0, { happened: JSON.stringify({ rawErr, writes: t.output.chunks }), why: 'Clearing a screen that was never taken over erases what the user was reading.', fix: 'runScreen writes the leave sequence only after it entered the alternate screen.' });
    for (const ev of ['exit', 'uncaughtExceptionMonitor']) {
      t = fakeTerm();
      tui.runScreen(quiet(), t);
      mark = t.output.chunks.length;
      t.proc.emit(ev, new Error('elsewhere'));
      check(`${ev === 'exit' ? 'exiting' : 'an uncaught exception elsewhere'} while the screen is up restores the terminal`, !t.input.isRaw && restoredIn(t, mark), { happened: since(t, mark).slice(-40), why: 'A crash outside the screen must still leave a usable terminal, and its message on the main screen.', fix: `runScreen listens for ${ev}.` });
    }
    t = fakeTerm({ columns: 100 });
    p = tui.runScreen(quiet(), t);
    t.output.columns = 50;
    t.output.emit('resize');
    const resized = lastFrame(t);
    press(t, 'q');
    await within(p);
    check('a resize redraws at the new width', resized.every((l) => tui.visibleWidth(l) <= 49) && resized.some((l) => tui.visibleWidth(l) === 49) && !t.input.isRaw, { happened: resized.map((l) => tui.visibleWidth(l)).join(','), why: 'Dragging the window narrower must not leave lines wrapping.', fix: 'runScreen redraws on the output\'s resize event.' });

    // The agent's own readline is already on the input: none of the screen's
    // keys may reach it, and it has to work again afterwards.
    t = fakeTerm();
    const rl = readline.createInterface({ input: t.input, output: t.output, terminal: true });
    const rlResize = t.output.listenerCount('resize');
    const m = memorySettings(core);
    p = tui.openSettings({ ask: async () => 'q', out: () => {}, input: t.input, output: t.output, env: {}, platform: 'linux', proc: t.proc, deps: { load: m.load, set: m.set, reset: m.reset } });
    const drewScreen = since(t, 0).includes(ESC + '[?1049h');
    t.input.write('ab');
    await tick();
    press(t, 'esc');
    press(t, 'esc');
    const code = await within(p);
    const lineDuring = rl.line;
    press(t, 'z');
    const lineAfter = rl.line;
    check('keys on the screen never reach the agent\'s readline, which works again after', drewScreen && code === 0 && lineDuring === '' && lineAfter === 'z' && t.input.isRaw === true && t.output.listenerCount('resize') === rlResize && t.input.listenerCount('keypress') === 1, { happened: JSON.stringify({ drewScreen, code, lineDuring, lineAfter, raw: t.input.isRaw, resize: t.output.listenerCount('resize'), keypress: t.input.listenerCount('keypress') }), why: 'Both listening at once doubles every key: the search would be typed into the prompt too.', fix: 'runScreen takes the keypress and resize listeners off while it runs and puts them back.' });
    rl.close();

    t = fakeTerm();
    const m2 = memorySettings(core);
    p = tui.runScreen(tui.settingsScreen({ load: m2.load, set: m2.set, reset: m2.reset }), t);
    t.input.write(ESC + '[B' + ESC + '[B' + ESC + '[B');
    await tick();
    t.input.write('\r\n');
    await tick();
    press(t, 'q');
    await within(p);
    check('arrow keys arrive as bytes, and a pasted CRLF is one enter', m2.calls.length === 1 && m2.calls[0].join() === 'set,agent.sandbox,true', { happened: JSON.stringify(m2.calls), why: 'Two enters would toggle the switch on and straight back off.', fix: 'runScreen drops an enter that directly follows a return.' });

    const nonTty = fakeTerm({ tty: false });
    const asked = [];
    const said = [];
    const menuCode = await within(tui.openSettings({ ask: async (qq) => { asked.push(qq); return 'q'; }, out: (s) => said.push(s), input: nonTty.input, output: nonTty.output, env: {}, platform: 'linux' }));
    check('without a terminal, settings fall back to the numbered menu', menuCode === 0 && asked.some((qq) => /number to change/.test(qq)) && /^ 1 {2}verify\.syntax/m.test(said.join('\n')) && nonTty.output.chunks.length === 0, { happened: JSON.stringify({ asked, said: said.join('\n').slice(0, 80) }), why: 'A pipe or a log cannot take raw keys; the numbered menu is what works there, and what the older tests drive.', fix: 'openSettings calls settings.menu(ask, out) when canDrawScreen is false.' });
    const tty = fakeTerm();
    const can = (o) => tui.canDrawScreen({ input: tty.input, output: tty.output, env: {}, platform: 'linux', release: '6.0.0', ...o });
    check('a screen is drawn only where it can be', can({}) && can({ platform: 'win32', release: '10.0.26100' }) && !can({ input: nonTty.input }) && !can({ output: nonTty.output }) && !can({ env: { TERM: 'dumb' } }) && !can({ platform: 'win32', release: '6.3.9600' }), { happened: JSON.stringify({ linux: can({}), win11: can({ platform: 'win32', release: '10.0.26100' }), win81: can({ platform: 'win32', release: '6.3.9600' }) }), why: 'A Windows console without VT support prints the escape codes as text.', fix: 'canDrawScreen checks both ends, TERM and the Windows build.' });
    check('the arrows and pointer are ASCII unless the terminal is known to show them', !tui.fancyGlyphs('none', { WT_SESSION: '1' }, 'win32') && !tui.fancyGlyphs('basic', {}, 'win32') && tui.fancyGlyphs('truecolor', { WT_SESSION: '1' }, 'win32') && tui.fancyGlyphs('basic', {}, 'darwin'), { happened: 'fancyGlyphs mismatch', why: 'The old Windows console draws a box for the pointer character.', fix: 'Check fancyGlyphs.' });

    t = fakeTerm();
    const m3 = memorySettings(core);
    const flow = tui.chooserScreen({ status: () => status, settings: { load: m3.load, set: m3.set, reset: m3.reset } });
    p = tui.runScreen(flow, t);
    press(t, 'down'); press(t, 'down'); press(t, 'enter');
    const inSettings = flow.inSettings && lastFrame(t)[0].startsWith('Settings');
    press(t, 'esc');
    const backHome = !flow.inSettings && lastFrame(t).some((l) => l.includes('[1] sub-harness'));
    press(t, '2'); press(t, 'enter');
    r = await within(p);
    check('settings open inside the start screen, esc comes back, and enter on an item returns it', inSettings && backHome && r && r.type === 'open' && r.id === 'agent' && !t.input.isRaw && m3.calls.length === 0, { happened: JSON.stringify({ inSettings, backHome, r }), why: 'The chooser\'s third item is the settings screen; going back should land on the list, not leave atlias.', fix: 'chooserScreen holds a settingsScreen while it is open.' });
    check('keyOf reads readline\'s keys the way the screens expect', tui.keyOf('\r', { name: 'return' }).name === 'return' && tui.keyOf('q', { name: 'q' }).ch === 'q' && tui.keyOf('.', {}).ch === '.' && tui.keyOf('\u0003', { name: 'c', ctrl: true }).ch === '' && tui.keyOf(ESC, { name: 'escape' }).ch === '' && tui.keyOf(undefined, { name: 'up' }).name === 'up', { happened: JSON.stringify([tui.keyOf('\r', { name: 'return' }), tui.keyOf('.', {})]), why: 'A control key read as a typed character would land in the search.', fix: 'Check keyOf.' });
  });

  suite('agent surface expert', 'the agent\'s prompt, status line and help fit', () => {
    const src = fs.readFileSync(path.join(ROOT, 'lib', 'agent.mjs'), 'utf8');
    const handled = [...new Set([...src.matchAll(/t === '(\/[a-z]+)'|t\.startsWith\('(\/[a-z]+)/g)].map((mm) => mm[1] || mm[2]))];
    const help = tui.replHelp({ width: 200, color: 'none' });
    const missing = handled.filter((cmd) => !help.includes(cmd));
    check('/help names every command the agent handles', handled.length >= 15 && missing.length === 0, { happened: `handled ${handled.join(' ')}; missing ${missing.join(' ') || 'none'}`, why: 'A command nobody can discover does not exist.', fix: 'Add it to REPL_COMMANDS in lib/tui.mjs.' });
    const lines = help.split('\n');
    const starts = lines.map((l) => { const m = /^ {2}\S+(?: \S+)*? {2,}\S/.exec(l); return m ? m[0].length - 1 : -1; });
    check('/help is aligned: every description starts in the same column', lines.length === tui.REPL_COMMANDS.length && starts.every((s) => s > 0 && s === starts[0]), { happened: starts.join(','), why: 'A ragged list is hard to scan; the old one mixed two alignments.', fix: 'replHelp pads every command to the longest.' });
    const narrow = [40, 80].map((w) => tui.replHelp({ width: w, color: 'truecolor' }).split('\n').concat(tui.replStatus({ engine: 'ollama', cwd: 'D:/a/very/long/project/path/that/goes/on/and/on/and/on', width: w, color: 'truecolor' })).every((l) => tui.visibleWidth(l) <= w));
    check('the help and the status line fit 40 and 80 columns', narrow.every(Boolean), { happened: JSON.stringify(narrow), why: GEV_UI, fix: 'replHelp and replStatus pass lines through fitLine.' });
    check('the status line names the engine and /help first', /^engine ollama {3}\/help for commands/.test(tui.replStatus({ engine: 'ollama', cwd: 'D:/p', width: 80 })), { happened: tui.replStatus({ engine: 'ollama', cwd: 'D:/p', width: 80 }), why: 'A long project path used to push /help off the end of the line.', fix: 'Keep the project last in replStatus.' });
    check('the prompt is the list pointer: > without colour, the arrowhead where it shows', tui.replPrompt('none', true) === '> ' && tui.replPrompt('truecolor', true).includes('\u276f') && tui.replPrompt('basic', false).includes('>'), { happened: JSON.stringify([tui.replPrompt('none', true), tui.replPrompt('truecolor', true)]), why: 'The prompt, the chooser and settings should read as one program.', fix: 'replPrompt uses the pointer from glyphSet.' });
    const cut = tui.fitLine('\u001b[1mbold words that go on\u001b[0m', 10);
    check('fitLine cuts by what shows, keeps the colour codes whole and resets after the cut', tui.visibleWidth(cut) === 10 && cut.endsWith('\u001b[0m...') && cut.startsWith('\u001b[1m') && tui.fitLine('short', 10) === 'short' && tui.fitLine('abc', 0) === '', { happened: JSON.stringify(cut), why: 'Cutting inside an escape code prints garbage and leaves the colour on.', fix: 'Check fitLine.' });
    const wrapped = tui.wrapText('one two three four five six seven eight nine ten', 10, 3);
    check('wrapText stops at its line limit with ... and never passes the width', wrapped.length === 3 && wrapped.every((l) => l.length <= 10) && wrapped[2].endsWith('...') && tui.wrapText('a b', 10, 3).join('|') === 'a b' && tui.wrapText('x'.repeat(25), 10).length === 3, { happened: JSON.stringify(wrapped), why: 'The description under the settings list has three lines and no more.', fix: 'Check wrapText.' });
    check('values read plainly: empty says so, numbers and switches as typed', tui.displayValue('') === '(empty)' && tui.displayValue(7) === '7' && tui.displayValue(false) === 'false' && tui.displayValue('gemma3:4b') === 'gemma3:4b', { happened: [tui.displayValue(''), tui.displayValue(7), tui.displayValue(false)].join(','), why: 'An empty string printed as "" reads as a bug.', fix: 'Check displayValue.' });
  });
}
