# Recovered Atlias measurements, 2026-09-29

These are recovered saved runs, not fresh reruns of the pending integration. The repeated round-five chain remains unfinished. No new model was called to compute this report.

## Earlier main-tier comparison

Atlias 3.7.1 at ca1e948 and mini-swe-agent 2.4.6 used qwen2.5-coder:7b with a 16,384-token context. The Atlias file contains 252 rows and the mini file 250; this comparison uses their **250 shared task ids**. The original result was later mislabeled as 3.8.0; the saved stamp identifies 3.7.1.

- Solved: Atlias 59/250, mini 41/250.
- Atlias-only solves: 36; mini-only solves: 18. Exact two-sided McNemar p=0.019834.
- Prompt tokens per solve: Atlias 98,957, mini 127,351.
- One run per arm: no replicated win, no attribution to the guard or gate, and no score for the merged proposal.

[Score summary](recovered-main/package/SCORE.md), [locked task hashes](recovered-main/package/lock.json), [per-task evidence](recovered-main/package/rows.jsonl). The snapshots retain scoring and token fields, plus each original report's SHA-256; they omit model conversations and protected benchmark code. Package verification recomputes rows from the retained reports, statistics from rows, and corpus hashes. It verifies a saved result's consistency, not a fresh model run.

Regenerate the corpora using [CORPORA.md](../../CORPORA.md), then run from the repository root:

```
node bin/atlias.mjs score verify evals/results/round5/recovered-main/package --tier main
```

Task hashes include the check command, so regeneration on a different platform or Python path may differ and must be reported rather than silently accepted. The package's re-run commands identify the engine, model and flags; installing the stamped source version and pinning the Ollama model is also required. Pending round-five x3 runs will replace this single-run evidence only after their measurement gate passes.

Original report hashes:

- Atlias: `91bcdca9aa2b9fa054a9a9d1f53abc816858cfa8e81b3401c31466dd4e66e8f1`.
- Mini-swe-agent: `0b857af61a15b11857575b2392bcc218dc3c0117dafacaafb58fb1d1e588a80d`.

## Other saved results

- Atlias 3.8.1 at c428a5b solved **52/252** in the later saved run. Nanobot 0.3.5 solved **0/252** and executed no tools: its model returned tool calls as ordinary text. That protocol failure prevents a credible headline that Atlias beat Nanobot by 52 tasks.
- Codex CLI 0.155.0-alpha.16.4 with the same local 7B completed **0/252** in round five. Its logs include fallback-model metadata and protocol failures. Do not treat this as a general Codex score or a validated ship-bar win.
- The harness-bench directory's summary contains **no Atlias arm**, with 46 Codex and 48 plain-Claude results present out of 106. It cannot substantiate an Atlias comparison. No paid continuation was started here.
- The Claude Code cloud studies are committed alongside this report: [baseline](cloud-cc/2026-09-29-baseline.md) and [lean-brief flags](cloud-cc/2026-09-29-row4.md). Both solve ceilings and billed-equivalent ratios must accompany the raw token ratios.

## Model-free overhead estimate captured from the main checkout

```text
atlias bench for C:/Users/OWNER/atlias
session brief: 4799 characters, about 1200 tokens (four characters per token)
"how does this project handle errors": graph answer about 573 tokens;
  11 named files about 72356 tokens if read in full
"what is the entry point of this project": graph answer about 574 tokens;
  5 named files about 52097 tokens if read in full
13 finished sessions, 10 open, 4166 tool calls, 20 guard denials, 49 gate blocks
```

The file-reading comparison is an upper bound: an agent often reads fewer files or only windows of them. It is not a measurement of savings on solved tasks.

## External trust assessment

[M8VEN's live Atlias listing](https://m8ven.ai/mcp/ridelink0/atlias), read September 29, 2026: **B, 89/100**, commit **9c47eeb8ff92de79229bf9daa6f7382695a30432**, verified publisher, monitored on pushes. This assesses the source repository's trust signals, not task solving or token efficiency. It does not assess the unmerged reconciliation.
