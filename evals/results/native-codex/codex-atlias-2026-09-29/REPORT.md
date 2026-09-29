# Native Codex pilot, September 29, 2026

For Gev: native Codex CLI 0.159.0, gpt-6.1-sol, medium effort, subscription login, Atlias 3.8.1 at 1544f9e05bece3c249e850126920181f148baa6e. No experimental lean flags. These are authored diagnostic tasks, not public leaderboard tasks.

| Matched task | Plain solved | Atlias solved | Plain input | Atlias input |
|---|---|---|---|---|
| money, 8 archived files | yes | no | 128,518 | 130,464 |
| versions, 8 archived files | yes | yes | 91,478 | 128,473 |
| intervals, 8 archived files | yes | yes | 90,838 | 105,159 |
| total | 3/3 | 2/3 | 310,834 | 364,096 |

Input per solve, including the unsuccessful attempt: 103,611 plain and 182,048 Atlias. Total input ratio 1.171x; input-per-solve ratio 1.757x. Peak request input was 20,542 plain and 23,680 Atlias. These are CLI raw input tokens including cached input, not billed-equivalent tokens or dollars. Three semantic families provide too little evidence for a credible confidence interval.

Atlias's money repair rejected valid integer and one-place decimal strings. The Unicode Atlias arm passed at 129,731 input tokens but has no matching baseline: it is retained in rows.jsonl and excluded from the paired totals. The driver stopped at its account-allowance cap before completing the planned six pairs. No task or unsuccessful-attempt tokens were dropped from completed pairs.

Both arms used fresh homes, workspaces and memory, the same prompts and settings, and alternated arm order. Baseline had no Atlias hooks or MCP; treatment had both and recorded hook events. Retained rollout model metadata confirms GPT 6.1. Startup catalogs had 63 common skills; the treatment added only Atlias and double-check. Disabling machine-wide skill paths in config did not remove their shared descriptions from startup context. That common overhead is a limitation of this host protocol. No UFS plugin was installed in either arm.

Local full-access workspaces are not security sandboxes. Hidden graders were written after each model stopped, protected files were checked, and both model responses and usage were retained locally. Credentials were removed after calls. This directory contains sanitized row metrics, plan and summary only; raw profiles and conversations remain local.

Earlier workspace-policy-denied pilots and a pilot with different startup settings are excluded. This result does not validate the newest runner changes or the unfinished larger study. Do not claim that Atlias reduced context or tokens on this pilot.

Recompute without a model:

```powershell
node tools/codexstudy/summary.mjs evals/results/native-codex/codex-atlias-2026-09-29/rows.jsonl
```
