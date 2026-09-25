# The next generation: what atlias takes from the field, and what it adds

Research done 2026-09-25 for Gev. This is not a `/deep-research` run: the deep
research skill's scraper and verifier agents are not registered in this session
and subagents were switched off, so every source below was read directly and is
linked. Anything not verified is marked so.

## What the field actually looks like

A September 2026 source-code study of eleven coding agents - Claude Code, Codex
CLI, Gemini CLI, Mistral Vibe, OpenHands, Aider, Mini-SWE-Agent, Hermes, Pi,
OpenCode and OpenClaw - reads about four million lines and reports two absences
worth more than any feature list: **no agent runtime imports a general-purpose
agentic framework, and none retrieves code with vector embeddings.** The field
runs on hand-rolled async loops and deterministic retrieval. It catalogues seven
canonical subsystems, 29 recurring patterns and 18 recommendations, and notes
that skills appear in 9 of 11 systems and MCP in 8 of 11.
<https://arxiv.org/abs/2609.00006>

That matters for atlias twice over. It confirms the shape atlias already has - a
hand-written loop, deterministic graph retrieval through graphify, skills and
MCP - and it means "next generation" cannot mean adopting a framework. It has to
mean doing the hard parts better than the eleven do.

## The one number that has changed

The optimisation target moved from "minimise context size" to **"maximise cache
hit rate"**, because every major provider now caches prompt prefixes. A harness
that trims tokens by rewriting its prompt is spending more than it saves: the
trim alters the layout, the prefix no longer matches, and the whole conversation
is re-read at full price.

TokenPilot names this directly and builds around it: ingestion-aware compaction
that stabilises prompt prefixes at the gate where content enters, and
lifecycle-aware eviction that drops segments **on a batch-turn schedule** when
their task relevance expires, rather than continuously. It reports 56 to 87 per
cent cost reductions depending on mode. <https://arxiv.org/abs/2606.17016>

Two further findings from the same search, listed because they are directly
implementable rather than because they are novel: a symbol-indexed navigation
server that lets an agent move by pointer instead of reading whole files
measured 77 per cent fewer active tokens, and Claude Code's own compaction is
observed to preserve the current task, recent errors and file names while losing
initial instructions and style rules - which is the argument for keeping durable
rules in the system prompt rather than trusting compaction to carry them.
<https://github.com/ai-boost/awesome-harness-engineering>

## What atlias already had

- A hand-written loop, no framework. Matches the field; no change needed.
- Deterministic retrieval by symbol through graphify: `graph_query` before
  reading files is the pointer-first pattern, already the house rule.
- Rules in the system prompt and in memory, not in the conversation, so
  compaction cannot quietly drop them.
- Observation masking: every tool result older than the last few shrinks to one
  line, with the full history kept outside the view.

## What was wrong, and is now fixed

**Observation eviction was cache-hostile.** `view()` masked everything older
than the last `keepObservations`, so the boundary advanced by one on every
single turn. Every turn therefore rewrote the prompt prefix, and a rewritten
prefix is a discarded cache: the saving from eliding one old observation was
paid for many times over by re-reading the whole conversation at full price.

Eviction now moves in blocks (`agent.evictBlock`, default 4). Between two block
edges the prefix is byte-identical and the provider can serve it from cache; the
few extra observations carried in the meantime cost far less than the cache
miss. Measured in the test suite: with `keepObservations: 2` and a block of 4,
the mask is unchanged across four consecutive turns and then advances once.

## Ranked, still to build

1. **Ingestion-aware capping.** atlias elides tool output at the point of use
   (`elide`, head and tail). Doing it at the gate, with a per-tool budget and a
   stable summary line, makes the elision part of the prefix rather than a later
   rewrite of it.
2. **A cache-hit readout.** The harness cannot improve what it does not measure.
   Providers report cached prompt tokens; the loop should record hit rate per
   session and surface it the way usage-limits surfaces budget.
3. **Pointer-first enforcement.** The rule exists; the loop does not enforce it.
   A read of a file the graph could have answered should cost a nudge, the way
   the gate nudges a claim with no check behind it.
4. **Skills, since 9 of 11 have them.** atlias has companions and rules but no
   skill format of its own; adopting the one the hosts already read is cheaper
   than inventing a format.
5. **A sandbox that is verifiable here.** OpenHands' isolation is its whole
   argument; a git-worktree sandbox is provable on this machine, where Docker is
   not installed.

## Unverified

- The eleven-system study's 29 patterns and 18 recommendations are cited from
  its abstract page; the PDF itself is compressed and was not read line by line,
  so no individual recommendation is quoted here.
- TokenPilot's percentages are its own benchmarks, not a measurement of atlias.
