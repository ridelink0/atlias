# atlias

atlias adds shared project memory, a knowledge graph, and verification hooks to coding hosts you already use. It runs inside the host and leaves model choice and provider billing with you. It does not include Atlias's standalone agent or private harness loop.

## Install

Install the terminal package with Node.js 18 or newer:

```sh
npm install --global github:ridelink0/atlias
atlias install --claude
```

Choose the host you use: `--claude`, `--codex`, `--antigravity`, or `--gemini`. Run `atlias doctor` to check the install. `atlias uninstall --codex|--antigravity|--gemini` removes the entries atlias added for that host. Remove the Claude Code plugin with `/plugin uninstall atlias@atlias` inside Claude Code.

For Claude Code's plugin browser, add `ridelink0/atlias` as a marketplace and install `atlias`. Codex users can add the repository as a plugin marketplace, then run `atlias install --codex` to configure its MCP server and hooks.

## What it adds

- One project memory shared through host MCP tools.
- Knowledge graph queries and change-impact lookups when a graph is present.
- Hooks that track edits, check syntax and test evidence, keep a handoff note, and flag repeated or destructive commands.
- Optional native launcher for Claude Code or Codex using a provider profile you supply. The profile stores only the environment variable name for a credential; the credential itself stays in your environment. Usage receipts record provider-reported token counts and optional price estimates.

The launcher accepts Claude's Anthropic Messages API or Codex's Responses API. It does not provide subscription OAuth or promise that provider subscriptions cover API use. See [docs/API-SUBHARNESS.md](docs/API-SUBHARNESS.md) for profiles and receipts.

## Free to use, open to contributors

This sub-harness is free to use, including commercially, under the MIT license. Contributions are welcome; see [Contributing](#contributing).

The exception is the Atlias harness itself: its standalone agent and private harness loop are not in this repository and are not free to use.

## Local development

```sh
npm test
npm run test:install
```

The package has no third-party runtime dependencies. It is distributed under the MIT license; see [LICENSE](LICENSE).

## Contributing

If you're interested in contributing to atlias, please read our [contributing guide](CONTRIBUTING.md) before submitting a pull request.
