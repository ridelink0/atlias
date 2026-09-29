# Native Codex pilot, September 29, 2026

For Gev: native Codex CLI 0.159.0, gpt-6.1-sol, medium effort, subscription login, Atlias 3.8.1 at 1544f9e05bece3c249e850126920181f148baa6e. No experimental lean flags. These are authored diagnostic tasks, not public leaderboard tasks.

| Matched task | Plain solved | Atlias solved | Plain input | Atlias input |
|---|---|---|---|---|
| money, 8 archived files (ineligible: ambiguous contract) | yes | no | 128,518 | 130,464 |
| versions, 8 archived files | yes | yes | 91,478 | 128,473 |
| intervals, 8 archived files | yes | yes | 90,838 | 105,159 |
| eligible total | 2/2 | 2/2 | 182,316 | 233,632 |

Eligible input per solve: 91,158 plain and 116,816 Atlias. Total input and input-per-solve ratios are 1.281x. Peak request input was 20,253 plain and 23,143 Atlias. Before the contract audit, unfiltered three-pair totals were 310,834 versus 364,096, with 3/3 versus 2/3 hidden verdicts; these are retained for inspection and are not the qualified comparison. Failed-attempt tokens must be included on valid tasks. These are CLI raw input tokens including cached input, not billed-equivalent tokens or dollars. Two eligible semantic families provide too little evidence for a credible confidence interval.

Atlias's money repair accepted one- and two-place decimals but required a decimal point. The brief specified one or two decimal places without explicitly accepting integers; the hidden grader also accepted integers. Both money arms are marked ineligible for this ambiguous contract. The original task is retained in invalid-task/ with its original hash, and future corpus contracts explicitly accept integers. No new money run was performed. The Unicode Atlias arm passed at 129,731 input tokens but has no matching baseline: it is retained in rows.jsonl and excluded from the paired totals. The driver stopped at its account-allowance cap before completing the planned six pairs. All original rows are retained; only the two ineligible money rows and unmatched Unicode arm are omitted from qualified paired totals. No unsuccessful-attempt tokens are omitted on eligible tasks.

Both arms used fresh homes, workspaces and memory, the same prompts and settings, and alternated arm order. Baseline had no Atlias hooks or MCP; treatment had both and recorded hook events. Retained rollout model metadata confirms GPT 6.1. Startup catalogs had 63 common skills; the treatment added only Atlias and double-check. Disabling machine-wide skill paths in config did not remove their shared descriptions from startup context. That common overhead is a limitation of this host protocol. No UFS plugin was installed in either arm.

Local full-access workspaces are not security sandboxes. Hidden graders were written after each model stopped, protected files were checked, and both model responses and usage were retained locally. Credentials were removed after calls. This directory contains sanitized row metrics, plan and summary only; raw profiles and conversations remain local.

Earlier workspace-policy-denied pilots and a pilot with different startup settings are excluded. This result does not validate the newest runner changes or the unfinished larger study. Do not claim that Atlias reduced context or tokens on this pilot.

Recompute without a model:

```powershell
node tools/codexstudy/summary.mjs evals/results/native-codex/codex-atlias-2026-09-29/rows.jsonl
```
