# Graph Report - atlias  (2026-09-22)

## Corpus Check
- 28 files · ~41,818 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 2)

## Summary
- 390 nodes · 1082 edges · 16 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fde4cc7f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- dream.mjs
- hosts.mjs
- agent.mjs
- run.mjs
- brief.mjs
- graph.mjs
- package.json
- gate.mjs
- atlias.mjs
- plugin.json
- atlias
- marketplace.json
- double-check
- atlias
- Changelog
- core.mjs

## God Nodes (most connected - your core abstractions)
1. `clip()` - 34 edges
2. `Changelog` - 32 edges
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
- `runTool()` --calls--> `remember()`  [EXTRACTED]
  lib/agent.mjs → mcp/tools.mjs
- `remember()` --calls--> `ensureDir()`  [EXTRACTED]
  mcp/tools.mjs → lib/core.mjs
- `callTool()` --calls--> `readText()`  [EXTRACTED]
  mcp/tools.mjs → lib/core.mjs

## Import Cycles
- None detected.

## Communities (16 total, 0 thin omitted)

### Community 0 - "dream.mjs"
Cohesion: 0.18
Nodes (28): briefCost(), estimateTokens(), graphVsFiles(), interventions(), liveSessions(), report(), appendLine(), ensureDir() (+20 more)

### Community 1 - "hosts.mjs"
Cohesion: 0.10
Nodes (54): exists(), findPython(), installedRoots(), isVersionedPath(), readJson(), readText(), run(), START_MARK (+46 more)

### Community 2 - "agent.mjs"
Cohesion: 0.12
Nodes (41): b(), c(), chooser(), claudeArgs(), claudeTurn(), cli(), codexTurn(), d() (+33 more)

### Community 3 - "run.mjs"
Cohesion: 0.11
Nodes (14): ref_node_os, ref_node_url, check(), DANGER, mcpSuite(), only, PROJECT, results (+6 more)

### Community 4 - "brief.mjs"
Cohesion: 0.22
Nodes (15): BRIEF_BUDGET_MS, build(), companions(), fitLines(), RULES, sessionStart(), CLAUDE_DIR, saveSessionMeta() (+7 more)

### Community 5 - "graph.mjs"
Cohesion: 0.18
Nodes (23): detach(), graphify(), graphPath(), log(), mtime(), tryLock(), unlock(), sessionEnd() (+15 more)

### Community 6 - "package.json"
Cohesion: 0.11
Nodes (17): author, bin, atlias, description, engines, node, keywords, license (+9 more)

### Community 7 - "gate.mjs"
Cohesion: 0.15
Nodes (24): gitStatusShort(), TURN_TAIL, block(), changedFiles(), lastPrompt(), PARSEABLE, parseGitStatus(), PASS_RE (+16 more)

### Community 8 - "atlias.mjs"
Cohesion: 0.10
Nodes (22): argv, cwd, FLAG_COMMANDS, claudeMemoryDir(), DEFAULTS, parseSetting(), ROOT, slug() (+14 more)

### Community 9 - "plugin.json"
Cohesion: 0.17
Nodes (11): author, name, url, description, homepage, keywords, license, name (+3 more)

### Community 10 - "atlias"
Cohesion: 0.12
Nodes (15): atlias, Configuration, Harnesses, Install, Known limits, Sources, Surviving an update, Tests that teach (+7 more)

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
Nodes (32): 1.0.0 (2026-09-21), 1.2.0 (2026-09-22), 1.3.0 (2026-09-22), 1.4.0 (2026-09-22), 1.4.1 (2026-09-22), 1.5.0 (2026-09-22), 1.5.1 (2026-09-22), 1.6.0 (2026-09-22) (+24 more)

### Community 16 - "core.mjs"
Cohesion: 0.08
Nodes (40): CODE_EXT, CODEX_DIR, commandFromTool(), detectHost(), emit(), END_MARK, EVENT_MAX, eventsTail() (+32 more)

## Knowledge Gaps
- **128 isolated node(s):** `$schema`, `name`, `description`, `name`, `email` (+123 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 148 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `uninstall()` connect `hosts.mjs` to `atlias`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `godNodes()` connect `graph.mjs` to `dream.mjs`, `hosts.mjs`, `atlias`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `description` to the rest of the system?**
  _128 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `hosts.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.10275689223057644 - nodes in this community are weakly interconnected._
- **Should `agent.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.12070874861572536 - nodes in this community are weakly interconnected._
- **Should `run.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._