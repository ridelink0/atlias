> **Re-split, 2026-09-29 (Gev):** the PC runs slow, so the cloud session now takes every hard task it can run, not only the code. Verified in the cloud container on 2026-09-29: headless `claude -p` runs there and reports its own token counts and cost, and a Docker daemon starts and pulls from Docker Hub; huggingface.co is blocked there. So the **Claude Code protocol (CC) measurements move to the cloud** (rows 2 and 4, driver rebuilt in-repo under `tools/ccstudy/`, results under `evals/results/round5/cloud-cc/`), along with every build in the table. The PC keeps only what needs its GPU or Windows: the Ollama main-tier (MT) runs of rows 1, 5-9, the corpus regeneration from Hugging Face on D:, and `node test/run.mjs` on Windows at each PR head. The SWE-bench spike (row 10) waits until huggingface.co is allowed and an sb-cli key exists.

# Atlias round five: confirm the win, then trim

Round five should begin by measuring. atlias's only harness-level win, **59 against 41 of 250 tasks versus mini-swe-agent (McNemar p=0.020)**, comes from one run per arm, and round four's own data shows how loose a single run is: two versions of atlias tied 49 to 49 on 156 tasks while 21 tasks flipped each way. So the PC session's first job is the `--repeat 3` head-to-head. The cloud session's first job is to get the fix it already built, and has not measured, into a Claude Code study. That fix is two commits on its branch that let the gate count a check whose hook Claude Code cancelled. After that the work splits cleanly, because every measurement needs Ollama, D:/harness-work, Windows or Gev's Claude plan, and every build item can be written and unit-tested on Linux with no model. The cloud builds changes behind default-off flags, each aimed at a named number:
- the ~1.3k tokens per call and the extra check round behind the **1.25x** Claude Code token ratio;
- the **87 of 246** failed edits that re-sent unchanged text;
- the bare AssertionError that HumanEvalFix's check prints;
- a one-shot "direct" arm, to test whether the tool loop is what holds a 7B model to **8 of 88** on CanItEdit lazy;
- a packager that turns the head-to-head into a score a stranger can re-run.

The PC then measures each change against one shared baseline. Public leaderboards come later and cost more: SWE-bench Verified now takes only academic teams, Terminal-Bench 2.1 takes no community entries, and SWE-bench-Live is open but needs a container adapter atlias does not have. The cloud column costs about **$115 of the ~$150 left** before a go/no-go on SWE-bench, and **about $145** if it goes ahead. Following Gev's instruction, the PC session opens a PR whenever the cloud cannot or says "PR NOW". It does this with `gh` or a browser tool, because computer use cannot click in a browser.

## One run, 36 flips against 18: round four's win is real but thin

Round four built four of its eleven ranked items and left the rest untouched:
- **Shipped:** context integrity on Ollama (item 1), the HumanEvalFix/CanItEdit corpus (item 2), a comparator that prints its own statistical power (item 3), and repair of edits that will not parse (item 4).
- **Half built:** compaction survival (item 9) and the per-round ledger (item 10).
- **Not built:** the no-op rule (item 5), a small-model prompt profile (6), keeping the newest failure visible (7), honest local defaults (8) and a frozen tool set (11) ([NEXTGEN-4.md:444-914](file:///home/user/atlias/docs/NEXTGEN-4.md)).

The code confirms the two gaps that matter most:
- An edit whose old and new text are equal is still refused, classed `same-text`, and counted as a dead edit toward `maxBadReplies` ([lib/loop.mjs:1187, 705, 1589-1590, 1617](file:///home/user/atlias/lib/loop.mjs)).
- The default local model is still **`gemma3:4b`**, a model atlias has no measured result for ([lib/core.mjs:31](file:///home/user/atlias/lib/core.mjs)).

The main-tier head-to-head ran on HumanEvalFix Python plus CanItEdit lazy, the 250 tasks both arms hold, with qwen2.5-coder:7b on Ollama:

| Arm | Passed | HumanEvalFix | CanItEdit lazy | Prompt tokens per solved task |
|---|---|---|---|---|
| atlias | **59/250** | 51/162 | 8/88 | **99.0k** |
| mini-swe-agent 2.4.6 | 41/250 | 39/162 | 2/88 | 127.4k |

Thirty-six tasks were solved only by atlias and 18 only by mini-swe-agent. That gives McNemar exact p=0.020, with a paired interval of 1.5 to 12.1 points in atlias's favour ([NEXTGEN-4.md:1169-1203](file:///home/user/atlias/docs/NEXTGEN-4.md)).

The same section explains why the win is thin:
- There was one run per arm, on different days.
- A two-task smoke rerun failed both tasks the earlier run had passed.
- Two versions of atlias tied 49 to 49 on 156 tasks, with 21 gained and 21 lost.

If a harness change can flip 42 of 156 tasks and still tie, a 36-to-18 split from one run is a lead, not a result. Round four's protocol already says what to do: run `--repeat 3` with `--save` on both arms, and report any A/B with **fewer than six one-way flips** as "inside the noise" ([NEXTGEN-4.md:107-125, 1148-1150](file:///home/user/atlias/docs/NEXTGEN-4.md)).

Three more facts shape the plan.
- **CanItEdit lazy is at the floor.** atlias solves 9 per cent and mini-swe-agent 2 per cent. At that level A/B tests are nearly blind: in round four's power table, a 10 per cent gain against a 5 per cent loss has power 0.18 even at 100 tasks. Only HumanEvalFix, at 31 per cent, sits inside the 30-70 per cent band round four asked for.
- **The cloud branch is two commits ahead of main.** `fd92b54` and `6c710ae` make the Stop gate read the session transcript when Claude Code cancelled the hook that should have recorded a check. Both are filed under "Unreleased", marked "Not yet measured in a study", and are not on main ([CHANGELOG.md:3-5](file:///home/user/atlias/CHANGELOG.md), branch log). Main at `41f9ba6` passes **1014 of 1014 checks in 136 suites on Linux with no SKIPs**, which is why the cloud is a workable place to build.
- **The README is out of date.** It still says "Whether atlias raises task success is unmeasured" and claims "seven hundred and fifty checks in a hundred and five suites" ([README.md:105, 211](file:///home/user/atlias/README.md)).

## Claude Code's 1.25x has three named causes, and a fix for one is already built

The study ran Claude Code 2.1.283 with Sonnet 5 at medium effort on 34 tasks. atlias 3.8.1 read **177.1k prompt tokens per solved task against plain Claude Code's 141.5k: a ratio of 1.25, 95 per cent interval 1.14 to 1.38**. Both arms solved 32 of 34, and the gate held 8 replies where it used to hold 32 ([CHANGELOG.md](file:///home/user/atlias/CHANGELOG.md)). The 12 task pairs that no cancelled hook touched ran at **1.16 (1.06 to 1.29)**. The final brief text (`1abed38`) has never been measured. The CHANGELOG names what is left, and the Claude Code docs explain the mechanics of each item.

**The first cause is fixed text.** "About 1.3k tokens a call of brief, skill and tool listing" is the whole gap on the 8 clean HumanEvalFix pairs: 122.4k against 117.7k per task, over 4 rounds each. That also puts one round at roughly 30k prompt tokens.

All of that text is under atlias's control:
- Claude Code defers MCP tool definitions by default and loads only tool names and server instructions ([Manage costs](https://code.claude.com/docs/en/costs)). Yet the brief's first line repeats **eight of atlias's ten tool names** plus the CLI path ([lib/brief.mjs:70](file:///home/user/atlias/lib/brief.mjs), [mcp/tools.mjs:105-114](file:///home/user/atlias/mcp/tools.mjs)).
- Skill descriptions are listed on every request. Each is capped at 1,536 characters, inside a listing budget of 1 per cent of the context window. A skill marked `disable-model-invocation: true` has its "Description not in context" ([Skills](https://code.claude.com/docs/en/skills)). atlias's two skill descriptions run about 330 and 390 characters ([skills/](file:///home/user/atlias/skills/)).

The arithmetic: 1.3k tokens over four rounds is about 5k per task, close to the 4.7k gap. Cutting the fixed text to a few hundred tokens therefore buys parity on those pairs and nothing beyond it.

None of this breaks the prompt cache. Claude Code "never invalidates the cache for a plugin's skills, commands, agents, hooks", and it inserts hook text at the point where the hook fired ([Prompt caching in Claude Code](https://code.claude.com/docs/en/prompt-caching), [Hooks](https://code.claude.com/docs/en/hooks)).

**The second and third causes are one problem: rounds spent on checking.**
- On CanItEdit, plain Claude Code ran no check at all, while atlias's check cost a round.
- The brief told the model to send an edit and its check in one message, and the model did not.

When a Stop hook keeps the conversation going, Claude Code makes another request ([Hooks](https://code.claude.com/docs/en/hooks)), so each held reply costs about one more 30k round. Telling the model more firmly is the weak lever. The strong one is to have the gate run the project's visible check itself at Stop whenever none ran after the last edit:
- record the check;
- say nothing if it passes;
- hold the reply only on a failure. Plain Claude Code would need that round too, if it knew about the failure.

This removes the check round, makes the pairing instruction unnecessary, and so removes that instruction's text from the brief as well.

The constraint is time. atlias's hook dispatcher has a 10-second backstop that ends the process, even though the host allows the Stop hook 30 seconds ([lib/hooks.mjs:69](file:///home/user/atlias/lib/hooks.mjs), [hooks/hooks.json](file:///home/user/atlias/hooks/hooks.json)). The check must be bounded, or that path must be given more time. One tempting shortcut is out: `continueOnBlock` exists only for prompt and agent hooks, not the command hooks atlias uses.

**The fourth item is cancelled hooks.** Claude Code cancelled **80 atlias hook calls in 22 of 34 runs**, and each cancelled PostToolUse left a check that really ran unrecorded.
- **The documented mechanism is a timeout.** Claude Code cancels a synchronous command hook that reaches its `timeout` and discards its output. The default timeout is 600 seconds ([Hooks](https://code.claude.com/docs/en/hooks)).
- **atlias's setting is tight.** It gives PreToolUse, PostToolUse and PostToolUseFailure 8 seconds with matcher `.*`, so every tool call starts Node twice against an 8-second limit ([hooks/hooks.json](file:///home/user/atlias/hooks/hooks.json)).
- **The cause is not proven.** Timeouts are the likely cause of the 80 cancellations. A third-party report of every PostToolUse ending cancelled on one machine has an unsettled cause ([melodic-software/claude-code-plugins#3549](https://github.com/melodic-software/claude-code-plugins/issues/3549)).

The cloud branch already holds the robust answer, which is to read the transcript at Stop. What remains is to measure it, and to let the PC's search of the 0928 study transcripts decide whether the timeouts should also go up.

**One measurement question sits under all of this.** Cache reads bill at **10 per cent of base input** and five-minute cache writes at **1.25 times** ([Prompt caching, Claude API](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)). The brief is cached after the first round. If the study's "prompt tokens" count cache reads at full weight, the ratio overstates what the fixed text costs in money. The repository cannot say whether it does, because the study scripts are on D:. Report the raw ratio and a billed-equivalent ratio side by side, and never use the second to hide the first.

## A third of the 7B's failed edits re-send unchanged text

On the main tier, **same-text edits made up 87 of the 246 edits atlias could not apply**: the model re-sent its own wrong function. On polyglot run poly-C, same-text and repeated edits were 23 of 55 failed edits ([NEXTGEN-4.md:1125-1130, 1199-1203](file:///home/user/atlias/docs/NEXTGEN-4.md)). Item 5, round four's named "next", aims at exactly this: a no-op should not count as a strike, and a repeat should switch the edit channel.

Other harnesses show what exists:
- **SWE-agent** refuses a literal no-op with exit code 161 ([str_replace_editor](https://github.com/SWE-agent/SWE-agent/blob/main/tools/edit_anthropic/bin/str_replace_editor)).
- **OpenHands'** stuck detector fires on four identical action/observation pairs or three identical failing actions. That misses a model that re-sends the same function inside different edit calls ([stuck.py @0.40.0](https://github.com/All-Hands-AI/OpenHands/blob/0.40.0/openhands/controller/stuck.py)).
- **Aider** caps reflections at 3 ([base_coder.py](https://github.com/Aider-AI/aider/blob/main/aider/coders/base_coder.py)).
- **mini-swe-agent**, the baseline atlias beat, has no repetition detector at all ([default.py](https://github.com/SWE-agent/mini-swe-agent/blob/main/src/minisweagent/agents/default.py)).

None of the sources found publishes a measured effect for its detector. An atlias A/B would be new evidence, not a replication.

What the channel should switch to has better support:
- **Aider's polyglot board.** Qwen2.5-Coder-32B scored **16.4 per cent with 99.6 per cent well-formed replies in whole-file format, against 8.0 per cent and 71.6 per cent in diff format**. The two runs used different endpoints and commits, and the doubling came on the second try ([polyglot_leaderboard.yml](https://github.com/Aider-AI/aider/blob/main/aider/website/_data/polyglot_leaderboard.yml)).
- **Aider's edit board.** All 22 Ollama runs used whole format ([edit_leaderboard.yml](https://github.com/Aider-AI/aider/blob/main/aider/website/_data/edit_leaderboard.yml)).
- **CanItEdit's reference generator** asks for the whole "Code After" ([nuprl/CanItEdit](https://github.com/nuprl/CanItEdit)).

So after a repeat, HumanEvalFix should switch to a whole-function replacement located by name, and CanItEdit's short files to a whole-file write. Neither can come back as a same-text no-op.

**Two tempting claims do not hold up.**
- **The anchoring claim is unverified.** The paper usually cited for "resample instead of repairing" reports that 33-68 per cent of retries are near-identical when a small model sees its own failed attempt. arXiv was blocked, so it could not be read, and it stays unverified.
- **The token saving points the other way.** The one repair-versus-resample study that was read found resampling at 8B scored 79.9 per cent against repair's 76.8 per cent. But resampling **spent more tokens, 219K against 195K**, and its arms differed in temperature as well as method. Its authors conclude that self-repair is the more token-efficient strategy ([iterative-code-repair, main.tex](https://github.com/Johin2/iterative-code-repair)).

The same study does confirm three things:
- the first two repair rounds hold 76-95 per cent of the gain;
- assertion errors are the hardest to repair (about 45 per cent, against 77 per cent for name errors), because the message "provides minimal diagnostic information";
- richer prompts help an 8B model by only 1.8 points.

That sets expectations for HumanEvalFix's bare AssertionError. pytest shows values only for asserts in modules it collects as tests ([pytest docs](https://github.com/pytest-dev/pytest/blob/main/doc/en/how-to/assert.rst)). Printing expected and actual values is therefore cheap, but at 7B it should save tokens more reliably than it wins tasks. The current corpus already serves as the content-free control arm.

**The largest unexplained number is the gap between atlias's loop and a single prompt.** Microsoft's NextCoder table gives Qwen2.5-Coder-7B **73.8 on HumanEvalFix and 48.1 on CanItEdit** single-shot, and the 14B model 87.8 and 58.1 ([NextCoder README](https://github.com/microsoft/NextCoder)). atlias gets 31 per cent and 9 per cent from the same model family on Ollama. The setups differ: quantisation, the prompt, and the README does not say whether its CanItEdit score is lazy or descriptive. So the gap does not prove the loop hurts. It is large enough, though, that a "direct" arm is the cheapest experiment with the biggest possible consequence, and it needs only a fraction of a loop run's GPU time. The direct arm is:
1. one prompt;
2. a whole-function or whole-file answer;
3. the visible check;
4. at most one repair.

**The model is dated too.** qwen2.5-coder:7b is a 2024 model. Qwen has since shipped 3.5-9B (March 2026), 3.6-35B-A3B (April) and a dense 3.8-27B (August) ([Qwen3.6 README](https://github.com/QwenLM/Qwen3.6)). Whether any of these is on Ollama in a size that suits the PC's 12.0 GiB of VRAM is unverified. qwen2.5-coder:14b is the defensible next model: it has published anchors, and it should lift CanItEdit off the floor where A/Bs have no power.

## A stranger-reproducible score is cheaper than any open leaderboard

Round four ended with the admission that "atlias still has no score against a public benchmark that a stranger could reproduce" ([NEXTGEN-4.md:1259-1260](file:///home/user/atlias/docs/NEXTGEN-4.md)). The leaderboards are mostly closed to it:

| Venue | Status for atlias |
|---|---|
| SWE-bench Verified and Multilingual | Since 2025-11-18, only submissions with an arXiv or technical report and at least one academic or research-lab author. "Bash Only" is now just a filter on Verified ([SWE-bench/experiments](https://github.com/SWE-bench/experiments/blob/main/README.md)). |
| SWE-bench Lite | Not named in that policy, but every submission needs a technical report or blog post and can be refused ([checklist.md](https://github.com/SWE-bench/experiments/blob/main/checklist.md)). |
| Terminal-Bench 2.1 | Closed to community submissions, and would need five trials per task anyway ([terminal-bench-2-1](https://github.com/harbor-framework/terminal-bench-2-1/blob/main/README.md)). |
| SWE-bench-Live | Accepts PRs from anyone: a single rollout from the problem statement only, with raw trajectories ([SWE-bench-Live](https://github.com/microsoft/SWE-bench-Live/blob/main/README.md)). |
| Aider polyglot | Ranks models under Aider, not other harnesses. Its newest entry is from 2025-10-03. |

The tooling has traps:
- **`pip install swebench` lacks the submit flow.** The latest PyPI release, 5.0.2, has no `submit` command. The package, publish and verify steps exist only on GitHub main at commit 02e7a74, so any package must pin that commit.
- **Scoring is free but keyed.** sb-cli scores Lite and Verified test predictions free, in about 20 minutes, with an emailed API key ([mini-swe-agent swebench.md](https://github.com/SWE-agent/mini-swe-agent/blob/main/docs/usage/swebench.md), [sb-cli](https://github.com/SWE-bench/sb-cli/blob/main/README.md)).
- **atlias has no container adapter** and no predictions emitter ([lib/eval.mjs:6-7](file:///home/user/atlias/lib/eval.mjs)).
- **Docker is only partly tested.** A verifier started a Docker daemon in the cloud container and ran `hello-world`. A full SWE-bench image pull is untested.
- **Hugging Face is blocked.** huggingface.co hosts the SWE-bench, HumanEvalFix and CanItEdit data, and the cloud environment's proxy blocks it. Gev can lift that under the environment's Network access settings ([Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web)).

**The cheaper route to a reproducible score is already on disk.** HumanEvalFix and CanItEdit are public benchmarks. The corpora regenerate from Hugging Face with `atlias editbench`, the mini-swe-agent driver is in the repository, and the model is pinned by digest ([evals/CORPORA.md:50-73](file:///home/user/atlias/evals/CORPORA.md), [tools/h2h/](file:///home/user/atlias/tools/h2h/)).

What is missing is the package itself:
- **A lock file with every version and setting.** It must include the Python packages that decide which CanItEdit tasks count as sound. Sixteen refusals came from missing pandas, torch, z3, sklearn, autograd and vllm.
- **The task list.**
- **Per-task rows for both arms.**
- **The statistics.**
- **One command to re-score or re-run.**

With that, a stranger with an Ollama GPU could reproduce the claim in an evening. It carries no leaderboard badge, but it is the honest form of the claim and costs a fraction of any leaderboard path.

The statistics should follow Anthropic's published advice ([A statistical approach to model evaluations](https://www.anthropic.com/research/statistical-approach-to-model-evals)), and atlias's comparator already covers most of it:
- a standard error with each score;
- paired differences on identical questions;
- clustered errors where tasks share a source;
- power analysis.

SWE-bench comes after the package, as a five-instance spike that measures cost per instance before any credit is committed. A cloud sandbox cannot reach the PC's Ollama without a tunnel, so that arm should use a hosted open-weights model paid from a separate API key.

## Ranked plan: what to build, who runs it, what it costs

Two shared protocols keep the table short.

**MT (main-tier protocol).**
- The 250 shared tasks, run on qwen2.5-coder:7b digest dae161e2 under Ollama 0.34.3.
- Settings: num_ctx 16384, num_predict 2048, temperature 0.2, each task's own round budget, hidden graders.
- Machine state: the RideLink worker stopped and the model kept loaded.
- Three fresh runs per arm with `--save`.
- `atlias compare` reports Wilson intervals per arm, McNemar exact on each task's majority outcome, a sign test on pass fractions, and prompt tokens per solved task.
- Fewer than six one-way flips is reported as "inside the noise".
- Every flagged arm runs at a SHA where a golden test shows flag-off behaviour identical to the baseline on the scripted engine. That is what lets row 1's baseline serve as the control for every later A/B, roughly halving the GPU hours the round needs.

**CC (Claude Code protocol).**
- The same 34 tasks from atlias's seeded sampler: 20 HumanEvalFix, 10 CanItEdit, 4 refactor.
- Headless, Sonnet 5 at medium, one fresh workspace per task, hidden graders.
- Claude Code version pinned, with the plain arm re-run in the same window.
- Report the per-solved-task token ratio with its 95 per cent interval, both raw and billed-equivalent.
- Also report solves (naming any lost task), gate holds, cancelled hook calls, and holds that claimed no check ran when the transcript shows one.

Costs:
- **PC hours are estimates.** One main-tier arm-run is taken as roughly 2-4 GPU hours, extrapolated from poly-C's 801 s for 27 tasks and about 1,000 tokens/s of prompt evaluation over atlias's 5.8M prompt tokens. The first real run replaces the estimate.
- **Cloud dollars are rough judgement from the size of each change.** The cloud should post actual spend after each PR and re-plan.

| # | Work | Attacks | Measured by | Expected effect (evidence) | Rough cost | Owner and hand-off |
|---|---|---|---|---|---|---|
| 1 | Confirm the head-to-head. The cloud first lands ledger fields (successful edits, masked-observation counts, re-reads after masking) and the flag/env plumbing with its golden test | 59 vs 41/250, p=0.020 from one run per arm; 99.0k vs 127.4k per solve | MT, atlias vs mini-swe-agent. Bar: majority-vote McNemar p<0.05 | Unknown. The 21/21 flips between two atlias versions say the 36/18 split can narrow. These runs become the control for rows 4-8 | PC: 6 arm-runs, about 12-24 GPU h, about 2 h attention. Cloud: about $8 | **Both.** The PC starts the 3 mini-swe-agent runs at once, since they do not depend on atlias's SHA. The atlias runs use the cloud PR head once it passes the Windows suite, or 41f9ba6 if that takes more than a day |
| 2 | Measure the transcript-recovery fix already built (fd92b54, 6c710ae) | 1.25x; 80 cancelled hook calls in 22/34 runs; false "no check ran" holds. Also measures the unmeasured 1abed38 brief | First, the PC searches the D:/harness-work/runs/cc-token-study-0928 transcripts for cancellation records and their reasons, and reads the study scripts to see how cache reads are weighted. Then CC with three arms: plain, atlias@41f9ba6, atlias@PR head | Moves toward the clean pairs' 1.16 if they are representative (unproven); holds fall below 8. If the search shows timeouts, the cloud raises the PreToolUse/PostToolUse timeouts in the same PR | PC: 1 h, then half a day plus plan usage for 102 sessions. Cloud: about $3 | **Both.** Hand-off is the PR head SHA; the PC replies with a RESULT comment |
| 3 | Publish public score v0 and correct the README | "No score a stranger could reproduce"; README line 211 says success is unmeasured | The PC re-runs from a fresh clone of the package and must land inside row 1's run-to-run spread | A reproducible claim either way. If row 1 does not hold, the package publishes "inside the noise" and the README says so | Cloud: about $15 (packager with lock file, task list, per-task rows, stats, re-score/re-run command; default `ollamaModel` set to qwen2.5-coder:7b). PC: about 3 h plus one arm-run | **Both.** The cloud builds and tests with fixture reports. The PC runs it on the D: reports, publishes, and edits the README |
| 4 | Lean brief plus gate-runs-the-check, both behind flags | About 1.3k tokens per call; the CanItEdit check round; edit and check not paired | CC, plain vs flags on. Bar: ratio at or below 1.05, interval excluding 1.25, no task lost | About 3.5k per task off the HumanEvalFix pairs, reaching parity there (1.3k × 4 rounds arithmetic). About one 30k round off each CanItEdit task atlias checked and plain Claude Code did not. Not below 1.0 on its own | Cloud: about $15. PC: half a day plus plan usage | **Cloud builds** (brief character-count tests, fixture projects with check.py and canitedit_check.py, the 10 s bound). **PC measures** |
| 5 | Item 5: same-text is not a strike; a repeat switches to whole-function or whole-file | 87/246 same-text edits; 23/55 same-text plus repeated on polyglot; 99.0k per solve | MT, flag on vs row 1. Also tracks same-text share, edits not applied, tokens per solve | Same-text strikes drop to near zero by construction; tokens per solve fall. Pass effect unknown, since no harness publishes its detector's effect. The whole-format switch is backed by Aider's data | Cloud: about $15. PC: 6-12 GPU h | **Cloud builds** (scripted-model tests). **PC measures** |
| 6 | Direct arm: one prompt, whole answer, visible check, at most one repair | 51/162 and 8/88 against the published single-shot 73.8 and 48.1 | MT, direct vs row 1's atlias and mini-swe-agent arms, reported per benchmark | Unknown. Six or more one-way flips in either direction decides round six's shape | Cloud: about $10. PC: 3-6 GPU h (one or two calls per task) | **Cloud builds** `--direct` (echo-engine tests). **PC runs** |
| 7 | HumanEvalFix v2: the check prints expected and actual | 51/162; the bare AssertionError | atlias ×3 on v2 (162 tasks) vs row 1's v1 rows as the content-free control. mini-swe-agent ×3 on v2 only if atlias gains six or more one-way flips | Small pass effect at 7B (assertion errors are the hardest to repair; richer prompts add +1.8 points at 8B). Fewer tokens per solve is likely | Cloud: about $6. PC: 0.5 h to regenerate, plus 4-8 GPU h (another 4-8 for mini-swe-agent) | **Cloud builds** the converter against fixture rows (Hugging Face is blocked). **PC regenerates** the corpus on D: and runs it |
| 8 | Ollama prompt profile (item 6) and honest local defaults (item 8, code part) | 99.0k per solve; the defaults a stranger gets | Prompt characters per call on the echo engine (Linux, no model). MT only if PC hours remain | Fewer tokens per call; pass effect unknown | Cloud: about $8. PC: optional 6-12 GPU h | **Cloud** |
| 9 | qwen2.5-coder:14b on the main tier; check `ollama pull` for a 2026 Qwen model | CanItEdit at the floor (8/88, 2/88); a 2024 7B as the only model | MT at one run per arm first; ×3 if a tier lands in the 30-70 per cent band | CanItEdit comes off the floor (NextCoder 14B single-shot 58.1). Whether it fits in VRAM is unverified | PC: 8-16 GPU h. Cloud: $0 | **PC** |
| 10 | SWE-bench spike, then go/no-go | No public leaderboard entry | 5 instances × 2 arms, scored with sb-cli; cost per instance recorded. Go if 100 × 2 × 3 fits under a $60 model-API cap | A cost figure, not a score | Cloud: about $15 for the spike, about $30 more on go. Model API is paid separately: it needs a key, huggingface.co allowed, and swebench pinned at 02e7a74 | **Cloud.** The SWE-bench-Live PR goes out from Gev's account (see below) |
| 11 | Deferred: items 7, 11 and 9's remainder, the cached-token field, `doctor --context`, delegation break-even, keepObservations A/B, three-arm protocol A/B | none this round | - | - | Only from the cloud reserve | Round six |

**Budget.** The cloud column comes to about **$95 for rows 1-8 plus the spike, plus a $20 reserve for rebases and PC-found fixes: about $115 of the $150**. It rises to **about $145** if SWE-bench goes ahead. The PC column is about **40-80 GPU hours plus two Claude Code studies**, one to two weeks of mostly overnight runs. The scarce resources are the PC's single Ollama slot and Gev's plan usage, not code.

**Order.**
1. **Day one.**
   - PC: the transcript search and the three mini-swe-agent runs.
   - Cloud: PR-1, containing the recovery fix, the ledger and the flag plumbing.
2. **Next.**
   - PC: the atlias baseline runs and the first Claude Code study, both on PR-1's head.
   - Cloud: rows 3 to 8, in table order.
3. **Last.** Rows 4 to 7 get measured as each lands.

## How the two sessions stay out of each other's way

**Branches.**
- **The cloud works only on `claude/session-limits-usage-credits-dm3isz`.**
  - It keeps one open PR into main at a time.
  - It never force-pushes: every SHA a measurement names must stay reachable.
  - It merges `origin/main` into the branch instead of rebasing.
- **The PC commits to main.**
  - It never pushes to the cloud branch.
  - It measures a PR by checking its head SHA out into a separate worktree on D:, so its main clone stays untouched.
- **Merge rule.** Every behaviour change lands default-off behind a config key that can also be set from the environment, so the study scripts on D: can switch it per arm. Defaults flip only in a separate commit, after the PC's result meets the bar set before the run.

**File ownership for the round:**

| Area | Owner | Rule |
|---|---|---|
| `lib/`, `mcp/`, `bin/`, `hooks/`, `skills/`, `test/` | Cloud | The PC reports bugs as "BUG:" PR comments. If a bug blocks a measurement, the PC may commit a one-file fix to main and say so; the cloud merges main before its next commit |
| `evals/CORPORA.md` and converters, the packager, a new `tools/swebench/` | Cloud | - |
| `CHANGELOG.md` "## Unreleased" | Cloud | The PC edits CHANGELOG only when cutting a release, right after a merge |
| `docs/` (a new `docs/NEXTGEN-5.md`), `README.md`, a new `evals/results/round5/`, `tools/h2h/`, the `package.json` version, tags | PC | The cloud reads these and never edits them |
| `D:/harness-work` | PC | No code path may assume it exists |

**Hand-off.**
1. **The cloud asks.** Its PR carries a "MEASURE" block with:
   - the SHA and the flags;
   - the corpus and the protocol (MT or CC);
   - the arms and the number of repeats;
   - the bar, set before the run;
   - the expected effect.
2. **The PC answers** with a "RESULT" comment containing:
   - the `atlias compare` output;
   - the run ids and D: paths;
   - pass or fail against the bar.
3. **The data lands on main.** The PC commits a summary JSON to `evals/results/round5/`: per-task outcomes, tokens, flags and SHA. The cloud cannot see D:, so this is how it reads the data. The cloud session subscribes to its PR's activity, so a RESULT comment wakes it.
4. **Suites run on both systems.** Every PR also needs the PC's `node test/run.mjs` on Windows at the PR head, because the Windows-only paths (taskkill /T, .cmd spawning, Windows transcript paths) are only real there.

**Merge order.**
1. PR-1: recovery, ledger, flags, and higher timeouts if the transcript search shows timeouts. It merges after the Windows suite and a first Claude Code study with no lost task.
2. PR-2: lean brief and gate-run check, default off. It merges on a passing suite.
3. PR-3: item 5, direct mode, the HumanEvalFix v2 converter, the Ollama profile, the packager and the default model. It merges on a passing suite, since everything in it is off by default or new.
4. Default-flip commits, one per measured result.
5. The PC cuts 3.9.0 (release heading with measured numbers, version bump, tag) and updates the README.
6. The SWE-bench adapter, if it goes ahead.

Merges use merge commits, never squash, so every SHA a RESULT names stays in main's history. Gev merges, or the PC session does with `gh pr merge --merge` after posting the RESULT.

**Opening PRs (Gev's instruction).** Gev asked that the PC session turn on computer use and create a PR when necessary, or when the cloud session says so.

By default the cloud opens its own PRs through its GitHub connector. The container has no `gh`, and the connector's write access to `ridelink0/atlias` is untested until the first PR.

The PC session opens a PR when any of these holds:
1. the connector refuses;
2. the cloud's credit falls below about $15, in which case the cloud first writes a HANDOFF comment listing unfinished work;
3. the target is outside the cloud's access, such as the SWE-bench-Live submission repo, an awesome-list, or a fork;
4. the cloud posts "PR NOW: head → base, title" on a pinned round-five tracking issue and in its message to Gev.

The route that works is `gh pr create` from the PC session's own shell. Computer use cannot do this step by itself:
- It exists only in the Claude desktop app, after Gev turns it on (Settings → Desktop app → Computer use; it is off by default).
- It gives browsers "read" access, meaning clicks and typing are blocked.
- It gives terminals "click" access, meaning no typing ([computer-use skill](file:///mnt/skills/examples/computer-use/SKILL.md)).

So if `gh` is not signed in and the PC session runs in the desktop app, it turns computer use on and does the GitHub page through Claude in Chrome or the built-in browser. The final "Create pull request" on any public leaderboard or third-party repo waits for Gev's click.

## Adoption and revenue levers (labelled: the evidence is thin)

This section answers Gev's profit question and goes only as far as verified evidence allows.

**The gate idea is not unique.**
- **proof-of-done** is a deterministic Stop-time claim gate for Claude Code: Apache-2.0, 0 stars when fetched ([proof-of-done](https://github.com/B0yko/proof-of-done)).
- **verify-gate** blocks "done" when files changed and nothing was verified: MIT, 0 stars ([verify-gate](https://github.com/h-brooks/verify-gate)).
- **Claude Code** now sanitises its own auto-memory (2.1.282) and prompts before dangerous recursive `rm` (2.1.281) ([Claude Code CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)).

Inside Claude Code, then, atlias's memory and destructive-command guard stand out less than on the Ollama and OpenAI-compatible paths, where atlias's own loop is the product.

**The one claim none of the competitors found makes is a measured, same-model win on public benchmarks.** It has to be stated as the whole agent's result: no gate-on/gate-off comparison exists, so the gate's own effect is unmeasured. Inside Claude Code the current figure, **1.25 times the tokens per solved task with no extra solves**, argues against the sub-harness pitch until it reaches parity. Issue #85422, an open request for runtime spend caps with per-source attribution across hooks, plugins and subagents ([anthropics/claude-code#85422](https://github.com/anthropics/claude-code/issues/85422)), is an opening for atlias's per-round ledger, but only once atlias is not itself a source of extra spend.

**Distribution facts:**
- Anthropic's catalog shows install counts and an "Anthropic verified" badge.
- Directory submission goes through the developer portal and **requires a paid claude.ai plan**.
- The official marketplace takes no submissions, only contact through a partner ([Anthropic's marketplaces](https://code.claude.com/docs/en/plugins/anthropic-marketplaces), [Publish plugins](https://code.claude.com/docs/en/plugins/publish)).
- Since 2.1.284, under managed-permission policy, plugins from a marketplace or npm lose `allowed-tools` pre-approval unless they are official or vouched for. That is friction for enterprise users.
- Codex `/goal` is now stable and on by default ([codex features](https://github.com/openai/codex/blob/main/codex-rs/features/src/lib.rs)). The inference is that an atlias Codex integration should feed evidence into `/goal` rather than compete with it.
- Gemini CLI's AfterAgent hook can reject a reply and force a retry ([Gemini CLI hooks](https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md)).
- OpenCode gets only MCP and AGENTS.md from atlias, so there is no gate there ([lib/hosts-extra.mjs](file:///home/user/atlias/lib/hosts-extra.mjs)).

**Revenue.** No verified revenue figure exists for any comparable plugin or agent. The OpenCode, Kilo, Cline and Amp figures could not be checked and are left out.

The rest is inference. Every plausible paid lever for a zero-dependency MIT harness depends on a public, reproducible number first, which is rows 1 and 3:
- a hosted team view of gate logs and tokens per solved task;
- a team tier for shared memory and the knowledge graph;
- paid benchmark reports.

The first adoption steps cost nothing but review time:
- a directory listing, which Gev's plan qualifies for if it is a paid claude.ai plan;
- a README that states the reproducible result, whatever it turns out to be.

## Could not be verified, and what was refuted

These claims appear in the notes but were not confirmed against a primary source. None of them is stated as fact above:

| Claim | Why unverified | What settles it |
|---|---|---|
| Showing a small model its failed attempt makes 33-68 per cent of retries near-identical (2-14 per cent blind); blind resampling ties at 7B with 2.5-5.5x fewer tokens; at 7B and below, feedback content adds nothing over a placebo (arXiv 2607.26117, 2606.31511, 2607.12962) | arXiv blocked | Read the papers, or run a resample variant of row 5 |
| FeedbackEval's test-feedback 61.0 per cent; the Java replication; whole-file beating search/replace (2609.05779); AdaEdit matching full-code accuracy at over 30 per cent less cost | arXiv and ACL blocked | Read the papers |
| 2026 model facts: Qwen3.6-35B-A3B at 73.4 per cent on SWE-bench Verified and available as `qwen3.6:35b-a3b`; Qwen3.6-27B at 77.2; Qwen3-Coder-Next at 70.6; Devstral Small 2 at 68.0 and ~15 GB; qwen3-coder:30b at ~19 GB; the 76.8 per cent bash-only top score | Vendor, Ollama and HF pages blocked | `ollama pull` and `ollama show` on the PC |
| The 80 cancelled hooks were atlias's own 8-second timeouts under load | Inference; the rows are on D: | The PC's transcript search (row 2) |
| Whether the 3.8.1 study weights cache reads at full weight | The scripts are on D: | The PC reads them (row 2) |
| Hook features no verifier re-checked: the `if` filter, PostToolBatch, `updatedToolOutput` and `updatedInput`, placement of additionalContext inside a parallel batch | Not in the verification pass | The cloud reads the hooks reference before building on them |
| Claude Code runs one message's write and shell calls in order | One atlias probe plus the wording of the concurrency docs | Not needed if row 4 lands |
| PreCompact/PostCompact `additionalContext` reaches the model; behaviour on Ollama versions other than 0.34.3; whether the 612 s zebra timeout came from RideLink contention; Ollama sampling defaults; a 3,847-character poly-A system prompt | Listed as unverified in round four | Live checks on the PC |
| Community status of Terminal-Bench 2.0 and 4.0; non-academic SWE-bench Lite merges after 2025-11-18; sb-cli quotas; cost per instance of open-weights SWE-bench runs; Modal and Daytona prices; self-serve publishing in the Codex directory | Sites blocked or not researched | Row 10's spike, and direct reads |
| Market numbers: 35 per cent of 101 "tests pass" claims false; 80.4 per cent misleading behaviour; OpenCode users and revenue; Kilo, Cline and Amp prices and revenue; claude-mem and Superpowers stars | Sources blocked | Do not use in copy until read |
| The cloud connector can open PRs on ridelink0/atlias; qwen2.5-coder:14b fits in 12 GiB; a full SWE-bench image pulls in the cloud container | Untested | First PR; `ollama ps`; row 10 |

These were **refuted** against the primary source:

| Claim | What is true |
|---|---|
| 3.8.1 already falls back to the transcript | Only on the cloud branch (fd92b54, 6c710ae): unreleased and unmeasured |
| The MCP server has 9 tools and the brief names all nine | 10 tools; the brief names 8 |
| It is undocumented whether `disable-model-invocation` drops a skill's description | Documented: "Description not in context" |
| `systemPrompt` sends the tool line to every engine | Only when native tools are off. apply_patch is named for every engine, and the skills index goes to both |
| Resampling beats repair at 8B and below and saves tokens; repair wins at 32B | At 8B resampling spent more tokens (219K vs 195K); Qwen3 32B tied; the arms were confounded |
| The per-benchmark split was unknown | 51/162 and 8/88 for atlias; 39/162 and 2/88 for mini-swe-agent |
| `pip install swebench` provides `swebench submit` | Not in PyPI 5.0.2; only on GitHub at 02e7a74 |
| The PC opens the PR through the GitHub web UI under computer use | Browsers get read access under computer use; use `gh` or a browser tool |
| The gate works in OpenCode | OpenCode gets MCP and AGENTS.md only |
| The gate's effect is measured by 59 vs 41 | That is the whole agent against mini-swe-agent; there is no gate ablation |
| Codex `/goal` sits behind `features.goals` | Stable and on by default |
| Directory submission goes through a review form | Developer portal, paid plan required; the official marketplace works only through partner contact |
| The notes' Claude Code version tags | MEMORY.md sanitising is 2.1.282, the rm prompt 2.1.281, reserved names 2.1.280. In 2.1.283 only MCP, WebFetch and WebSearch outputs are added to spans, and only with `OTEL_LOG_TOOL_CONTENT=1` |

## Conclusion

Round five is shaped by scarcity, not by a shortage of ideas. Code is cheap on both sides. What is scarce is the PC's single Ollama slot, Gev's plan usage for Claude Code studies, and about $150 of cloud credit. Default-off flags plus a golden flag-off test turn one three-run baseline into the control for every A/B, and that single design choice is what fits the round into one to two weeks of PC time.

The round's real test is not a feature. It is whether atlias's one claim survives three runs and becomes something a stranger can check. If it survives, round five ends with atlias's first defensible public sentence. If it does not, the direct arm shows whether the 7B's problem is the loop itself. Inside Claude Code, trimming text reaches parity at best. Beating plain Claude Code needs a round saved, and the gate running the check itself is the most concrete way to save one.
