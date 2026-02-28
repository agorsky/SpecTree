#!/usr/bin/env node
/**
 * Mock Claude Code process for e2e integration tests.
 *
 * Emits valid stream-json events on stdout, simulating a real
 * `claude --print --output-format stream-json` invocation.
 *
 * Usage: node mock-claude.js [--fail] [--slow <ms>] [--stderr <msg>]
 *
 * Flags:
 *   --fail     Emit an error result event and exit with code 1
 *   --slow N   Delay N ms between events (simulates slow processing)
 *   --stderr M Write M to stderr (simulates diagnostic output)
 */

const args = process.argv.slice(2);
const shouldFail = args.includes("--fail");
const slowIndex = args.indexOf("--slow");
const delayMs = slowIndex >= 0 ? parseInt(args[slowIndex + 1], 10) : 0;
const stderrIndex = args.indexOf("--stderr");
const stderrMsg = stderrIndex >= 0 ? args[stderrIndex + 1] : null;

function writeEvent(event) {
  process.stdout.write(JSON.stringify(event) + "\n");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // Emit stderr diagnostic if requested
  if (stderrMsg) {
    process.stderr.write(stderrMsg + "\n");
  }

  // System init event
  writeEvent({
    type: "system",
    subtype: "init",
    message: "Claude Code initialized (mock)",
    session_id: "mock-session-1",
  });

  if (delayMs > 0) await sleep(delayMs);

  if (shouldFail) {
    // Error result
    writeEvent({
      type: "result",
      subtype: "error",
      result: "Mock error: task failed",
      is_error: true,
      session_id: "mock-session-1",
      cost_usd: 0.001,
      duration_ms: 100,
    });
    process.exit(1);
  }

  // Assistant text event
  writeEvent({
    type: "assistant",
    message: {
      id: "msg-mock-1",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "Hello from mock Claude!" }],
      model: "mock-model",
      stop_reason: "end_turn",
      stop_sequence: null,
    },
    session_id: "mock-session-1",
  });

  if (delayMs > 0) await sleep(delayMs);

  // Success result event
  writeEvent({
    type: "result",
    subtype: "success",
    result: "Hello from mock Claude!",
    cost_usd: 0.005,
    duration_ms: 500,
    session_id: "mock-session-1",
    num_turns: 1,
  });

  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`Mock claude error: ${err.message}\n`);
  process.exit(2);
});
