export const meta = {
  name: 'atlias-round-six',
  description: 'atlias round six, the same workflow UFS round two ran: verified research fronts into NEXTGEN-6, then the build queue, each item built and adversarially reviewed',
  phases: [
    { title: 'Research', detail: 'dollars below plain Claude Code, a harder corpus, the 2026 landscape, local-model wins, what round five left' },
    { title: 'Verify', detail: 'one adversarial verifier per front' },
    { title: 'Plan', detail: 'report writer: docs/NEXTGEN-6.md, ranked and measured; then a build queue' },
    { title: 'Build', detail: 'top items, one at a time on the round-six branch' },
    { title: 'Review', detail: 'adversarial review per built item' },
  ],
}

// Run from Claude Code with the Workflow tool, for example:
//   Workflow({ scriptPath: '<atlias>/docs/rounds/atlias-round-six.workflow.js',
//              args: { repo: 'C:/Users/OWNER/atlias', notes: 'D:/harness-work/round6/notes',
//                      skill: '<the deep-research skill folder, if installed>', maxBuilds: 5 } })
// Start it only after ridelink0/atlias#2 is merged into main, so round six starts
// from round five's code. The shape is the one UFS round two ran on 2026-09-29:
// parallel research fronts, one verifier per front, one report, a build queue, and
// every build followed by an adversarial review.

const REPO = args.repo
const NOTES = args.notes
const SKILL = args.skill || ''
const REPORT = `${REPO}/docs/NEXTGEN-6.md`
const BRANCH = 'round-six'
const MAX_BUILDS = args.maxBuilds || 5

const CTX = `
CONTEXT (verified before this round, do not re-derive):
- atlias (${REPO}, repo ridelink0/atlias) is Gev's harness for AI coding agents: a sub-harness inside Claude Code, Codex and others (shared memory, a knowledge graph, loop and destructive-command guards, a gate that holds a reply until the work behind it is real) and an agent loop of its own over Claude Code, Codex, OpenAI-compatible and local Ollama models. Zero dependencies, Node 18+.
- Round five (docs/NEXTGEN-5.md) is on main after ridelink0/atlias#1 and #2: transcript-recovered checks, the round-five ledger and flag/env plumbing, a golden flags-off fingerprint (test/golden.mjs, test/fixtures/golden-flags-off.json), hook timeouts at 30 s, a lean brief and a gate that runs the project's check itself (both default-off flags), the rows the cloud reached of 5 (same-text is not a strike), 6 (--direct), 7 (HumanEvalFix v2), 8 (Ollama profile and defaults) and 3 (the public score package) - docs/CLOUD-REPORT-2026-09.md says exactly which landed - and tools/ccstudy/, the headless Claude Code study driver.
- The measurements to beat. Claude Code, 50 tasks, Sonnet 5 at medium (evals/results/round5/cloud-cc/2026-09-29-baseline.md): every arm solved 50/50, so that corpus cannot show quality; atlias against plain Claude Code is 1.00x raw prompt tokens per solved task (inside the noise) but 1.06x billed-equivalent (outside it: atlias still costs about 6% more in dollars, mostly cache writes); 0 of 1,037 hook calls cancelled. Local models, main tier (HumanEvalFix 164 + CanItEdit lazy 88, qwen2.5-coder:7b): atlias 59/250 against mini-swe-agent 41/250, one run per arm.
- atlias's rules: a claim goes in as fact only if an independent verifier confirmed it at the primary source; every behaviour change lands default-off behind a flag and flips only after a measurement meets a bar set before the run; fewer than six one-way flips is "inside the noise"; merge commits, never squash.
- Tonight's reports to build on (docs/, or the paths docs/CLOUD-REPORT-2026-09.md gives): councils of Claudes with a cost-performance critic, image deep research inside atlias, and round five's own research notes.
- This round runs on Gev's Windows PC: Ollama with local models, D:/harness-work with the corpora and run reports, headless Claude Code on Gev's plan, gh signed in. main is protected (no force-push or deletion, PRs with green CI to merge; admins may bypass).
- Gev also cares about profit: note revenue and adoption levers where the evidence supports them, labelled.`

const researcher = (topic, file, body) => `Research ${topic}.
${body}
${CTX}

Save your output notes to ${NOTES}/${file}.md
${SKILL ? `\n**As a first step, you must read ${SKILL}/references/researcher.md for instructions on how to conduct research.**` : '\nWork like a careful researcher: primary sources first, every claim with its source and date, numbers with their setup, and a list of what you could not verify.'}`

const FRONTS = [
  { key: 'state', file: 'round5_state', local: true, topic: 'what round five actually shipped in atlias against what docs/NEXTGEN-5.md planned (an internal, read-only audit; no web research)', body: `
Objective: the exact starting line for round six.
Key questions:
- For each NEXTGEN-5 row: built, partly, or not; its flag; its measurement so far; with commits and file:line. What docs/CLOUD-REPORT-2026-09.md says was left.
- Run node test/run.mjs once and record the count; list the flags round five added and whether any measurement has flipped one.
Constraints: read-only.` },
  { key: 'dollars', file: 'below_plain_claude_code', topic: 'how a Claude Code sub-harness gets BELOW plain Claude Code in dollars per solved task, as of the current Claude Code release', body: `
Objective: the mechanisms that can turn atlias's 1.06x billed-equivalent into less than 1.0x, with evidence.
Key questions:
- Cache-write economics: what in a sub-harness causes extra cache writes (hook additionalContext placement, brief changes between turns, skill listings), and how to keep the prefix stable.
- Tool-output trimming (PostToolUse updatedToolOutput, PreToolUse updatedInput): what the docs allow, what it saves, and the risk of hiding what the model needed.
- Fewer rounds: the gate running checks itself, pairing edits with checks, early exit; subagent and model routing (cheap model for exploration) inside Claude Code.
Suggested sources: code.claude.com docs (hooks, costs, settings), the Claude Code changelog and issues, Anthropic prompt-caching docs, tools/ccstudy results.` },
  { key: 'corpus', file: 'harder_corpus', topic: 'a harder, discriminating task corpus on which a coding harness\'s verification gate can show its value, runnable cheaply', body: `
Objective: tasks where plain Claude Code sometimes claims done without being done, so the gate's effect is measurable (the 50-task study was 50/50 for every arm).
Key questions:
- Candidates: CanItEdit hard subsets, SWE-bench-Live style tasks, repository-level tasks with hidden tests, tasks built to tempt a false "done"; cost per task under headless Claude Code; Docker needs.
- How to build it reproducibly with atlias's converters and seeded sampler, and the statistics needed to detect a gate effect of a plausible size.` },
  { key: 'landscape', file: 'harness_landscape', topic: 'what the best coding-agent harnesses and sub-harnesses shipped in the last few months that atlias lacks', body: `
Objective: features with evidence of effect that atlias could adopt or beat, and where atlias can be first.
Key questions:
- Claude Code, Codex, Gemini CLI, OpenCode, Aider, Goose, Cline/Roo/Kilo, Amp, Cursor, mini-swe-agent, OpenHands: verification gates, memory, context management, multi-agent features, cost controls.
- Which of these have published measurements, and which are claims only.` },
  { key: 'local', file: 'local_model_wins', topic: 'the next measurable wins for atlias\'s own agent loop on local models (Ollama, 7B to 32B), including NEXTGEN-5 rows 5-8 and 3 if they are not measured yet', body: `
Objective: the MT track's next steps, ranked by expected effect per GPU hour.
Key questions:
- The current best local coding models on Ollama and their published scores; whether qwen2.5-coder:14b or a newer model takes CanItEdit off the floor.
- Edit formats, repair feedback, same-text handling and best-of-n under a fixed budget for small models, with measured effects.` },
]

const VERIFY = (f) => `You are an adversarial verifier. Read ${NOTES}/${f.file}.md (written by another researcher). Pick the 8-12 load-bearing claims (numbers, "X ships Y", "the docs say Z", "row N is built").
${f.local ? `These are claims about the local repository ${REPO}: re-check each against git log, the code and the tests yourself (read-only).` : "Fetch each claim's primary source yourself (official docs, paper, repo, changelog); do not trust the notes' citation. Default to UNVERIFIED when you cannot reach the source."}
APPEND (do not rewrite) a section "## Verification" to that file: one line per claim - CONFIRMED / REFUTED / UNVERIFIED, the claim in a few words, the source you checked. For REFUTED say what is true. End with "Verified N of M; refuted K."
${CTX}
Return a 3-line summary: counts, the most important refutation, and anything the plan must not rely on.`

const WRITER = `Read the notes in ${NOTES}/ and synthesize into a research report that answers: What should atlias build and measure in round six to beat plain Claude Code in dollars per solved task, to show the gate's value on tasks that can show it, and to become a next-gen harness?

Earlier research to build on: ${REPO}/docs/NEXTGEN-5.md and docs/CLOUD-REPORT-2026-09.md (continue them, do not repeat them).

Requirements beyond the report-writer instructions:
- Only verifier-CONFIRMED claims (or local facts with file:line) as fact; UNVERIFIED in a "Could not be verified" section; REFUTED named as refuted.
- A ranked plan: each item with what it attacks (which measured number), how it is measured (corpus, protocol, the six-flip rule), expected effect and its evidence, effort, and whether it needs the GPU, Gev's plan usage, or neither.
- A section "Build queue for this round": the top items, each small enough for one agent in one sitting, with a precise spec (default-off flag, files, acceptance tests without model spend) and the measurement that will decide its default.
- A short, labelled adoption and revenue section, only as far as the evidence goes.
- Plain, blunt language, in the voice of NEXTGEN-4 and NEXTGEN-5.
${CTX}

Save your final report to this exact path: ${REPORT}
${SKILL ? `\n**As a first step, you must read ${SKILL}/references/report-writer.md for instructions on how to write your research report.**` : ''}`

const QUEUE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          spec: { type: 'string', description: 'precise spec: flag, files, behaviour, what not to do' },
          acceptance: { type: 'string', description: 'tests that must exist and pass, and how to prove each fails without the change' },
        },
        required: ['title', 'spec', 'acceptance'],
      },
    },
  },
  required: ['items'],
}

const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    done: { type: 'array', items: { type: 'string' } },
    notDone: { type: 'array', items: { type: 'string' } },
    commits: { type: 'array', items: { type: 'string' } },
    pushed: { type: 'boolean' },
    tests: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['done', 'notDone', 'commits', 'pushed', 'tests', 'notes'],
}

const RULES = `
RULES: Work in ${REPO} on branch ${BRANCH} (create it from an up-to-date main the first time: git fetch origin && git switch -c ${BRANCH} origin/main; afterwards git switch ${BRANCH}). Never force-push, never rewrite pushed history. Match atlias's commit style (an area prefix such as "gate:" or "brief:", a plain sentence, a body with what was measured or why). Every behaviour change lands default-off behind a flag in DEFAULTS.flags that the environment can set per arm; the golden flags-off fingerprint must stay byte-identical (node test/golden.mjs against test/fixtures/golden-flags-off.json). Run node test/run.mjs before every commit; never skip, weaken or delete a check; every new check must fail without the change (prove it once by reverting locally). CHANGELOG "## Unreleased" entry; no version bump. Zero dependencies. Push with git push -u origin ${BRANCH}; keep one open PR from ${BRANCH} into main (gh pr create --fill the first time) and let CI run on it. Label anything unverified UNVERIFIED.`

const verified = await pipeline(
  FRONTS,
  (f) => agent(researcher(f.topic, f.file, f.body), { label: `research:${f.key}`, phase: 'Research', effort: 'high' }),
  (summary, f) => agent(VERIFY(f), { label: `verify:${f.key}`, phase: 'Verify', effort: 'medium' }).then((v) => ({ key: f.key, verify: v }))
)
log(`round six research+verify: ${verified.filter(Boolean).length}/${FRONTS.length} fronts`)

const writer = await agent(WRITER, { label: 'write:NEXTGEN-6', phase: 'Plan' })
const queue = await agent(`Read ${REPORT} and return its "Build queue for this round" as structured items, in the report's order, copying each spec and acceptance precisely (add any file paths or constraints the report states elsewhere that a builder needs). If the section is missing, derive the top items from the ranked plan.`, { label: 'queue:extract', phase: 'Plan', schema: QUEUE_SCHEMA, effort: 'low' })

const items = (queue && queue.items) || []
if (items.length > MAX_BUILDS) log(`build queue has ${items.length} items; building the top ${MAX_BUILDS}, left for later: ${items.slice(MAX_BUILDS).map((i) => i.title).join(' | ')}`)

const builds = []
for (const item of items.slice(0, MAX_BUILDS)) {
  const b = await agent(`Build one item of atlias round six (${REPORT}; read the item's section and the measurement protocol first). ${RULES}

ITEM: ${item.title}
SPEC: ${item.spec}
ACCEPTANCE: ${item.acceptance}`, { label: `build:${item.title.slice(0, 40)}`, phase: 'Build', schema: REPORT_SCHEMA, effort: 'high' })
  let r = null
  if (b) {
    r = await agent(`Adversarial review of an atlias change another agent just pushed to ${BRANCH} for the item "${item.title}". ${RULES}
Read its commits (git log --oneline -10; git show). Hunt for: logic bugs, a flag that is not really default-off or that changes the golden flags-off fingerprint, anything that adds tokens per call when the flag is off, unbounded work in hooks, Windows path/quoting/CRLF gaps, a forked classifier instead of the shared one, vacuous checks (revert the change locally, confirm they fail, restore), docs or CHANGELOG claiming what the code does not do. Re-run node test/run.mjs and compare the count to the builder's claim. Fix each confirmed defect minimally, commit, push; list real-but-too-big items in notDone with a proposed patch.
SPEC: ${item.spec}
BUILDER REPORT: ${JSON.stringify(b, null, 1)}`, { label: `review:${item.title.slice(0, 40)}`, phase: 'Review', schema: REPORT_SCHEMA, effort: 'high' })
  }
  builds.push({ item: item.title, build: b, review: r })
}

return { fronts: verified, writer, queued: items.map((i) => i.title), builds }
