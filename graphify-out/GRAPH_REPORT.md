# Graph Report - atlias  (2026-09-22)

## Corpus Check
- 28 files · ~41,314 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 2)

## Summary
- 388 nodes · 1077 edges · 16 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `58477b42`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- graph.mjs
- hosts.mjs
- agent.mjs
- run.mjs
- progress.mjs
- clip
- package.json
- gate.mjs
- server.mjs
- plugin.json
- atlias
- marketplace.json
- double-check
- atlias
- Changelog
- core.mjs

## God Nodes (most connected - your core abstractions)
1. `clip()` - 34 edges
2. `Changelog` - 31 edges
3. `exists()` - 30 edges
4. `config()` - 30 edges
5. `readJson()` - 28 edges
6. `readText()` - 24 edges
7. `writeText()` - 22 edges
8. `writeJson()` - 20 edges
9. `projectDir()` - 18 edges
10. `log()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Configuration` --references--> `godNodes()`  [INFERRED]
  README.md → lib/graph.mjs
- `Install` --references--> `uninstall()`  [INFERRED]
  README.md → lib/hosts-extra.mjs
- `runTool()` --calls--> `recall()`  [EXTRACTED]
  lib/agent.mjs → mcp/tools.mjs
- `runTool()` --calls--> `remember()`  [EXTRACTED]
  lib/agent.mjs → mcp/tools.mjs
- `repl()` --calls--> `recall()`  [EXTRACTED]
  lib/agent.mjs → mcp/tools.mjs

## Import Cycles
- None detected.

## Communities (16 total, 0 thin omitted)

### Community 0 - "graph.mjs"
Cohesion: 0.13
Nodes (41): briefCost(), estimateTokens(), graphVsFiles(), interventions(), liveSessions(), report(), appendLine(), detach() (+33 more)

### Community 1 - "hosts.mjs"
Cohesion: 0.08
Nodes (68): BRIEF_BUDGET_MS, build(), companions(), fitLines(), RULES, CLAUDE_DIR, claudeMemoryDir(), exists() (+60 more)

### Community 2 - "agent.mjs"
Cohesion: 0.12
Nodes (38): b(), c(), chooser(), claudeArgs(), claudeTurn(), cli(), codexTurn(), d() (+30 more)

### Community 3 - "run.mjs"
Cohesion: 0.11
Nodes (13): ref_node_os, check(), DANGER, mcpSuite(), only, PROJECT, results, ROOT (+5 more)

### Community 4 - "progress.mjs"
Cohesion: 0.35
Nodes (11): gitStatusShort(), TURN_TAIL, applyNext(), build(), nextPath(), notePath(), postCompact(), preCompact() (+3 more)

### Community 5 - "clip"
Cohesion: 0.17
Nodes (26): clip(), commandFromTool(), config(), filesFromTool(), graphPath(), isEditTool(), isShellTool(), looksLikeVerification() (+18 more)

### Community 6 - "package.json"
Cohesion: 0.11
Nodes (17): author, bin, atlias, description, engines, node, keywords, license (+9 more)

### Community 7 - "gate.mjs"
Cohesion: 0.16
Nodes (21): sessionStart(), isCodeFile(), run(), saveSessionMeta(), sessionMeta(), sessionMetaPath(), block(), changedFiles() (+13 more)

### Community 8 - "server.mjs"
Cohesion: 0.48
Nodes (6): VERSION, fail(), handle(), reply(), send(), TOOLS

### Community 9 - "plugin.json"
Cohesion: 0.17
Nodes (11): author, name, url, description, homepage, keywords, license, name (+3 more)

### Community 10 - "atlias"
Cohesion: 0.12
Nodes (15): atlias, Configuration, Harnesses, Install, Known limits, Sources, Surviving an update, Tests that teach (+7 more)

### Community 12 - "marketplace.json"
Cohesion: 0.25
Nodes (7): description, name, owner, email, name, plugins, $schema

### Community 13 - "double-check"
Cohesion: 0.40
Nodes (4): double-check, Pass 1: functional proof, Pass 2: adversarial hunt, Reading a test failure

### Community 14 - "atlias"
Cohesion: 0.40
Nodes (4): atlias, Memory discipline (from NanoBot's Dream, kept), Reach for these tools, What the harness does without being asked

### Community 15 - "Changelog"
Cohesion: 0.06
Nodes (31): 1.0.0 (2026-09-21), 1.2.0 (2026-09-22), 1.3.0 (2026-09-22), 1.4.0 (2026-09-22), 1.4.1 (2026-09-22), 1.5.0 (2026-09-22), 1.5.1 (2026-09-22), 1.6.0 (2026-09-22) (+23 more)

### Community 16 - "core.mjs"
Cohesion: 0.06
Nodes (36): argv, cwd, FLAG_COMMANDS, CODE_EXT, CODEX_DIR, DEFAULTS, detectHost(), emit() (+28 more)

## Knowledge Gaps
- **127 isolated node(s):** `$schema`, `name`, `description`, `name`, `email` (+122 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 147 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `uninstall()` connect `hosts.mjs` to `atlias`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `godNodes()` connect `graph.mjs` to `hosts.mjs`, `atlias`, `clip`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `description` to the rest of the system?**
  _127 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `graph.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.12790697674418605 - nodes in this community are weakly interconnected._
- **Should `hosts.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.0821917808219178 - nodes in this community are weakly interconnected._
- **Should `agent.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.11666666666666667 - nodes in this community are weakly interconnected._
- **Should `run.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._