# Graph Report - atlias  (2026-09-24)

## Corpus Check
- 49 files · ~98,195 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 2)

## Summary
- 611 nodes · 1595 edges · 28 communities
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `aee1b2f2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- graph.mjs
- loop.mjs
- agent.mjs
- install-sandbox.mjs
- gate.mjs
- make-logo.mjs
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
- runTool
- server.mjs
- atlias.mjs
- hosts.mjs
- atlias
- The next generation: what atlias takes from the field, and what it adds
- eval.mjs
- What atlias is built on
- usage.mjs
- runLoop
- Hosts: what they really send
- ref_node_path

## God Nodes (most connected - your core abstractions)
1. `clip()` - 46 edges
2. `config()` - 38 edges
3. `Changelog` - 37 edges
4. `readJson()` - 34 edges
5. `exists()` - 32 edges
6. `runTool()` - 29 edges
7. `readText()` - 24 edges
8. `writeText()` - 24 edges
9. `writeJson()` - 24 edges
10. `projectDir()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Keeping the context small` --references--> `view()`  [INFERRED]
  docs/RESEARCH.md → lib/loop.mjs
- `Hosts: what they really send` --references--> `filesFromTool()`  [INFERRED]
  docs/RESEARCH.md → lib/core.mjs
- `Hosts: what they really send` --references--> `verdict()`  [INFERRED]
  docs/RESEARCH.md → lib/integrity.mjs
- `3.1.0 (2026-09-25)` --references--> `view()`  [INFERRED]
  CHANGELOG.md → lib/loop.mjs
- `What was wrong, and is now fixed` --references--> `view()`  [INFERRED]
  docs/NEXTGEN.md → lib/loop.mjs

## Import Cycles
- None detected.

## Communities (28 total, 0 thin omitted)

### Community 0 - "graph.mjs"
Cohesion: 0.10
Nodes (52): briefCost(), estimateTokens(), graphVsFiles(), interventions(), liveSessions(), report(), appendLine(), detach() (+44 more)

### Community 1 - "loop.mjs"
Cohesion: 0.11
Nodes (24): apiKey(), ARG_ALIASES, confirmOutside(), extractObject(), insideProject(), INSTRUCTION_FILES, normalizeCall(), normalizeJson() (+16 more)

### Community 2 - "agent.mjs"
Cohesion: 0.12
Nodes (42): b(), c(), chatPath(), CHATS(), chooser(), claudeArgs(), claudeTurn(), cli() (+34 more)

### Community 3 - "install-sandbox.mjs"
Cohesion: 0.08
Nodes (23): ref_node_child_process, added, after, before, changed, checks, cursorAfter, cursorMcp (+15 more)

### Community 4 - "gate.mjs"
Cohesion: 0.15
Nodes (26): findPython(), gitStatusShort(), run(), TURN_TAIL, block(), changedFiles(), lastPrompt(), PARSEABLE (+18 more)

### Community 5 - "make-logo.mjs"
Cohesion: 0.33
Nodes (8): wordmark(), BLUE, letters(), out, ROOT, ship(), stars(), svg()

### Community 6 - "package.json"
Cohesion: 0.11
Nodes (18): author, bin, atlias, description, engines, node, keywords, license (+10 more)

### Community 7 - "core.mjs"
Cohesion: 0.06
Nodes (59): BRIEF_BUDGET_MS, build(), companions(), fitLines(), RULES, sessionStart(), claudeMemoryDir(), clip() (+51 more)

### Community 8 - "run.mjs"
Cohesion: 0.07
Nodes (32): chooseShimDir(), CLI_LAUNCHER_SOURCE, installShortcut(), launcherPath(), MARKER, onPath(), shimDirCandidates(), shimFiles() (+24 more)

### Community 9 - "plugin.json"
Cohesion: 0.17
Nodes (11): author, name, url, description, homepage, keywords, license, name (+3 more)

### Community 10 - "README.md"
Cohesion: 0.17
Nodes (11): Built on, In every host, Known limits, Measured, Settings, Surviving an update, Tests, The agent (+3 more)

### Community 11 - "integrity.mjs"
Cohesion: 0.10
Nodes (31): isCodeFile(), check(), CONVENTION_NAMES, DEF_PATTERNS, diffFor(), DONE_RE, FAIL_RE, failExcerpt() (+23 more)

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

### Community 16 - "runTool"
Cohesion: 0.19
Nodes (15): programCommand(), compact(), forgetReads(), numbered(), outlineFile(), outlineFolder(), OUTSIDE(), projectInstructions() (+7 more)

### Community 17 - "server.mjs"
Cohesion: 0.48
Nodes (6): VERSION, fail(), handle(), reply(), send(), TOOLS

### Community 18 - "atlias.mjs"
Cohesion: 0.09
Nodes (19): argv, cwd, FLAG_COMMANDS, shortcutInstall(), CHOICES, DEFAULTS, parseSetting(), ROOT (+11 more)

### Community 19 - "hosts.mjs"
Cohesion: 0.09
Nodes (63): exists(), installedRoots(), isVersionedPath(), readJson(), readText(), START_MARK, writeHooksLauncher(), writeJson() (+55 more)

### Community 20 - "atlias"
Cohesion: 0.40
Nodes (5): 1.2.0 (2026-09-22), 3.0.0 (2026-09-22), Install, Sub-harness, agent, or both, atlias()

### Community 21 - "The next generation: what atlias takes from the field, and what it adds"
Cohesion: 0.20
Nodes (10): 3.1.0 (2026-09-25), Ranked, still to build, The next generation: what atlias takes from the field, and what it adds, The one number that has changed, Unverified, What atlias already had, What the field actually looks like, What was wrong, and is now fixed (+2 more)

### Community 22 - "eval.mjs"
Cohesion: 0.27
Nodes (7): STATE_DIR, makeWorkspace(), runSuite(), runTask(), score(), TASKS_DIR, ref_node_url

### Community 23 - "What atlias is built on"
Cohesion: 0.22
Nodes (8): Keeping the context small, Making a weak model finish the job, Not measured, One live run, What atlias is built on, findWeakenedTests(), guardedWrite(), systemPrompt()

### Community 24 - "usage.mjs"
Cohesion: 0.33
Nodes (8): CLAUDE_DIR, ago(), line(), pct(), reading(), resets(), section(), STANCE

### Community 25 - "runLoop"
Cohesion: 0.29
Nodes (7): checkCommand(), detectTestCommand(), prep(), recitation(), runLoop(), schemaFor(), toolSchemas()

### Community 26 - "Hosts: what they really send"
Cohesion: 0.50
Nodes (4): Hosts: what they really send, applyUpdate(), parsePatch(), seekLines()

### Community 27 - "ref_node_path"
Cohesion: 0.32
Nodes (7): ref_node_fs, ref_node_path, blk(), FIX, NL, register(), scripted()

## Knowledge Gaps
- **192 isolated node(s):** `$schema`, `name`, `description`, `name`, `email` (+187 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 221 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Changelog` connect `Changelog` to `atlias`, `The next generation: what atlias takes from the field, and what it adds`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Why does `view()` connect `The next generation: what atlias takes from the field, and what it adds` to `loop.mjs`, `runLoop`, `What atlias is built on`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Why does `3.1.0 (2026-09-25)` connect `The next generation: what atlias takes from the field, and what it adds` to `Changelog`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `description` to the rest of the system?**
  _192 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `graph.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.10033670033670034 - nodes in this community are weakly interconnected._
- **Should `loop.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.10541310541310542 - nodes in this community are weakly interconnected._
- **Should `agent.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.11945031712473574 - nodes in this community are weakly interconnected._