# Changelog

## 2.2.6 (2026-09-22)

The doctor checks the launcher. Host configs point at ~/.atlias/server.mjs, and if that file is deleted every one of them loses its tools in silence: the server never starts and no host says why. The doctor now reports it, and reports whether the launcher can still find an installed copy to run. The README also catches up: forty suites, the launcher, and the two newest refusals, a memory name that would destroy the index and a write outside the project.

## 2.2.5 (2026-09-22)

A write outside the project is a decision, not a detail. The terminal agent guarded shell commands and let the file tools write anywhere, so a local model that resolved a path badly, or followed an instruction from a file it had just read, could overwrite something in the home directory with nobody asked. Writing outside the directory the agent was started in now asks, treats no answer as no, and says what to do instead; a write inside the project is untouched, because that is the work.

## 2.2.4 (2026-09-22)

Two slow leaks. The gate keeps a flag per prompt so it speaks once per turn, and never dropped an old one, so a four hundred turn session carried four hundred keys in a file that is read and rewritten at the end of every reply while only the current turn is ever consulted; it now keeps a short tail. And saving a memory rebuilt the index from its non-empty lines, which silently deleted every blank line, so an index with sections lost its shape one save at a time; the raw lines are now kept and only the entry being replaced is touched.

## 2.2.3 (2026-09-22)

harness_remember could destroy the memory index. The name went straight into a file beside MEMORY.md, and on Windows and macOS the filesystem is case-insensitive, so remembering something called "memory" wrote the body over MEMORY.md itself; the index rewrite that follows then read that body as the index, appended one line and saved it, and every memory line for that project was gone. A model choosing a reasonable-sounding name could do it without doing anything wrong. Those names are now refused before anything is written, with a working alternative in the message.

## 2.2.2 (2026-09-22)

A turn long enough to push its own beginning out of view. The gate finds where a turn started by looking back for the prompt marker in the last 256 KB of the session log, and a turn with thousands of tool calls pushes that marker past the window. The old code then treated the whole window as the current turn: files changed an hour earlier were syntax-checked and named as though they had just been touched, and every such turn shared one flag key, so the gate would speak once and stay silent for the rest of the session. When the marker is not in the tail atlias now reads the whole log, which is rare enough to be worth paying for and correct when it happens.

## 2.2.1 (2026-09-22)

A setting you cannot corrupt, and a doctor that looks where the answer is. `atlias config set brief.memoryChars` with no value stored the empty string, nothing complained, and the clip that reads it silently stopped clipping, because a number compared to an empty string is never greater; a setting now takes the type its default has, refuses anything else with the reason, and prints what actually took effect rather than what was typed. And the doctor decided whether the Claude Code plugin was enabled by reading one settings file when enablement can equally live in the local one, so it told some users to reinstall something they already had.

## 2.2.0 (2026-09-22)

Host configs stop pointing at a directory that will not exist. The installer wrote the absolute path of the running copy into Codex, Antigravity, Gemini and every extra harness, and when atlias runs as an installed plugin that path contains the version number. The next update writes the new version beside it and removes the old one, so every one of those configs is left pointing at a directory that is gone, and the failure shows up one update after the install, which is the hardest kind to connect to its cause. When the running copy sits at a versioned path the installer now writes a launcher into the state directory and points the hosts at that instead; the launcher resolves the newest installed copy at run time, falls back to the one that wrote it, and its own path never changes.

## 2.1.8 (2026-09-22)

Three small ones that each waste somebody’s afternoon. The Ollama client always used the http module, so pointing it at a remote instance over https failed on every turn with a protocol error that named nothing useful; the transport and the port now follow the url, for the health probe as well as the chat. Switching engine mid-session left the resume flag and the old system prompt in place, so the new engine was asked to continue a conversation it had never had. And atlias --version printed the help, which is what everybody types first.

## 2.1.7 (2026-09-22)

The terminal agent could not start its main engine. It built a session id of the form atlias-<uuid> and handed that to Claude Code as --session-id, which takes a UUID and nothing else, so the very first turn of the agent on the claude engine failed; and the retry path only ran for turns after the first, so the one failure a new user would actually hit was the one with no recovery. atlias now keeps its prefixed id for its own files and gives the host a plain UUID, and any refused turn falls back to continuing the most recent conversation instead.

## 2.1.6 (2026-09-22)

Two more places where something grew without a ceiling and was then cut in the middle. For Codex and Antigravity the brief pastes the memory index inline, and cut it at six thousand characters with an ellipsis, mid-line, saying nothing; with eighty memories that silently dropped half of them, and a model reading a truncated index concludes the rest do not exist. It now cuts on a line boundary and says how many it did not list. And the Dream digest listed every session waiting to be consolidated, so a fortnight of them produced an enormous file that the brief tells the model to read; it now shows the ten most recent and accounts for the rest, while ack still consolidates all of them.

## 2.1.5 (2026-09-22)

The instruction block called every harness Antigravity. It mapped two host ids to their names and everything else to Antigravity, and the extra harnesses passed their own id into it, so the rules file written into Cursor, Windsurf, Kiro, Zed, Amp, Trae, Cline, Continue, CodeBuddy, Hermes, Droid and Aider each opened by telling that tool it was Antigravity. Nothing broke, which is exactly why it survived: it simply told twelve harnesses the wrong thing about themselves on every turn. Cursor also reads its rules only from a .mdc file that carries frontmatter, so one is now written when the extension calls for it, once, not stacked on every install.

## 2.1.4 (2026-09-22)

Stop paying for a turn that did nothing. The handoff note was rewritten at the end of every reply, including one that only answered a question, which cost a file write and a git process for a turn with nothing to hand off, and replaced a note from a turn that did have something to say with one that does not. The note is now written only when the turn changed a file or ran a command. And within a single reply git status ran twice, once for the note and once to find edits made outside the tools; one memo now serves both, and expires after two seconds so it never reports yesterday.

## 2.1.3 (2026-09-22)

Three unbounded things, bounded. Event lines are appended by several processes at once, a hook for this turn, a subagent’s hook, a second session in the same project, and a write under about four kilobytes lands atomically while a longer one can interleave with another and corrupt both; a patch touching forty files was already capable of producing one, so an event is now trimmed to fit and says how many entries it dropped. One bench call could read four megabytes from each of twenty session logs to print a summary of them, and now reads a bounded sample. And the MCP server buffered incoming bytes with no ceiling while waiting for a newline, so a client that never sent one grew the buffer until the process died.

## 2.1.2 (2026-09-22)

The hook could cut its own answer in half, on the platforms not tested here. Every hook wrote its JSON to stdout and called process.exit on the next line. Node documents its own I/O as synchronous for pipes on Windows and asynchronous for pipes on POSIX, and process.exit does not wait for an asynchronous write, so a long brief could arrive truncated on macOS and Linux and be discarded as malformed. A probe on this Windows machine confirms the old code survived there, which is exactly why it went unnoticed: the platform that is safe is the one it was written on. The process now sets an exit code and lets the write drain, with an unreferenced ten second backstop so a stuck handle still cannot hold up the host. A suite writes a brief of over two hundred thousand characters and fails if a single one goes missing, and it will catch a regression on any platform.

## 2.1.1 (2026-09-22)

Two bugs that destroyed work rather than merely annoying. Recording the next step with harness_progress rebuilt the entire handoff note under a placeholder session id, so the one tool whose job is to preserve state across a compaction was wiping the files, checks and prompts the Stop hook had written into it; it now rewrites only the Next section and leaves the rest alone. And when two sessions for the same project ended at the same moment, the second took the Dream lock, failed, and returned without writing anything, losing that session entirely; the digest row is now appended before the lock is taken, with only the tidying serialised, because a skipped prune costs nothing and a lost session costs everything.

## 2.1.0 (2026-09-22)

The gate stops trusting only its own event log. It knew a file had changed because it saw an edit tool touch it, so anything written another way was invisible: a heredoc, sed in place, a generator, a formatter, a script the model ran. Those are precisely the edits nobody reviews. In a git repository the gate now asks git what actually changed since this turn began, adds what it did not already know, and names those files separately in its message, because they are the ones that went through no review at all. Files dirty from before the turn are left alone.

Versioning from here: the patch digit is a bug fix, the minor digit is a feature or a behaviour change, and the major digit is a change in what atlias is. The 1.x entries below moved the minor digit for plain bug fixes, which is how one day of work ran from 1.0.0 to 1.9.1. Rather than renumber them, which would collide with plugin caches already holding those directories, the correction starts here.

## 2.0.0 (2026-09-22)

What atlias is has changed since 1.0.0, so this is the major that should have marked it: it stopped being only a sub-harness and became a thing you can also run on its own. A terminal agent with its own wordmark and ship, three engines behind it, fourteen more harnesses it can link into, a tenth tool, and a bench that measures its own cost. No behaviour changes in this release beyond the number itself and the rule it now follows.

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