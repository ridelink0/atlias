# AA-Omniscience-Public for Gev

This adds a reproducible, model-free preparation and metric layer for the public600-question subset. Native answering and protected semantic judging remain unfinished and unmeasured; no Atlias or Gemini model score is claimed. The full publisher leaderboard uses6000questions, not this public subset.

Pinned dataset: ArtificialAnalysis/AA-Omniscience-Public revision e4883edbb9f5ccf2b2a8fdc6fb65e01a58e99849, CSV SHA2561e04603dafa3bd0d16d8151f07a5eb74c43d90c3a85d2fca120da2359174d02f, Apache-2.0. Data/answering-template attribution: Declan Jackson, William Keating, George Cameron and Micah Hill-Smith, Artificial Analysis. Dataset licensing applies to its content/template; Atlias code retains the repository license. Download the CSV from that exact [revision](https://huggingface.co/datasets/ArtificialAnalysis/AA-Omniscience-Public/tree/e4883edbb9f5ccf2b2a8fdc6fb65e01a58e99849).

Prepare without inference:

```
node tools/omniscience/test.mjs
node tools/omniscience/prepare.mjs <pinned-csv> <unused-output-directory>
```

Preparation rejects changed bytes, missing fields and duplicate identities; preserves all600questions; separates `questions.json` from `grader-only/gold.json`; pins both manifest hashes. Gold is never an argument to questionPrompt and must never enter contestant workspaces, packs, graphs or model context. Existing output is never overwritten. Question text is benchmark data, not instructions for the harness.

Metrics use the paper's definitions, not exact-string guessing or an abstention substring heuristic. For Ccorrect, Iincorrect, Ppartial, Aabstained:

- Accuracy=C/(C+I+P+A).
- Hallucination rate=I/(I+P+A).
- Omniscience index=100(C-I)/(C+I+P+A); partial answers and abstentions are neutral.
- Attempt rate=(C+I+P)/(C+I+P+A).

Undefined denominators produce null. An all-correct set does not have a measured hallucination denominator. An always-abstaining system has zero accuracy; a low hallucination rate alone is not success. Imported grades require a pinned judge and question/response hashes, and incomplete plans expose missing IDs with no complete measuredMetrics. Imported labels do not prove actual judge execution. Scripted controls are not model scores.

The publisher supplies four judge labels and a semantic grading template. Its release dataset card used Gemini2.5FlashPreview; the current publisher methodology names GPT5.6Luna medium. Pin the actual judge model/template and report differences; do not pretend another judge reproduces their leaderboard. Missing, malformed, tool-using and interrupted contestant responses must remain recorded, with no conversion into abstentions or free retries. Preserve all solver/preparation/judge costs. Native-host canary/output extraction is a protocol adaptation that must be declared and pinned.

The stock benchmark is closed-book: no retrieval, browsing, source files or tools. A future Atlias evidence-grounding track can test refusing unsupported claims or using sources correctly, but must be separately named and cannot inherit AA-Omniscience scores. Current600question preparation made zero model calls. Integration with both native hosts and actual protected judging is the next unfinished step, after the root-cause plan in [BENCHMARK-PATTERN-PLAN](../../docs/BENCHMARK-PATTERN-PLAN.md).

`judge-prepare.mjs <prepared600-dir> <frozen-response-jsonl> <pinned-publisher-card> <unused-protected-out>` verifies question/gold manifests and the exact pinned publisher card before rendering its semantic grading template. Candidate braces/substitution characters are retained literally. Valid empty answers stay eligible for semantic judging; interrupted, invalid and tool-using attempts stay invalid, never converted into abstentions. Gold-containing judge prompts must remain outside contestant homes/workspaces/context. Original response bytes and their costs remain in the frozen ledger. Thirty-four protocol controls and six protected preparation controls passed without inference; actual answering and pinned judge execution remain unmeasured.

[Dataset/card](https://huggingface.co/datasets/ArtificialAnalysis/AA-Omniscience-Public), [publisher methodology](https://artificialanalysis.ai/methodology/intelligence-benchmarking), [official equations](https://arxiv.org/html/2511.13029v1#S2.SS4).
