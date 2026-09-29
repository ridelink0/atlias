# Cloud report, 2026-09-28 to 29

A cloud Claude Code session worked on Gev's six repos while the PC was out of usage, paid from the $250 cloud credit (about $225 spent, including $27 of nested headless Claude Code runs for the token study). Everything is on the branch `claude/session-limits-usage-credits-dm3isz` in each repo. The cloud had Linux only, so every Windows-only path below is untested until the PC runs it.

Read this first, then do not redo anything listed as done.

## Pull requests, and the order to merge them

| # | Repo | PR | State | Merge note |
|---|---|---|---|---|
| 1 | claude-code-usage-limits | [#2](https://github.com/ridelink0/claude-code-usage-limits/pull/2) 1.43.2 | CI green on all 9 jobs | Independent. Run the Task Scheduler test on Windows first (the one skip on Linux) |
| 2 | image-deep-research | [#1](https://github.com/ridelink0/image-deep-research/pull/1) 1.1.0 | CI pending at time of writing | Tag `v1.1.0` after merge, then UFS syncs to it |
| 3 | ultimate-frontend-skills | [#1](https://github.com/ridelink0/ultimate-frontend-skills/pull/1) 6.9.x | Draft | Flip to ready once its last review commit is in and CI is green; then `node scripts/sync-image-research.mjs --tag v1.1.0` in a follow-up |
| 4 | claude-computer-use | [#1](https://github.com/ridelink0/claude-computer-use/pull/1) 0.11.0 | Open | Needs a Windows run of the pre-approval path first (never run end to end) |
| 5 | doodle-voyager | [#1](https://github.com/ridelink0/doodle-voyager/pull/1) | Open, mergeable | Run the 225-check suite in real Chrome first. Its body says setting a course is "one click"; it is two (marker, then set course) |
| 6 | atlias | [#2](https://github.com/ridelink0/atlias/pull/2) round five, part two | CI green on all 9 jobs at a95baf9; row 5 review commit 232222c pushed after | Merge last, then run round six (below) |

atlias#1 (round five part one) is already merged. Merge with merge commits, never squash. Branch protection is on for all six mains (PR required, 0 approvals, CI required, admins can still push).

## atlias: round five rows

The plan is `docs/NEXTGEN-5.md`. Rows by status:

| Row | Status | Where |
|---|---|---|
| 1 cloud part | Done: flag/env plumbing (`DEFAULTS.flags`, `ATLIAS_FLAG_*`), ledger fields in every eval row, the golden flags-off test (byte-identical requests), hook timeouts to 30 s | 41b47ab, 5a242ae, 29a018d, 871b1a9, aa34617 (on main) |
| 1 PC part | Not done: `--repeat 3` MT head-to-head, atlias vs mini-swe-agent | PC |
| 2 cloud part | Done: 50-task headless Claude Code study, 3 arms, all 50/50 solved. atlias@head vs plain 1.00x raw (0.94-1.06), 1.06x billed-equivalent. **Caveat: 0 of 1,037 hook calls were cancelled, so the transcript-recovery fix had nothing to recover; its effect is unproven** | tools/ccstudy/, evals/results/round5/cloud-cc/ |
| 2 PC part | Not done: search the D:/harness-work cc-token-study-0928 transcripts for the 80 cancellations and their reasons | PC |
| 3 | Not built: public score v0 packager, default `ollamaModel` to qwen2.5-coder:7b, README line 211 | Round six |
| 4 | Built and measured. `flags.leanBrief` + `flags.gateRunsCheck`, both off by default. Flags on vs baseline plain 1.03 (0.96-1.10): passes the 1.05 bar; vs plain re-run in the same window 1.06 (0.98-1.16): inside the noise. Two plain runs differ by 0.97, so the window matters. Lean brief cut a median 145 prompt tokens a round; the gate ran a check itself 0/50 times | 614c0f3, c7b7587, 19002d4, 7135067, f61fd96, a95baf9 |
| 5 | Built and reviewed, **not measured**. `flags.sameTextSwitch`: a no-op edit is not a strike, a repeat switches the file to whole-def or whole-file | 35b59d1, 232222c. PC: MT, flag on vs row 1 |
| 6 `--direct` arm | Not built | Round six |
| 7 HumanEvalFix v2 converter | Not built | Round six |
| 8 Ollama prompt profile, honest defaults | Not built | Round six |
| 9 14B model | PC only, not started | PC |
| 10 SWE-bench spike | Not started: needs huggingface.co and an sb-cli key | Round six |

Windows fix worth knowing: on Windows `cmd.exe` reports a missing program with exit 1, not 9009, so `lib/gate.mjs` now looks the program up on PATH (with PATHEXT) before a shell check runs (7135067). Suite: 1136/1136 on Linux at 232222c.

Unverified until the PC runs it on Windows: the golden fixture on a CRLF checkout, env-name case and cmd quoting for `ATLIAS_FLAG_*`, case-blind re-read matching, that Claude Code passes its env to hook commands.

## Round six: what goes into it

Run it on the PC with `docs/rounds/atlias-round-six.workflow.js` (how: `docs/rounds/README.md`), after atlias#2 merges. It is the same shape UFS round two used: five research fronts, a verifier per front, a writer to `docs/NEXTGEN-6.md`, then builds on a `round-six` branch, each with an adversarial review.

Carry these in as its notes, because the cloud ran out of credit before building them:

1. Rows 3, 6, 7, 8 and 10 above.
2. Council Stage A (`flags.council`, `lib/council.mjs`, `atlias council replay`), spec in `docs/research/Atlias councils and UFS packs.md`.
3. Image research inside atlias, the atlias side: `idrCopies()`, `idrInstallPlan()`, `flags.visualHint` (off/compact/subagent), `VISUAL_RE` in the router, doctor rows. Spec in `docs/research/Image research inside Atlias.md`, "Build queue" item 1. It needs IDR 1.1.0's `--compact` (image-deep-research#1).
4. The cost critic's F6 (claude engine effort plus one high-effort retry on red) and F7 (claude engine records usage via `--output-format json`); `lib/agent.mjs` is unchanged.

## The other repos

**claude-code-usage-limits** (1.42.0 to 1.43.2). Done: the usage-credit/cloud-credit report at the wall (1.42), `relay cloud`, `relay fresh on|off` (a new session instead of `--resume`), its POSIX byte-limit and home-folder fixes (1.43.1), and Sonnet 5.5 priced at $2/$10/$0.20 (1.43.2). Left: the Windows Task Scheduler path and the `.cmd` shim warning on a real Windows machine.

**image-deep-research** (1.0.1 to 1.1.0). Done: `--compact`, `--pick`, one number per result, `study --compact`, Playwright Chromium lookup on Linux, `--no-sandbox` only as root. Left: a live `--compact` run against the real image APIs (403 from the cloud), PRIVACY.md says every request carries the plugin's user agent, which is false for moodboard sheets that load remote URLs in Chrome.

**ultimate-frontend-skills** (6.8.1 to 6.9.x). Done: game widths follow relative imports, headless rendering in a container, rendered tells, the browser-search no-home fix. The round-two plan is `docs/research/` (UFS frontend expansion plan). Left from its build queue: external detectors (item 3), the atelier A/B harness (item 4), the direction card (item 5), the packs refresh (GSAP, Hallmark), axe-core and the Baseline/INP gates. Blender, GPU and real-browser items are PC items.

**claude-computer-use** (0.10.2 to 0.11.0). Done: deny wins over allow, the trust rule in code, pre-approval for the session. Left: pre-approval never run end to end on Windows; a stale index label on pre-approved clicks (confirmed in code, index.mjs:629); one policy check fails on Linux (POSIX basename of a Windows path), also on main.

**doodle-voyager.** Done: autopilot that leads moving targets and goes round bodies, PvP shots between opted-in players, name tags, rooms per star system, the HUD hint. 225 checks, 221 pass in the cloud (4 are environment: H.264, Google Fonts through the proxy, software GL timing). Left: shaders-2, PBR/Blender assets, AdMob, one-click course setting, Chromebook performance (stop rendering on a hidden tab is a few lines; moving `squash()` to the vertex shader is the big win), README still says 182 checks.

## Audits

One auditor per repo checked every to-do item against code and tests: `docs/research/2026-09-29 completeness audits.md`. Some of its gaps were fixed after it ran: row 4's measurement (a95baf9), row 5 pushed, usage-limits 1.43.1 and IDR `--no-sandbox`. The rest stand.

## Reports from tonight, in `docs/research/`

- Atlias round five joint plan
- Atlias councils and UFS packs
- Image research inside Atlias
- 2026-09-29 completeness audits
