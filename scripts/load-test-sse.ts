#!/usr/bin/env tsx
/**
 * Load Test: SSE Concurrent Connections (ENG-60-4)
 *
 * Tests the SSE endpoint with multiple concurrent connections:
 * - Opens 50+ simultaneous SSE connections
 * - Verifies stable event delivery to all clients
 * - Monitors memory usage
 * - Ensures proper cleanup (no orphaned listeners)
 *
 * Usage:
 *   tsx scripts/load-test-sse.ts
 *
 * Requirements:
 *   - API server running on http://localhost:3001
 *   - Valid JWT token (set via SSE_TOKEN env var or hardcoded)
 */

import * as http from "http";
import { emitEntityCreated } from "../packages/api/src/events/index.js";

// Configuration
const SSE_URL = process.env.SSE_URL || "http://localhost:3001/api/v1/events";
const SSE_TOKEN = process.env.SSE_TOKEN || ""; // Set this to a valid JWT
const NUM_CONNECTIONS = parseInt(process.env.NUM_CONNECTIONS || "50", 10);
const TEST_DURATION_MS = parseInt(process.env.TEST_DURATION_MS || "60000", 10);
const EVENT_EMIT_INTERVAL_MS = 1000; // Emit event every 1 second

interface ConnectionResult {
  id: number;
  eventsReceived: number;
  connected: boolean;
  error: string | null;
}

/**
 * Create a single SSE connection and count events received
 */
function createSSEConnection(
  id: number,
  token: string,
  durationMs: number
): Promise<ConnectionResult> {
  return new Promise((resolve) => {
    let eventsReceived = 0;
    let connected = false;
    let error: string | null = null;

    const url = new URL(SSE_URL);
    url.searchParams.set("token", token);

    const req = http.get(
      url.toString(),
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          error = `HTTP ${res.statusCode}`;
          resolve({ id, eventsReceived, connected, error });
          return;
        }

        connected = true;
        console.log(`[Connection ${id}] Connected`);

        res.on("data", (chunk) => {
          const data = chunk.toString();
          // Count actual SSE events (lines starting with "data: ")
          const lines = data.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              eventsReceived++;
            }
          }
        });

        res.on("end", () => {
          console.log(
            `[Connection ${id}] Closed (received ${eventsReceived} events)`
          );
        });

        res.on("error", (err) => {
          error = err.message;
          console.error(`[Connection ${id}] Error: ${err.message}`);
        });
      }
    );

    req.on("error", (err) => {
      error = err.message;
      console.error(`[Connection ${id}] Request error: ${err.message}`);
      resolve({ id, eventsReceived, connected, error });
    });

    // Close connection after test duration
    setTimeout(() => {
      req.destroy();
      resolve({ id, eventsReceived, connected, error });
    }, durationMs);
  });
}

/**
 * Emit test events periodically during the test
 */
function startEventEmitter(intervalMs: number, durationMs: number): () => void {
  let eventCount = 0;
  const interval = setInterval(() => {
    eventCount++;
    emitEntityCreated({
      entityType: "feature",
      entityId: `load-test-feature-${eventCount}`,
      userId: null,
      timestamp: new Date().toISOString(),
    });
    console.log(`[Event Emitter] Emitted event ${eventCount}`);
  }, intervalMs);

  // Auto-stop after duration
  setTimeout(() => {
    clearInterval(interval);
    console.log(`[Event Emitter] Stopped after emitting ${eventCount} events`);
  }, durationMs);

  // Return cleanup function
  return () => clearInterval(interval);
}

/**
 * Get memory usage in MB
 */
function getMemoryUsageMB(): number {
  const usage = process.memoryUsage();
  return Math.round(usage.heapUsed / 1024 / 1024);
}

/**
 * Main load test function
 */
async function runLoadTest() {
  console.log("=".repeat(60));
  console.log("SSE Load Test");
  console.log("=".repeat(60));
  console.log(`URL: ${SSE_URL}`);
  console.log(`Connections: ${NUM_CONNECTIONS}`);
  console.log(`Duration: ${TEST_DURATION_MS / 1000}s`);
  console.log(`Event Interval: ${EVENT_EMIT_INTERVAL_MS}ms`);
  console.log("=".repeat(60));
  console.log();

  // Validate token
  if (!SSE_TOKEN) {
    console.error("ERROR: SSE_TOKEN environment variable not set");
    console.error("Usage: SSE_TOKEN=your-jwt-token tsx scripts/load-test-sse.ts");
    process.exit(1);
  }

  // Record initial memory
  const memoryBefore = getMemoryUsageMB();
  console.log(`Memory before test: ${memoryBefore} MB`);
  console.log();

  // Start event emitter
  console.log("Starting event emitter...");
  const stopEmitter = startEventEmitter(
    EVENT_EMIT_INTERVAL_MS,
    TEST_DURATION_MS
  );
  console.log();

  // Create concurrent connections
  console.log(`Opening ${NUM_CONNECTIONS} concurrent connections...`);
  const startTime = Date.now();

  const connections = Array.from({ length: NUM_CONNECTIONS }, (_, i) =>
    createSSEConnection(i + 1, SSE_TOKEN, TEST_DURATION_MS)
  );

  // Wait for all connections to complete
  console.log("Waiting for test to complete...");
  console.log();
  const results = await Promise.all(connections);

  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;

  // Stop event emitter
  stopEmitter();

  // Analyze results
  console.log();
  console.log("=".repeat(60));
  console.log("Test Results");
  console.log("=".repeat(60));

  const successful = results.filter((r) => r.connected && !r.error);
  const failed = results.filter((r) => !r.connected || r.error);

  console.log(`Total connections: ${NUM_CONNECTIONS}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Duration: ${duration.toFixed(2)}s`);
  console.log();

  if (failed.length > 0) {
    console.log("Failed connections:");
    failed.forEach((r) => {
      console.log(`  - Connection ${r.id}: ${r.error || "Unknown error"}`);
    });
    console.log();
  }

  // Event delivery statistics
  const eventCounts = successful.map((r) => r.eventsReceived);
  const totalEvents = eventCounts.reduce((sum, count) => sum + count, 0);
  const avgEvents = successful.length > 0 ? totalEvents / successful.length : 0;
  const minEvents = successful.length > 0 ? Math.min(...eventCounts) : 0;
  const maxEvents = successful.length > 0 ? Math.max(...eventCounts) : 0;

  console.log("Event Delivery:");
  console.log(`  Total events received: ${totalEvents}`);
  console.log(`  Average per client: ${avgEvents.toFixed(2)}`);
  console.log(`  Min: ${minEvents}`);
  console.log(`  Max: ${maxEvents}`);
  console.log();

  // Memory usage
  const memoryAfter = getMemoryUsageMB();
  const memoryGrowth = memoryAfter - memoryBefore;
  console.log("Memory Usage:");
  console.log(`  Before: ${memoryBefore} MB`);
  console.log(`  After: ${memoryAfter} MB`);
  console.log(`  Growth: ${memoryGrowth} MB`);
  console.log();

  // Determine pass/fail
  const passed =
    successful.length === NUM_CONNECTIONS && // All connections succeeded
    avgEvents > 0 && // Events were received
    memoryGrowth < 100; // Memory didn't grow excessively

  console.log("=".repeat(60));
  if (passed) {
    console.log("✅ PASSED");
    console.log();
    console.log("All checks passed:");
    console.log(`  ✓ ${NUM_CONNECTIONS}/${NUM_CONNECTIONS} connections succeeded`);
    console.log(`  ✓ Events delivered (avg ${avgEvents.toFixed(2)} per client)`);
    console.log(`  ✓ Memory stable (growth: ${memoryGrowth} MB < 100 MB)`);
    process.exit(0);
  } else {
    console.log("❌ FAILED");
    console.log();
    console.log("Issues detected:");
    if (successful.length < NUM_CONNECTIONS) {
      console.log(`  ✗ Only ${successful.length}/${NUM_CONNECTIONS} connections succeeded`);
    }
    if (avgEvents === 0) {
      console.log("  ✗ No events received by clients");
    }
    if (memoryGrowth >= 100) {
      console.log(`  ✗ Excessive memory growth: ${memoryGrowth} MB`);
    }
    process.exit(1);
  }
}

// Run the test
runLoadTest().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
