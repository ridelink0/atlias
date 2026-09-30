# Wider native Codex context study for Gev

Native Codex CLI 0.159.0, gpt-6.1-sol, medium effort, source **72e6ff5c47f9f84e779aaac3a87b93f3e436690b**. leanBrief, gateRunsCheck and taskContext; 64 archived-note files per workspace, 12 authored semantic families and two planned repeats. Both host hooks implement packing; these model measurements cover Codex only.

**All-row matched comparison: 22 pairs/12 families. Original hidden grades: plain 21/22, Atlias 21/22.** Raw input **2,159,797 vs 1,564,908**, ratio **0.72456** (27.54% less input). Maximum request input **22,674 vs 26,663**, 17.59% change. This includes failures and the ambiguous query task; no unfavorable outcome is discarded. Raw input includes cached tokens and is not a dollar/allowance estimate.

44/48 planned calls recorded; the plan is incomplete; repetitions and unmatched rows remain explicitly recorded. 0 excluded protocol rows retained. Family bootstrap: 0.62990–0.85284, exploratory on this authored corpus. Context variants and repeats are not independent tasks. No public leaderboard, general productivity, Claude-model saving or release-gate claim. Both arms retain the common machine skill catalog.

Known contract ambiguity: the query contract says to decode parameters, but does not state that an optional leading question mark must be stripped. Its hidden grader requires that behavior. Both r1 arms failed that assertion; later original grades remain untouched. [Protocol finding](protocol-findings.json). This is not evidence of a model-performance loss attributable to Atlias. The future contract must be revised under new hashes and a separate study.

Symmetric sensitivity analysis, excluding only query from BOTH arms: 21 matched pairs/11 families; original grades plain 21/21, Atlias 21/21; raw input 2,068,189 vs 1,505,392, ratio 0.72788. This does not replace the all-row result above. [Eligible summary](eligible-summary.json).

Plain-only passing tasks: none. Atlias-only passing tasks: none. These use original grades, including query.

| Repeat | Plain vs Atlias grades | Raw input | Ratio | Maximum request input |
|---|---|---|---|---|
| 1 | 11/12 vs 11/12 | 1,170,790 vs 823,789 | 0.70362 | 21,420 vs 26,329 |
| 2 | 10/10 vs 10/10 | 989,007 vs 741,119 | 0.74936 | 22,674 vs 26,663 |

| Family | Plain vs Atlias grades | Raw input | Ratio | Maximum request input |
|---|---|---|---|---|
| money | 2/2 vs 2/2 | 206,976 vs 169,205 | 0.81751 | 22,233 vs 24,671 |
| versions | 2/2 vs 2/2 | 187,334 vs 138,722 | 0.74051 | 20,625 vs 20,704 |
| intervals | 2/2 vs 2/2 | 186,119 vs 126,217 | 0.67815 | 22,129 vs 24,482 |
| unicode | 2/2 vs 2/2 | 183,207 vs 124,907 | 0.68178 | 19,906 vs 23,978 |
| paths | 2/2 vs 2/2 | 223,568 vs 119,700 | 0.53541 | 20,873 vs 21,164 |
| merge | 2/2 vs 2/2 | 190,234 vs 231,965 | 1.21937 | 22,674 vs 26,663 |
| ttl | 2/2 vs 2/2 | 205,552 vs 119,045 | 0.57915 | 20,833 vs 20,821 |
| csv | 2/2 vs 2/2 | 207,364 vs 119,310 | 0.57537 | 21,267 vs 21,103 |
| pagination | 2/2 vs 2/2 | 201,776 vs 120,560 | 0.59749 | 20,033 vs 22,402 |
| topology | 2/2 vs 2/2 | 203,636 vs 144,894 | 0.71153 | 20,621 vs 23,553 |
| dedupe | 1/1 vs 1/1 | 72,423 vs 90,867 | 1.25467 | 19,726 vs 24,596 |
| query | 0/1 vs 0/1 | 91,608 vs 59,516 | 0.64968 | 19,862 vs 20,824 |

Protected grading, prompts, source, flags and hashes stayed unchanged throughout this run. Treatment generation/delivery is independently checked against initial task files with the archived packer; [exact context audit](context-audit.json). Credentials and raw transcripts are not published. All previous unfavorable comparisons remain in the README. Default-off experiment; no global activation or release.

Recompute: `node tools/codexstudy/summary.mjs evals/results/native-codex/codex-atlias-wide-2026-09-30/rows.jsonl`. To reproduce inputs after later task revisions, check out source72e6ff5 and use its committed manifest with `--variant 64 --pairs 12 --repeat 2 --lean --task-context --ref 72e6ff5`; native executable/login and an unused output directory are required. Account caps can stop a plan early; paid credits remain off.

All recorded matched rows: cached input 1,572,992 vs 1,272,960; output 34,726 vs 27,170; outer tool calls 94 vs 53. These are measured token/call counts, not billed-dollar estimates.
