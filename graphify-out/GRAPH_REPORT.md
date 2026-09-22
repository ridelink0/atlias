# Graph Report - atlias  (2026-09-22)

## Corpus Check
- 28 files · ~40,322 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 2)

## Summary
- 385 nodes · 1072 edges · 15 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ac22581a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- dream.mjs
- hosts.mjs
- agent.mjs
- run.mjs
- gate.mjs
- core.mjs
- package.json
- graph.mjs
- plugin.json
- atlias
- marketplace.json
- double-check
- atlias
- Changelog
- tools.mjs

## God Nodes (most connected - your core abstractions)
1. `clip()` - 34 edges
2. `exists()` - 30 edges
3. `config()` - 30 edges
4. `Changelog` - 29 edges
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

## Communities (15 total, 0 thin omitted)

### Community 0 - "dream.mjs"
Cohesion: 0.19
Nodes (27): appendLine(), detach(), ensureDir(), events(), projectDir(), readJsonl(), readLines(), safeId() (+19 more)

### Community 1 - "hosts.mjs"
Cohesion: 0.11
Nodes (42): isVersionedPath(), writeJson(), writeText(), CODEX_EVENTS, dropAtliasTables(), esc(), byId(), EXTRAS (+34 more)

### Community 2 - "agent.mjs"
Cohesion: 0.11
Nodes (40): b(), c(), chooser(), claudeArgs(), claudeTurn(), cli(), codexTurn(), d() (+32 more)

### Community 3 - "run.mjs"
Cohesion: 0.06
Nodes (30): argv, cwd, FLAG_COMMANDS, briefCost(), estimateTokens(), graphVsFiles(), interventions(), liveSessions() (+22 more)

### Community 4 - "gate.mjs"
Cohesion: 0.16
Nodes (24): gitStatusShort(), isCodeFile(), TURN_TAIL, block(), changedFiles(), lastPrompt(), PARSEABLE, parseGitStatus() (+16 more)

### Community 5 - "core.mjs"
Cohesion: 0.08
Nodes (41): CLAUDE_DIR, CODE_EXT, CODEX_DIR, commandFromTool(), detectHost(), emit(), END_MARK, EVENT_MAX (+33 more)

### Community 6 - "package.json"
Cohesion: 0.11
Nodes (17): author, bin, atlias, description, engines, node, keywords, license (+9 more)

### Community 7 - "graph.mjs"
Cohesion: 0.14
Nodes (38): BRIEF_BUDGET_MS, build(), companions(), fitLines(), RULES, sessionStart(), clip(), config() (+30 more)

### Community 9 - "plugin.json"
Cohesion: 0.17
Nodes (11): author, name, url, description, homepage, keywords, license, name (+3 more)

### Community 10 - "atlias"
Cohesion: 0.13
Nodes (14): atlias, Configuration, Harnesses, Install, Known limits, Sources, Tests that teach, Tools (MCP server `atlias`) (+6 more)

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
Cohesion: 0.07
Nodes (29): 1.0.0 (2026-09-21), 1.2.0 (2026-09-22), 1.3.0 (2026-09-22), 1.4.0 (2026-09-22), 1.4.1 (2026-09-22), 1.5.0 (2026-09-22), 1.5.1 (2026-09-22), 1.6.0 (2026-09-22) (+21 more)

### Community 16 - "tools.mjs"
Cohesion: 0.21
Nodes (18): claudeMemoryDir(), readText(), slug(), VERSION, doctor(), doctorRows(), formatDoctor(), fail() (+10 more)

## Knowledge Gaps
- **124 isolated node(s):** `$schema`, `name`, `description`, `name`, `email` (+119 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 144 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `uninstall()` connect `hosts.mjs` to `tools.mjs`, `atlias`, `graph.mjs`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `godNodes()` connect `graph.mjs` to `dream.mjs`, `hosts.mjs`, `atlias`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `description` to the rest of the system?**
  _124 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `hosts.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.10505050505050505 - nodes in this community are weakly interconnected._
- **Should `agent.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.1091753774680604 - nodes in this community are weakly interconnected._
- **Should `run.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.059800664451827246 - nodes in this community are weakly interconnected._
- **Should `core.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.07770582793709528 - nodes in this community are weakly interconnected._