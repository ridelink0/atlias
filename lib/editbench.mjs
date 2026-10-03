// Two published edit benchmarks, converted into tasks this machine can run.
//
// poly-A scored 0/27 with a 7B, and at zero passes an A/B cannot show anything:
// the old arm has nothing to lose, so the new one needs six gains on tasks the
// model has already shown it cannot do. The tiers here are the ones a small
// model can score on, so a change to the harness has room to move a number
// both ways.
//
// - CanItEdit (nuprl, arXiv 2312.12450): an instruction edit to existing
//   Python code, in a lazy and a descriptive wording. Upstream the model sees
//   the code and the instruction, never the tests, and the grader runs the
//   program and its tests as one file. Both rules are kept: the tests are
//   task.hidden, written into the workspace only after the model stops, and
//   the runner executes main.py and the tests as one module.
// - HumanEvalFix (HumanEvalPack, arXiv 2308.07124): one buggy function and its
//   tests, fix the bug. Upstream the tests are shown, so here they are a
//   visible, protected file. JavaScript's stock tests use console.assert,
//   which in Node only logs; the protected test file starts by making it throw,
//   or most buggy solutions would "pass".
//
// The input is the dataset as JSONL, one row per line, which is what the
// Hugging Face datasets library writes with Dataset.to_json. Every task is
// proved here exactly as the polyglot converter proves its own (proveTask):
// it must fail as shipped and pass with the benchmark's reference, on this
// machine, or it is refused with the reason.
import fs from 'node:fs';
import path from 'node:path';
import { ensureDir } from './core.mjs';
import { proveTask, resolveRunner } from './polyglot.mjs';

export function readJsonl(file) {
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { return []; }
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line)); } catch { /* a corrupt row is skipped; the count in the report shows it */ }
  }
  return rows;
}

// Program and tests in one module, as the upstream graders run them: the tests
// may use names the program keeps private, which `from main import *` would
// hide. The module is registered as __main__ so dataclasses, pickling and
// anything else that looks itself up in sys.modules behave as in a script.
//
// explain (NEXTGEN-5 row 7, HumanEvalFix v2): the same run, but every assert in
// the tests file is rewritten on the way in, so a failure says what it compared
// ("expected 3, got -1") instead of a bare AssertionError. The tests file itself
// is untouched, the program runs first as before, and the tests keep the line
// numbers they had in the joined module. Off, the runner is byte for byte v1.
export function pythonRunner(program, tests, { explain = false } = {}) {
  if (explain) return explainRunner(program, tests);
  return [
    '# Runs the program and its tests as one module, as the benchmark does upstream.',
    'import pathlib, sys, types',
    'here = pathlib.Path(__file__).resolve().parent',
    `src = (here / ${JSON.stringify(program)}).read_text(encoding="utf-8") + "\\n\\n" + (here / ${JSON.stringify(tests)}).read_text(encoding="utf-8")`,
    'sys.path.insert(0, str(here))',
    'mod = types.ModuleType("__main__")',
    `mod.__file__ = str(here / ${JSON.stringify(program)})`,
    'sys.modules["__main__"] = mod',
    `exec(compile(src, ${JSON.stringify(`${program} + ${tests}`)}, "exec"), mod.__dict__)`,
    'print("all tests passed")',
    '',
  ].join('\n');
}

function explainRunner(program, tests) {
  return [
    '# Runs the program and its tests as one module, as the benchmark does upstream.',
    '# v2: a failed assert in the tests says what it compared and what came back.',
    'import ast, operator, pathlib, sys, types',
    'here = pathlib.Path(__file__).resolve().parent',
    `prog = (here / ${JSON.stringify(program)}).read_text(encoding="utf-8")`,
    `tests = (here / ${JSON.stringify(tests)}).read_text(encoding="utf-8")`,
    'OPS = {"Eq": operator.eq, "NotEq": operator.ne, "Lt": operator.lt, "LtE": operator.le, "Gt": operator.gt, "GtE": operator.ge, "Is": operator.is_, "IsNot": operator.is_not, "In": lambda a, b: a in b, "NotIn": lambda a, b: a not in b}',
    'def show(v):',
    '    t = repr(v)',
    '    return t if len(t) <= 300 else t[:300] + "..."',
    'def atlias_cmp(left, right, op, src, msg=None):',
    '    if not OPS[op](left, right):',
    '        said = f"expected {show(right)}, got {show(left)}" if op == "Eq" else f"left side {show(left)}, right side {show(right)}"',
    '        raise AssertionError(f"assert {src}: {said}" + ("" if msg is None else f" ({msg()})"))',
    'def atlias_truth(value, src, msg=None):',
    '    if not value:',
    '        raise AssertionError(f"assert {src}: the value was {show(value)}" + ("" if msg is None else f" ({msg()})"))',
    'class Explain(ast.NodeTransformer):',
    '    def visit_Assert(self, node):',
    '        t = node.test',
    '        extra = [ast.Lambda(ast.arguments(posonlyargs=[], args=[], kwonlyargs=[], kw_defaults=[], defaults=[]), node.msg)] if node.msg is not None else []',
    '        src = ast.Constant(ast.unparse(t))',
    '        if isinstance(t, ast.Compare) and len(t.ops) == 1:',
    '            call = ast.Call(ast.Name("atlias_cmp", ast.Load()), [t.left, t.comparators[0], ast.Constant(type(t.ops[0]).__name__), src] + extra, [])',
    '        else:',
    '            call = ast.Call(ast.Name("atlias_truth", ast.Load()), [t, src] + extra, [])',
    '        return ast.copy_location(ast.Expr(call), node)',
    `tree = ast.parse(tests, ${JSON.stringify(tests)})`,
    'ast.increment_lineno(tree, prog.count("\\n") + 2)',
    'tree = ast.fix_missing_locations(Explain().visit(tree))',
    'sys.path.insert(0, str(here))',
    'mod = types.ModuleType("__main__")',
    `mod.__file__ = str(here / ${JSON.stringify(program)})`,
    'sys.modules["__main__"] = mod',
    'mod.__dict__.update(atlias_cmp=atlias_cmp, atlias_truth=atlias_truth)',
    `exec(compile(prog, ${JSON.stringify(`${program} + ${tests}`)}, "exec"), mod.__dict__)`,
    `exec(compile(tree, ${JSON.stringify(`${program} + ${tests}`)}, "exec"), mod.__dict__)`,
    'print("all tests passed")',
    '',
  ].join('\n');
}

export const JS_ASSERT_PRELUDE = "console.assert = (cond, ...msg) => { if (!cond) throw new Error('assertion failed' + (msg.length ? ': ' + msg.join(' ') : '')) };\n";

export function jsRunner(program, tests) {
  return [
    '// Runs the program and its tests in one scope, as the benchmark does upstream.',
    "const fs = require('fs');",
    "const path = require('path');",
    `const src = fs.readFileSync(path.join(__dirname, ${JSON.stringify(program)}), 'utf8') + '\\n' + fs.readFileSync(path.join(__dirname, ${JSON.stringify(tests)}), 'utf8');`,
    "new Function('require', 'module', 'exports', '__dirname', src)(require, module, exports, __dirname);",
    "console.log('all tests passed');",
    '',
  ].join('\n');
}

export const CANITEDIT_VARIANTS = ['lazy', 'descriptive'];

// One CanItEdit row as a task. rounds is small: these are single-file edits.
export function canItEditTask(row, variant = 'lazy', { exe = 'python', rounds = 12 } = {}) {
  if (!CANITEDIT_VARIANTS.includes(variant)) return { error: `no CanItEdit variant ${variant}; have ${CANITEDIT_VARIANTS.join(', ')}` };
  const instruction = String(row[`instruction_${variant}`] || '').trim();
  if (!instruction) return { error: `row ${row.full_name || row.id} has no instruction_${variant}` };
  const name = String(row.full_name || `${row.id}_${row.name}`);
  return {
    task: {
      id: `canitedit-${variant}-${name}`,
      kind: `canitedit-${variant}`,
      name: `${name} (CanItEdit, ${variant})`,
      rounds,
      protect: [],
      files: { 'main.py': String(row.before) },
      hidden: { 'canitedit_tests.py': String(row.tests), 'canitedit_check.py': pythonRunner('main.py', 'canitedit_tests.py') },
      prompt: `Edit main.py as follows:\n\n${instruction}\n\nHidden tests are run against main.py after you finish; they are not in the workspace. Keep the existing names and signatures unless the instruction changes them.`,
      check: [exe, 'canitedit_check.py'],
      timeoutMs: 60000,
    },
    reference: String(row.after),
    stubName: 'main.py',
  };
}

export const HEFIX_LANGS = {
  python: { ext: 'py', label: 'Python' },
  js: { ext: 'js', label: 'JavaScript' },
};

// HumanEvalFix v2 (NEXTGEN-5 row 7): the same tests, but a failing assertion
// says what it expected and what it got, where v1 prints a bare AssertionError.
// The dataset's asserts are one-liners of a few shapes, so they are rewritten
// as calls to small helpers put at the top of the protected tests file:
//   assert f(x) == y              -> expected y, got <f(x)> for f(x)
//   assert f(x) / assert not f(x) -> expected a truthy / falsy value, got ...
//   assert abs(f(x) - y) < eps    -> expected y (within eps), got ...
// Anything else (a message, and/or, is/in, chains, a semicolon, no call) is left
// as the v1 assertion and counted, because a wrong rewrite would grade a
// different test. Every operand is evaluated as before and the comparison is the
// same one, so a solution passes v2 iff it passes v1. Only values the tests
// already contain (and the model can already read in tests.py) are printed; the
// canonical solution is never used.
export const HEFIX_V2_PRELUDE = [
  'def _hef_show(v):',
  '    try:',
  '        s = repr(v)',
  '    except Exception:',
  "        s = '<unprintable %s>' % type(v).__name__",
  "    return s if len(s) <= 300 else s[:300] + '...'",
  '',
  '',
  'def _hef_eq(call, lhs, rhs, actual=0):',
  '    if lhs == rhs:',
  '        return',
  '    a, e = (lhs, rhs) if actual == 0 else (rhs, lhs)',
  "    raise AssertionError('expected %s, got %s for %s' % (_hef_show(e), _hef_show(a), call))",
  '',
  '',
  'def _hef_truth(call, v, want):',
  '    if bool(v) == want:',
  '        return',
  "    raise AssertionError('expected a %s value, got %s for %s' % ('truthy' if want else 'falsy', _hef_show(v), call))",
  '',
  '',
  'def _hef_close(call, lhs, rhs, eps, strict=True, actual=0):',
  '    if (abs(lhs - rhs) < eps) if strict else (abs(lhs - rhs) <= eps):',
  '        return',
  '    a, e = (lhs, rhs) if actual == 0 else (rhs, lhs)',
  "    raise AssertionError('expected %s (within %s), got %s for %s' % (_hef_show(e), _hef_show(eps), _hef_show(a), call))",
  '',
  '',
  '',
].join('\n');

// Two views of a piece of Python source, each the same length as the source:
// `flat` has strings and comments blanked (S, #), `top` also blanks everything
// inside brackets (x), so a regex on `top` sees only depth-0 syntax and one on
// `flat` still sees calls in arguments. A newline survives in `top` only where
// it ends a logical line. null when brackets or strings do not balance.
function scanPython(src) {
  const flat = new Array(src.length), top = new Array(src.length);
  const stack = [];
  const PAIR = { '(': ')', '[': ']', '{': '}' };
  let i = 0;
  const put = (k, f, t) => { flat[k] = f; top[k] = stack.length ? 'x' : t; };
  while (i < src.length) {
    const c = src[i];
    if (c === '#') {
      while (i < src.length && src[i] !== '\n') { put(i, '#', '#'); i++; }
    } else if (c === '"' || c === "'") {
      const triple = src.startsWith(c.repeat(3), i);
      const q = triple ? c.repeat(3) : c;
      const from = i;
      i += q.length;
      let closed = false;
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src.startsWith(q, i)) { i += q.length; closed = true; break; }
        if (!triple && src[i] === '\n') return null;
        i++;
      }
      if (!closed) return null;
      // a string is one token even when it spans lines
      for (let k = from; k < i; k++) put(k, 'S', 'S');
    } else if (c === '\\' && src[i + 1] === '\n') {
      put(i, ' ', ' '); put(i + 1, ' ', ' '); i += 2;
    } else if (c === '(' || c === '[' || c === '{') {
      flat[i] = c; top[i] = stack.length ? 'x' : c; stack.push(PAIR[c]); i++;
    } else if (c === ')' || c === ']' || c === '}') {
      if (stack.pop() !== c) return null;
      flat[i] = c; top[i] = stack.length ? 'x' : c; i++;
    } else if (c === '\n') {
      flat[i] = '\n'; top[i] = stack.length ? 'x' : '\n'; i++;
    } else { put(i, c, c); i++; }
  }
  if (stack.length) return null;
  const numeric = (s) => s.replace(/(?<![\w.])(?:\d[\d_]*\.?\d*|\.\d+)[eE][+-]?\d+/g, (m) => 'n'.repeat(m.length));
  return { flat: flat.join(''), top: numeric(top.join('')) };
}

const callPattern = (names) => new RegExp(`(?<![\\w.])(?:${names.map((n) => n.replace(/[^\w]/g, '')).filter(Boolean).join('|')})\\s*\\(`);
const literal = (s) => JSON.stringify(s.replace(/\s+/g, ' ').trim().slice(0, 200));

// One assert's expression, or the reason it is left alone. `expr` is the source
// after the keyword, with its comment and trailing space removed.
function rewriteAssertExpr(expr, names) {
  let sc = scanPython(expr);
  if (!sc) return { why: 'unbalanced brackets or strings' };
  if (/^\((x*)\)$/.test(sc.top.trim())) { expr = expr.trim().slice(1, -1); sc = scanPython(expr); if (!sc) return { why: 'unbalanced brackets or strings' }; }
  const { flat, top } = sc;
  const has = callPattern(names);
  if (/,/.test(top)) return { why: 'a message or a tuple' };
  if (/:=|;/.test(top)) return { why: 'unsupported syntax' };
  if (/(?<![\w.])(?:and|or)(?![\w])/.test(top)) return { why: 'and/or' };
  if (/(?<![\w.])(?:if|else|lambda|for|yield|await|async)(?![\w])/.test(top)) return { why: 'unsupported syntax' };
  if (/(?<![\w.])(?:is|in)(?![\w])/.test(top)) return { why: 'is/in comparison' };
  const notLead = /^\s*not(?![\w])/.exec(top);
  const ops = [...top.matchAll(/(?<![<>=!])(==|!=|<=|>=|<|>)(?![<>=])/g)];
  if (/(?<![\w.])not(?![\w])/.test(notLead ? top.slice(notLead[0].length) : top)) return { why: 'not inside an expression' };
  if (ops.length === 0) {
    const cut = notLead ? notLead[0].length : 0;
    const body = expr.slice(cut);
    if (!/^\s*[A-Za-z_][\w.]*\s*\(x*\)\s*$/.test(top.slice(cut)) || !has.test(flat.slice(cut))) return { why: 'truthiness of something that is not a call to the function' };
    return { out: `_hef_truth(${literal(body)}, ${body.trim()}, ${notLead ? 'False' : 'True'})` };
  }
  if (notLead) return { why: 'not with a comparison' };
  if (ops.length > 1) return { why: 'chained comparison' };
  const op = ops[0][1], at = ops[0].index;
  const L = expr.slice(0, at).trim(), R = expr.slice(at + op.length).trim();
  const fL = flat.slice(0, at), fR = flat.slice(at + op.length);
  if (!L || !R) return { why: 'unsupported syntax' };
  if (op === '==') {
    const cl = has.test(fL), cr = has.test(fR);
    if (cl && cr) return { why: 'the call is on both sides' };
    if (!cl && !cr) return { why: 'no call to the function' };
    return { out: `_hef_eq(${literal(cl ? L : R)}, ${L}, ${R}${cl ? '' : ', 1'})` };
  }
  if (op !== '<' && op !== '<=') return { why: `a ${op} comparison` };
  if (!/^\s*abs\s*\(x*\)\s*$/.test(top.slice(0, at))) return { why: `a ${op} comparison that is not abs(a - b)` };
  const inner = L.slice(L.indexOf('(') + 1, L.lastIndexOf(')'));
  const si = scanPython(inner);
  if (!si) return { why: 'unbalanced brackets or strings' };
  // A - B is only the argument's own subtraction when nothing at depth 0 binds
  // looser than a minus: abs(f(x) - y << 1) is abs((f(x) - y) << 1), and cutting
  // it at the minus would grade f(x) - (y << 1); a comma would shift the operands
  // into the helper's other parameters.
  if (/[,&|^]|<<|>>|[<>]|==|!=|:=/.test(si.top) || /(?<![\w.])(?:and|or|not|is|in|if|else|lambda|for|yield|await)(?![\w])/.test(si.top)) return { why: 'abs() with an operator that binds looser than the subtraction' };
  const minus = [];
  for (let k = 0; k < si.top.length; k++) {
    if (si.top[k] !== '-') continue;
    const prev = si.top.slice(0, k).trimEnd().slice(-1);
    if (prev && /[\w)\]}]/.test(prev)) minus.push(k);
  }
  if (minus.length !== 1) return { why: 'abs() without exactly one subtraction' };
  const A = inner.slice(0, minus[0]).trim(), B = inner.slice(minus[0] + 1).trim();
  if (!A || !B || /\+/.test(si.top.slice(minus[0] + 1))) return { why: 'abs() with arithmetic after the subtraction' };
  const ca = has.test(si.flat.slice(0, minus[0])), cb = has.test(si.flat.slice(minus[0] + 1));
  if (ca && cb) return { why: 'the call is on both sides' };
  if (!ca && !cb) return { why: 'no call to the function' };
  return { out: `_hef_close(${literal(ca ? A : B)}, ${A}, ${B}, ${R}, ${op === '<' ? 'True' : 'False'}${ca ? '' : ', 1'})` };
}

// The tests of one row with their asserts rewritten. `names` are the
// identifiers a call to the function under test can have: its entry point,
// `candidate`, and the parameter of `def check(...)`.
export function rewriteHumanEvalFixTests(test, entryPoint) {
  const names = [entryPoint, 'candidate'];
  const checkParam = /def\s+check\s*\(\s*([A-Za-z_]\w*)/.exec(test);
  if (checkParam) names.push(checkParam[1]);
  const sc = scanPython(test);
  if (!sc) return { text: test, rewritten: 0, fallbacks: [{ line: 0, why: 'the tests do not parse as balanced Python', src: '' }] };
  const fallbacks = [], out = [];
  let rewritten = 0, at = 0, lineNo = 1;
  for (;;) {
    let end = sc.top.indexOf('\n', at);
    if (end < 0) end = test.length;
    const raw = test.slice(at, end), rt = sc.top.slice(at, end);
    const startLine = lineNo;
    lineNo += (raw.match(/\n/g) || []).length + 1;
    const lead = /^(\s*)assert(?![\w])\s*/.exec(rt);
    if (!lead) {
      if (/(?<![\w.])assert(?![\w])/.test(rt)) fallbacks.push({ line: startLine, why: 'an assert that does not start its own line', src: raw.trim().slice(0, 80) });
      out.push(raw);
    } else {
      const hash = rt.indexOf('#');
      const code = raw.slice(0, hash >= 0 ? hash : raw.length).replace(/\s+$/, '');
      const expr = code.slice(lead[0].length);
      const res = expr.trim() ? rewriteAssertExpr(expr, names) : { why: 'an empty assert' };
      if (res.out) { out.push(`${lead[1]}${res.out}${raw.slice(code.length)}`); rewritten++; } else {
        fallbacks.push({ line: startLine, why: res.why, src: raw.trim().slice(0, 80) });
        out.push(raw);
      }
    }
    if (end >= test.length) break;
    out.push('\n');
    at = end + 1;
  }
  return { text: out.join(''), rewritten, fallbacks };
}

// One HumanEvalFix row as a task: the buggy function to fix, its tests beside it.
// The round budget was 8 and is 14, measured rather than guessed: on the first
// real slice of the main tier (8 tasks, qwen2.5-coder:7b, 2026-09-25) five of
// eight runs ended rounds-exhausted at 8 while 59 per cent of their edits were
// not applying, so 8 rounds was measuring the budget rather than the work.
// With v2 (Python only) the tests print the call, the expected value and the
// actual value for a failing assertion of a shape rewriteHumanEvalFixTests can
// place; the task is `humanevalfix-python-v2-<n>` so v1 and v2 rows never
// collide, and the result carries { rewritten, fallbacks } for the report.
// Without v2 the output is byte for byte what it always was.
export function humanEvalFixTask(row, lang = 'python', { exe = 'python', node = 'node', rounds = 14, v2 = false, explain = false } = {}) {
  const spec = HEFIX_LANGS[lang];
  if (!spec) return { error: `no HumanEvalFix language ${lang}; have ${Object.keys(HEFIX_LANGS).join(', ')}` };
  if (v2 && lang !== 'python') return { error: `HumanEvalFix v2 rewrites Python asserts; there is no v2 for ${lang}` };
  const num = String(row.task_id || '').split('/').pop();
  const head = `${row.import || ''}${row.declaration || ''}`;
  const sol = `solution.${spec.ext}`, tests = `tests.${spec.ext}`, runner = `check.${spec.ext}`;
  let testBody = lang === 'js' ? `${JS_ASSERT_PRELUDE}${row.test_setup || ''}${row.test}` : `${row.test_setup || ''}${row.test}`;
  let rewrite = null;
  if (v2) {
    rewrite = rewriteHumanEvalFixTests(String(row.test), row.entry_point);
    testBody = `${rewrite.rewritten ? HEFIX_V2_PRELUDE : ''}${row.test_setup || ''}${rewrite.text}`;
  }
  return {
    ...(rewrite ? { v2: { rewritten: rewrite.rewritten, fallbacks: rewrite.fallbacks } } : {}),
    task: {
      id: `humanevalfix-${lang}${v2 || explain ? '-v2' : ''}-${num}`,
      kind: `humanevalfix-${lang}${v2 || explain ? '-v2' : ''}`,
      name: `${spec.label}/${num} ${row.entry_point} (HumanEvalFix${v2 || explain ? ' v2' : ''})`,
      rounds,
      protect: [tests, runner],
      files: {
        [sol]: `${head}${row.buggy_solution}`,
        [tests]: testBody,
        [runner]: lang === 'js' ? jsRunner(sol, tests) : pythonRunner(sol, tests, { explain }),
      },
      prompt: `Fix the bug in ${row.entry_point} in ${sol}. The tests in ${tests} must pass; run them with: ${lang === 'js' ? 'node' : 'python'} ${runner}. Do not change ${tests} or ${runner}: they grade the task, and a run that edits them does not count.`,
      check: [lang === 'js' ? node : exe, runner],
      timeoutMs: 60000,
    },
    reference: `${head}${row.canonical_solution}`,
    stubName: sol,
  };
}

// Proves every row and writes the ones that hold. `kind` is canitedit or
// humanevalfix; what was refused comes back with the reason.
export function convertRows(rows, kind, outDir, { variant = 'lazy', lang = 'python', limit = 0, only = [], write = true, rounds = 0, v2 = false, explain = false } = {}) {
  if ((v2 || explain) && (kind !== 'humanevalfix' || lang !== 'python')) return { ok: false, why: 'v2 is a Python HumanEvalFix mode: use --bench humanevalfix --lang python', wrote: [], refused: [], dir: outDir };
  const needs = kind === 'humanevalfix' && lang === 'js' ? null : 'python';
  const ready = needs ? resolveRunner('python', { bare: true }) : { ok: true, exe: '', why: `node ${process.version}` };
  if (!ready.ok) return { ok: false, why: ready.why, wrote: [], refused: [], dir: outDir };
  let list = rows;
  const key = (r) => String(kind === 'canitedit' ? (r.full_name || r.id) : r.task_id);
  if (only.length) list = list.filter((r) => only.includes(key(r)) || only.includes(String(r.id)));
  if (limit > 0) list = list.slice(0, limit);
  if (!list.length) return { ok: false, why: `no ${kind} rows to convert`, wrote: [], refused: [], dir: outDir };
  if (write) ensureDir(outDir);
  const wrote = [], refused = [];
  const v2stats = { rewritten: 0, fallbacks: 0, byWhy: {} };
  for (const row of list) {
    // rounds 0 means "whatever the converter's own default is for this benchmark".
    const budget = rounds > 0 ? { rounds } : {};
    const built = kind === 'canitedit' ? canItEditTask(row, variant, { exe: ready.exe, ...budget })
      : kind === 'humanevalfix' ? humanEvalFixTask(row, lang, { exe: ready.exe, node: process.execPath, v2, explain, ...budget })
        : { error: `no converter for ${kind}; have canitedit, humanevalfix` };
    if (built.error) { refused.push({ name: key(row), why: built.error }); continue; }
    // The stub must fail three times: one CanItEdit check decides by timing.
    const proof = proveTask(built, lang === 'js' ? 'javascript' : 'python', { beforeRuns: 3 });
    if (!proof.ok) { refused.push({ name: key(row), why: proof.why }); continue; }
    if (write) fs.writeFileSync(path.join(outDir, `${built.task.id}.json`), `${JSON.stringify(built.task, null, 2)}\n`);
    wrote.push(built.task.id);
    if (built.v2) {
      v2stats.rewritten += built.v2.rewritten;
      for (const f of built.v2.fallbacks) { v2stats.fallbacks++; v2stats.byWhy[f.why] = (v2stats.byWhy[f.why] || 0) + 1; }
    }
  }
  return { ok: wrote.length > 0, why: ready.why, wrote, refused, dir: outDir, ...(v2 ? { v2: v2stats } : {}) };
}

export function report(result) {
  const lines = [];
  if (!result.wrote.length) lines.push(`nothing converted: ${result.why}`);
  else lines.push(`${result.wrote.length} task(s) written to ${result.dir}, each proved to fail as shipped and pass with the benchmark's own reference (${result.why}).`);
  if (result.refused.length) {
    lines.push(`${result.refused.length} refused:`);
    for (const r of result.refused) lines.push(`  ${r.name}: ${r.why}`);
  }
  if (result.v2) {
    const { rewritten, fallbacks, byWhy } = result.v2;
    lines.push(`v2: ${rewritten} assertion(s) now print the call, the expected value and the actual value; ${fallbacks} kept the v1 assertion${fallbacks ? ' (' + Object.entries(byWhy).sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w}: ${n}`).join('; ') + ')' : ''}.`);
  }
  return lines.join('\n');
}
