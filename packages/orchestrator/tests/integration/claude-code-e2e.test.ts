/**
 * End-to-end smoke tests for Claude Code integration
 *
 * Tests verify:
 * - Real Claude Code CLI spawn and stream-json parsing
 * - ClaudeCodeSession lifecycle with real process
 * - ClaudeCodeSessionManager session management
 *
 * These tests require the `claude` binary to be available.
 * They are skipped in CI if claude is not installed.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import { ClaudeCodeClient } from "../../src/claude/client.js";
import { ClaudeCodeSession, ClaudeCodeSessionManager } from "../../src/claude/session.js";

// Check if claude is available
let claudeAvailable = false;
try {
  execSync("which claude", { stdio: "pipe" });
  claudeAvailable = true;
} catch {
  claudeAvailable = false;
}

const describeIfClaude = claudeAvailable ? describe : describe.skip;

describeIfClaude("Claude Code E2E", () => {
  describe("ClaudeCodeClient real spawn", () => {
    it("should spawn claude and receive stream-json events", async () => {
      const client = new ClaudeCodeClient({
        skipPermissions: true,
        maxTurns: 1,
      });

      const result = await client.executePrompt(
        "Respond with exactly the word: hello",
        { timeoutMs: 60_000 },
      );

      expect(result.result).toBeDefined();
      expect(result.result.toLowerCase()).toContain("hello");
      expect(result.sessionId).toBeDefined();
    }, 60_000);

    it("should emit text events during execution", async () => {
      const client = new ClaudeCodeClient({
        skipPermissions: true,
        maxTurns: 1,
      });

      const textChunks: string[] = [];
      client.on("text", (text: string) => textChunks.push(text));

      await client.executePrompt(
        "Respond with exactly: test complete",
        { timeoutMs: 60_000 },
      );

      // Should have received at least one text chunk
      expect(textChunks.length).toBeGreaterThan(0);
      const fullText = textChunks.join("");
      expect(fullText.toLowerCase()).toContain("test");
    }, 60_000);
  });

  describe("ClaudeCodeSession real execution", () => {
    it("should complete sendAndWait with real claude", async () => {
      const client = new ClaudeCodeClient({
        skipPermissions: true,
        maxTurns: 1,
      });

      const session = new ClaudeCodeSession("e2e-session-1", client);

      expect(session.getStatus()).toBe("idle");

      const result = await session.sendAndWait(
        "Respond with exactly: session test ok",
        60_000,
      );

      expect(result).toBeDefined();
      expect(result.toLowerCase()).toContain("session");
      expect(session.getStatus()).toBe("completed");
    }, 60_000);
  });

  describe("ClaudeCodeSessionManager real workflow", () => {
    it("should create session, execute, and clean up", async () => {
      const client = new ClaudeCodeClient({
        skipPermissions: true,
        maxTurns: 1,
      });

      const manager = new ClaudeCodeSessionManager(client);

      const session = await manager.createSession();
      expect(manager.activeSessions).toBe(1);

      const result = await session.sendAndWait(
        "Respond with exactly: manager test ok",
        60_000,
      );

      expect(result).toBeDefined();
      expect(session.getStatus()).toBe("completed");

      await manager.destroyAll();
      expect(manager.activeSessions).toBe(0);
    }, 60_000);
  });
});
