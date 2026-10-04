# Same-text-switch repeats for Gev

The existing single GPU chain completed three original and three sameTextSwitch repeats at checkout00670962930adec83c0e2c84da37ae46bf9eab34, clean evaluator/loop stamp232222c, qwen2.5-coder:7b, Ollama,252 matching task IDs, num_ctx16384, one attempt per task. The only declared flag difference is sameTextSwitch. No new model call was used for this replay. Original report bytes stay preserved locally; [hashes](hashes.json) pin them, and [paired rows](paired-rows.json) retain every task's original outcomes and token counters.

Original repeat passes47/49/58; switch-on55/56/57. Task majority45/252 versus47/252, with20 gains and18 losses; exact paired McNemar p=0.87141468. This does not establish a quality improvement or the same outputs. All losses remain recorded. Historical hidden grader-body hashes and identical machine idleness throughout execution remain unproven, as in the original report.

Total input17,790,579 versus19,346,385: **8.75% MORE**. Output873,642 versus941,358. Total input plus output18,664,221 versus20,287,743: **8.70% MORE**. Peak input10,056 versus12,542: **24.72% HIGHER**. Cached input14,877,731 versus16,122,173 remains input. All756 attempts per arm count, including failures. Input per original solved attempt fell only0.32% (154 versus168 solved attempts), a different denominator that does not prove lower total usage. [Counters and statistics](summary.json).

Keep the switch off by default. These local Ollama results do not establish native Codex or Claude Code model savings, a public benchmark win, a council improvement or any release gate. Neither Gev's20x goal nor5x minimum milestone is met. The original chain has moved to14B; no duplicate worker was started.
