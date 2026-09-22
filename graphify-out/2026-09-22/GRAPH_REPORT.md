# Graph Report - atlias  (2026-09-22)

## Corpus Check
- 27 files · ~22,574 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 2)

## Summary
- 306 nodes · 915 edges · 16 communities
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
- exists
- dream.mjs
- package.json
- tools.mjs
- track.mjs
- plugin.json
- atlias
- progress.mjs
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
- `runTool()` --calls--> `remember()`  [EXTRACTED]
  lib/agent.mjs → mcp/tools.mjs
- `callTool()` --calls--> `readText()`  [EXTRACTED]
  mcp/tools.mjs → lib/core.mjs
- `recall()` --calls--> `readText()`  [EXTRACTED]
  mcp/tools.mjs → lib/core.mjs

## Import Cycles
- None detected.

## Communities (16 total, 0 thin omitted)

### Community 0 - "core.mjs"
Cohesion: 0.05
Nodes (39): argv, cwd, RULES, CLAUDE_DIR, CODE_EXT, CODEX_DIR, DEFAULTS, detectHost() (+31 more)

### Community 1 - "hosts.mjs"
Cohesion: 0.12
Nodes (40): readJson(), readText(), START_MARK, writeJson(), writeText(), CODEX_EVENTS, dropAtliasTables(), esc() (+32 more)

### Community 2 - "agent.mjs"
Cohesion: 0.15
Nodes (36): b(), c(), chooser(), claudeTurn(), cli(), codexTurn(), d(), detectEngines() (+28 more)

### Community 3 - "graph.mjs"
Cohesion: 0.22
Nodes (22): detach(), graphify(), graphPath(), log(), mtime(), projectDir(), tryLock(), unlock() (+14 more)

### Community 4 - "exists"
Cohesion: 0.21
Nodes (19): build(), companions(), sessionStart(), exists(), findPython(), run(), saveSessionMeta(), sessionMeta() (+11 more)

### Community 5 - "dream.mjs"
Cohesion: 0.24
Nodes (19): appendLine(), events(), readJsonl(), readLines(), safeId(), sessionDir(), sessionEvents(), sessionMetaPath() (+11 more)

### Community 6 - "package.json"
Cohesion: 0.11
Nodes (17): author, bin, atlias, description, engines, node, keywords, license (+9 more)

### Community 7 - "tools.mjs"
Cohesion: 0.22
Nodes (15): claudeMemoryDir(), ensureDir(), slug(), VERSION, doctor(), formatDoctor(), fail(), handle() (+7 more)

### Community 8 - "track.mjs"
Cohesion: 0.30
Nodes (13): commandFromTool(), filesFromTool(), isCodeFile(), isEditTool(), isShellTool(), looksLikeVerification(), recordEvent(), sha() (+5 more)

### Community 9 - "plugin.json"
Cohesion: 0.17
Nodes (11): author, name, url, description, homepage, keywords, license, name (+3 more)

### Community 10 - "atlias"
Cohesion: 0.17
Nodes (11): atlias, Configuration, Harnesses, Install, Known limits, Sources, Tests that teach, Tools (MCP server `atlias`) (+3 more)

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
Cohesion: 0.50
Nodes (3): 1.0.0 (2026-09-21), 1.2.0 (2026-09-22), Changelog

## Knowledge Gaps
- **78 isolated node(s):** `$schema`, `name`, `description`, `name`, `email` (+73 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 97 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `uninstall()` connect `hosts.mjs` to `atlias`, `exists`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `exists()` connect `exists` to `core.mjs`, `hosts.mjs`, `agent.mjs`, `graph.mjs`, `dream.mjs`, `tools.mjs`, `track.mjs`, `progress.mjs`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `description` to the rest of the system?**
  _78 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `core.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.05454545454545454 - nodes in this community are weakly interconnected._
- **Should `hosts.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.12473572938689217 - nodes in this community are weakly interconnected._
- **Should `agent.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.14509246088193456 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._