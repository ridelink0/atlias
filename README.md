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
| runs `rm -rf ~`, a force push, a dropped table | confirmation in Claude Code, Gemini CLI and the atlias agent; Codex blocks the command with a reason because its hook adapter does not support an approval question |

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

Experimental lean installation (`flags.leanBrief` enabled) can reuse native plugin hooks whose source, registration, matcher and configured trust are verified. It preserves global coverage for stale, disabled, untrusted or incomplete native events. The isolated native CLI install reused eight events, including SessionStart, and retained global PostToolUse coverage because the native matcher is narrower. A native model smoke received exactly one Codex startup brief and the complete context pack, then passed its protected task without bypassing hook trust. Token effects of this installation change remain unmeasured. [Delivery evidence](evals/results/native-codex/native-hook-registration-2026-09-30/REPORT.md).

Lean mode also shortens MCP descriptions for both hosts: the serialized ten-tool catalog is **2,837 vs 3,565 characters**, a **20.42% reduction**. Tool names, argument schemas and dispatch stay identical. Actual Codex and Claude Code clients confirm activation in isolated, model-free checks. Codex installation forwards the lean flag through its MCP environment allowlist; unset and explicit-off controls retain the full catalog. Model-token effects remain unmeasured. [Client evidence](evals/results/native-codex/native-mcp-catalog-2026-09-30/REPORT.md).

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

Gev's [local migration](docs/LOCAL-MIGRATION-PLAN.md) now has a private, byte-verified archive of 46,671 plugin, skill, instruction, session, research and reference files, with on-demand retrieval. The [local continuation runner](tools/local-work/README.md) adds a single-worker lease, durable request/phase receipts, independent controller checks and lazy stdio MCP dispatch to the existing Atlias loop. Original settings and the installed sub-harness remain intact. Copied plugin source is distinct from verified native activation, and local inference alone does not prove normal capability parity or the20x token/context goals. Actual runtime, quality and prolonged recovery gates remain separate.

1. **Session start**: one brief. The handoff note from the last stretch, the memory index, the knowledge graph's hubs, pending Dream digests, and, in Claude Code, where the 5-hour and weekly usage windows stand, from the [usage-limits](https://github.com/ridelink0/claude-code-usage-limits) plugin's last reading, **as information, never as a brake**: the model keeps full quality and scope, and whatever you say about usage decides.
2. **Each prompt**: silent, unless it is a codebase question and a graph exists, in which case the graph answers in a few hundred tokens before any file is read.
3. **Before each tool**: silent, unless the call is a loop or the command is destructive. Codex and Gemini CLI cannot pause a tool for the user, so there the command is stopped, the model is told to ask, and the identical command goes through once after you answer.
4. **After each tool**: records the files changed and the checks run, with their outcome read from the tool's own response. Silent, with one exception: when a whole file was read that the knowledge graph could have answered, atlias says so once for that turn and names the query that would have done it. The read is never blocked, and the note is held back unless a graph exists, the graph was not already asked this turn, the file is large enough that asking would have been cheaper, your prompt did not name it, and nothing in the session wrote it.
5. **Compaction**: writes the handoff note before and puts it back after.
6. **End of a reply**: the gate described above.
7. **Session end**: a background worker distils the session for the model to fold into memory later.

Hosts: **Claude Code** (plugin), **Codex** (hooks, MCP, AGENTS.md), **Antigravity** (MCP, GEMINI.md), **Gemini CLI** (MCP, optional hooks), then Cursor, Windsurf, OpenCode, Amp, Zed, Kiro, Droid, Aider, Trae, Cline, Continue, CodeBuddy, Hermes and Pi, each in its own config shape. MCP tools, shared by all of them: `harness_recall`, `harness_remember`, `harness_progress`, `harness_verify`, `harness_digest`, `graph_query`, `graph_affected`, `graph_explain`, `harness_bench`, `harness_status`. Memory is written in Claude Code's own format, so every host shares one memory.

## Tests

Read-only working-time diagnostics are available with `atlias session-report --host codex --transcript <rollout.jsonl> --json`. Optional `--meter-reports <live-reports.jsonl>` estimates recent account pace only when enough matching fresh observations exist. Conversation span, completed-turn time and native token counters are separate; they do not prove on/off allowance savings. See the [measurement contract](docs/CODEX-ALLOWANCE-COMPARISON.md) and [research-to-build plan](docs/DESKTOP-EFFICIENCY-PLAN.md).

The default-off `flags.briefIndexPointer` keeps the non-Claude startup memory index on disk, with its path and required read retained. Handoffs, working rules, tools and the original disabled profile remain intact; Claude Code already loads its index. Model quality, tokens and full-context effects are unmeasured. Ordinary ChatGPT desktop/web integration remains unverified.

`harness_progress set` preserves the complete handoff on disk and returns a short persistence receipt; `get` still returns the full note. This removes redundant response text, with no measured model-token or allowance claim. Inline-check recognition now declines printed assertion strings and potentially skipped shell branches, and accepts supported literal PowerShell stdin checks. Classification still requires a genuine successful execution result; it is not a general semantic proof that arbitrary scripts test the intended behavior.

[Desktop candidate evidence](evals/results/native-codex/desktop-efficiency-candidate-2026-10-02/REPORT.md): sourcebbf6 has1,695 local checks,78 accounting controls and its own nine-job CI. It is installed in an independent backed-up Codex snapshot; experimental flags stay off and the current cached MCP connection still requires reconnection. Source280's original29/48 study is held because its exact native executable was removed by the app update; a different executable cannot finish that unchanged comparison.

The later [source-evidence CLI candidate](docs/SOURCE-EVIDENCE.md) returns bounded exact lines with source hashes and explicit pagination, rejects changed snapshots and adds no default MCP catalog overhead. It is not yet installed in bbf6; the later one-read-path guidance has no model result. Current workflow limitations are reported below.

```
node test/run.mjs
```

The Windows integration check passed 1,530 checks across 219 suites, each written from one expert's point of view, and each failure printed as what happened, why it matters and how to fix it. A coverage suite fails the run if any exported function is not exercised by a test through its own module, so a feature cannot arrive untested. Host payloads are pinned to the hosts' own source code, not to guesses. CI runs everything on Linux, macOS and Windows under Node 18, 20 and 22, plus a sandboxed install that parses every config atlias writes with a real parser and proves that uninstall leaves other tools' entries alone.

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

The new [foundation/discovery frozen prefix](evals/results/native-codex/foundation-prefix-2026-10-03/REPORT.md) is adverse: three whole-workflow pairs preserve nine passing/valid phases per arm, but raw input28.80%, uncached input plus output27.31%, and full recorded peak24.67% are higher with Atlias. The72-call plan continues; all20 frozen finished attempts plus one pending attempt are retained, with no full-plan claim. A demonstrated false verification hold is repaired only in isolated source2493, whose own CI is green9/9; no model savings or installed promotion is attributed to it.

New [native discovery and foundation protocol evidence](evals/results/native-codex/native-discovery-foundation-protocol-2026-10-03/REPORT.md) verifies the one-entry facade in actual Codex and Claude clients with zero models. All ten operations remain accessible;2827→608 catalog bytes do not establish model savings. A separately captured Codex foundation replacement preserves normal tools but changes instructions and is unmeasured for quality. It increases the Claude bare fixture startup surface, so that replacement is not proposed as a Claude efficiency profile. See the [isolated foundation quality gates](docs/FOUNDATION-PROFILE-PLAN.md). Installed bbf6 remains unchanged.

Latest [source81 terminal report](evals/results/native-codex/progressive-terminal-2026-10-03/REPORT.md):54/72original calls,18held after a plain native quota failure. Both27/27original phase grades pass; complete recorded request input39.59%more, uncached input plus output15.21%more, peak2.63%less. Unknown unrecorded failure costs retained; full72 and20x claims withheld.

[Native context-policy protocol checks](evals/results/native-codex/native-context-policy-protocol-2026-10-03/REPORT.md) activate compaction in both native clients using owned localhost scripted replies and synthetic counters, with51 configuration controls and85 driver checks. This default-off experiment preserves tested control tools and pins its policy for new studies. It is not real model, full-context, subscription or quality evidence; installed settings remain unchanged.

The new [progressive-workflow gate](docs/WORKFLOW-CONTEXT-GATE.md) tests complete requirements across three phases, with protected source/implementation grades, exact native UUID resume and whole-session accounting. [Owned native resume fixtures](evals/results/native-codex/native-phase-resume-protocol-2026-10-03/REPORT.md) verify recorded input, retained tested tools/instructions and summary-cost accounting with zero real model calls. New real-model quality, capability and savings results remain unmeasured.

Latest [one-read V3 native comparison](evals/results/native-codex/one-read-contract-v3-2026-10-03/REPORT.md): 48/48 calls independently audited; both arms24/24 solved. Atlias uncached input plus output27.07% lower, full native peak4.87% lower, raw input9.49% higher and wall time38.53% higher. These finite repaired contracts do not establish the20x targets, subscription savings, public factuality scores or BOTH-host capability parity.

Gev's actual target is **20x less usage with exactly the same required outputs or better**. **5x is the minimum milestone**, not completion. Neither target has been achieved. [Measurement and quality requirements](docs/EFFICIENCY-TARGET.md).

The target also requires preserving normal host capabilities. [Six new workflow families and capability gates](docs/CAPABILITY-AND-EFFICIENCY-GATES.md) cover new-file/multi-file changes, CLI encoding and paths, async cancellation, malicious repository notes, a40-module dependency chain and persistence across process restarts.44 model-free grader/manifest controls pass. The first native workflow pair solved both outputs, but Atlias context delivery failed; its two original rows and costs are retained and22 remaining calls are held. The compact bounded worker cannot cover every native workflow, and its results do not prove general capability parity.

For explicit CLI context delivery, `atlias context --prompt-file <UTF-8-file> --cwd <project> --json` prepares the full original task plus bounded task data without a model call. [Both actual native clients delivered the complete prepared input](evals/results/native-codex/native-caller-context-2026-10-01/REPORT.md) to owned local fixtures with identical control tools and stock instructions. Claude's fixture uses `--bare` and a fake local key; subscription activation, model quality, savings and general integration parity remain unverified. The `caller-v1` benchmark transport requires a new source-pinned comparison; it does not repair or retry the [original missing-hook row](evals/results/native-codex/capability-context-delivery-failure-2026-10-01/REPORT.md).

The experimental [independent-batch study driver](tools/codexstudy/batch-run.mjs) predeclares24 fresh native controls and2 whole twelve-job batches, with the same original contracts and1260 additional cases. It requires completed and fully audited workflow capability results plus its own exact CI before inference. Hidden grading is written after models; failed and unknown costs remain in the whole-call ledger. This tests fixed-prefix amortization, informed by the [pinned harness references](docs/HARNESS-REFERENCES.md); batch model quality, subscription savings and normal-host capability parity are still unmeasured.

Measurements below use saved runs, not feature promises. A ratio below 1.0 means fewer prompt tokens per solved task. Confidence intervals are paired bootstrap 95% unless stated otherwise.

Gev's current primary comparison is **native Codex versus Codex + Atlias**. The [24-workload corpus and reproducible runner](tools/codexstudy/README.md) covers 12 semantic families with small and large archive variants. Five repeated comparisons below have completed their declared calls; source0e and source7d retain their failed deliveries and process failures. Source7d measures ordered execution with corrected common skill isolation. The [benchmark-pattern plan](docs/BENCHMARK-PATTERN-PLAN.md) targets the repeated context prefix and model rounds rather than more wording-only repetitions. These authored diagnostics have not established a release gate.

The opt-in [bounded native-job prototype](tools/native-job/README.md) stages hashed edits and runs explicit functional/adversarial checks without applying them to the live project. Its new matched comparison is prepared, not measured; native delivery fixtures do not establish model savings or Claude subscription activation. [Additional behavioral probes](evals/results/native-codex/source0e-behavior-diagnostic-2026-10-01/REPORT.md) passed all copied source0e outputs across their12family subsets of1260 cases, preserving original grades and invalid delivery. Finite probes do not prove universal exact-output equivalence.

| Measurement | Result | What it establishes |
|---|---|---|
| Local qwen7B three-repeat majority, source0067096, 252 matched tasks | Mini **31/252**, Atlias **45/252** by majority; 27 gains/13 losses, **p=0.03848** | Six completed reports; **8.29% more total input**, 25.47% less input per original solved attempt. Council oracle predicts **1.45x tokens per solve**. Historical grader hashes unavailable; no public/native-host claim. [Evidence](evals/results/round5/pc-mt-three-repeats-2026-09-30/REPORT.md). |
| Local qwen14B single repeat,252 matching tasks | Mini **77/252**, Atlias **119/252**;59 gains/17 losses, equal actual per-task budgets | Total input **14.94% less**; all saved failures retained. One repeat, historical grader hashes unavailable, no Claude/Codex or20x claim. [Evidence](evals/results/round5/pc-14b-single-2026-10-01/REPORT.md). |
| AA-Omniscience-Public, pinned600question subset | **Unmeasured**; dataset prepared, metric/protection controls pass | Report hallucination rate with accuracy, abstention and index; native answer/judge adapters implemented and prepared; actual activation/judging unmeasured, Claude delivery proof unfinished. Preparation is not a model result or the private6000question leaderboard. [Protocol](tools/omniscience/README.md). |
| Local qwen7B same-text-switch, source0067096, 252 tasks, three repeats per arm | Original **45/252**, switch **47/252** by majority; 20 gains/18 losses, **p=0.87141** | **8.75% more input**, **24.72% higher peak**. Keep default off; losses and historical grader limitations retained. No native-host saving. [Evidence](evals/results/round5/pc-mt-sametext-three-repeats-2026-09-30/REPORT.md). |
| Native Codex ordered-pack7d4838a,12 families,22 eligible matched pairs | Plain **22/22**, Atlias **22/22**; raw **2,027,158 vs1,462,132**; peak **18,831 vs18,292** | **27.87%less input**, **2.86%lower peak**.48/48calls CLOSED; original quota failure and invalid merge delivery retained with ALL costs, no5x/20x claim. [Evidence](evals/results/native-codex/codex-atlias-ordered-pack-2026-10-01/REPORT.md). |
| Native Codex bounded-envelope07d969c,12 families,24 matched pairs | Plain **24/24**, bounded worker **24/24**; raw **2026996 vs139846**; peak **18182 vs5866** | **14.49x less raw input**, **13.57x less total**, but **ONLY3.46x less uncached input+output**.48/48closed;24full-delivery/cost audits. Reduced tool surface; normal-host/Claude/20xusage proof unverified. [Evidence](evals/results/native-codex/codex-atlias-bounded-envelope-2026-10-01/REPORT.md). |
| Native Codex caller-contextd7e614c,6 workflows,12 matched pairs | Plain **12/12**, Atlias **12/12**; all24 protocol-valid | Raw **0.97% more**, peak **30.13% higher**; uncached input+output **35.49% less (ONLY1.55x)**.24full-input/instruction/cost audits; finite Codex workflow coverage,20x/BOTH-host usage proof unverified. [Evidence](evals/results/native-codex/codex-atlias-capability-caller-2026-10-01/REPORT.md). |
| Native Codex dictionary batches75da5c0,24 fresh controls versus2 twelve-job batches | Plain **24/24**, Atlias **24/24**; 0 invalid attempts | Raw **120.65x**, total **87.04x**, uncached input+output **21.40x** less.26 full audits; only2 coupled batch observations and reduced capabilities. BOTH-host20x usage goal unproven. [Evidence](evals/results/native-codex/codex-atlias-dictionary-batch-2026-10-01/REPORT.md). |
| Native Codex source-grounding3726bb8,16 cases,32 matched pairs | Plain **30/32**, Atlias **29/32**; all64 protocol-valid. Value/status **30 vs31**, citations **32 vs30** | Uncached input+output **1.69x less**, raw input **26.4% more**, peak **10.6% higher**. Full64 same-ledger audits;1 gain/2 losses retained. Neither20x token nor context target met. Authored diagnostic; public hallucination rates remain unmeasured. [Evidence](evals/results/native-codex/codex-atlias-factuality-2026-10-01/REPORT.md). |
| Native Codex independent provenance e65562b,12 cases,24 matched pairs | Plain **23/24**, Atlias **24/24**; all48 protocol-valid. Value/status **24/24 both**, citations **23 vs24** | Uncached input+output **2.13x less**, raw input **12.1% more**, peak **9.2% higher**. Full48 same-ledger audits;1 citation gain/0 losses. No20x token/context, universal capability, public hallucination or subscription claim. [Evidence](evals/results/native-codex/codex-atlias-provenance-variants-2026-10-02/REPORT.md). |
| Native Codex verification recovery280f8d4, audited first repeat24 calls of48 plan | Both **12/12**, all required values/statuses/citations correct | Uncached input+output **1.51x less**, raw **17.2% more**, peak **8.6% higher**. Plan stopped cleanly29/48 at weekly90%;19 unattempted, all29 audited including unmatched cost. Prefix is not full completion or20x/BOTH/account proof. [Prefix](evals/results/native-codex/native-verification-prefix-2026-10-02/REPORT.md); [boundary](evals/results/native-codex/native-verification-boundary-2026-10-02/REPORT.md). |
| Native Codex independent batches7b4a6dd,24 fresh controls versus2 twelve-job batches | Plain **24/24**, Atlias **24/24**; 0 invalid attempts | Raw **85.36x**, total **65.77x**, uncached input+output **17.19x** less.26 full audits; only2 coupled batch observations and reduced capabilities. BOTH-host20x usage goal unproven. [Evidence](evals/results/native-codex/codex-atlias-independent-batch-2026-10-01/REPORT.md). |
| Native Codex source-listing 0e29833, 12 families, 23 protocol-eligible matched pairs | Plain **23/23**, Atlias **23/23**; input **2,431,420 vs 2,691,757**; peak **22,934 vs 23,343** | Input ratio **1.10707**; peak **1.78% higher**. 48/48 calls, planned calls complete; 1 protocol exclusions retained; unchanged queryv2, combined guidance rather than isolated ablation. [Evidence](evals/results/native-codex/codex-atlias-source-listing-2026-09-30/REPORT.md). |
| Native Codex lean-catalog cd5c8e1, 12 families, 24 matched pairs | Plain **24/24**, Atlias **24/24**; input **3,016,429 vs 2,454,205**; peak **23,135 vs 26,664** | Input ratio **0.81361**; peak **15.25% higher**. 48/48calls, complete; queryv2 separate from old grades, no catalog-only attribution. [Evidence](evals/results/native-codex/codex-atlias-lean-catalog-2026-09-30/REPORT.md). |
| Native Codex wider task-context 72e6ff5, 12 families, 24 matched pairs | Original grades plain **22/24**, Atlias **22/24**; input **2,344,337 vs 1,723,477**; peak **22,674 vs 26,663** | **26.48% less input**; peak **17.59% higher**. 48/48 calls; query contract ambiguity retained and separately analyzed. Authored diagnostic. [Evidence](evals/results/native-codex/codex-atlias-wide-2026-09-30/REPORT.md). |
| Native Codex task-context candidate 46c12af, 6 families, 12 matched pairs | Plain **12/12**, Atlias **12/12**; input **1,176,432 vs 835,528**; peak **22,044 vs 24,170** | **28.98% less input**; peak change **9.64%**. 24/24 calls; two repeats per family. Authored diagnostic; no general efficiency or Claude-model claim. [Evidence](evals/results/native-codex/codex-atlias-pack-2026-09-30/REPORT.md). |
| Native Codex on-demand candidate 2c9e929, six families, ten matched pairs | Both **10/10**; input **922,870 vs 1,117,073**; peak **22,031 vs 27,135** | **21.04% more input**. Planned 12 pairs; allowance cap stopped after ten. Repeats are unequal; all results retained. [Evidence](evals/results/native-codex/codex-atlias-context-2026-09-30/REPORT.md). |
| Native Codex longer-wait candidate 79d5663, two families with two repeats | Both **4/4**; input **388,115 vs 429,474**; peak **21,574 vs 23,877** | **10.66% more input**. Longer waits alone did not establish a saving; two-family diagnostic, no credible confidence interval. [Evidence](evals/results/native-codex/codex-atlias-wait-2026-09-30/REPORT.md). |
| Native Codex candidate28c9874, fresh matched versions task | Both **1/1**; input **111,270 vs370,750**; peak **20,323 vs24,379** | **3.332x input**, with11 short wait polls in Atlias. All data retained; see the separate longer-wait trial. [Evidence](evals/results/native-codex/codex-atlias-host-2026-09-29/REPORT.md). |
| Native Codex lean candidate 609d83c, GPT 6.1 medium, one matched versions task | Both **1/1**; input **108,923 vs 105,929**; peak **20,202 vs 23,127** | **2.75% fewer input tokens**, but **14.48% higher peak context**; one family, no repeat or confidence interval. Interval Atlias passed at 152,296 input with no new control. Later host-instruction candidates are measured separately. [Evidence](evals/results/native-codex/codex-atlias-lean-2026-09-29/REPORT.md). |
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

The experimental eval council stays **off by default**. With `ATLIAS_FLAG_COUNCIL=1`, a failed seeded visible check can trigger up to two fresh sequential attempts; the first passing, untampered candidate proceeds to hidden grading. Every attempt contributes to cost, and missing token counters stay unknown. The completed repeat replay clears the six-flip prerequisite but predicts **45% more input per solve**; scripted integration checks do not establish model savings. [Behavior and verification](docs/COUNCIL-EVAL.md). No exec/sandbox council is enabled.

Score format 2 pins seeded files, hidden grader bodies, instructions, task budgets and original reports, carries per-task rows and statistics, and prints re-run commands. Verification rejects format 1 and unknown formats; repack explicitly from the original reports and corpus. A new lock cannot establish historical grader identity when the original run did not record it. Council replay accepts fresh attempts from one build, model and flag configuration; it is an oracle upper bound when the visible check differs from the grader. Neither command runs a benchmark model.

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
- Task success has local-model evidence: on 250 HumanEvalFix and CanItEdit tasks with qwen2.5-coder:7b, a pre-release build solved 59 against mini-swe-agent's 41 (36 one-way flips against 18), one run per side. A later three-repeat comparison on 252 shared tasks produced majority scores 45 vs 31 (27 gains, 13 losses, p=0.03848); the older task set differs, historical grader hashes are unavailable, and total input rose 8.29%. Inside Claude Code it has not cut tokens: 1.00x to 1.06x of plain Claude Code on 50 tasks. See [three-repeat evidence](evals/results/round5/pc-mt-three-repeats-2026-09-30/REPORT.md), [docs/NEXTGEN-5.md](docs/NEXTGEN-5.md) and [docs/RESEARCH.md](docs/RESEARCH.md).

## Built on

[HKUDS nanobot](https://github.com/HKUDS/nanobot) for the memory and Dream design, [graphify](https://pypi.org/project/graphifyy/) for the knowledge graph, [ultimate-frontend-skills](https://github.com/ridelink0/ultimate-frontend-skills) for frontend work, and the sources in [docs/RESEARCH.md](docs/RESEARCH.md). The name is a tribute to atelier, the art-direction plugin that became Ultimate Frontend Skills.

MIT. Built by Gev.

The experimental bounded broker's first native trial exposed a missing hash in its input. [Both original attempts and costs](evals/results/native-codex/bounded-broker-hash-failure-2026-10-01/REPORT.md) are retained; its48-call plan remains held at2attempts. The corrected hash-envelope transport requires a new pinned comparison and supplies no completed efficiency result.

[Partial corrected-broker evidence](evals/results/native-codex/bounded-envelope-prefix-2026-10-01/REPORT.md) retains the first8of48calls: four matched solves in BOTHarms,13.79xless raw input/12.97xless input+output, but only1.93xless uncached input+output. These are incomplete, declared bounded-profile results; subscription usage and20xBOTH-host equivalence remain unproven.

Gev’s installed Codex candidate and the separate account-meter experiment are documented in [Codex allowance comparison](docs/CODEX-ALLOWANCE-COMPARISON.md). The Usage Limits bridge has69 model-free controls and a real mixed-workload observation; longer useful working time versus plain Codex remains unmeasured. It did not change the closed factuality study or establish subscription savings.

Gev requires **20x lower token consumption AND20x lower peak context**, separately, with the same required outputs and normal capabilities on BOTH hosts. Raw/cached/uncached totals remain separately reported; account allowance requires its own meter evidence. A small cumulative input ratio cannot substitute for lower peak context. The installed Codex candidate remains enabled at Gev's direction while quality and efficiency improvements are developed in separately pinned studies.

[Independent provenance variants](docs/FACTUALITY-QUALITY-PLAN.md):12 additional cases/four families and131 model-free grader controls cover missing evidence, check outcomes, useful falsy values, forged citations and injected conflict resolution. The Codex48-call comparison is closed and fully audited: Atlias24/24, plain23/24, one citation gain. Claude remains unexecuted; public hallucination scores, universal capabilities and20x token/context/account savings remain unproved.

The newer [native verification recovery](evals/results/native-codex/native-verification-recovery-2026-10-02/REPORT.md) candidate fixes a second unnecessary-round cause: native Codex hooks provide stdout without an exit status. It reads genuine current-turn execution and completed add/update metadata while rejecting counterfeit printed status, stale turns and later edits. Local scripted client fixtures accept a successful edit/check in two requests and keep a failed-check claim held in three; zero real model calls. Claude recovery remains covered. Unsupported edit shapes fail closed. These are protocol results, with retained failures, not measured model-token/context/account savings; installed3726 stays pinned.

The corrected current-runtime source-evidence V2 comparison is CLOSED48/48 with full same-ledger independent audits: original strict grades23/24 in each arm. One Atlias quota rejection has UNKNOWN token costs; one plain repair is rejected by a residual source-whitelist contract defect despite its valid original-file citation. Preserve both failures and grades; equal totals do not prove parity or Atlias quality superiority. Whole-plan token/peak comparisons are withheld. The observed metered Atlias subset has higher raw input and peak; no20x or subscription win is established. [Full evidence and limits](evals/results/native-codex/evidence-contract-v2-2026-10-03/REPORT.md). Optional evidence CLI use is observed in3 Atlias attempts, including duplicate retrieval; the later one-read-path guidance has its own green CI but no model result and is not installed overbbf6. Apps are disabled identically, so this is not full desktop or BOTH-host capability proof. Old source280 remains incomplete29/48 with19 unattempted held.

[Source-evidence contract-defect report](evals/results/native-codex/evidence-contract-defects-2026-10-02/REPORT.md): original10/48 attempts preserved,3/5 strict grades per arm, full10-row independent audit;38 unattempted held. Four failures expose underspecified value/citation contracts in both arms, not established hallucination or Atlias-specific losses. Raw input and native peak increase; no optional reader use is observed. The corrected separate V2 study is now closed48/48 under Gev-authorized100% allowance, with both its quota failure and residual grader defect retained.

The [progressive compaction prefix](evals/results/native-codex/progressive-compaction-prefix-2026-10-03/REPORT.md) preserves24 of72 planned phase calls, four whole-workflow pairs: both12/12 original phase grades pass, but compaction-inclusive raw input is40.44% higher, uncached input plus output17.03% higher, and maximum recorded request input3.24% higher. An initial event-only report omitted compaction costs; unique response records reconcile the corrected metrics to original thread totals. The full plan remains in progress and this authored CLI prefix is not subscription, universal, BOTH-host or20x proof.

The [first complete progressive repeat](evals/results/native-codex/progressive-first-repeat-2026-10-03/REPORT.md) preserves36 of72 calls and six whole-workflow pairs: both18/18 original phase grades pass. Including seven Atlias compaction requests, raw input is32.72% higher, uncached input plus output9.69% higher, and maximum recorded request input only2.63% lower. The second repeat remains in progress. These finite CLI results do not establish full-plan, BOTH-host, account, public-quality or20x targets.
