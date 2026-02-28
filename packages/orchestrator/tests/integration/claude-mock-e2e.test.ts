/**
 * End-to-end integration tests using mock Claude Code process (ENG-37-2)
 *
 * Tests verify:
 * - Stream-json parsing with a real subprocess (not mocked EventEmitters)
 * - Successful completion with text + result events
 * - Error handling with --fail flag
 * - Stderr diagnostic event capture
 * - Inactivity timeout with --slow flag
 * - Session lifecycle with real process
 */

import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { ClaudeCodeClient } from "../../src/claude/client.js";
import { ClaudeCodeSession, ClaudeCodeSessionManager } from "../../src/claude/session.js";

// Use the mock-claude.js script as the "claude" binary.
// Since it has a #!/usr/bin/env node shebang, it runs directly.
const MOCK_CLAUDE = resolve(__dirname, "../fixtures/mock-claude.js");

// Helper: the mock script ignores all CLI args from claude and only looks
// for its own flags (--fail, --slow, --stderr). We pass mock flags via env
// to avoid conflicts with buildArgs which adds --print, --output-format, etc.
// Actually, mock-claude.js scans process.argv which includes all args, so
// it will correctly find --fail etc. among the claude flags.

describe("Claude Code Mock E2E", () => {
  describe("ClaudeCodeClient with mock process", () => {
    it("should parse stream-json events from a real subprocess", async () => {
      const client = new ClaudeCodeClient({
        claudePath: MOCK_CLAUDE,
        skipPermissions: false,
      });

      const textChunks: string[] = [];
      const systemMessages: string[] = [];
      client.on("text", (text: string) => textChunks.push(text));
      client.on("system", (msg: string) => systemMessages.push(msg));

      const result = await client.executePrompt("ignored-by-mock", {
        timeoutMs: 10_000,
      });

      expect(result.result).toBe("Hello from mock Claude!");
      expect(result.costUsd).toBe(0.005);
      expect(result.durationMs).toBe(500);
      expect(result.sessionId).toBe("mock-session-1");
      expect(textChunks).toEqual(["Hello from mock Claude!"]);
      expect(systemMessages).toEqual(["Claude Code initialized (mock)"]);
    }, 15_000);

    it("should handle error result from mock process", async () => {
      const client = new ClaudeCodeClient({
        claudePath: MOCK_CLAUDE,
        skipPermissions: false,
        args: ["--fail"],
      });

      const errorEvents: string[] = [];
      client.on("error", (msg: string) => errorEvents.push(msg));

      // The process exits with code 1 but we still get resultData from
      // the error result event, so it resolves (with the error result)
      const result = await client.executePrompt("fail-test", {
        timeoutMs: 10_000,
      });

      expect(result.result).toBe("Mock error: task failed");
      expect(errorEvents).toHaveLength(1);
    }, 15_000);

    it("should capture stderr as diagnostic events", async () => {
      const client = new ClaudeCodeClient({
        claudePath: MOCK_CLAUDE,
        skipPermissions: false,
        args: ["--stderr", "debug-info-here"],
      });

      const diagnostics: string[] = [];
      client.on("diagnostic", (text: string) => diagnostics.push(text));

      await client.executePrompt("stderr-test", { timeoutMs: 10_000 });

      const combined = diagnostics.join("");
      expect(combined).toContain("debug-info-here");
    }, 15_000);

    it("should trigger inactivity timeout with slow mock", async () => {
      const client = new ClaudeCodeClient({
        claudePath: MOCK_CLAUDE,
        skipPermissions: false,
        inactivityTimeoutMs: 500,
        args: ["--slow", "2000"],
      });

      await expect(
        client.executePrompt("slow-test", { timeoutMs: 30_000 }),
      ).rejects.toThrow("inactive");
    }, 15_000);
  });

  describe("ClaudeCodeSession with mock process", () => {
    it("should complete sendAndWait via session", async () => {
      const client = new ClaudeCodeClient({
        claudePath: MOCK_CLAUDE,
        skipPermissions: false,
      });

      const session = new ClaudeCodeSession("mock-session", client);
      expect(session.getStatus()).toBe("idle");

      const result = await session.sendAndWait("session-test", 10_000);

      expect(result).toBe("Hello from mock Claude!");
      expect(session.getStatus()).toBe("completed");
    }, 15_000);
  });

  describe("ClaudeCodeSessionManager with mock process", () => {
    it("should create, execute, and destroy sessions", async () => {
      const client = new ClaudeCodeClient({
        claudePath: MOCK_CLAUDE,
        skipPermissions: false,
      });

      const manager = new ClaudeCodeSessionManager(client);
      const session = await manager.createSession();
      expect(manager.activeSessions).toBe(1);

      const result = await session.sendAndWait("manager-test", 10_000);
      expect(result).toBe("Hello from mock Claude!");

      await manager.destroyAll();
      expect(manager.activeSessions).toBe(0);
    }, 15_000);
  });
});
