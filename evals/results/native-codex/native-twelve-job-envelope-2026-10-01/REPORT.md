# Twelve-job native envelope fixture for Gev

Both actual native Codex and Claude Code clients delivered the complete twelve authored job packets, their hash-bound envelope and exact bounded-worker instructions to an owned localhost HTTP/SSE fixture. Codex also delivered the complete structured-output schema. Both parsed the fixture response with all twelve job IDs and hashes. Two local requests, zero inference calls.

The packet input was20,949UTF-8 bytes. This is transport size, not model tokens. No edits were returned and no correctness or savings claim follows. Codex reported fallback model metadata for the custom fixture provider; native model metadata parity remains unproved. Claude used bare mode and a fake local key, which does not establish subscription OAuth activation, model quality or savings. The reduced profile retains Codex request_user_input/view_image metadata; there is no zero-tool guarantee or normal-host capability-parity claim.

Artifact hashes and working source-file hashes are retained in AUDIT.json. A separately pinned candidate with its own CI and complete capability prerequisite must precede real batch inference.
