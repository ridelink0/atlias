# The next generation, round three: six fronts read at once, and the two things that outrank everything

Round one (`NEXTGEN.md`) surveyed eleven harnesses and built what was missing.
Round two (`NEXTGEN-2.md`) read the field closely, ranked fifteen items, and
closed four of them while the document was being written. This round did
something neither of those did: it sent six independent research fronts at the
literature at the same time, each with its own question, each required to
separate a measured number from an asserted one, each ending in mechanisms with
a falsifying check attached.

The full reports are on disk, with their sources, and they are long:

| Front | Report | Sources |
|---|---|---|
| Long-context degradation, position bias, cache behaviour | `D:/harness-work/research/ctx-degradation.md` | 30 |
| Agent memory architectures | `D:/harness-work/research/memory.md` | 39 |
| Verification, self-correction, test-time compute | `D:/harness-work/research/verification.md` | 32 |
| Token efficiency, caching, patch formats | `D:/harness-work/research/tokens.md` | 42 |
| Harness control flow, scaffolds, budgets, routing | `D:/harness-work/research/control-flow.md` | 53 |
| What can be measured on this machine, and how | `D:/harness-work/research/evals.md` | 72 |

Six fronts, 268 source entries, and four of the six independently reported the
same hazard in their own tooling: PDF extraction that returned confident
numbers contradicting the paper's own abstract. Those were discarded and the
discards are named in each report. That is worth saying first, because this
document is otherwise a list of numbers, and the numbers are only worth
anything if the ones that were made up were thrown away.

## The two findings that outrank the entire previous ranking

**1. Edit application is the largest harness effect anyone has measured.** A
single adapter diagnostic (Claw-SWE-Bench, GLM 5.1, 350 instances) moved the
same model from **19.1% to 73.4% pass@1** by driving patch apply-failure from
**69.1% to under 1.5%**. Nothing else in 268 sources comes close: +54.3 points
from the plumbing between the model's intent and the file on disk. The token
front corroborates it from the other side - disabling aider's lenient patch
application produced **nine times** the edit errors.

The consequence for atlias is not "add a fallback format". It is that
**atlias had no idea what its own apply-failure rate was**, and neither does
almost anyone else. `deadEdits` existed inside one loop function, was used to
stop a stalled run, and was then thrown away. Counting it is the whole first
move; the ladder of fallback formats is only worth building if the number says
so.

*Built this round:* `state.editTries` and `state.editFails` in `lib/loop.mjs`,
carried into every eval result and printed beside the score, with the field's
own number quoted in the report line when the rate goes above one in ten.

**2. Telling the model how much budget is left is worth more than giving it
more budget.** At a fixed 50-call budget, a disclosed remaining-budget line
bought **+18.6 points** for about **0.38 cents** per trajectory (BATS). The
same table refutes a belief this project held: "diminishing returns past 45
rounds" is regime-specific, and in that setting the curve was still climbing
steeply - **36.8% at 50 calls to 63.0% at 70**. A harness that quietly caps at
25 rounds and never says so is paying twice: once in the cap, once in the
model's ignorance of it.

*Built this round:* `budgetLine()` in `lib/loop.mjs`, appended to the newest
tool result every round and to nothing else, so the cached prefix is untouched;
terse at the start, explicit in the last three rounds, silent on a one-round
run.

## What the measurement front says about every number this project has produced

The eight-task corpus cannot support a percentage. At n=8 the standard error is
about **16 points** and one task flipping moves the score 12.5. Independently,
60,000 trajectories on SWE-bench Verified put single-run pass@1 variation at
**2.2 to 6.0 points**, with a standard deviation above **1.5 points even at
temperature zero**. Most loop changes being argued about are smaller than the
noise of the instrument used to judge them.

Three consequences, and the first two are built:

- **Repeats, and pass^k.** `--repeat 3` runs every task three times; a task
  counts as finished only if every attempt finished. pass@k sits beside it so a
  flaky task is visible rather than averaged away.
- **A stamp on every score.** The harness version, the sha of the two files
  that decide how a run behaves, `-dirty` when either has uncommitted changes,
  the engine, the model, and the round budget. A tree with no git says
  `unstamped` and never invents a sha.
- **Not built, next: grow the corpus.** Aider's polyglot data is 225 Exercism
  exercises - stub files plus a native test command - and while aider's
  *harness* is Docker-gated, the *data* is not. The JavaScript and Python
  subsets need only Node and Python, which this machine has. That is the single
  highest-value unbuilt item on the measurement side, because it is what turns
  the tripwire into a measurement.

And the finding that reframes what to report at all: across three harnesses,
two models and fifty tasks, **pass rate moved only 2-8 points - inside
bootstrap noise - while tokens per solved task differed forty-fold.** A score
with no cost beside it cannot distinguish two harnesses. The eval report now
prints the context it moved and the cost per task finished; it prints characters
rather than pretending to a token count it cannot get from a local engine.

## What the verification front changed

atlias's stop-gate, the thing that holds a reply until a real check has run,
turns out to have a name in the literature now and a measurement behind it.
Evidence-Carrying Termination (arXiv 2608.23623): unsafe completions **0 of 288
against 252 of 288**, premature terminations **0 of 66 against 40 of 66**,
supported completions **up 3.79 points**, for **+$0.0025** and 0.9 extra turns.
RETRACE, from the control-flow front, is the same shape measured on SWE-bench:
**+7.0 and +3.6 points** at a cost ratio **below 1.0**, because the extra turns
hit a warm cache.

The condition both share is the one atlias already enforces and should never
relax: **the agent cannot author its own completion contract mid-run.**

Two negatives from the same front, which are worth as much as the positives:

- **Agent-written tests have no causal effect.** McNemar p between 0.228 and
  1.000, 83.2% of tasks unchanged, and co-refining against them *raised*
  overfitting from 21.8% to 25.5%. Prints outnumber assertions five to eight to
  one. Do not build "the agent writes its own tests and we trust them".
- **Static analysis is not a pass-rate lever.** In LLMloop's per-loop ablation,
  compile feedback was worth **+4.75** points, tests **+3.11**, static analysis
  **+0.06**. Lint gates are hygiene, not score.

And one calibration warning that belongs in every report this project ever
prints: **10 to 20 per cent of test-passing patches are semantically wrong**
(19.78% rejected by SWE-ABS, about 11% by PatchDiff, 10.7% "lucky passes"). A
check exiting zero is the best signal available and it is not proof.

## What the memory front changed, and it is uncomfortable

atlias's memory is exactly the architecture that was measured: one fact per
file, curated, with an index. In the only longitudinal head-to-head (Ground
Truth First, 383 script-valid questions) that design is the **best** short
answer - 94.2% against 93.2% for a graph and 91.0% for vectors, with 15.2% for
no memory at all - and the **worst** long one: early-fact recall falls from
96.3% to **72.2% by week nine**, while a provenance-typed graph climbs to
90.4%. The crossover is around week six. The mechanism of the decay is
**eviction under budget**, not retrieval quality.

Three measured fixes, none of which require becoming a graph:

- **Render age and source on every recalled fact.** Stale memory is worse than
  none: 14.4% success and 74.4% death against 28.8% and 28.0% with no memory,
  "2.7 times deadlier", and capable models rely on it hardest. Exposing age was
  measured at **+0.53 to +0.54**.
- **Supersede and link, never overwrite.** The decay is early facts being lost,
  so a contradiction must add a newer fact that points at the older one.
- **Curate at recall, not at write.** Read-time curation beat RL-trained
  write-time curators by **+16.2** on ALFWorld and **+16.3** on WebShop with
  50-56% fewer input tokens, and held zero-shot, so the gain is the deferral
  rather than the training.

One thing not to build: **provenance as a score bonus.** At the shipped weight
it was "statistically indistinguishable from no defence (p=0.80)", 1.2% poison
took accuracy from 0.850 to 0.300, and four-stage write screening refused
**none of 360** false facts. Provenance has to be a hard read gate or it is
decoration.

## What the context front changed

- **Length alone hurts, and it is not about distractors.** Five models, 13.9%
  to 85% degradation inside their claimed windows, persisting when irrelevant
  tokens are masked to whitespace. The cheap fix that came with it - recite the
  retrieved evidence before solving - was **+4%** on RULER.
- **Recognition survives long context; repair does not.** LongCodeBench:
  agentic repair **29% at 32K to 3% at 256K** for one model, while
  multiple-choice comprehension *rose* from 72.6% to 80.0% out to 1M. A harness
  that reads a context-window number off a spec sheet is reading the wrong
  number. What it needs is a per-model *effective* limit for the work it is
  doing.
- **Position bias is now per-model rather than universal**, and one paper
  claims lost-in-the-middle is largely resolved while another measures a clear
  U-shape on a 2026 model. The disagreement is reported rather than resolved.
- **Compression always costs something.** Keep-all **55.17%** beat the best
  compressor at 53.17%, summarisation 51.17%, sliding window 49.83%, masking
  47.17%. Compaction turned reliable tasks intermittent (termination 77.2% to
  44.6%), and Claude Code's own `/compact` preserved **53%** of safety rules
  after one round and **10%** after five. Governance decay is measured: rule
  violations went from 0% to 30% after compaction, 0% when the rule survived
  the summary, 38% when it was dropped, and pinning restored 0%.
- **High recall is not the goal.** +7.2 points of gold-file recall bought
  **-7.6 points** of resolve rate (n=500, p=0.0003); retrieve-on-demand beat
  stuffing 41.7% to 36.1%.

Read together with the token front, the discipline is: **append, never rewrite;
truncate or drop, never summarise; never compact a compaction; and pin the
invariants across every boundary.** atlias's block eviction already protects
the prefix between block edges. What it does not yet have is a pinned invariant
set that survives every cut, and that is now the top context item.

## Ranked, what to build next

Everything above the line is either built this round or is next, with the file
and the check named. Items already closed in round two are not repeated.

**Built this round.** (1) The apply-failure counter, carried into the eval
report. (2) `budgetLine()`, disclosed every round on the newest message only.
(3) The harness stamp: version, sha, dirty, engine, model, budget. (4) Repeats
with pass^k beside pass@k. (5) A round budget that lives in the task file.
(6) Tamper detection: the files that grade a task are compared against what the
task shipped, and a pass bought by editing or deleting the checker is refused
and named - with `findWeakenedTests` taught to recognise a bare `test.mjs` and
an unconditional success exit, which it could not see before. (7) The
ImpossibleBench-shaped task, with an honest route that passes and a forced route
that cannot. (8) A runner bug the new meta-test found: two un-awaited async
suites ran at once and one suite's checks were counted under the other's name.

**1. Pinned invariants across every eviction and compaction boundary.**
Measured: violations 0% to 30% after compaction, 0% when the rule survived.
*Files:* `lib/loop.mjs` (`view`, `ingest`, `compact`), `test/agent-suites.mjs`.
*Check:* a named invariant string is present in the view after enough evictions
to have dropped everything else, and a compaction that would drop it is refused.

**2. The Aider polyglot corpus in atlias's own task format.** 225 exercises,
stub plus native test command, no Docker. Start with the JavaScript and Python
subsets.
*Files:* a converter under `tools/`, `evals/` output, `lib/eval.mjs` (a corpus
directory flag), `test/eval-suites.mjs`.
*Check:* every converted task fails before the work and passes when the
reference solution is dropped in; the converter refuses a task whose test
command this machine cannot run, rather than shipping a task that fails for the
wrong reason.

**3. Paired statistics for any A/B.** McNemar plus a paired bootstrap, and the
comparator validated against itself - the same configuration twice must return
p > 0.05.
*Files:* `lib/eval.mjs` (a compare entry point), `bin/atlias.mjs`,
`test/eval-suites.mjs`.
*Check:* two identical scripted runs report no significant difference; a run
where one configuration passes a task the other fails reports the pair.

**4. A per-model effective context limit, and compaction arithmetic that uses
it.** Not the advertised window: the length at which *repair* degrades.
*Files:* `lib/core.mjs` (a per-engine limit), `lib/loop.mjs` (`compact`),
`test/agent-suites.mjs`.
*Check:* a small declared limit compacts where a large one does not; an unknown
limit falls back to today's fixed keep rather than compacting every turn.

**5. Age and source on every recalled memory, and supersede-and-link on
contradiction.** Measured +0.53 for exposing age; stale memory measured worse
than none.
*Files:* `lib/dream.mjs` or the memory writer, `mcp/tools.mjs`
(`harness_recall`), `test/unit-suites.mjs`.
*Check:* a recalled fact carries its age; a contradicting write adds a new fact
that links the old one and never rewrites it in place; a fact older than a
threshold is rendered with its age in the line the model sees.

**6. An edit-format ladder, gated on the number.** Exact match, then whitespace
tolerant, then anchored, then whole-file - but only if the apply-failure rate
the new counter reports is above about one in ten. The research is explicit that
a harness already under 2% gains little.
*Files:* `lib/loop.mjs` (`edit_file`), `test/agent-suites.mjs`.
*Check:* an edit whose indentation differs applies, and the result says it
matched loosely; the rate falls on a repeat run of the same corpus.

**7. A cache ledger with regime detection.** The token front found a
119,866-call instrumented study where a silent TTL regression cost 17.1%. The
TTL is an observable, not a setting.
*Files:* `lib/loop.mjs` (`cacheReading`), `lib/bench.mjs`,
`test/agent-suites.mjs`.
*Check:* the ledger reports hit rate per session and flags a run whose hit rate
falls below its own recent median.

**8. Semantic stuck detection.** atlias has exact-repeat and alternating-pair
detection. OpenHands compares *semantically* over a 20-event window with 4/3/3/6
constants. No measured pass-rate delta exists for it anywhere, which makes it a
gap atlias could actually fill with its own A/B once item 3 exists.

**Explicitly not building, with the reason.** Agent-written tests as authority
(no causal effect, raises overfitting). Static-analysis gates for score (+0.06).
Per-turn model routing on coding work (every router measured negative on
SWE-bench; the one positive design routes once, late). Symmetric debate (scores
below single-agent under sycophancy). Provenance as a scoring bonus
(indistinguishable from no defence). Write-time memory abstraction (beaten by
read-time curation). Recall-maximising retrieval (bought recall, lost resolve).

## The A/B this round set up by accident, and how it will be judged

The baseline run started before the two mechanisms landed and therefore measures
the loop without them; the same command after them measures the loop with them.
That is a real before-and-after on one model, one corpus, one attempt each - and
by this document's own standard it is a tripwire, not a result. It will be
reported as what it is: nine tasks, n=1, against a 7B local coder model, with
the stamp naming both shas. Item 3 is what turns it into a claim.

## Could not be verified

- The "76.8% versus 77.6% under Opus 4.5" pairing that circulates for mini-swe-agent: three fetch attempts, no primary source.
- OpenAI's SWE-bench retirement figures: openai.com would not serve the page.
- The Ramp internal benchmark: JavaScript-rendered, no content.
- SWE-bench+ reports two different pairs of numbers across versions; one has to be chosen and cited rather than averaged.
- A "49 to 741 tools" citation attributed to Kate et al. appears not to exist.
- Whether delegation to a subagent pays off: no published break-even for coding work. atlias can measure its own, and should.
- atlias still has no score against any public benchmark. That sentence has been true in all three of these documents.
