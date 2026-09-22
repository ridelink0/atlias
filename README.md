# atlias

A sub-harness for Claude Code, Codex, Antigravity and Gemini CLI. It links itself to the host the moment a session opens and makes whatever model is running inside smarter, cheaper and harder to fool: one memory shared by every host, a knowledge graph that answers codebase questions before a file is read, a cache-stable session brief, guards against loops and destructive commands, a verification gate that holds a reply until the work is checked twice, handoff notes that survive compaction, and a Dream stage that turns each session into memory.

The name is a tribute to atelier, the art-direction plugin that was folded into Ultimate Frontend Skills.

## What it fixes

atlias takes [HKUDS nanobot](https://github.com/HKUDS/nanobot) as its base: the layered memory (living session, append-only `history.jsonl` with cursors, curated durable files), the two-stage Dream consolidation, always-on versus on-demand skills, the heartbeat idea of speaking only when there is something to say. It keeps those and fixes, by design, the defects that sit open on nanobot's tracker:

| nanobot issue | atlias answer |
|---|---|
| 2463 prompt prefix not preserved, cache broken | the session brief is deterministic; hooks are silent on the common path; nothing ticks per turn |
| 4522 repeated identical tool calls | the loop guard denies the fourth identical call once, with a reason that says what to change |
| 5266 token burn nobody can see | every hook output is bounded; the graph answers in a few hundred tokens; tests assert the brief size and silence |
| 1955 opaque subagents | SubagentStop is recorded into the handoff note and the digest |

It also implements the mechanisms Anthropic documents for long-running agents (progress file, clean-state startup, verification before done) and for context engineering (right-altitude rules, just-in-time retrieval, structured note-taking, compaction that keeps decisions and blockers). Sources at the end.

## What happens in a session

1. **SessionStart**: the brief. Handoff note from the last stretch, the memory index (Claude Code loads its own; Codex and Antigravity get it inline), the graph hubs, pending Dream digests, companion status, six working rules. Deterministic, under 3,200 characters on an empty project.
2. **UserPromptSubmit**: silent, unless the prompt is a codebase question and a graph exists, in which case the graph answer is injected under a 600-token budget. Frontend prompts get one pointer to Ultimate Frontend Skills per session.
3. **PreToolUse**: silent, unless the same tool with the same input is about to run a fourth time (deny, once) or a shell command is destructive (ask). Process kills by PID count as destructive; Windows shares one process across windows.
4. **PostToolUse**: records changed files and verification commands. Never speaks. Schedules a debounced background `graphify update` when code changed and a graph exists.
5. **PreCompact / PostCompact**: writes the handoff note (objective, changed files, checks run, git status, next step), tells the summariser what to keep, and re-injects the note after compaction.
6. **Stop**: the gate. If files changed this turn and any of them do not parse, the reply is held once with the errors. If code changed and the reply names only one bug-check, it is held once and told what the second adversarial pass looks for. Never more than once per reason per prompt; never when the host is already continuing.
7. **SessionEnd**: a detached worker distils the session into one `history.jsonl` row and writes `DIGEST.md`. The model consolidates at a natural pause with `harness_remember`, then acks.

## Two ways to fly

Run `atlias` with no arguments and it shows the ship and asks:

- **Sub-harness** - link into every harness on the machine. The hooks and the MCP server run inside them; this is the mode the rest of this README describes.
- **Regular agent** - `atlias agent`. A terminal agent of its own, with the same guard, gate, graph router, handoff note and Dream, and a choice of engine: Claude Code (`claude -p`, sessions resumed by id), Codex (`codex exec`, continuity carried by atlias in the prompt), or a local Ollama model (default `gemma3:4b`) driven by atlias's own tool loop: read_file, write_file, list_dir, grep, shell behind the destructive guard, recall, remember, graph_query. `--engine echo --once "text"` exercises the loop with no model at all.

Inside the agent: `/engine`, `/graph`, `/recall`, `/progress`, `/hosts`, `/doctor`, `/exit`. Every edit it makes goes through the same syntax check and the same second-pass gate as a hosted session, and the session is distilled into a Dream digest when you leave.

## Harnesses

Four first-class hosts: **Claude Code** (plugin: hooks, skills, MCP), **Codex** (hooks, MCP, AGENTS.md), **Antigravity** (MCP, GEMINI.md) and **Gemini CLI** (MCP, optional hooks).

Then every other harness atlias can find on the machine, each getting the MCP server in its own config shape and the instruction block in its own instructions file: Cursor, Windsurf, OpenCode, Amp, Zed, Kiro, Droid (Factory), Aider, Trae, Cline, Continue, CodeBuddy, Hermes Agent and Pi. `atlias install` writes into a harness **only when its config directory already exists**, so nothing is scattered for tools you do not have, and `atlias install --extras cursor zed` narrows it to the ones you name. Their config shapes are marked UNVERIFIED in `lib/hosts-extra.mjs`: they follow each harness's own documentation as of September 2026, were not checked against a running install here, and `atlias uninstall --extras` reverses exactly what was written. Adding another harness is one row in that table.

## Tools (MCP server `atlias`)

`harness_recall`, `harness_remember`, `harness_progress`, `harness_verify`, `harness_digest`, `graph_query`, `graph_affected`, `graph_explain`, `harness_status`. The same server is registered in Claude Code (plugin `.mcp.json`), Codex (`config.toml`) and Antigravity (`mcp_config.json`), so memory written in one host is read in the others. Memory files use Claude Code's own format and directory, so Claude Code keeps loading them natively.

## Install

Claude Code:

```
/plugin marketplace add ridelink0/atlias
/plugin install atlias@atlias
```

Everything else, from the plugin directory:

```
node bin/atlias.mjs install            # codex + antigravity + gemini + companions
node bin/atlias.mjs install --codex    # ~/.codex/hooks.json, config.toml, AGENTS.md block
node bin/atlias.mjs install --antigravity   # ~/.gemini/config/mcp_config.json, GEMINI.md block
node bin/atlias.mjs install --gemini [--gemini-hooks]
node bin/atlias.mjs install --companions    # graphify (pip) and ultimate-frontend-skills
node bin/atlias.mjs doctor
```

Every write into a host config is idempotent and marked; `uninstall` removes exactly what was added.

Companions: [graphify](https://pypi.org/project/graphifyy/) for the knowledge graph (`pip install graphifyy`; the harness finds the interpreter, or set `ATLIAS_PYTHON`), [ultimate-frontend-skills](https://github.com/ridelink0/ultimate-frontend-skills) for frontend work, [claude-code-usage-limits](https://github.com/ridelink0/claude-code-usage-limits) for budget.

## Tests that teach

```
node test/run.mjs
```

Thirteen suites, each written from one expert's point of view: payload shapes, cache and token efficiency, guards, the verification gate, the handoff note, memory and Dream, host integration, the end-to-end dispatcher, the MCP server, the logo, the regular agent, the agent runtime, and the extra harnesses. A failure prints three lines: what happened, why it matters, how to fix it. That is the format the gate and the guard use too, so a model reading any atlias message knows what to do next.

## Configuration

`~/.atlias/config.json`, or `node bin/atlias.mjs config set <section.key> <value>`:

- `verify.syntax` (true), `verify.doublePass` (true)
- `guard.loopThreshold` (4), `guard.loopWindow` (30), `guard.destructive` (true)
- `graph.autoBuild` (true), `graph.autoUpdate` (true), `graph.queryBudget` (600), `graph.godNodes` (8)
- `brief.memoryChars` (6000), `brief.progressChars` (4000)
- `dream.enabled` (true), `dream.keepHistory` (400)

State lives under `~/.atlias/` (override with `ATLIAS_HOME`).

## Known limits

- Gemini CLI hook output shape is not documented on the page checked; hooks there are opt-in (`--gemini-hooks`) and mirror what graphify ships for its own Gemini hook. MCP and the GEMINI.md block are the verified path.
- Antigravity has no hook API. It gets the MCP server and the instruction block.
- `graphify update` is AST-only; the semantic graph still comes from `/graphify`.
- Dream stage two is done by the model, on purpose: the harness has no API key and does not pretend to.

## Sources

- Anthropic, Effective harnesses for long-running agents; Effective context engineering for AI agents; Claude Code hooks reference.
- OpenAI, Codex hooks reference (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PreCompact, PostCompact, Stop, SubagentStop, SessionEnd).
- Google, Gemini CLI hooks reference.
- HKUDS nanobot: docs/memory.md, docs/architecture.md, agent templates, open issues 2463, 4522, 5266, 1955.

MIT. Built by Gev.