# Graph Report - atlias  (2026-09-22)

## Corpus Check
- 27 files · ~23,409 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 2)

## Summary
- 313 nodes · 923 edges · 14 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4be6e59d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- core.mjs
- hosts.mjs
- agent.mjs
- graph.mjs
- gate.mjs
- run.mjs
- package.json
- plugin.json
- atlias
- clip
- marketplace.json
- double-check
- atlias
- Changelog

## God Nodes (most connected - your core abstractions)
1. `clip()` - 32 edges
2. `exists()` - 30 edges
3. `config()` - 28 edges
4. `readJson()` - 25 edges
5. `readText()` - 23 edges
6. `writeText()` - 20 edges
7. `writeJson()` - 19 edges
8. `log()` - 17 edges
9. `projectDir()` - 16 edges
10. `findPython()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Configuration` --references--> `godNodes()`  [INFERRED]
  README.md → lib/graph.mjs
- `Install` --references--> `uninstall()`  [INFERRED]
  README.md → lib/hosts-extra.mjs
- `repl()` --calls--> `recall()`  [EXTRACTED]
  lib/agent.mjs → mcp/tools.mjs
- `remember()` --calls--> `ensureDir()`  [EXTRACTED]
  mcp/tools.mjs → lib/core.mjs
- `remember()` --calls--> `writeText()`  [EXTRACTED]
  mcp/tools.mjs → lib/core.mjs

## Import Cycles
- None detected.

## Communities (14 total, 0 thin omitted)

### Community 0 - "core.mjs"
Cohesion: 0.07
Nodes (34): argv, cwd, BRIEF_BUDGET_MS, RULES, CLAUDE_DIR, CODE_EXT, CODEX_DIR, DEFAULTS (+26 more)

### Community 1 - "hosts.mjs"
Cohesion: 0.12
Nodes (39): HOME, readJson(), START_MARK, writeJson(), writeText(), CODEX_EVENTS, dropAtliasTables(), esc() (+31 more)

### Community 2 - "agent.mjs"
Cohesion: 0.13
Nodes (35): b(), c(), chooser(), claudeTurn(), cli(), codexTurn(), d(), detectEngines() (+27 more)

### Community 3 - "graph.mjs"
Cohesion: 0.14
Nodes (37): appendLine(), detach(), ensureDir(), events(), log(), mtime(), projectDir(), readJsonl() (+29 more)

### Community 4 - "gate.mjs"
Cohesion: 0.14
Nodes (28): companions(), sessionStart(), commandFromTool(), filesFromTool(), graphPath(), isCodeFile(), isEditTool(), isShellTool() (+20 more)

### Community 5 - "run.mjs"
Cohesion: 0.11
Nodes (13): ref_node_os, check(), DANGER, mcpSuite(), only, PROJECT, results, ROOT (+5 more)

### Community 6 - "package.json"
Cohesion: 0.11
Nodes (17): author, bin, atlias, description, engines, node, keywords, license (+9 more)

### Community 9 - "plugin.json"
Cohesion: 0.17
Nodes (11): author, name, url, description, homepage, keywords, license, name (+3 more)

### Community 10 - "atlias"
Cohesion: 0.17
Nodes (11): atlias, Configuration, Harnesses, Install, Known limits, Sources, Tests that teach, Tools (MCP server `atlias`) (+3 more)

### Community 11 - "clip"
Cohesion: 0.17
Nodes (31): runTool(), build(), claudeMemoryDir(), clip(), exists(), findPython(), graphify(), readLines() (+23 more)

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
Cohesion: 0.40
Nodes (4): 1.0.0 (2026-09-21), 1.2.0 (2026-09-22), 1.3.0 (2026-09-22), Changelog

## Knowledge Gaps
- **85 isolated node(s):** `$schema`, `name`, `description`, `name`, `email` (+80 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 104 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `uninstall()` connect `hosts.mjs` to `atlias`, `clip`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `godNodes()` connect `graph.mjs` to `hosts.mjs`, `atlias`, `clip`, `gate.mjs`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `description` to the rest of the system?**
  _85 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `core.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.0707070707070707 - nodes in this community are weakly interconnected._
- **Should `hosts.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.11738648947951273 - nodes in this community are weakly interconnected._
- **Should `agent.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.13213213213213212 - nodes in this community are weakly interconnected._
- **Should `graph.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.13765182186234817 - nodes in this community are weakly interconnected._