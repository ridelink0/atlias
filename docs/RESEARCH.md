# What atlias is built on

Every mechanism in atlias traces to a source below, and every source was read, not remembered. Where a claim below carries a number, the number is the source's own. Where atlias does something no source measured, it says so under "Not measured".

An honest count: the 3.0 work drew on the fourteen primary sources listed here, read in full or at the relevant section, plus the open-source code of Codex itself, which settled three questions its documentation did not. It is not a survey of hundreds of pages. It is the set of sources that changed what the code does.

## Hosts: what they really send

| Source | What it settled | Where it lives |
|---|---|---|
| OpenAI, [Codex hooks reference](https://learn.chatgpt.com/docs/hooks) | Hooks load from `~/.codex/hooks.json` or `[hooks]` in `config.toml`; Stop's `decision: "block"` continues the turn; shell calls are reported as `Bash` and edits as `apply_patch` | `lib/hosts.mjs`, `lib/gate.mjs` |
| [openai/codex](https://github.com/openai/codex) `core/src/tools/handlers/apply_patch.rs` | An `apply_patch` hook receives `tool_input: {"command": "<patch>"}`. atlias read only `input` and `patch`, so every Codex edit was invisible to its gate until 3.0 | `lib/core.mjs` `filesFromTool` |
| openai/codex `hooks/src/events/pre_tool_use.rs`, test `unsupported_permission_decision_fails_open` | `permissionDecision: "ask"` is unsupported and **fails open**: the command runs. atlias's destructive guard did nothing in Codex until 3.0 | `lib/guard.mjs` `CAN_ASK` |
| openai/codex `core/src/tools/handlers/unified_exec` | A shell hook's `tool_response` is a plain string with no exit code, so a pass can never be proven from it; atlias reads failure text and otherwise says unknown | `lib/integrity.mjs` `verdict` |
| openai/codex `core/assets/tools/apply_patch.lark` and `base_instructions/default.md` | The exact patch grammar, and that Codex models send it through the shell as `["apply_patch", "<patch>"]` | `lib/loop.mjs` `parsePatch`, `applyUpdate` |
| OpenAI, [Codex CLI command reference](https://learn.chatgpt.com/docs/developer-commands?surface=cli) | `exec`, `resume`, `review`, permissions, `/status` | `atlias exec`, `atlias resume`, `/review`, `/permissions`, `/status` |

## Making a weak model finish the job

| Source | Finding | Where it lives |
|---|---|---|
| OpenAI, [GPT-4.1 prompting guide](https://cookbook.openai.com/examples/gpt4-1_prompting_guide) | Three reminders in an agent prompt (persistence, tool use, planning) raised OpenAI's internal SWE-bench Verified score by close to 20%; explicit planning alone added 4% | the first lines of the agent's system prompt, `lib/loop.mjs` `systemPrompt` |
| Princeton, [SWE-agent: Agent-Computer Interfaces](https://arxiv.org/abs/2405.15793) (NeurIPS 2024) and its [ACI notes](https://github.com/SWE-agent/SWE-agent/blob/main/docs/background/aci.md) | An edit command that runs a linter and reverts an edit that breaks the syntax, showing the error, cuts compounding mistakes | `edit_file`, `write_file` and `apply_patch` put a broken file back, `lib/loop.mjs` `guardedWrite` |
| Aider, [linting and testing](https://aider.chat/docs/usage/lint-test.html) and [repository map](https://aider.chat/2023/10/22/repomap.html) | Lint after every edit; run the tests after edits and feed failures back; give the model a map of definitions instead of whole files | the harness runs the project's check itself (`agent.testCommand`), and the `outline` tool |
| OpenHands, [stuck detector](https://docs.openhands.dev/sdk/guides/agent-stuck-detector) | Loops come in more than one shape: repeated calls, and two calls taking turns | alternating-call detection in the agent loop and in the host guard |
| ImpossibleBench, [arXiv 2510.20270](https://arxiv.org/abs/2510.20270) | Coding agents given tests that cannot honestly pass will modify the tests, special-case the inputs or keep state to game them | the gate flags skipped, focused and deleted tests and asserts that cannot fail, `lib/integrity.mjs` `findWeakenedTests` |
| Anthropic, [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) | Work across context windows needs a progress file, clean handoffs and a test gate | the handoff note, the Stop gate, saved agent sessions |

## Keeping the context small

| Source | Finding | Where it lives |
|---|---|---|
| JetBrains Research, [The Complexity Trap](https://arxiv.org/abs/2508.21433) (NeurIPS 2025 DL4Code) | Masking old tool observations halves cost against a raw agent while matching the solve rate of LLM summarisation | `lib/loop.mjs` `view`, `agent.keepObservations` |
| Manus, [Context engineering for AI agents](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus) | Reciting the plan at the end of the context keeps a long task on course; a stable prompt prefix keeps the KV cache hitting | the plan line after every tool result, and a system prompt that does not change between calls |
| [HKUDS nanobot](https://github.com/HKUDS/nanobot), issues 2463, 4522, 5266, 1955 | Broken prompt-prefix caching, repeated identical calls, invisible token burn, opaque subagents | the base atlias was built on in 2.0; see the README table |

## Not measured

Whether atlias makes a given model finish more tasks. Every mechanism above is tested to do what it says (the suite checks each one), and each has a published result behind it in some other harness, but nobody has yet run the same tasks with atlias on and off and counted. `atlias bench` measures token cost only, and says so in its own output. Until that comparison exists, "makes a weak model as capable as a strong one" is a goal the design aims at, not a result.
