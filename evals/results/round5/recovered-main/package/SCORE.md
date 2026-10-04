# Atlias score

Built by atlias 3.8.1 at git 26cb1547ba6d (uncommitted changes). Each task is one fixed coding job with a check command; a task counts as solved only when that check passes on the untouched test files. The corpus is 250 task(s) (tier main); lock.json pins each task by the sha256 of its files.

## Result

| arm | engine | model | solved | rate | Wilson 95% | prompt tokens per solved task |
|---|---|---|---|---|---|---|
| atlias-3.7.1 | ollama | qwen2.5-coder:7b | 59 of 250 | 23.6% | 18.8% to 29.2% | 98,957 |
| mini-2.4.6 | mini-swe-agent 2.4.6 (textbased, Git bash local env) | ollama_chat/qwen2.5-coder:7b | 41 of 250 | 16.4% | 12.3% to 21.5% | 127,351 |

The interval is wide because the corpus is small. Read a rate as a range, and one task flipping as noise unless the paired test below says otherwise.

## Paired comparison

Same 250 task(s) under both arms. atlias-3.7.1 to mini-2.4.6: 18 gained, 36 lost, 23 solved by both, 173 by neither.
McNemar exact test on the 54 task(s) that changed: two-sided p = 0.0198.

## What ran

- atlias-3.7.1: atlias 3.7.1 @ ca1e948; flags: none set, every flag at its default; one attempt per task.
- mini-2.4.6: no harness stamp in the report; flags: none set, every flag at its default; one attempt per task.

## Re-score (no model, no tokens)

Recomputes every number above from rows.jsonl and checks each task file against the lock. Exit 1 on any mismatch.

```
atlias score verify <this folder>
```

## Re-run (uses the model)

From a checkout of atlias at the sha above, on the same corpus:

```
atlias eval --engine ollama --model qwen2.5-coder:7b --tier main --save atlias-3.7.1.json
atlias eval --engine mini-swe-agent 2.4.6 (textbased, Git bash local env) --model ollama_chat/qwen2.5-coder:7b --tier main --save mini-2.4.6.json
atlias compare reports/atlias-3.7.1.json reports/mini-2.4.6.json
```

Then `atlias score pack <the new report.json...> --out <dir>` and compare the new SCORE.md with this one. A re-run lands inside the run-to-run spread, not on the same number.

## Files

- `lock.json` version, git sha, engine, model, flags, task ids with file hashes, commands
- `rows.jsonl` task, pass, rounds, prompt tokens, per arm
- `stats.json` the statistics
- `reports/` the eval reports these came from
