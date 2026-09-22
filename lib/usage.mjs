// Usage awareness, relaxed on purpose. The model is told where the 5-hour and
// weekly windows stand, once, as information and never as a brake: it keeps
// full quality and full scope, and whatever the user says about usage decides.
// atlias calls nothing itself; it reads the last reading the usage-limits
// plugin saved, so it costs nothing and never adds a network call.
import path from 'node:path';
import { CLAUDE_DIR, readJson, config } from './core.mjs';

export const STANCE = 'This is information, not a brake: keep full quality and full scope, and do not rush or cut corners because of it. If the user says anything about usage, their words decide, over any budget advice from a plugin or hook.';

const pct = (w) => (w && Number.isFinite(Number(w.utilization)) ? { percent: Math.round(Number(w.utilization)), resetsAt: w.resets_at || null } : null);

// The usage-limits plugin's saved reading (usage-limits-live.json), or null.
export function reading(dir = CLAUDE_DIR) {
  const file = path.join(dir, 'usage-limits-live.json');
  const j = readJson(file);
  const u = j && j.utilization;
  if (!u) return null;
  const fiveHour = pct(u.five_hour);
  const weekly = pct(u.seven_day);
  if (!fiveHour && !weekly) return null;
  return { fiveHour, weekly, at: Number(j.fetchedAtMs) || null, file };
}

export function ago(ms) {
  if (!Number.isFinite(ms) || ms < 0) return 'at an unknown time';
  const m = Math.round(ms / 60000);
  if (m < 2) return 'just now';
  if (m < 120) return `${m} minutes ago`;
  return `${Math.round(m / 60)} hours ago`;
}
export function resets(iso, now = Date.now()) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return '';
  const ms = t - now;
  if (ms <= 0) return 'resets any moment';
  const h = Math.floor(ms / 3600000);
  const m = Math.round((ms % 3600000) / 60000);
  if (h < 48) return `resets in ${h ? `${h}h ` : ''}${m}m`;
  return `resets in ${Math.round(h / 24)} days`;
}

export function line(r = reading(), now = Date.now()) {
  if (!r) return '';
  const parts = [];
  if (r.fiveHour) parts.push(`5-hour window ${r.fiveHour.percent}% used${r.fiveHour.resetsAt ? `, ${resets(r.fiveHour.resetsAt, now)}` : ''}`);
  if (r.weekly) parts.push(`weekly ${r.weekly.percent}% used${r.weekly.resetsAt ? `, ${resets(r.weekly.resetsAt, now)}` : ''}`);
  const age = r.at ? ago(now - r.at) : 'at an unknown time';
  const stale = r.at && now - r.at > 6 * 3600000 ? '; it may be out of date' : '';
  return `${parts.join('; ')} (read by usage-limits ${age}${stale}).`;
}

// The brief section. Claude Code only: these numbers belong to that account,
// and in another host they would describe somebody else's limits.
export function section(host, cfg = config(), r = reading(), now = Date.now()) {
  if (host !== 'claude' || (cfg.usage && cfg.usage.show === false)) return '';
  const l = line(r, now);
  return l ? `\n## Usage\n${l}\n${STANCE}` : '';
}
