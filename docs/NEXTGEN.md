# The next generation: what atlias takes from the field, and what it adds

Research done 2026-09-25 for Gev. This is not a `/deep-research` run: the deep
research skill's scraper and verifier agents are not registered in this session
and subagents were switched off, so every source below was read directly and is
linked. Anything not verified is marked so.

## What the field actually looks like

A September 2026 source-code study of eleven coding agents - Claude Code, Codex
CLI, Gemini CLI, Mistral Vibe, OpenHands, Aider, Mini-SWE-Agent, Hermes, Pi,
OpenCode and OpenClaw - reads about four million lines and reports two absences
worth more than any feature list: **no agent runtime imports a general-purpose
agentic framework, and none retrieves code with vector embeddings.** The field
runs on hand-rolled async loops and deterministic retrieval. It catalogues seven
canonical subsystems, 29 recurring patterns and 18 recommendations, and notes
that skills appear in 9 of 11 systems and MCP in 8 of 11.
<https://arxiv.org/abs/2609.00006>

That matters for atlias twice over. It confirms the shape atlias already has - a
hand-written loop, deterministic graph retrieval through graphify, skills and
MCP - and it means "next generation" cannot mean adopting a framework. It has to
mean doing the hard parts better than the eleven do.

## The one number that has changed

The optimisation target moved from "minimise context size" to **"maximise cache
hit rate"**, because every major provider now caches prompt prefixes. A harness
that trims tokens by rewriting its prompt is spending more than it saves: the
trim alters the layout, the prefix no longer matches, and the whole conversation
is re-read at full price.

TokenPilot names this directly and builds around it: ingestion-aware compaction
that stabilises prompt prefixes at the gate where content enters, and
lifecycle-aware eviction that drops segments **on a batch-turn schedule** when
their task relevance expires, rather than continuously. It reports 56 to 87 per
cent cost reductions depending on mode. <https://arxiv.org/abs/2606.17016>

Two further findings from the same search, listed because they are directly
implementable rather than because they are novel: a symbol-indexed navigation
server that lets an agent move by pointer instead of reading whole files
measured 77 per cent fewer active tokens, and Claude Code's own compaction is
observed to preserve the current task, recent errors and file names while losing
initial instructions and style rules - which is the argument for keeping durable
rules in the system prompt rather than trusting compaction to carry them.
<https://github.com/ai-boost/awesome-harness-engineering>

## What atlias already had

- A hand-written loop, no framework. Matches the field; no change needed.
- Deterministic retrieval by symbol through graphify: `graph_query` before
  reading files is the pointer-first pattern, already the house rule.
- Rules in the system prompt and in memory, not in the conversation, so
  compaction cannot quietly drop them.
- Observation masking: every tool result older than the last few shrinks to one
  line, with the full history kept outside the view.

## What was wrong, and is now fixed

**Observation eviction was cache-hostile.** `view()` masked everything older
than the last `keepObservations`, so the boundary advanced by one on every
single turn. Every turn therefore rewrote the prompt prefix, and a rewritten
prefix is a discarded cache: the saving from eliding one old observation was
paid for many times over by re-reading the whole conversation at full price.

Eviction now moves in blocks (`agent.evictBlock`, default 4). Between two block
edges the prefix is byte-identical and the provider can serve it from cache; the
few extra observations carried in the meantime cost far less than the cache
miss. Measured in the test suite: with `keepObservations: 2` and a block of 4,
the mask is unchanged across four consecutive turns and then advances once.

## Ingestion-aware capping, built

atlias used to elide tool output at the point of use (`elide`, head and tail),
which meant the cut could be revisited later - and a later cut rewrites the
prompt prefix, which is a discarded cache and the whole conversation re-read at
full price. The decision has moved to the gate where output enters the context
(`ingest`, `capOutput` in `lib/loop.mjs`) and is made exactly once.

Three parts make it worth the move. A **per-tool budget**: a shell run, a file
read, a grep and a directory listing do not deserve the same room, so each tool
takes a share of `agent.outputBudget` (`OUTPUT_RULES`) and each keeps the end
that matters - a file read keeps its head because it is ordered and resumable, a
shell result keeps mostly its tail because a test puts the failure last, a
listing needs neither much room nor its end. A **stable summary line** written
at the same moment, so the note the mask leaves behind when the observation is
finally evicted is part of the prefix from the start rather than a later rewrite
of it. And a **note saying how to see the rest**, in the words of the tool that
produced it: a capped `read_file` names the exact offset to carry on from, read
out of the numbered head, and every other tool says how to narrow its input.

And the bytes the budget cuts are not lost. Goose writes an oversized tool
response to a temp file and hands back the path, telling the model it "can use
other tools to examine or search in" it
(`crates/goose/src/agents/large_response_handler.rs`). atlias does the same
(`spill`): the result is written out whole to `~/.atlias/output/` **before** it
is cut, and the capped note names the file so the model can grep or read it
rather than running the whole command a second time to see what it missed. A
`read_file` result is the one thing never spilled, because the file it came
from is still on disk and the note already names the offset to carry on from. A
spill that cannot be written costs the tool call nothing and the note then
simply does not promise a file, and yesterday's spills are swept on the way
past, since a spill is only useful to the run that made it.

The model's own turn goes through the same gate (`capAssistant`, `capArgs`): the
whole file it just wrote is dead weight the moment the result says what happened
to it, so long string arguments are dropped while the JSON stays valid and the
path and flags still read. `view()` no longer rewrites anything - it is the
stored bytes plus the masks, and nothing else.

## A cache-hit readout, built

Read from what the providers actually return, in the four shapes that exist
(`cacheReading` in `lib/loop.mjs`):

| endpoint | field | reports it |
| --- | --- | --- |
| OpenAI, Azure, OpenRouter | `usage.prompt_tokens_details.cached_tokens` | yes |
| DeepSeek | `usage.prompt_cache_hit_tokens` | yes |
| Anthropic-shaped gateways | `usage.cache_read_input_tokens` | yes |
| Ollama `/api/chat` | `prompt_eval_cached_count` of `prompt_eval_count` | yes |
| the `claude` and `codex` engines | none - they run their own conversations | no |
| any OpenAI-compatible endpoint that omits the details object | none | no |

The Ollama pair was measured on this machine against ollama 0.34.3 and
gemma3:4b: 0 of 76 prompt tokens cached on a first call, 71 of 76 on the repeat,
and 20 of 25 on a later short one. `countCache` records the rate per session and
`/status` shows it. **A provider that reports no cached count is recorded as
silent, never as a miss**, and the silent calls are counted and named
separately, so a quiet endpoint cannot drag the rate towards zero and no number
is invented where none was given. With the `claude` or `codex` engine `/status`
says plainly that atlias never sees their token counts.

## A git-worktree sandbox, built

OpenHands' isolation is its whole argument and it rests on Docker, which is not
installed here, so `lib/sandbox.mjs` builds the isolation that can actually be
demonstrated on this machine: `--sandbox` runs the agent in a throwaway git
worktree of the last commit, shows the diff when the run stops, and changes the
project only if you take it.

Three refusals matter more than the feature:

- **A dirty tree is refused out loud**, naming the files. A worktree is checked
  out from the last commit, so uncommitted work would be invisible to the agent
  and its diff could conflict with that work on the way back.
- **Not a git repository falls back honestly**: it says so in plain words and
  runs in the project exactly as it would without the sandbox. Pretending to
  isolate is worse than not isolating. A repository with no commit, and a
  machine with no `git` on the PATH, each say their own thing.
- **No worktree is ever left behind.** Every way out of the repl reaches the
  settle step, the removal sits outside the try so a failure reading the
  worktree is not a reason to leave one, and anything that deletes a directory
  goes through `insideStore` first, so a bug here can never reach the project.

The patch is kept either way, so a dropped run is still recoverable, and the
message says the command to apply it by hand.

## Eight eval tasks

`evals/` grew from three tasks to eight, and the shapes were chosen so that
passing them means different things: a failing test to fix (`off-by-one`), a
function to add (`add-function`), not breaking a test that already passes
(`keep-the-other-test`), a change across three files (`thread-the-trace`),
reading a config file before editing (`read-the-pricing`), a task whose right
answer is to change nothing and say so (`nothing-to-fix`), a failure whose
message blames the wrong file (`misleading-error`), and one judged by a linter
rather than a test (`lint-the-file`).

Every task fails before the work is done, and the suite checks that rather than
trusting it. Two are worth naming. `nothing-to-fix` ships a bug report that is
false: its check requires that `parse.js` is byte for byte unchanged, that the
test still passes, and that a `VERDICT.txt` was written saying why the report is
wrong - so the only way to pass is to investigate and refuse. `lint-the-file`
is scored by a linter whose last rule is that the documented API is still
exported, so deleting the code is not a way to make it pass.

## Two fixes taken from other harnesses' source

Both were read in the source rather than in a summary of it.

**A consecutive-failure counter, separate from the step budget.**
mini-swe-agent keeps `n_consecutive_format_errors` against a
`max_consecutive_format_errors` of 3, resets it on any clean step, and exits
with a typed status - `RepeatedFormatError`, `LimitsExceeded`, `TimeExceeded` -
rather than prose (`minisweagent/agents/default.py`). atlias had only
`maxToolRounds` and answered in prose, which an eval harness cannot match on.
Now every way out of `runLoop` names itself - `answered`, `malformed-output`,
`truncated-output`, `rounds-exhausted`, `model-error` - and the replies that
produce nothing are counted apart from the rounds they cost, against
`agent.maxBadReplies` (default 3), cleared by any round that did something.
Three kinds count: a tool block that did not parse, an edit that did not apply,
and a reply the provider cut off. A run of nothing but truncations is reported
as `truncated-output` rather than folded into malformed output, because the fix
is a shorter reply or a bigger output limit, not a different model. Whether an
edit applied is read from `state.editedAt`, the bookkeeping the harness already
keeps, not from the wording of the result. `lib/eval.mjs` carries the reason
into every scoreboard row and prints it.

**finish_reason, before anything is run.** pi-mono maps `finish_reason` to a
`stopReason` and then refuses the whole batch: "every tool call in the message
may carry truncated arguments. Fail them all instead of executing potentially
borked calls" (`packages/agent/src/agent-loop.ts`, with the same guard again in
`harness/runtime/drive/tools.ts`). Aider checks the same field. atlias's
`openaiChat` never read it. It does now, and a cut-off reply has every tool call
in it refused rather than run, because **truncated JSON can still parse**: a
path cut short or a patch missing its end arrives looking perfectly well formed.
Each refused call is still answered, since an unanswered `tool_call` id makes
the next request invalid. The spellings read are the three that are real -
`length` (OpenAI and every compatible endpoint), `max_tokens` (Anthropic-shaped
gateways) and `MAX_TOKENS` (Gemini) - plus Ollama, which puts `length` in
`done_reason` instead of a choice. That last one was measured here rather than
assumed: gemma3:4b with `num_predict` 12 returned `"done_reason":"length"`.

## Pointer-first enforcement, built

The rule was in the brief from the first version and nothing enforced it, which
made it advice. `lib/pointer.mjs` gives it a price: a whole-file read of a file
the graph could have answered costs one note at PostToolUse, naming the query
that should have run. It never blocks - by then the read has happened, and
blocking would pay for the tokens twice.

The hard part was not the nudge, it was the silence. A note on every read would
be worse than none, so every one of these has to hold first: a graph exists for
the project; the graph was not already asked this turn, by the model or by the
router (which now records an event when it injects an answer); the whole file
was taken, not a window; it is a code file over `pointer.minBytes`, because
asking about a twenty-line file costs more than reading it; the user's prompt
did not name the file, or the read *is* the request; nothing in the session
wrote it, since after an edit the graph is the stale one; and nothing has
spoken yet this turn, inside a session budget of `pointer.perSession`. Each of
those conditions has a test of its own in `test/pointer-suites.mjs`.

Codex reads files through the shell rather than a read tool, so a bare `cat` of
one file counts and a piped one does not. The agent's own `read_file` is left
alone: it already hands back a 400-line window and points at `outline`, so
there is no whole-file read there to enforce against.

## Skills, built

Nine of the eleven agents have a skill system, and inventing a format would
have been a second plugin system. `lib/skills.mjs` reads the one Claude Code
and Codex already use on this machine: a folder holding a `SKILL.md` whose
frontmatter carries a name and a description. It discovers and lists them from
what atlias ships, `~/.claude/skills`, `~/.codex/skills` and the project's own
`.claude/skills` or `.codex/skills`, nearer root last so a project's copy of a
name wins. `atlias skills` lists them with what each is for, `atlias skills
<name>` prints one, `/skills` does both in the agent, and the terminal agent's
system prompt now carries the index the sub-harness hosts always had: one path
per folder and a list of names, so fifty-two skills cost about 1300 characters
and the agent opens the one it recognises with the `read_file` it already has.

One finding worth recording, because it would have made the feature look like
it worked while missing almost everything: 48 of the 53 folders in
`~/.claude/skills` on this machine are directory junctions, and a junction
reports itself as a symbolic link rather than a directory. Filtering entries on
`isDirectory()` found five skills out of fifty-two. Nothing filters on the
entry type now; whether the folder holds a readable `SKILL.md` is the only
question, and the stat that answers it follows the link.

## Checked: Terminal-Bench needs Docker too, same as SWE-bench

Verified 2026-09-24 by refetching both primary sources and reading the actual
wording rather than trusting the paraphrase. Holds.

Terminal-Bench's own announcement says, in its own words, that "the
Terminal-Bench harness handles orchestrating agents, spinning up
multi-container docker environments, logging agent actions, and verifying
container state" <https://www.tbench.ai/news/announcement>. Its repo confirms
this is not optional: running the harness needs the dependencies `uv` and
`Docker` <https://github.com/laude-institute/terminal-bench>. That is the same
shape of dependency SWE-bench has - its own repo calls itself a "fully
containerized evaluation harness using Docker for more reproducible
evaluations" and tells installers to set up Docker before anything else
<https://github.com/SWE-bench/SWE-bench>.

So the claim holds with no correction needed: this is the real evaluation
mechanism, not a demo, and it does not survive on Windows with zero
dependencies any more than SWE-bench does. **Implication for atlias:** local
Terminal-Bench runs are ruled out for the same reason SWE-bench runs are. Its
task design is still worth copying on its own terms - the repo describes tasks
ranging from compiling code to training models and setting up servers, i.e.
real end-to-end setup/build/debug work, not toy diffs - which is the shape
atlias's own dockerless task corpus (item 5, above) should aim for.

## Checked: the scaffold effect / Binding Constraint Thesis

Verified 2026-09-25 by fetching the primary source in full (all 17 pages,
including appendices) rather than trusting the abstract. Holds, with a
correction.

The claim - that holding a model fixed and changing only the harness raised
Terminal-Bench 2 pass@1 from 69.7% to 77.0%, and that independent monitoring
found up to 15 percentage points of scaffold-only variation on SWE-bench
Verified - is an accurate, almost verbatim quote of the paper's own
introduction: "holding the model fixed while changing only the harness raises
Terminal-Bench 2 pass@1 from 69.7% to 77.0% [17], and independent third-party
benchmark monitoring reports up to 15 percentage points of scaffold-only
variation on SWE-bench Verified [4]"
<https://arxiv.org/abs/2605.23950> (Zhang, Wang, Ge, Xu, Hamm, Reddy, "Stop
Comparing LLM Agents Without Disclosing the Harness," preprint, submitted 7
May 2026, arXiv:2605.23950v1 [cs.AI]).

**The correction:** neither headline number is this paper's own experiment -
both are citations passed through from elsewhere. The 69.7% to 77.0% figure is
from a different paper it cites, "Agentic Harness Engineering" (AHE,
arXiv:2604.25850), for one model (GPT-5.4, high) under one automated
harness-search technique on one benchmark - a demonstration of that search,
not a general property of frontier models. The "15 points" figure is from a
third-party monitoring blog (Epoch AI's Gradient Updates newsletter) and, read
in the paper's own body text rather than its abstract, is specifically the
number for Kimi K2 Thinking; GPT-5 showed 11 points in the same source.

What holds up better than either borrowed number is the paper's own original
evidence: a controlled factorial experiment (its Section 4.2) on three
frontier models (GPT-5.4, Kimi K2.6, GLM-5.1) crossed with three harness
configurations on a 100-task SWE-bench Verified subset, two runs per cell.
Harness-induced variance exceeded model-induced variance by 7.80x on average;
moving from the minimal to the full harness shifted pass@1 by 8.5-13.0
percentage points at a fixed model, while changing the model at a fixed
harness moved it by only 2.5-5.0 points, and 6 of 9 model-pair rankings
reversed across harnesses. That is first-hand, not a pass-through citation,
and is the number to cite if atlias's plan needs one.

Caveats: this is an arXiv preprint, not peer-reviewed. Its own resource
accounting (Table 9: $215.79 total API cost across roughly 900 task-runs on
three frontier-tier models) was not independently checked and is taken as the
authors' self-report only.

**Implication for atlias, checked against the code, not assumed:** atlias
already has both ingredients the paper's "Harness Card" disclosure standard
calls for - a git repo (`git rev-parse --short HEAD` reads `542dac9` as of this
check) and an eval harness. But `lib/eval.mjs` has no git, version, commit, or
config stamping anywhere in it (`grep -E "git|sha|version|commit|rev-parse"
lib/eval.mjs` returns no matches), and its report format
(`format()`, `lib/eval.mjs:109-123`) prints pass/fail, round count, and timing
per task but never the harness identity that produced them. Stamping eval
reports with a short git sha (or, more precisely, `git log -1 --format=%h --
lib/eval.mjs lib/loop.mjs` for the two files that actually implement the
harness) plus the model name and the config used is a small, zero-dependency,
Windows-compatible change - it only shells out to `git`, already assumed
present - and is a direct, scaled-down instance of the disclosure standard
this paper argues for. Not yet implemented; this section only establishes that
the claim is real and the gap in `lib/eval.mjs` is real.

## Measured, 2026-09-25

Run on this machine, on the working tree of 3.3.0. Numbers, not claims.

### The task corpus

```
node bin/atlias.mjs eval --engine echo      0/8 tasks finished, 2.9s
node bin/atlias.mjs eval --engine ollama    2/8 tasks finished, 1707.5s
```

The echo run is the floor the corpus has to clear: **every one of the eight
tasks fails before any work is done**, so a pass later means work happened. The
real run is local Ollama with gemma3:4b, the weakest model on this machine, and
**2 of 8** is where it stands: it added the function the test asked for, and
fixed one test without breaking the other.

The six failures are worth more than the two passes, because the typed exit
reason now says what went wrong rather than leaving them all to read alike:

| task | result | how it stopped |
| --- | --- | --- |
| Add a function the test asks for | PASS, 9 rounds | model-error |
| Fix one test without breaking the other | PASS, 4 rounds | answered |
| Make the linter pass | FAIL, 25 rounds | malformed-output |
| A failure that blames the wrong file | FAIL, 21 rounds | malformed-output |
| A bug report that is wrong | FAIL, 4 rounds | model-error |
| Fix an off-by-one so the test passes | FAIL, 24 rounds | truncated-output |
| Take a rate from a config file you have to read | FAIL, 15 rounds | malformed-output |
| Carry a trace id through three files | FAIL, 5 rounds | answered |

Three of the six failures are the model unable to send a usable action, one is
the model cut off at its output limit - the finish_reason refusal firing in a
live run, not only in a test - and only two are the model doing the work and
getting it wrong. Before this release all eight rows would have read the same.

Two of these are worth naming honestly. The first row passed the check while the
loop ended on a model call that failed: the edit landed, a later call did not,
and the check is what decided, exactly as intended. And `A bug report that is
wrong` came within one line of passing - gemma3:4b did investigate, did decline
to change `parse.js`, and did write a verdict, but put its reasoning on the
first line where the check wants exactly `no change needed`. The check is strict
on purpose and the row is a fail.

### The prompt cache

One live `atlias exec --engine ollama` run against gemma3:4b, read from what the
endpoint reported and nothing else:

```
calls 6, reported 6, silent 0
7475 of 8950 prompt tokens served from cache (84%) [ollama]
```

Every call reported a cached count, so nothing here is estimated. Measured
separately against ollama 0.34.3: 0 of 76 prompt tokens cached on a first call,
71 of 76 on the repeat, and 20 of 25 on a later short one - the cache is doing
what block eviction was changed to let it do.

### The suite

`node test/run.mjs`: **751 checks across 105 suites**, up from 716 across 101 at
the start of this stretch. One check, `graphify answers with a result object
even when it fails`, fails when the machine is loaded because it gives a real
`graphify query` fifteen seconds and a cold Python import can take longer; it
passes on a quiet machine. That is a threshold on a real subprocess, not a
defect in the code it guards, and it has not been loosened to get a green line.

## Unverified

- The eleven-system study's 29 patterns and 18 recommendations are cited from
  its abstract page; the PDF itself is compressed and was not read line by line,
  so no individual recommendation is quoted here.
- TokenPilot's percentages are its own benchmarks, not a measurement of atlias.
