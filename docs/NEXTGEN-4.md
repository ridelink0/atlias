# The next generation, round four: the instrument was broken before the harness was

Round three (`NEXTGEN-3.md`) built the counters, the stamp, the repeats and the
paired comparator, and then measured atlias against a 7B local coder:
3/9, 4/9 and 2/9 on the nine-task corpus, and **0/27** on 27 Aider polyglot
Python exercises (`poly-A`), with **52 of 79 edit attempts (66%) never
applied**. This round sent four research fronts at those two numbers - edit
application, small local models, context engineering, and evaluation without
Docker - and had every finding checked by a second, independent verifier that
fetched the primary source itself.

The rule for this document: **a claim goes in as fact only if its verifier
marked it confirmed.** Claims the verifier could not check are in "Could not be
verified" at the end. Claims the verifier refuted are named as refuted. Local
measurements a verifier could not re-run are labelled as such, unless I re-ran
them myself for this document, in which case that is said.

What I re-ran myself on 2026-09-25, on this machine, before writing:

- `D:/harness-work/runs/poly-A.json`: 27 tasks, 0 passed, 79 edit tries, 52
  failed, 646,350 characters of context, 3,046,553 ms, stamped
  `atlias 3.6.0 @ dacf97e-dirty`. Stop reasons: **malformed-output 10**,
  answered 8, rounds-exhausted 8, model-error 1. (The edit-apply front wrote
  "12 of 27 ended as malformed-output"; the file says 10.)
- `python D:/harness-work/research/mcnemar_power.py`: the power table quoted
  below, number for number.
- `D:/harness-work/bench/canitedit/sound.tsv`: 105 rows, 88 `sound`, 17 `BROKEN`.
- `D:/harness-work/bench/humanevalpack/sound2.log`: Python 164 sound of 164, JS
  163 of 164.
- `D:/harness-work/runs/mswe-smoke.json`: one task, proverb, 7 of 18 steps,
  71,880 ms, `Submitted`, check failed, 7,784 characters.
- `lib/loop.mjs:1468`: `ollamaChat` posts `{ model, messages, stream: false,
  options: { temperature: 0.2 } }` and nothing else. A grep of `lib/`, `bin/`
  and `mcp/` finds no `num_ctx`, `num_predict`, `keep_alive` or `truncate`
  option anywhere.
- `lib/progress.mjs:56-68`: `preCompact` and `postCompact` both return their
  text as `additionalContext`.
- `lib/loop.mjs:1260-1261`: `hasGraph` is recomputed on every `runLoop` call,
  while the text-mode system prompt (which lists the tools) is built only once.

## The finding that outranks everything: the model could not see its task

atlias never tells Ollama how large a context to use, and on this machine that
means **4096 tokens**.

- Ollama's documented default is VRAM-tiered: under 24 GiB, 4k; 24-48 GiB,
  32k; 48 GiB and up, 256k. The tier logic is in `server/routes.go`, and this
  machine's own server log says `vram-based default context
  total_vram="12.0 GiB" default_num_ctx=4096`, with `OLLAMA_CONTEXT_LENGTH:0`.
  *Confirmed* (docs.ollama.com/context-length, ollama `server/routes.go`,
  `%LOCALAPPDATA%/Ollama/server-1.log`).
- Ollama's own docs disagree with themselves: the FAQ says 4096, the Modelfile
  table still says 2048. The logged value is the one to trust. *Confirmed.*
- When a prompt is over the limit, Ollama's `chatPrompt` drops whole messages
  **from the front**, keeps system messages and the last message, and says so
  only at `slog.Debug`. *Confirmed* (ollama `server/prompt.go`).
- In atlias, `messages[0]` is the system prompt and `messages[1]` is the task
  (`lib/loop.mjs:1261-1262`). So the **task statement is the first thing the
  model loses**, while the tool protocol survives. *Confirmed.*
- qwen2.5-coder:7b is trained to 32768 tokens and its Ollama entry has no
  parameters block. *Confirmed* (`/api/show`).
- poly-A's per-task transcripts run 5,522 to 62,814 characters. *Confirmed.*
- On this machine, a gemma3 request at temperature 0.200 filled 4045 of a 4096
  slot, generated 51 tokens, and released with `truncated = 1`; its prompt eval
  reused only 191 of 3854 tokens from cache (`f_keep 0.166`), because cutting
  the front rewrites the prefix. Every slot on record is `n_ctx_slot 4096`
  (29 loads). *Confirmed* against `server-3.log`. Which client sent that request
  is not known (the RideLink moderation worker also runs gemma3:4b).
- Ollama PR #16856, merged 2026-06-23, replaced an older pre-truncation to
  `num_ctx - 1` that left about one token for the reply. *Confirmed.*

What it costs, measured by someone else on the same engine: Aider ran
Qwen2.5-Coder-32B fp16 on Ollama at the 2k default and scored **51.9%, with
46.2% well-formed edits**; with a proper context the same model scored **71.4%
and 90.2%**. Aider now sets `num_ctx` on every request to the prompt plus 8k
for the reply. *Confirmed* (aider.chat/2024/11/21/quantization.html,
aider.chat/docs/llms/ollama.html, Aider's `quant.yml`).

Ollama's `api/types.go` has both levers atlias needs: `num_ctx` in the runner
options, and a `truncate` boolean on chat requests that controls whether an
over-long prompt is silently cut. *Confirmed.*

Consequence: **every local-model number atlias has published so far - A, B, C
and poly-A - was most likely measured on a model that could no longer see the
task it was given, or the file read its edits were copied from.** "Most likely"
because poly-A's effective context is not proven: at one point `/api/ps` showed
qwen2.5-coder:7b loaded at 16384 by a client nobody identified (see "Could not
be verified"). This also reopens a conclusion from round three. NEXTGEN-3 read
the ladder's 32%-to-29% as evidence that "most failed edits are not
near-misses". An `old_string` copied from a read the engine had already dropped
fails as not-found or as a stale edit no matter how good the matcher is. That
reading has to be re-measured with the context fixed before it is repeated.

## What the evaluation front found

**At 0/27 an A/B can show almost nothing.** McNemar counts only the tasks the
two arms disagree on. At zero passes the old arm has nothing to lose, so the
only possible disagreements are gains, and the new arm needs at least six of
them, on tasks the model has already shown it cannot do, before p < 0.05 is
possible. The exact two-sided test at alpha 0.05, which I re-ran:

| Effect (gain / loss per task) | Power at N=9 | N=27 | N=100 | Tasks for 80% power |
|---|---|---|---|---|
| 10% / 0% | 0.00 | 0.05 | 0.94 | 80 |
| 10% / 5% | 0.00 | 0.02 | 0.18 | 500 |
| 15% / 5% | 0.00 | 0.08 | 0.54 | 170 |
| 20% / 5% | 0.00 | 0.19 | 0.84 | 95 |
| 20% / 10% | 0.00 | 0.08 | 0.37 | 250 |
| 30% / 10% | 0.02 | 0.27 | 0.88 | 85 |

**Six one-way flips** are the minimum before p < 0.05 is possible at all. How
often a change breaks a task that used to pass matters as much as how often it
fixes one. *Confirmed* (the verifier ran the script too). The runs A, B and C
on nine tasks should stop being quoted as evidence for or against anything.

**Small-N intervals.** "Position: Don't Use the CLT in LLM Evals With Fewer
Than a Few Hundred Datapoints" (ICML 2025): "We would, therefore, recommend
using WS or Bayesian intervals in practice", and for two models on the same
questions, "We would recommend using the paired Bayes method as it can account
for correlations and thus produce narrower intervals." Implementation:
github.com/sambowyer/bayes_evals. *Confirmed* (arXiv 2503.01747). atlias
already uses McNemar exact for the verdict (`lib/eval.mjs:282`) and a
percentile paired bootstrap for the interval (`lib/eval.mjs:304`). Whether the
paper's warning extends to that bootstrap is inference, not something the
paper says.

For scale, the Wilson 95% interval on 0/27 is 0.0 to 12.5%; on 3/9 it is 12.1
to 64.6%, and on 4/9 18.9 to 73.3%. Runs A and B overlap almost entirely.

**Repeats.** tau-bench defines pass^k = E_task[C(c,k)/C(n,k)], used at least 3
trials per task, and saw gpt-4o fall from 61.2% pass^1 to under 25% pass^8 on
retail (arXiv 2406.12045). A 60,000-trajectory study of SWE-bench Verified
measured single-run pass@1 swinging 2.2 to 6.0 points with a standard deviation
above 1.5 even at temperature 0; its Table 2 puts detecting a 2-point gain at
about 9 runs per agent and a 1-point gain at about 36, for 500 tasks
(huggingface.co/papers/2602.07150). The unbiased pass@k estimator is
1 - C(n-c,k)/C(n,k) (Chen et al. 2021, arXiv 2107.03374). atlias samples at
temperature 0.2 (`lib/loop.mjs:1468`), so repeats are required. *All
confirmed.* `atlias eval --repeat k` and pass^k/pass@k already exist
(`runSuite`, `lib/eval.mjs:233`). What is missing is the comparator's side:
`compare` pairs on the all-attempts boolean and ignores the per-task pass
fraction the repeats produce.

**Corpora that run here without Docker.**

- **CanItEdit** (nuprl, 105 tasks, arXiv 2312.12450): 88 run natively on this
  machine (before-code fails its tests, after-code passes). The other 17: 16
  need a missing package (pandas 5, torch 4, z3 2, sklearn 2, autograd 2, vllm
  1), and `60_unique_number`'s tests already pass on the before-code. The
  upstream runner needs a container "because the benchmark has very particular
  Python dependencies". Licence: the Hugging Face card says MIT and the GitHub
  LICENSE says "BSD 3-Clause License with Machine Learning Restriction"; the
  restriction is on use as training data, so evaluation is fine under both (the
  research agent's reading of the licence). Each task has a lazy and a descriptive instruction.
  *Confirmed*, and the 88/17 split re-counted by me.
- **HumanEvalFix** (HumanEvalPack, MIT, arXiv 2308.07124): Python 164 of 164
  sound here. JavaScript 163 of 164, and **only after `console.assert` is made
  to throw**: Node's `console.assert` logs and exits zero, so with the stock
  tests most buggy JS solutions "passed". `JavaScript/162`'s canonical solution
  still fails. *Confirmed*, re-read by me.
- **Aider refactor-benchmark** (Apache-2.0): 89 tasks of the form "refactor
  method X of class Y into a top-level function", checked purely on the AST.
  Source files: median 27,170 bytes, maximum 1,120,797; 10 of 89 contain
  non-ASCII bytes. Aider's verifier imports `aider.dump` and opens files with no
  encoding (the Windows codepage here); `refactor_tools_standalone.py` removes
  both. *Confirmed.*
- **Aider polyglot** (clone at commit 7e0611e, 2024-12-22): Python 34, JS 49,
  Go 39, Rust 30, Java 47, C++ 26 = 225, matching Aider's published count. JS
  exercises need jest 29 plus babel from npm. *Confirmed.* atlias converted 27
  of the 34 Python exercises. `D:/harness-work/runs/convert.txt` records the
  other seven (dominoes, dot-dsl, food-chain, forth, hangman, list-ops, paasio)
  as refused with "no output", which names the symptom but not the cause; that
  has to become a real reason before the corpus is reproducible.

**Not usable here, and why** (*confirmed*): EDIT-Bench runs its tests "inside
the docker container". Terminal-Bench/Harbor offers docker (the default) and
cloud sandboxes;
its other local runtimes (Podman, Apple Container, Singularity) are containers
too, so there is no container-free mode. BigCodeBench's
`eval/utils.py` calls `signal.setitimer`, `os.setsid` and `resource.setrlimit`
with no Windows guard. tau-bench is MIT, installs with `pip install -e .`, needs
an LLM user simulator (gpt-4o by default), is not a coding benchmark, and is
marked superseded. SWE-bench-Live/Windows (66 instances, 48 repos, 9 languages,
MIT) is a candidate, but whether it needs Windows containers is not known.

**mini-swe-agent head-to-head.** mini-swe-agent 2.4.6 is installed at
`D:/harness-work/mini-swe`. Its `LocalEnvironment` runs actions with
`shell=True` (`environments/local.py:76`), which is cmd.exe on Windows, so the
driver `D:/harness-work/mini-swe-h2h/run_polyglot.py` subclasses it to run each
action through Git's `bash.exe -c`. It writes a report in atlias's own result
shape, and `atlias compare poly-A.json mswe-smoke.json` accepted it and paired
the one shared task by id. *Confirmed.* So far only the one-task smoke run
exists.

## What the edit-application front found

- **Whole-file output applies far more reliably than search/replace for small
  models.** Aider polyglot, 225 tasks: Qwen2.5-Coder-32B-Instruct scored **8.0%
  in `diff` (71.6% well-formed, 148 malformed)** and **16.4% in `whole` (99.6%
  well-formed, 1 malformed)**; gpt-4o-mini 3.6%. On Aider's older 133-task
  Exercism-Python edit benchmark, Qwen2.5-Coder-7B-Instruct scored 57.9% and
  14B 69.2% (pass rate within two tries), both `whole`, both 100% well-formed.
  *Confirmed* (Aider's
  `polyglot_leaderboard.yml`, `edit_leaderboard.yml`). SWE-Edit: "GRPO training
  on Qwen3-8B with an adaptive find-replace/whole-file-rewrite policy improves
  edit success by 12.5 pp". *Confirmed* (arXiv 2604.26102).
- **Lenient application matters.** Aider measured that turning flexible
  patching off gave a "9X increase in editing errors", and removing high-level
  diff prompting a "30-50% increase". *Confirmed* (aider.chat
  2023/12/21/unified-diffs); the page does not tie either number to a named
  model. Aider's `editblock_coder.py` tries `perfect_or_whitespace`, then
  spurious blank lines, then `try_dotdotdots`; its edit-distance fallback sits
  behind a bare `return` and never runs. *Confirmed.*
- **A failed edit is expensive in itself.** SWE-agent with GPT-4 Turbo: 51.7% of
  trajectories had at least one failed edit; the chance of an edit eventually
  succeeding was 90.5%, falling to 57.2% after a single failure; its edit-time
  linter moved SWE-bench Lite from 15.0% to 18.0%. *Confirmed*
  (arXiv 2405.15793). Anthropic's text editor reference implementation returns
  only "Error: No match found" and "Error: Found {count} matches". *Confirmed.*
- **Do not offer udiff/apply_patch to a 7B.** Diff-XYZ: Qwen2.5-Coder-7B-Instruct
  generating a udiff reached exact match 0.03, apply rate 0.19, parse rate
  0.70; across formats, 7B exact match was 0.28 for search-replace, 0.06 for
  udiff, 0.00 for udiff-l, and 32B was 0.68 against 0.23. "Handling diff syntax
  and formatting requires substantially more capacity than simply applying
  edits." *Confirmed* (arXiv 2510.12487, Tables 4-5). OpenAI says GPT-4.1 was
  extensively trained on the V4A patch format, which is a property of that
  model, not of the format. *Confirmed.* Hashline (hosted models only): "patch
  is the worst format for nearly every model", hashline beat patch in 14 of 16
  models, Grok Code Fast 1 went from 6.7% to 68.3%, and patch failure was 50.7%
  for Grok 4 and 46.2% for GLM-4.7. *Confirmed* (stencil.so/blog/the-harness-problem).
- **Structural addressing, measured on local models.** A 2026 R-language study
  with Ollama models found local-model correctness on 100+ line files "roughly
  triples" when edits are anchored, qwen2.5-coder going from 0.099 to 0.339.
  Exploratory, R only. *Confirmed* (arXiv 2607.12713).
- **Fast-apply models.** Morph reports 98% accuracy at about 4,500 tokens/s and
  Claude search-replace at 86% on its own comparison page; Relace reports about
  a 4% mistake rate against 10-11% for large generic models. *Confirmed as what
  the vendors say*; they are vendor numbers, not independent ones.
- **Refuted:** "ollama qwen2.5-coder:7b-instruct-q8_0 51.9%" on Aider's edit
  leaderboard. No such entry exists. The closest Ollama Q8_0 7B entry,
  `ollama/Qwen2.5.1-Coder-7B-Instruct-GGUF:Q8_0-32k`, scored 63.9%. The 51.9%
  belongs to the 32B fp16 model at a 2k context, in `quant.yml`.

In atlias itself (*confirmed* against the source): `old_string === new_string`
returns "old_string and new_string are the same; nothing would change"
(`lib/loop.mjs:1039`) and counts as a dead edit; `maxBadReplies` defaults to 3
(`lib/loop.mjs:1274`); `guardedWrite` starts at `lib/loop.mjs:769`; the edit
ladder is at about 1030-1101.

## What the small-model front found

- **Code inside JSON hurts.** Aider found every model it tested (Sonnet 3.5,
  DeepSeek Coder V2, both GPT-4o versions) did worse returning code inside JSON,
  and strict JSON mode did not help GPT-4o. *Confirmed* qualitatively; the
  per-model numbers are in a chart the verifier could not read. Natural-language
  tool selection beat JSON by 18.4 points with 70% less variance (10 models,
  6,400 trials; arXiv 2510.14453), and a replication measured 62.3% against
  47.4% over 14 models and 8,560 trials, with Mistral-7B at 39.4% against 0.0%
  and Llama-3.1-8B at 47.8% against 32.9% (arXiv 2607.03953). *Confirmed.*
  atlias's `edit_file` and `write_file` carry multi-line code as JSON strings
  (`lib/loop.mjs:40, 42, 144`). *Confirmed.*
- **Worked examples are the biggest prompt lever for very small models.**
  Meta-Tool, Llama-3.2-3B: 5-shot against 0-shot, both with documentation, 47.0%
  against 25.5% (+21.5); Gorilla 2% to 38%; documentation alone +5.0 (47.0
  against 42.0) (arXiv 2604.20148). Hsieh et al. found documentation alone on
  par with few-shot, on larger models (arXiv 2308.00675). atlias's text-mode
  prompt has exactly one example, a `read_file` call, and no edit example
  (`lib/loop.mjs:144`). *All confirmed.*
- **Long prompts cost small models most.** Reasoning accuracy fell from 0.92 to
  0.68 at 3,000 input tokens across five models (Levy et al., arXiv 2402.14848);
  prompt optimisation gained 11.2% at 1.5B against 2.4% at 32B (EffGen, arXiv
  2602.00887); fewer tools improved function calling on edge devices (arXiv
  2411.15399). *Confirmed.*
- **Masking a failed tool call's result hurts.** Removing error retention raised
  the error rate from 18.6% to 22.6% at Qwen3.5-4B and from 20.4% to 24.6% at 9B
  (arXiv 2606.00408). atlias's `view()` (`lib/loop.mjs:1230-1248`) masks by
  position alone, so an edit refusal is elided like any stale read.
  *Confirmed.*
- **Sampling.** atlias hardcodes temperature 0.2 for both engines
  (`lib/loop.mjs:1436, 1468`). Qwen2.5-Coder-7B-Instruct's own
  `generation_config.json` is temperature 0.7, top_p 0.8, top_k 20, repetition
  penalty 1.1. Qwen3's card: "DO NOT use greedy decoding, as it can lead to
  performance degradation and endless repetitions", with presence_penalty 0-2
  against repetition. Temperature 0.0-1.0 had no significant effect on
  multiple-choice problem solving (arXiv 2402.05201; not agent loops). *All
  confirmed.* SWE-Gym's Table 3 has zero-shot stuck-in-a-loop rates of 47.0% and
  29.4%, read by the research agent as the 7B and the 32B; the verifier matched
  both numbers but its fetch labelled them as the Lite and Verified splits, so
  which model each belongs to is not settled.
- **Where a 7B sits.** SWE-Gym zero-shot under OpenHands: Qwen2.5-Coder-7B 1.0%
  of SWE-bench Lite and 1.8% of Verified; 14B 2.7%/4.0%; 32B 3.0%/7.0%; 7B
  fine-tuned on 491 trajectories 10.0%/10.6% (arXiv 2412.21139). *Confirmed.* So
  0/27 on polyglot for a 7B is roughly the expected floor.
- **Budgets ignore the window.** `outputBudget` 10,000 characters and
  `keepObservations`/`evictBlock` 4/4 (`lib/core.mjs:31`); `read_file`'s share
  is 3 (`lib/loop.mjs:362`), so one read can return 30,000 characters, more
  than the whole default window. *Confirmed.*
- **The default model cannot call tools.** atlias's default `ollamaModel` is
  gemma3:4b (`lib/core.mjs:31`), whose capabilities on this machine are
  `completion, vision` with no `tools`, and whose Modelfile defaults are
  temperature 1, top_k 64, top_p 0.95. atlias sends no `keep_alive`; the server
  runs `OLLAMA_KEEP_ALIVE:5m0s`, `OLLAMA_NUM_PARALLEL:1`. *Confirmed.*
- **Native tools on Ollama are unreliable for qwen2.5-coder**: tool calls come
  back as JSON in `content` (ollama#12174, cline#14453). qwen2.5-coder:7b does
  list the `tools` capability. BFCL V4 found small models (Llama-3.1-8B,
  BitAgent-8B) drop significantly under XML-style tool syntax, and JSON or
  Python return formats beat XML. Gemma on Ollama loops when tool results come
  back as role `tool` (litellm#28530, adk-python#5650). atlias's text mode sends
  tool results as role `user` (`lib/loop.mjs:1383`). *All confirmed.* Keeping
  `native: false` for Ollama (`lib/agent.mjs:82`) is right for now.
- **Ollama's `/v1` endpoint cannot set the context size** and does not implement
  `tool_choice`; atlias's `openaiChat` always sends `tool_choice: 'auto'`
  (`lib/loop.mjs:1437`). A user pointing the openai engine at Ollama's `/v1`
  gets 4096 with no way out. *Confirmed.*
- **Code as action** (CodeAct): GPT-4 74.4% against 53.7% on M3ToolEval in 5.5
  against 7.7 turns; Llama-2-7B-chat 28.8% against 11.3% on API-Bank, but
  Mistral-7B 2.5% against 3.0%. Programmatic tool calling matched or beat native
  JSON in 11 of 14 models on BFCL v4 (arXiv 2402.01030, 2608.06370).
  *Confirmed.* Mixed at 7B; not a default without a paired result.
- **Constrained decoding is contested.** Format restrictions degraded reasoning
  in "Let Me Speak Freely?" (arXiv 2408.02442); dottxt's rerun on Llama-3-8B
  had structured slightly ahead (GSM8K 0.78/0.77, Last Letter 0.77/0.73,
  Shuffle 0.44/0.41). *Confirmed.* Only worth trying as a retry rung.

## What the context front found

- **Claude Code's hook contract** (*confirmed*, code.claude.com/docs/en/hooks
  and /context-window): PreCompact can only block; PostCompact has "no decision
  control" and receives `compact_summary`; neither is on the list of events
  that deliver `additionalContext`. After compaction the docs re-inject
  project-root CLAUDE.md, auto memory and the plan, re-read up to five recent
  files (over 5,000 tokens comes back as a path), cap skill bodies at 5,000
  tokens each and 25,000 total, summarise "context that hooks added earlier"
  with the rest, and re-run SessionStart hooks matching `compact`. **atlias
  consequence, read by me:** `progress.preCompact` and `progress.postCompact`
  (`lib/progress.mjs:56-68`) put their text in `additionalContext` on exactly
  the two events the docs say do not deliver it. The working path is
  `brief.sessionStart`, which re-injects the handoff note after a compact
  (`lib/brief.mjs:57`). Whether the two dead returns are really discarded is
  documented, not yet tested live.
- **Codex keeps the user's words.** `compact.rs` keeps user messages verbatim,
  newest first, up to `COMPACT_USER_MESSAGE_MAX_TOKENS = 20_000`, re-injects the
  initial context just before the last real user message, and prefixes the
  summary "Another language model started to solve this problem...". Its
  prompt is a four-bullet "CONTEXT CHECKPOINT COMPACTION". *Confirmed.* Claude
  Code's `/compact` on Sonnet 4.6 kept safety-rule recall at 53% after one round
  and 10% after five ("The Compaction Cliff", arXiv 2608.22752). HANDBOOK.md:
  20-124 page policies, 824 rubric items, the best model 36.2% under strict
  grading, agents that "lose rule details over long horizons, and report
  compliance they did not achieve" (arXiv 2607.25398). *Confirmed.*
- **Masking against summarising.** The Complexity Trap (SWE-bench Verified):
  masking "halves cost relative to the raw agent while matching, and sometimes
  slightly exceeding, the solve rate of LLM summarization": Qwen3-Coder 480B raw
  53.4% at $1.29, masking 54.8% at $0.61, summary 53.8% at $0.64; Gemini 2.5
  Flash raw 32.8% at $0.41, masking 35.6% at $0.18; masking kept the last 10
  turns; summarisation made trajectories about 15% longer (arXiv 2508.21433).
  AttnCompress had masking worst, 47.17% against 55.17% keep-all (arXiv
  2609.08318). Anthropic's context editing keeps 3 tool uses by default.
  *Confirmed.* atlias keeps 4, and nobody has measured either number for a 7B
  on a 16k window.
- **Cache discipline** (Manus): "KV-cache hit rate is the single most important
  metric for a production-stage AI agent"; input:output about 100:1; cached
  Sonnet tokens $0.30/MTok against $3; do not add or remove tools mid-run, mask
  them. Anthropic's tool search "doesn't break prompt caching because deferred
  tools are excluded from the initial prompt entirely" and took Opus 4 from 49%
  to 74% and Opus 4.5 from 79.5% to 88.1% with 85% fewer tokens. Claude Code's
  scoped deny rules are checked at call time, "leaving the prefix intact".
  *Confirmed.* In atlias `hasGraph` is recomputed each `runLoop` call while the
  text-mode prompt is built once (`lib/loop.mjs:1260-1261`), so a graph that
  appears mid-session changes the native tool list and makes the text-mode
  prompt and the available tools disagree (read by me).
- **Rewriting context destroys it.** ACE on AppWorld: 18,282 tokens at 66.7
  accuracy collapsed in one step to 122 tokens at 57.1, below the 63.7
  no-adaptation baseline; incremental deltas gave +10.6% on agents and +8.6% on
  finance, 12.3 and 11.9 points over ICL and GEPA (arXiv 2510.04618). Manus:
  "leave the wrong turns in the context". *Confirmed.*
- **Memory tools.** Anthropic's memory tool adds "IMPORTANT: ALWAYS VIEW YOUR
  MEMORY DIRECTORY BEFORE DOING ANYTHING ELSE" and "ASSUME INTERRUPTION: Your
  context window might be reset at any moment" to the system prompt; memory plus
  context editing +39%, context editing alone +29%, 84% fewer tokens over 100
  turns (vendor-internal). *Confirmed.*
- **Up-front context.** Evaluating AGENTS.md (arXiv 2602.11988): context files
  "do not generally improve task success rates, while increasing inference cost
  by over 20% on average". *Confirmed*; see the refuted part below. A second
  study (arXiv 2607.27250, 17 tasks, 288 runs): context strategy "does not
  measurably move correctness on either agent (bounded to <=10-15pp via
  equivalence testing)". RAG-MCP: tool selection 13.62% to 43.13%. *Confirmed.*
  atlias's `projectInstructions` puts up to 6,000 characters of instructions
  into every terminal-agent system prompt (`lib/loop.mjs:99`).
- **Sub-agents.** Anthropic's multi-agent research system beat single-agent
  Opus 4 by 90.2%; token usage alone explains 80% of BrowseComp variance (95%
  with tool calls and model); agents use about 4x the tokens of chat and
  multi-agent systems about 15x; sub-agent summaries are "often 1,000-2,000
  tokens". Cognition: "actions carry implicit decisions, and conflicting
  decisions carry bad results"; reviewers work best when "the coding and review
  agents do not share any context beforehand"; Devin Review catches about 2 bugs
  per PR, roughly 58% severe. Context-Folding matches or beats ReAct with "10x
  smaller" active context (arXiv 2510.11967). *Confirmed.*
- **Context disclosure** cuts both ways. Sonnet 4.5+ gets
  `<system_warning>Token usage: 35000/200000; 165000 remaining</system_warning>`;
  Cognition saw "context anxiety", shortcuts near a perceived end of window, and
  added reminders "both at the beginning and the end of the prompt".
  *Confirmed.*
- **Lost in conversation.** Across 200,000+ simulated conversations, a 39%
  average drop when a specification arrives over several turns; models "get
  lost and do not recover" (arXiv 2505.06120). *Confirmed.*
- **Compression tuned from failures.** ACON cut peak tokens 26-54% while
  improving success, up to 46% for small models after distillation (arXiv
  2510.00615); SWE-Pruner, a 0.6B skimmer, 23-54% fewer tokens on SWE-bench
  Verified "while even improving success rates" (arXiv 2601.16746).
  *Confirmed.*

## Refuted

- **"Ollama qwen2.5-coder:7b-instruct-q8_0 scored 51.9%" on Aider's edit
  leaderboard.** No such entry. The closest, `Qwen2.5.1-Coder-7B-Instruct-GGUF:Q8_0-32k`
  on Ollama, scored 63.9%. 51.9% is the 32B fp16 model at 2k context.
- **"LLM-generated AGENTS.md files reduced success by about 3%."** The paper
  reports 0.5% (SWE-bench) and 2% (its own benchmark), and says neither drop is
  statistically significant (p = 0.87 and 0.37).

## A correction to round three

NEXTGEN-3 states as fact that "rule violations went from 0% to 30% after
compaction, 0% when the rule survived the summary, 38% when it was dropped, and
pinning restored 0%", and ranks item 1 on it. This round's verifier fetched the
same paper (arXiv 2608.22752) and **could not find a 0-to-30% violation figure
in it**; the 53%/10% recall figures are there. Until someone finds the number in
the paper, the 53%/10% recall is the measured basis for pinning invariants, and
the violation figures should not be quoted.

## Ranked, what to build next

Each item names the measured problem it attacks, the expected effect and where
that expectation comes from, the files, and the check that proves it. The first
three are ordered by dependency: nothing after item 1 can be measured honestly
until item 1 lands, and no A/B can show anything until item 2 exists.

**1. Context integrity on Ollama.** *Attacks:* 0/27 and the 66% apply failure,
both measured with a window that drops the task first.
*Expected effect:* on the same engine, Aider's 32B went from 51.9% to 71.4%
and from 46.2% to 90.2% well-formed edits when the window was fixed
(confirmed). What it does for a 7B is unmeasured; the well-formed-edit rate is
the number to watch.
*Build:* `options.num_ctx` on every `/api/chat` request, from a new
`agent.ollamaNumCtx` (default 16384; capped at the model's `context_length`
from `/api/show`), bucketed so the model is not reloaded each turn;
`options.num_predict` bounded (2048) with `num_ctx >= prompt + num_predict`;
`keep_alive` on eval runs; `truncate: false`, so an overflow comes back as an
error with a token count instead of a silent cut; a new stop reason
`context-full` / `engine-truncated` when the engine says the prompt did not fit,
instead of filing it under malformed-output; `prompt_eval_count` per round
written into the eval result, and `num_ctx` in the stamp. When `openaiUrl`
points at a local Ollama, warn that `/v1` cannot set the context.
*Files:* `lib/loop.mjs` (`ollamaChat` 1465-1477, `STOP_REASONS` 572,
`countCache` 522-530), `lib/core.mjs` (DEFAULTS.agent, line 31),
`lib/eval.mjs` (`runTask` result, `harnessStamp`), `test/agent-suites.mjs`,
`test/eval-suites.mjs`.
*Check:* unit: a fake `post` sees `num_ctx`, `num_predict` and `truncate:false`
in the body; a fake over-limit error ends the run as `engine-truncated`, not
`malformed-output`. Live: a codeword placed in the first user message of a
~23k-character conversation is answered correctly. Then **poly-B**: poly-A with
this as the only change, `--save`, `atlias compare poly-A.json poly-B.json`,
and the editWhy tally beside it.

*Status: BUILT in d1b585e (2026-09-25), suite 843/843.* Before any code was
written, I probed ollama 0.34.3 on this machine at num_ctx 512
(`D:/harness-work/runs/probe-truncate.txt`). With the old request shape, a
2137-token prompt came back as a 200 that had evaluated **23** tokens, and the
model did not know the codeword. With `truncate:false`, the same request came
back as HTTP 400 `exceed_context_size_error`, "request (2137 tokens) exceeds the
available context size (512 tokens)". The overflow parser is tested against
that exact body. What landed:
`options.num_ctx` (setting `agent.ollamaNumCtx`, default 16384, capped at the
`.context_length` from `/api/show`; a failed show is asked again rather than
cached); `options.num_predict` (`agent.ollamaNumPredict`, 2048); `truncate:false`;
`keep_alive` (`agent.ollamaKeepAlive`; eval sets 30m when unset). The window
moves only in powers of two (`ctxBucket`). An overflow that still fits the
model grows the window once and retries. After a reply, the window grows when
prompt + num_predict no longer fits. An overflow past the model's trained
length stops the run as the new reason `context-full` (the name chosen over
"engine-truncated", because nothing is truncated any more). Each round's
`prompt_eval_count` goes into the eval row as `promptTokens` and `peakPrompt`,
the window goes in as `numCtx`, and the report header prints "context N tokens,
largest prompt M". `v1ContextWarning` warns when the openai engine is pointed at
Ollama's `/v1`.
*Deviations from the plan above:* `num_ctx` is recorded in the report beside
engine and model, not in the harness stamp, because the stamp identifies code
and the window is a run setting that can grow during a run. The REPL builds a
new engine each turn, so each turn starts again from the configured window,
and an overflow costs one extra request there.
*Live check, passed:* `D:/harness-work/runs/probe-codeword.txt`, from
qwen2.5-coder:7b on ollama 0.34.3. The codeword was at the start of the first
user message of a 23,090-character conversation. With the request shape 3.6.0
sent, the engine evaluated **61** prompt tokens and the model answered "Echo".
Through the new `ollamaChat`, it evaluated **9,783** tokens at num_ctx 16384 and
answered "ZEPHYR-7731". The first three attempts could not load a model at all
(C: had reached 0 bytes free: "out of memory allocating heap arena map", then
"unable to allocate CUDA_Host buffer", then "PTX JIT compilation failed"). The
old-shape request failed in the same way, and the check passed once the disk
had room again. *Still owed:* poly-B. Behaviour on Ollama versions other than
0.34.3 is UNVERIFIED, and a server that ignores `truncate` would still cut
silently.

**2. A corpus where the baseline is off the floor.** *Attacks:* 0/27, which
makes every A/B powerless (six one-way flips needed; power 0.05-0.27 at N=27).
*Expected effect:* Qwen2.5-Coder-7B scored 57.9% on Aider's 133-task
Exercism-Python edit benchmark (confirmed), so single-function fixes and short
instruction edits should put a 7B in the 30-70% band where flips can happen.
That is an expectation, not a measurement, until the tiers are run.
*Build:* converters in the pattern of `lib/polyglot.mjs` (every task proved to
fail as shipped and pass with the reference, on this machine, or refused with
the reason): **CanItEdit** 88 sound tasks as `evals/canitedit` in two variants,
`instruction_lazy` and `instruction_descriptive` (`main.py` plus a protected
`test_main.py`, check `python test_main.py`); **HumanEvalFix** Python 164 and
JS 163 as `evals/humanevalfix`, with the throwing `console.assert` prelude in
the protected JS test file; later, the ~60 **refactor-benchmark** tasks whose
source is under about 40 KB (the research agent's threshold, not a sourced
one), with the standalone AST verifier as a protected file. Also: a partial
score (fraction of test cases passed, parsed from the check output), and a real
refusal reason for the seven polyglot exercises that currently say "no output".
*Files:* `lib/canitedit.mjs`, `lib/humanevalfix.mjs` (or one generic
JSONL-benchmark converter), `bin/atlias.mjs` (subcommands beside `polyglot`),
`lib/eval.mjs` (partial score), `evals/`, `test/eval-suites.mjs`.
*Check:* the converter reproduces the soundness counts measured here (88, 164,
163) and refuses the 17 broken CanItEdit ids and `JavaScript/162` by name; an
`--engine echo` dry run scores 0 on every task (nothing passes without work).

*Status: BUILT (converters, hidden grader files, the polyglot refusal reason) in
`750e122`; results below.* One generic
module, `lib/editbench.mjs`, and one subcommand,
`atlias editbench <rows.jsonl> --bench canitedit|humanevalfix [--variant
lazy|descriptive] [--lang python|js]`. It reads the dataset as JSONL (what the
Hugging Face `datasets` library writes with `to_json`) and proves every task
with the polyglot converter's own `proveTask`.
*A change the plan did not name, found on contact with the code:* CanItEdit
hides its tests upstream, and the plan's "protected `test_main.py`" would have
shown them to the model, which is a different and easier benchmark. So tasks
can now carry `hidden` files: `runTask` writes them into the workspace only
after the model stops, over anything of the same name the run left behind, and
`proveTask` writes them the same way. The model gets `main.py` and the
instruction, nothing else. The grader runs the program and its tests as one
module registered as `__main__`, as upstream runs them as one file, because
tests may use a name the program keeps private (checked: a `_secret()` helper).
HumanEvalFix shows its tests upstream, so there they are a visible, protected
`tests.py`/`tests.js` beside a protected runner; the JS test file starts with
the throwing `console.assert` prelude.
*The seven polyglot "no output" refusals, explained:* re-run alone on
2026-09-25, all seven (dominoes, dot-dsl, food-chain, forth, hangman, list-ops,
paasio) fail as shipped in the normal way, with pytest counts. The first
conversion's refusal came from `proveTask` dropping the spawn error of a run
that returned no status. It now keeps that error in the reason, asks a
statusless run once more before judging it, and treats a stub that hangs until
the timeout as failing as shipped (only a runner that cannot start is a
refusal).
*Finished on 2026-09-25 in `fae41e8` (the tiers and the big-file tier) and
`3a56d8b` (the partial score), suite 910/910.* What the converters were missing
was that nothing could name a tier, so poly-A stayed the only number anybody ran
end to end.

- **The tiers exist and run** (`lib/tiers.mjs`, `atlias tiers`,
  `atlias eval --tier smoke|main|big`). smoke is the nine shipped tasks (9
  here), main is HumanEvalFix Python 164 plus CanItEdit lazy 88 (252 here), big
  is the refactor benchmark (57 here). A tier that is not on the machine says so
  and prints the command that regenerates it, rather than scoring 0 of 0 and
  looking like a clean run; two tasks sharing an id are reported, because
  `compare` pairs by id. `--sample N --seed s` takes the same subset on every
  machine and in both arms of an A/B (sorted by id, seeded shuffle, sorted
  again), and the report carries the tier, the count and the seed, so a saved
  arm says what corpus it scored.
- **The big-file tier is built** (`lib/refactorbench.mjs`,
  `atlias refactorbench`): Aider's refactor benchmark, real source files, one
  method to move out of its class. The grader is that benchmark's own AST rule
  inlined into a hidden Python file, so it needs neither the `aider` package nor
  Django or TensorFlow importable, and the node counts it measures are not in
  front of the model. *A change the plan did not name:* the benchmark ships no
  answer key, so the reference is built by moving the method mechanically
  (its own source lines, dedented, appended at module level), which makes the
  node counts identical rather than within the 10 per cent the grader allows.
  **57 of 89 proved here**: 31 source files are over the 40 KB default cap
  (`--max-bytes` raises it; the largest in the benchmark is 1.1 MB, which no
  local window can hold), and 1 is refused because the mechanical move cannot be
  made - `generator.py`'s method body holds a triple-quoted string with text at
  column zero, so `textwrap.dedent` has no common indent to remove and the moved
  block rejoins the class it came from. That file still parses, so the mover now
  checks that the function is a statement of the module, not only that the
  result parses.
- **The partial score is built** (`caseCounts`): the counts out of pytest's
  summary line and unittest's "Ran N tests", read before the output is clipped,
  printed per failing task and totalled over the tasks whose check reports them.
  It is never part of the verdict. The two main-tier benchmarks run one
  assert-based script that stops at the first failure, so they report no
  fraction at all rather than a fabricated 0 of 1 - which means partial credit
  helps on polyglot and the refactor tier's own output, not on the main tier.
- **HumanEvalFix JavaScript converted after all**: 163 of 164, refusing
  `JavaScript/162` by name, which is the count this document measured. It is not
  in a tier - the tiers stay three - but `atlias eval --corpus evals/humanevalfix/js`
  runs it. What made it slow enough to look stuck is worth recording: a buggy
  stub that loops forever costs three proof attempts, each retried once, at the
  task's 60-second timeout.
- **The generated corpora are not in git**, and `evals/CORPORA.md` is: every
  dataset URL, licence, expected count and regeneration command. CanItEdit hides
  its tests upstream and this harness keeps them hidden, so a plain-text copy of
  them does not go into a public repository where it is crawled and eventually
  trained on - the CanItEdit licence on GitHub forbids exactly that use, while
  its Hugging Face card says MIT, and keeping the generated copy out is the
  reading that respects both. `evals/polyglot` stays tracked, because Exercism
  ships its test files in the open.

*Verified here, not argued:* `atlias eval --tier main --engine echo` scored
**0 of 252 in 450 s** (nothing passes without work, and every one of the 252
graders ran), `--tier big --sample 4 --engine echo` scored 0 of 4 with the AST
grader naming "is not a top level function" on each, and the grader was checked
against the three ways this tier can be cheated: a method copied to the top
level while the class keeps its own is refused on the class's node count, a
one-line stand-in for the moved body is refused on the function's, and a file
left unparseable is a failure with the syntax error rather than a crash.

*The first real slice, and what it says about the expectation above.* `atlias
eval --tier main --sample 8 --seed nextgen4 --engine ollama` (qwen2.5-coder:7b,
`D:/harness-work/runs/main-slice-A.json`) scored **0 of 8 in 373 s** at num_ctx
16384 with a largest prompt of 3,687 tokens. So the expectation that this tier
puts a 7B in the 30-70 per cent band is **not confirmed**, and this document
will not pretend otherwise on eight tasks - the Wilson interval on 0 of 8 is 0
to 32.4 per cent, which does not even exclude the band. What the run does say,
because the counters now exist:

- **10 of 17 edits never applied (59 per cent)**, causes `not-found 4`,
  `same-text 3`, `empty-old 1`, `no-file 1`, `would-not-parse 1`. The apply rate
  is the same shape of failure poly-A had, on a corpus of one-function edits
  where the whole file fits the window with room to spare. That is item 4 and
  item 5, and it is now measurable on a tier that is not the floor for context
  reasons.
- **The context window is no longer the binding constraint on this tier**: the
  largest prompt of the whole slice was 3,687 tokens against a 16,384-token
  window, so whatever is failing here is not the truncation item 1 fixed.
- **Five of eight runs ended `rounds-exhausted` at 8 rounds**, which was the
  HumanEvalFix converter's budget. A tier where most runs are cut off is
  measuring the budget, so that default is now 14 (with `--rounds` on the
  converter to set it, and `atlias eval --rounds N` to override every task's
  budget for one run and say so in the report). While it was 8, the report
  header printed the machine's `agent.maxToolRounds` of 25 beside runs that were
  cut off at 8 - a number a reader would have used to judge them. The header now
  prints the spread the tasks actually ran on.
- **Two tasks died with Ollama's "model runner has unexpectedly stopped"** on a
  loaded machine. Re-run alone, as the rule requires, both ran normally (one to
  `malformed-output` at 8 of 12 rounds, one to a failing check), so the crash was
  the machine, not the corpus - and the run is still 0 of 8 either way.

All four of those went in with `4adae41`, along with one more thing the slice
exposed: a stub that runs until the timeout was being asked again three times
(the repeat exists for a check that decides by timing and can pass by chance),
which is six spawns at a 60-second timeout - six minutes for one task, and the
reason a 164-task conversion looked wedged. A stub that fails quickly is still
repeated.

*Still owed from this item:* nothing in the build. The honest measurement of
whether this tier is off the floor needs a slice large enough to mean something,
after items 4 and 5, and it belongs to the measure stage rather than here. The
seven polyglot "no output" refusals were explained above; the refactor tasks over
40 KB are a setting, not a gap.

**3. A comparator that says what it cannot see.** *Attacks:* A/B/C being read as
results. *Expected effect:* no score change; stops false claims (confirmed
guidance from arXiv 2503.01747).
*Build:* in `formatCompare`, the minimum-detectable line ("6 one-way flips are
needed for p < 0.05; this corpus has N tasks and M disagreements"); a Wilson
interval per arm; a paired Bayesian interval on the discordant split (Beta
posterior on b/(b+c)); the bootstrap labelled unreliable below about 100 tasks;
with `--repeat`, pairing on each task's pass fraction and a sign or permutation
test over tasks, never over attempts.
*Files:* `lib/eval.mjs` (`compare` 324-353, `formatCompare` 355), `bin/atlias.mjs`
(`compare`), `test/eval-suites.mjs`.
*Check:* Wilson on 0/27 prints 0.0 to 12.5, on 3/9 12.1 to 64.6 (worked here);
the flip line prints 6 at alpha 0.05; poly-A against itself still prints p =
1.000; a repeated run with fractions 2/3 against 1/3 on one task is one
disagreement, not two.

*Status: BUILT in `b7f01c4` (2026-09-25), suite 879/879 at that commit.* Every
check above passes, and `atlias compare poly-A.json poly-A.json` was run to see
it on the real file: 0/27 against 0/27, "McNemar exact p = 1.000 on 0
disagreement(s)", "Minimum detectable: 6 one-way flips are needed for p < 0.05;
this corpus has 27 task(s) and 0 disagreement(s), so no p below 0.05 was
reachable however the tasks fell", "Wilson 95 per cent interval on the pass
rate: 0.0 to 12.5" for both arms, and the bootstrap now carries "unreliable
below about 100 tasks (this corpus has 27); the paired interval above is the one
to read".
*Deviations from the plan above:* the paired interval uses a Beta posterior with
the Jeffreys prior on the discordant split, read back as a difference in pass
rate by scaling `2*theta - 1` by the discordant share - that is the paper's
recommendation implemented directly rather than through `bayes_evals`, and the
incomplete beta and its inverse are in `lib/eval.mjs` (`betaCdf`,
`betaQuantile`) so there is no new dependency. The sign test over tasks is the
same exact binomial tail as McNemar, so `mcnemar` computes both and only the
wording changes with `--repeat`; `formatCompare` then says "Paired sign test over
tasks" and names the pass fraction, because a reader who thinks a repeated run
was tested attempt by attempt will read the p as far stronger than it is.
*What it still cannot do:* it pairs on pass fraction, not on partial credit, so a
change that moves a task from two of eight test cases to seven of eight is
invisible to the verdict. The partial score from item 2 is printed beside it, not
tested on.

**4. Repair before refusing an edit that will not parse.** *Attacks:* the 66%
apply failure. In the edit front's local run, 18 of 35 failed edits were
would-not-parse and only 3 were not-found (a local measurement nobody re-ran;
see below), which would explain why a matching ladder moved the rate only 3
points.
*Expected effect:* Aider's flexible patching is worth a ninefold difference in
edit errors (confirmed); SWE-agent's success after one failed edit falls from
90.5% to 57.2% (confirmed), so avoiding the first failure matters most. Keep
the parse guard: SWE-agent measured its linter at +3.0 (confirmed).
*Build:* in `edit_file`, before `guardedWrite` refuses: when `old_string`
matches inside a line whose surroundings are whitespace, widen to whole lines
and re-base `new_string` onto that line's indentation (a few candidates, keep
the first the syntax check accepts); when `new_string` repeats the line's
non-whitespace prefix ("def " + "def build_tree"), replace the whole line. Say
in the result that it was re-indented, and tally it as editWhy `reindented`.
When nothing parses, show the numbered lines around the parse error.
*Files:* `lib/loop.mjs` (`edit_file` ~1030-1101, `guardedWrite` 769,
`EDIT_FAILS` 656, `editFailKind`), `test/agent-suites.mjs`.
*Check:* fixtures built from the logged mechanisms: `old_string: "pass"` with a
`new_string` carrying a full line's indentation applies and parses; the doubled
`def` prefix applies; a comment-only function body is still refused. Then the
would-not-parse share in the editWhy tally falls on a rerun of the same tier.

**5. A no-op is not a strike, and a repeat changes the channel.** *Attacks:*
10 of 27 poly-A tasks ended malformed-output (counted by me); same-text refusals
count toward `maxBadReplies = 3`.
*Expected effect:* whole-file output was 99.6% well-formed against 71.6% for
search/replace at 32B on polyglot, and 100% in whole format at 7B and 14B on
Aider's Exercism-Python benchmark (confirmed); an adaptive
find-replace/whole-file policy was worth +12.5 points of edit success for
Qwen3-8B, though that came with GRPO training, not from the harness alone
(confirmed).
*Build:* `old_string === new_string` with the text present, or `new_string`
already present once, returns "already applied ... run the check now" and does
not count as a bad reply; a byte-identical repeat of a failed edit is not run
again; instead the harness answers with the current numbered file and asks for
the whole file through `write_file` (for files up to about 150 lines), and it
forces that switch once before the malformed-output stop fires. A whole-file
write that elides code ("... existing code ...") or halves the file without
saying so is refused.
*Files:* `lib/loop.mjs` (1039, the dead-edit and stall counting around
1350-1386, `maxBadReplies` 1274, `write_file`), `test/agent-suites.mjs`.
*Check:* the scripted-model suite: three identical same-text calls no longer
end the run; a second identical failed edit produces the switch message; the
malformed-output count on a rerun falls.

**6. A small-model prompt profile.** *Attacks:* fixed prompt bulk on a small
window, and the 7B's poor diff formats.
*Expected effect:* +21.5 points from worked examples at 3B (Meta-Tool);
compression helps a 1.5B 11.2% against 2.4% at 32B; fewer tools help small
models (all confirmed). Diff-XYZ says a 7B cannot write udiff (0.03 exact
match).
*Build:* for the Ollama engine and for evals: no `apply_patch` in the tool line
or the prompt, no skills index, no memory tools, one compact worked
`edit_file` example with a multi-line `new_string` in the exact escaping the
parser expects, and the system prompt's size printed in the eval header.
*Files:* `lib/loop.mjs` (`systemPrompt` 133-151, `TOOLS`), `lib/skills.mjs`
(`promptSection`), `test/agent-suites.mjs`.
*Check:* the profile's prompt contains no `apply_patch`, no skill names, and
exactly one edit example; paired A/B against the full prompt on the tier from
item 2 with `--repeat 3`.

**7. Keep the newest failure visible.** *Attacks:* identical retries after a
refusal. *Expected effect:* about 4 points of error rate at 4B and 9B from keeping
errors (arXiv 2606.00408, confirmed).
*Build:* in `view()`, exempt the most recent error result of each tool from
masking, or collapse it to a one-line "your last edit failed because X".
*Files:* `lib/loop.mjs` (`view` 1230-1248), `test/agent-suites.mjs`.
*Check:* after enough rounds to mask everything, the last edit refusal is still
in the view; repeated-failure streak length is reported per run.

**8. Honest defaults for local models.** *Attacks:* a default model that cannot
call tools, and greedy-ish sampling a model card warns against.
*Build:* change the default `ollamaModel` to one whose `/api/show` capabilities
include `tools`, or have `/doctor` warn; a per-model sampling profile from the
model card (qwen2.5-coder 0.7 / 0.8 / 20 / 1.1), A/B'd against 0.2 with
`--repeat 3`; derive tool output budgets from `num_ctx` for local engines so
one `read_file` cannot exceed the window.
*Files:* `lib/core.mjs:31`, `lib/loop.mjs` (1436, 1468, `budgetFor` 378-381),
`lib/hosts.mjs` (`doctor`, called by `atlias doctor`), tests.
*Check:* doctor names gemma3:4b as lacking tools; the sampling A/B is reported
through item 3's comparator, not by eye.

**9. Compaction that survives, and says what it lost.** *Attacks:* the two
hook returns that go out on events the docs say do not deliver context.
*Build:* remove or move the `additionalContext` in `progress.preCompact` and
`postCompact`; have PostCompact diff pinned rules and handoff identifiers
against `compact_summary`, append what was missing to the handoff note, and
re-inject only the missing ones through the next UserPromptSubmit (a documented
channel). In the terminal agent's `compact()`, keep user messages verbatim,
newest first, to a token budget, as Codex does.
*Files:* `lib/progress.mjs`, `lib/hooks.mjs`, `hooks/hooks.json`,
`lib/loop.mjs` (`compact`), tests.
*Check:* a PostCompact payload whose summary lacks a pinned rule yields that
rule in the next UserPromptSubmit output and nowhere else; a debug-log check
confirms whether PreCompact context ever reached the model.

**10. A per-round ledger in the eval report.** *Attacks:* poly-A kept no
transcripts, so its failures had to be re-run to be diagnosed.
*Build:* per round, the engine's prompt tokens, cached tokens, masked
observations and re-reads after masking; the arguments and result of every
failed edit.
*Files:* `lib/eval.mjs` (`runTask` 168-226), `lib/loop.mjs`.
*Check:* a saved report from the echo engine contains the ledger and a scripted
failed edit with its arguments.

**11. Freeze the tool set per session.** *Attacks:* a cache-breaking and
prompt-contradicting tool list when a graph appears mid-session (read in the
source; no measurement of its cost here).
*Files:* `lib/loop.mjs` (1260-1286). *Check:* a graph created mid-session
leaves the tool list unchanged, and `graph_query` is refused at call time with
a reason.

**Later, and only behind a paired result.** Line/hash-anchored
`replace_lines` and name-spliced `replace_function` (0.099 to 0.339 at
qwen2.5-coder in R, confirmed but exploratory); a non-JSON edit channel
(SEARCH/REPLACE or a whole file in a plain fence), from the NLT results; a
retry-with-grammar rung using Ollama's `format` schema after a parse failure
only; a read-only exploration fold for the terminal agent (Context-Folding);
`keepObservations` 4 against 10; a harness-side ACON loop that tunes the output
rules from pairs where masking lost. A fast-apply model only if items 4-5 leave
the failure rate above one in ten.

## Where atlias could be first

Items 1-4 are the context front's: it searched for them and did not find them
shipped anywhere. Item 5 is from round three. Absence cannot be proven, so treat
the novelty as unverified; the mechanisms rest on confirmed facts.

1. **Context-integrity verification.** No harness found checks the engine's
   reported prompt tokens against what it sent, although Ollama cuts the front
   silently. Item 1's `engine-truncated` stop reason is that check.
2. **A compaction-survival audit.** Claude Code hands PostCompact the
   `compact_summary`; nothing found uses it to report which invariants the
   summary lost. Item 9 would give atlias its own measured compaction cliff
   instead of a paper's.
3. **A per-round context ledger in engine-counted tokens** (item 10).
4. **`atlias doctor --context <model>`**: run the codeword probe at rising
   lengths with `truncate: false` and record the largest window that holds the
   needle, as that model's effective `num_ctx` and compaction limit, measured on
   this machine rather than read off a spec sheet.
5. **A measured break-even for delegation on coding work.** NEXTGEN-3 already
   recorded that nobody has published one.

## How the benchmarks and the head-to-head will be used

- **HumanEvalFix** is the smoke and tripwire tier. Single-function bug fixes
  measure the model more than the harness, so it is where a broken loop shows
  up fast, not where a harness claim is made.
- **CanItEdit** (88 tasks, lazy and descriptive) is the main harness tier: edits
  to existing code from an instruction, which is exactly atlias's edit path. The
  gap between the lazy and descriptive variants is a harness-sensitive signal
  in its own right.
- **refactor-benchmark** is the big-file tier, aimed straight at the apply
  failure: large edits to large files are where edit-format and elision
  failures appear. Every run reports the editWhy tally per task.
- **Polyglot** stays for stronger models and remote engines, where 0/27 is not
  the floor. The seven refused Python exercises get a real reason, and the 49 JS
  exercises (one shared `node_modules` on D:) are the cheap second language.
- **Protocol for every A/B:** `num_ctx` fixed and stamped (item 1), a corpus
  calibrated to a 30-70% baseline (item 2), `--repeat 3`, `--save` on both
  arms, and `atlias compare` with item 3's power line. A result with fewer than
  six one-way flips is reported as "inside the noise", in those words.
- **mini-swe-agent head-to-head.** The same tasks, the same Ollama model, the
  same step budget, the same checks, no Docker:
  `cd D:/harness-work && PYTHONPATH=D:/harness-work/mini-swe MSWEA_SILENT_STARTUP=1 MSWEA_COST_TRACKING=ignore_errors MSWEA_GLOBAL_CONFIG_DIR=D:/harness-work/mini-swe-h2h/cfg python mini-swe-h2h/run_polyglot.py --tasks C:/Users/OWNER/atlias/evals/polyglot --out D:/harness-work/runs/mswe-A.json`,
  then `node bin/atlias.mjs compare D:/harness-work/runs/poly-B.json D:/harness-work/runs/mswe-A.json`.
  Compared on passes, characters moved and edit-applied rate, because at a 0/27
  floor cost is the only readable difference. It has to run against poly-B
  (item 1), not poly-A. The driver deliberately sets no `num_ctx`, to match
  atlias's call as it is today (`run_polyglot.py` line 10 says so), so once
  item 1 lands the driver must pass the same `num_ctx` in its `model_kwargs`;
  a head-to-head in which either side is truncated measures the window, not the
  harness. Whether LiteLLM adds a `num_ctx` of its own is UNVERIFIED. The same
  driver then runs on the CanItEdit and HumanEvalFix tiers once they exist. Caveat: mini-swe-agent counts model
  calls and atlias counts tool rounds; they are close, not identical. Only the
  one-task smoke run exists so far.

## Could not be verified

Local measurements that no second agent re-ran (plausible, consistent with the
confirmed code paths, and not facts until re-run):

- The edit front's 8-task diagnostic: 55 live edits, 35 failed (64%), causes
  would-not-parse 18, same-text 9, ambiguous 3, not-found 3, repeated 2; the
  replay in which a line-snap re-indent recovered 9 of 13 would-not-parse
  failures; byte-identical failed retries in 6 of 8 tasks; 5 of 5 `write_file`
  calls applied with a one-line steer.
- The context front's probe: without `num_ctx`, a 23,565-character conversation
  gave `prompt_eval_count` 53 and lost its codeword; with 16384 it gave 11,414
  and the right answer; with `truncate: false` an overflow returned HTTP 400
  `exceed_context_size_error` with `n_prompt_tokens` 5708 and `n_ctx` 4096. Also
  its count that 5 of 27 polyglot tasks exceed 4096 tokens after one read.
- `/api/ps` showing qwen2.5-coder:7b at 16384 from an unidentified client, and
  therefore poly-A's real effective window.
- The system prompt in a poly-A workspace: 3,847 characters, 1,263 of them a
  52-skill index (depends on the skills installed at the time).
- The estimate that about 21 of 27 poly-A transcripts exceed 4096 tokens
  (characters divided by 3.5-3.6, not a tokenizer count).
- Whether the 612 s zebra-puzzle timeout came from contention with the RideLink
  worker on the one Ollama slot.

Source claims the verifiers could not confirm:

- The Compaction Cliff's 0% to 30% violation rate after compaction (see the
  correction above).
- Aider code-in-JSON per-model numbers (Sonnet 3.5 about 90 against 82, DeepSeek
  Coder about 88 against 78) and "2-3x the syntax errors": in a chart, not text.
- Meta-Tool: 0-shot Gorilla failures being 100% format errors.
- Context-Folding's 58.0% pass@1 on SWE-bench Verified at a 32K budget.
- The Complexity Trap's lower bound of 13% trajectory elongation (15% found).
- Morph's accuracy at 10,500 tokens/s (the finding said 96%, the verifier found
  98% on Morph's pages).
- Kortix FastApply-1.5B/7B: no accuracy numbers checked.
- Codex `seek_sequence` order (exact, rstrip, trim, Unicode normalisation) and
  Aider's "Are you sure you need this SEARCH/REPLACE block?" wording: cited, not
  re-read by a verifier.
- Letta 74.0% against Mem0 68.5% on LoCoMo; Cognition's "weren't comprehensive
  enough" note; Manus's raw-then-compaction-then-summarisation ordering from the
  rlancemartin write-up; "tool-use examples 72% to 90%"; "Less is More" up to
  70% less execution time.
- "GPT is terrible at working with source code line numbers" (Aider, GPT-4 era).
- EDIT-Bench being ICLR 2026 and Python plus JavaScript (the abstract says
  "multiple natural and programming languages"); tau2-bench as a successor (the
  repo names tau3); whether SWE-bench-Live/Windows needs Windows containers.
- Whether the ICML 2025 small-N warning applies to atlias's percentile
  bootstrap: an inference.
- Ollama's sampling defaults (top_k 40, top_p 0.9, repeat_penalty 1.0) on 0.34.3:
  the same docs table carries a stale `num_ctx` of 2048.

And the sentence that has been true in all four of these documents: atlias
still has no score against a public benchmark that a stranger could reproduce.
Item 1 and item 2 are what change that.
