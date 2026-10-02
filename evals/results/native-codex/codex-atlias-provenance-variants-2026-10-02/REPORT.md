# Native source-grounding diagnostics for Gev

Source e65562bc872debc4278ccf5bdda34cce9ec8e869, GPT6.1Sol medium;12 independent cases in four families, two repeats,48 calls total. Ordinary native tools and foundation instructions were retained in both arms; Atlias used its shared evidence rule and lean hooks/MCP. No reduced worker or custom foundation profile. Actual HTTP tool schemas and all host integrations remain unverified.

| Original grades and diagnostic/cost counts | Plain24 calls | Atlias24 calls |
|---|---:|---:|
| originalSolved | 23 | 24 |
| valid | 24 | 24 |
| invalidFormats | 0 | 0 |
| valueCorrect | 24 | 24 |
| statusCorrect | 24 | 24 |
| citationsCorrect | 23 | 24 |
| usefulSupportedAnswers | 12 | 12 |
| raw | 1234488 | 1383514 |
| cached | 883456 | 1227392 |
| output | 10995 | 14059 |
| uncachedPlusOutput | 362027 | 170181 |
| peak | 15277 | 16688 |
| inferenceWallMs | 1106872 | 2038718 |

Atlias/plain ratios: raw input 1.12072, total tokens 1.12211, uncached input plus output 0.47008, maximum peak context 1.09236. Peak is the largest original native contextPeak in each arm, not a cumulative token total. Neither token nor context20x target (ratio<=0.05) is met.

Taskwise original grade gains 1, losses 0. All favorable and unfavorable original grades and costs are retained. Whole attempts are counted once, including any invalid or unsolved attempts. Supplementary JSON inspection never executes model outputs or protected graders and never replaces the original grades. Invalid formats are distinct from proven factual errors. UsefulSupportedAnswers counts supported/partial contracts correctly answered rather than universal abstention. This structured exact-value/source-ID diagnostic does not measure arbitrary free-form hallucinations.

Original failures, preserved without retries or regrading:

| Arm | Task | Repeat | Value correct | Status correct | Citations correct |
|---|---|---:|---|---|---|
| plain | factuality-v2-wrong-environment | 2 | true | true | false |

The table records every original failing contract separately from exact-value/status/source diagnostics. These authored results do not establish improved public hallucination rates or general superiority.

The independent48-call audit and publisher use the SAME frozen ledger SHA256 61273a3f0f43a0a135e567e580c5eb2ef0cc9af94135b9b5da1d80ede3b0e581. Generated original questions/evidence, complete delivered questions, the new Atlias rule, matching native foundation instructions, actual model/counters, immutable protected graders/evidence and auth removal are audited. No model retries, repairs, regrading or historical control reuse.

This is an authored diagnostic, not AA-Omniscience, TruthfulQA, SimpleQA or ALCE public scoring. Small synthetic evidence records do not establish realistic retrieval quality, universal capability or all model behavior. Claude actual model quality/real OAuth activation and BOTH-host subscription savings remain unmeasured. InferenceWallMs is the sum of native attempt wall times, including failed attempts; it is not time until subscription exhaustion. Token counters and wall time do not establish subscription allowance pricing or the20x goal. A correct answer on a small corpus is neither a release gate nor proof of improvement on unrelated tasks.
