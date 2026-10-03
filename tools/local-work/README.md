# Local Atlias continuation for Gev

This runner uses a local Ollama model with Atlias's real read/edit/search/check loop, native function calls, typed archive retrieval and an on-demand stdio MCP adapter. It makes no OpenAI or Anthropic inference calls. A loopback URL and a declared local model are required. It does not train model weights or turn a Plus subscription into Pro.

Research and planning precede changes: Claude's completed research, the pinned Gray `9e4d924` checkout and Claude Harness/Agnostic AI `d32f5d3` checkout are preserved in the migration. Gray informs bounded observations, stable tool semantics and explicit tool-result completion. Claude Harness informs prerequisite-aware, deduplicated retrieval instead of loading every plugin and old session into every request. The local policy preserves useful factuality, normal capabilities, independent grading and separate total-token/full-peak goals.

The original host settings, installed Atlias snapshot and sessions stay intact. Credential files, Git internals and rebuildable dependency caches are excluded from the private local snapshot; omissions and original runtime paths are recorded. Historical transcripts are retrievable archives, not transferable live resume IDs. Files are copied exactly with SHA256 verification. A changed manifest or retrieved file fails closed.

Copied plugins and skills remain discoverable. A plugin is operational only after its native dependencies and exact tool catalog/call are verified. Desktop-only tools and authenticated cloud connectors require their original host or further adapters; copying their files does not implement those capabilities. MCP activation is explicit in `CONFIG.json`, not inferred from a plugin manifest. Usage Limits code remains untouched; local request counters and wall time are recorded separately.

Run model-free controls:

```text
node tools/local-work/test.mjs
```

Prepare a new immutable archive:

```text
node tools/local-work/migrate.mjs D:/harness-work/atlias-local-1003/knowledge
```

Declare a new feasibility screen only after real generation and local metadata preflight. The selection corpus has 12 authored coding, evidence, instruction and accounting cases with two repeats per model. All request/response bytes and attempted failures remain saved. This is a finite local screen, not a public benchmark or universal coding parity. The grader executes restricted JavaScript in a timeout-controlled VM; a VM and command guard are not an OS sandbox. Existing public factuality adapters still require their actual datasets and protected publisher-aligned judging.

The working checkout is separate from the original repository. `CONFIG.json` declares its model, fixed context, loopback URL, archive, round budget and reviewed local MCP adapters. `start.mjs ROOT` starts a hidden detached worker; `--once` finishes one bounded phase. `WORKER.lock` prevents a second owner. Every phase records its original prompt, complete model requests/responses, native counters, stop reason, controller tests and diff. A new conversation begins at a work boundary with the durable `LOCAL-PROGRESS.md`, retaining full evidence on disk. Failures do not become zero cost or passed checks.

The worker keeps advancing across phases until an operator creates `STOP`, a protected original test/report is changed, or three consecutive phases fail. Those cases leave `ATTENTION.json` with a recoverable checkpoint. They prevent endless identical errors; the goal stays unfinished. Existing test files, historical reports and the logo are protected by an independent before/after hash check. New tests may be added. Controller verification runs the full original suite after a phase. The shell allows scoped argv commands, not arbitrary shell chaining, publishing or destructive Git commands; scripts still run with the local Windows user's filesystem privileges. Do not describe this as a hostile-code sandbox.

`start.mjs` is not health evidence by itself. Inspect `STATUS.json`, the actual lock owner, `WORKER.log` and `MODEL-CALLS.jsonl`. The durable journal preserves an interrupted phase as unknown; it starts a new work phase rather than replaying its pending calls. Models and the runner stop when the PC is shut down; a supervisor can resume from the same receipts. No promise of uninterrupted days or frontier-model equivalence is made before endurance and capability tests.

The goals remain separate: 20x fewer model tokens; 20x lower maximum full request input including any compaction; same useful required outputs and normal capabilities for both hosts; and independently measured useful work per subscription allowance. Local inference removes subscription inference spend for its own calls, but that alone proves none of the capability or context targets.
