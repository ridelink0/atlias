# Graph Report - atlias  (2026-09-22)

## Corpus Check
- 28 files · ~28,723 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 2)

## Summary
- 337 nodes · 981 edges · 16 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7f22d92a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- server.mjs
- hosts.mjs
- agent.mjs
- run.mjs
- gate.mjs
- track.mjs
- package.json
- graph.mjs
- core.mjs
- plugin.json
- atlias
- hooks.mjs
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

## Communities (16 total, 0 thin omitted)

### Community 0 - "server.mjs"
Cohesion: 0.60
Nodes (5): fail(), handle(), reply(), send(), TOOLS

### Community 1 - "hosts.mjs"
Cohesion: 0.10
Nodes (51): claudeMemoryDir(), HOME, readJson(), readText(), START_MARK, writeJson(), writeText(), CODEX_EVENTS (+43 more)

### Community 2 - "agent.mjs"
Cohesion: 0.13
Nodes (37): b(), c(), chooser(), claudeTurn(), cli(), codexTurn(), d(), detectEngines() (+29 more)

### Community 3 - "run.mjs"
Cohesion: 0.06
Nodes (27): argv, cwd, briefCost(), estimateTokens(), graphVsFiles(), interventions(), report(), DEFAULTS (+19 more)

### Community 4 - "gate.mjs"
Cohesion: 0.17
Nodes (21): eventsTail(), readTail(), run(), TURN_TAIL, block(), changedFiles(), PARSEABLE, PASS_RE (+13 more)

### Community 5 - "track.mjs"
Cohesion: 0.30
Nodes (13): commandFromTool(), filesFromTool(), isCodeFile(), isEditTool(), isShellTool(), looksLikeVerification(), recordEvent(), sha() (+5 more)

### Community 6 - "package.json"
Cohesion: 0.11
Nodes (17): author, bin, atlias, description, engines, node, keywords, license (+9 more)

### Community 7 - "graph.mjs"
Cohesion: 0.16
Nodes (32): BRIEF_BUDGET_MS, build(), companions(), RULES, sessionStart(), clip(), exists(), findPython() (+24 more)

### Community 8 - "core.mjs"
Cohesion: 0.12
Nodes (38): appendLine(), CLAUDE_DIR, CODE_EXT, CODEX_DIR, detach(), END_MARK, ensureDir(), events() (+30 more)

### Community 9 - "plugin.json"
Cohesion: 0.17
Nodes (11): author, name, url, description, homepage, keywords, license, name (+3 more)

### Community 10 - "atlias"
Cohesion: 0.14
Nodes (13): atlias, Configuration, Harnesses, Install, Known limits, Sources, Tests that teach, Tools (MCP server `atlias`) (+5 more)

### Community 11 - "hooks.mjs"
Cohesion: 0.39
Nodes (7): detectHost(), emit(), readStdin(), dispatch(), host, main(), shape()

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
Cohesion: 0.17
Nodes (11): 1.0.0 (2026-09-21), 1.2.0 (2026-09-22), 1.3.0 (2026-09-22), 1.4.0 (2026-09-22), 1.4.1 (2026-09-22), 1.5.0 (2026-09-22), 1.5.1 (2026-09-22), 1.6.0 (2026-09-22) (+3 more)

## Knowledge Gaps
- **96 isolated node(s):** `$schema`, `name`, `description`, `name`, `email` (+91 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 115 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `godNodes()` connect `graph.mjs` to `core.mjs`, `hosts.mjs`, `atlias`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `uninstall()` connect `hosts.mjs` to `atlias`, `graph.mjs`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `description` to the rest of the system?**
  _96 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `hosts.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `agent.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.12550607287449392 - nodes in this community are weakly interconnected._
- **Should `run.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.0641025641025641 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._