# Atlias completion gate for Gev, 2026-09-29

Gev's current goal: finish Claude's existing implementation and review work, add benchmarks including M8VEN to the README, improve token and context efficiency, and conserve the five-hour allowance. New deep research is on hold.

## Recovered and reviewed

- Claude cloud report: `docs/CLOUD-REPORT-2026-09.md`.
- Existing consolidated research index: `C:/Users/OWNER/.claude/projects/C--Users-OWNER/memory/reference_plugin_research.md`. The unfinished `D:/harness-work/atlias-nextgen-research-0928` has raw sources only, not a completed synthesis. Do not run its research workflow.
- Ready source PRs: atlias #4 at `26cb154` and #5 at `d81cd9c`; their overlapping implementation is reconciled in this checkout. The original `C:/Users/OWNER/atlias/lib/logo.mjs` change is preserved separately.
- Existing flags remain off. Council Stage A is model-free; Stage B is not wired into evals. Harness mode must use Gev's Computer Use plugin; sub-harness mode must use the host's tools and bring none of its own. Standalone computer-use wiring remains unbuilt and cannot be claimed complete.
- Windows functional check and adversarial regression checks are required before this reconciliation can be merged. Record final results below after the last edits.

## Measurement prerequisite: do this before advancing round six

The interrupted local chain was resumed on September 29 with its existing `--resume` reports, original source checkout and GPU lock. It uses Ollama on this PC and no paid model API. Runner: `D:/harness-work/runs/r5-mt/run_mt.sh`; reports and log: `D:/harness-work/runs/r5-mt/`; source: `D:/harness-work/atlias-r5-main` at `0067096`. No scheduled task or relay was created.

- Codex CLI run 1: complete, 0/252; inspect protocol failures before making a competitive claim.
- Mini-swe-agent run 1: resumed from 26/252 rows; do not restart completed tasks.
- Still required by the standing gate: mini-swe-agent x3, atlias x3, sameTextSwitch x3, 14B arms, their write-up and decisions, and a council replay using one build's completed runs.
- Nanobot's saved 0/252 is protocol-limited (no tools executed); it is not evidence that Atlias wins by that margin.
- The saved harness-bench summary has no Atlias arm and is partial (46 Codex and 48 Claude Code results of 106). Do not publish it as an Atlias-vs-Codex score. Finish only with an explicit spend ceiling and valid matching controls; do not consume Gev's remaining Claude credit or run new paid API studies automatically.
- New flags, the direct arm and HumanEvalFix v2 still need their own measurements. Do not change defaults or claim Gev's ship bar is met.
- SWE-bench spike needs its external key and existing budget authorization; leave it held without credentials rather than inventing a score.

## Validation record

Initial combined Windows suite: 1393/1394 across 203 suites. The failed check compared replay arithmetic and provenance metadata byte for byte; its assertion was corrected to require equal arithmetic and the missing-provenance warning. Adversarial review added checks for different builds/arms, partial report intersections, zero retries, cut-off direct replies, coordinated score-row tampering, direct re-run commands, and usage-preserving Claude session recovery.

Final suite and adversarial outcomes are recorded after the final run. This file is a completion gate, not a claim that unfinished measurements have passed.
