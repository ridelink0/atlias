# Changelog

## 1.4.0 (2026-09-22)

A bench. The cost claims are now numbers measured on the project in front of you: what the session brief costs, what a graph answer costs against opening the files it names, and how often the guard and the gate actually interrupted across the sessions already recorded. No model is called, every estimate is labelled as one, and the report ends by naming the thing it does not measure, which is whether any of it changes how often a task succeeds.

## 1.3.0 (2026-09-22)

Reliability inside the host's hook budgets. On a machine without graphify the interpreter search could probe six candidates at fifteen seconds each and remember nothing, so a SessionStart hook could exceed its own timeout and leave the user with no brief at all, every session. The search is now time-boxed, skips paths that are not on disk, and remembers a miss for an hour; the graph's directory walk happens once instead of twice and has a wall clock; the hub lookup is skipped rather than allowed to overrun; a CLI version probe is five seconds rather than twenty minutes; and the SessionStart budget is declared identically to Claude Code and to Codex. A new suite asserts the invariant directly: the work a hook can do must fit inside the timeout it declares.

## 1.2.0 (2026-09-22)

The ship and the terminal. `atlias` with no arguments now asks whether to link as a sub-harness or fly as a regular agent, under a blue block-letter wordmark with a small ship beside it (truecolor, 16-colour and plain-text fallbacks, and a one-line form for narrow terminals). `atlias agent` runs the loop in the terminal with Claude Code, Codex or a local Ollama model as the engine, with the guard, the gate, the graph router, the handoff note and Dream all in place. Fourteen more harnesses can be linked, each in its own config shape, and only when it is actually installed. Guard fix: a recursive delete of the home directory with a trailing slash is now caught.

## 1.0.0 (2026-09-21)

First release. Session brief, graph router, loop and destructive guards, verification gate, handoff notes, Dream digests, MCP server with nine tools, installers for Codex, Antigravity and Gemini CLI, and a nine-suite test runner whose failures explain themselves.