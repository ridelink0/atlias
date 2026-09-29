# Shrink the pictures, keep atlias silent

Bring image deep research (IDR) into atlias as a companion that atlias detects, installs and checks, but never describes to the model on an ordinary call, and put the token savings inside IDR itself. Today one typical IDR use in the main thread (the skill body, a 24-result table, three moodboard sheets and two close-ups) puts **about 15.2-16.3k tokens** into context. More than half of that is three contact sheets at **2,852 image tokens each**, and all of it stays in the conversation and is re-sent on every later call. A `--compact` output mode cuts one use to **about 6.4-7.1k tokens (−56 to −58%)**. It draws one 1288×812 sheet that costs **exactly 1,334 tokens on every Claude model**, prints one text line per result, and leaves URLs in `results.json` for a `--pick` command. Running the research in a subagent could cut what stays in the main thread to **about 1k**, but the subagent's own fixed cost has never been measured, so that is an experiment, not a default. "Seamless" in atlias means four things. `atlias install --companions` already brings IDR, because ultimate-frontend-skills (UFS) has bundled it since 6.5.0. `atlias doctor` catches the runtime failures that actually happen, such as Chrome refusing to start as root in this container. atlias never installs a second copy. And a one-time hint of **at most 200 characters** fires only on visual prompts, behind a default-off flag. Non-visual prompts cost zero added tokens by construction: atlias's session brief is not touched, and the router returns exactly what it returns today. Byte-identical snapshot tests enforce both. One premise from the task was wrong: the "width × height / 750" rule is not Anthropic's current formula. The documented cost is **⌈w/28⌉ × ⌈h/28⌉** visual tokens.

## One moodboard round costs 15-16k tokens, and it stays in context

The price of a picture is now exact. Anthropic's vision docs cost an image as **⌈width/28⌉ × ⌈height/28⌉ visual tokens**. Claude 4.7 and later models (Sonnet 5 and Opus 5.5 among them) use a high-resolution tier capped at a 2,576 px long edge and 4,784 tokens. All other models use a standard tier capped at 1,568 px and 1,568 tokens. The docs warn that high-res "can use up to roughly three times more visual tokens" and advise downsampling when the extra fidelity is not needed ([Anthropic vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)). IDR's contact sheet is built from constants: `PER_SHEET = 8`, `COLS = 4`, 640×400 cells, a 6 px gap and JPEG quality 84 ([sheet.mjs:13-16, 43-68](file:///home/user/image-deep-research/skills/image-deep-research/scripts/sheet.mjs)). The shipped sample sheet measures **2590×866 px and 324,195 bytes** (`docs/img/moodboard-cypress-trees.jpg`). That is 14 px wider than the high-res cap, so the server shrinks it to 2576×861, and it bills **92 × 31 = 2,852 tokens**. A single 1440×900 site screenshot costs 52 × 33 = 1,716. Per tile, the sheet is already IDR's cheapest pixel format.

The loop is what multiplies the cost. IDR's skill asks for rounds: "Refine and go again... Stop when a new round stops changing the answer". It also forbids describing any image the model has not opened ([SKILL.md:28-41, 127](file:///home/user/image-deep-research/skills/image-deep-research/SKILL.md)). A default moodboard run queries four sources with `--n 6` each, so it can return 24 results, which fill three sheets ([images.mjs:179-185, 217](file:///home/user/image-deep-research/skills/image-deep-research/scripts/images.mjs)). I rebuilt that table from the test fixtures recorded from the four real APIs. It prints **8,415 characters over 77 lines**, because every result carries two full URLs ([images.mjs:193-205](file:///home/user/image-deep-research/skills/image-deep-research/scripts/images.mjs)). Claude Code's docs say an invoked skill's content "enters the conversation as a single message and stays there across later turns" ([Claude Code skills docs](https://code.claude.com/docs/en/skills)). The vision docs say each request "resends the full conversation history", and Claude "has access to every image from earlier turns" ([Anthropic vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)). A single IDR round therefore behaves like a permanent addition to the prompt. atlias measures one Claude Code round at **about 30k prompt tokens**, and atlias already costs **1.25×** plain Claude Code's prompt tokens per solved task ([NEXTGEN-5.md:46-50](file:///home/user/atlias/docs/NEXTGEN-5.md)). So one uncompressed moodboard round left in context adds roughly half a round's worth of tokens to every call that follows.

There is also a fixed cost that atlias neither causes nor can remove. For any user who has UFS, Claude Code lists IDR's 481-character description and UFS's 212-character `visual-research` alias on every call, because by default "Description always in context, full skill loads when invoked" ([Claude Code skills docs](https://code.claude.com/docs/en/skills); [UFS skills/visual-research/SKILL.md:3](file:///home/user/ultimate-frontend-skills/skills/visual-research/SKILL.md)). That is about 170-225 tokens per call before anyone asks a visual question. The same docs say `disable-model-invocation: true` leaves a skill's "Description not in context". A one-line UFS change on the alias would therefore save about 53-69 tokens on every call of every UFS session. That is more per session than atlias's whole integration costs on a visual prompt.

## A 1,334-token sheet with text captions cuts a round by 57%

The compact mode rests on one observation: tokens are paid per 28-pixel patch, so a sheet saves only by shrinking tiles, and pixels spent on captions are the most wasteful pixels of all. IDR already measures everything a coding agent needs as numbers. `study.mjs` reads computed font family, size, weight, line height and letter spacing, and samples the palette through canvas ([study.mjs:78, 109](file:///home/user/image-deep-research/skills/image-deep-research/scripts/study.mjs)). `images.mjs` keeps URL, licence, creator and page for every result. So the compact sheet carries only a number badge on each tile, and everything else goes out as text.

The proposed geometry is a 4×4 grid of 317×198 cells with a 4 px gap and padding, which comes to **1288×812 px: exactly 46 × 29 patches, 1,334 tokens**. It fits under the standard tier's 1,568-token cap and under 2,000 px on each side. That means no model downscales it, and it stays inside Anthropic's rule for requests holding more than 20 images: above that count, any image over the stricter per-image limit is rejected with an `invalid_request_error`, and the documented safe size is 2,000 px per side, which today's 2,590 px sheets exceed ([Anthropic vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)). Each tile costs about 83 tokens, against 356 today. The compact text line per result (number, source, licence, title, creator, no URLs) measured **1,580 characters for 16 results** on the same fixtures, against 8,415 characters for today's 24. The one risk is legibility. Anthropic warns that Claude "might hallucinate or make mistakes when interpreting... very small images under 200 pixels", and a 198 px tile sits at that edge. That is fine for composition, mood and palette triage but not for reading type. Type comes from `study.mjs`'s measurements, and a close-up is the escape hatch.

Building this exposed a real bug worth fixing in the same change. Today's table numbers every result, failures included ([images.mjs:197-199](file:///home/user/image-deep-research/skills/image-deep-research/scripts/images.mjs)). The sheet receives only verified results ([images.mjs:242-243](file:///home/user/image-deep-research/skills/image-deep-research/scripts/images.mjs)) and renumbers them by position ([sheet.mjs:22-28](file:///home/user/image-deep-research/skills/image-deep-research/scripts/sheet.mjs)). So once any earlier result fails, "tile 5" and legend line "05" name different images. A design that replaces pixel captions with text lines has to get that mapping right.

Claude Code's image reader gives a second reason to cap file size. Issue #70010 (closed, with no visible fix) reports that the Read tool estimated image tokens as `ceil(base64.length × 0.125)`. That rule shrank a 1280×713 screenshot under the default 25,000-token read budget ([claude-code #70010](https://github.com/anthropics/claude-code/issues/70010)). By that rule, today's 324 KB sheet "estimates" at about 54k and would be silently downscaled. A sheet at or under **150,000 bytes** estimates at or under 25,000 whether or not the bug still ships, so the model sees exactly what IDR drew.

**Cost per typical use.** Assumptions: a Claude 4.7+ model (Sonnet 5, Opus 5.5); one moodboard round in the main thread; text tokens estimated at characters ÷ 4, up to ×1.3 for the 4.7+ tokenizer's "approximately 30% more tokens" ([Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)); image tokens exact from the formula. Each row adds one change to the row above it.

| Change | Arithmetic | Enters context once | Re-sent over 20 later calls |
|---|---|---|---|
| **Today** (IDR 1.0.1) | SKILL.md 6,552 B → 1,638-2,129; table 8,415 ch → 2,104-2,735; 3 sheets × 2,852 = 8,556; 2 close-ups (Commons 1280×853) × (46×31 = 1,426) = 2,852 | **15,150-16,272** | 303-325k |
| + atlias hint, IDR 1.0.1 (plain line, 109 ch) | + 27-35 | 15,177-16,307 | 304-326k |
| + IDR `--compact` (4 per source, 16 results) | SKILL.md 7,152 B → 1,788-2,324; text 1,580 ch → 395-514; 1 sheet 46×29 = 1,334; close-ups 2,852; hint 200 ch → 50-65 | **6,419-7,089 (−56 to −58%)** | 128-142k |
| + one close-up instead of two (SKILL.md guidance, not enforced) | − 1,426 | 4,993-5,663 (−65 to −67%) | 100-113k |
| + research in a subagent | main thread keeps hint 50-65, an Agent call of about 100-200 and a returned report of about 600-1,000 (estimates); the subagent spends about 5-7k plus its own fixed cost per call (unmeasured) | **about 750-1,265 in the main thread** | 15-25k |
| Non-visual prompt, any row | router returns null; brief unchanged | **0** | 0 |

A website study round follows the same pattern. Eight sites at two scroll positions today cost 1,638-2,129 for the skill, 2,082 characters of text (229 per site, measured with a real-shaped probe) → 521-677, and two sheets at 5,704, for **7,863-8,510**. The compact form costs 1,788-2,324 for the skill, at most 160 characters per site (1,530 characters → 383-497) and one 1,334-token sheet, for **3,505-4,155 (−51 to −55%)**. On standard-tier models the saving is smaller: today's sheet already shrinks to 1,064 tokens there, but three of them still cost 3,192 against the compact 1,334. In dollars at Opus 5.5's $4 per million input tokens with cache hits at $0.20, the first pass falls from about 6 cents to under 3 cents per round, and the re-sends are cheap. The re-send column matters for atlias's own metric, raw prompt tokens per solved task, and for how soon a session hits compaction.

## Isolation beats compression once a session keeps going

Compression shrinks what stays. Isolation stops it from staying at all. Claude Code supports this in two ways. The model can delegate to a subagent, or a skill can declare `context: fork`, which "starts a new subagent... and gives it the skill content as its prompt", with only the result arriving back in the conversation ([Claude Code skills docs](https://code.claude.com/docs/en/skills)). Neither is free. The subagent sends its own system prompt and tools on every one of its calls, and nobody has measured that fixed cost (call it F) for Claude Code. The arithmetic still favours isolation under mild assumptions. Doing a four-call research round in the main thread re-sends the main context M four times, while delegating sends it once and pays F four times. The research phase is therefore cheaper in a subagent whenever **4F < 3M, that is F under about 22.5k at atlias's measured M ≈ 30k**. Every later main-thread call then saves another 5-6k over the compact in-thread path. This is an inference from a measured M and an unmeasured F. It should be settled with the headless Claude Code study driver atlias already has (`ccstudy`, commit `1a74c8b`) before anything changes for users.

The two routes differ in who pays for the change. Adding `context: fork` to IDR's own frontmatter would make isolation automatic, with no atlias text at all. But it changes IDR for every standalone and UFS user. A forked subagent "doesn't see your conversation history", runs in the background by default, uses "the narrower tool set that applies to background subagents", and cannot ask the one clarifying question IDR's skill asks when the request is empty ([Claude Code skills docs](https://code.claude.com/docs/en/skills); [SKILL.md:14-15](file:///home/user/image-deep-research/skills/image-deep-research/SKILL.md)). The cheaper experiment is an atlias flag variant. Its hint asks the model to run IDR `--compact` in a subagent and bring back paths, licences, hex values and one move per reference. If a study shows it beats the compact in-thread arm on tokens with no loss in outcome, IDR can adopt `context: fork` with `background: false` knowing the effect.

## atlias adds detection, not text

atlias has no concept of images today: no file in `lib/`, `bin/`, `hooks/`, `mcp/` or `skills/` mentions an image or a screenshot. It knows two companions, UFS through `UFS_NAMES`/`ufsCopies()` and graphify ([core.mjs:403-434](file:///home/user/atlias/lib/core.mjs)). That turns out to be almost enough, because UFS has bundled IDR since **6.5.0 (2026-09-25)** and ships it at v1.0.1 under a per-file sha256 lock. UFS warns that also installing the standalone IDR plugin lists the skill twice ([UFS CHANGELOG.md:127-136](file:///home/user/ultimate-frontend-skills/CHANGELOG.md); [image-deep-research.lock.json](file:///home/user/ultimate-frontend-skills/image-deep-research.lock.json); [UFS scripts/tools.mjs:85-92](file:///home/user/ultimate-frontend-skills/scripts/tools.mjs)). `atlias install --companions` already installs UFS when no copy loads ([hosts.mjs:231-249](file:///home/user/atlias/lib/hosts.mjs)). The install side of "seamless" is therefore a report ("image-deep-research: present via ultimate-frontend-skills") plus a rule never to add the standalone plugin where UFS is loaded, since a duplicate would cost about 120-156 tokens on every call.

The runtime side needs real work, because that is where IDR breaks. IDR needs Node 22 and Chrome, Edge or Chromium ([SKILL.md:21-24](file:///home/user/image-deep-research/skills/image-deep-research/SKILL.md)), while `atlias doctor` checks only Node 18+ ([hosts.mjs:255](file:///home/user/atlias/lib/hosts.mjs)). In this container IDR's suite passes 28 of 32 with its 4 browser tests skipped, because `findBrowser()` does not look in `/opt/pw-browsers`. Pointing `IDR_BROWSER` at the Playwright Chromium there fails all 4 with "browser did not expose a debugging port", because Chrome will not start as root without `--no-sandbox` ([browser.mjs:38-44, 94-106](file:///home/user/image-deep-research/skills/image-deep-research/scripts/browser.mjs)). A wrapper that adds that flag passes 4 of 4 (all three runs were made on 2026-09-29). Doctor rows cost the model nothing, and they catch exactly this.

The model-facing part is one optional line. atlias's router already runs this way: it injects "only when it replaces more expensive work", returns null for `skip` and `other`, and hints UFS once per session on a frontend regex ([router.mjs:1-3, 8-17, 40-57](file:///home/user/atlias/lib/router.mjs)). A visual branch copies that pattern. It is gated on a new `flags.visualHint` (default `off`, with values `compact` and `subagent` so one install serves both study arms through `ATLIAS_FLAG_VISUAL_HINT`) and on the existing `router.companions` switch. It fires at most once per session, and its text is at most 200 characters. Ordering matters, because `CODEBASE_RE` is tested first and matches "how does… look" ([router.mjs:8, 13-15](file:///home/user/atlias/lib/router.mjs)). So the visual test runs before it, but only on strong visual phrases, only when `FRONTEND_RE` does not also match (UFS already covers that case), and never when the prompt names code (a file extension, `src/`, "function", "test", "defined"). For scale: the session brief the lean-brief work is trimming measured **1,357 characters with every flag off and 961 lean** on an empty project, and the brief is paid on every call ([test/lean-suites.mjs:3-4](file:///home/user/atlias/test/lean-suites.mjs), uncommitted working tree).

**The zero-token guarantee is structural first and tested second.** Five parts make it hold, each with its own test:

- **Brief.** SessionStart never calls the IDR detector and `lib/brief.mjs` is not edited. A test builds the brief with IDR absent, bundled and standalone, flag off and on, and asserts identical bytes. That file is also being rewritten by the uncommitted lean-brief work, which is a second reason to leave it alone.
- **Router.** `classify(prompt)` with no options returns exactly what it returns today. A committed snapshot of `prompt()` output over a labelled corpus is taken before the change. After it, every non-visual prompt must produce identical output with the flag off and with each flag value on. The corpus holds at least 60 non-visual prompts, including hard negatives like "where is the color palette defined" and "fix the failing screenshot test".
- **Detection cost.** The detector runs only after a prompt has classified as visual, so ordinary prompts do not even pay file-system time. An injected-dependency counter proves it.
- **Listing.** atlias ships no new skill, command or MCP tool. A snapshot of `skills/*/SKILL.md` and of the MCP tool names proves it.
- **Install.** A plan matrix proves atlias never adds the standalone plugin where UFS is loaded, so no duplicate description reaches the listing.

These tests spend no model tokens. A `ccstudy` confirmation on the existing Claude Code baseline is optional, costs plan usage, and should show zero `hint:visual` events.

## Could not be verified, and what was refuted

**Refuted.** The coordinator's "roughly width × height / 750 tokens per image" is not Anthropic's current rule. The docs define ⌈w/28⌉ × ⌈h/28⌉ (about w·h/784) with per-tier caps ([Anthropic vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)). The internal audit's per-sheet figure of about 2,957 tokens, derived from the old rule, is superseded by 2,852.

**Unverified.** These points could not be confirmed:

- Whether Claude Code's Read tool still uses the base64-length estimator after #70010 was closed, and the issue's "320×178 at a 5,000 budget" detail. The 150 KB cap is insurance either way.
- The subagent fixed cost F, and whether the background-subagent tool set includes Bash.
- Whether Claude Code de-duplicates two same-named skills from different plugins. UFS says they are "listed twice", but no one checked this independently.
- Whether `installed_plugins.json` records an `installPath` per plugin. The atlias spec below tolerates its absence.
- Whether atlias's router hint reaches Codex prompts at all.
- Whether 317×198 tiles are enough for design triage. No benchmark compares caption-only, low-resolution and full-resolution references for frontend outcomes.
- VisualWebArena's 16.4% best-agent figure and its Set-of-Marks delta (only the ~89% human rate was confirmed).
- Blog-level figures on pHash and CLIP deduplication thresholds, SigLIP precision, and Playwright snapshot token ranges.
- All text-token counts in this report. They are character measurements converted at ÷4 to ×1.3; no tokenizer was run.

## Conclusion

The instinct to make atlias "know about" image research by telling the model about it is exactly wrong for a harness whose round-five job is removing per-call text. The integration that serves Gev's two goals splits the work by who pays. Savings belong in IDR, where one change reaches standalone, UFS and atlias users alike and costs nothing until a picture is actually wanted. atlias's contribution is the plumbing no model sees: detection, a never-twice install, and doctor rows for the Node and browser failures that actually occur. It adds a single 200-character line only when a prompt is visibly about pictures, and only under a flag a study can switch.

The deeper finding is that the expensive part of image research is not looking; it is remembering. A compact sheet makes each look about 57% cheaper. Isolation makes the memory nearly free, and whether it pays for its own overhead is now a measurable question with a known threshold (F under about 22.5k tokens per call) rather than a design argument.

## Build queue for tonight

Two items, one per repository, each sized for one agent in one sitting. Neither item's tests spend model tokens: both suites are deterministic `node` runs. Behaviour that the model sees is off by default or opt-in.

### 1. atlias: image-deep-research as a silent companion (about 4 hours, atlias repo)

**Why.** atlias has no IDR awareness, doctor misses IDR's Node 22 and browser needs, and a visual prompt that contains "how does" is routed to the graph (router.mjs:8, 13-15). All of this has to arrive without adding a byte to the brief or to non-visual prompts.

**Branching.** The working tree on 2026-09-29 carries uncommitted lean-brief edits to `lib/brief.mjs`, `lib/core.mjs` (the `DEFAULTS.flags` line), `lib/settings.mjs` and `lib/gate.mjs`, plus untracked `test/lean-suites.mjs` and `test/gatecheck-suites.mjs`. Build on top of the commit that lands them (round five's PR-2), or rebase onto it before opening the PR. Do not edit `lib/brief.mjs`.

**Spec.**
1. **`lib/core.mjs`, detection.**
   - Add `IDR_NAMES = ['image-deep-research']` and `idrCopies(deps = {})`, modelled on `ufsCopies()` at core.mjs:409-433 and taking the same injectable `claudeDir`, `home`, `exists` and `cwd`.
   - It returns `{ kind, name, where, loaded, dir, compact }` for each of these:
     - an `image-deep-research@*` key in the merged `enabledPlugins` or in `installed_plugins.json` (`kind: 'plugin'`);
     - an `image-deep-research/SKILL.md` in `~/.claude/skills` or `<project>/.claude/skills` (loaded) or `~/.agents/skills` (not loaded) (`kind: 'skills'`);
     - one `kind: 'bundled'` entry per loaded UFS copy.
   - For a bundled entry, resolve `dir` from the UFS entry's `installPath` in `installed_plugins.json` when present (accept a string, or an array whose first element has `installPath`), then check `<installPath>/skills/image-deep-research/SKILL.md`. If that is missing, return `dir: null` and `compact: null`.
   - `compact` is `true` when the found SKILL.md contains `--compact`.
2. **`lib/core.mjs`, install plan.** Add `idrInstallPlan(idr, ufsPlan)`, returning `{ install: false, say }` in every case:
   - more than one loaded copy: "image-deep-research: loaded N times (…); keep one; with ultimate-frontend-skills on, uninstall the standalone plugin";
   - one copy: "present (<where>)";
   - none loaded while UFS is about to be installed: "comes with ultimate-frontend-skills";
   - UFS loaded but no bundled copy found and `dir` resolvable: "update ultimate-frontend-skills (6.5.0+ bundles it)";
   - standalone installed but disabled: "enable it".
   - atlias never runs `claude plugin install image-deep-research@…`.
3. **Flag.** Register `visualHint: 'off'` in `DEFAULTS.flags` and `CHOICES.flags.visualHint = ['off', 'compact', 'subagent']` (the CHOICES mechanism at core.mjs:38-40). Add a `DESCRIPTIONS['flags.visualHint']` entry in `lib/settings.mjs`. The environment name is `ATLIAS_FLAG_VISUAL_HINT` via `flagEnvName`.
4. **`lib/router.mjs`.**
   - Export `VISUAL_RE`. It uses strong phrases only: mood board(s); reference images/photos/pictures; visual research/references/inspiration; design references/inspiration; contact sheet; find/show/pull images|photos of|for; what do(es) … look like; screenshots/renders of … sites/homepages; competitor sites; public-domain, CC0 or licensed images/photos.
   - Export `CODE_GUARD_RE` for file extensions, `src/`, and the words function, component, test, endpoint, bug, error, defined and refactor.
   - Change `classify(prompt, { visual = false } = {})`. The visual check runs after `skip` and before `CODEBASE_RE`, and returns `'visual'` only when `visual && VISUAL_RE.test(p) && !FRONTEND_RE.test(p) && !CODE_GUARD_RE.test(p)`.
   - In `prompt()`, pass `visual: cfg.router.companions && cfg.flags.visualHint !== 'off'`. On `'visual'` with no `meta.hintedVisual`: save `hintedVisual: true`, `recordEvent(sid, { kind: 'hint', hint: 'visual', variant })`, then call `idrCopies({ cwd })` and `ufsCopies({ cwd })` and return `visualHintText(variant, state)`.
   - The five texts are all under 200 characters:

| State | Text |
|---|---|
| compact | "[atlias] Visual research: use the image-deep-research skill with --compact first (one numbered sheet, at most 1,334 image tokens); open a full image only for what the sheet and its text cannot answer." |
| subagent | "[atlias] Visual research: run image-deep-research --compact in a subagent and have it return paths, licences, hex values and one move per reference, not images." |
| plain (IDR without `--compact`; drop "--compact" from the subagent text too) | "[atlias] Visual research: use the image-deep-research skill; read its contact sheets before any single image." |
| absent, no UFS | "[atlias] Visual research, and image-deep-research is not installed. Offer: atlias install --companions (adds ultimate-frontend-skills, which bundles it)." |
| old UFS | "[atlias] Visual research: this ultimate-frontend-skills predates its bundled image-deep-research (6.5.0+); offer to update it." |

5. **`lib/hosts.mjs`.**
   - `installCompanions()` appends `idrInstallPlan(...).say` after the UFS line.
   - `doctor()` adds these rows:
     - "image-deep-research", ok when at least one copy loads; fix `atlias install --companions`.
     - "one copy of image-deep-research", only when more than one loads.
     - "node 22+ for image-deep-research", only when a copy loads.
     - "browser for image-deep-research", only when a copy's `dir` is known. It runs `spawnSync(process.execPath, ['--input-type=module', '-e', <import(dir/scripts/browser.mjs).findBrowser()>])` with a 5 s timeout, so the check uses IDR's own lookup. On a miss, the fix names `IDR_BROWSER` and, on Linux, any `/opt/pw-browsers/chromium-*/chrome-linux/chrome` or `~/.cache/ms-playwright/…` that exists. When `process.getuid?.() === 0`, it adds "Chrome needs --no-sandbox as root (IDR 1.1.0 adds it)".
6. **Tests.** New `test/visual-suites.mjs`, following the `withEnv` and fixture pattern of `test/lean-suites.mjs`. New `test/fixtures/visual-prompts.json` with at least 30 visual and at least 60 non-visual prompts, labelled by category. New `test/fixtures/router-before.json`, captured from the pre-change code with a small script committed alongside it.

| Acceptance test | Pass condition |
|---|---|
| Zero cost on non-visual prompts | For every non-visual corpus prompt, `prompt()` output with the flag `off`, `compact` and `subagent` is byte-identical to `router-before.json` |
| Old behaviour intact | `classify(p)` with no options equals the pre-change result for the whole corpus; the three existing router checks in `test/run.mjs:134-136` pass unchanged |
| Brief untouched | `brief.build()` bytes are equal across IDR absent, bundled, standalone and duplicated, with the flag off and on (fixture `claudeDir` and `home`) |
| Visual routing | With the flag on, at least 90% of corpus visual prompts classify `visual`; 0 hard negatives do; a prompt matching both `VISUAL_RE` and `FRONTEND_RE` classifies `frontend` |
| Once per session | Two visual prompts in one session: the first returns the hint and the second returns null; one `hint:visual` event is recorded |
| Hint budget | Every `visualHintText` output is at most 200 characters; state selection is correct for compact, plain, absent and old-UFS fixtures |
| Lazy detection | An injected `exists` counter shows zero calls for non-visual prompts |
| Never twice | `idrInstallPlan` never returns `install: true`; the duplicate, disabled and bundled cases give the texts above |
| Doctor | A fixture IDR `dir` whose stub `browser.mjs` returns `/x/chrome` gives an ok row; a stub returning null gives a failed row with the fix text; uid 0 adds the sandbox note |
| No new surface | The `skills/*/SKILL.md` count and the MCP `tools/list` names equal their pre-change snapshot |
| Whole suite | `npm test` passes with no new SKIPs |

### 2. IDR 1.1.0: `--compact`, `--pick` and a root-safe browser (about 4 hours, image-deep-research repo)

**Why.** Three sheets at 2,852 tokens and an 8,415-character table make one round cost 15-16k tokens. The table and sheet numbering disagree once any result fails. And the browser tests cannot run in this container. The measured and computed figures are in the sections above.

**Spec.**
0. **Browser (30 min).**
   - On Linux, after `IDR_BROWSER`, `ATELIER_BROWSER` and the existing candidates, `findBrowser()` also tries these, newest revision first: `$PLAYWRIGHT_BROWSERS_PATH/chromium-*/chrome-linux/chrome`, `~/.cache/ms-playwright/chromium-*/chrome-linux/chrome` and `/opt/pw-browsers/chromium-*/chrome-linux/chrome`.
   - `launch()` adds `--no-sandbox` only when `process.getuid?.() === 0` or `IDR_NO_SANDBOX=1`.
1. **`sheet.mjs`.**
   - Export `PATCH = 28` and `visionTokens(w, h, { tier = 'high' })`. It scales the image to the largest size that fits both the tier's long edge (2576 or 1568 px) and its token cap (4784 or 1568), preserving aspect ratio as the docs describe, and returns ⌈w/28⌉ × ⌈h/28⌉ for that size.
   - Export `COMPACT = { cols: 4, perSheet: 16, cellW: 317, cellH: 198, gap: 4, pad: 4 }` and `sheetSize(count, geom)`.
   - `planSheets` keeps an item's own `n` (`n: item.n ?? i + 1`).
   - `sheetHtml(tiles, { compact })` draws the number as an overlaid badge (12 px monospace on `rgba(0,0,0,.7)`, top left) with no caption row.
   - `renderSheets(..., { compact })` uses the compact geometry. It encodes JPEG at quality 80, re-shoots at 70 and then 60 while the file exceeds 150,000 bytes, and returns `{ file, w, h, bytes, quality, tokens, tiles }`. Without `compact`, the output is unchanged apart from the numbering fix.
2. **`images.mjs`.**
   - `--compact` is a switch that implies `--sheet` and makes `--n` default to 4 (an explicit `--n` wins).
   - Verified results get `n = 1..k` in list order, used by both the text and the sheet, and `results.json` records `n`.
   - Compact stdout:
     - a header, `images "<q>" <k>/<total> verified -> <out>`;
     - one line per verified result, `NN <source> <licence> | <title ≤48> | <creator ≤24>`;
     - `sheet <path> <w>x<h> <tokens> tok`;
     - `failed <count> (see results.json)` when any failed;
     - `details: node images.mjs --pick 3,7 --results <path>`.
   - No URLs appear in the compact output.
   - `--pick <list> --results <path>` needs no network. It prints each picked result's title, creator, licence and licence URL, image URL and page (three lines each), and exits 2 on an unknown number.
3. **`study.mjs`.**
   - `--compact` prints one line per site, `sNN ok <host> | ground <hex> <share>% | ink <hex> <share>% | heading <family> <size>/<lh> w<weight> | body …`, or `sNN wall <host> (<reason>)`.
   - Tiles go on compact sheets of 16, and each sheet line states its size and tokens.
   - `--json` is unchanged.
4. **`SKILL.md`.**
   - Add at most 600 bytes to step 3 of the loop, roughly: "In a coding session or for a first look, add `--compact` to either script: one sheet of up to 16 numbered tiles, 1288×812 and at most 1,334 image tokens on any Claude model, one text line per result or site, no URLs (`images.mjs --pick 3,7 --results <path>` prints the ones you keep). Open a single image only for what the sheet and the numbers cannot answer."
   - The frontmatter `description` stays byte-identical, and the commands are unchanged.
5. **Release.**
   - Set version 1.1.0 in `package.json`, `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`, and add a README paragraph.
   - Gev tags `v1.1.0`. UFS then runs `node scripts/sync-image-research.mjs --tag v1.1.0`, which refuses a tag whose plugin.json version differs ([sync-image-research.mjs:114-121](file:///home/user/ultimate-frontend-skills/scripts/sync-image-research.mjs)).
   - Until that sync lands, atlias falls back to its plain hint.

| Acceptance test | Pass condition |
|---|---|
| Token formula | `visionTokens` gives 64, 1296, 1521, 2691 (1920×1080), 3888 (2000×1500) and 4784 (3840×2160) on the high tier, matching Anthropic's table; 2852 for 2590×866; 1334 for 1288×812 on both tiers; on the standard tier 1296 and 1521 for the two small squares and never more than 1568 for the three large rows (the docs give 1560, 1564 and 1560) |
| Compact geometry | `sheetSize(16, COMPACT)` = 1288×812; `sheetSize(5)` = 1288×408 (690 tokens); `sheetSize(3)` = 967×206 |
| Numbering | With result 3 of 10 failing, the compact text lines and `planSheets` give the same `n` for every verified result, and the full-mode sheet numbers match the table's |
| Compact text | Fixture-built 16 results: output at most 1,800 characters, no `http`, one line per result, the `sheet … tok` line present |
| Pick | A written `results.json` plus `--pick 2,5` prints both records offline; `--pick 99` exits 2 with a one-line error |
| Study line | `formatSiteCompact` on a fixture probe gives at most 160 characters for an ok site, and a wall gives one line with its reason |
| Skill budget | The SKILL.md description equals v1.0.1's; body growth is at most 600 bytes |
| Browser, rendered | With the browser found as root and no `IDR_BROWSER` set: a compact moodboard of 16 local fixture tiles yields a JPEG whose header reads 1288×812 and which is at most 150,000 bytes; a compact study of 8 local pages × 2 scrolls yields one sheet |
| Browser discovery | With an injected fs, `findBrowser` returns `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; uid 0 adds `--no-sandbox` and uid 1000 does not |
| Whole suite | `npm test` in the container runs the 4 existing browser tests plus the new ones with 0 skips and 0 failures |
