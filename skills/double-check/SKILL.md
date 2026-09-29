---
name: double-check
description: "Use before calling a code change done, when the atlias gate holds a reply for a second pass, or when asked to verify, bug-check or review your own change, or to turn a failing test into a fix."
---

# double-check

Use the changed-file list already in this session; fetch harness_progress only if that context is missing.

Pass 1: run the smallest real check that would fail if this change were wrong, then read its result. Use the project's test/sweep or request against the app; node --check, JSON.parse, py_compile and harness_verify provide a syntax floor. A check without a read result is unverified.

Pass 2: re-read every changed file adversarially. Check empty/malformed/missing input, first/last items, zero/negative/threshold boundaries, callers and return shapes, swallowed failures, concurrent writers and regressions. On Windows include drive letters, backslashes, spaces, BOM, CRLF and locked files. Fix findings and rerun affected checks. Do not repeat a passed check without a new reason.

End the reply: "Pass 1: <check> passed. Pass 2: <what was fixed, or edge cases checked with nothing found>."

A test failure names what happened, why it matters and how to fix it. Fix the cause; change an incorrect test only after recording evidence that it is wrong.
