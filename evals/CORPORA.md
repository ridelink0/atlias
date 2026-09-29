# The corpora atlias scores itself on, and which of them are in git

`atlias eval` scores tasks. A task is a JSON file: the files it seeds, the
prompt, the check command that decides, and optionally the grader files the
model never sees. Some of those tasks are written here; most are converted from
somebody else's published benchmark, and every converted task was proved on the
machine that converted it - it has to fail as shipped and pass with the
benchmark's own reference, or it is refused with the reason.

This file says where each corpus comes from, how to regenerate it, and why two
of them are in git and the rest are not.

## In git

- `evals/*.json` - the nine tasks written for atlias. The smoke tier.
- `evals/polyglot/` - 27 Python exercises from
  [Aider's polyglot benchmark](https://github.com/Aider-AI/polyglot-benchmark)
  (clone at commit 7e0611e, 2024-12-22), converted by `atlias polyglot`. These
  are Exercism practice exercises: the test file is part of the exercise and is
  public, so a copy here neither leaks a hidden test nor changes what the
  benchmark measures.

## Not in git, and why

`evals/canitedit/`, `evals/humanevalfix/` and `evals/refactor/` are generated
and ignored (see `.gitignore`). Three reasons, in the order they mattered:

1. **CanItEdit hides its tests upstream, and this harness keeps them hidden.**
   Each converted task carries the benchmark's tests as `hidden` files, written
   into the workspace only after the model has stopped. Committing them to a
   public repository would publish the hidden half of somebody else's benchmark
   in plain text, where it is crawled, quoted and eventually trained on. The
   CanItEdit licence on GitHub is a BSD 3-Clause with a fourth clause -
   "The contents of this repository may not be used as training data for any
   machine learning model" - and its Hugging Face card says MIT; keeping the
   generated copy off GitHub is the reading that respects both.
2. **Size, in a plugin that is cloned onto every host.** The generated tasks are
   about 1.3 MB for CanItEdit and 0.8 MB for HumanEvalFix Python alone, against
   a whole repository of a few hundred kilobytes, for data that one command
   regenerates.
3. **Derived data has to carry the upstream notice.** Keeping it out of the tree
   keeps the licence and attribution with the upstream copy on the machine that
   downloaded it, which is where they can be checked.

What is in git instead: the converters (`lib/editbench.mjs`,
`lib/refactorbench.mjs`, `lib/polyglot.mjs`), the tier definitions
(`lib/tiers.mjs`), and the commands below. `atlias tiers` says which corpora are
present on this machine and prints the command for any that are not.

## How to regenerate each one

The counts are what this machine measured on 2026-09-25 with Python 3.13 and
pytest 9.1.1; a machine with other packages installed will prove more tasks
sound, and one with fewer will prove fewer. Every refusal is printed with its
reason.

### CanItEdit (main tier, instruction edits)

nuprl/CanItEdit, 105 tasks, arXiv 2312.12450. Licence: BSD 3-Clause with a
machine-learning restriction (GitHub) / MIT (Hugging Face card).

    curl -L -o canitedit.parquet \
      https://huggingface.co/api/datasets/nuprl/CanItEdit/parquet/default/test/0.parquet
    python -c "import pyarrow.parquet as pq, json; \
      rows = pq.read_table('canitedit.parquet').to_pylist(); \
      open('canitedit.jsonl','w',encoding='utf-8').write(''.join(json.dumps(r, default=str)+'\n' for r in rows))"
    atlias editbench canitedit.jsonl --bench canitedit --variant lazy
    atlias editbench canitedit.jsonl --bench canitedit --variant descriptive

88 of 105 tasks were proved sound here in each variant. 16 refusals are a
missing package (pandas 5, torch 4, z3 2, sklearn 2, autograd 2, vllm 1) and
one, `60_unique_number`, is refused because its tests already pass on the
before-code.

### HumanEvalFix (main tier, one-function bug fixes)

bigcode/humanevalpack, 164 tasks per language, arXiv 2308.07124. Licence: MIT.

    curl -L -o hef-python.parquet \
      https://huggingface.co/api/datasets/bigcode/humanevalpack/parquet/python/test/0.parquet
    python -c "import pyarrow.parquet as pq, json; \
      rows = pq.read_table('hef-python.parquet').to_pylist(); \
      open('hef-python.jsonl','w',encoding='utf-8').write(''.join(json.dumps(r, default=str)+'\n' for r in rows))"
    atlias editbench hef-python.jsonl --bench humanevalfix --lang python

164 of 164 proved sound here, at a round budget of 14 per task (`--rounds N`
changes it; the budget was 8 until a slice of the main tier showed five of eight
runs ending out of rounds at 8, which measures the budget rather than the work).

JavaScript is the same with `.../parquet/js/test/0.parquet` and `--lang js`:
**163 of 164**, refusing `JavaScript/162`, whose own canonical solution does not
pass here. Node's `console.assert` only logs, so the converter puts a throwing
`console.assert` at the top of the protected test file, or most buggy solutions
would "pass". It is not part of a tier, but `atlias eval --corpus
evals/humanevalfix/js` runs it. Expect it to be slow to convert: a buggy stub
that loops forever costs three proof attempts, each retried once, at the task's
60-second timeout.

### HumanEvalFix v2 (the check prints expected and actual)

NEXTGEN-5 row 7. The same 164 Python tasks, but a failing assertion says what
it expected and what it got instead of a bare `AssertionError`:
`AssertionError: expected 3, got 2 for add(1, 2)`. The prompt, the solution
stub, the runner and the round budget are v1's; only `tests.py` differs, so v1
(`evals/humanevalfix/python`) is the content-free control arm. Regenerate on
the PC, from the same `hef-python.jsonl` as v1, into its own folder (never over
v1):

    atlias editbench hef-python.jsonl --bench humanevalfix --lang python --v2

The tasks land in `evals/humanevalfix/python-v2` (`--out` changes it) as
`humanevalfix-python-v2-<n>`; each is proved to fail as shipped and pass with
the benchmark's reference, as v1 is, so the run takes about the same 0.5 h.
Run it with `atlias eval --corpus evals/humanevalfix/python-v2`.

Three assert shapes are rewritten: `assert f(x) == y`, `assert f(x)` and
`assert not f(x)`, and `assert abs(f(x) - y) < eps` (or `<=`). Any other shape
keeps its v1 assertion: a message, `and`/`or`, `is`/`in`, a chain, `!=`, no call
to the function, a semicolon, or brackets that do not balance. The converter's
last lines give the count, for example `v2: N assertion(s) now print the call,
the expected value and the actual value; M kept the v1 assertion (and/or: 3; ...)`.
Copy those two numbers into the run's notes: they say how much of the corpus
the arm changed. The cloud built this against ten fixture rows (21 rewritten, 9
fall back; `test/hefix-v2-suites.mjs`), not the real dataset, so the real
fallback share is unmeasured until that command runs. Only Python has a v2.

### Aider refactor-benchmark (big-file tier)

[Aider-AI/refactor-benchmark](https://github.com/Aider-AI/refactor-benchmark)
at commit c90dfb6 (2024-02-13), 89 tasks, Apache-2.0. Real source files from
Django, Spyder and TensorFlow - median 26 KB, largest 1.1 MB - each asking for
one method to be moved out of its class and made a top-level function.

    git clone https://github.com/Aider-AI/refactor-benchmark
    atlias refactorbench refactor-benchmark/refactor-benchmark

The grader is the benchmark's own AST check, carried as a hidden file: the
named function must exist at module level with the same subtree size, and the
class must have lost exactly that much. No tests are run, so nothing here
depends on the packages those projects need.

**57 of 89 proved here.** 31 source files are over the 40 KB default cap
(`--max-bytes 0` removes the cap; the largest file in the benchmark is 1.1 MB,
which no local window can hold), and one, `generator.py`, is refused because the
reference move cannot be made mechanically: the method's body holds a
triple-quoted string with text at column zero, so dedenting the block does not
lift it and the moved copy rejoins its own class.

## The tiers

    atlias tiers                     what each tier is, and whether it is here
    atlias eval --tier smoke         the nine shipped tasks
    atlias eval --tier main --sample 24 --engine ollama
    atlias eval --tier big --sample 8 --engine ollama

`--sample N` takes the same N tasks every time for a given tier and seed, so two
arms of an A/B are scored on the same subset and `atlias compare` pairs them
task by task. `--rounds N` overrides every task's own round budget for one run
and the report says it was set for this run; without it each task runs on the
budget its converter gave it, and the report header prints that spread.

What a run of a tier is worth is `atlias compare`'s business, not the score's:
it prints the Wilson interval per arm, how many one-way flips would have been
needed for a p below 0.05, and a paired interval on the disagreements. On eight
tasks, 0 of 8 has a Wilson interval of 0.0 to 32.4 per cent, which is why a
sample that small settles nothing either way.
