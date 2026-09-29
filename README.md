<p align="center"><img src="assets/atlias-banner.svg" alt="atlias: a sub-harness, or an agent of its own" width="100%"></p>

<p align="center">
<a href="https://github.com/ridelink0/atlias/actions/workflows/test.yml"><img src="https://github.com/ridelink0/atlias/actions/workflows/test.yml/badge.svg" alt="tests"></a>
<img src="https://img.shields.io/badge/node-%3E%3D18-3b82f6" alt="node 18 or newer">
<img src="https://img.shields.io/badge/dependencies-0-3b82f6" alt="no dependencies">
<img src="https://img.shields.io/badge/license-MIT-3b82f6" alt="MIT">
</p>

atlias is a harness for AI coding agents, built so that "done" means done. It runs two ways, or both at once:

- **as a sub-harness** inside Claude Code, Codex, Antigravity, Gemini CLI and fourteen other harnesses, where it adds a shared memory, a knowledge graph, loop and destructive-command guards, and a gate that holds a reply until the work behind it is real;
- **as an agent of its own**, typed as `atlias` in any terminal, driving Claude Code, Codex, any OpenAI-compatible model or a local Ollama model through a tool loop designed around what weaker models get wrong.

No dependencies. Node 18 or newer. MIT.

## What it catches

The most expensive thing an agent does is say it finished when it did not. atlias checks the claim against what actually happened in the session, and holds the reply once, with every finding in one message, when they disagree:

| The agent | atlias sees |
|---|---|
| says the tests pass, but ran none | a pass claimed with no test run on record |
| says the tests pass after a failing run | the failure, quoted from the run's own output |
| says done after an edit, with no check since | no verification after the last edit |
| leaves `TODO`, `...rest of the code`, placeholder data | the lines, from the diff |
| skips, focuses or deletes a test, or asserts `true` | the weakened test, from the diff |
| adds a function nothing calls | the definition, and that no other line names it |
| saves a file that does not parse | the parser's own error |
| repeats a call, or swaps between two calls | the loop, stopped with what to change |
| runs `rm -rf ~`, a force push, a dropped table | a question to the user first, in Claude Code, Codex, Gemini CLI and the atlias agent |

Every finding names what happened, why it matters and how to fix it, and the gate says how to mark one as a false alarm. Nothing it checks is claimed: a TypeScript file it cannot parse is named as unchecked, a test run whose outcome it cannot read is recorded as unknown, never as a pass.

## Install

**The `atlias` command**, from anywhere:

```
npm install -g github:ridelink0/atlias
```

or, from an installed copy, `atlias shortcut install`, which puts the command in a folder already on PATH (`%APPDATA%\npm` or WindowsApps on Windows, `~/.local/bin` elsewhere) through a launcher that always runs the newest installed version. Use one of the two, not both. Then open a new terminal and type `atlias`.

**Claude Code**:

```
/plugin marketplace add ridelink0/atlias
/plugin install atlias@atlias
```

**Codex**: `codex plugin marketplace add ridelink0/atlias` lists it in Codex's own plugin browser (Codex reads the same marketplace file), and `atlias install --codex` adds the hooks and the MCP server.

**Every other harness on the machine**: `atlias install`. It writes only into harnesses whose config folder already exists, marks every block it adds, and `atlias uninstall` removes exactly those. `atlias doctor` checks all of it, including that typing `atlias` finds the command.

## Sub-harness, agent, or both

```
atlias mode both         # the default: hooks in every host, and the agent in a terminal
atlias mode sub          # hooks only; typing atlias shows the status
atlias mode standalone   # agent only; the hooks stay silent in other harnesses
```

`atlias` with nothing after it follows the mode: in `both` it shows a short list to pick from (up/down or j/k, 1-3, Enter; q leaves), with settings as the third item. `atlias settings`, and `/settings` in the agent, opens a screen modeled on Claude Code's /config: type to search, the most-used settings first and the rest under short headers, Enter toggles a switch, moves a choice on or opens an edit line, ctrl+r resets to the default, Esc goes back, and every change is saved at once. Where the terminal cannot draw it (a pipe, TERM=dumb) the numbered menu is used instead; `atlias settings list` prints every option with a sentence on what it does.

## The agent

```
atlias                          # choose, then fly
atlias agent [--engine claude|codex|openai|ollama|echo]
atlias exec "fix the failing test" [--json]      # one prompt, no questions, scriptable
echo "add a --verbose flag" | atlias exec
atlias resume [id]              # carry on the last session in this folder
```

Engines: Claude Code (`claude -p`, resumed by session id), Codex (`codex exec`), **any OpenAI-compatible endpoint** (OpenAI, OpenRouter, LM Studio, vLLM, llama.cpp: set `agent.openaiModel`, `agent.openaiUrl`, and `ATLIAS_API_KEY` or `OPENAI_API_KEY`), or a local Ollama model. The last two run on atlias's own tool loop, which does for a weak model what a strong one does in its head:

- **It repairs what weak models write.** Single quotes, bare keys, trailing commas, Python `True`, raw newlines in strings, bad escapes and JSON cut off at the token limit are repaired; `bash`, `str_replace`, `file_path` and the rest of other harnesses' vocabulary are mapped onto atlias's tools; native function calling is used where the endpoint has it, with a fallback to text blocks where it refuses.
- **It edits the way the model was trained to.** Exact-text `edit_file` that must match once, and Codex's own `apply_patch` format, parsed from Codex's grammar, applied all or nothing, and accepted when sent through the shell the way Codex models send it. An edit that would break the syntax is refused and the file put back. Every change can be undone with `/undo`.
- **It reads in windows.** Numbered lines, a window at a time, an `outline` of definitions before any reading, and a note instead of a second copy when the same window is read again unchanged.
- **It keeps the context small.** Old tool results shrink to one line, output keeps its head and its tail (errors come last), the plan is repeated after every result, and project `AGENTS.md`, `CLAUDE.md` or `GEMINI.md` files ride in a prompt prefix that does not change between calls.
- **It checks for the model.** When the model answers after editing, atlias runs the project's own check itself (found from `package.json`, `Cargo.toml`, `go.mod` or pytest, or set in `agent.testCommand`) and hands back the result. If there is no check, the model is sent back once to run one. Out of rounds is reported as unfinished, never as done.
- **It asks first when told to.** `/permissions workspace` (edits in the project run), `ask` (every edit and command asks), `read-only` (plan mode).

Inside: `/status`, `/diff`, `/review` (the engine reviews the uncommitted changes), `/undo`, `/compact`, `/plan`, `/sessions`, `/permissions`, `/engine`, `/graph`, `/recall`, `/progress`, `/settings`, `/doctor`.

## In every host

1. **Session start**: one brief. The handoff note from the last stretch, the memory index, the knowledge graph's hubs, pending Dream digests, and, in Claude Code, where the 5-hour and weekly usage windows stand, from the [usage-limits](https://github.com/ridelink0/claude-code-usage-limits) plugin's last reading, **as information, never as a brake**: the model keeps full quality and scope, and whatever you say about usage decides.
2. **Each prompt**: silent, unless it is a codebase question and a graph exists, in which case the graph answers in a few hundred tokens before any file is read.
3. **Before each tool**: silent, unless the call is a loop or the command is destructive. Codex and Gemini CLI cannot pause a tool for the user, so there the command is stopped, the model is told to ask, and the identical command goes through once after you answer.
4. **After each tool**: records the files changed and the checks run, with their outcome read from the tool's own response. Silent, with one exception: when a whole file was read that the knowledge graph could have answered, atlias says so once for that turn and names the query that would have done it. The read is never blocked, and the note is held back unless a graph exists, the graph was not already asked this turn, the file is large enough that asking would have been cheaper, your prompt did not name it, and nothing in the session wrote it.
5. **Compaction**: writes the handoff note before and puts it back after.
6. **End of a reply**: the gate described above.
7. **Session end**: a background worker distils the session for the model to fold into memory later.

Hosts: **Claude Code** (plugin), **Codex** (hooks, MCP, AGENTS.md), **Antigravity** (MCP, GEMINI.md), **Gemini CLI** (MCP, optional hooks), then Cursor, Windsurf, OpenCode, Amp, Zed, Kiro, Droid, Aider, Trae, Cline, Continue, CodeBuddy, Hermes and Pi, each in its own config shape. MCP tools, shared by all of them: `harness_recall`, `harness_remember`, `harness_progress`, `harness_verify`, `harness_digest`, `graph_query`, `graph_affected`, `graph_explain`, `harness_bench`, `harness_status`. Memory is written in Claude Code's own format, so every host shares one memory.

## Tests

```
node test/run.mjs
```

The Windows integration check passed 1,399 checks across 203 suites, each written from one expert's point of view, and each failure printed as what happened, why it matters and how to fix it. A coverage suite fails the run if any exported function is not exercised by a test through its own module, so a feature cannot arrive untested. Host payloads are pinned to the hosts' own source code, not to guesses. CI runs everything on Linux, macOS and Windows under Node 18, 20 and 22, plus a sandboxed install that parses every config atlias writes with a real parser and proves that uninstall leaves other tools' entries alone.

## What it refuses to pretend

- It names what it did not check, and marks a stale graph as stale.
- It reports a test run it cannot read as unknown, never as a pass.
- It tells the agent when it ran out of rounds rather than letting that read as an answer.
- It never invents a cache number: `/status` shows the share of the prompt the provider reported from cache and counts unreported calls separately. The Claude engine records Claude Code's JSON usage and cost; the standalone Codex engine's token cost remains unmeasured here. The separate native Codex study records CLI input, cached input, output, and context, without converting them into a dollar claim.
- It will not run a tool call out of a reply the provider cut off at its output limit, because truncated JSON still parses and the arguments may be quietly wrong.
- It says which way a run ended rather than leaving them all to read alike: answered, malformed output, a reply cut off, rounds exhausted, or a failed model call.
- It shows the caveat with the number: `atlias bench` measures token cost and says it has not measured task success.
- It says, in [docs/RESEARCH.md](docs/RESEARCH.md), where each mechanism comes from. Whole-harness comparisons are below; the guard's and gate's individual effect remains unmeasured.

## Measured

Measurements below use saved runs, not feature promises. A ratio below 1.0 means fewer prompt tokens per solved task. Confidence intervals are paired bootstrap 95% unless stated otherwise.

Gev's current primary comparison is **native Codex versus Codex + Atlias**. A new [24-workload corpus and reproducible runner](tools/codexstudy/README.md) covers 12 semantic families with small and large archive variants. The initial matched pilot below is diagnostic; the larger, repeated study is unfinished.

| Measurement | Result | What it establishes |
|---|---|---|
| Native Codex 0.159.0, GPT 6.1 medium, Atlias at 1544f9e, two eligible matched repair families | Both **2/2**; total input **182,316 vs 233,632**; input per solve **91,158 vs 116,816**; peak request input **20,253 vs 23,143** | Atlias used **28.1% more input**. Both money-task arms are excluded for an ambiguous contract, with original metrics retained. No confidence interval for two families, no efficiency win claimed. [Evidence](evals/results/native-codex/codex-atlias-2026-09-29/REPORT.md). |
| Main tier, qwen2.5-coder:7b, atlias **3.7.1 at ca1e948** vs mini-swe-agent 2.4.6, 250 shared tasks | **59/250 vs 41/250**; 36 gains, 18 losses; exact McNemar **p=0.0198**; **99.0k vs 127.4k** prompt tokens per solve, about **22% fewer** | One run per arm. This is the earlier build's result, not a replicated score for 3.8.1 or the pending changes. [Evidence and limits](evals/results/round5/2026-09-29-recovered.md). |
| Claude Code, PC, Sonnet 5 medium, 34 tasks | Both **32/34**; atlias/plain prompt-token ratio **1.25 (1.14–1.38)** | Atlias added cost on this run; 80 hook calls were cancelled. [Study](docs/NEXTGEN-5.md). |
| Claude Code, cloud, Sonnet 5 medium, 50 tasks, atlias at d59aa98 vs plain | Both **50/50**; raw ratio **1.00 (0.94–1.06)**; billed-equivalent ratio **1.06 (1.03–1.10)** | Raw parity inside the noise, with higher billed-equivalent input. All tasks solved: this corpus cannot distinguish solve rates. [Baseline study](evals/results/round5/cloud-cc/2026-09-29-baseline.md). |
| Claude Code, cloud, lean brief + gate-runs-check flags, 50 tasks | Both **50/50**; raw ratio **1.03 (0.96–1.10)** vs earlier plain, **1.06 (0.98–1.16)** vs same-window plain | The same-window result is inside the noise. Median **145 fewer prompt tokens per round**; the gate itself ran checks **0/50** times. [Flag study](evals/results/round5/cloud-cc/2026-09-29-row4.md). |
| Aider polyglot Python, qwen2.5-coder:7b, 27 tasks | Atlias **0/27**, mini-swe-agent **0/27** | A floor result, not evidence of a win. [Round-four analysis](docs/NEXTGEN-4.md). |

`atlias bench` is a separate, model-free overhead estimate. On September 29, 2026, this checkout's brief was **4,799 characters, about 1,200 tokens once per session**. Two graph answers were about **573–574 tokens** each; reading every file they named in full would cost about **52k–72k tokens**. That comparison is an upper bound based on four characters per token, not measured model savings. [Captured output](evals/results/round5/2026-09-29-recovered.md).

The experimental Ollama profile cut prompt characters per call from **3,175 to 1,686** in the echo-engine fixture (about **47%**). This measures prompt size, not task success or provider billing. Efficiency flags remain **off by default** until their own benchmark arms pass. The required ship bar—at least as many solves and 30% fewer prompt tokens and dollars inside Claude Code, with the 95% interval entirely below 0.85x—has **not** been met. [Remaining measurement gate](WORK-PLAN.md).

[M8VEN Trust Index](https://m8ven.ai/mcp/ridelink0/atlias) assessed atlias **B, 89/100**, at commit **9c47eeb** on **September 29, 2026**, with a verified publisher and push monitoring. This is an external source-repository trust assessment; it does not measure task completion, token efficiency, or the unmerged changes.

## Scoring the harness

```
atlias eval                    every task in evals/, with the engine you use
atlias eval --engine echo      a dry run: every task must fail before any work is done
atlias eval --save a.json      keep the report, so a later run can be compared with it
atlias tiers                   the three benchmark tiers, and which are on this machine
atlias eval --tier main --sample 24 --seed s    one tier, the same subset every time
atlias eval --rounds 14        override every task's own round budget, and say so in the report
atlias eval --save a.json --resume   carry on an interrupted run; the report is written after every task
atlias eval --work D:/scratch  where the scratch workspaces go (default: atlias-evals in the temp folder)
atlias compare a.json b.json   the paired question: which tasks flipped, and could a coin have done it
atlias eval --help             the options, and nothing else runs
```

Saved results can be packaged and checked without calling a model:

```
atlias score pack a.json b.json --tier main --out score --names atlias,control
atlias score verify score --tier main
atlias council replay run1.json run2.json run3.json
```

The score package pins task files and original reports, carries per-task rows and statistics, and prints re-run commands. Council replay accepts fresh attempts from one build, model and flag configuration; it is an oracle upper bound when the visible check differs from the grader. Neither command runs a benchmark model.

Code the model wrote runs under a watchdog: at its limit (two minutes for a shell
command, the task's own limit for the check) it is ended with every process it
started, a background process a task leaves behind is ended when the task is
scored, and an eval whose starter goes away stops instead of running on.
`tools/h2h/mini_swe_runner.py` runs mini-swe-agent on the same task files with
the same safeguards, so `atlias compare` can pair the two harnesses task by task.

Three tiers: **smoke** (the nine tasks that ship here), **main** (HumanEvalFix
Python and CanItEdit lazy - one-function fixes and short instruction edits) and
**big** (Aider's refactor benchmark: one method out of one class in a real source
file, graded on the AST). The main and big corpora are generated from published
datasets rather than committed - `evals/CORPORA.md` has every URL, licence and
regeneration command, and `atlias tiers` prints the command for whatever is not
here. Every converted task was proved on the machine that converted it: it has to
fail as shipped and pass with the benchmark's own reference, or it is refused with
the reason.

Two scores on a corpus this small are not a result. `atlias compare` pairs the
two runs task by task and reports McNemar's exact test on the tasks that changed,
a Wilson interval per arm, a paired Beta interval on the disagreements, and how
many one-way flips would have been needed before any p below 0.05 was reachable -
six, whatever the corpus size - so "4 of 9 beats 3 of 9" is judged rather than
eyeballed. With `--repeat k` it pairs on each task's pass fraction, so a task is
one disagreement however many attempts it ran. A failed edit is also counted by
cause (not-found, no-file, ambiguous, bad-patch and the rest) beside the
apply-failure rate, and a failing task says how much of its check passed when the
check counts its cases.

Eight tasks, each a small project written into a scratch workspace that the
agent then has to fix: a failing test, a function to add, a test that must keep
passing, a change across three files, a rate that has to be read out of a config
file, a bug report that is false and whose right answer is to change nothing and
say so, a failure whose message blames the wrong file, and one judged by a
linter rather than a test. **The model's claim never scores a task** - a command
does, and its exit code is the whole verdict. Every row says how the agent
stopped, so a task that failed because the model could not send a usable action
reads differently from one that ran out of rounds.

## A throwaway worktree

```
atlias agent --sandbox
atlias exec --sandbox "<prompt>"
```

The agent works in a git worktree of the last commit, the diff is shown when it
stops, and the project changes only if you take it. A dirty tree is refused out
loud and names the files, because a worktree is checked out from the last commit
and the agent would not see uncommitted work. A folder that is not a git
repository says so and runs exactly as it would without the sandbox, rather than
pretending to isolate. The worktree is removed whichever way the run ends, and
the patch is kept either way, so a dropped run is still recoverable.

## Settings

`atlias settings`, or `atlias config set <section.key> <value>`. The keys, each described in the menu: `verify.*` (syntax, second pass, integrity, placeholders, weakened tests, unwired code), `guard.*`, `graph.*`, `brief.*`, `recall.*`, `dream.*`, `router.*`, `pointer.*` (the pointer-first note: on or off, the size below which a whole-file read is left alone, and how many notes a session may spend), `usage.show`, and `agent.*` (mode, engine, endpoints, permissions, test command, rounds, observations kept, `outputBudget` for how much tool output may enter the context, `maxBadReplies` for how many replies in a row may produce nothing before atlias stops and says which kind, and `sandbox` for the throwaway git worktree). State lives in `~/.atlias/` (`ATLIAS_HOME` overrides it).

## Skills

atlias reads the skill format the hosts already use rather than adding one of its own: a folder holding a `SKILL.md` whose frontmatter carries a name and a description. It looks in what atlias ships, `~/.claude/skills`, `~/.codex/skills`, and the project's own `.claude/skills` or `.codex/skills`, with the nearer folder winning a name clash. `atlias skills` lists them with what each is for, `atlias skills <name>` prints one, and `/skills` does both inside the agent. The agent's system prompt carries the index - one path per folder and the names under it - so the skills a machine has cost a few hundred characters and the agent opens the one it recognises with the read tool it already has. atlias does not run or install skills; the hosts stay the ones that do.

## Surviving an update

No host config ever holds a path with a version number in it, because the next update deletes that folder. Hosts point at `~/.atlias/server.mjs` and the terminal command at `~/.atlias/cli.mjs`; both find the newest installed copy when they run.

## Versioning

Plain semantic versioning: patch for a fix, minor for a feature or a behaviour change, major for a change in what atlias is. A test ties the changelog to the version in every manifest.

## Known limits

- The OpenAI-compatible engine is tested against a local server that speaks the wire format, not against a live paid endpoint in CI.
- The extra harnesses' config shapes follow each tool's documentation and are marked UNVERIFIED in `lib/hosts-extra.mjs`; only Claude Code and Codex are pinned to source.
- Antigravity has no hook API, so it gets the MCP server and the instruction block only.
- Whether atlias raises task success is measured once and not yet replicated: on 250 HumanEvalFix and CanItEdit tasks with qwen2.5-coder:7b, a pre-release build solved 59 against mini-swe-agent's 41 (36 one-way flips against 18), one run per side; a three-repeat rerun is in progress. Inside Claude Code it has not cut tokens: 1.00x to 1.06x of plain Claude Code on 50 tasks. See [docs/NEXTGEN-5.md](docs/NEXTGEN-5.md) and [docs/RESEARCH.md](docs/RESEARCH.md).

## Built on

[HKUDS nanobot](https://github.com/HKUDS/nanobot) for the memory and Dream design, [graphify](https://pypi.org/project/graphifyy/) for the knowledge graph, [ultimate-frontend-skills](https://github.com/ridelink0/ultimate-frontend-skills) for frontend work, and the sources in [docs/RESEARCH.md](docs/RESEARCH.md). The name is a tribute to atelier, the art-direction plugin that became Ultimate Frontend Skills.

MIT. Built by Gev.
