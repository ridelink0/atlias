# NEXTGEN-4 coverage audit, and two measurements the plan was missing

Written by the lead session on 2026-09-25 about 22:15 CDT, while the build
agents were working. It is READ-ONLY input for them: it changes no code and no
other document. Gev asked for it in these words: "make sure to use all research
when building atlias."

Two parts. Part 1 checks every research finding from tonight's four fronts
against the ranked build list in NEXTGEN-4.md, and names the ones that have no
build item. Part 2 is a measurement I ran on this machine that fixes a
parameter item 1 had to guess.

The verdict labels in NEXTGEN-4.md stand as written; this audit is about
coverage, not about re-judging the evidence. Source of the findings:
D:/harness-work/wf-0925/results.json and results2.json, keys research:edit-apply,
research:small-models, research:context, research:evaluation and their four
verify: counterparts (50 findings in all).

## Part 1: coverage

Covered, and I checked the item text says so rather than assuming it:

- Context integrity, silent front-truncation, no reply reserve, the unverified
  effective context of poly-A, the `/v1` endpoint that cannot set a window
  (context 1; small-models 1, 2, 3, 4, 16; edit-apply 3) -> item 1.
- A corpus off the floor: CanItEdit, HumanEvalFix, refactor-benchmark, polyglot
  composition, partial credit for a 7B (evaluation 1, 4, 5, 6, 9; small-models
  13; edit-apply 11) -> item 2.
- Small-N statistics: intervals, repeats, pass^k (evaluation 2, 3) -> item 3.
- Re-indent and line-snap repair before refusing (edit-apply 2) -> item 4.
- No-op edits not counting as strikes, a repeated failure switching to
  whole-file output (edit-apply 4, 5, 6; small-models 7 in part) -> item 5.
- Worked examples, prompt bulk, no apply_patch for a 7B (small-models 9, 10;
  edit-apply 7) -> item 6.
- Keeping the newest failure unmasked (small-models 11) -> item 7.
- A default model that can call tools, sampling from the model card, budgets
  derived from the window (small-models 12, 14, 5) -> item 8.
- The two hook returns on events that deliver no context, and keeping the
  user's own words through compaction (context 2, 3) -> item 9.
- A per-round ledger, including the arguments and result of every failed edit
  (context 5 in part; edit-apply 1) -> item 10.
- A frozen tool set per session (context 5) -> item 11.
- Deliberately deferred, with a reason, to the "Later" tier: line and hash
  addressing (edit-apply 8), a non-JSON edit channel (edit-apply 9,
  small-models 7), constrained decoding (small-models 17), a read-only
  exploration fold (context 9), an ACON-style loop (context 12), fast-apply
  models (edit-apply 10).

NOT covered by any item or by the Later tier. These are the gaps this audit
exists to surface:

1. **Consolidate and restart, for the interactive agent** (context front,
   finding 11). The research: across more than 200,000 simulated conversations
   there was an average 39% drop on sharded multi-turn tasks, and its action
   line says the terminal agent LACKS an action that gathers every constraint
   so far and restarts the conversation from a single restated specification.
   The eval side is unaffected, because an eval task arrives as one prompt.
   Nothing in items 1-11 or the Later tier does this. A build item would be:
   a `consolidate` action (or an automatic one at a rounds threshold) that
   rewrites the conversation as one restated task plus the pinned rules, with
   a check that a constraint given in round 2 survives to round 30.

2. **Disclosing remaining CONTEXT to the model, not just remaining rounds**
   (context front, finding 10). atlias discloses rounds through `budgetLine`;
   item 10 records prompt and cached tokens in the eval REPORT, which is a
   different thing from telling the model. The finding says disclosure cuts
   both ways, so this belongs behind the comparator from item 3 rather than
   being shipped on faith - but it is currently absent, not deferred.

3. **Code as action for small models** (small-models front, finding 8). The
   research ranks it below findings 1-7 itself, and notes the 7B-13B evidence
   is mixed, so leaving it out may be the right call - but it is the one
   finding that is neither built nor listed under Later, so it reads as
   dropped rather than decided. One line in the Later tier would settle it.

Partly covered, worth a sentence rather than an item:

4. **Gating native tools on the chat template, not only on capabilities**
   (small-models 15). Item 8 checks `/api/show` capabilities for the default
   model. The finding also asks that native tool use be gated on the template
   actually having a tool-role branch, because some Ollama templates drop or
   mangle tool messages. Item 8 does not mention the template.
5. **The three-arm protocol A/B** (small-models 6): today's fenced JSON
   against the model's trained format against native tools, with `num_ctx`
   fixed. Item 6 changes prompt content and item 8 changes tool availability,
   but no item runs that comparison as such.

## Part 2: what I measured, which item 1 had to guess

Item 1 proposes `agent.ollamaNumCtx` with a default of 16384, and NEXTGEN-4
says a 32k KV cache is "about 1.8 GB by my computation, which fits". That was
arithmetic, not a measurement. I ran the real thing on this machine tonight.
Raw data: D:/harness-work/prep-0925/ctx-probe.json. Method: `/api/generate`
against qwen2.5-coder:7b (Q4_K_M, 4.7 GB), a 572-token prompt, `num_predict`
128, `temperature` 0, unloading the model between windows, reading placement
from `/api/ps` and VRAM from `nvidia-smi`.

The machine: one RTX 3060 with 12288 MiB of VRAM, driver 616.64, 806 MiB in use
before the probe. The model reports `qwen2.context_length` = 32768 and
capabilities completion, tools, insert.

| num_ctx | resident | VRAM used | on GPU | generation |
| --- | --- | --- | --- | --- |
| 4096 | 4.7 GB | 5461 MiB | all of it | 49.1 tok/s |
| 16384 | 5.6 GB | 6293 MiB | all of it | 43.7 tok/s |
| 32768 | 6.4 GB | 7057 MiB | all of it | 47.8 tok/s |

What this settles:

- **32768 is affordable, so the honest re-measurement can use the model's full
  trained window.** At 32k the whole model is still resident in VRAM
  (`size_vram` equals `size` in `/api/ps`) with about 5 GB spare. There is no
  CPU offload at any of the three sizes, which was the real risk: an offloaded
  run would have made poly-B slower than poly-A for a reason that has nothing
  to do with the harness, and confounded the comparison the whole plan rests
  on.
- **The generation-speed cost of a larger window is inside noise here** (43.7
  to 49.1 tok/s across all three, with 32k faster than 16k), so wall time is
  not a reason to prefer 16384. Prompt evaluation ran 972-1083 tok/s
  throughout.
- **Whichever window the run uses must be stamped in the report**, because
  4096 and 32768 look identical in a result file and differ by the entire
  argument of NEXTGEN-4. Item 1 already logs `numCtx` and `peakPrompt`; this
  is a reason to treat that as required, not optional.
- **Cold load cost about 47 seconds** every time (46.2-51.7 s, measured as
  `load_duration` after each unload). That is the price of an eval where the
  5-minute default lets the model unload between tasks, and it is measured
  support for the `keep_alive` part of items 1 and 8: over 27 tasks a handful
  of reloads is minutes of wall time attributed to the harness.

One caution about my own numbers: a 572-token prompt does not exercise a 32k
window, so this measures allocation and residency, not behaviour at depth. It
says the window is safe to ask for; it does not say what the model does with
30,000 tokens in it. The codeword probe in item 1 is still the check for that.
