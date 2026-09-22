# Graph Report - atlias  (2026-09-22)

## Corpus Check
- 28 files · ~24,147 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 2)

## Summary
- 319 nodes · 946 edges · 14 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cc85bdf8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- atlias.mjs
- hosts.mjs
- agent.mjs
- dream.mjs
- graph.mjs
- run.mjs
- package.json
- core.mjs
- plugin.json
- tools.mjs
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
- `runTool()` --calls--> `remember()`  [EXTRACTED]
  lib/agent.mjs → mcp/tools.mjs
- `remember()` --calls--> `ensureDir()`  [EXTRACTED]
  mcp/tools.mjs → lib/core.mjs
- `recall()` --calls--> `readText()`  [EXTRACTED]
  mcp/tools.mjs → lib/core.mjs

## Import Cycles
- None detected.

## Communities (14 total, 0 thin omitted)

### Community 0 - "atlias.mjs"
Cohesion: 0.11
Nodes (18): argv, cwd, briefCost(), estimateTokens(), graphVsFiles(), interventions(), report(), BRIEF_BUDGET_MS (+10 more)

### Community 1 - "hosts.mjs"
Cohesion: 0.07
Nodes (50): CODEX_DIR, END_MARK, GEMINI_DIR, HOME, START_MARK, writeJson(), CODEX_EVENTS, dropAtliasTables() (+42 more)

### Community 2 - "agent.mjs"
Cohesion: 0.13
Nodes (38): b(), c(), chooser(), claudeTurn(), cli(), codexTurn(), d(), detectEngines() (+30 more)

### Community 3 - "dream.mjs"
Cohesion: 0.18
Nodes (30): appendLine(), detach(), ensureDir(), events(), log(), projectDir(), readJsonl(), readLines() (+22 more)

### Community 4 - "graph.mjs"
Cohesion: 0.12
Nodes (37): build(), companions(), sessionStart(), exists(), findPython(), graphify(), graphPath(), isCodeFile() (+29 more)

### Community 5 - "run.mjs"
Cohesion: 0.11
Nodes (14): ref_node_os, ref_node_url, check(), DANGER, mcpSuite(), only, PROJECT, results (+6 more)

### Community 6 - "package.json"
Cohesion: 0.11
Nodes (17): author, bin, atlias, description, engines, node, keywords, license (+9 more)

### Community 7 - "core.mjs"
Cohesion: 0.14
Nodes (26): claudeMemoryDir(), CODE_EXT, commandFromTool(), detectHost(), emit(), filesFromTool(), isEditTool(), isShellTool() (+18 more)

### Community 9 - "plugin.json"
Cohesion: 0.17
Nodes (11): author, name, url, description, homepage, keywords, license, name (+3 more)

### Community 11 - "tools.mjs"
Cohesion: 0.18
Nodes (20): readText(), doctorRows(), formatDoctor(), build(), nextPath(), notePath(), postCompact(), preCompact() (+12 more)

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

- **Why does `godNodes()` connect `graph.mjs` to `hosts.mjs`, `dream.mjs`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `uninstall()` connect `hosts.mjs` to `dream.mjs`, `tools.mjs`, `graph.mjs`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `description` to the rest of the system?**
  _85 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `atlias.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.1076923076923077 - nodes in this community are weakly interconnected._
- **Should `hosts.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `agent.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `graph.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.12435897435897436 - nodes in this community are weakly interconnected._