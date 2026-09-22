# Changelog

## 1.9.1 (2026-09-22)

A graph that found nothing said so in a wording atlias did not recognise, so "No matching nodes found." was injected into the prompt as though it were a finding. It now recognises the refusal in every wording graphify uses, bounded by length so a real answer that happens to open with those words is still kept.

## 1.9.0 (2026-09-22)

Two things that were quietly wrong in daily use. recall could return eight memory bodies at seven hundred characters each, so the tool whose whole point is to be the cheap way to a fact could cost more than reading the file would have; it now works to a budget and counts what it left out instead of truncating in silence. And the bench counted interventions only from finished sessions, so during the session you were actually in it always reported zero, which reads as the guard never firing rather than as nothing having been written down yet; it now reads the logs of sessions still open and says how many of those there are.

## 1.8.0 (2026-09-22)

The guard stops re-reading the whole session on every tool call. Each call appends a line to the session log, and the guard parsed the entire file to decide whether the call was a repeat, so a four hundred turn session meant thousands of lines parsed thousands of times. The harness was getting slower exactly as the session got long, which is when it is needed most. The guard, the gate and the handoff note now read only the tail of the log, which is all any of them looks at, and Dream still reads the whole file once at session end where that is the right thing to do. A suite builds a log of twenty thousand events and fails if five guard calls take a second between them.

## 1.7.0 (2026-09-22)

Two ways the harness could mislead, closed. A graph built before this session answered with exactly the same confidence as a fresh one, so an injected answer is now marked as possibly out of date when files have changed since the graph was built, and the mark clears itself when the graph is rebuilt. And the second-pass gate quoted its syntax check even on turns where every changed file was one atlias cannot parse; it now says plainly that it reached no floor and that the project’s own check is the only one.

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