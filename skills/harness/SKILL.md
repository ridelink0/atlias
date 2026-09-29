---
name: atlias
description: "Use for memory across sessions (remember, recall, what did we decide), the handoff note, session digests and Dream, the project's knowledge graph (how X works, what depends on Y), or atlias's health."
---

# atlias

SessionStart already supplies memory, graph status, rules and any handoff. Use that context; fetch a handoff only when resuming or when the existing note is missing.

- Recall a durable fact: harness_recall {query}.
- Save one atomic fact: harness_remember {name, type, description, body}; type is user, feedback, project or reference. Use a short kebab-case name.
- Read a missing handoff: harness_progress {action: "get"}. Changed plan or impending compaction: {action: "set", text}.
- With a graph available: graph_query {question}, then open its named files. Before a risky change: graph_affected {node}.
- Syntax floor: harness_verify {paths}; report unsupported or unverified files honestly.
- Consolidate pending sessions: harness_digest {action: "show"}, save durable facts, then {action: "ack"}.
- Health or cost: harness_status or harness_bench. CLI equivalents: node <plugin>/bin/atlias.mjs recall|remember|progress|dream|graph|doctor|status.

Never repeat a failed identical call. Confirm destructive commands. Run a real functional check, then re-read every changed file adversarially; fix findings and repeat the affected check. End with: "Pass 1: <check> passed. Pass 2: <findings or edge cases checked>."

Memory is shared with Claude Code. Save lasting preferences, corrections and decisions, not transient status or facts already recorded by code/docs. Prefer updating an existing fact; replace corrections, use absolute dates, and discard resolved one-off incidents. Keep Signal, Novel, Important, Persistent facts.
