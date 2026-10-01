# Explicit native context transport for Gev

Four native-client requests to owned localhost HTTP/SSE fixtures, zero model inference. Both Codex and Claude Code received the entire original task or entire caller-prepared input, parsed the exact fixture reply, and completed successfully. Within each host, the full serialized tool definitions and stock instruction layer were identical between control and prepared input; SHA256 evidence is in AUDIT.json. No replacement system instructions or disabled-tool flags were supplied.

The input preserves UTF-8 task text, CRLF and non-ASCII characters, then appends bounded whole-file task data. The hook packing flag is explicitly off. The probe is tools/native-job/context-probe.mjs; original request/response artifacts remain at D:/harness-work/native-caller-context-parsed-reply-1001.

Claude uses --bare with a fake localhost key and isolated MCP configuration. This proves the tested transport preserves that control surface; it does not prove real OAuth activation, all integrations, general capability parity, model quality or token/subscription savings. Codex uses its native cached model metadata with an owned custom provider. The live sourceD73 missing-prompt event remains unexplained and its failed row unchanged.
