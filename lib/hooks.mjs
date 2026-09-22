#!/usr/bin/env node
// atlias hook dispatcher. One entry point for every host event:
//   node lib/hooks.mjs <event> [--host claude|codex|gemini]
// Reads the host's JSON payload on stdin, prints JSON only when there is
// something to say (silence costs the model nothing), and always exits 0 so a
// harness fault can never break the host.
import { readStdin, emit, detectHost, log } from './core.mjs';
import * as brief from './brief.mjs';
import * as router from './router.mjs';
import * as guard from './guard.mjs';
import * as track from './track.mjs';
import * as gate from './gate.mjs';
import * as progress from './progress.mjs';
import * as dream from './dream.mjs';
import * as graph from './graph.mjs';
import { hooksActive } from './settings.mjs';

const event = process.argv[2] || '';
const host = detectHost();

// Gemini CLI hooks take a flat shape ({decision, additionalContext, reason}).
// Claude Code and Codex share the hookSpecificOutput shape. UNVERIFIED for Gemini
// beyond what graphify ships for its own BeforeTool hook.
export function shape(out, h = host) {
  if (!out || h !== 'gemini') return out;
  const hs = out.hookSpecificOutput || {};
  if (out.decision === 'block') return { decision: 'deny', reason: out.reason };
  if (hs.permissionDecision === 'deny') return { decision: 'deny', reason: hs.permissionDecisionReason };
  if (hs.additionalContext) return { decision: 'allow', additionalContext: hs.additionalContext };
  return { decision: 'allow' };
}

export function dispatch(ev, payload, h) {
  switch (ev) {
    case 'session-start': return brief.sessionStart(payload, h);
    case 'prompt': return router.prompt(payload, h);
    case 'pre-tool': return guard.preTool(payload, h);
    case 'post-tool': return track.postTool(payload, h);
    case 'post-tool-failure': return track.postToolFailure(payload, h);
    case 'pre-compact': return progress.preCompact(payload, h);
    case 'post-compact': return progress.postCompact(payload, h);
    case 'stop': return gate.stop(payload, h);
    case 'subagent-stop': return track.subagentStop(payload, h);
    case 'session-end': return dream.sessionEnd(payload, h);
    default: log(`unknown event ${ev}`); return null;
  }
}

async function main() {
  if (event === 'dream-worker') return dream.worker(process.argv.slice(3));
  if (event === 'graph-worker') return graph.worker(process.argv.slice(3));
  const payload = await readStdin();
  // Standalone mode keeps atlias out of other harnesses' sessions entirely.
  if (!hooksActive()) return;
  const out = shape(dispatch(event, payload, host));
  if (out) emit(out);
}

if (process.argv[1] && /hooks\.mjs$/.test(process.argv[1])) {
  main()
    .catch((e) => log(`${event} failed: ${e && e.stack ? e.stack : e}`))
    .finally(() => {
      // Never process.exit here: stdout to a pipe is asynchronous, and exiting
      // would truncate whatever has not been flushed. Setting the code lets
      // the write finish and the process end on its own.
      process.exitCode = 0;
      // Backstop: if some handle keeps the loop alive, leave rather than hold
      // up the host. Unreferenced, so it never delays a clean exit.
      if (!/worker$/.test(event)) setTimeout(() => process.exit(0), 10000).unref();
    });
}
