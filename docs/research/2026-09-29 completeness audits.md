# Completeness audits, 2026-09-29

Written by the cloud session: one auditor per repo, which checked every to-do item Gev asked for against the code and tests on the `claude/session-limits-usage-credits-dm3isz` branch. These are copied verbatim from the auditors, so a line can be out of date where a later commit fixed it. "done" means the auditor saw the code and a test; "gaps" is what is missing.

## /home/user/doodle-voyager (branch claude/session-limits-usage-credits-dm3isz @ 4922a8f, local = origin; NOT merged: 4 commits ahead of origin/master 89216c8; PR ridelink0/doodle-voyager#1 open, mergeable_state clean, not merged)

Items asked for: 22

### Gaps

- TODO.md 'Next, in order' has only items 1-4, not 1-7; there is no 5-7 to audit.
- Next #1 docs/specs/shaders-2.md (ink-bleed edge, cel-banded starlight, interior bounce): NOT done - no bleed/celBand/bounce code in js/.
- Next #2 PBR textures / Blender assets: NOT done - no .blend or baked normal maps in repo; and docs/refs/ (the 'reference corpus' the item cites) does not exist.
- Next #3 AdMob: NOT done (no AdMob code; needs Gev's account step, as the item says).
- Next #4 vacuity pass over the 225 checks: PARTLY done - two vacuous checks fixed (autopilot-closes-on-Mars replaced by whole-leg checks; ghost-position check now relative). The named next suspect 'walking moves you inside the ship' (tools/test.mjs:113-118, step(900) wall-clock) is unchanged, and no systematic pass was made.
- (Gev) Destination 'one-click': NOT done as one click. It is still marker then 'set course' (two clicks); only the HUD hint was added. The PR body claims 'Setting a course is one click from the map' - overstated. TODO.md itself correctly says 'two clicks'.
- (Gev) Multiplayer with shooting: PARTLY done (correctly left unticked): no server, no signatures - forged/borrowed/rotated ids still bypass the per-shooter gate; victim-wide rate gate proposed in review but not implemented; live Supabase untested (fake transport only); hits between ships >5e5 u/s can be refused.
- (Gev) Clan wars across galaxies: NOT done (no accounts, clans or sector tables).
- (Gev) Chromebook CPU/GPU efficiency: NOT done - no weak-device detection (no deviceMemory/hardwareConcurrency probe in js/), no auto preset, no render pause on hidden tab (only js/audio.js:1634 listens to visibilitychange), squash() not moved to a shader/worker.
- Shared enemy zones, leaderboards, touch controls, service worker, LOD for galaxy cloud, minor planets/comets, catalogue refresh, ~50 ultra-faint dwarfs, UFS games.md test-width rule: all NOT done (HANDOFF open items 5 and 6 still open).
- RESEARCH-features.md section 2.5 'For TODO.md (not already on it)' (fuel difficulty setting, velocity vector marker, colour-blind cues/captions, PvE-only rooms and safe zones, mod packs, Bazaar home module, etc.) was never copied into docs/TODO.md; its 'Player-request list' section is still empty.

### Docs that say something the code does not

- README.md:60 and :96 say 182 checks; TODO.md/HANDOFF say 225 (the PR changed README by 5 lines but left the count).
- docs/HANDOFF.md title still '(2026-09-23)', project root 'D:/doodle-voyager', and 'Open items, in order' skips number 3 (1, 2, 4, 5, 6).
- docs/HANDOFF.md open item 4 'RESEARCH-features.md was never finished' is stale: the file is 435 lines with ranked list, implications, sources and an UNVERIFIED section.
- docs/TODO.md unticked but done per TODO.md Built + code: 'Red guy variety ... a boss per galaxy (The Doodler, The Eraser, The Inkblot)' (js/bosses.js, eight bosses); 'Gamepad and HOTAS support' (js/pad.js getGamepads; HOTAS not done -> should be split); 'Boarding enemy capital ships' (breach boarding exists, js/game.js:326, test :1756 - 'fighting the red guys inside' unverified -> partly); 'Galaxy clusters as named regions' (test tools/test.mjs:172 'seven named clusters and superclusters, all placed'); 'Photo mode' is still only K-saves-frame (js/game.js:540) so unticked is correct.
- TODO.md Next #2 cites a reference corpus in docs/refs/ that does not exist.
- PR #1 body says 'one click from the map' and HUD 'no destination, press M'; the code says 'no destination · M map, pick a place, set course' and it is two clicks.
- docs/TODO.md multiplayer plan text still says 'Rooms are per galaxy' in the plan paragraph while the 'Partly done' note under it says per star system - fine as history but the plan line reads stale.

### Cost and performance notes

- Run `node tools/pvp-checks.mjs` (17 checks, node-only, under a second) as the pre-commit/CI gate for net/pvp changes instead of the full headless-Chrome suite; reserve the 225-check suite for merges.
- Chromebook: RESEARCH-features.md 2.5 names squash() as the measured hot spot - moving it into the point-cloud vertex shader (or refreshing far clouds every few frames) is the single cheapest large CPU win, ahead of the rest of the Chromebook plan.
- Stop rendering on a hidden tab via the existing visibilitychange hook (only audio uses it today, js/audio.js:1634) - a few lines, saves GPU/battery on laptops, and is already listed in the Chromebook plan.

### Done, with evidence

- Harness opt-in THREE_DIR / CHROME_PATH / CHROME_FLAGS -> e3b954c; tools/cdp.mjs:16 (CHROME_PATH), :89 (CHROME_FLAGS), :126 (THREE_DIR serveThreeFrom). Default path unchanged. No dedicated test (it's test infra); documented in TODO.md 'How to run it' and HANDOFF.
- (Gev) Setting a destination works -> 535b814; HUD hint js/ui.js:273 ('no destination · M map, pick a place, set course') and :270 ('T fly there'); test 'click Mars on the map, click set course, and the autopilot has it' (tools/test.mjs:372) with real mouse events, plus 'with no destination the HUD says to press M, and W/S says tap or hold' (:357). NOTE: still TWO clicks (marker + set course, js/ui.js:631-635); nothing makes it one-click.
- Autopilot leads moving targets and goes round bodies -> 535b814 (js/game.js); whole-leg tests tools/test.mjs:461 (Mars while it moves), :463 (Mercury with Sun on the line, pulledOut===0), :465 (Filing Cabinet slower than a 216 u/s planet). Commit says all three fail on old steering.
- W/S hint 'tap or hold' -> js/ui.js:323; test tools/test.mjs:357. Ticked in docs/TODO.md.
- PvP shots with opt-in -> 11fff29; js/pvp.js judgeHit (line 69 refuses when you are not in pvp), Shift+O at js/game.js:513, settings checkbox index.html:234 / js/ui.js:95. node tools/pvp-checks.mjs re-run now: 17/17 PASS. Browser checks tools/test.mjs:2384, :2387, :2436, :2438, :2442.
- Names above ghosts -> 11fff29; js/net.js:34-35 NAME_NEAR 2000 / NAME_FAR 16000; tests tools/test.mjs:2378 (name drawn, fades) and :2382/:2284 (ghost placed relative to you, fixing a previously vacuous check).
- Rooms per star system -> 11fff29; js/net.js:11-46 (room keyed on ctx.system, galaxy between systems), ROOM_SETTLE=1 at :33; tests tools/test.mjs:2485, :2488, :2492, :2494.
- Review fix: bye does not refill rate gate -> 4922a8f; test 'saying goodbye and coming straight back does not buy the shooter a fresh burst' tools/test.mjs:2445 (comment :2423); PR says the check fails without the fix.
- (Gev) Gas stations for certain ship types -> ticked in docs/TODO.md, pre-existing on master (not re-verified tonight beyond the fuel-tab/pump code at js/ui.js:496).
- HANDOFF open items 1 and 2 (destination, tap-or-hold) -> same evidence as above.
- Suite count claim 225 = 194 before + 31 added (17 node + 14 browser) is consistent with commit 535b814 message ('192/194') and the added test lines; PR reports 221/225 in cloud with 4 environment failures (H.264 MP4, Google Fonts via proxy, software-GL frame timing). Real-Chrome run on Gev's PC still pending.

## claude-computer-use (branch claude/session-limits-usage-credits-dm3isz, head 3cb79a4; NOT merged into origin/main, which is still at 9cc8d3e / v0.10.2; open as PR #1, 3 commits ahead. The local checkout in /home/user/claude-computer-use is 1 commit behind origin (3cb79a4 not pulled). Audited from a git-archive copy in scratchpad; nothing in the repo was changed.)

Items asked for: 7

### Gaps

- Review notDone, stale index label on pre-approved clicks: NOT DONE, and the risk is confirmed in the code. For an index click, consequenceCheck gets its label from targetName() (index.mjs:629), which reads elementNames. That cache fills up over every read of the window (trackSnapshot, index.mjs:610-625: 'accumulates over reads instead of being tied to one snapshot'). It is not the live label. The host is only asked to 'describe' the target for selector and point clicks (index.mjs:1950), not for index clicks. Failure case: the user pre-approves 'Send'; a snapshot shows index 42 = 'Send'; the same element's label then changes to 'Send $50' or 'Send 0.5 BTC', which is the ALWAYS tier; Claude clicks index 42 without a new snapshot. The cached 'send' matches the pre-approval, so the click goes through with no confirmation. Before 0.11.0 a stale 'Send' still asked for confirmation, so pre-approval made this path weaker. No test covers it: policy-test and sessions-test are pure functions, and nothing drives consequenceCheck with a stale cache. Cheap fix: when decideConfirmation returns via 'pre_approval', do one driver 'describe' on the index (the same call already used for selectors), re-run decideConfirmation on the live name, and fail closed on a mismatch or an error.
- Items 1-3 on real hardware: PARTLY. The CHANGELOG marks the pre-approval path UNVERIFIED: no Windows host ran computer_grant preapprove followed by a click end to end, and there is no verify.mjs, web-test or mcp-test case for it. The Stop path ending pre-approvals (errorResult: sessions.endPreApprovals()) and the __backgroundRun marking in computer_run (index.mjs ~1718) are in index.mjs, and no test exercises either one.
- Release: NOT DONE. The CHANGELOG header says 'Every released version ... on the tag of the same name', but origin has no v0.11.0 tag (it stops at v0.10.2), and the branch is not merged to main (PR #1 is open).
- TODO-astra #4 (out-of-band safety monitor that can pause after approval), #5 (Windows.Graphics.Capture path for occluded windows) and #6 (build and run the macOS AxonHost on real hardware): NOT DONE, and correctly still listed as open. None of them was claimed.
- policy-test fails 1 check on Linux, 'path is used when process name is missing' (classify with path 'C:\\x\\1password.exe' uses a POSIX basename). It fails on origin/main too (149/150), so it predates this branch, but README's '226' only holds on Windows.

### Docs that say something the code does not

- The list of controls that can be pre-approved differs between files. CHANGELOG 0.11.0 says 'Send, Post, Reply all, Upload, Invite, Like, Share'. TODO-astra #3 and README (Safety section) say 'Send, Post, Reply all, Upload, Like'. The code (policy.mjs LEAVES at 314 and SOCIAL at 321) also allows publish, tweet, invite, follow, react, retweet, repost, share and comment.
- The CHANGELOG promises a tag for every release, but v0.11.0 has none on origin.
- README test table: policy-test 226 and annotations-test 139 are Windows counts. On Linux they are 225+1 fail and 124, and neither the table nor the notes say the counts depend on the platform.
- TODO-astra #1-3 are marked 'Done in 0.11.0', but 0.11.0 exists only on the unmerged branch. main's docs/TODO-astra.md still lists them as open, so the two branches disagree until PR #1 merges.
- Local /home/user/claude-computer-use is 1 commit behind origin on this branch (missing 3cb79a4, the batch-test ceiling). Anyone reading the local tree sees the old 3970 ceiling in batch-test.

### Cost and performance notes

- Make the stale-label fix run only where it matters: call 'describe' only when a pre-approval is about to be the thing that lets the click through. That adds one host round trip on that one path, with no cost on ordinary clicks and no extra schema tokens.
- batch-test, and the other suites that spawn powershell.exe, crash with ENOENT on Linux instead of skipping. Skipping cleanly on non-Windows (as annotations-test already does with WINDOWS_ONLY), and using path.win32.basename in classify or its test, would let test-all give a green or red signal in this Linux container. The alternative is paying for Windows runs just to check the pure-JS parts.
- screenTexts() rebuilds an array of up to 32x8000 cached names each time preapprove is called. That is cheap today, but if the trust check is ever run per click, keep a Set of squashed names updated in trackSnapshot instead.

### Done, with evidence

- TODO-astra #1, deny wins over allow: DONE. Commit 367353b. server/policy.mjs isAlwaysAllowed (line 161) now returns false for blocked and shell-tier apps. PLAN.md Safety model has a new bullet for it. Proven by policy-test checks 'an app on both lists is blocked / is not always-allowed / cannot act / cannot be read / gets no grant recorded' and 'keepass is blocked' (re-run in this audit: pass).
- TODO-astra #2, trust rule in code: DONE, with the limit the TODO itself states. Commit 367353b. policy.mjs has SOURCE, canSatisfy (402), sourceOfWords (422) and decideConfirmation (441). server/index.mjs consequenceCheck (~652) now goes through decideConfirmation for every click and file_dialog. The server can only refuse words it read off the screen; whether words were typed or pasted still rests on Claude's word. Covered by policy-test's trust-rule and 'who can say yes' checks (226 in total; 225 pass on Linux, and the 1 failure also fails on main, see gaps).
- TODO-astra #3, four confirmation tiers and session pre-approval: DONE in pure JS, UNVERIFIED on Windows (the CHANGELOG says so). Commits 367353b and 3c804b9. CONFIRM tiers and confirmationTier are in policy.mjs 375-397. Coins, amounts and 'submit' are forced to ALWAYS by 3c804b9. Policy.preApproval is at 702. computer_grant gained preapprove and user_words (index.mjs ~372, ~1029). Pre-approvals end on revoke, revoke all and stopped_by_user (errorResult). Background runs are marked __backgroundRun and are refused a pre-approval. sessions-test section 'pre-approvals: until the session ends, never on disk' has 14 checks, all passing when re-run in this audit (62/62).
- Version bump to 0.11.0: DONE. plugin.json and marketplace.json both say 0.11.0, with a CHANGELOG entry dated 2026-09-28.
- The schema ceiling moved 3970 to 4030 for the two new computer_grant arguments: DONE. astra-test.mjs ~613 (54/54 pass when re-run), and batch-test.mjs:98 follows it in 3cb79a4. batch-test itself cannot run on Linux (it spawns powershell.exe), so the 4030 check there has not been run.
- SKILL.md documents the new error codes (always_confirm, not_user_words, user_words_missing/mismatch), the rule that only the user's typed words count, and the pre-approval flow: DONE (367353b).

## /home/user/claude-code-usage-limits (branch claude/session-limits-usage-credits-dm3isz; origin/main 87ac644 = merge of PR #1; the branch has zero commits beyond main, so it is fully merged at 8021710 / v1.43.0. BUT the working tree holds UNCOMMITTED follow-up fixes in relay.js, wake.js, commands/defer.md, commands/relay.md, test/relay-cloud.test.js, test/relay-fresh.test.js. Another agent appears to be editing it right now.)

Items asked for: 9

### Gaps

- win32 .cmd shim warning: PARTLY DONE and BROKEN on main. It shipped in 945a6d3/13f7c42 (relay.js cloudWarnings :1721-1744, test 'a Windows command meant for a batch shim warns...'). But on main, shellClaude() takes the first line of `where claude`. npm lists its extensionless sh script before claude.cmd, so on a real npm install the warning never fires. The fix (take the first line that has an extension, relay.js:1844) and its test ('the claude a Windows shell runs is the first match with an extension...', relay-cloud.test.js:353) are UNCOMMITTED in the working tree. The published 1.43.0 has the bug.
- Relay fresh on POSIX: two defects on main, fixed only in uncommitted work. (1) argCost counted characters, not bytes, against the 120000 argv limit. A hand-off heavy in non-ASCII text fails with E2BIG instead of falling back to the file pointer. The fix is at wake.js ~:255, test 'the POSIX inline limit counts bytes...' (relay-fresh.test.js:373). (2) The POSIX launcher ran `cd record.cwd` instead of launchCwd. A project in the home folder then sits at the trust prompt in the new window. The fix is at wake.js ~:560, test 'the POSIX window starts a home-folder project from its trusted launch folder...' (:387). Both come from the review that was still running when PR #1 merged at 01:11 UTC.
- defer.md/relay.md truth about the too-long-argument fallback: on main neither file says the hand-off also goes by file when it is too long for one argument (30,000 chars on Windows, 120,000 bytes elsewhere). Only the uncommitted diff adds it. README.md:527 still omits both the shim fallback and the too-long fallback.
- Release hygiene: the fixes above need a commit, a bump to 1.43.1 across the manifests, a vscode/lib rebuild and a push/PR. None of that exists yet. The published main is 1.43.0 with the bugs.

### Docs that say something the code does not

- No TODO/HANDOFF file exists in the repo (find for *todo*/*handoff* returns only test/relay-handoff.test.js), so there are no ticked items to check. The session's to-do list lives outside the repo.
- README.md:1376 says '901 tests'. A clean origin/main export has about 972 top-level test( calls across 67 test files. The count has been stale since 4506df3 and was not updated by 15d1b18 or 13f7c42, which together added about 28 tests.
- Commit messages 719a9d3/0feafb2/8021710 say 'packaged copies rebuilt', but vscode/lib is gitignored, so git can't confirm the rebuild. It does match HEAD locally now.
- README.md:384 has an over-long line ('...PowerShell. Inside a cloud session the report does'). It looks like a missed rewrap in 13f7c42. Cosmetic.
- The README relay-fresh paragraph (README.md:527-534) doesn't mention that on Windows the inline hand-off needs the native claude.exe. commands/relay.md and commands/defer.md do.

### Cost and performance notes

- Make the README test count come from the suite (or drop the number) so it stops going stale on every feature commit, as it did here (901 vs ~972).
- Add a package test (or a check in vscode/build.js) that diffs vscode/lib/*.js against skills/usage-limits/scripts/*.js. This backs up the 'packaged copies rebuilt' claim without a manual cmp pass. The check costs milliseconds.
- Stop merging before review finishes. The three post-merge defects (shim detection, byte count, home-folder cd) were all caught by the review that was still running, and now need a second release cycle (commit, bump, rebuild, PR). Waiting would have cost one release, not two.

### Done, with evidence

- Cloud-session credit reader: DONE. 15d1b18. skills/usage-limits/scripts/lowpri.js:101 (CLOUD_CREDIT_FLAG = tengu_swift_lynx), cloudCredit() at :344, cloudSession() at :373. Tests in test/cloud-credit.test.js: 'the cloud-session credit is read from tengu_swift_lynx...', 'an absent, malformed or empty offer is no offer at all', 'a cloud container is recognised from the environment...'. All 52 tests in cloud-credit, relay-cloud, relay-fresh and package pass on a clean export of origin/main.
- Report line: DONE. 15d1b18. usage.js:3638 prints the 'Cloud credit' line. Tests: 'at the wall with usage credits off, the report names the cloud credit...', 'with usage credits on, the wall is a cost boundary and the cloud line is not repeated there', 'the amount in the report is the one on the flag...'.
- Brief line: DONE. 15d1b18. brief.js:224 cloudCreditFor(). Tests: 'near the wall the brief names the cloud credit once, in both styles...', 'the brief offers it once a session...', 'the hook offers it only where it is the way past the wall...'.
- Cloud-session spend: DONE. 15d1b18. Tests: 'inside a cloud container the report never says to run /usage, and says what this session has cost', 'report() finds the offer in the config and prices this cloud session from its transcripts'. README:384-387 says the remaining credit is never claimed.
- Relay cloud: DONE. 15d1b18 and 945a6d3 (names the branch, handles PowerShell curly quotes). relay.js cloud() at :1924, cloudCommand :1758, cloudHandoff :1768. test/relay-cloud.test.js has 14 committed tests (hand-off, git-state warnings, PowerShell quoting, --go dry run, detached launch).
- Relay fresh (a real new session, not --resume): DONE on main. 13f7c42. wake.js freshArgs() at :276 builds no --resume; --resume is only used on the non-fresh paths (:162, :366). test/relay-fresh.test.js has 13 committed tests, e.g. 'fresh on: a new session in a window, the hand-off inline as its first prompt, no transcript needed' and 'ONE TERMINAL holds with fresh on...'.
- defer.md/relay.md describe fresh truthfully: DONE for the committed behavior (13f7c42). commands/defer.md:46-71 covers the notify/resume x fresh on/off matrix. commands/relay.md:33 covers fresh on/off. Test 'defer says what fires in each mode, and under fresh a deferral with no session id still starts' backs it.
- README/SKILL.md credit sections: DONE. README.md:364-387 ('The cloud-session credit is a third case'). README.md:527 covers relay fresh. SKILL.md:182-188 has the 'Cloud credit' section and SKILL.md:746 covers relay fresh.
- Version sync: DONE. 1.43.0 is in package.json, .claude-plugin/plugin.json, .codex-plugin/plugin.json, vscode/package.json and vscode/lib/package.json. The packaged copies in vscode/lib (gitignored) match HEAD byte for byte for every script. live.js differs only by the intended require path rewrite, and relay.js/wake.js match HEAD, not the uncommitted edits.

## /home/user/image-deep-research (branch claude/session-limits-usage-credits-dm3isz = origin/main = tag v1.0.1 = 7e055fc; it is fully merged, with 0 commits ahead of main; working tree clean; no TODO or HANDOFF file in the repo)

Items asked for: 3

### Gaps

- Reviewer note 'launch() may need --no-sandbox as root': NOT DONE, and confirmed as a real bug. browser.mjs:103-107 spawns Chrome with no --no-sandbox, and nothing checks getuid. Evidence: as root (uid 0) with IDR_BROWSER=/opt/pw-browsers/chromium-1194/chrome-linux/chrome, all 4 browser tests FAIL with 'browser did not expose a debugging port'. Chrome's own stderr says 'Running as root without --no-sandbox is not supported'. I added '--no-sandbox' only in a throwaway copy in the scratchpad, since deleted, and all 4 then PASS. So that flag is the only problem. UFS already fixed the same issue tonight: launchFlags() at ultimate-frontend-skills/scripts/inspect.mjs:302-315, commits 8b9f602 and 4d94eac, which adds --no-sandbox for uid 0 or UFS_NO_SANDBOX=1. The vendored IDR copy was never ported. So every study.mjs run and every images.mjs --sheet run fails in Docker or a cloud container. The UFS-bundled skills/image-deep-research/scripts/browser.mjs also lacks it, and it is pinned to v1.0.1, so the fix needs an IDR release (1.0.2) followed by a UFS re-sync.
- Health check, failures classified, partly done: the browser half cannot be proven in this container without the root fix. CI (.github/workflows/ci.yml) runs as a non-root user and relaxes AppArmor rather than using --no-sandbox, so CI stays green and does not catch this case.
- PRIVACY.md is partly inaccurate. (1) 'Requests carry a user agent naming the plugin' is false for moodboards: `images.mjs --sheet` without --download passes remote URLs (images.mjs:240, `src: r.file || r.url`) into headless Chrome. Those image hosts receive Chrome's UA, not image-deep-research/1.0, and PRIVACY does not mention this second network path. (2) 'open the sites you name' leaves out `study.mjs --list <name>`, which visits up to 8 curated third-party sites the user did not name (study.mjs:33-41). (3) 'written to the folder you point the scripts at' is only true with --out. The default is the system temp folder (images.mjs:218, study.mjs:200). The README gets this right; PRIVACY does not.

### Docs that say something the code does not

- There is no TODO or HANDOFF file in this repo, so no to-do ticks exist to check. The README states no test counts, so there are no stale counts.
- test/browser.test.mjs:1-3 says the browser tests 'skip only when no Chrome, Edge or Chromium exists'. As root with a browser present they hard-FAIL instead. The comment and the root behaviour disagree until --no-sandbox is added.
- The README Development section ('the browser half always runs there') is true only in CI. Locally as root, npm test either skips or fails the browser half, and the README says nothing about root or containers. UFS now documents UFS_NO_SANDBOX; IDR has no equivalent (IDR_NO_SANDBOX).
- PRIVACY.md does not cover moodboard image loads through Chrome, visits to curated --list sites, or the default temp output folder (see gaps).

### Cost and performance notes

- Port UFS launchFlags() (inspect.mjs:309-315) into browser.mjs verbatim: about 6 lines, and it unblocks every container or Docker run. Ship it as v1.0.2, re-sync UFS, and add the same uid-0 unit test UFS has.
- launch() spawns Chrome with stdio 'ignore' (browser.mjs:107), so every startup failure shows up as the opaque 'did not expose a debugging port'. Keeping the last roughly 2 KB of stderr and appending it to the error would have named the sandbox cause at once and saved debugging time.
- findBrowser's Linux candidates (browser.mjs:31-32) miss Playwright's browser folders (/opt/pw-browsers, ~/.cache/ms-playwright). Globbing those is cheap and would stop the silent 4-test skip on machines like this one, which have Chromium only there.

### Done, with evidence

- Health check, tests run: DONE for the offline suite. `npm test` gives 32 tests, 28 pass, 0 fail, 4 skipped. The 4 skipped are all in test/browser.test.mjs and skip because the default Linux candidates in skills/image-deep-research/scripts/browser.mjs:31-32 find no Chrome on this container's PATH. That is an environment cause, not a code failure. Unit, CLI, plugin-manifest and command-rule tests all pass (for example 'searchImages: one failing source is reported, not fatal', 'classify: challenge signatures decide...', 'curated lists: four registers...').
- Health check, live suite classified: `npm run test:live` failed 4 of 4 (openverse, commons, aic and met each 'answered 403'). This is the ENV, not the code: curl to api.openverse.org gets 'CONNECT tunnel failed, response 403' from this session's egress proxy.
- PRIVACY promise 'fresh profile in the system temp folder, deleted when it ends' and the 1.0.1 'browser leaves nothing in TEMP' (commit 7e055fc). Code: browser.mjs:84-88 browserEnv plus launch() at :97-99. Proof: test 'a browser run that loads a page leaves nothing at all in its temp directory', which passed here once the browser could start (see gaps).
- PRIVACY promise on the user agent: images.mjs:31-32 defines UA and UA_CONTACT. Commons gets UA_CONTACT (:128). AIC gets the AIC-User-Agent header (:133). No keys or cookies are sent. This matches PRIVACY.md.
- PRIVACY promise to read only IDR_BROWSER / ATELIER_BROWSER plus program-folder variables: a grep of process.env in scripts/ finds only browser.mjs:40 (those two) and :86 (a copy of the env passed to the browser child). This holds.
- README promises checked against code: --list and --width exist in study.mjs:185-197. The four curated lists exist (study.mjs:33-41, test 'curated lists: four registers'). Versions are 1.0.1 in package.json, .claude-plugin/plugin.json, marketplace.json and .codex-plugin/plugin.json. Tag v1.0.1 exists on origin. The README says UFS is kept in step, and /home/user/ultimate-frontend-skills/image-deep-research.lock.json pins version 1.0.1, tag v1.0.1. The Unsplash/Pexels explanation promised by the README is in SKILL.md:81.

## /home/user/atlias (ridelink0/atlias). Branch claude/session-limits-usage-credits-dm3isz is NOT merged into main. PR #1 was merged at 01:13 UTC as d5a077b (head aa34617). After that the origin branch holds 9 more commits (5a242ae..7135067). They are PR #2, which is open with head 7135067 ("Round five (cloud), part two"). The local checkout is 1 commit ahead of origin with an unpushed commit, 9e0789e (row 5, sameTextSwitch). Another session committed it at 01:57 while this audit was running. I changed nothing; the only thing I ran was git fetch. Suite at origin head 7135067, from a git archive: 1108/1111 checks in 150 suites, 0 SKIP. At 9e0789e: 1133/1134 in 156 suites. Every failure is an artifact of running from an archive: with no .git the provenance stamp check fails, and in the first run the scratch path lacked "atlias", so the codex hook-merge check failed. Neither is a code failure.

Items asked for: 16

### Gaps

- Council build (tonight's item 1, flags.council Stage A: new lib/council.mjs, `atlias council replay`, test/council-suites.mjs): NOT BUILT. There is no lib/council.mjs in the working tree, on the branch, or in the atlias-ccstudy worktree, and no commit mentions council. The only council traces are a line in docs/rounds/atlias-round-six.workflow.js:35 and the report outside the repo.
- Row 4, measurement: NOT DONE. The CC arm with both flags on against plain was never run: no flags-on results exist under evals/results/round5/cloud-cc/, and the CHANGELOG still says 'Not yet measured' for both flags. The bar (raw ratio at or below 1.05, interval excluding 1.25, no task lost) is unchecked. baseline.md says it costs about $9, and $20.59 of the study cap was set aside for it. The CanItEdit half of row 4's rationale cannot be measured in the cloud at all (huggingface.co is blocked; the corpus used polyglot and smoke tasks instead).
- Row 2: the recovery fix's effect is still unmeasured in practice. There were 0 cancellations in the cloud, so the head-versus-main ratio of 0.94 is run-to-run noise, as baseline.md itself says. The PC's transcript search of cc-token-study-0928 (cancellation causes, cache weighting) shows no evidence of being done.
- Row 1, PC part (--repeat 3 MT head-to-head): no evidence in the repo. Expected, since it is PC-owned.
- Row 3 (public score v0, README fix, default ollamaModel set to qwen2.5-coder:7b): deferred and NOT DONE. lib/core.mjs:36 still has ollamaModel 'gemma3:4b'; README.md:211 still says success is unmeasured; no packager exists.
- Rows 6 (--direct arm), 7 (HumanEvalFix v2 converter) and 8 (Ollama prompt profile, honest defaults): deferred and NOT DONE. No code exists for any of them.
- Row 5: done in code but UNPUSHED (9e0789e is local only, ahead of origin by 1). It is not in PR #2, and a coordinator decision deferred it, so it was built against the plan.
- Rows 9 (PC, 14B model) and 10 (SWE-bench spike, blocked on huggingface.co and an sb-cli key): not done, as expected.
- The critic's own advice was not acted on: F6 (claudeEffort plus a high-effort retry on red) and F7 (claude engine records usage via --output-format json) are unbuilt, and lib/agent.mjs is unchanged on the branch.

### Docs that say something the code does not

- README.md:105 says 'Over seven hundred and fifty checks in a hundred and five suites'. The branch head has 1111 checks in 150 suites, and 9e0789e has 1134 in 156.
- docs/NEXTGEN-5.md says 'Main at 41f9ba6 passes 1014 of 1014 checks in 136 suites'. That is now stale (1111/150 at the PR #2 head).
- README.md:211 still says 'Whether atlias raises task success is unmeasured'. NEXTGEN-5 flagged this line, the 59-vs-41 result exists, and row 3 was deferred, so it is still wrong.
- docs/rounds/README.md and atlias-round-six.workflow.js:35 point to docs/CLOUD-REPORT-2026-09.md and to 'tonight's reports' (councils, image research). No such file is in the repo. The reports live only in /home/user/reports/, uncommitted, so the workflow references would dangle for anyone else.
- docs/rounds/README.md says to run the workflow 'after ridelink0/atlias#2 is merged'. PR #2 is still open.
- CHANGELOG Unreleased, first bullet (transcript fallback): says 'Not yet measured in a study'. The cloud study did run it (atlias@d59aa98) and found nothing to recover because there were 0 cancellations. It should say that rather than imply no study ran.
- docs/NEXTGEN-5.md ranked table carries no status. Rows 1 (cloud part), 2 (cloud part) and 4 (build) are done, and row 5 is built locally, yet the doc reads as if nothing has landed. It is PC-owned under the ownership rules, so the PC should update it.
- The CHANGELOG entry for the sameTextSwitch flag exists only in unpushed 9e0789e. Origin's Unreleased section does not mention row 5.
- The councils report (line 11) says row 4 was uncommitted at the time of writing; its critic section (line 294) corrects that to committed at 19002d4. There are no TODO or HANDOFF files in the atlias repo to check.

### Cost and performance notes

- Run the row-4 flags-on CC arm now. The code is done and tested, it costs about $9 against the $20.59 already set aside, and it is the only thing that can show atlias below plain Claude Code in dollars. The head is 1.00x raw but 1.06x billed-equivalent, and the gap is the roughly 1.0k-token fixed text written to the cache at 2x (1-hour writes), which leanBrief attacks directly.
- Output tokens are 1.20-1.21x plain in both atlias arms, mostly from the two-pass summary lines the brief asks for (baseline.md Notes). That is why cost is 1.08x while raw prompt tokens are 1.00x. Shortening the required 'Pass 1: ... Pass 2: ...' line to a one-line form behind leanBrief is a cheap cut.
- In the baseline, the gate held a correct reply after the model ran `node lint.mjs` (it printed lint clean), because the check classifier does not treat a lint script as a check. That one false hold cost 3 rounds: 211k tokens against 115k for plain. Teaching track.isCheck to recognise a project's lint or verify script by name (with a test) removes that class of hold at almost no cost.

### Done, with evidence

- Row 1, cloud part (ledger fields, flag/env plumbing, golden test): done and on main via PR #1 (41b47ab, 871b1a9, aa34617), with 5a242ae on the branch so a flag registered after a run was saved does not split arms. Test suites 'flag plumbing expert' and 'ledger expert' (test/control-suites.mjs:45,82,125,184), and 'control expert: with every flag off the runner sends and writes what the baseline did' (test/control-suites.mjs:205, test/golden.mjs, test/fixtures/golden-flags-off.json). All pass.
- Row 2, cloud part (CC measurement of the transcript-recovery fix, three arms: plain, atlias@41f9ba6, atlias@PR head): done. Driver tools/ccstudy/* (1a74c8b, 4b236bd) with tools/ccstudy/test.mjs. Results in a8ce7a2, evals/results/round5/cloud-cc/2026-09-29-baseline.md: 50 tasks x 3 arms, all 50/50 solved. Raw ratio 1.07 (0.97-1.18) at 41f9ba6 and 1.00 (0.94-1.06) at head d59aa98; billed-equivalent 1.09 and 1.06. $13.41 spent. Caveat: 0 of 1,037 hook calls were cancelled, so the recovery fix had nothing to recover and its effect is still unproven.
- Row 2 follow-on (raise the PreToolUse/PostToolUse timeouts in the same PR): done on main as 29a018d. Timeouts go to 30 s, PostToolUse is narrowed to the edit, shell and read tools, and PostToolUseFailure to the shell tools. Test suite: 'hook budget expert: the tool hooks have room, and fire where they do something' (passes).
- Row 4, build: lean brief behind flags.leanBrief (614c0f3, lib/brief.mjs) and gate-runs-the-check behind flags.gateRunsCheck (c7b7587, hardened in 19002d4 and 7135067, lib/gate.mjs; 10 s bound at lib/gate.mjs:148 GATE_CHECK_MS). Tests: test/lean-suites.mjs:25,44,60 check the brief shrinks by at least 350 characters to under 1000, and skill descriptions are at most 200 characters. test/gatecheck-suites.mjs:52,89,112,142 use check.py and canitedit_check.py fixtures (6 references) and include 'the check is stopped at its bound, and off changes nothing'. All pass.
- 3.8.1 'what is left', cancelled hooks: addressed three ways (transcript fallback fd92b54/6c710ae, 30 s timeouts, narrowed matchers). The cloud study saw 0 cancellations out of 1,037 hook calls.
- 3.8.1 'what is left', fixed text of about 1.3k per call: code is done behind leanBrief. The cloud baseline independently measured it at a median 1.0k extra prompt tokens per round (baseline.md Notes).
- 3.8.1 'what is left', edit and check not sent together: made unnecessary under gateRunsCheck. When the gate can name a check, the brief drops the pairing instruction (lean-suites 'the brief says when the gate will run the check').
- Unreleased CHANGELOG entry: every bullet matches code on the branch (transcript fallback, hook timeouts and matchers, flag plumbing, leanBrief, gateRunsCheck, ledger, golden test). Each is covered by the passing suites named above.
- Row 5 (deferred tonight by the coordinator): BUILT anyway, but only locally in unpushed commit 9e0789e (lib/loop.mjs +187, test/sametext-suites.mjs, 6 'same text expert' suites, all passing at 9e0789e). It is not on origin or in PR #2, and it has not been measured.
- Council research, honest opinion and cost critic: done as a report, '/home/user/reports/Atlias councils and UFS packs.md'. Its verdict is 'Let the check pick, not the council': check-selected retry on red behind flags.council, Stage A (replay only) tonight. Its 'Cost and performance review' section (line 292) is the lowest-price/biggest-performance critic, with F1-F12. Supporting notes are in /home/user/research_notes/Atlias councils and UFS packs/.

## /home/user/ultimate-frontend-skills (branch claude/session-limits-usage-credits-dm3isz; origin head d1fc7d6, NOT merged into default branch master e4be318; 7 commits ahead as draft PR #1. Local checkout is at fbd1293 = cb22a2b + item-2 commit, diverged from origin (lacks d1fc7d6), unpushed)

Items asked for: 18

### Gaps

- Plan build-queue item 3 (external detectors: tells --external running impeccable@4.1.0 and slop-detect 0.5.2, plus an agreement table) -> NOT DONE. There is no data/detector-map.json, and there is no '--external' in scripts/ or commands/.
- Plan build-queue item 4 (atelier A/B harness: evals/atelier-briefs-v1.json, arms.json, ab run/render/grade/cost/packet/tally, --dry) -> NOT DONE. No evals/ directory, no ab subcommand, no test/ab.test.mjs.
- Plan build-queue item 5 (--direction card, ufs-direction/1, validation and parity) -> NOT DONE. 'ufs-direction' and '--direction' are absent from scripts/ and commands/, and there is no test/fixtures/cards.
- Tonight's packs item (councils report, build item 2: GSAP vendored, three entries refreshed, Hallmark registered, licences travel, packs refresh, UFS_PACKS_FILE) -> NOT BUILT. packs.json still has 12 entries with no gsap and no hallmark; scripts/packs.mjs has no UFS_PACKS_FILE, refresh or NOTICE handling; packs/ holds only bergside and playwright-cli; there is no branch or worktree for it. None of U1-U8 exist.
- Plan ranked cloud items 6 (a $18 pilot) and 17-20 (axe-core/accessibility.md, frameworks.md plus a stale-pattern lint, a web-features Baseline gate, INP/hydration gate) -> NOT DONE. No axe-core, web-features or Event-Timing code in scripts/, and no accessibility.md or frameworks.md in references/. These were not in the 5-item 'build now' queue. Items 12-16 are atlias-side and were not audited here.
- DR #4 prune or auto-flag dead corpus links -> PARTLY. awards.mjs tracks dead/verified (scripts/awards.mjs:54-107), but CREDITS.md still carries 4 hand-written '(offline when last checked)' rows (CREDITS.md:103,278,294,329) instead of pruning or flagging them from the data.
- DR #6 Codex parity: interface metadata plus a Codex equivalent of the UserPromptSubmit nudge -> PARTLY. .codex-plugin/plugin.json has interface and skills, but no hook. hooks/hooks.json and nudge.mjs serve Claude only, and no doc or CHANGELOG line explains the missing Codex nudge.
- DR #7 CI field-parity test across plugin.json, codex plugin.json AND marketplace.json -> PARTLY. The test checks marketplace for version only. Live drift exists: marketplace.json plugins[0].description ('...editorial websites the way...') differs from plugin.json's ('...editorial websites, app screens and game start screens the way...').
- DR #8 line-level correctness audit of typography.md/motion.md/imagery.md -> NOT DONE. It is carried as plan item 25 ('typography.md line-level CSS audit'), and no commit claims it.
- DR #9 real game/app chassis, or softer 'three surfaces' wording -> PARTLY. The 'three surfaces, same chassis' phrasing is gone from README and SKILL.md, but no game or app chassis exists (carried as plan item 25).
- Test hygiene (contradicts 6.7.0's 'nothing left in TEMP'): test/args-game.test.mjs:23-29 and :30-35 mkdtemp 'ufs-game-' and 'ufs-page-' dirs and never rmSync them. The other two tests rm outside a finally, so a failing assert leaks too. /tmp currently holds about 55 such dirs from tonight's runs.

### Docs that say something the code does not

- PR #1 body is stale. It says 'the top items get built as 6.9.0' and reports 'test:fast: 235 tests' from 6.8.1, but 6.9.0 (item 1) has already shipped on the branch and item 2 is committed locally. The body does not list either.
- CHANGELOG '## 6.9.0' has been extended with 'Item 2: the rendered tells' in local commit fbd1293, while 6.9.0 was already pushed at 4d94eac without it. The same version number now names two different contents. package.json, both manifests and the marketplace entry are still 6.9.0 with no bump.
- Local branch diverged from origin: local fbd1293 is on cb22a2b, origin is at d1fc7d6. The HEAD the coordinator described as cb22a2b is behind origin by one commit.
- marketplace.json plugins[0].description does not match .claude-plugin/plugin.json's or .codex-plugin/plugin.json's description (it lacks 'app screens and game start screens'). The parity test does not cover it.
- No TODO or HANDOFF file exists in UFS (docs/HANDOFF-v5.md was removed in 594c72c). The live to-do lists are the two reports in /home/user/reports and docs/field-tests/doodle-voyager.md. Nothing there is ticked, so ticked-but-not-done cannot occur, but the plan's build queue has no status marks at all, even for items 1 and 2.
- Plan item 2's acceptance list for bone names 6 fires. test/tells-expected.mjs expects 7 (it adds decorative-numbering), and ink expects 7. The tests are stricter than the plan, which is fine, but the plan text is now out of date.

### Cost and performance notes

- CI runs twice on every push to a PR branch: .github/workflows/regression.yml:2 has 'on: [push, pull_request]', and PR #1 shows two identical ubuntu+windows runs on d1fc7d6 (36508356006 and 36508349829, about 8-10 min each on Windows). Limiting push to master (or adding a concurrency group) halves Actions minutes.
- The bergside pack costs about 2.1k tokens on every request once installed (67 skills, 8,404 description characters, measured in the councils report). Handshake installs use --all. Installing bergside as one index skill, and passing `-s <registered skills>` instead of `--all` (scripts/packs.mjs:141-145), are both cheap and cut per-request tokens.
- Wrap the mkdtemp in test/args-game.test.mjs in try/finally or t.after(rmSync) (2 tests never clean up). This stops about 2 dirs leaking per run, which adds up on a CI or dev box and repeats the DV-29 TEMP complaint.

### Done, with evidence

- Plan build-queue item 1 (headless render in cloud container) -> DONE. Commits 8b9f602, 4d94eac (6.9.0), cb22a2b, d1fc7d6. Playwright roots at scripts/inspect.mjs:63; --no-sandbox for uid 0 or UFS_NO_SANDBOX=1 at scripts/inspect.mjs:314; env class at scripts/inspect.mjs:1355-1388 (ERR_CERT/TUNNEL/PROXY, undeclared favicon, UFS_ENV_HOSTS); VERIFY_SCHEMA 'ufs-verify/1' at scripts/verify.mjs:176; browser skip helper test/need-browser.mjs:21 (throws under UFS_REQUIRE_BROWSER=1 or CI). Tests: test/headless.test.mjs 'root gets --no-sandbox...', 'the newest revision wins...', 'the Playwright search is Linux only, and the Windows and macOS lists are unchanged'; test/env.test.mjs 'err.html still reports its three errors at each width...', 'a third-party request that fails TLS is env: verify exits the same...'. PR #1 check runs on d1fc7d6 green on ubuntu-latest and windows-latest (runs 36508356006, 36508349829), and CI=browser-required. Minor gap: no test for the literal acceptance 'look writes the four PNGs (1440, 1440@600, 390, 390@600) as root'. Rendering as root does work: the tells-render browser tests pass here as root.
- Plan build-queue item 2 (rendered tells vector, atelier) -> DONE LOCALLY ONLY: commit fbd1293 (42 files, +2229), not pushed, and it sits on cb22a2b, not origin's d1fc7d6, so it needs a rebase before it can be pushed. It includes scripts/tells-render.mjs, data/tells-render.json, scripts/sections.mjs, 29 fixtures in test/fixtures/tells-render (a fire/nofire pair for all 14 features plus restrained.html), test/tells-expected.mjs (the explicit expected-fires list per preset), SLOP_FONTS +5 faces (scripts/audit.mjs:163), 8 ai-tells.json rows with ufs_chassis_ships_it:true, and tells.md cream wording (tells.md:35-62,205). I ran `node --test test/tells-render.test.mjs` just now: 9/9 ok with a real browser. That covers fixtures at 1440/390, each preset's expected list in ufs-tells/1 inside 15 s, and no cross-origin fetch.
- games.md width rule (Doodle Voyager DV-1) -> DONE. 6.3.0 dc48c12 (--game), 6.8.1 5fecc3c/06111e4 (a canvas with keys defaults to 1366,1280,1920; touch adds 390), 7983bb2 (follows relative imports, so Voyager's js/game.js is found). games.md item 5 names 1366x768/1280x720/1920x1080. Tests: test/args-game.test.mjs 'a canvas game with keyboard controls defaults to the game widths', 'the keys are found in a module the page script imports, as in Doodle Voyager', 'a vendored OrbitControls ... stays a page'. Mapped in docs/field-tests/doodle-voyager.md:42-54.
- DR #1 manifest drift Claude/Codex -> DONE (ef13bc6). test/regression.test.mjs 'the Claude and Codex plugin manifests agree on every shared field'. $schema stays Claude-side on purpose, with the reason in the test comment.
- DR #2 AGENTS.md lists commands/security-check -> DONE (AGENTS.md:69).
- DR #3 corpus licence/fair-use statement -> DONE (ef13bc6; CREDITS.md:1-10: no copying, removal on request, MIT covers only the plugin's own files).
- DR #5 impeccable naming collision and 'Anthropic Sans' claim in the bergside pack -> DONE (packs/bergside-awesome-design-skills/UFS-NOTES.md:18-19; claude/SKILL.md:22,25 says 'not on Google Fonts; no source upstream').
- DR #10 trim SKILL.md -> DONE (b3c7063, 6.8.0: 24 KB to 12 KB; SKILL.md is 12,147 bytes now).
- PR ridelink0/ultimate-frontend-skills#1 -> exists: open, draft, not merged, mergeable_state clean, head d1fc7d6, base master e4be318, 7 commits, all 4 check runs success.
