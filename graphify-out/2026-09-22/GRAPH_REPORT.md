# Graph Report - atlias  (2026-09-22)

## Corpus Check
- 43 files · ~93,919 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 2)

## Summary
- 581 nodes · 1529 edges · 19 communities
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d1ec7ec4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- graph.mjs
- loop.mjs
- agent.mjs
- install-sandbox.mjs
- gate.mjs
- server.mjs
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
- usage.mjs
- atlias.mjs
- hosts.mjs

## God Nodes (most connected - your core abstractions)
1. `clip()` - 46 edges
2. `config()` - 38 edges
3. `readJson()` - 34 edges
4. `Changelog` - 34 edges
5. `exists()` - 31 edges
6. `runTool()` - 29 edges
7. `readText()` - 24 edges
8. `writeJson()` - 23 edges
9. `writeText()` - 22 edges
10. `projectDir()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Hosts: what they really send` --references--> `filesFromTool()`  [INFERRED]
  docs/RESEARCH.md → lib/core.mjs
- `Hosts: what they really send` --references--> `verdict()`  [INFERRED]
  docs/RESEARCH.md → lib/integrity.mjs
- `1.2.0 (2026-09-22)` --references--> `atlias()`  [INFERRED]
  CHANGELOG.md → test/install-sandbox.mjs
- `Install` --references--> `atlias()`  [INFERRED]
  README.md → test/install-sandbox.mjs
- `Sub-harness, agent, or both` --references--> `atlias()`  [INFERRED]
  README.md → test/install-sandbox.mjs

## Import Cycles
- None detected.

## Communities (19 total, 0 thin omitted)

### Community 0 - "graph.mjs"
Cohesion: 0.10
Nodes (52): briefCost(), estimateTokens(), graphVsFiles(), interventions(), liveSessions(), report(), appendLine(), detach() (+44 more)

### Community 1 - "loop.mjs"
Cohesion: 0.06
Nodes (60): Hosts: what they really send, Keeping the context small, Making a weak model finish the job, Not measured, One live run, What atlias is built on, programCommand(), findWeakenedTests() (+52 more)

### Community 2 - "agent.mjs"
Cohesion: 0.12
Nodes (41): b(), c(), chatPath(), CHATS(), chooser(), claudeArgs(), claudeTurn(), cli() (+33 more)

### Community 3 - "install-sandbox.mjs"
Cohesion: 0.06
Nodes (44): wordmark(), chooseShimDir(), CLI_LAUNCHER_SOURCE, installShortcut(), launcherPath(), MARKER, onPath(), shimDirCandidates() (+36 more)

### Community 4 - "gate.mjs"
Cohesion: 0.15
Nodes (24): gitStatusShort(), TURN_TAIL, block(), changedFiles(), lastPrompt(), PARSEABLE, parseGitStatus(), PASS_RE (+16 more)

### Community 5 - "server.mjs"
Cohesion: 0.48
Nodes (6): VERSION, fail(), handle(), reply(), send(), TOOLS

### Community 6 - "package.json"
Cohesion: 0.11
Nodes (18): author, bin, atlias, description, engines, node, keywords, license (+10 more)

### Community 7 - "core.mjs"
Cohesion: 0.07
Nodes (57): BRIEF_BUDGET_MS, build(), companions(), fitLines(), RULES, sessionStart(), clip(), CODE_EXT (+49 more)

### Community 8 - "run.mjs"
Cohesion: 0.08
Nodes (21): aliasesByModule(), calledBare(), coverageSuites(), esc(), EXEMPT, reExporters(), USED_CORPUS, usedThrough() (+13 more)

### Community 9 - "plugin.json"
Cohesion: 0.17
Nodes (11): author, name, url, description, homepage, keywords, license, name (+3 more)

### Community 10 - "README.md"
Cohesion: 0.14
Nodes (15): 1.2.0 (2026-09-22), Built on, In every host, Install, Known limits, Measured, Settings, Sub-harness, agent, or both (+7 more)

### Community 11 - "integrity.mjs"
Cohesion: 0.10
Nodes (30): isCodeFile(), check(), CONVENTION_NAMES, DEF_PATTERNS, diffFor(), DONE_RE, FAIL_RE, failExcerpt() (+22 more)

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

### Community 17 - "usage.mjs"
Cohesion: 0.33
Nodes (8): CLAUDE_DIR, ago(), line(), pct(), reading(), resets(), section(), STANCE

### Community 18 - "atlias.mjs"
Cohesion: 0.09
Nodes (21): argv, cwd, FLAG_COMMANDS, shortcutInstall(), CHOICES, DEFAULTS, parseSetting(), ROOT (+13 more)

### Community 19 - "hosts.mjs"
Cohesion: 0.09
Nodes (64): claudeMemoryDir(), exists(), findPython(), installedRoots(), isVersionedPath(), readJson(), readText(), run() (+56 more)

## Knowledge Gaps
- **183 isolated node(s):** `$schema`, `name`, `description`, `name`, `email` (+178 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 209 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `atlias()` connect `README.md` to `install-sandbox.mjs`?**
  _High betweenness centrality (0.143) - this node is a cross-community bridge._
- **Why does `Changelog` connect `Changelog` to `README.md`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Why does `1.2.0 (2026-09-22)` connect `README.md` to `Changelog`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `description` to the rest of the system?**
  _183 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `graph.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.10101010101010101 - nodes in this community are weakly interconnected._
- **Should `loop.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.05803571428571429 - nodes in this community are weakly interconnected._
- **Should `agent.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.12181616832779624 - nodes in this community are weakly interconnected._