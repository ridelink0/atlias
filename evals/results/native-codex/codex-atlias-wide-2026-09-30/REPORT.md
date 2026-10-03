# Wider native Codex context study for Gev

Native Codex CLI 0.159.0, gpt-6.1-sol, medium effort, source **72e6ff5c47f9f84e779aaac3a87b93f3e436690b**. leanBrief, gateRunsCheck and taskContext; 64 archived-note files per workspace, 12 authored semantic families and two planned repeats. Both host hooks implement packing; these model measurements cover Codex only.

**All-row matched comparison: 24 pairs/12 families. Original hidden grades: plain 22/24, Atlias 22/24.** Raw input **2,344,337 vs 1,723,477**, ratio **0.73517** (26.48% less input). Maximum request input **22,674 vs 26,663**, 17.59% change. This includes failures and the ambiguous query task; no unfavorable outcome is discarded. Raw input includes cached tokens and is not a dollar/allowance estimate.

48/48 planned calls recorded; both repeats completed for all families. 0 excluded protocol rows retained. Family bootstrap: 0.64109–0.85403, exploratory on this authored corpus. Context variants and repeats are not independent tasks. No public leaderboard, general productivity, Claude-model saving or release-gate claim. Both arms retain the common machine skill catalog.

Known contract ambiguity: the query contract says to decode parameters, but does not state that an optional leading question mark must be stripped. Its hidden grader requires that behavior. Both arms failed that assertion in both repeats; every original grade remains untouched. [Protocol finding](protocol-findings.json). This is not evidence of a model-performance loss attributable to Atlias. The future contract must be revised under new hashes and a separate study.

Symmetric sensitivity analysis, excluding only query from BOTH arms: 22 matched pairs/11 families; original grades plain 22/22, Atlias 22/22; raw input 2,160,077 vs 1,584,778, ratio 0.73367. This does not replace the all-row result above. [Eligible summary](eligible-summary.json).

Plain-only passing tasks: none. Atlias-only passing tasks: none. These use original grades, including query.

| Repeat | Plain vs Atlias grades | Raw input | Ratio | Maximum request input |
|---|---|---|---|---|
| 1 | 11/12 vs 11/12 | 1,170,790 vs 823,789 | 0.70362 | 21,420 vs 26,329 |
| 2 | 11/12 vs 11/12 | 1,173,547 vs 899,688 | 0.76664 | 22,674 vs 26,663 |

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
| dedupe | 2/2 vs 2/2 | 164,311 vs 170,253 | 1.03616 | 19,957 vs 24,596 |
| query | 0/2 vs 0/2 | 184,260 vs 138,699 | 0.75274 | 20,211 vs 20,877 |

Protected grading, prompts, source, flags and hashes stayed unchanged throughout this run. Treatment generation/delivery is independently checked against initial task files with the archived packer; [exact context audit](context-audit.json). Credentials and raw transcripts are not published. All previous unfavorable comparisons remain in the README. Default-off experiment; no global activation or release.

Recompute: `node tools/codexstudy/summary.mjs evals/results/native-codex/codex-atlias-wide-2026-09-30/rows.jsonl`. To reproduce inputs after later task revisions, check out source72e6ff5 and use its committed manifest with `--variant 64 --pairs 12 --repeat 2 --lean --task-context --ref 72e6ff5`; native executable/login and an unused output directory are required. Account caps can stop a plan early; paid credits remain off.

All recorded rows, including any unmatched rows: cached input 1727744 vs 1406208; output 37347 vs 29227; outer tool calls 102 vs 59. Matched raw-input comparisons above remain primary. No dollar/allowance estimate. The driver first capped at75%, then resumed only missing rows after a fresh84% meter with approximately35 estimated lead turns and an88% cap; source/prompts/grading/model/flags stayed unchanged.
