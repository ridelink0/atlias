// UserPromptSubmit: record the prompt boundary (the gate and the handoff note
// need it) and inject context only when it replaces more expensive work:
// a graph answer to a codebase question, or a one-time companion pointer.
import { config, recordEvent, events, mtime, sessionMeta, saveSessionMeta, sha, clip, exists, graphPath, idrCopies, ufsCopies } from './core.mjs';
import * as graph from './graph.mjs';
import { companions } from './brief.mjs';

export const CODEBASE_RE = /\b(how (does|do|is|are)|where (is|are|does|do)|what (calls|uses|depends|happens|breaks)|which (file|module|function|component)|trace|walk me through|explain (the )?(flow|architecture|code|module)|architecture|call graph|data flow|entry point|impact of|affected by|depends on|dependenc(y|ies)|relationship between|why does)\b/i;
export const FRONTEND_RE = /\b(landing page|website|web ?page|home ?page|hero section|restyle|redesign the (ui|page|site)|parallax|three\.js|webgl|gsap|tailwind|css animation|start screen)\b/i;

// Visual research asks for images, not code: strong phrases only, and never a
// prompt that also names code or a frontend build, which the other routes own.
export const VISUAL_RE = /\b(mood ?boards?|reference (images?|photos?|pictures?)|visual (research|references?|inspiration)|design (references?|inspiration)|contact sheets?|(find|show|pull|get|fetch|collect|gather)( me)?( (some|a few|\d+))?( \w+)? (images?|photos?|pictures?) (of|for)|what (do|does) .{1,80}? look like|(screenshots?|renders?) of .{0,60}?(sites?|homepages?|home pages?)|competitor sites?|(public[- ]domain|cc0|licensed|creative commons)( \w+)? (images?|photos?|pictures?))\b/i;
export const CODE_GUARD_RE = /(\.(m?[jt]sx?|py|css|s[ac]ss|html?|json|md|rs|go|java|rb|php|cpp?|h|ya?ml|toml)\b|\bsrc\/|\b(function|component|test|endpoint|bug|error|defined|refactor)s?\b)/i;

export function classify(prompt, { visual = false } = {}) {
  const p = String(prompt || '');
  if (p.length < 12 || p.startsWith('/')) return 'skip';
  if (visual && VISUAL_RE.test(p) && !FRONTEND_RE.test(p) && !CODE_GUARD_RE.test(p)) return 'visual';
  if (CODEBASE_RE.test(p)) return 'codebase';
  if (FRONTEND_RE.test(p)) return 'frontend';
  return 'other';
}

// Which of the four visual hints applies, from what is installed. null when
// ultimate-frontend-skills loads from a folder atlias cannot resolve: it may
// bundle image-deep-research, so neither "absent" nor "old" would be true.
export function visualState(idr, ufs) {
  const loaded = idr.filter((c) => c.loaded);
  if (loaded.length) return loaded.every((c) => c.compact === true) ? 'compact' : 'plain';
  if (idr.some((c) => c.kind === 'bundled' && c.known)) return 'old';
  if (ufs.some((c) => c.loaded)) return null;
  return 'absent';
}
export function visualHintText(variant, state) {
  const sub = variant === 'subagent';
  let t;
  if (state === 'absent') t = 'Visual research, and image-deep-research is not installed. Offer: atlias install --companions (adds ultimate-frontend-skills, which bundles it).';
  else if (state === 'old') t = 'Visual research: this ultimate-frontend-skills predates its bundled image-deep-research (6.5.0+); offer to update it.';
  else if (state === 'plain') t = sub ? 'Visual research: run image-deep-research in a subagent and have it return paths, licences, hex values and one move per reference, not images.' : 'Visual research: use the image-deep-research skill; read its contact sheets before any single image.';
  else t = sub ? 'Visual research: run image-deep-research --compact in a subagent and have it return paths, licences, hex values and one move per reference, not images.' : 'Visual research: use the image-deep-research skill with --compact first (one numbered sheet, at most 1,334 image tokens); open a full image only for what the sheet and its text cannot answer.';
  return '[atlias] ' + t;
}

// A graph answer is only as current as the graph. When files have changed
// since it was built, the answer still helps, but it must not be quoted as
// settled fact.
export function staleNote(cwd, sid) {
  const built = mtime(graphPath(cwd));
  if (!built) return '';
  const newestEdit = events(sid).filter((e) => e.kind === 'edit').reduce((m, e) => Math.max(m, e.t || 0), 0);
  if (newestEdit <= built) return '';
  return '\n[atlias] Files have changed since this graph was built, so parts of this answer may be out of date. Confirm anything load-bearing against the files it names.';
}

export function prompt(payload) {
  const cfg = config();
  const sid = payload.session_id || 'no-session';
  const cwd = payload.cwd || process.cwd();
  const text = String(payload.prompt || '');
  const promptId = payload.prompt_id || sha(`${sid}:${Date.now()}:${text.slice(0, 80)}`);
  recordEvent(sid, { kind: 'prompt', prompt_id: promptId, text: clip(text, 200) });
  const meta = sessionMeta(sid);
  saveSessionMeta(sid, { ...meta, cwd, lastPromptId: promptId });

  const visualOn = Boolean(cfg.router.companions) && cfg.flags.visualHint !== 'off';
  const kind = classify(text, { visual: visualOn });
  if (kind === 'skip' || kind === 'other') return null;

  if (kind === 'codebase' && cfg.router.graph && exists(graphPath(cwd))) {
    const answer = graph.query(cwd, text.slice(0, 300), cfg.graph.queryBudget);
    // Recorded so the pointer-first nudge knows the graph has already answered
    // for this turn: a file the router itself named is exactly the file to open.
    if (answer) {
      recordEvent(sid, { kind: 'graph', via: 'router' });
      return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: `[atlias graph, ${cfg.graph.queryBudget}-token budget] Use this before opening files; open only what it names.\n${answer}${staleNote(cwd, sid)}` } };
    }
    return null;
  }
  if (kind === 'visual') {
    if (meta.hintedVisual) return null;
    const state = visualState(idrCopies({ cwd }), ufsCopies({ cwd }));
    saveSessionMeta(sid, { ...sessionMeta(sid), hintedVisual: true });
    if (!state) return null;
    const variant = cfg.flags.visualHint;
    recordEvent(sid, { kind: 'hint', hint: 'visual', variant });
    return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: visualHintText(variant, state) } };
  }
  if (kind === 'frontend' && cfg.router.companions && !meta.hintedFrontend) {
    const c = companions(cwd);
    saveSessionMeta(sid, { ...sessionMeta(sid), hintedFrontend: true });
    if (c.ufs) return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: '[atlias] Frontend work: invoke the ultimate-frontend-skills skill before designing or styling; it carries the reference corpus and the anti-AI-tell audit.' } };
    return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: '[atlias] Frontend work and ultimate-frontend-skills is not installed. Offer: `claude plugin marketplace add ridelink0/ultimate-frontend-skills` then `claude plugin install ultimate-frontend-skills@ultimate-frontend-skills`.' } };
  }
  return null;
}
