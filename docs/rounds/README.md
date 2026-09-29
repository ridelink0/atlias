# How a round runs

A round of atlias work is research, then a plan, then the builds, each checked by
a second pass. This folder holds the workflow that runs one, so the next round is
run the same way as the last instead of from memory.

`atlias-round-six.workflow.js` is the shape Ultimate Frontend Skills' round two
ran on 2026-09-29, with atlias's content:

1. **Research.** Five fronts in parallel: what round five shipped (local, read
   only), getting below plain Claude Code in dollars, a harder corpus that can
   show the gate's value, the harness landscape, and local-model wins.
2. **Verify.** One adversarial verifier per front re-checks the load-bearing
   claims at the primary source and appends a Verification section. Only
   CONFIRMED claims go into the plan as fact.
3. **Plan.** One writer turns the verified notes into `docs/NEXTGEN-6.md`, a
   ranked plan ending in a build queue; a small agent extracts that queue.
4. **Build and review.** The top items, one at a time on the `round-six` branch,
   each built and then reviewed by a second agent that tries to break it
   (default-off flags, the golden flags-off fingerprint byte-identical, checks
   that fail without the change).

Run it from Claude Code with the Workflow tool, after `ridelink0/atlias#2` is
merged into main:

```
Workflow({ scriptPath: '<atlias>/docs/rounds/atlias-round-six.workflow.js',
           args: { repo: 'C:/Users/OWNER/atlias', notes: 'D:/harness-work/round6/notes',
                   skill: '<deep-research skill folder, optional>', maxBuilds: 5 } })
```

Without the Workflow tool, run the same four steps by hand with subagents. What
the builds cannot finish stays in NEXTGEN-6's queue for the next pass, and every
item's default flips only after its measurement meets the bar the plan set
before the run.
