# Harness implementation references for Gev

Reviewed source, September 29, 2026; implementation review, not a new deep-research study. Reference checkouts are read-only and no third-party setup scripts were run.

| Reference | Pinned source | Relevant mechanism | Atlias application |
|---|---|---|---|
| [Gray](https://github.com/vstaln/gray) | 9e4d9242295de281746bd149ac683f6d64bba4fa | [Bounded jobs with completion notifications](https://github.com/vstaln/gray/blob/9e4d9242295de281746bd149ac683f6d64bba4fa/crates/gray-tools/src/shell/tools/bash/jobs.rs); a small default tool surface | Avoid short repeated model polls; the lean Codex brief requests a bounded 30-second wait. Native Codex owns its job engine, so Atlias does not claim to implement Gray's event delivery. |
| [Claude Harness / Agnostic AI](https://github.com/ucsandman/claude-harness) | d32f5d30eb6df5f91cae8835692b1b8fa02b31ed | [Context selection](https://github.com/ucsandman/claude-harness/blob/d32f5d30eb6df5f91cae8835692b1b8fa02b31ed/engine/context/select.cjs) and [budgeted, hash-deduplicated packing](https://github.com/ucsandman/claude-harness/blob/d32f5d30eb6df5f91cae8835692b1b8fa02b31ed/engine/context/budget.cjs) | Keep saved memory and graph navigation when present; on a fresh project explicitly skip absent-context discovery and fetch handoffs only when needed. A dependency-aware module packer is not yet implemented in Atlias. |

Both projects use MIT licensing. These changes use the architectural ideas and Atlias's existing code; no third-party implementation was copied.

The default-off `flags.taskContext` now applies Claude Harness's requirements-first, dependency-closed packing to both Claude Code and Codex prompt hooks. It includes only small whole files explicitly named in the prompt and their static JavaScript imports. Real paths are deduplicated; hidden, credential, external, binary and oversized files are excluded. A source group is rejected as a whole if a prerequisite cannot fit. The rendered pack is capped at 10,000 characters and eight files, with omissions stated. Existing graph answers keep priority. This is a new implementation using Atlias's own code; it is not the reference's module engine or a measured saving yet.

Following the reference's latency-measurement approach, a local Windows Node hook probe ran seven fresh sessions per event. PreToolUse took103–155ms, PostToolUse102–170ms and prompt104–158ms. This does not explain the long pending-cell waits in the recorded native study and does not justify a hook-dispatch rewrite on its own. The latest comparison retained eleven one-second wait polls and3.332x input use; longer waits and on-demand context require fresh matched model measurements before claiming a saving.

Native startup inspection also confirms the lean home instruction block and SessionStart brief reached Codex. Its --ignore-rules option only skips execpolicy .rules, according to the installed CLI's help. This corrects the earlier uncertainty in the trial notes.
