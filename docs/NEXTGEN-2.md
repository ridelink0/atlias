# The next generation, round two: the field read closely, and what survived reading it

Research run overnight 2026-09-24 into 2026-09-25 for Gev. Four research agents
and eleven adversarial verification passes; the writing stage was cut off by
the session limit, and this is that writing, done afterwards from their saved
output.

Read [NEXTGEN.md](NEXTGEN.md) first. This document does not repeat it. Where
the two touch the same claim, this one carries the correction and says so.

Three rules were kept while writing it:

- **Every claim names the source the researcher actually fetched.** A URL means a
  page fetched in that session; a `file:line` means a file read on this machine.
  Where a claim came from a search snippet and nothing more, it is in
  [Could not be verified](#could-not-be-verified) and nowhere else.
- **A claim that did not survive verification is in here as a claim that did not
  survive.** Nothing was quietly dropped. [What verification refuted or
  corrected](#what-verification-refuted-or-corrected) is the section to read if
  you only read one.
- **Every statement about atlias's own code was re-checked against the working
  tree on 2026-09-25**, after the research ran, because the repo moved underneath
  it - and then re-checked again, because it moved underneath that too. atlias
  code is cited here **by function name and file, never by line number**:
  `lib/loop.mjs` went from 966 lines during the research to 1152 when this
  document was started and 1236 before it was finished, as a second agent worked
  through `lib/` and `evals/` in parallel. Every line number the research
  recorded was already wrong by the time it could be written down. Sources
  outside this repo keep their line numbers, because those files are not moving.

## What changed under the research while it ran

This matters before anything else, because it moves the baseline the plan below
starts from. [NEXTGEN.md](NEXTGEN.md) ends with three ranked items still to
build, and a five-item list in the relay hand-off. **All five are now in the
tree**, uncommitted, built by the concurrent agent during the same night:

| NEXTGEN item | Where it now lives |
|---|---|
| Ingestion-aware capping | `ingest()` at `lib/loop.mjs`, a per-tool budget through `budgetFor`, and the summary line written once at the gate rather than recomputed later |
| A cache-hit readout | `countCache()` called in `runLoop` at `lib/loop.mjs`, surfaced by `cacheLine()` through `statusText` at `lib/agent.mjs`, four provider shapes parsed in `cacheReading()` at `lib/loop.mjs` |
| Pointer-first enforcement | `lib/pointer.mjs`, with `test/pointer-suites.mjs` |
| Skills | `lib/skills.mjs`, with `test/skills-suites.mjs` |
| A git-worktree sandbox | `lib/sandbox.mjs`, reachable as `--sandbox` on `agent`, `exec` and `resume`, with `test/sandbox-suites.mjs` |

The eval corpus grew with it, from three near-identical JS fixes to eight tasks
each carrying a `kind`: `failing-test`, `new-function`, `no-regression`,
`multi-file`, `read-first`, `no-change`, `misleading-error`, `linter`, with a
check in `test/eval-suites.mjs` that fails the run if a kind goes missing.

One consequence is worth stating plainly rather than leaving implied: some of
the research findings below were true when they were written and are false now.
Each is marked where it appears.

**And then it happened again, during this document.** Between the first draft
of the plan below and this paragraph, the same agent landed four more of the
things the research had found missing:

- **Typed stop reasons.** `stopWith()` in `lib/loop.mjs` sets `state.stop = {
  reason, detail }`, and every exit from `runLoop` now goes through it:
  `answered`, `model-error`, `rounds-exhausted`, plus two new ones,
  `truncated-output` and `malformed-output`, chosen by `stallReason()`.
- **Finish-reason handling.** `openaiChat` now reads `choice.finish_reason` and
  returns `finish` and `truncated`; `ollamaChat` reads Ollama's own
  `done_reason`; `isTruncated()` decides. A reply the provider cut off has its
  tool calls refused rather than executed, with the reason given to the model.
- **A consecutive-bad-reply counter.** `bad` with `agent.maxBadReplies` (3),
  counting three kinds through `BAD_REPLY` - a block that did
  not parse, an edit that did not apply, a reply cut off at the output limit -
  cleared by any round that produced a tool result.
- **Spilling cut output instead of destroying it.** `spill()` writes the whole
  over-budget result under a folder in `STATE_DIR`, `ingest()` calls it, the
  header names the path, and a sweep keeps the folder from growing without end.

So four of the plan items drafted an hour earlier were already built before the
draft was finished. They are recorded below as closed, with what is left of
each, because a plan that lists finished work is worse than no plan.

## What the field does that atlias does not

### In the loop

**A typed stop reason, not a sentence.** mini-swe-agent counts consecutive
model-output format errors on its own counter, separate from step, cost and
time limits, and exits with a distinct machine-readable `exit_status`
(`RepeatedFormatError`, `LimitsExceeded`, `TimeExceeded`) that a benchmark can
branch on: `if 0 < self.config.max_consecutive_format_errors <=
self.n_consecutive_format_errors: ... 'exit_status': 'RepeatedFormatError'`
(`D:/harness-work/mini-swe/minisweagent/agents/default.py`).

When the research read it, atlias had one budget, `agent.maxToolRounds` (25 by
default, in the `agent` defaults of `lib/core.mjs`), returned prose, and
`badBlocks < 2` re-prompted twice on an unparseable block and then let the
third malformed reply through as the final answer. **Closed in the tree
since:** `stopWith()` now attaches a typed `state.stop` to all five exits, and
the bad-reply counter replaced the fall-through. The prose is still there,
which is right - a human in the REPL needs the sentence - it is now accompanied
by a reason a machine can branch on.

**And then the measurement half closed too, an hour later.** When the plan
below was drafted, `lib/eval.mjs` did not read `state.stop` anywhere, so
`runTask()` recorded a run that exhausted its rounds as an ordinary reply and
the report printed `score()`'s verdict, `the check exited 1`, for a run where
the model never answered at all. It reads it now: `runTask()` records
`st.stop`, falling back to `crashed` when `runLoop` threw and `unknown` when
there is nothing, and `format()` prints `stopped: <reason>` on every line. Out
of rounds and wrong answer are now distinguishable in the eval output, which
was the single highest-value item on the first draft of this plan.

**One counter for every recoverable failure.** Aider caps a malformed edit
format, a failing lint and a failing test under one shared reflection counter,
`max_reflections = 3`, re-prompting with the error each time and stopping at
the cap: `if self.num_reflections >= self.max_reflections:
self.io.tool_warning(f"Only {self.max_reflections} reflections allowed,
stopping.")`
(<https://raw.githubusercontent.com/Aider-AI/aider/main/aider/coders/base_coder.py>,
fetched in session). When the research read it, atlias bounded identical calls
(`guard.loopThreshold`), an A-B-A-B alternation, bad blocks and total rounds,
each separately, with no shared cap. **Mostly closed in the tree since:** the
`bad` counter in `runLoop` now spans three kinds and resets on any productive
round, which is Aider's shape.

**What is left is narrower and exact.** The counter measures replies that
produced nothing usable. A repair attempt that *did* produce a result and still
failed does not touch it: reading the loop, a guard refusal on any non-edit
tool increments `produced`, not `bad`, and so does a check command that ran and
exited non-zero. So a model that runs a failing test ten times in a row, or is
refused by the loop guard ten times on a `grep`, still only meets the round
budget. Worth having on the record; low value next to items 3 through 6.

**A truncated tool call is refused, not executed.** pi-mono reads the stop
reason and, when the turn was cut off by the output-token limit, fails every
tool call parsed from that message rather than running it: `Tool call "{name}"
was not executed: the response hit the output token limit, so its arguments may
be truncated. Re-issue the tool call with complete arguments.`
(`D:/harness-work/pi-mono/packages/agent/src/agent-loop.ts:244-267,469-497`).
Aider treats `finish_reason == "length"` as its own case too. When the research
read it, atlias read neither: a grep for `finish_reason`, `finishReason` or
`stop_reason` across `lib/` returned nothing at all, and `openaiChat` took
`r.json.choices[0].message` and never looked at the sibling field. A JSON tail
cut mid-object can still balance and still validate, and it would have run.
**Closed in the tree since, and closed better than the finding asked for:** in
`lib/loop.mjs`, both engines report it now - `openaiChat` from
`choice.finish_reason`, `ollamaChat` from Ollama's own `done_reason` -
`isTruncated()` decides, the tool calls in a cut-off reply are refused with the
reason handed back to the model, and a run that only ever gets cut off stops
with its own reason, `truncated-output`, rather than being folded in with a
model that cannot format an action. Nothing left to do here.

**Compaction sized from the model's real context window.** opencode computes
usable context as the connected model's own input limit minus a reserved output
budget and compacts when the total reaches it: `return input.model.limit.input
? Math.max(0, input.model.limit.input - reserved) : ...`
(`D:/harness-work/opencode/packages/opencode/src/session/overflow.ts:1-30`).
atlias's `compact(state, keep = 8)` in `lib/loop.mjs` keeps a fixed count of
messages regardless of the model attached or how large those messages are, and
is only ever invoked by hand from the `/compact` command.

**Cut output spilled to a file rather than destroyed.** goose writes any tool
result over its size limit whole into a temp file and hands the model the path:
`The response returned from the tool call was larger ({} characters) and is
stored in the file which you can use other tools to examine or search in: {}`
(`D:/harness-work/goose/crates/goose/src/agents/large_response_handler.rs:5-70`).
When the research read it, atlias's `elide()` and `capOutput()` kept a head and
a tail and discarded the middle permanently, and the note told the model to
narrow the command - advice it often cannot take, because the thing that would
tell it how to narrow was in the part that was cut. **Closed in the tree
since:** `spill()` writes the whole result under a spill folder in `STATE_DIR`,
`ingest()` calls it for anything over budget, and the header names the path so
the model can `grep` or `read_file` it. Two judgements in that implementation
are worth recording because they are easy to get wrong and were got right:
`read_file` is exempt, since the file it came from is already on disk and a
second copy is waste; and the path is appended after the header is clipped,
never inside it, so a truncated note can never send the model to half a path.

**Steering inside a turn.** pi-mono polls a `getSteeringMessages()` hook at the
start of a loop, during long-running preparation, and after tool execution, so
a message typed mid-run is folded in without waiting for the turn to end
(`agent-loop.ts:174-204,294`, wired end to end through `agent-session.ts:344,
1878-1880, 2059-2061` to the interactive REPL). atlias's REPL is one blocking
`rl.question` per turn (`lib/agent.mjs`), and a grep of `lib/loop.mjs` and
`lib/agent.mjs` for `steer` or `interrupt` finds only `interrupted:
Boolean(...)` on the integrity verdict, which is a subprocess signal and
unrelated. Verification found the real blocker, which the research had
understated; see the correction below.

### In the prompt, and in the cache

**Anthropic caches nothing unless the request asks.** Cache prefixes are built
`tools, system, then messages`, and `Changes at each level invalidate that
level and all subsequent levels`; the lookback window is 20 blocks; the
breakpoint goes on `the last block whose prefix is identical across the
requests`, never on a block holding a timestamp or the incoming message
(<https://platform.claude.com/docs/en/build-with-claude/prompt-caching>).
atlias has no Anthropic-native engine to apply this to: `grep -rn
"cache_control" .` returns zero hits and `lib/loop.mjs` ships only `openaiChat`
and `ollamaChat`. `cacheReading()` already parses an Anthropic-shaped usage
object, so the reporting path anticipates an engine the repo has not written.
If one is ever added, an OpenAI-style assumption that a stable prefix is enough
would buy zero cache hits at full price.

**OpenAI's automatic caching is reset by more than the messages.** `Settings
that reset the prefix: model selection; tools (names, schemas, ordering,
descriptions); parallel_tool_calls; text.format (Structured Outputs schemas);
reasoning.effort; text.verbosity; context_management (Compaction).`
(<https://developers.openai.com/api/docs/guides/prompt-caching>). atlias builds
`toolSchemas(hasGraph)` from a deterministic table per call, which is stable
within a session as written; the thing to keep true is that no future feature
toggles a tool's availability mid-session, because that alone would blow the
cache for every call after it.

**Gemini caches implicitly and wants the bulk first.** `Implicit caching is
enabled by default for all Gemini 2.5 and newer models... Try putting large and
common contents at the beginning of your prompt.`
(<https://ai.google.dev/gemini-api/docs/caching>). atlias reaches Gemini only
as a host, where the host manages its own caching, and the `GEMINI.md` block it
writes through `instructionBlock()` is static and idempotent already. Noted
because the guidance is satisfied by the existing design, not by anything in
atlias that knows about caching.

**Lost-in-the-middle is solved for the easy case only.** Simple single-fact
retrieval now holds up at extreme lengths, and the same source says the harder
shapes do not: `No paraphrased or ambiguous queries are tested... more complex
forms of failure remain such as in multimodal or multi-needle [retrieval]`
(<https://arxiv.org/html/2511.05850v1>), and position-bias correction closes
only part of the gap: `debiasing improves accuracy by 8.67 percentage points
but remains 14.84pp behind iterative sorting, closing only 37% of the gap`
(<https://arxiv.org/abs/2606.27793>). This is direct evidence for the
pointer-first design rather than dumping files into context and trusting the
model to find the part that matters.

**Schema-valid is not the same as correct.** Across 21 models, one reached
`99.97% JSON Pass Rate, yet its Perfect Response Rate is only 0.486, about a
51-point gap`, and the authors attribute the gap to hallucinated leaf values
inside structurally valid objects, which `are harder to detect than in
free-text... because they look structurally correct`
(<https://arxiv.org/html/2604.25359v1>). atlias's `normalizeCall`/`repairJson`
solve the structural half unusually well for a hand-rolled harness. One tool
gets the semantic half almost free: `edit_file`'s requirement that `old_string`
match exactly once means a plausible-but-invented string simply is not found.
`grep`, `shell` and `graph_query` have no such accidental guard. This is a real
gap and a low-value one; it is in the plan near the bottom for that reason.

**Constrained decoding fixes structure and nothing else.** Small models go from
`78.6-92.9% schema validity` natively to `100% schema validity` under grammar
constraint, but `for instruction-semantic failures, CD offers no benefit - a
larger model or improved prompting is required`, and the smallest model still
emitted one tool call where the task needed two
(<https://arxiv.org/html/2609.23742>). `ollamaChat()` in `lib/loop.mjs` sends
`{model, messages, stream: false, options: { temperature: 0.2 }}` and no
`format` field, which is Ollama's own name for this. There is a catch the
research did not name and the plan below does.

**A tool table a human cannot disambiguate is a design failure.** `If a human
engineer can't definitively say which tool should be used in a given situation,
an AI agent can't be expected to do better.`
(<https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>).
atlias's table is compact and mostly disjoint. The one place it fails the test
is the system prompt's own hedge, preferring `edit_file` `or with apply_patch
if you know that patch format` - which asks a weak model to judge its own
competence.

### Frontier ideas, and which of them can exist here

None of the four below is reproducible on this machine. They are in the
document because the reason each one cannot be reproduced tells you what the
honest, much weaker local version is - and because writing the weaker version
down as if it were the paper's technique is exactly the failure this document
is meant to avoid.

**Harness-R1** post-trains `a dedicated harness engineer with online
reinforcement learning` that edits `the agent harness that constructs context,
mediates tools, validates actions, and recovers execution`, raising one agent
`from 44.3% to 53.6% (+9.3 percentage points)` with `a separate 9B engineer`
converting batches of a frozen target's failures into validated patches
(<https://arxiv.org/abs/2608.02276>). It needs a second model and a GPU
training loop. The honest local analogue is not a learned editor at all: it is
a failure ledger the gate appends to, read by a human. No ledger exists today:
`grep -rn "failures.jsonl\|ledger" lib/ docs/` returns nothing.

**Ouroboros** is a self-developing agent whose `tools, prompts, context
assembly, and core implementation improve through reviewed commits that become
the runtime for later work`, deployed 161 days
(<https://arxiv.org/abs/2608.08311>). The architecture - worktree isolation, an
eval gate, a review gate - is the one atlias already has in three files:
`lib/sandbox.mjs`, `lib/eval.mjs`, `lib/gate.mjs` with `lib/integrity.mjs`. Two
corrections to how it was first written up are below.

**Skill1** trains one policy to select a skill from a library, solve with it
and distil a new one, where `all learning derives from a single task-outcome
signal` (<https://arxiv.org/abs/2605.06130>). The released code needs `vllm`,
`flash-attn`, `verl`, GRPO on a 7B checkpoint and two Conda environments, which
is the opposite of this repo's constraints. The deterministic analogue - write
a winning tool-call sequence and its check command into a store keyed by task
signature, and surface it later as a suggestion, never an action - is the one
idea here that NEXTGEN.md's list does not already cover. One correction: the
researcher proposed writing it into graphify, and atlias only ever *reads*
graphify (`lib/graph.mjs` exposes `query`, `sub`, `updateNow` and no write).
The writable store atlias has is shared memory, through `harness_remember`.

**A latent critic** that reads hidden states to catch tool-call hallucinations
before execution reports `0.966 AUROC` (<https://arxiv.org/abs/2608.10430>) and
needs white-box access to model internals. atlias sees text and tool I/O and
never latent state, in every host it runs in. This one is not a matter of
effort; it is a matter of the inputs not existing here. The conclusion is to
keep investing in the black-box gate.

Three more, each arguing against work rather than for it:

- **Orchestration usually does not pay.** Self-Refine, Best-of-N and Debate
  across five models and three domains: `the largest improvement is 4.6
  percentage points over optimized CoT inference`, at two to four times the
  tokens (<https://arxiv.org/abs/2608.00685>). Keep escalation opt-in and
  gate-triggered; do not build an automatic N-way ensemble.
- **Learned routing needs a trained scorer.** ProgRouter routes each step with a
  `multi-view task progress scorer that combines coarse workflow outcome regimes
  with fine-grained signals on subtask completion, progress trends, and workflow
  state quality` (<https://arxiv.org/abs/2608.25992>). atlias's `--engine` plus a
  hand-written rule table is the buildable version, and must be called a rule
  table.
- **Budget awareness stays weak even trained.** BAGEN measures a
  capability-versus-budget-awareness correlation of `r=0.35`, saves 28-64% of
  tokens on failed trajectories by early stopping, and reports `interval coverage
  capping at 47% after SFT+RL` (<https://arxiv.org/abs/2606.00198>). A linear
  projection of tokens per completed todo item is the crude local version, and
  must not be called budget-aware planning.

One is smaller than its paper and therefore buildable. **Deterministic replay**
(agrepl) intercepts all external interaction at the transport layer through a
MITM proxy and replays with no network, `implemented in Go, ships as a single
static binary, and is released under the MIT licence... replay fidelity: F =
1.0... median per-step improvement of 98.3%`
(<https://arxiv.org/abs/2607.16200>). atlias needs no proxy: it is the process
making the calls. Logging each outbound request and response as JSONL beside
the session files, with a `--replay` flag that serves them back, is Node
built-ins only. `grep -rn "replay" lib/ bin/` returns nothing today.

And one is only a taxonomy: the self-evolving-coding-agents survey
(<https://arxiv.org/abs/2608.03392>) presents no mechanism and no numbers of
its own, and is useful only for classifying what atlias already does - the
handoff note and progress file are memory evolution, the skill reader is skills
evolution. It is named here so nobody cites it as a result.

### How a harness change should be judged

This is the half of the research that changes how the plan below is written,
not what is in it.

**The harness moves the score more than the model does.** Harness-Bench
isolates the effect with 106 sandboxed tasks, 8 categories and 5,194
trajectories, holding tasks, budgets, timeouts and evaluators fixed and varying
only the harness: harness-only scores span `52.4%-76.2%`, a 23.8-point spread
(<https://arxiv.org/html/2605.27922v1>). NEXTGEN.md already records the
first-hand factorial result from a second paper - harness-induced variance
7.80x model-induced variance - and its correction; both are in
[NEXTGEN.md](NEXTGEN.md) and are not repeated here.

**A change tuned on the tasks that score it is not measured.** The protocol:
split the corpus into train, validation and held-out test - `we split
Terminal-Bench 2.1 into 45 training tasks, 10 validation tasks, and 34 held-out
test tasks` - compare against test-time-scaling baselines under a matched
budget, run each configuration at least twice and average
(<https://arxiv.org/html/2607.12227v2>). atlias's eight tasks are currently
both the thing the scoring logic was written against and the only thing a loop
change could be judged on.

**One run is not a result.** pass@k and pass^k diverge hard: at 70%
single-attempt success, `pass@3 approximately 97% but pass^3 approximately
34.3%` (<https://www.philschmid.de/agents-pass-at-k-pass-power-k>). `runSuite`
in `lib/eval.mjs` runs each task exactly once and the word repeat does not
appear in the file.

**The dockerless design is a position, not an apology.** `lib/eval.mjs`'s
scratch workspace per run, task files written in, real files edited, and a
check command's exit code as the only verdict, is the same category of approach
as published 2026 work on environment-free verification for coding agents
(cross-referenced against <https://arxiv.org/pdf/2606.28436>, abstract only).
Worth documenting as a choice.

**And the public suites stay ruled out, twice over.** SWE-bench's own harness
page: `This section documents the Docker-based evaluation harness`, three
layers of images, and `Storage: At least 120GB free space (for any cache
level)` (<https://www.swebench.com/SWE-bench/reference/harness/>), covering
SWE-bench, Lite and Verified alike. Terminal-Bench is the same shape and
already recorded in NEXTGEN.md. On this machine, checked again today: `docker`
is not a recognised command, and C: has **10.86 GiB free** of 237.57 GiB. The
researchers measured 11.38 and about 11.5 GiB hours apart, so the number is
falling, not rising. Either blocker alone is sufficient, and the gap is more
than tenfold.

## What verification refuted or corrected

Eleven claims went to an adversarial pass with instructions to refute them.
Every one of the eleven came back as holds or holds-with-a-correction; none was
refuted outright. Three had a correction that changes what should be built, and
those three are first.

**1. The instruction-conflict mitigation was refuted, and it was the research's
own recommendation.** The diagnosis holds: `the most competitive open-source
model only achieves 48% accuracy in resolving such conflicts... All evaluated
models experience a sharp performance decline when facing conflicting
instructions` (IHEval, <https://arxiv.org/abs/2502.08745>). The proposed fix -
restating the override rule near the end of context through the `recitation()`
suffix - is close to what that same paper already tested in its Section 4.4, an
explicit instruction-priority prompt, and its finding was `This additional
prompt does not bring noticeable improvements to model performance`, with
mixed-to- negative effects; its Limitations section says it proposes no working
solution. Two further corrections to the number itself: the 48% is Qwen-2-72B
aggregated across the Conflict setting of all nine tasks, not an isolated
system-versus-user metric, and **no gemma model and nothing under 7B was
evaluated**, so applying it to atlias's default `gemma3:4b` (the `agent`
defaults in `lib/core.mjs`) is extrapolation. So: the problem goes in the plan
as real and sourced; the fix does not go in the plan as supported. If it is
built, it is an untested hypothesis that runs against the one directly
comparable ablation in the literature, and atlias would have to measure it on
its own corpus.

**2. Ouroboros's headline numbers do not demonstrate self-development, and
"reviewed" does not mean a human.** Both corrections come from the paper's own
text. Every benchmark run - Terminal-Bench 2.1 at 86.74%, OSWorld-Verified at
90.69%, CL-Bench at 0.2301 - was configured `evolution off`, so those scores
show the underlying agent is capable on a frozen snapshot and say nothing about
whether self-development improves it. The only evidence for the mechanism is
the 161-day deployment and a `63.5%` recent review block rate. And the gate is
`A diff-review panel... for reviewed commits; a sub-quorum result cannot be
recorded as a clean pass` - an LLM quorum, not a human sign-off per commit.
Humans surface faults upstream. If the atlias version requires a human to
approve a merge, that is atlias choosing to be stricter than the paper, not the
paper's design. **Do not write that self-modification improved performance.**
No before-and-after on the live lineage was found.

**3. The OpenHands critic finding was mis-cited, and the spike it proposed is
not new work.** The quoted sentence `Run OpenHands, Claude Code, Codex, Gemini,
or any ACP-compatible agent` is at `D:/harness-work/openhands/README.md:10`,
not at `package.json:2-9` as the research recorded; the package manifest holds
only the name and a one-line description. The substance holds and is worth
having: the orchestrator-over-backends shape matches atlias's
sub-harness-over-hosts design. The critic is real and tested rather than a
mockup - `score: number; /** Predicted probability of success (0-1) */`,
`agent_behavioral_issues?: CriticFeature[]; /** Agent behavioral issues (e.g.,
insufficient testing, loop behavior) */` in `critic.ts:1-48`, with `name:
"loop_behavior", display_name: "Loop Behavior", probability: 0.6` as live test
data in the display test and rendering gated on `event.critic_result != null`.
But the recommendation - a spike into whether the gate could report named
categories - describes something atlias already does: `check()` in
`lib/integrity.mjs` emits named flags `passclaim`, `doneclaim`, `stubs`,
`weakened`, `unwired`, each with its own explanation. The genuinely open
question is much narrower, and harder: whether `verdict()` in
`lib/integrity.mjs`, whose only inputs are an opaque exit code and text from a
command atlias did not write, can be split into a few honest outcomes -
command-not-found, assertion failure, timeout - without guessing. `check()`
reads a diff it controls; `verdict()` does not.

The remaining corrections are narrower but belong on the record.

**4. Anthropic caching has two modes, so "requires explicit breakpoints"
overstates it.** The docs describe automatic caching, one top-level
`cache_control` field with the system moving the breakpoint forward, alongside
explicit per-block breakpoints capped at four. The load-bearing part survives:
unlike OpenAI, where caching happens with no request change at all, every
Anthropic mode needs the developer to add at least one field.

**5. The GPT-4.1 reminders appear once in atlias, not twice.** The source holds
exactly as quoted - the three reminders, the internal `close to 20%` SWE-bench
Verified figure, and `place your instructions at both the beginning and end of
the provided context`
(<https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide>). The
atlias-side framing was wrong: `lib/brief.mjs`'s `RULES` is a different,
atlias-specific set (graph-first lookup, no repeated calls, done means
verified, `harness_progress` on a plan change), not a second copy of the triad.
Only one of its lines loosely echoes verify-before-done. And the sandwich
pattern as measured wraps instructions around one long static context block;
re-injecting a rule periodically across a growing conversation is an adaptation
of the principle, not a replay of the experiment, and should be described that
way if it is built.

**6. The scaffold-effect numbers are pass-through citations.** Carried here so
the two documents do not disagree: both headline figures in
<https://arxiv.org/abs/2605.23950> are quoted from elsewhere, and the number to
cite is that paper's own factorial experiment. The full correction is already
in [NEXTGEN.md](NEXTGEN.md).

**7. "One fresh container per instance" is not in SWE-bench's words.** The page
supports Docker, the three image layers, `isolated evaluation for each task`
and `Prepare Docker images for each instance`, and 120GB at any cache level. It
never says that phrase. Marked unverified-as-worded; everything else in that
claim is exact.

**8. Mid-turn steering is blocked by something the research did not name.** The
mechanism and the absence both verified. The correction is the size: atlias's
shell tool runs `spawnSync(cmd, { shell: true, ..., timeout: 10 * 60 * 1000 })`
in the shell branch of `runTool()`, which blocks Node's event loop for up to
ten minutes, so no queue, timer or stdin event can fire during exactly the
moment a user most wants to redirect - a hanging build, a runaway test. Any
real fix needs `spawnSync` converted to async `spawn` with piped stdio as a
named first step, not just an input channel wrapped around it. Also, the
analogy to pi-mono's compaction checkpoint does not map: atlias has no
automatic compaction inside `runLoop` at all.

**9. Three claims came back clean.** Harness-R1 matched its abstract element
for element with exact numbers. Skill1 matched near word for word, and its
not-reproducible clause was found understated rather than overstated. Terminal-
Bench needed no correction.

**10. And one finding was true when written and is false now.** The research
recorded that `cacheReading`/`countCache`/`cacheLine` existed with zero call
sites anywhere in the repo, which was accurate at the time - it even caught
`lib/loop.mjs` growing from 966 to 1136 lines mid-session under the concurrent
agent. It is wired now: `countCache(state, res.usage)` inside `runLoop`,
`cacheLine(state.cache)` through `statusText()` in `lib/agent.mjs`, with the
provider shapes and the readout covered in `test/agent-suites.mjs`. That closes
NEXTGEN.md's ranked item 2, so it does not appear in the plan below.

## Ranked, what to build next

Smallest and highest value first. Every item names the files it would touch and
the test that would prove it. This document writes the plan; it implements none
of it.

**Items 1, 2, 7 and 9 were built by the concurrent agent between the first
draft of this list and this version of it.** They are kept in place, marked
**closed**, with what is left of each, rather than deleted - because a ranking
is only worth reading if you can see what it got right, and because each has a
small remainder that would otherwise be lost. Items 3 through 6, 8, and 10
through 15 were verified still open against the tree at the time of writing.
The numbering keeps its original order.

**Before the list, and before any claim that an item helped:** run the eight
tasks through one real engine and record the numbers. `atlias eval --engine
ollama` exists (the `eval` case in `bin/atlias.mjs`, with `--only`, positional
ids, and `--engine echo` as a dry run). The only real-engine run on record
anywhere is in this session's own relay hand-off note - 1 of 3 against local
`gemma3:4b` - from a three-task corpus that no longer exists, and nothing in
the repo records it. So there is no baseline for eight, and every item below
changes a thing whose current score is unknown. The held-out-split warning
applies from the moment the corpus is used both to tune a loop change and to
judge it.

**1. A typed stop reason, carried into the eval report - closed.** This was the
top of the first draft, on the grounds that every later measurement depends on
telling failure kinds apart. Both halves landed while the document was being
written: `stopWith()` and `state.stop` in the loop, then `runTask()` recording
`st.stop` and `format()` printing `stopped: <reason>` in `lib/eval.mjs`. The
two new reasons the loop chose - `truncated-output` and `malformed-output` -
are finer than the draft asked for, and `crashed` covers the throw the eval
used to infer everything from.
*Left over, worth one small check when the tree settles:* the report prints
`stopped: <reason>` on a passing line too, where it is always `answered`. That
is noise on a clean run, and the honest counter-argument is that a task that
passed while stopping for some other reason is exactly the thing worth seeing.
Decide it deliberately rather than by default.

**2. Refuse tool calls from a truncated message - closed.** Also built during
this document, and better than the draft asked for: `openaiChat` reads
`choice.finish_reason`, `ollamaChat` reads Ollama's own `done_reason`,
`isTruncated()` decides, a cut-off reply has its tool calls refused with the
reason handed back to the model, and a run that only ever gets cut off stops as
`truncated-output` rather than being folded in with a model that cannot format
an action.
*Left over:* that the scripted tests cover a reply which is *both* truncated
*and* carries JSON that happens to parse - that is the exact case the guard
exists for, and a test that only sends a truncated reply with malformed JSON
would pass without ever exercising it. Not checked here because the file was
still being written while this was read.

**3. Stamp every eval report with the harness that produced it.** The
disclosure standard the scaffold-effect paper argues for, scaled down, and the
most valuable item still open. `lib/eval.mjs` has no `git`, `sha`, `version` or
`commit` anywhere in it: `format()` now prints pass, rounds, timing and the
stop reason, and still nothing about the harness that produced them. Given how
far the code moved during the writing of this document alone, a score without a
sha is a score nobody can place afterwards.
*Files:* `lib/eval.mjs` (`runSuite` to capture, `format` to print),
`test/eval-suites.mjs`.
*Test:* the report carries `git log -1 --format=%h -- lib/eval.mjs
lib/loop.mjs`, the engine and model name, and the round budget; a tree with
uncommitted changes to either file is stamped dirty rather than stamped with a
sha that does not describe what ran; a machine with no `git` prints
"unstamped", never a guess.

**4. Repeats, and pass^k.** One run is not a result, and three of these
dockerless tasks are cheap.
*Files:* `lib/eval.mjs` (`runSuite`, `format`), `bin/atlias.mjs` (a `--repeat`
flag), `test/eval-suites.mjs`.
*Test:* a scripted model that passes two of three attempts reports 2/3 with
pass^3 of 0; one that passes all three reports pass^3 of 1; the default stays
one run so nothing gets slower by accident.

**5. A budget per task, in the task file.** Harness-Bench holds budgets fixed
across configurations; atlias's tasks inherit whatever `agent.maxToolRounds`
happens to be, so two runs weeks apart are not comparable.
*Files:* `evals/*.json` (a `rounds` field), `lib/eval.mjs` (`runTask` to apply
it), `test/eval-suites.mjs`.
*Test:* a task with `rounds: 2` stops after two rounds even when the setting
says 25, the report names the budget it ran under, and a task with no field
behaves exactly as today.

**6. One eval task shaped like ImpossibleBench.** `lib/integrity.mjs`'s
`findWeakenedTests` and the eval corpus have never been run against each other:
`grep -rn "weakened\|impossible" evals/*.json test/eval-suites.mjs` returns
nothing.
*Files:* a new `evals/` task whose check cannot be passed honestly but is
trivial to weaken, `test/eval-suites.mjs` (its `kind` list).
*Test:* a scripted model that edits the check instead of the code scores fail,
and `integrity.findWeakenedTests` names the edit, so the gate and the
scoreboard agree on the same run.

**7. Spill what the gate cuts, instead of destroying it - closed.** goose's
answer at atlias's scale, built during this document: `spill()` and a spill
folder under `STATE_DIR`, wired into `ingest()`, with the path named in the
header and a sweep so spills do not accumulate forever. A spill that fails to
write returns an empty path and the cut happens anyway, which is the right
failure: a harness that cannot save the overflow must still hand back the
result.
*Left over:* the test this item asked for is the one worth having whoever wrote
the code - a string that exists **only** in the cut middle is findable in the
spill file. A test that checks the file merely exists, or that the header names
a path, would pass while the spill held the same truncated text the model
already has.

**8. Compact from the model's real context limit.** opencode's arithmetic.
*Files:* `lib/loop.mjs` (`compact`), `lib/core.mjs` (a context-limit setting
per engine, since atlias cannot ask an arbitrary endpoint), `lib/agent.mjs`
(`/compact`), `test/agent-suites.mjs`.
*Test:* a small declared limit compacts on messages a large one leaves alone;
the message count is a floor, not the rule; a limit of zero or unknown falls
back to today's fixed keep rather than compacting on every turn.

**9. One counter for consecutive recoverable failures - mostly closed.** Built
during this document: `bad` with `agent.maxBadReplies` (`lib/loop.mjs`) counts
a block that did not parse, an edit that did not apply and a reply cut off at
the output limit, resets on any round that produced a tool result, and ends the
run with its own typed reason. The fall-through where a third bad block became
the final answer is gone with it.
*What is left, and it is small:* a repair attempt that produced a result and
still failed does not count. A guard refusal on a non-edit tool increments
`produced`, and so does a check command that ran and exited non-zero, so ten
failing test runs in a row still only meet the round budget. Whether that
should count is a judgement, not a bug - a model re-running a test while it
works towards a fix is doing the right thing - which is why this sits here and
not higher.
*Files if taken:* `lib/loop.mjs` (the guard branches and the auto-check
branch), `test/agent-suites.mjs`.
*Test:* `agent.maxBadReplies` consecutive guard refusals stop the run with a
typed reason; a round in which any tool returned real output resets it; a model
that runs a failing check and then fixes it is never stopped.

**10. A failure ledger.** Harness-R1's signal without its policy, and
explicitly weaker than the paper. Every rejected done-claim and every failed
check appended as one JSONL line, for a human to read and hand-edit the harness
from.
*Files:* `lib/integrity.mjs` or `lib/gate.mjs` (the append), `lib/core.mjs`
(the path under `STATE_DIR`), `test/integrity-suites.mjs`.
*Test:* a rejected done-claim appends exactly one line naming the flag, the
project and the command; a passing turn appends nothing; a ledger that cannot
be written does not fail the gate.

**11. Record and replay.** agrepl's fidelity without its proxy, because atlias
is the process making the calls.
*Files:* `lib/loop.mjs` (around `postJson`), `bin/atlias.mjs`
(`--record`/`--replay`), `lib/core.mjs` (the trace path),
`test/agent-suites.mjs`.
*Test:* a recorded session replays to a byte-identical transcript with the
network unreachable; a replay that runs out of recorded responses says so and
stops rather than falling through to a live call.

**12. A grammar for the local model's tool block - with a decision first.** The
constrained-decoding result is strong, and passing Ollama's `format` field is
the local equivalent. The catch the research did not name: `format` constrains
the *whole* response to the schema, and atlias's text path expects one `atlias`
fenced block inside a message (`TOOL_RE` in `lib/loop.mjs`, and the system
prompt built by `systemPrompt()` asking for only a block). Either that path
becomes pure JSON for constrained engines, or the schema cannot be applied.
That is a protocol decision, not a patch.
*Files:* `lib/loop.mjs` (`ollamaChat`, `parseToolCall`, `systemPrompt`),
`test/agent-suites.mjs`.
*Test:* against a scripted Ollama endpoint, the constrained path sends a schema
and parses the reply with no `repairJson` intervention; the unconstrained path
is unchanged; a server that rejects `format` falls back rather than failing the
run.

**13. A cache-correct Anthropic engine, if one is ever added.** Not work to do
now - there is no `anthropicChat` and no need for one while Claude Code is
driven as a host. Recorded because the cost of getting it wrong is silent:
every call at full price with no error.
*Files:* `lib/loop.mjs` (a new engine), `lib/core.mjs`,
`test/agent-suites.mjs`.
*Test:* the request body places `cache_control` on the last block of the stable
prefix and never on one holding the incoming message, uses at most four
breakpoints, and orders tools before system before messages; `cacheReading()`'s
existing Anthropic branch reads the response back.

**14. Steering inside a turn.** Large, and blocked. `spawnSync` to async
`spawn` with piped stdio first, then an input queue polled between tool calls.
The conversion touches the most load-bearing function in the harness and every
test that drives a shell command.
*Files:* `lib/loop.mjs` (`runTool`'s shell branch and everything awaiting it),
`lib/agent.mjs` (the REPL read loop), `test/agent-suites.mjs`,
`test/unit-suites.mjs`.
*Test:* a long-running shell command still returns its full output and honours
its timeout under async spawn, with every existing shell test green; then a
message queued while a command runs is delivered before the next tool call, not
after the turn.

**15. Semantic argument checking for `grep`, `shell` and `graph_query`.** Last
on purpose. The 51-point gap between valid JSON and correct JSON is real, and
`edit_file` already catches its own case by accident. A general guard is a
large build for a rare catch, and it is here so the gap is on the record rather
than because it should be built next.

## What would actually be novel, and what it would take

Most of the list above is adoption. Five systems do a thing, atlias does not,
atlias should. That is the right work and it is not invention, and this section
would be dishonest if it implied otherwise.

Three things in atlias are not adoption, in the sense that the research did not
find another system doing them. That is a weaker statement than novel, and the
gap between the two is a measurement.

**A harness that protects its own prompt cache and then measures whether it
worked.** Block eviction (`agent.evictBlock`, 4 by default) keeps the prefix
byte-identical between block edges instead of advancing the mask by one every
turn, and the readout reports what fraction of prompt tokens the provider
served from cache, per session, across four provider shapes. Neither half is
novel alone; the pair is a closed loop - change the layout, see the hit rate
move - and no surveyed system was found doing both. *What it would take to
claim it:* a measured before-and-after on a provider that reports cached
tokens, at a fixed task set and a fixed budget, which is items 3 through 5 now
that 1 and 2 are done. And a caveat that has to be stated: the research did not
go looking for cache-hit measurement in the eleven-agent corpus, so "no system
was found doing this" means not found, not absent.

**Pointer-first priced from outside the loop.** `lib/pointer.mjs` notes a
whole-file read that the graph could have answered, at PostToolUse, in hosts
whose read tool atlias does not own - Claude Code's and Codex's. Everything
else in the field that enforces pointer-first does it inside its own loop,
where it controls the read. Doing it across a foreign harness is a different
problem, and the hard part is not the note but the silence: seven conditions
have to hold before it speaks. *What it would take:* evidence the note changes
behaviour, which needs a repeat-capable eval (item 4) and at least one task
where the graph genuinely answers better than a read, which the corpus does not
have. The `read-first` task is close and was not built for this.

**A verified plan remembered as a suggestion, not a policy.** Skill1's shape
without its reinforcement learning: when a check passes, write the winning
tool-call sequence and the command that proved it into shared memory keyed by a
task signature - the files touched and the error class - and surface it at the
start of a similar task as a suggestion the model may ignore. It is a lookup,
and calling it learning would be a lie. It is also the one item here that
NEXTGEN.md's list never covered. *What it would take:* a task-signature
function nobody has specified yet, a decision about staleness (a remembered
plan against code that has since changed is worse than nothing, the same
problem the pointer-first nudge solves by staying quiet after a write), and
pass^k to show it helps rather than merely fires. Correcting the research as
noted above: shared memory through `harness_remember`, not graphify, which
atlias only reads.

And one honest negative, because the strongest thing this round produced is a
thing not to build. The instruction-conflict fix, the automatic multi-model
ensemble, the trained critic, the learned router and the calibrated budget
predictor are all things a next-generation harness might plausibly be expected
to have. For each, either the paper that diagnoses the problem also tested the
fix and found it did not help, or the measured gain does not clear its measured
cost, or the inputs do not exist in a harness that only ever sees text. Not
building them is a finding.

## Could not be verified

Consolidated from four research reports and eleven verification passes, with
the duplicates merged. Nothing here supports any claim above.

**The largest one first.** atlias has never been run against any public
benchmark, and has no recorded real-engine score on its own eight-task corpus.
Every ranked item above is a change to a thing whose current number is unknown.
`docs/RESEARCH.md`'s own "not measured" admission still stands for the harness
as a whole.

**Papers named from search snippets only, never fetched.** No claim above uses
any of them: HarnessX (2606.14249), SIA (2605.27276), Continual harness
(2605.09998), gated semantic quality-diversity harnesses (2607.13683),
Recursive Harness Self-Improvement (2607.15524), ModularRSI (2609.14857),
Auditing Harness Tampering (2609.00069), Verify Smarter Evolve Further
(2608.27311), Hierarchical Self-Improvement (2608.08466); SkillGraph
(2605.12039), Surrogate-Guided Solve-and-Reproduce (2608.28638), RL for
Self-Improving Agent with Skill Library (2512.17102), SkillRL (2602.08234),
SkillX (2604.04804); Chronicle (2609.20625), Zero-Replay Debugging
(2606.14805), TraceCompiler (2608.02680), NovaFabric (2609.12582), Causal Agent
Replay (2606.08275), TRACER (2608.29363); Budget-Aware LLM Discovery
(2607.26828), CostBench (2511.02734), EcoAgent-Bench (2608.05519), BATS
(2511.17006); and Lilian Weng's "Harness Engineering for Self-Improvement",
title only.

**Numbers from secondary sources.** FrugalGPT's ~98% cost reduction, RouteLLM's
~85% and Bedrock Intelligent Prompt Routing's ~60% all came from one blog
summarising other work. The small-model tool-calling comparison where a 0.6B
model beat a 3.8B one came from a search synthesis citing
<https://arxiv.org/pdf/2510.03847> plus a consumer-tech blog, not from reading
that PDF. OpenAI's `close to 20%` SWE-bench Verified figure for the three
reminders is OpenAI's own internal eval, not independently reproduced.
Ouroboros's three benchmark scores are the authors' self-report. The scaffold-
effect paper's $215.79 cost table is the authors' self-report.

**Read as an abstract or a tool summary, not line by line.** The Dockerless
verifier paper (2606.28436) - only a generic summary, which is why nothing
numeric from it is quoted. The harness-evolution evaluation protocol
(2607.12227)
- the 45/10/34 split is a summariser's extraction, not cross-checked against the
PDF. Skill1's magnitude of improvement and its named baselines - abstract only.
The eleven-agent source-code study (2609.00006) and TokenPilot's 56-87% figures
- inherited from NEXTGEN.md's own unverified list and not re-verified here,
though both papers were re-fetched and confirmed to exist with matching titles
and abstracts.

**Aider's two claims are the weakest sourcing in this document.**
`max_reflections = 3` and the `finish_reason == "length"` handling were
extracted by the fetch tool's summariser reading `base_coder.py` and were never
re-grepped line by line against the raw file. The URL was genuinely fetched;
treat the line numbers and exact wording as approximate. Item 9 of the plan
does not depend on Aider's precise cap, only on the pattern.

**Sources that could not be reached.** `openai.com` and `cookbook.openai.com`
were refused by the fetch tool as unverifiable domains, so OpenAI's own claim
of 100% schema adherence under Structured Outputs is not in this document;
`developers.openai.com` mirrors were used where they existed. Whether
`platform.claude.com` has superseded `docs.anthropic.com` as canonical was not
checked.

**Not examined at all.** Claude Code's and Codex's own loop internals - neither
was cloned or fetched, so no claim here describes their stopping, retry or
planning behaviour from source. `D:/harness-work/opencode-bin`,
`deepseek-harness`, `hermes-agent`, `nanobot`, `software-agent-sdk` and
`stirrup` were on disk and never opened. OpenHands' critic *scorer* - only its
schema, UI and wiring are in that checkout, so its accuracy is unverifiable
from what was read.

**Reasoned rather than measured, in atlias itself.** That `openaiChat`'s tools
array stays byte-identical across every call of a real multi-turn session was
read from the code, not confirmed by capturing and diffing request bodies.
Whether `projectInstructions()`'s 6000-character budget clears each provider's
minimum-cacheable-prompt floor is a plausible concern and not a measurement;
the instruction block is concatenated into the system prompt rather than cached
alone. That async `spawn` keeps the event loop live where `spawnSync` does not
is well-known Node behaviour and no documentation URL was fetched for it in the
session that asserted it.

**And the moving tree.** `lib/loop.mjs` grew from 966 lines during the research
to 1152 when this document was started and 1236 before it was finished;
`lib/eval.mjs` changed twice in the same stretch. Every claim about atlias
above was checked against the working tree, then checked again after the tree
moved under the first pass, which is why the citations name functions rather
than lines. Five findings went from open to closed between this document's
first draft and its last, and the closure was verified by reading the code
rather than taken from any report. That is the strongest argument in here for
item 3: without a sha stamped on the report that produced a number, none of
this is dateable after the fact, and a document like this one cannot be told
from a stale one by reading it.

Nothing in this document was run. The test suite was not executed as part of
writing it, no eval was run, and the only commands used were reads, greps and
one check of free disk space. Every "closed" above means the code is in the
working tree and was read there, not that it was tested passing.
