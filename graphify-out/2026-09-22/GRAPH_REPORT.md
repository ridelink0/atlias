# Graph Report - atlias  (2026-09-22)

## Corpus Check
- 28 files · ~32,231 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 2)

## Summary
- 349 nodes · 1014 edges · 15 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f2ebfaa9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- tools.mjs
- hosts.mjs
- agent.mjs
- run.mjs
- graph.mjs
- core.mjs
- package.json
- gate.mjs
- dream.mjs
- plugin.json
- atlias
- marketplace.json
- double-check
- atlias
- Changelog

## God Nodes (most connected - your core abstractions)
1. `clip()` - 34 edges
2. `exists()` - 31 edges
3. `config()` - 30 edges
4. `readJson()` - 27 edges
5. `readText()` - 23 edges
6. `writeText()` - 21 edges
7. `writeJson()` - 19 edges
8. `projectDir()` - 18 edges
9. `log()` - 17 edges
10. `Changelog` - 16 edges

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
Cohesion: 0.11
Nodes (23): argv, cwd, claudeMemoryDir(), DEFAULTS, ensureDir(), ROOT, slug(), STATE_DIR (+15 more)

### Community 1 - "hosts.mjs"
Cohesion: 0.09
Nodes (53): HOME, readJson(), readText(), run(), START_MARK, writeJson(), writeText(), CODEX_EVENTS (+45 more)

### Community 2 - "agent.mjs"
Cohesion: 0.14
Nodes (34): b(), c(), chooser(), claudeTurn(), cli(), codexTurn(), d(), detectEngines() (+26 more)

### Community 3 - "run.mjs"
Cohesion: 0.09
Nodes (21): briefCost(), estimateTokens(), graphVsFiles(), interventions(), liveSessions(), report(), ref_node_fs, ref_node_os (+13 more)

### Community 4 - "graph.mjs"
Cohesion: 0.15
Nodes (33): BRIEF_BUDGET_MS, build(), companions(), RULES, sessionStart(), config(), exists(), findPython() (+25 more)

### Community 5 - "core.mjs"
Cohesion: 0.09
Nodes (39): runTool(), CLAUDE_DIR, CODE_EXT, CODEX_DIR, commandFromTool(), detectHost(), emit(), END_MARK (+31 more)

### Community 6 - "package.json"
Cohesion: 0.11
Nodes (17): author, bin, atlias, description, engines, node, keywords, license (+9 more)

### Community 7 - "gate.mjs"
Cohesion: 0.26
Nodes (12): TURN_TAIL, block(), changedFiles(), PARSEABLE, parseGitStatus(), PASS_RE, shellChangedFiles(), stop() (+4 more)

### Community 8 - "dream.mjs"
Cohesion: 0.24
Nodes (22): appendLine(), detach(), events(), projectDir(), readJsonl(), readLines(), tryLock(), unlock() (+14 more)

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
Cohesion: 0.12
Nodes (16): 1.0.0 (2026-09-21), 1.2.0 (2026-09-22), 1.3.0 (2026-09-22), 1.4.0 (2026-09-22), 1.4.1 (2026-09-22), 1.5.0 (2026-09-22), 1.5.1 (2026-09-22), 1.6.0 (2026-09-22) (+8 more)

## Knowledge Gaps
- **102 isolated node(s):** `$schema`, `name`, `description`, `name`, `email` (+97 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 121 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `uninstall()` connect `hosts.mjs` to `atlias`, `graph.mjs`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `godNodes()` connect `graph.mjs` to `dream.mjs`, `hosts.mjs`, `atlias`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `description` to the rest of the system?**
  _102 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `tools.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.10752688172043011 - nodes in this community are weakly interconnected._
- **Should `hosts.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.09316394434361766 - nodes in this community are weakly interconnected._
- **Should `agent.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.13968253968253969 - nodes in this community are weakly interconnected._
- **Should `run.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.09259259259259259 - nodes in this community are weakly interconnected._