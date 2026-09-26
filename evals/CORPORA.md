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

164 of 164 proved sound here. JavaScript is the same with
`.../parquet/js/test/0.parquet` and `--lang js`; Node's `console.assert` only
logs, so the converter puts a throwing `console.assert` at the top of the
protected test file, or most buggy solutions would "pass".

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

## The tiers

    atlias tiers                     what each tier is, and whether it is here
    atlias eval --tier smoke         the nine shipped tasks
    atlias eval --tier main --sample 24 --engine ollama
    atlias eval --tier big --sample 8 --engine ollama

`--sample N` takes the same N tasks every time for a given tier and seed, so two
arms of an A/B are scored on the same subset and `atlias compare` pairs them
task by task.
