# Native source-grounding diagnostics for Gev

Source 3726bb874a5889616bf27624ebf008dc46ccd5df, GPT6.1Sol medium;16 original cases in eight families, two repeats,64 calls total. Ordinary native tools and foundation instructions were retained in both arms; Atlias used its shared evidence rule and lean hooks/MCP. No reduced worker or custom foundation profile. Actual HTTP tool schemas and all host integrations remain unverified.

| Original grades and diagnostic/cost counts | Plain32 calls | Atlias32 calls |
|---|---:|---:|
| originalSolved | 30 | 29 |
| valid | 32 | 32 |
| invalidFormats | 0 | 0 |
| valueCorrect | 30 | 31 |
| statusCorrect | 30 | 31 |
| citationsCorrect | 32 | 30 |
| usefulSupportedAnswers | 20 | 21 |
| raw | 1967574 | 2486982 |
| cached | 1545088 | 2247040 |
| output | 19409 | 21647 |
| uncachedPlusOutput | 441895 | 261589 |
| peak | 15457 | 17088 |
| inferenceWallMs | 1664292 | 2727388 |

Atlias/plain ratios: raw input 1.26398, total tokens 1.26253, uncached input plus output 0.59197, maximum peak context 1.10552. Peak is the largest original native contextPeak in each arm, not a cumulative token total. Neither token nor context20x target (ratio<=0.05) is met.

Taskwise original grade gains 1, losses 2. All favorable and unfavorable original grades and costs are retained. Whole attempts are counted once, including any invalid or unsolved attempts. Supplementary JSON inspection never executes model outputs or protected graders and never replaces the original grades. Invalid formats are distinct from proven factual errors. UsefulSupportedAnswers counts supported/partial contracts correctly answered rather than universal abstention. This structured exact-value/source-ID diagnostic does not measure arbitrary free-form hallucinations.

Original failures, preserved without retries or regrading:

| Arm | Task | Repeat | Value correct | Status correct | Citations correct |
|---|---|---:|---|---|---|
| atlias | factuality-absent-count | 1 | true | true | false |
| plain | factuality-failed-verification | 1 | false | false | true |
| atlias | factuality-absent-count | 2 | true | true | false |
| plain | factuality-failed-verification | 2 | false | false | true |
| atlias | factuality-failed-verification | 2 | false | false | true |

Atlias absent-count failures correctly abstained but omitted the contract-required COUNT citation. Failed-verification failures conservatively returned conflict/null instead of the required supported/false from exit status2. These errors do not establish invented facts, improved public hallucination rates or general superiority.

The independent64-call audit and publisher use the SAME frozen ledger SHA256 3da635d0bd09ecce02ebb0814b464a367097c3c8ababa8a8ed8909d10d93bab9. Generated original questions/evidence, complete delivered questions, the new Atlias rule, matching native foundation instructions, actual model/counters, immutable protected graders/evidence and auth removal are audited. No model retries, repairs, regrading or historical control reuse.

This is an authored diagnostic, not AA-Omniscience, TruthfulQA, SimpleQA or ALCE public scoring. Small synthetic evidence records do not establish realistic retrieval quality, universal capability or all model behavior. Claude actual model quality/real OAuth activation and BOTH-host subscription savings remain unmeasured. InferenceWallMs is the sum of native attempt wall times, including failed attempts; it is not time until subscription exhaustion. Token counters and wall time do not establish subscription allowance pricing or the20x goal. A correct answer on a small corpus is neither a release gate nor proof of improvement on unrelated tasks.

Read-only context diagnostics from the same64 rows found bootstrap instruction text of216412 characters for plain versus310788 for Atlias (43.61% more),105 versus108 tool calls,159 versus140 native token-counter samples and116299 versus73344 serialized tool-output characters. These exclude the shared foundation and unavailable HTTP schemas; character counts are not model-token savings or causal attribution. Extra startup instructions and larger returned evidence are concrete candidates for a new controlled intervention. See CONTEXT-DIAGNOSTICS.json.

All32 paired peak-context ratios are retained in PEAK-CONTEXT-PAIRS.json: minimum1.01330, worst1.18714, zero pairs at the20x goal or5x minimum.

The initial full audit stopped on an operator assumption that plain controls should have lean=true. Original plain lean=false was intentional. The corrected independent audit verifies the arm-specific flag and actual native user/developer rule delivery; the initial failure is retained in AUDIT-ASSUMPTION-FAILURE.json. This was not a model protocol fault, and no model call or original grade changed. Operator audit/publisher sources are saved alongside the results for review; they require the original local run artifacts.
