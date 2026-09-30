# Native Codex source-listing comparison for Gev

Native Codex CLI 0.159.0, **gpt-6.1-sol**, **medium** effort. Source **0e29833460e466ec80c503129b90808a0c206bf9**, leanBrief/gateRunsCheck/taskContext, 64-note variants, 12 authored semantic families, two repeats. **14/48 calls recorded; INCOMPLETE; the unchanged 48-call plan remains active.** Missing rows are not successes or exclusions. Every recorded row remains in [rows](rows.jsonl); completed rows are never rerun.

Matched original grades: plain **7/7**, Atlias **7/7**. Raw input **732,844 vs 890,337**, ratio **1.21491**, **21.49% more input**. Maximum request input **22,934 vs 22,773**, **0.70% lower**. Raw input includes cached tokens; it is not dollars, billed usage or allowance savings. Uncached input 194,732 vs 94,689; output 11,522 vs 9,908. Protocol exclusions: 0, retained. No task or unfavorable row was dropped to improve the result.

Exploratory family-cluster bootstrap input ratio interval 0.83076–1.64070. Variants and repeats are not independent tasks. This incomplete snapshot establishes no public benchmark, general productivity, Claude-model saving or release gate. Plain-only passes: none; Atlias-only passes: none.

This source combines explicit 30-second Codex shell waits, shared Git-absence guidance and exclusion of generated graphify-out artifacts from source listings for BOTH hosts. The reference ideas and their implementation limits are pinned in [HARNESS-REFERENCES](../../../../docs/HARNESS-REFERENCES.md). These changes target observed waste in [sourcecd pagination](../codex-atlias-lean-catalog-2026-09-30/peak-diagnostic.json); this comparison does not isolate any single change. Initial instruction and MCP overhead still exists. Catalog character reduction does not prove model-token savings. Current eval council code is outside this pinned source and cannot inherit this study's results.

The task hashes and separately hashed query contractv2 match sourcecd's plan. Optional-leading-question-mark stripping is explicit; the grader and APIs are unchanged. The completed source46/source72/sourcecd studies remain separate with their original grades and all favorable/unfavorable rows. This is a fresh matched plain-versus-Atlias comparison, not pooled with earlier studies or a paired ablation against sourcecd.

All 7 completed valid treatment packs were reconstructed from initial files with the archived packer and matched to generated hashes/lengths and their complete text in user/developer messages. [Exact generated and delivered context audit](context-audit.json). Completed workspaces retain no subscription auth. Common machine skills remain in both arms. The diagnostic profiles bypass hook trust; the separate source6ac smoke verified native delivery without that bypass. Actual model-free native MCP client checks for BOTH hosts are [separate evidence](../native-mcp-catalog-2026-09-30/REPORT.md).

The first four calls stopped when the weekly allowance reached the initial 65% cap. With substantial five-hour and weekly headroom, only missing rows resumed under a 75% cap for every account window. This budget boundary is not an experimental feature flag; source, prompts, protected grading, model, effort, task order and the 48-call plan stayed unchanged. Paid credits and free resets remain unused. A changed window/cap is not model-token evidence.

| Repeat | Plain vs Atlias grades | Raw input | Ratio | Peak request input |
|---|---|---|---|---|
| 1 | 7/7 vs 7/7 | 732,844 vs 890,337 | 1.21491 | 22,934 vs 22,773 |

| Family | Plain vs Atlias grades | Raw input | Ratio | Peak request input |
|---|---|---|---|---|
| money | 1/1 vs 1/1 | 112,041 vs 122,067 | 1.08949 | 20,562 vs 21,219 |
| versions | 1/1 vs 1/1 | 95,574 vs 59,229 | 0.61972 | 22,934 vs 20,664 |
| intervals | 1/1 vs 1/1 | 93,731 vs 166,748 | 1.77901 | 20,590 vs 21,980 |
| unicode | 1/1 vs 1/1 | 111,003 vs 58,543 | 0.52740 | 19,586 vs 20,011 |
| paths | 1/1 vs 1/1 | 94,316 vs 101,062 | 1.07153 | 20,644 vs 21,959 |
| merge | 1/1 vs 1/1 | 132,689 vs 162,626 | 1.22562 | 21,702 vs 22,773 |
| ttl | 1/1 vs 1/1 | 93,490 vs 220,062 | 2.35386 | 21,670 vs 21,357 |

Recompute: `node tools/codexstudy/summary.mjs evals/results/native-codex/codex-atlias-source-listing-2026-09-30/rows.jsonl`. Reproduce source0e's committed manifest with `node tools/codexstudy/run.mjs --tasks evals/context-heldout/manifest.json --task-root . --pairs 12 --repeat 2 --variant 64 --lean --task-context --ref 0e29833460e466ec80c503129b90808a0c206bf9 --stop-percent 75 --out <unused-directory> --codex <native-executable> --run`; subscription login is required. Resume uses the same output directory and skips completed rows. Do not shrink the plan or revise grades.
