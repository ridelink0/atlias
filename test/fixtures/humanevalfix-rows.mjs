// Fixture rows in the shape of bigcode/humanevalpack (Hugging Face is blocked
// in the cloud, so the converter is built against these). Each one is a real
// buggy/canonical pair: the buggy solution fails its tests and the canonical
// one passes. The tests are written the way HumanEvalPack writes them, with the
// assertion shapes the dataset uses plus a few it does not, to hold the v2
// rewrite to its fallback rule.
const row = (n, entry, declaration, buggy, canonical, test, extra = {}) => ({
  task_id: `Python/${n}`, entry_point: entry, import: extra.import || '', declaration,
  buggy_solution: buggy, canonical_solution: canonical, test, test_setup: extra.test_setup || '',
  instruction: `Write ${entry}`,
});

export const HEFIX_ROWS = [
  // 0: assert f(x) == y, the dominant shape
  row(0, 'add', 'def add(x: int, y: int):\n    """Add two numbers."""\n', '    return x - y\n', '    return x + y\n',
    '\n\nMETADATA = {}\n\n\ndef check(add):\n    assert add(0, 1) == 1\n    assert add(1, 2) == 3\n    assert add(5, 7) == 12\n\ncheck(add)\n'),
  // 1: assert f(x) and assert not f(x)
  row(1, 'is_odd', 'def is_odd(n):\n    """True for odd n."""\n', '    return n % 2 == 0\n', '    return n % 2 == 1\n',
    '\n\ndef check(is_odd):\n    assert is_odd(3)\n    assert not is_odd(4)\n    assert is_odd(7)\n\ncheck(is_odd)\n'),
  // 2: assert abs(f(x) - y) < eps, the float shape
  row(2, 'mean', 'def mean(xs):\n    """Arithmetic mean."""\n', '    return sum(xs) / (len(xs) + 1)\n', '    return sum(xs) / len(xs)\n',
    '\n\ndef check(mean):\n    assert abs(mean([1, 2, 3]) - 2.0) < 1e-6\n    assert abs(2.5 - mean([2, 3])) <= 1e-6\n    assert abs(mean([1e-3, 3e-3]) - 2e-3) < 1e-9\n\ncheck(mean)\n'),
  // 3: an assert that spans lines, a list value, and a call on the right
  row(3, 'sort_desc', 'def sort_desc(xs):\n    """Descending copy."""\n', '    return sorted(xs)\n', '    return sorted(xs, reverse=True)\n',
    '\n\ndef check(sort_desc):\n    assert sort_desc(\n        [3, 1, 2]\n    ) == [3, 2, 1]\n    assert [2, 1] == sort_desc([1, 2])\n    assert sort_desc([]) == []\n\ncheck(sort_desc)\n'),
  // 4: shapes that must fall back: message, and/or, is, !=, chained, in, ternary
  row(4, 'double', 'def double(n):\n    """Twice n."""\n', '    return n + 2\n', '    return n * 2\n',
    '\n\ndef check(double):\n    assert double(2) == 4, "two"\n    assert double(1) == 2 and double(3) == 6\n    assert double(0) is not None\n    assert double(1) != 3\n    assert 0 < double(1) < 3\n    assert double(2) in (4, 5)\n    assert (double(1) == 2) if True else False\n    assert double(5) == 10\n\ncheck(double)\n'),
  // 5: strings that contain ==, commas, quotes and a hash; a trailing comment
  row(5, 'join_eq', 'def join_eq(a, b):\n    """a==b, joined."""\n', '    return a + "=" + b\n', '    return a + "==" + b\n',
    '\n\ndef check(join_eq):\n    assert join_eq("x", "y") == "x==y"  # a, b == c\n    assert join_eq(\'a,b\', "#") == \'a,b==#\'\n\ncheck(join_eq)\n'),
  // 6: HumanEval-style candidate, asserts inside a loop, a negative operand
  row(6, 'triple', 'def triple(n):\n    """Three times n."""\n', '    return n * 2\n', '    return n * 3\n',
    '\n\ndef check(candidate):\n    for i in range(3):\n        assert candidate(i) == i * 3\n    assert abs(candidate(-1) - -3.0) < 1e-6\n\ncheck(triple)\n'),
  // 7: a long value (truncated in the message) and a tuple result
  row(7, 'span', 'def span(n):\n    """Range and its size."""\n', '    return list(range(n)), n + 1\n', '    return list(range(n)), n\n',
    '\n\ndef check(span):\n    assert span(400) == (list(range(400)), 400)\n\ncheck(span)\n'),
  // 8: import, test_setup, and a docstring with an assert-looking line
  row(8, 'clamp', 'def clamp(x, lo, hi):\n    """assert clamp(1, 0, 2) == 1"""\n', '    return max(lo, min(hi, x)) + 1\n', '    return max(lo, min(hi, x))\n',
    '\n\ndef check(clamp):\n    assert clamp(5, 0, 3) == 3\n    assert clamp(-1, 0, 3) == 0\n\ncheck(clamp)\n', { import: 'import math\n\n', test_setup: 'SEED = 7\n' }),
  // 9: shapes the rewrite cannot place: no call on either side, and a semicolon
  row(9, 'ident', 'def ident(x):\n    """Return x."""\n', '    return None\n', '    return x\n',
    '\n\ndef check(ident):\n    assert 1 == 1\n    x = 1; assert ident(x) == 1\n    assert ident(2) == 2\n\ncheck(ident)\n'),
];

// One JavaScript row: v2 is a Python-only mode, so it is refused for js.
export const HEFIX_JS_ROW = {
  task_id: 'JavaScript/0', entry_point: 'add', import: '', declaration: '\nconst add = (a, b) => {\n',
  buggy_solution: '  return a - b\n}\n', canonical_solution: '  return a + b\n}\n',
  test: 'const testAdd = () => {\n  console.assert(add(2, 3) === 5)\n}\n\ntestAdd()\n', test_setup: '', instruction: 'Write add',
};
