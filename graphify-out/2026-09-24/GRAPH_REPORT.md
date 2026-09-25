# Graph Report - atlias  (2026-09-24)

## Corpus Check
- 43 files · ~95,327 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 2)

## Summary
- 588 nodes · 1552 edges · 19 communities
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `29ade263`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- graph.mjs
- loop.mjs
- agent.mjs
- install-sandbox.mjs
- server.mjs
- gate.mjs
- package.json
- core.mjs
- run.mjs
- plugin.json
- README.md
- integrity.mjs
- marketplace.json
- double-check
- atlias
- Changelog
- atlias.mjs
- hosts.mjs
- atlias

## God Nodes (most connected - your core abstractions)
1. `clip()` - 46 edges
2. `config()` - 38 edges
3. `Changelog` - 36 edges
4. `readJson()` - 34 edges
5. `exists()` - 32 edges
6. `runTool()` - 29 edges
7. `readText()` - 24 edges
8. `writeText()` - 24 edges
9. `writeJson()` - 24 edges
10. `projectDir()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Hosts: what they really send` --references--> `filesFromTool()`  [INFERRED]
  docs/RESEARCH.md → lib/core.mjs
- `Hosts: what they really send` --references--> `applyUpdate()`  [INFERRED]
  docs/RESEARCH.md → lib/loop.mjs
- `1.2.0 (2026-09-22)` --references--> `atlias()`  [INFERRED]
  CHANGELOG.md → test/install-sandbox.mjs
- `3.0.0 (2026-09-22)` --references--> `atlias()`  [INFERRED]
  CHANGELOG.md → test/install-sandbox.mjs
- `Install` --references--> `atlias()`  [INFERRED]
  README.md → test/install-sandbox.mjs

## Import Cycles
- None detected.

## Communities (19 total, 0 thin omitted)

### Community 0 - "graph.mjs"
Cohesion: 0.11
Nodes (49): briefCost(), estimateTokens(), graphVsFiles(), interventions(), liveSessions(), report(), appendLine(), detach() (+41 more)

### Community 1 - "loop.mjs"
Cohesion: 0.07
Nodes (52): Keeping the context small, programCommand(), apiKey(), applyUpdate(), ARG_ALIASES, checkCommand(), compact(), confirmOutside() (+44 more)

### Community 2 - "agent.mjs"
Cohesion: 0.11
Nodes (43): b(), c(), chatPath(), CHATS(), chooser(), claudeArgs(), claudeTurn(), cli() (+35 more)

### Community 3 - "install-sandbox.mjs"
Cohesion: 0.05
Nodes (39): ago(), line(), pct(), reading(), resets(), section(), STANCE, ref_node_fs (+31 more)

### Community 4 - "server.mjs"
Cohesion: 0.48
Nodes (6): VERSION, fail(), handle(), reply(), send(), TOOLS

### Community 5 - "gate.mjs"
Cohesion: 0.15
Nodes (26): eventsTail(), gitStatusShort(), readTail(), TURN_TAIL, block(), changedFiles(), lastPrompt(), PARSEABLE (+18 more)

### Community 6 - "package.json"
Cohesion: 0.11
Nodes (18): author, bin, atlias, description, engines, node, keywords, license (+10 more)

### Community 7 - "core.mjs"
Cohesion: 0.07
Nodes (53): BRIEF_BUDGET_MS, fitLines(), RULES, sessionStart(), CLAUDE_DIR, clip(), CODE_EXT, commandFromTool() (+45 more)

### Community 8 - "run.mjs"
Cohesion: 0.07
Nodes (33): chooseShimDir(), CLI_LAUNCHER_SOURCE, installShortcut(), launcherPath(), MARKER, onPath(), shimDirCandidates(), shimFiles() (+25 more)

### Community 9 - "plugin.json"
Cohesion: 0.17
Nodes (11): author, name, url, description, homepage, keywords, license, name (+3 more)

### Community 10 - "README.md"
Cohesion: 0.17
Nodes (11): Built on, In every host, Known limits, Measured, Settings, Surviving an update, Tests, The agent (+3 more)

### Community 11 - "integrity.mjs"
Cohesion: 0.08
Nodes (37): Hosts: what they really send, Making a weak model finish the job, Not measured, One live run, What atlias is built on, isCodeFile(), check(), CONVENTION_NAMES (+29 more)

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
Nodes (34): 1.0.0 (2026-09-21), 1.3.0 (2026-09-22), 1.4.0 (2026-09-22), 1.4.1 (2026-09-22), 1.5.0 (2026-09-22), 1.5.1 (2026-09-22), 1.6.0 (2026-09-22), 1.7.0 (2026-09-22) (+26 more)

### Community 18 - "atlias.mjs"
Cohesion: 0.09
Nodes (18): argv, cwd, FLAG_COMMANDS, shortcutInstall(), CHOICES, DEFAULTS, parseSetting(), STATE_DIR (+10 more)

### Community 19 - "hosts.mjs"
Cohesion: 0.07
Nodes (77): build(), companions(), claudeMemoryDir(), CODEX_DIR, config(), END_MARK, ensureDir(), exists() (+69 more)

### Community 20 - "atlias"
Cohesion: 0.40
Nodes (5): 1.2.0 (2026-09-22), 3.0.0 (2026-09-22), Install, Sub-harness, agent, or both, atlias()

## Knowledge Gaps
- **185 isolated node(s):** `$schema`, `name`, `description`, `name`, `email` (+180 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 211 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `atlias()` connect `atlias` to `README.md`, `install-sandbox.mjs`?**
  _High betweenness centrality (0.147) - this node is a cross-community bridge._
- **Why does `Changelog` connect `Changelog` to `atlias`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Why does `3.0.0 (2026-09-22)` connect `atlias` to `Changelog`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `description` to the rest of the system?**
  _185 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `graph.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.10633484162895927 - nodes in this community are weakly interconnected._
- **Should `loop.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.06753246753246753 - nodes in this community are weakly interconnected._
- **Should `agent.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.10808080808080808 - nodes in this community are weakly interconnected._