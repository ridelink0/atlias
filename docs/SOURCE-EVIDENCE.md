# Bounded source evidence for Gev

`atlias evidence` is an explicit read-only CLI candidate. It returns exact numbered UTF-8 lines, their original line endings and the SHA256 of the raw file. It starts no model and adds no default MCP tool or schema. It is not yet included in the independently installed bbf6 snapshot.

```text
node bin/atlias.mjs evidence --root <project> --file docs/contract.md --max-lines 20 --max-bytes 4096 --json
node bin/atlias.mjs evidence --root <project> --file docs/contract.md --first-line <nextLine> --expected-sha256 <sha256> --json
```

The first page can omit the expected hash. Every continuation requires it; a changed file is rejected rather than mixing snapshots. `nextLine:null` means the end of this file was reached. `complete:true` means this ONE response contains the entire file, including an empty file. A last continuation can have `endOfFile:true` while `complete:false`. No intermediate page can claim every requirement was read. Combine all pages with the same hash before claiming a complete source.

Defaults:40 lines and8,192 response bytes. The JSON response plus newline is bounded; escaped characters and metadata count. Explicit limits are1–200 lines and1,024–65,536 bytes. Files must be regular UTF-8 text of at most1MiB. Whole lines are retained; an oversized single line is rejected with an explicit message, rather than silently truncating it. An ordinary host read remains available. Original BOM and line endings are retained in the line records, and the hash always identifies original bytes.

Explicit relative Windows separators are normalized. Absolute paths, traversal, ADS, reserved Windows device names, links, protected paths and unsupported/binary files are rejected. Files changed during the read are rejected. These checks bound this helper's reads; they do not make an arbitrary workspace a hostile-process sandbox or recognize every possible sensitive filename.

File content is labelled untrusted data. A hash identifies bytes and detects changes; it does not prove the source is truthful, authoritative or safe to obey. Use the source path, exact line and matching hash for a claim, then independently verify whether the claim follows. Missing evidence, contradictory sources and instructions embedded inside data remain reasons to investigate rather than invent an answer. Normal host tools and original task contracts remain unchanged.

Functional and adversarial controls include UTF-8/BOM/CRLF, pagination, stale hashes, explicit incomplete coverage, response-byte limits after JSON escaping, secret/link/device/path rejection and a real file modification during the read. Model hallucination rate, useful-answer quality, token savings, full peak context and subscription savings remain unmeasured. A separately pinned full-tool model study is required before attributing those effects.
