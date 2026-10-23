# Contributing to atlias

atlias (this repository) is the free, MIT-licensed sub-harness: project memory, a knowledge graph and verification hooks that run inside coding hosts you already use. The Atlias harness itself, its standalone agent and private harness loop, is not part of this repository, and pull requests that try to add it will be closed.

The changes most likely to be accepted are:

- Bug fixes
- Host support fixes (Claude Code, Codex and other hosts: hooks, MCP tools, install)
- Token and context efficiency improvements, with numbers measured before and after
- Environment-specific fixes (Windows, macOS, Linux, Node versions)
- Missing standard behaviour
- Documentation improvements

New features, new MCP tools, and changes to what a hook blocks or allows need design review before implementation. If you are unsure whether a change fits, open an issue and ask first.

Want to take on an issue? Leave a comment on it, and a maintainer may assign it to you unless someone is already working on it.

Pull requests that ignore these guardrails will likely be closed.

## Development

atlias needs Node 18 or newer and has no third-party runtime dependencies; please keep it that way (no new dependencies). From the repository root:

```sh
npm test
npm run test:install
node bin/atlias.mjs doctor
```

Layout:

- `bin/atlias.mjs`: the command-line entry point
- `lib/`: hooks, the verification gate, the command guard, the knowledge graph, project memory and the native launcher
- `mcp/`: the MCP server and its tools
- `hooks/hooks.json`: the hook registration hosts read
- `docs/`: reference documents (`API-SUBHARNESS.md` covers launcher profiles and usage receipts)
- `test/`: the package checks and the install sandbox

## Verification

Before you open a pull request:

- Run `npm test` and `npm run test:install`, and check every changed file with `node --check`.
- Continuous integration runs the same checks on Ubuntu, macOS and Windows with Node 18, 20 and 22; a pull request is merged only when all of them pass.
- A change in behaviour comes with a test that fails without it.
- A claim that something is faster or uses fewer tokens comes with the numbers and how you measured them.

## Pull requests

### Link issues when required

Bug fixes, chores and tests must reference an existing issue. Use `Fixes #123` or `Closes #123` in the pull request description. Documentation and refactor pull requests are exempt.

Before implementing new functionality, open an issue that describes the problem, why it belongs in atlias, and your proposed approach. Wait for design approval before opening the implementation pull request.

Base branches on `main`.

### Keep it focused

- Keep pull requests small and focused.
- Explain the problem and why the change fixes it.
- Check whether the functionality already exists.
- For logic changes, say what you tested and how a reviewer can check it.

### Keep it brief

Long, AI-generated pull request descriptions and issues may be ignored. Write a short explanation in your own words. If the change cannot be explained briefly, the pull request may be too large.

### Use conventional titles

Use `type(scope): summary`. Supported types are `feat`, `fix`, `docs`, `chore`, `refactor` and `test`. The scope is optional.

Examples:

- `docs: update contributing guide`
- `fix(hooks): keep the handoff note after compaction`
- `feat(mcp): add a graph query limit`

### Style

No emoji anywhere: code, docs, commit messages and pull requests. Match the style of the code around your change.

## Issues

A bug report needs the host and its version, your operating system, your Node version, the steps that reproduce it, and what you expected instead. A feature request needs the problem it solves and why it belongs in atlias. Blank or placeholder issues will be closed.
