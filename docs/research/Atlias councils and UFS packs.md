# Let the check pick, not the council

atlias should not get a "council of Claudes" in the usual sense: several models deliberating, debating or voting over the same diff. It should get one narrow form of it. When the project's own check still fails after the gate's hold, atlias runs up to two fresh attempts and keeps the first one that check passes without touching the check. It is off by default and never in a measured default arm. Every published multi-attempt result that raised coding scores is best-of-N with the repository's tests as the filter. Anthropic's pipelines **discard patches that break the visible regression tests before any model judges**, and that bought **+4.8 to +7.5 points** on frontier models at a cost that grows with N: about **2.8x tokens per solved task even at N=3**. On atlias's Claude Code protocol (CC) both arms already solve 32 of 34 tasks, so a council has at most two tasks to win, and the arithmetic says it would push the 1.25x ratio to 1.32-1.40x. Its real case is local models on the main tier (MT), where 191 of 250 tasks fail and attempts cost GPU time rather than money. There, atlias's saved `--repeat 3` runs already hold the answer at zero model cost. The cheapest high-performance configuration is not multi-agent at all. It is one model at low or medium effort, a gate that runs the check itself, and one fresh re-run at high effort only when the check fails. On its own coding subset Anthropic measured the re-run policy at **about 97% for $0.17 a task against 95.3% for $0.29 with everything at high**, and **Opus 5.5 at low solving 87.4% at $0.12 per solved task against Sonnet 5's 77.4% at $0.84**. For Ultimate Frontend Skills (UFS), the plan is:
- vendor 5 of GSAP's 8 official skills (MIT, no scripts);
- refresh three registry entries that have drifted to 8 of 13, 1 of 7 and 1 of 6 skills;
- register Hallmark as a handshake pack, not a vendored one;
- fix a licence bug: vendored skills are installed without their licence file.

Both build items tonight are default-off or data-only and testable with scripted engines and fixtures. Together they cost about $23 of cloud time.

Evidence rules. A statement is fact only if an adversarial verifier confirmed it at the primary source, or if it is a local fact with a file and line. The report writer re-read the local ones on 2026-09-29, and also shallow-cloned three packs (gsap-skills at `aed9cfd`, ui-skills at `dc7ab32`, web-quality-skills at `afa8da9`) to settle points the notes left open. Everything else is in "Could not be verified". atlias line numbers refer to HEAD `614c0f3` plus the uncommitted working tree. There, another session is building NEXTGEN-5 row 4 (`flags.gateRunsCheck`) and has uncommitted edits to `lib/gate.mjs`, `lib/core.mjs`, `lib/settings.mjs` and `test/run.mjs`, so gate line numbers are moving. The notes cited `a8ce7a2`. UFS refers to `cb22a2b` (6.9.x). This report continues round five's plan and UFS round two's plan, and it does not restate them.

## Councils that win on code are test filters with extra steps

The strongest multi-attempt coding results come from Anthropic, and in each one the council's real member is a test suite. With parallel test-time compute, Sonnet 4.5 went from **77.2% to 82.0%** on SWE-bench Verified. The method: "We discard patches that break the visible regression tests in the repository... We then use an internal scoring model to select the best candidate from the remaining attempts" ([Anthropic](https://www.anthropic.com/news/claude-sonnet-4-5)). With the same pipeline, Opus 4 went from **72.5% to 79.4%** and Sonnet 4 from **72.7% to 80.2%** ([Anthropic](https://www.anthropic.com/news/claude-4)). The gain shrinks as the base score rises: +7.5 points at 72.7%, +4.8 points at 77.2%. Anthropic does not disclose N or the cost. Even at N=3, the Sonnet 4.5 figures imply **3 × 77.2 / 82.0 ≈ 2.82x tokens per solved task**. The researcher's first figure of "2.7x" was refuted and corrected to 2.82x by the verifier. For atlias, which is scored on tokens per solved task, that is the wrong trade.

Role splits pay only when the cheap model carries the bulk of the tokens. On Aider's polyglot benchmark, o3 (high) as architect with GPT-4.1 as editor scored **78.2% for $17.55**, against **81.3% for $21.23** for o3 (high) alone. That is **$0.0997 against $0.116 per solve: 14% cheaper for 3.1 points less**. DeepSeek R1 with Claude 3.5 Sonnet as editor scored 64.0% for $13.29, against 56.9% for $5.42 for R1 alone. That is +7.1 points at **2.2x the cost per solve** ([Aider leaderboard data](https://github.com/Aider-AI/aider/blob/main/aider/website/_data/polyglot_leaderboard.yml)). Adding a model bought accuracy. Only swapping an expensive editor for a cheap one saved money.

The big multi-agent win belongs to research, not code. An Opus 4 lead with Sonnet 4 subagents beat single-agent Opus 4 by **90.2%** on Anthropic's internal research eval. But agents use about **4x** the tokens of chat and multi-agent systems about **15x**, and token usage alone explains 80% of the variance on BrowseComp. Anthropic says plainly that "most coding tasks involve fewer truly parallelizable tasks than research" ([Anthropic Engineering](https://www.anthropic.com/engineering/multi-agent-research-system)). Its cost guide reaches the same verdict from the other side: "a multi-model configuration that looked cheaper than the default single model cost more than that same model at lower effort", and "on work a single model could handle alone, the same model at lower effort was cheaper every time" ([Optimizing for cost and intelligence](https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence)). The debate, voting and mixture-of-agents literature points the same way: debate adds tokens without adding correctness, and mixing in weaker models dilutes quality. None of those papers could be opened here (arXiv is blocked), so they are listed under "Could not be verified" and carry no weight in the verdict.

| Pattern | Best confirmed result | Cost per solved task | For atlias |
|---|---|---|---|
| Best-of-N; the tests filter, then a model picks | +4.8 to +7.5 points at a 72-77% base | about 2.8x at N=3 (N not disclosed) | Only when a failed check triggers it |
| Architect/editor | o3-high + GPT-4.1: 78.2% vs 81.3% | 0.86x for -3.1 points; R1 + Sonnet 2.2x for +7.1 | A model-routing choice, not a council |
| Lead + subagents | +90.2% on a research eval | about 15x chat tokens | No, for code |
| Same model, re-run the failures at high effort | about 97% vs 95.3% all at high | $0.17 vs $0.29 per task (0.59x) | Yes: council v2 for the claude engine |
| Escalation triggered by the gate (illustrative model) | +14 points if half the failures are recovered | 1.5x worse per solve, vs 3.6x for always-on N=4 | Yes: council v1 |
| Debate, LLM vote, mixed-model MoA | no confirmed coding result | 2.1-3.4x tokens (unverified) | No |

The escalation row is the verifier-confirmed arithmetic from the notes. Take a single pass that costs C and solves 72%: that is 1.39C per solve. Always-on best-of-4 reaching 79% costs **5.06C per solve (3.6x worse)**. Re-sampling only the flagged 28% with three extra attempts costs **1.84C per run and 2.14C per solve (1.5x worse) for +14 points**, if it recovers half of them. What decides the trade is how precise the failure signal is. That signal is exactly the thing atlias already owns.

## The verdict: retry on red inside atlias's own loop, nothing in Claude Code yet

**Opinion: council only as check-selected retry on red. Off by default, own loop only, never in the measured default arm, and no council in Claude Code this round.** Four facts drive this.

**First, in atlias's own loop, selection costs no model call.** Every piece already exists:
- `eval.score` runs a check as argv under a watchdog and returns pass/fail case counts (`lib/eval.mjs:199-231`).
- `protectedFiles` and `tamper` refuse a pass bought by editing the checker (`lib/eval.mjs:118,149`). This already caught qwen2.5-coder rewriting `test.mjs` (`CHANGELOG.md:84` in the working tree, line 82 at `a8ce7a2`).
- The sandbox makes, diffs, keeps and closes git worktrees (`lib/sandbox.mjs:86-160`).
- The own loop's hold gives the engine exactly one more turn and then stops (`lib/agent.mjs:128-137`). That is the natural escalation point.

**Second, Claude Code's council machinery costs more and starts from the wrong code.**
- A plugin can ship a workflow from a `workflows/` directory, but the workflow script has "No direct filesystem or shell access", so every check re-run needs an agent, which means a model call ([Workflows](https://code.claude.com/docs/en/workflows)).
- A subagent with `isolation: worktree` branches "from your default branch rather than the parent session's HEAD" ([Subagents](https://code.claude.com/docs/en/sub-agents)). A council on uncommitted work would therefore attempt the wrong tree.
- atlias ships no `agents/` or `workflows/` directory today, so it adds nothing per call. Keeping it that way costs nothing.

**Third, the Claude Code head-to-head leaves no room.** In the 3.8.1 study, atlias read 177.1k prompt tokens per solved task against plain Claude Code's 141.5k, and both arms solved 32 of 34 (`docs/NEXTGEN-5.md:48`). Report-writer arithmetic on those numbers: atlias spent about 5.67M tokens, about 166.7k per task. Two extra attempts on each of the two failed tasks add about 0.67M. If both are recovered, the ratio goes to **1.32x**; if neither is, **1.40x**. That assumes the visible check even fails on those two tasks, which is unknown, since the graders are hidden.

**Fourth, on the main tier the council is a pass-rate lever paid in GPU time, never a tokens-per-solve lever.** atlias solved **59/250 at 99.0k prompt tokens per solve** (`docs/NEXTGEN-5.md:29`). That is about 5.84M tokens, or 23.4k per task on average. Up to two extra attempts on up to 191 failures adds at most about 8.9M. Recovering 20 tasks then costs about **1.9x per solve**, recovering 40 about **1.5x**, and breaking even needs **about 90 recovered**. Nothing supports expecting 90. So the council must be reported as its own "maximum pass" mode, beside the headline arms rather than inside them.

The design also carries a catch that the research notes missed:
- The loop's own check finder, `detectTestCommand`, recognises a package.json test script, Cargo, go.mod and pytest markers (`lib/loop.mjs:979-995`), and the loop's auto-check uses only that (`lib/loop.mjs:1583`).
- It does not recognise the `check.py` that the study's HumanEvalFix tasks run (`CHANGELOG.md:17`).
- The finder that does is `visibleCheck` in the uncommitted `gateRunsCheck` work (`lib/gate.mjs:159` in the working tree). It returns argv, not a shell line, and covers check.py, canitedit_check.py, run_tests.sh and the package.json test script.

A council keyed on `checkCommand` alone, as the notes proposed, would never fire on the corpora it is meant for. **So the council depends on row 4 landing first.** That is the right order anyway: row 4 removes a round per held reply, while the council adds rounds.

Measurement uses round five's own protocols.

**Step 0 costs nothing and gates everything else.** The PC runs `atlias council replay` over the saved MT `--repeat 3 --save` reports. Each row of those reports keeps every attempt in order (`lib/eval.mjs:397`), and the report already prints pass@k beside pass^k (`lib/eval.mjs:908`). Council v1 is deliberately a pure resample, with the same prompt and a fresh context. That makes the replay an honest simulation: attempt 1 is the baseline, and attempts 2 and 3 are the council, stopping at the first pass. Tokens are summed exactly as the council would spend them. Its one optimism is selection: it counts the hidden grader's pass where the council would see only the visible check, so it is an upper bound on CanItEdit. If the replayed gain is **under six one-way flips**, round five's noise floor (`docs/NEXTGEN-5.md:39`), stop there and spend no GPU hours.

**Step 1 runs only if Step 0 clears the floor.** An MT arm with `ATLIAS_FLAG_COUNCIL=1` (flags read from the environment per arm; `lib/core.mjs:31-33,84-95`) is run three times against round five's row-1 baseline. It is judged with majority-vote McNemar and prompt tokens per solved task, and the multiplier is printed next to the gain.

**On CC, the only measurement is identity.** With the flag off, `test/golden.mjs` must reproduce `test/fixtures/golden-flags-off.json` byte for byte, which is round five's control rule. No CC council arm is worth plan usage while both arms sit at 32/34.

Variety across attempts comes in v2, and only if the replay shows headroom:
- a whole-function or whole-file edit mode for the third attempt;
- for the claude engine, a fresh re-run at high effort, which is Anthropic's measured 0.59x policy;
- a different engine.

An LLM verifier agent stays unbuilt. Once row 4 lands, the gate is the verifier, and it costs no tokens.

## The cheapest strong harness is one model, low effort, one gate, one retry

Seen through the lowest-price critic's eyes, the "next-gen harness" for atlias and UFS is mostly things that already exist or are half-built. The table ranks levers by expected dollars saved per solved task. Prices are from Anthropic's pricing page, where **Opus 5.5 costs $4/$20 per million input/output tokens with cache reads at $0.20 (0.05x), and Sonnet 5 and 5.5 cost $2/$10, also reading cache at $0.20**; Sonnet 5's scheduled rise to $3/$15 "will not occur" ([Pricing](https://platform.claude.com/docs/en/about-claude/pricing)).

| Rank | Lever | Confirmed evidence | State in the repos |
|---|---|---|---|
| 1 | The gate runs the check at Stop, silent on a pass | A held reply costs a round of about 30k prompt tokens (`docs/NEXTGEN-5.md:50`). At Sonnet 5 prices with about 90% cache reads, that is about $0.013 a round, against about $0.001 per task for the whole 1.3k-token brief cached (arithmetic) | Being built now: `flags.gateRunsCheck` (`lib/core.mjs:36`, `lib/gate.mjs:131+`, uncommitted) |
| 2 | Opus 5.5 at low or medium instead of Sonnet 5 at medium | On a 478-problem SWE-bench Pro subset: Opus 5.5 low 87.4% at $0.12 and medium 92.8% at $0.22 per solved task, against Sonnet 5 at 77.4% and $0.84. Anthropic says the subset is "not comparable to the public leaderboard" ([cost guide](https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence)) | CC pins Sonnet 5 at medium. Unmeasured on atlias's 34 tasks |
| 3 | Low effort first; a fresh re-run at high only when the check fails | About 97% for $0.17 a task, against 95.3% for $0.29 all at high; "use this policy for the saving, not the lift" ([cost guide](https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence)) | Not built. Council v2 for the claude engine |
| 4 | Report a billed-equivalent ratio, not raw tokens | Agent loops read a median 84% of input from cache, and the top 10% read 94% or more ([cost guide](https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence)) | Round five row 2 |
| 5 | Do not cap `max_tokens` | A 16,384 cap ended about a quarter of Opus 5.5's attempts, and 1 of 66 capped attempts passed ([cost guide](https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence)) | atlias caps only Ollama's `num_predict` (`lib/core.mjs:36`) |
| 6 | Do not add a second model | Multi-model cost more than one model at lower effort (row above) | Nothing to remove |
| 7 | UFS: keep screenshots, cut review rounds | An image costs ⌈w/28⌉×⌈h/28⌉ tokens ([Vision](https://platform.claude.com/docs/en/build-with-claude/vision)). UFS's 1440×1000 and 390×1000 pair is 1,872 + 504 tokens per state, under a cent. Full-page 1440×6000 shrinks to about 618×2576, about 2,116 tokens at 0.43x legibility, which is the worst value (arithmetic) | Captures at `deviceScaleFactor` 1 and height 1000, widths 1440 and 390 (`scripts/inspect.mjs:1062,1104-1106`) |
| 8 | UFS: count pack descriptions as a per-call cost | Skill descriptions are listed on every request (`docs/NEXTGEN-5.md:54`). GSAP's 8 descriptions total 2,595 characters; the 5-skill subset 1,739, about 400-600 tokens per call once installed. That is a third to a half of atlias's whole 1.3k-token gap (report-writer measurement at `aed9cfd`) | Pack installation is opt-in (`packs --install`) |

Rows 2 and 3 matter more for Gev's own bills than for atlias's headline number. The CC ratio compares atlias with plain Claude Code on the same model, so a cheaper model helps both arms. Still, running the next CC study on Opus 5.5 at medium as well as Sonnet 5 would show whether the ratio is model-dependent. The same-model re-run policy in row 3 is the only "council" Anthropic has measured making coding cheaper. It works because it has a failure signal, and atlias's gate is that signal. It is a per-attempt setting, so it needs no multi-agent machinery at all.

## UFS: vendor GSAP, refresh three drifted entries, register Hallmark, fix licences

The UFS registry holds 12 packs, and only the 5 added on 2026-09-20 carry a pinned `sha` (`skills/ultimate-frontend-skills/data/packs.json`). Upstream has moved since:
- **emilkowalski/skills** now has 13 skills, an MIT LICENSE file ("Copyright (c) 2026 Emil Kowalski") and a commit on 2026-09-24. The registry lists 8 skills, and `references/skill-packs.md:19` says 11.
- **ibelick/ui-skills** has 7 MIT skills, including `baseline-ui` ("Quickly deslop UI code…"), `improve-ui` and `create-design-md`, with a commit on 2026-09-28. The registry lists 1 ([Emil](https://github.com/emilkowalski/skills); [ibelick](https://github.com/ibelick/ui-skills)).
- **addyosmani/web-quality-skills** ships 6 skills under an MIT licence ("Copyright (c) 2026 Addy Osmani"; report-writer clone at `afa8da9`). The registry lists 1.

| Pack | Licence file | What it adds | Verdict |
|---|---|---|---|
| [greensock/gsap-skills](https://github.com/greensock/gsap-skills) | MIT, "Copyright (c) 2026 GreenSock"; last commit 2026-04-21 | 8 official skills (core, timeline, scrolltrigger, plugins, utils, performance, react, frameworks). The `skills/` folder is 148 KB and holds only SKILL.md files and `llms.txt`, with no scripts (clone `aed9cfd`) | **Vendor 5 of 8** (core, timeline, scrolltrigger, plugins, performance). UFS already picks GSAP + ScrollTrigger for scrubbed timelines (`references/motion.md:71`). The dormant upstream means a pinned copy stays current |
| [Nutlope/hallmark](https://github.com/Nutlope/hallmark) | MIT, "Copyright (c) 2026 Hallmark contributors" | One 558-line skill. Its `slop-test.md` is titled "58 gates + pre-emit self-critique": six axes scored 1-5, any score under 3 forces a revision, and the scores are stamped into the output; Variety is scored "by structural distance, not visual distance" ([slop-test.md](https://github.com/Nutlope/hallmark/blob/main/skills/hallmark/references/slop-test.md)) | **Register as a handshake; do not vendor.** A vendored copy would be a second anti-slop authority beside UFS's `tells.md`. The stamp and structural-variety ideas belong in atelier's own audit, in the round-two queue |
| emilkowalski/skills | MIT | `mobile-native` (web apps that feel native on a phone), `improve-animations` | **Refresh**; take those two |
| ibelick/ui-skills | MIT | `baseline-ui`, `improve-ui`, `create-design-md`, `fixing-motion-performance`, `fixing-metadata` | **Refresh**; take all five. `skills/` is 104 KB of Markdown plus one `openai.yaml` (clone `dc7ab32`) |
| addyosmani/web-quality-skills | MIT | accessibility, core-web-vitals, performance, best-practices, seo, web-quality-audit | **Refresh**; take the other five. Its one script, `analyze.sh` (113 lines), greps the user's files for `http://` URLs (lines 57-65); no curl, wget or npx call was found in it |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | **No root LICENSE** | `web-design-guidelines` says "Use WebFetch to retrieve the latest rules" from an unpinned `main` branch ([SKILL.md](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md)) | **Keep the handshake and flag `remoteRules`.** Never vendor: a pinned sha does not pin its behaviour |
| [figma/mcp-server-guide](https://github.com/figma/mcp-server-guide) | **No LICENSE** | 14 skills, including figma-design-to-code and figma-implement-motion, all needing the Figma MCP server | **Recommend only**, as the handoff when a brief arrives as a Figma file |

The licence finding matters more than any single pack:
- `packs vendor` copies the upstream LICENSE and README to the pack's root folder (`scripts/packs.mjs:351`).
- `packs --install` copies only each skill's own folder into `.claude/skills` (`scripts/packs.mjs:180-190`).
- So every vendored skill a user installs arrives without its licence. Today that covers `packs/microsoft-playwright-cli/playwright-cli/` (Apache-2.0), which holds only SKILL.md and references, and each of bergside's 67 skill folders (MIT), which hold only SKILL.md and DESIGN.md.
- MIT asks that the notice travel with copies, and Apache-2.0 asks for the licence and any NOTICE file. The fix is a few lines at install time, and it must land before GSAP is vendored.

Two smaller gaps:
- Handshake installs run `npx -y skills@latest add <id> --all -y` with no ref (`scripts/packs.mjs:141-145`). A registry `sha` records what was reviewed, not what installs, and `--all` installs every upstream skill (Emil's `write-swift` included) whatever the registry lists.
- `packs add` refuses an id that already exists (`scripts/packs.mjs:298`). Today a refresh means `remove` plus `add`, which loses the hand-written `owns` and `why`. A `refresh` command fixes both drift and sha-less entries at once.

The remaining candidates rest on unverified details. The Chrome DevTools skills and shadcn's two skills should become recommend-only rows once the build agent has read their LICENSE files. Hyperframes and UI UX Pro Max stay unvendored. The Motion AI Kit stays on hold. One correction to the round-two plan: its "fifty-seven slop-test gates" comes from Hallmark's README, and the gate file itself is titled 58.

## Could not be verified, and what was refuted

**Refuted.**
- The notes' "2.7x" tokens per solved task for best-of-3 is **2.82x** (3 × 77.2 / 82.0), per the verifier.
- The UFS notes' "3 script files" in ibelick's skills folder is refuted by the report writer's clone at `dc7ab32`: `skills/` holds only Markdown plus `improve-ui/agents/openai.yaml`. The repo's scripts are site tooling outside it.
- Minor slips: the gate's early return was at `gate.mjs:154`, not 158, at `a8ce7a2`; the UFS references total about 756 KB, not 725 KB.
- All `a8ce7a2` line numbers for `lib/gate.mjs` are now stale because of the uncommitted row-4 work.

**Unverified: evidence against debate, voting and mixed-model councils.** Every source here could only be read as a search-snippet abstract, so none of it counts as fact in this report:
- *The Cost of Consensus* (arXiv 2605.00914): debate uses 2.1-3.4x the tokens of self-correction, conformity reaches 85.5%, and there is a 32.3-point oracle gap.
- *Debate or Vote* (NeurIPS 2025, arXiv 2508.17536): voting explains most of debate's gain.
- *Talk Isn't Always Cheap* (arXiv 2509.05396): debate can lower accuracy.
- *Rethinking Mixture-of-Agents* (arXiv 2502.00674): Self-MoA beats mixed MoA by +6.6% on AlpacaEval 2.0.
- *More Agents Is All You Need* (arXiv 2402.05120), *Voting or Consensus?* (arXiv 2502.19130) and position and self-preference biases in LLM judges.

**Unverified: selection and cascade results.**
- CodeMonkeys: 57.4% against 69.8% coverage.
- S*: +3.7% over o1-preview, and a 7B model beating a 32B one by 10.7%.
- Large Language Monkeys: 15.9% to 56% with 250 samples.
- OpenHands: 60.6% to 66.4% with five rollouts and a trained critic.
- CodeRescue: beats always-escalate at 35% of its recovery cost.
- RouteLLM, FrugalGPT, Scrouting and EMS.

**Unverified: how other harnesses expose councils.**
- Codex `--attempts` up to 4, costing about 3x.
- Cursor 2.0's eight parallel agents and 2.2's "multi-agent judging".
- Aider's 85% architect result.
- The GitHub council plugins (hex, team-attention, AnnasCookies).
- Which hook events accept `prompt` or `agent` hooks.
- The workflow `agent()` options, and the 200-500 ms worktree cost.
- Prompt-cache sharing across fan-out agents.

**Unverified: pricing and caching details.**
- Fable and Haiku prices.
- Haiku's 4,096-token minimum cacheable prefix.
- The tool-use and browser-toolset token overheads (about 6,600 tokens for the browser toolset).
- The effort-sweep deltas: medium about 2.5 points lower at about 70% of the cost.
- The task-budget, advisor and orchestrator numbers.
- The claim that caches are per model.
- Claude Code's cache TTL settings.
- The context-editing "+74%" figure.
- Playwright's claim that the CLI is more token-efficient.

**Unverified: UFS pack details.**
- All GitHub star counts.
- The Chrome DevTools skills: 7 skills, Apache-2.0.
- shadcn's `skills/` folder.
- Per-skill licences in anthropics/skills.
- Remotion having no LICENSE file.
- Hyperframes' size and scripts.
- UI UX Pro Max's network refresh.
- The Motion AI Kit's licence and price.
- Hallmark's 976 KB size and its authorship by Together AI.
- Whether `npx skills add` accepts a pinned ref.

**Unmeasured, not unverified.**
- How often atlias's visible-check finder fires on users' repos.
- The precision of the gate as a failure detector.
- atlias's actual pass@3 minus pass@1 on MT. The saved reports are on the PC's D: drive, not in this container.

## Conclusion

atlias already has a council, and it has one member that matters: the gate. Every published coding gain from "more Claudes" came from a check throwing out bad candidates, and every result that paid for itself came from spending extra compute only after a check said no. Money spent on more deliberating models buys votes; money spent on making the check run and count buys the thing the votes were trying to approximate. That turns the question around. The next-gen move is not a council but a tighter failure signal (row 4), a cheaper first attempt (lower effort), and a single fresh retry where the signal fires. Round five's `--repeat` discipline turns out to double as a free council simulator. Any future multi-agent idea for atlias, including v2's diverse attempts, should have to beat the replay of runs already saved before it gets a GPU hour or a plan session.

For UFS, the costs that matter are not the kilobytes of vendored packs. They are the description tokens every installed skill adds to every call, and the licence text that must travel with every copy. A registry that records a sha it never installs, and vendored skills installed without their licence, are the two places where "we checked it" is not yet true. Fixing them tonight costs less than one wasted review round.

## Build queue for tonight

Two items, each for one agent in one sitting. Neither spends money on a model: the tests use atlias's scripted and echo engines and local fixtures, and the only network use is UFS cloning four public repos. Cloud cost is a rough estimate from the size of each change: **about $15 for item 1 and $8 for item 2, about $23 of the roughly $100 left.**

### 1. atlias: check-selected retry on red, `flags.council` (default off; about 3-4 hours)

**Base and hand-off.**
- Start from the branch where the `flags.gateRunsCheck` work is committed, because the council calls its `visibleCheck`. Until it is committed, wait, or rebase onto it.
- Do not edit `lib/gate.mjs`.
- The edits to `lib/core.mjs`, `lib/settings.mjs` and `test/run.mjs` are one line each and are made on top of that work.
- Open the PR against the cloud branch with "RESULT needed: council replay on MT --repeat 3 reports" for the PC.

**Behaviour.**
- The flag is `flags.council` (boolean, default false; env `ATLIAS_FLAG_COUNCIL`).
- In `atlias eval` (`runTask`, `lib/eval.mjs:246`), after `loop.runLoop` returns and **before** the hidden grader files are written (`lib/eval.mjs:264-272`): if the flag is on, `gate.visibleCheck(dir)` finds a check, and running it fails, the council convenes. Run the check as argv with `proc.runSync`, trying `programs` in order (or the gate's own runner, if the row-4 PR exports one), under the timeout `score()` uses (`Math.max(5000, task.timeoutMs || 60000)`, `lib/eval.mjs:202`).
- It runs up to **two** further candidates. Each gets a fresh workspace from `makeWorkspace(task, stamp + '-c' + i)` and a fresh loop state reset exactly as `runTask` resets it, then runs the same prompt, with the same `chat` and limits, and no note of the failure (v1 is a pure resample, so the replay predicts it).
- After each candidate, `visibleCheck` runs in that workspace. A candidate that passes and is not flagged by `tamper(dir, task)` (`lib/eval.mjs:149`) wins at once, and no later candidate runs.
- The hidden files are then written into the winner's workspace and `score()` decides the row.
- If no candidate wins, the original workspace is scored exactly as it is today.
- The row gains `council: {convened, ran, chosen, candidates:[{i, visiblePass, tampered, chars, promptTotal}]}`. Its `chars`, `promptTotal` and `outputTotal` sum every candidate that ran, so `atlias compare` sees the true cost.
- Non-winning workspaces are removed unless `keep` is set.
- If there is no visible check, the council never convenes: without a selector it would be a vote.

| File | Change |
|---|---|
| `lib/council.mjs` (new, about 150 lines) | `shouldConvene({flagOn, check, checkResult})`; `pick(candidates)` (first with a visible pass and no tamper, in index order, else null); `runCandidates({count, makeDir, run, check, tampered, dispose})`, provider-agnostic; `replay(report, {extra: 2})` |
| `lib/eval.mjs` | The hook described above, about 40 lines. `lib/eval.mjs` is in `STAMP_FILES`, so the harness stamp changes, which is expected |
| `lib/core.mjs` / `lib/settings.mjs` | `council: false` in `DEFAULTS.flags`; a `DESCRIPTIONS['flags.council']` entry saying it costs up to 3x tokens on failing tasks and nothing on passing ones |
| `bin/atlias.mjs` | `atlias council replay <report.json...> [--json]`. It refuses a report with `tries < 2` and prints: tasks, base solved, council solved, gained, extra tokens, per-solve before and after, the multiplier, "clears the six-flip floor" or "inside the noise", and "oracle selection: an upper bound where the visible check differs from the grader". The result is the mean over the three rotations (each attempt taken as the first) |
| `lib/agent.mjs` `runOnce` (cut line: drop if time runs short) | With `--sandbox`, the flag on and the box isolated: if `visibleCheck(box.dir)` fails after `execOnce`, begin up to two more boxes from HEAD, run `execOnce` in each, and pick with `pick()`. A candidate is tampered if `sandbox.changes()` touches the check file or a test path. Close every other box, and pass the winner to the existing `finish()`, which keeps the patch and does not adopt it. `json.council` as above |
| `test/council-suites.mjs` (new) + `test/run.mjs` | The tests below |
| `CHANGELOG.md` | Unreleased: what the flag does, its cost, and "measure with council replay before any MT arm" |

| # | Acceptance test | Engine | Passes when |
|---|---|---|---|
| A1 | Flag-off identity | scripted + echo | `node test/golden.mjs` equals `test/fixtures/golden-flags-off.json` with `council` registered, without `--write` |
| A2 | Off by default | scripted | A failing task's row has no `council` field, and the chat call count equals today's |
| A3 | Recovery | scripted | Candidate 0 makes a wrong edit (the visible check fails) and candidate 1 the right one. Row passes, `chosen: 1`, `ran: 1`, candidate 2 never called (call count), and `chars` equals the sum over candidates |
| A4 | Tamper refused | scripted | Candidate 1 rewrites `test.mjs` to `process.exit(0)` and candidate 2 fixes the code. `chosen: 2`, and `candidates[1].tampered` is true |
| A5 | Nobody wins | scripted | All three fail. Row fails, is scored from the original workspace, `ran: 2`, and no council workspace is left |
| A6 | No selector | scripted | A task with no visible check never convenes, even with the flag on |
| A7 | Passing first | scripted | Candidate 0 passes. The row equals the flag-off row apart from the flag stamp |
| A8 | Env switch | none | `ATLIAS_FLAG_COUNCIL=1` turns it on; `=maybe` is reported under `bad` by `envFlags` |
| A9 | Replay arithmetic | none | A 3-task fixture report with `tries: 3` gives the hand-computed gained count, tokens and multiplier; `tries: 1` is refused |
| A10 | Exec hygiene (cut line) | echo | A temp git repo whose package.json test exits 1, with `runOnce({engine:'echo', sandbox:true})` and the flag on: `json.council.ran` is 2, `chosen` is null, `git worktree list` shows one entry afterwards, and the exit code is unchanged |
| A11 | Whole suite | all | `node test/run.mjs` passes |

**Done when:**
- A1-A9 and A11 pass (plus A10 if the exec part shipped);
- the PR states that the council never runs unless the flag is set;
- the PR asks the PC for Step 0: `atlias council replay` over the saved MT `--repeat 3` reports.

The PC runs Step 1, the MT council arm (three runs, `ATLIAS_FLAG_COUNCIL=1`, against round five's row-1 baseline), only if the replayed gain is six one-way flips or more.

### 2. UFS: GSAP vendored, three entries refreshed, Hallmark registered, licences that travel (about 2-3 hours)

**Code, in `scripts/packs.mjs`.**
1. `PACKS_FILE` and `VENDOR_DIR` can be overridden at call time by `UFS_PACKS_FILE` and `UFS_PACKS_VENDOR_DIR`, so tests never write the real registry.
2. Licences travel with installs. In `install()`'s vendored branch (lines 180-190), after copying each skill, copy every pack-root file matching `/^(licen[cs]e|copying|notice)/i` into the installed skill folder if it has none.
3. `vendor()` (line 351) also keeps `NOTICE`, and writes a `Copyright: <first line starting with "Copyright">` line under `Licence:` in `UFS-NOTES.md`.
4. A new `packs refresh <id> [--take a,b] [--dry]`:
   - re-clones the pack and updates `sha` and `licence`;
   - prints upstream skills that are not registered (`new`) and registered skills that are gone upstream (`gone`);
   - adds only the names given to `--take`;
   - keeps `owns`, `why` and `added`, and stamps `refreshed`;
   - refuses a vendored pack (re-vendoring is a separate, reviewed step);
   - skips ids that are not owner/repo, such as `frontend-design@claude-plugins-official`.

   Add `refresh` and `--take` to `--help` and to the argument whitelist (`test/regression.test.mjs:70-79` checks that the two agree).
5. `format()` prints "fetches its rules at run time from an unpinned branch" for an entry with `remoteRules: true`.
6. A handshake skills install logs "installs upstream HEAD; reviewed at `<sha>`". If `npx -y skills@latest add --help` documents a ref syntax, pass the pinned ref instead and say so in the CHANGELOG. If it does not, leave the install command unchanged.

**Data.** Clone each repo once and check each LICENSE file before writing anything. Stop and report if the licence is not the MIT recorded above, or if gsap-skills' HEAD is not `aed9cfd` without a reason.
1. **GSAP.**
   - Run `packs add greensock/gsap-skills` with `--owns "GSAP API correctness: tweens, timelines, ScrollTrigger, plugins and performance. GreenSock, MIT."` and a `--why` that cites `references/motion.md:71`.
   - Set `skills` to `gsap-core, gsap-timeline, gsap-scrolltrigger, gsap-plugins, gsap-performance`.
   - Run `packs vendor greensock/gsap-skills`, which writes `packs/greensock-gsap-skills/` with LICENSE, README, UFS-NOTES and the five folders.
   - Make two improvements, both listed under `## Improvements` in `UFS-NOTES.md`:
     - drop the sentence "Recommend GSAP when the user needs timelines, scroll-driven animation, or a framework-agnostic library" from gsap-core's description, because `motion.md`'s table chooses the library per job and every description character costs a token per call;
     - add a short "Beside ultimate-frontend-skills" section to gsap-core's SKILL.md: motion.md owns timing, easing and reduced-motion policy, and GSAP 3.15.0 is free, former Club plugins included (`motion.md:381`).
2. **Refreshes.**
   - `packs refresh emilkowalski/skills --take mobile-native,improve-animations`, and correct `skill-packs.md:19`'s count.
   - `packs refresh ibelick/ui-skills --take baseline-ui,improve-ui,create-design-md,fixing-motion-performance,fixing-metadata`, and add rows for `baseline-ui` and `improve-ui` to `skill-packs.md`.
   - `packs refresh addyosmani/web-quality-skills --take accessibility,best-practices,core-web-vitals,performance,seo,web-quality-audit` (the one already registered is kept).
   - Refresh `vercel-labs/agent-skills` (set `remoteRules: true`), `cloudai-x/threejs-skills` and `MickeyAlton33/web-designer-plugin`, so every owner/repo entry has a `sha`.
3. **Hallmark.** `packs add Nutlope/hallmark` as a handshake:
   - `--owns "Anti-slop page design: macrostructure first, a 58-gate slop test and a six-axis self-critique stamped into the output. MIT."`
   - `--why "Registered, not vendored: installed, it owns its own gates while UFS's audit still reports tells; a candidate arm for the atelier A/B."`
4. **Attribution.** Regenerate `CREDITS.md` with `node scripts/credits.mjs`; it is built from `packs.json`, at `scripts/credits.mjs:27`. Add a CHANGELOG entry and bump the version by the repo's convention.

| # | Acceptance test | Passes when |
|---|---|---|
| U1 | Vendor a local fixture pack (a temp git repo with an MIT LICENSE, a NOTICE and two skills) into a temp vendor directory | LICENSE and NOTICE sit at the pack root; `UFS-NOTES.md` has Upstream, Licence and Copyright lines |
| U2 | Install that fixture with `project: true` into a temp directory | Every installed skill folder contains LICENSE and NOTICE |
| U3 | Install the real vendored `microsoft/playwright-cli` into a temp project | `playwright-cli/LICENSE` exists and contains "Apache License" |
| U4 | Refresh the fixture after adding a third skill upstream | `new` lists it; `--take` adds only the named skill; `owns`, `why` and `added` are unchanged; `sha` is updated; refreshing a vendored pack is refused |
| U5 | `format()` on an entry with `remoteRules` | The warning line is printed |
| U6 | Invariants on the real `packs.json` | Every owner/repo entry has a `sha`; every vendored entry has a LICENSE in its folder and every registered skill folder exists; the GSAP entry lists exactly the five skills, with licence MIT |
| U7 | Argument parsing | `parseArgs(['packs','refresh','o/r','--take','a,b'])` is accepted |
| U8 | Whole suite | `npm run test:fast` and `node scripts/credits.mjs --check` pass |

**Done when:**
- U1-U8 pass;
- `packs` lists 14 entries (12 today, plus GSAP and Hallmark), 3 of them vendored;
- installing any vendored pack into a clean project leaves a licence file in every installed skill folder;
- the PR body lists each upstream sha that was reviewed.

## Cost and performance review

The critic's brief is the lowest price for the biggest performance. Both build items survive, but item 1 is cut to the part that decides whether the rest is worth building. Checked on 2026-09-29 against atlias `19002d4` and UFS `cb22a2b`.

**What has changed since the queue was written.** Row 4 is now committed on the cloud branch (`c7b7587`, `19002d4`), and it exports `runVisibleCheck(found, cwd, {timeoutMs})`, which returns `outcome: 'pass' | 'fail' | 'unfinished'` (`lib/gate.mjs:169,211`). The council no longer has to wait for it.

### Verdicts on tonight's queue

**Item 1, atlias council: go, but only Stage A tonight (replay and pure selector). The eval hook and the exec part are not built.**
- **Build the replay first, and nothing else.** Step 0 decides everything, and it runs on runs that are already paid for. The eval hook changes `lib/eval.mjs`, which is in `STAMP_FILES` (`lib/eval.mjs:89`). That would re-stamp every MT arm from that SHA on, while row 1's baselines may still be running on the PC. Stage A touches only a new `lib/council.mjs`, `bin/atlias.mjs` and the tests. So the stamp, the golden fixture and default behaviour stay exactly as they are. The Stage B hook (about 40 lines) gets built only after the replay clears the six-flip floor.
- **Drop the `lib/agent.mjs` exec/sandbox council.** It was the cut line; now it is out. It is the only part that would spend Anthropic money, and no evidence supports it. For the claude engine, the evidence supports something else: re-run at high effort only on red (see F6). That costs no multi-agent machinery.
- **Candidates run one after another, never in parallel.** The PC has one Ollama slot. Running the same prompt again reuses the loaded model's prompt prefix. Stopping at the first pass only works if the candidates run in order. Parallel best-of-3 always pays 3x. Sequential pays extra only on a red check, and only until the first green one.
- **The replay must also accept three `tries: 1` reports.** Round five's MT protocol is "three fresh runs per arm with `--save`". A row keeps its `attempts` only when `tries > 1` (`lib/eval.mjs:397`). If the replay accepted only `--repeat 3` reports, it could refuse the very data Step 0 is for.
- **Stage B convenes only on `outcome: 'fail'`.** An `'unfinished'` result (timeout, or the check could not start) gives no selection signal, so resampling on it would be a vote.
- **Step 1 runs on the cheapest arm.** If row 6's direct arm (one or two calls per task) ties or beats the loop, three direct candidates cost less than one loop attempt (the loop averages about 23.4k prompt tokens per MT task). This is an estimate; the direct arm's cost per task is unmeasured.
- Cost: about **$5** of cloud tonight, against the planned $15.

**Item 2, UFS packs: go, with three additions that cut per-request tokens.**
- **Handshake installs pass the registered skills instead of `--all`.** Verified tonight: `npx -y skills@latest add --help` lists `-s, --skill <skills>  Specify skill names to install (use '*' for all skills)`, and it documents no ref syntax. Today `--all` installs every upstream skill. That means all of `vercel-labs/agent-skills` when the registry lists 1 skill, and Emil's 13 when it lists 8. Every unreviewed description is then billed on every request.
- **Show the per-request cost.** `format()` and `install` print "about N tokens on every request once installed" and warn when one install goes over 8,000 description characters. Skill listings share a budget of 1% of the context window (`docs/NEXTGEN-5.md:54`), which is about 8k characters at 200k tokens. Measured tonight: `packs/bergside-awesome-design-skills` has 67 skills and **8,404 description characters, about 2.1k tokens on every request**. That is more than atlias's whole 1.3k-token fixed-text gap, and over the budget on its own.
- **Add `--skills a,b`, so a pack can be installed partly.**
- **ibelick: take fewer.** Take `baseline-ui`, `improve-ui` and `fixing-motion-performance`. Take `create-design-md` and `fixing-metadata` only if no registered skill already owns that job (`addyosmani` `seo` is the obvious overlap). A duplicate is billed twice per request.
- **Keep everything else in the item.** The licence fix is a correctness fix. GSAP and Hallmark cost nothing until a user runs `packs --install`.
- **Watch for the other session.** UFS has uncommitted tells work in the tree (`README.md`, `scripts/audit.mjs`, `scripts/webdesign.mjs`, `ai-tells.json`, `tells.md`). Build in a worktree off `cb22a2b` and leave those files alone.
- Cost: about **$9**.

**Tonight's total: about $14 instead of $23.** Neither item spends money on a model.

### Cheapest high-value changes the evidence supports that are not yet planned

| # | Change | Saving | Evidence |
|---|---|---|---|
| F1 | Stage the council: replay tonight, hook only after 6 or more replayed flips | About $10 of cloud tonight; no stamp change under row 1 | `lib/eval.mjs:89` |
| F2 | Replay reads three `tries: 1` reports as well as one `--repeat 3` report | One PC-to-cloud round trip | `lib/eval.mjs:397`; MT protocol in `docs/NEXTGEN-5.md` |
| F3 | Council candidates run one at a time on the single Ollama slot, stopping at the first pass | Up to 2 of 3 attempts' GPU time on every task, compared with parallel best-of-3 | Single-slot constraint in `docs/NEXTGEN-5.md` (Budget) |
| F4 | Run council Step 1 on whichever MT arm is cheapest per task (row 6 direct, if it holds) | An estimated 2-5x fewer GPU hours for Step 1 | Loop about 23.4k tokens per MT task; direct arm is 1-2 calls (row 6) |
| F5 | Handshake installs use `-s <registered skills> -a '*' -y` instead of `--all` | Descriptions of every unregistered upstream skill, on every request | `skills add --help`, verified 2026-09-29; `scripts/packs.mjs:141-145` |
| F6 | atlias claude engine: an `agent.claudeEffort` setting (unset by default) passed as `--effort`, then one re-exec at `--effort high` only when the gate's check is red. This is council v2 without a council | About 0.59x cost per task by Anthropic's measure; builds in about $3 | `claude --help` lists `--effort <level>`; `lib/agent.mjs:77` passes none; cost guide: 97% at $0.17 against 95.3% at $0.29 |
| F7 | atlias claude engine: `--output-format json`, recording usage and cost per exec; optional `--max-budget-usd` cap (unset by default) | Free measurement: the claude engine is invisible to the ledger today | `lib/agent.mjs:187` ("atlias never sees their token counts"); `claude --help` lists `--max-budget-usd` |
| F8 | Install bergside as one index skill (one short description, with the 67 DESIGN.md files as references) | About 2k tokens on every request for anyone who installs it | 8,404 description characters measured tonight |
| F9 | UFS round-two item 9 (the $250-430 A/B) in two stages. First: 30 briefs × arms A and B × one run, at the pilot's $1.50 cap, so at most $90. Repeats and arm C follow only on six one-way flips or a clear human pairwise lean | About $160-340 when there is no effect | Round-two plan rows 6 and 9 |
| F10 | UFS round two, Layer 2 (render gate): hold only on a visual claim with no render, or on screenshots rendered but not read. An edit to a UI file with no render gets advisory text instead | About one 30k-token round for each UI turn that makes no visual claim (inference) | `docs/NEXTGEN-5.md:50`; `verify` takes about 34 s, too slow for the 10-second Stop backstop |
| F11 | Tonight's builders run Opus 5.5 at low or medium effort, with one adversarial review at the end, not a verifier per step | Up to 7x per solved task against Sonnet 5 at medium, on Anthropic's subset | Cost guide: $0.12 and $0.22 against $0.84 per solved task |
| F12 | Measure how often the frontend skill is picked up (trigger recall), then cut UFS's own description from 830 characters to 400 or fewer | About 110 tokens on every request (low priority) | 17 of 23 UFS commands already set `disable-model-invocation`; about 1,855 characters stay in context |

**One rule for any future "more agents" proposal.** It must beat a replay of runs already saved, at zero model cost, and print its multiplier next to its gain, before it gets GPU time or a paid run.
