# Graph Report - atlias  (2026-09-25)

## Corpus Check
- 92 files · ~177,502 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 2)

## Summary
- 778 nodes · 2040 edges · 27 communities
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 119 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dacf97eb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- core.mjs
- loop.mjs
- agent.mjs
- install-sandbox.mjs
- sandbox.mjs
- atlias.mjs
- package.json
- clip
- run.mjs
- plugin.json
- README.md
- marketplace.json
- double-check
- atlias
- Changelog
- The next generation, round three: six fronts read at once, and the two things that outrank everything
- eval.mjs
- hosts.mjs
- atlias
- gate.mjs
- ingest
- skills.mjs
- runLoop
- runTool
- integrity.mjs
- Ranked, what to build next
- view

## God Nodes (most connected - your core abstractions)
1. `clip()` - 58 edges
2. `Changelog` - 44 edges
3. `config()` - 41 edges
4. `exists()` - 37 edges
5. `readJson()` - 34 edges
6. `runTool()` - 32 edges
7. `readText()` - 26 edges
8. `writeText()` - 26 edges
9. `runLoop()` - 26 edges
10. `writeJson()` - 24 edges

## Surprising Connections (you probably didn't know these)
- `3.3.0 (2026-09-25)` --references--> `openaiChat()`  [INFERRED]
  CHANGELOG.md → lib/loop.mjs
- `What changed under the research while it ran` --references--> `statusText()`  [INFERRED]
  docs/NEXTGEN-2.md → lib/agent.mjs
- `What verification refuted or corrected` --references--> `statusText()`  [INFERRED]
  docs/NEXTGEN-2.md → lib/agent.mjs
- `Ranked, what to build next` --references--> `sha()`  [INFERRED]
  docs/NEXTGEN-2.md → lib/core.mjs
- `Hosts: what they really send` --references--> `filesFromTool()`  [INFERRED]
  docs/RESEARCH.md → lib/core.mjs

## Import Cycles
- None detected.

## Communities (27 total, 0 thin omitted)

### Community 0 - "core.mjs"
Cohesion: 0.05
Nodes (87): Frontier ideas, and which of them can exist here, briefCost(), estimateTokens(), graphVsFiles(), interventions(), liveSessions(), report(), BRIEF_BUDGET_MS (+79 more)

### Community 1 - "loop.mjs"
Cohesion: 0.06
Nodes (35): apiKey(), ARG_ALIASES, BAD_REPLY, CALL_FIELD_MAX, checkCommand(), confirmOutside(), detectTestCommand(), EDIT_FAILS (+27 more)

### Community 2 - "agent.mjs"
Cohesion: 0.11
Nodes (46): b(), c(), chatPath(), CHATS(), chooser(), claudeArgs(), claudeTurn(), cli() (+38 more)

### Community 3 - "install-sandbox.mjs"
Cohesion: 0.05
Nodes (49): wordmark(), chooseShimDir(), CLI_LAUNCHER_SOURCE, installShortcut(), launcherPath(), MARKER, onPath(), shimDirCandidates() (+41 more)

### Community 4 - "sandbox.mjs"
Cohesion: 0.10
Nodes (38): A git-worktree sandbox, built, Checked: Terminal-Bench needs Docker too, same as SWE-bench, Checked: the scaffold effect / Binding Constraint Thesis, Eight eval tasks, Measured, 2026-09-25, Pointer-first enforcement, built, Skills, built, The next generation: what atlias takes from the field, and what it adds (+30 more)

### Community 5 - "atlias.mjs"
Cohesion: 0.09
Nodes (18): argv, cwd, flag(), FLAG_COMMANDS, sandboxFlag(), shortcutInstall(), CHOICES, DEFAULTS (+10 more)

### Community 6 - "package.json"
Cohesion: 0.11
Nodes (18): author, bin, atlias, description, engines, node, keywords, license (+10 more)

### Community 7 - "clip"
Cohesion: 0.12
Nodes (38): clip(), commandFromTool(), contextOutput(), filesFromTool(), graphPath(), isEditTool(), isShellTool(), looksLikeVerification() (+30 more)

### Community 8 - "run.mjs"
Cohesion: 0.06
Nodes (24): sleep(), ref_node_http, aliasesByModule(), calledBare(), coverageSuites(), esc(), EXEMPT, reExporters() (+16 more)

### Community 9 - "plugin.json"
Cohesion: 0.17
Nodes (11): author, name, url, description, homepage, keywords, license, name (+3 more)

### Community 10 - "README.md"
Cohesion: 0.13
Nodes (14): A throwaway worktree, Built on, In every host, Known limits, Measured, Scoring the harness, Settings, Skills (+6 more)

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
Cohesion: 0.05
Nodes (41): 1.0.0 (2026-09-21), 1.3.0 (2026-09-22), 1.4.0 (2026-09-22), 1.4.1 (2026-09-22), 1.5.0 (2026-09-22), 1.5.1 (2026-09-22), 1.6.0 (2026-09-22), 1.7.0 (2026-09-22) (+33 more)

### Community 16 - "The next generation, round three: six fronts read at once, and the two things that outrank everything"
Cohesion: 0.14
Nodes (14): Could not be verified, Measured, 2026-09-25, and it refused to confirm the thing it was built on, Ranked, what to build next, The A/B this round set up by accident, and how it will be judged, The gate spoke twice, and only on a loaded machine, The next generation, round three: six fronts read at once, and the two things that outrank everything, The two findings that outrank the entire previous ranking, What the context front changed (+6 more)

### Community 18 - "eval.mjs"
Cohesion: 0.11
Nodes (27): ensureDir(), run(), STATE_DIR, bootstrapDiff(), compare(), harnessStamp(), lineDiff(), makeWorkspace() (+19 more)

### Community 19 - "hosts.mjs"
Cohesion: 0.07
Nodes (73): companions(), exists(), findPython(), installedRoots(), isVersionedPath(), readJson(), readText(), START_MARK (+65 more)

### Community 20 - "atlias"
Cohesion: 0.40
Nodes (5): 1.2.0 (2026-09-22), 3.0.0 (2026-09-22), Install, Sub-harness, agent, or both, atlias()

### Community 21 - "gate.mjs"
Cohesion: 0.15
Nodes (24): gitStatusShort(), TURN_TAIL, block(), changedFiles(), lastPrompt(), PARSEABLE, parseGitStatus(), PASS_RE (+16 more)

### Community 23 - "ingest"
Cohesion: 0.29
Nodes (10): Ingestion-aware capping, built, capArgs(), capAssistant(), capOutput(), elide(), ingest(), nextOffset(), outputRule() (+2 more)

### Community 24 - "skills.mjs"
Cohesion: 0.11
Nodes (22): CLAUDE_DIR, CODEX_DIR, ROOT, body(), discover(), find(), format(), head() (+14 more)

### Community 25 - "runLoop"
Cohesion: 0.26
Nodes (14): The next generation, round two: the field read closely, and what survived reading it, What changed under the research while it ran, What verification refuted or corrected, What would actually be novel, and what it would take, A cache-hit readout, built, budgetFor(), cacheLine(), cacheReading() (+6 more)

### Community 26 - "runTool"
Cohesion: 0.16
Nodes (17): Could not be verified, programCommand(), compact(), forgetReads(), numbered(), outlineFile(), outlineFolder(), OUTSIDE() (+9 more)

### Community 28 - "integrity.mjs"
Cohesion: 0.11
Nodes (29): isCodeFile(), check(), CONVENTION_NAMES, DEF_PATTERNS, diffFor(), DONE_RE, FAIL_RE, failExcerpt() (+21 more)

### Community 29 - "Ranked, what to build next"
Cohesion: 0.26
Nodes (14): How a harness change should be judged, In the loop, In the prompt, and in the cache, Ranked, what to build next, What the field does that atlias does not, extractObject(), isTruncated(), normalizeCall() (+6 more)

### Community 31 - "view"
Cohesion: 0.13
Nodes (14): 3.1.0 (2026-09-25), What was wrong, and is now fixed, Hosts: what they really send, Keeping the context small, Making a weak model finish the job, Not measured, One live run, What atlias is built on (+6 more)

## Knowledge Gaps
- **240 isolated node(s):** `$schema`, `name`, `description`, `name`, `email` (+235 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 274 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Changelog` connect `Changelog` to `atlias`, `view`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `clip()` connect `clip` to `core.mjs`, `loop.mjs`, `agent.mjs`, `sandbox.mjs`, `The next generation, round three: six fronts read at once, and the two things that outrank everything`, `hosts.mjs`, `gate.mjs`, `ingest`, `skills.mjs`, `runLoop`, `runTool`, `integrity.mjs`, `Ranked, what to build next`, `view`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Why does `openaiChat()` connect `Ranked, what to build next` to `loop.mjs`, `sandbox.mjs`, `clip`, `Changelog`, `runLoop`, `runTool`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **What connects `$schema`, `name`, `description` to the rest of the system?**
  _240 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `core.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.053534660260809885 - nodes in this community are weakly interconnected._
- **Should `loop.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.06306306306306306 - nodes in this community are weakly interconnected._
- **Should `agent.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.1099290780141844 - nodes in this community are weakly interconnected._