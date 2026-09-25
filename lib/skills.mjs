// Skills, in the format the hosts already read. Nine of the eleven agents in
// the September 2026 source study ship a skill system (docs/NEXTGEN.md); atlias
// had working rules and companion plugins but nothing it could see. Inventing a
// format would have been a second plugin system, so this reads the one Claude
// Code and Codex both already use on this machine: a folder holding a SKILL.md
// whose YAML frontmatter carries a name and a description.
//
// Discovery and listing only. Nothing here runs a skill or installs one: the
// hosts stay the ones that do that, and the terminal agent gains the index the
// hosts already had, plus the one tool it needs to read a skill it recognises.
import fs from 'node:fs';
import path from 'node:path';
import { CLAUDE_DIR, CODEX_DIR, ROOT, clip, readText } from './core.mjs';

export const SKILL_FILE = 'SKILL.md';
// A skill's own instructions run long: graphify's SKILL.md is 41 KB. An index
// needs the frontmatter and nothing else, so only the head of each file is
// read and a folder of fifty skills costs fifty small reads.
export const HEAD_BYTES = 4096;
// Beyond this many skills the index stops naming them and says how many are
// left, because a prompt is not a directory listing.
export const LIST_BUDGET = 1600;

function head(p, bytes = HEAD_BYTES) {
  let fd = null;
  try {
    fd = fs.openSync(p, 'r');
    const size = fs.fstatSync(fd).size;
    const len = Math.min(size, bytes);
    if (len <= 0) return '';
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, 0);
    return buf.toString('utf8');
  } catch { return ''; } finally { if (fd !== null) { try { fs.closeSync(fd); } catch { /* already gone */ } } }
}

// Where a skill can live, in the order the hosts search: what atlias ships,
// then this machine's own, then the project's. A later root wins a name clash,
// because the nearer copy is the one the user is working on.
export function roots(cwd = process.cwd()) {
  const out = [
    { dir: path.join(ROOT, 'skills'), source: 'atlias' },
    { dir: path.join(CLAUDE_DIR, 'skills'), source: 'claude' },
    { dir: path.join(CODEX_DIR, 'skills'), source: 'codex' },
  ];
  if (cwd) {
    out.push({ dir: path.join(cwd, '.claude', 'skills'), source: 'project' });
    out.push({ dir: path.join(cwd, '.codex', 'skills'), source: 'project' });
  }
  return out;
}

// The frontmatter the hosts read, and no more of YAML than that: the block
// between the first two --- lines, one top-level key per line, quotes stripped.
// Indented lines belong to a nested block (several skills carry a metadata:
// block) and are skipped rather than misread as keys of their own.
export function parseFrontmatter(text) {
  const t = String(text || '').replace(/^﻿/, '');
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/.exec(t);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || /^\s/.test(line) || line.trimStart().startsWith('#')) continue;
    const at = line.indexOf(':');
    if (at <= 0) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"') && value.length > 1) || (value.startsWith("'") && value.endsWith("'") && value.length > 1)) value = value.slice(1, -1);
    if (key) out[key] = value;
  }
  return out;
}

// One folder. A folder with no SKILL.md is not a skill (~/.claude/skills holds
// learned/ and synced/ beside the real ones), and a SKILL.md with no
// frontmatter still is one: the folder name is the name the hosts fall back to.
export function readSkill(dir, source = '') {
  const file = path.join(dir, SKILL_FILE);
  let size = 0;
  try { const st = fs.statSync(file); if (!st.isFile()) return null; size = st.size; } catch { return null; }
  const front = parseFrontmatter(head(file));
  const folder = path.basename(dir);
  return {
    name: String(front.name || folder).trim() || folder,
    folder,
    description: String(front.description || '').replace(/\s+/g, ' ').trim(),
    path: file,
    source,
    bytes: size,
  };
}

// Every skill this machine and this project offer, by name, nearest root last
// so the project's copy of a name wins. Sorted, so an index built from it is
// the same on every session and can be cached as part of a prompt prefix.
export function discover(cwd = process.cwd()) {
  const byName = new Map();
  for (const { dir, source } of roots(cwd)) {
    let entries;
    try { entries = fs.readdirSync(dir); } catch { continue; }
    // No filter on the entry's own type. Claude Code installs most skills as
    // directory junctions into the plugin cache, and a junction reports itself
    // as a symbolic link, not a directory: filtering on isDirectory() found
    // five of the fifty-three folders in ~/.claude/skills on this machine.
    // Whether the entry holds a readable SKILL.md is the only question, and
    // readSkill answers it through a stat that follows the link.
    for (const name of entries) {
      if (name.startsWith('.')) continue;
      const skill = readSkill(path.join(dir, name), source);
      if (skill) byName.set(skill.name.toLowerCase(), skill);
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function find(cwd, name) {
  const want = String(name || '').trim().toLowerCase();
  if (!want) return null;
  const all = discover(cwd);
  return all.find((s) => s.name.toLowerCase() === want) || all.find((s) => s.folder.toLowerCase() === want) || all.find((s) => s.name.toLowerCase().includes(want)) || null;
}

// The skill itself, frontmatter stripped, clipped. This is what a reader gets
// when it asks for one by name; the whole point of an index is that it is paid
// once and this is paid only for the skill that matched.
export function body(cwd, name, max = 12000) {
  const s = find(cwd, name);
  if (!s) return null;
  const text = readText(s.path);
  if (text == null) return null;
  const stripped = text.replace(/^﻿/, '').replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/, '').trim();
  return { ...s, text: clip(stripped, max) };
}

// The human listing: `atlias skills`, and /skills in the agent.
export function format(list) {
  if (!list || !list.length) return 'no skills found. A skill is a folder with a SKILL.md; atlias reads them from ~/.claude/skills, ~/.codex/skills and .claude/skills or .codex/skills in the project.';
  const width = Math.max(...list.map((s) => s.name.length));
  return list.map((s) => `${s.name.padEnd(width)}  ${s.source.padEnd(7)}  ${s.description ? clip(s.description, 150) : '(no description)'}`).join('\n');
}

// The index the agent's own prompt carries: every skill named once, grouped by
// the folder that holds it so a path is written once instead of fifty times.
// Names only, because a name is what a model matches a task against and fifty
// descriptions would cost more than the reads they save.
export function promptSection(cwd = process.cwd(), budget = LIST_BUDGET) {
  const list = discover(cwd);
  if (!list.length) return '';
  const groups = new Map();
  for (const s of list) {
    const dir = path.dirname(path.dirname(s.path));
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir).push(s.folder);
  }
  const lines = [`Skills installed here (${list.length}). A skill is one folder's SKILL.md holding instructions for a kind of task; read that file before doing work it covers, and follow it over your own defaults.`];
  let used = 0;
  let omitted = 0;
  for (const [dir, names] of groups) {
    const kept = [];
    for (const n of names.sort((a, b) => a.localeCompare(b))) {
      if (used + n.length + 2 > budget) { omitted++; continue; }
      kept.push(n);
      used += n.length + 2;
    }
    if (kept.length) lines.push(`  ${path.join(dir, '<name>', SKILL_FILE)}: ${kept.join(', ')}`);
  }
  if (omitted) lines.push(`  and ${omitted} more; \`atlias skills\` lists them all with what each is for.`);
  return lines.join('\n');
}
