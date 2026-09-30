# Prompt-scoped context candidate for Gev

Native Codex CLI 0.159.0, gpt-6.1-sol, medium effort. Source **46c12afded25f389753630ef6a3e034bc22e2688**; leanBrief, gateRunsCheck and taskContext enabled. The pack uses requirements-first bounded selection informed by Claude Harness; Gray informed bounded waits. Both host hooks are tested, but these model measurements cover Codex only.

**12 matched pairs across 6 authored families. Plain 12/12; Atlias 12/12.** Raw input **1,176,432 vs 835,528**, ratio **0.71022** (28.98% less input). Maximum request input **22,044 vs 24,170** (9.64% change). Lower cumulative input does not establish lower peak context or dollar cost. Input includes cached tokens; output and cached input remain in every row. Failed tasks are included in totals.

24/24 planned model calls recorded; both repeats completed for every family. All 0 excluded protocol rows are retained and identified in summary.json. The family bootstrap interval is 0.64287–0.78800. This is an exploratory interval on six selected authored families, not evidence of a public leaderboard win, real-project productivity, or a release gate. Variants and repeats share family contracts, so they are not independent workloads.

| Total across 12 matched pairs | Plain | Atlias |
|---|---|---|
| Cached input | 848,896 | 695,680 |
| Uncached input (raw minus cached) | 327,536 | 139,848 |
| Output | 20,838 | 15,011 |
| Outer tool calls | 51 | 29 |

Uncached input fell 57.30%, and output fell 27.96%. These are native token measurements, not subscription allowance or dollar savings estimates.

| Repeat | Plain vs Atlias solves | Raw input | Ratio | Maximum request input |
|---|---|---|---|---|
| 1 | 6/6 vs 6/6 | 597,992 vs 407,968 | 0.68223 | 22,044 vs 24,170 |
| 2 | 6/6 vs 6/6 | 578,440 vs 427,560 | 0.73916 | 21,690 vs 23,523 |

| Family | Plain vs Atlias solves | Raw input | Ratio | Maximum request input |
|---|---|---|---|---|
| money | 2/2 vs 2/2 | 185,597 vs 143,179 | 0.77145 | 20,200 vs 22,292 |
| versions | 2/2 vs 2/2 | 166,010 vs 138,682 | 0.83538 | 21,593 vs 20,892 |
| intervals | 2/2 vs 2/2 | 186,042 vs 146,027 | 0.78491 | 21,690 vs 23,523 |
| unicode | 2/2 vs 2/2 | 163,321 vs 117,585 | 0.71996 | 19,555 vs 20,221 |
| paths | 2/2 vs 2/2 | 243,228 vs 144,655 | 0.59473 | 20,678 vs 24,003 |
| merge | 2/2 vs 2/2 | 232,234 vs 145,400 | 0.62609 | 22,044 vs 24,170 |

Every valid treatment proves the hook generated its pack AND it reached a user/developer message in the native transcript. It supplies small whole prompt-named files and static local imports recognized by a bounded pattern matcher, not a general JavaScript parser. Private, external, binary, oversized or nonfitting recognized dependency groups are rejected. Protected-contract grading, prompts and hashes are unchanged. Fresh profiles/workspaces and alternating arm order; subscription login only, paid credits off. Both arms retained the same machine skill catalog; treatment adds Atlias's catalog, hooks and MCP server. Raw profiles, credentials and transcripts are not published.

This candidate remains default off, with no release or global activation. No Claude-model savings are inferred; native Claude calls are unavailable while its weekly allowance is exhausted. Earlier expensive trials remain in the README. Source46c12af passed Windows checks; its POSIX separator regression was fixed separately atb12bce8. Later compatibility and wording fixes are not relabeled as the measured source.

Recompute: `node tools/codexstudy/summary.mjs evals/results/native-codex/codex-atlias-pack-2026-09-30/rows.jsonl`.

Re-run from this repository with native Codex: `node tools/codexstudy/run.mjs --tasks evals/results/native-codex/codex-atlias-pack-2026-09-30/tasks.json --task-root . --pairs 6 --repeat 2 --lean --task-context --ref 46c12af --out <fresh-output> --codex <native-codex-executable> --stop-percent 80 --run`. Account usage can stop before completion; do not enable paid credits. Task inputs are the committed evals/context-heldout files named in tasks.json.
