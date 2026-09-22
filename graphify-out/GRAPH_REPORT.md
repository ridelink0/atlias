# Graph Report - atlias  (2026-09-22)

## Corpus Check
- 28 files · ~34,251 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 2)

## Summary
- 357 nodes · 1023 edges · 16 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d24941fe`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- graph.mjs
- hosts.mjs
- agent.mjs
- run.mjs
- core.mjs
- package.json
- progress.mjs
- dream.mjs
- plugin.json
- atlias
- clip
- marketplace.json
- double-check
- atlias
- Changelog
- atlias.mjs

## God Nodes (most connected - your core abstractions)
1. `clip()` - 34 edges
2. `config()` - 30 edges
3. `exists()` - 29 edges
4. `readJson()` - 27 edges
5. `readText()` - 23 edges
6. `writeText()` - 21 edges
7. `writeJson()` - 19 edges
8. `Changelog` - 19 edges
9. `projectDir()` - 18 edges
10. `log()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Configuration` --references--> `godNodes()`  [INFERRED]
  README.md → lib/graph.mjs
- `Install` --references--> `uninstall()`  [INFERRED]
  README.md → lib/hosts-extra.mjs
- `repl()` --calls--> `recall()`  [EXTRACTED]
  lib/agent.mjs → mcp/tools.mjs
- `remember()` --calls--> `ensureDir()`  [EXTRACTED]
  mcp/tools.mjs → lib/core.mjs
- `recall()` --calls--> `readText()`  [EXTRACTED]
  mcp/tools.mjs → lib/core.mjs

## Import Cycles
- None detected.

## Communities (16 total, 0 thin omitted)

### Community 0 - "graph.mjs"
Cohesion: 0.18
Nodes (24): detach(), graphify(), graphPath(), log(), mtime(), tryLock(), unlock(), sessionEnd() (+16 more)

### Community 1 - "hosts.mjs"
Cohesion: 0.09
Nodes (52): CLAUDE_DIR, CODEX_DIR, END_MARK, GEMINI_DIR, HOME, readJson(), readText(), START_MARK (+44 more)

### Community 2 - "agent.mjs"
Cohesion: 0.13
Nodes (34): b(), c(), chooser(), claudeTurn(), cli(), codexTurn(), d(), detectEngines() (+26 more)

### Community 3 - "run.mjs"
Cohesion: 0.11
Nodes (14): ref_node_os, ref_node_url, check(), DANGER, mcpSuite(), only, PROJECT, results (+6 more)

### Community 5 - "core.mjs"
Cohesion: 0.11
Nodes (32): CODE_EXT, commandFromTool(), detectHost(), emit(), EVENT_MAX, eventsTail(), filesFromTool(), gitMemo (+24 more)

### Community 6 - "package.json"
Cohesion: 0.11
Nodes (17): author, bin, atlias, description, engines, node, keywords, license (+9 more)

### Community 7 - "progress.mjs"
Cohesion: 0.35
Nodes (11): gitStatusShort(), TURN_TAIL, applyNext(), build(), nextPath(), notePath(), postCompact(), preCompact() (+3 more)

### Community 8 - "dream.mjs"
Cohesion: 0.18
Nodes (29): briefCost(), estimateTokens(), graphVsFiles(), interventions(), liveSessions(), report(), appendLine(), ensureDir() (+21 more)

### Community 9 - "plugin.json"
Cohesion: 0.17
Nodes (11): author, name, url, description, homepage, keywords, license, name (+3 more)

### Community 10 - "atlias"
Cohesion: 0.13
Nodes (14): atlias, Configuration, Harnesses, Install, Known limits, Sources, Tests that teach, Tools (MCP server `atlias`) (+6 more)

### Community 11 - "clip"
Cohesion: 0.15
Nodes (33): runTool(), BRIEF_BUDGET_MS, build(), companions(), RULES, sessionStart(), claudeMemoryDir(), clip() (+25 more)

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
Cohesion: 0.10
Nodes (19): 1.0.0 (2026-09-21), 1.2.0 (2026-09-22), 1.3.0 (2026-09-22), 1.4.0 (2026-09-22), 1.4.1 (2026-09-22), 1.5.0 (2026-09-22), 1.5.1 (2026-09-22), 1.6.0 (2026-09-22) (+11 more)

### Community 16 - "atlias.mjs"
Cohesion: 0.13
Nodes (12): argv, cwd, DEFAULTS, ROOT, STATE_DIR, VERSION, fail(), handle() (+4 more)

## Knowledge Gaps
- **107 isolated node(s):** `$schema`, `name`, `description`, `name`, `email` (+102 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 127 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `uninstall()` connect `hosts.mjs` to `atlias`, `clip`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `godNodes()` connect `graph.mjs` to `dream.mjs`, `hosts.mjs`, `atlias`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `description` to the rest of the system?**
  _107 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `hosts.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.09273182957393483 - nodes in this community are weakly interconnected._
- **Should `agent.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.13174603174603175 - nodes in this community are weakly interconnected._
- **Should `run.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `core.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._