// The atlias wordmark: block letters in blue, a small ship on the right.
// Degrades on its own: truecolor, then 16-colour, then plain text, and a
// one-line version when the terminal is too narrow for the ship.
import { VERSION } from './core.mjs';

const GLYPHS = {
  A: ['█████', '█   █', '█████', '█   █', '█   █'],
  T: ['█████', '  █  ', '  █  ', '  █  ', '  █  '],
  L: ['█    ', '█    ', '█    ', '█    ', '█████'],
  I: ['█████', '  █  ', '  █  ', '  █  ', '█████'],
  S: ['█████', '█    ', '█████', '    █', '█████'],
};
// Five rows of blue, light at the top edge and deep at the base.
const BLUE = [[147, 197, 253], [96, 165, 250], [59, 130, 246], [37, 99, 235], [29, 78, 216]];
const SHIP = [
  '    ,   ',
  '   /\\   ',
  ' _/  \\_ ',
  '<_    _>==\u00b7\u00b7\u00b7',
  '   \\__/ ',
];
const STARS_TOP = '  \u00b7        .          \u00b7        .   \u00b7';
const STARS_BOT = '     .        \u00b7            .        ';

export function colorMode(env = process.env, stream = process.stdout) {
  if (env.NO_COLOR) return 'none';
  if (env.FORCE_COLOR === '3' || /truecolor|24bit/i.test(env.COLORTERM || '')) return 'truecolor';
  if (!stream || !stream.isTTY) return env.FORCE_COLOR ? 'basic' : 'none';
  if (env.WT_SESSION || env.TERM_PROGRAM === 'vscode' || /-256color|kitty|alacritty/i.test(env.TERM || '')) return 'truecolor';
  return 'basic';
}
export function paint(text, rgb, mode) {
  if (mode === 'none') return text;
  if (mode === 'truecolor') return `\u001b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m${text}\u001b[0m`;
  const bright = rgb[2] > 200 && rgb[0] > 80;
  return `\u001b[${bright ? 94 : 34}m${text}\u001b[0m`;
}
export const dim = (text, mode) => (mode === 'none' ? text : `\u001b[2m${text}\u001b[0m`);
export const bold = (text, mode) => (mode === 'none' ? text : `\u001b[1m${text}\u001b[0m`);
export const accent = (text, mode) => paint(text, BLUE[1], mode);

export function wordmark(word = 'ATLIAS') {
  const rows = ['', '', '', '', ''];
  for (const letter of word.toUpperCase()) {
    const g = GLYPHS[letter];
    for (let i = 0; i < 5; i++) rows[i] += (g ? g[i] : '     ') + ' ';
  }
  return rows.map((r) => r.replace(/\s+$/, ''));
}

export function logo(opts = {}) {
  const mode = opts.color || colorMode();
  const width = opts.width || (process.stdout && process.stdout.columns) || 80;
  const rows = wordmark('ATLIAS');
  const wide = width >= rows[0].length + 16;
  if (width < rows[0].length + 2) return `${accent('atlias', mode)} ${VERSION} ${dim('<_ _>==\u00b7', mode)}`;
  const out = [dim(STARS_TOP, mode)];
  for (let i = 0; i < 5; i++) {
    const line = paint(rows[i], BLUE[i], mode);
    const ship = wide ? '  ' + paint(SHIP[i], BLUE[Math.max(0, i - 1)], mode) : '';
    out.push(' ' + line + ship);
  }
  out.push(dim(STARS_BOT, mode));
  out.push(' ' + bold(`atlias ${VERSION}`, mode) + dim('  a sub-harness, or an agent of its own', mode));
  return out.join('\n');
}

export function banner(subtitle) {
  const mode = colorMode();
  return logo() + (subtitle ? '\n ' + dim(subtitle, mode) : '');
}
