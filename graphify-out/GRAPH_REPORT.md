# Graph Report - atlias  (2026-09-22)

## Corpus Check
- 29 files · ~43,131 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 2)

## Summary
- 416 nodes · 1115 edges · 16 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2f22a885`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- graph.mjs
- hosts.mjs
- agent.mjs
- run.mjs
- clip
- bench.mjs
- package.json
- gate.mjs
- tools.mjs
- plugin.json
- atlias
- marketplace.json
- double-check
- atlias
- Changelog
- core.mjs

## God Nodes (most connected - your core abstractions)
1. `clip()` - 34 edges
2. `Changelog` - 34 edges
3. `exists()` - 31 edges
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
- `1.2.0 (2026-09-22)` --references--> `atlias()`  [INFERRED]
  CHANGELOG.md → test/install-sandbox.mjs
- `Tools (MCP server `atlias`)` --references--> `atlias()`  [INFERRED]
  README.md → test/install-sandbox.mjs
- `Two ways to fly` --references--> `atlias()`  [INFERRED]
  README.md → test/install-sandbox.mjs

## Import Cycles
- None detected.

## Communities (16 total, 0 thin omitted)

### Community 0 - "graph.mjs"
Cohesion: 0.15
Nodes (36): appendLine(), detach(), ensureDir(), events(), log(), projectDir(), readJsonl(), readLines() (+28 more)

### Community 1 - "hosts.mjs"
Cohesion: 0.09
Nodes (55): findPython(), graphify(), HOME, installedRoots(), isVersionedPath(), readJson(), readText(), run() (+47 more)

### Community 2 - "agent.mjs"
Cohesion: 0.11
Nodes (39): b(), c(), chooser(), claudeArgs(), claudeTurn(), cli(), codexTurn(), d() (+31 more)

### Community 3 - "run.mjs"
Cohesion: 0.05
Nodes (33): ref_node_child_process, ref_node_os, added, after, before, changed, checks, cursorAfter (+25 more)

### Community 4 - "clip"
Cohesion: 0.17
Nodes (29): build(), companions(), clip(), commandFromTool(), config(), exists(), filesFromTool(), graphPath() (+21 more)

### Community 5 - "bench.mjs"
Cohesion: 0.42
Nodes (8): briefCost(), estimateTokens(), graphVsFiles(), interventions(), liveSessions(), report(), eventsTail(), readTail()

### Community 6 - "package.json"
Cohesion: 0.11
Nodes (18): author, bin, atlias, description, engines, node, keywords, license (+10 more)

### Community 7 - "gate.mjs"
Cohesion: 0.13
Nodes (28): sessionStart(), gitStatusShort(), isCodeFile(), saveSessionMeta(), sessionMeta(), sessionMetaPath(), TURN_TAIL, block() (+20 more)

### Community 8 - "tools.mjs"
Cohesion: 0.19
Nodes (17): claudeMemoryDir(), slug(), VERSION, syntaxReport(), doctorRows(), formatDoctor(), fail(), handle() (+9 more)

### Community 9 - "plugin.json"
Cohesion: 0.17
Nodes (11): author, name, url, description, homepage, keywords, license, name (+3 more)

### Community 10 - "atlias"
Cohesion: 0.12
Nodes (17): 1.2.0 (2026-09-22), atlias, Configuration, Harnesses, Install, Known limits, Sources, Surviving an update (+9 more)

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
Nodes (33): 1.0.0 (2026-09-21), 1.3.0 (2026-09-22), 1.4.0 (2026-09-22), 1.4.1 (2026-09-22), 1.5.0 (2026-09-22), 1.5.1 (2026-09-22), 1.6.0 (2026-09-22), 1.7.0 (2026-09-22) (+25 more)

### Community 16 - "core.mjs"
Cohesion: 0.06
Nodes (35): argv, cwd, FLAG_COMMANDS, BRIEF_BUDGET_MS, fitLines(), RULES, CLAUDE_DIR, CODE_EXT (+27 more)

## Knowledge Gaps
- **147 isolated node(s):** `$schema`, `name`, `description`, `name`, `email` (+142 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 169 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `atlias()` connect `atlias` to `run.mjs`?**
  _High betweenness centrality (0.145) - this node is a cross-community bridge._
- **Why does `Changelog` connect `Changelog` to `atlias`?**
  _High betweenness centrality (0.134) - this node is a cross-community bridge._
- **Why does `1.2.0 (2026-09-22)` connect `atlias` to `Changelog`?**
  _High betweenness centrality (0.131) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `description` to the rest of the system?**
  _147 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `graph.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.14793741109530584 - nodes in this community are weakly interconnected._
- **Should `hosts.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.09376890502117362 - nodes in this community are weakly interconnected._
- **Should `agent.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.11219512195121951 - nodes in this community are weakly interconnected._