---
name: double-check
description: "Use before calling a code change done, when the atlias gate holds a reply for a second pass, or when asked to verify, bug-check or review your own change, or to turn a failing test into a fix."
---

# double-check

Use the session's changed-file list; fetch harness_progress only if missing.

Pass 1: run the smallest real check that would fail for a wrong change and read its result: project test/sweep or request against the app. Syntax floor: node --check, JSON.parse, py_compile, harness_verify. Unread results are unverified.

Pass 2: adversarially re-read every changed file: empty/malformed/missing input, first/last items, zero/negative/threshold boundaries, callers/returns, swallowed failures, concurrent writers, regressions. Windows: drive letters, backslashes, spaces, BOM, CRLF, locked files. Fix findings and rerun affected checks; repeat passed checks only for a new reason.

End the reply: "Pass 1: <check> passed. Pass 2: <what was fixed, or edge cases checked with nothing found>."

Failures name what happened, why and the fix. Fix the cause; change an incorrect test only with recorded evidence.
