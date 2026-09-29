# Native Codex plugin comparison

Gev's primary live comparison is plain Codex versus Codex with Atlias. The
Claude Code studies remain recorded separately; Claude's weekly allowance and
cloud credit were exhausted when this protocol was added.

The new repair corpus contains 24 workloads in 12 semantic families. Each family
has an 8-file and a 64-file archive variant, a multi-file active API, an explicit
contract, and hidden regression tests. These are authored diagnostic tasks,
not a new public leaderboard. Variants and repeats are correlated: the report
bootstraps families and must not count them as independent tasks.

```powershell
node tools/codexstudy/corpus.mjs
node tools/codexstudy/corpus-test.mjs
node tools/codexstudy/test.mjs
node tools/codexstudy/run.mjs --tasks evals/context-heldout/manifest.json --variant 8 --pairs 12 --repeat 3 --ref HEAD --out D:/study/atlias
```

The last command writes a plan without calling a model. Add `--run` to execute
it. Both arms use GPT 6.1, medium effort, a subscription login, fresh profile,
fresh workspace and memory, identical prompts and settings, and alternated arm
order. Paid API keys are refused. The native CLI is run with full filesystem
access in disposable workspaces so Windows command policy cannot invalidate
one arm. The task prompt limits work to the seeded project. Review model changes
and retained command logs as well as the hidden check; this is not a security sandbox.

Machine-wide skill paths are configured as disabled in both arms. The installed CLI still listed 63 common skill descriptions in the recorded startup context; treatment added only Atlias and double-check. This shared catalog overhead is retained in the metrics. Atlias is installed through its
documented `install --codex` adapter; the other arm gets no Atlias hooks, MCP,
skills, or instructions. `--lean` measures the existing lean-brief and gate-runs-
check experiment in a separate output directory; it does not change defaults.

The driver checks the shared Codex allowance before each run and stops at
60 percent used by default (`--stop-percent N`). This cap includes the lead
session. It never enables paid credits. Task hashes are checked before launch,
and resuming with a different build, model, effort, flags, task hash, or missing archive provenance is refused.
Timeouts, policy-denied commands, missing usage and failed installation evidence
stop the driver; they must not be presented as model-performance losses.

Reports retain raw input tokens (including cache reads), cached input, output,
peak and mean request context, compactions, CLI version, task hash, plugin SHA,
protected-file changes, hidden verdict, and hook evidence. Missing usage is
null. Credentials are removed immediately after a model call; raw profiles and
transcripts are local scratch artifacts and must not be committed.

```powershell
node tools/codexstudy/summary.mjs D:/study/atlias/rows.jsonl
```

Always report solves and total prompt tokens per solve, including tokens spent
on unsuccessful tasks. A ratio on only the jointly solved tasks answers a
different question. A tiny pilot cannot establish efficiency or a leaderboard
win. The retained round-five README results remain the source for existing claims.

UFS uses the same driver with `--plugin-repo <ufs-checkout>`,
`--task-root <ufs-checkout>`, and `--tasks <ufs-checkout>/benchmarks/manifest.json`.
Its behavior and visual grading protocol is in that repository's `benchmarks/README.md`.
