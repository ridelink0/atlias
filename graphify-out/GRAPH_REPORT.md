# Graph Report - atlias  (2026-09-22)

## Corpus Check
- 28 files · ~26,001 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 2)

## Summary
- 325 nodes · 956 edges · 15 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2b4361db`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- server.mjs
- hosts.mjs
- agent.mjs
- core.mjs
- tools.mjs
- package.json
- run.mjs
- graph.mjs
- plugin.json
- atlias
- progress.mjs
- marketplace.json
- double-check
- atlias
- Changelog

## God Nodes (most connected - your core abstractions)
1. `clip()` - 34 edges
2. `exists()` - 30 edges
3. `config()` - 30 edges
4. `readJson()` - 25 edges
5. `readText()` - 23 edges
6. `writeText()` - 20 edges
7. `writeJson()` - 19 edges
8. `projectDir()` - 18 edges
9. `log()` - 17 edges
10. `findPython()` - 15 edges

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

### Community 0 - "server.mjs"
Cohesion: 0.48
Nodes (6): VERSION, fail(), handle(), reply(), send(), TOOLS

### Community 1 - "hosts.mjs"
Cohesion: 0.12
Nodes (41): readJson(), readText(), START_MARK, writeJson(), writeText(), CODEX_EVENTS, dropAtliasTables(), esc() (+33 more)

### Community 2 - "agent.mjs"
Cohesion: 0.14
Nodes (36): b(), c(), chooser(), claudeTurn(), cli(), codexTurn(), d(), detectEngines() (+28 more)

### Community 3 - "core.mjs"
Cohesion: 0.11
Nodes (30): CODE_EXT, CODEX_DIR, commandFromTool(), detectHost(), emit(), END_MARK, filesFromTool(), GEMINI_DIR (+22 more)

### Community 4 - "tools.mjs"
Cohesion: 0.13
Nodes (34): BRIEF_BUDGET_MS, build(), companions(), RULES, sessionStart(), CLAUDE_DIR, claudeMemoryDir(), exists() (+26 more)

### Community 6 - "package.json"
Cohesion: 0.11
Nodes (17): author, bin, atlias, description, engines, node, keywords, license (+9 more)

### Community 7 - "run.mjs"
Cohesion: 0.07
Nodes (26): argv, cwd, briefCost(), estimateTokens(), graphVsFiles(), interventions(), report(), DEFAULTS (+18 more)

### Community 8 - "graph.mjs"
Cohesion: 0.12
Nodes (42): appendLine(), detach(), ensureDir(), events(), graphify(), graphPath(), log(), mtime() (+34 more)

### Community 9 - "plugin.json"
Cohesion: 0.17
Nodes (11): author, name, url, description, homepage, keywords, license, name (+3 more)

### Community 10 - "atlias"
Cohesion: 0.15
Nodes (12): atlias, Configuration, Harnesses, Install, Known limits, Sources, Tests that teach, Tools (MCP server `atlias`) (+4 more)

### Community 11 - "progress.mjs"
Cohesion: 0.44
Nodes (8): build(), nextPath(), notePath(), postCompact(), preCompact(), read(), setNext(), update()

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
Cohesion: 0.22
Nodes (8): 1.0.0 (2026-09-21), 1.2.0 (2026-09-22), 1.3.0 (2026-09-22), 1.4.0 (2026-09-22), 1.4.1 (2026-09-22), 1.5.0 (2026-09-22), 1.5.1 (2026-09-22), Changelog

## Knowledge Gaps
- **90 isolated node(s):** `$schema`, `name`, `description`, `name`, `email` (+85 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 109 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `godNodes()` connect `graph.mjs` to `hosts.mjs`, `atlias`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `uninstall()` connect `hosts.mjs` to `atlias`, `tools.mjs`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `description` to the rest of the system?**
  _90 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `hosts.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.12121212121212122 - nodes in this community are weakly interconnected._
- **Should `agent.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.13940256045519203 - nodes in this community are weakly interconnected._
- **Should `core.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.11260504201680673 - nodes in this community are weakly interconnected._
- **Should `tools.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.12802275960170698 - nodes in this community are weakly interconnected._