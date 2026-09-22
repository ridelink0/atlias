# Graph Report - atlias  (2026-09-22)

## Corpus Check
- 28 files · ~36,227 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 2)

## Summary
- 364 nodes · 1031 edges · 14 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9f8e05f3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- brief.mjs
- hosts.mjs
- agent.mjs
- run.mjs
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
2. `config()` - 30 edges
3. `exists()` - 29 edges
4. `readJson()` - 27 edges
5. `readText()` - 23 edges
6. `Changelog` - 22 edges
7. `writeText()` - 21 edges
8. `writeJson()` - 19 edges
9. `projectDir()` - 18 edges
10. `log()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Configuration` --references--> `godNodes()`  [INFERRED]
  README.md → lib/graph.mjs
- `Install` --references--> `uninstall()`  [INFERRED]
  README.md → lib/hosts-extra.mjs
- `remember()` --calls--> `ensureDir()`  [EXTRACTED]
  mcp/tools.mjs → lib/core.mjs
- `callTool()` --calls--> `readText()`  [EXTRACTED]
  mcp/tools.mjs → lib/core.mjs
- `recall()` --calls--> `readText()`  [EXTRACTED]
  mcp/tools.mjs → lib/core.mjs

## Import Cycles
- None detected.

## Communities (14 total, 0 thin omitted)

### Community 0 - "brief.mjs"
Cohesion: 0.10
Nodes (41): BRIEF_BUDGET_MS, build(), companions(), fitLines(), RULES, sessionStart(), CLAUDE_DIR, claudeMemoryDir() (+33 more)

### Community 1 - "hosts.mjs"
Cohesion: 0.09
Nodes (53): HOME, readJson(), readText(), START_MARK, writeJson(), writeText(), CODEX_EVENTS, dropAtliasTables() (+45 more)

### Community 2 - "agent.mjs"
Cohesion: 0.13
Nodes (39): b(), c(), chooser(), claudeArgs(), claudeTurn(), cli(), codexTurn(), d() (+31 more)

### Community 3 - "run.mjs"
Cohesion: 0.06
Nodes (28): argv, cwd, briefCost(), estimateTokens(), graphVsFiles(), interventions(), liveSessions(), report() (+20 more)

### Community 5 - "core.mjs"
Cohesion: 0.09
Nodes (37): CODE_EXT, CODEX_DIR, commandFromTool(), detectHost(), emit(), END_MARK, EVENT_MAX, eventsTail() (+29 more)

### Community 6 - "package.json"
Cohesion: 0.11
Nodes (17): author, bin, atlias, description, engines, node, keywords, license (+9 more)

### Community 8 - "graph.mjs"
Cohesion: 0.15
Nodes (36): appendLine(), detach(), ensureDir(), events(), graphify(), log(), projectDir(), readJsonl() (+28 more)

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
Cohesion: 0.09
Nodes (22): 1.0.0 (2026-09-21), 1.2.0 (2026-09-22), 1.3.0 (2026-09-22), 1.4.0 (2026-09-22), 1.4.1 (2026-09-22), 1.5.0 (2026-09-22), 1.5.1 (2026-09-22), 1.6.0 (2026-09-22) (+14 more)

### Community 16 - "tools.mjs"
Cohesion: 0.29
Nodes (11): syntaxReport(), doctor(), formatDoctor(), fail(), handle(), reply(), send(), callTool() (+3 more)

## Knowledge Gaps
- **112 isolated node(s):** `$schema`, `name`, `description`, `name`, `email` (+107 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 132 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `uninstall()` connect `hosts.mjs` to `brief.mjs`, `atlias`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `godNodes()` connect `graph.mjs` to `brief.mjs`, `hosts.mjs`, `atlias`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `description` to the rest of the system?**
  _112 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `brief.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.09830866807610994 - nodes in this community are weakly interconnected._
- **Should `hosts.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.09074410163339383 - nodes in this community are weakly interconnected._
- **Should `agent.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.13048780487804879 - nodes in this community are weakly interconnected._
- **Should `run.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.06341463414634146 - nodes in this community are weakly interconnected._