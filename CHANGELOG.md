# Changelog

## 1.6.0 (2026-09-22)

The verification tool no longer claims a check it never ran. atlias parses JavaScript, JSON and Python by itself; given a TypeScript, Go, Rust or Swift file it used to check nothing and still answer that the files parse, which is the exact shape of claim the harness exists to stop. It now reports what it checked, what it could not, what does not exist, and what to run instead. The verification detector also learns the runners projects actually use, from go test and cargo clippy to flutter test, dotnet test, rspec and pyright, so a real check stops looking like no check at all. And recall searches the handoff note, which is usually where the answer to where was I already is.

## 1.5.1 (2026-09-22)

Two defects found by reading for platform assumptions rather than by running on a platform I do not have. The Codex MCP entry wrote the server path as a TOML literal string and doubled any apostrophe in it, but literal strings take no escapes at all, so a user named O’Brien would have ended up with a config.toml that does not parse, which stops Codex rather than just atlias. And the check for the home directory folded case on every platform, where on Linux and macOS two paths differing only in case are two different directories, so a project could be mistaken for home and quietly never get a graph. A platform suite now covers both, plus slug stability and hook quoting across path shapes.

## 1.5.0 (2026-09-22)

The bench reaches the model. A tenth MCP tool, harness_bench, lets a session ask what the harness is costing it and what a graph answer replaced, on this project, with no model call. The skill table points at it, so it costs nothing until it is wanted. The README now states the measured numbers with the upper-bound caveat attached, and says fifteen suites because there are fifteen.

## 1.4.1 (2026-09-22)

The bench pointed at the harness itself. The session brief was 5,134 characters on this project, most of it a handoff note allowed 4,000 of them, listing up to thirty files and twenty lines of git status. The note is now capped at 2,400 characters and carries the last four prompts, fifteen files with a count of what it left out, and twelve lines of status. A test builds a deliberately noisy session and fails if the brief passes 4,200 characters, so the one cost paid on every session cannot drift back up unnoticed.

## 1.4.0 (2026-09-22)

A bench. The cost claims are now numbers measured on the project in front of you: what the session brief costs, what a graph answer costs against opening the files it names, and how often the guard and the gate actually interrupted across the sessions already recorded. No model is called, every estimate is labelled as one, and the report ends by naming the thing it does not measure, which is whether any of it changes how often a task succeeds.

## 1.3.0 (2026-09-22)

Reliability inside the host's hook budgets. On a machine without graphify the interpreter search could probe six candidates at fifteen seconds each and remember nothing, so a SessionStart hook could exceed its own timeout and leave the user with no brief at all, every session. The search is now time-boxed, skips paths that are not on disk, and remembers a miss for an hour; the graph's directory walk happens once instead of twice and has a wall clock; the hub lookup is skipped rather than allowed to overrun; a CLI version probe is five seconds rather than twenty minutes; and the SessionStart budget is declared identically to Claude Code and to Codex. A new suite asserts the invariant directly: the work a hook can do must fit inside the timeout it declares.

## 1.2.0 (2026-09-22)

The ship and the terminal. `atlias` with no arguments now asks whether to link as a sub-harness or fly as a regular agent, under a blue block-letter wordmark with a small ship beside it (truecolor, 16-colour and plain-text fallbacks, and a one-line form for narrow terminals). `atlias agent` runs the loop in the terminal with Claude Code, Codex or a local Ollama model as the engine, with the guard, the gate, the graph router, the handoff note and Dream all in place. Fourteen more harnesses can be linked, each in its own config shape, and only when it is actually installed. Guard fix: a recursive delete of the home directory with a trailing slash is now caught.

## 1.0.0 (2026-09-21)

First release. Session brief, graph router, loop and destructive guards, verification gate, handoff notes, Dream digests, MCP server with nine tools, installers for Codex, Antigravity and Gemini CLI, and a nine-suite test runner whose failures explain themselves.