# Native launcher profiles

`atlias sub` wraps one Claude Code or Codex session with a local provider-usage meter. It forwards requests to the provider URL in your profile, records provider-reported usage, and then exits with the native CLI's status. It does not alter prompts or tools.

Create a JSON profile outside a public repository. Anthropic Messages example:

```json
{
  "protocol": "anthropic",
  "baseUrl": "https://api.anthropic.com/v1",
  "model": "your-model-id",
  "keyEnv": "ANTHROPIC_API_KEY"
}
```

OpenAI Responses example:

```json
{
  "protocol": "responses",
  "baseUrl": "https://api.openai.com/v1",
  "model": "your-model-id",
  "keyEnv": "OPENAI_API_KEY"
}
```

Set the named environment variable in your shell, then launch:

```sh
atlias sub --host claude --profile provider.json -- --help
atlias sub --host codex --profile provider.json -- exec --help
```

`keyEnv` stores a variable name only. The credential is read from the current process environment and is never copied into the profile or usage receipt. Remote endpoints must use HTTPS; HTTP is accepted only for loopback addresses. Provider prices are optional estimates entered by the user. Missing or incomplete usage stays unknown rather than being reported as zero.

To validate a profile without a network request, use `atlias provider check provider.json`. Summarize an existing receipt file with `atlias provider usage receipts.jsonl`.
