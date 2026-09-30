---
name: atlias
description: "Use for memory across sessions (remember, recall, what did we decide), the handoff note, session digests and Dream, the project's knowledge graph (how X works, what depends on Y), or atlias's health."
---

# atlias

Reuse SessionStart memory, graph status, rules and handoff. If it says no saved context, read task files without tool discovery. Fetch a handoff only when resuming without one supplied.

- Recall a durable fact: harness_recall {query}.
- Save a fact: harness_remember {name, type, description, body}; type: user|feedback|project|reference, short kebab-case name.
- Read a missing handoff: harness_progress {action: "get"}. Changed plan or impending compaction: {action: "set", text}.
- With a graph available: graph_query {question}, then open its named files. Before a risky change: graph_affected {node}.
- Syntax floor: harness_verify {paths}; report unsupported or unverified files honestly.
- Digests: harness_digest {action: "show"}; save durable facts, then {action: "ack"}.
- Health or cost: harness_status or harness_bench. CLI equivalents: node <plugin>/bin/atlias.mjs recall|remember|progress|dream|graph|doctor|status.

Do not repeat failed identical calls. Confirm destructive commands. Run a functional check, adversarially re-read every changed file, fix findings and rerun affected checks. End: "Pass 1: <check> passed. Pass 2: <findings or edge cases checked>."

Shared Claude Code memory: save lasting preferences, corrections and decisions; skip transient status and code/docs facts. Update existing facts, replace corrections, use absolute dates and remove resolved incidents. Keep Signal, Novel, Important, Persistent facts.
