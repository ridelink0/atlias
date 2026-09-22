# Graph Report - atlias  (2026-09-22)

## Corpus Check
- 28 files · ~29,687 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 2)

## Summary
- 340 nodes · 992 edges · 15 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7f22d92a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- tools.mjs
- hosts.mjs
- agent.mjs
- core.mjs
- gate.mjs
- clip
- package.json
- graph.mjs
- dream.mjs
- plugin.json
- atlias
- marketplace.json
- double-check
- atlias
- Changelog

## God Nodes (most connected - your core abstractions)
1. `clip()` - 34 edges
2. `exists()` - 30 edges
3. `config()` - 30 edges
4. `readJson()` - 27 edges
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

### Community 0 - "tools.mjs"
Cohesion: 0.23
Nodes (17): claudeMemoryDir(), readLines(), readText(), slug(), doctor(), doctorRows(), formatDoctor(), fail() (+9 more)

### Community 1 - "hosts.mjs"
Cohesion: 0.07
Nodes (62): BRIEF_BUDGET_MS, build(), companions(), RULES, sessionStart(), CLAUDE_DIR, CODEX_DIR, END_MARK (+54 more)

### Community 2 - "agent.mjs"
Cohesion: 0.13
Nodes (35): b(), c(), chooser(), claudeTurn(), cli(), codexTurn(), d(), detectEngines() (+27 more)

### Community 3 - "core.mjs"
Cohesion: 0.05
Nodes (38): argv, cwd, CODE_EXT, DEFAULTS, detectHost(), emit(), GUARD_TAIL, HOST_LABEL (+30 more)

### Community 4 - "gate.mjs"
Cohesion: 0.17
Nodes (21): eventsTail(), readTail(), run(), TURN_TAIL, block(), changedFiles(), PARSEABLE, PASS_RE (+13 more)

### Community 5 - "clip"
Cohesion: 0.26
Nodes (16): runTool(), clip(), commandFromTool(), filesFromTool(), isCodeFile(), isEditTool(), isShellTool(), looksLikeVerification() (+8 more)

### Community 6 - "package.json"
Cohesion: 0.11
Nodes (17): author, bin, atlias, description, engines, node, keywords, license (+9 more)

### Community 7 - "graph.mjs"
Cohesion: 0.22
Nodes (17): detach(), graphify(), log(), tryLock(), unlock(), age(), dirtyPath(), GODNODES_MS (+9 more)

### Community 8 - "dream.mjs"
Cohesion: 0.19
Nodes (27): briefCost(), estimateTokens(), graphVsFiles(), interventions(), liveSessions(), report(), appendLine(), ensureDir() (+19 more)

### Community 9 - "plugin.json"
Cohesion: 0.17
Nodes (11): author, name, url, description, homepage, keywords, license, name (+3 more)

### Community 10 - "atlias"
Cohesion: 0.14
Nodes (13): atlias, Configuration, Harnesses, Install, Known limits, Sources, Tests that teach, Tools (MCP server `atlias`) (+5 more)

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
Cohesion: 0.15
Nodes (12): 1.0.0 (2026-09-21), 1.2.0 (2026-09-22), 1.3.0 (2026-09-22), 1.4.0 (2026-09-22), 1.4.1 (2026-09-22), 1.5.0 (2026-09-22), 1.5.1 (2026-09-22), 1.6.0 (2026-09-22) (+4 more)

## Knowledge Gaps
- **97 isolated node(s):** `$schema`, `name`, `description`, `name`, `email` (+92 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 116 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `uninstall()` connect `hosts.mjs` to `tools.mjs`, `dream.mjs`, `atlias`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `godNodes()` connect `hosts.mjs` to `dream.mjs`, `atlias`, `graph.mjs`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `description` to the rest of the system?**
  _97 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `hosts.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.07287093942054433 - nodes in this community are weakly interconnected._
- **Should `agent.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.13213213213213212 - nodes in this community are weakly interconnected._
- **Should `core.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.05297532656023222 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._