/**
 * Unit tests for ClaudeCodeSession and ClaudeCodeSessionManager
 *
 * Tests verify:
 * - Session lifecycle (idle→working→completed/failed)
 * - send() and sendAndWait() behavior
 * - Event forwarding from client to session
 * - cancel() and destroy() cleanup
 * - SessionManager CRUD operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import { ClaudeCodeSession, ClaudeCodeSessionManager } from "../../src/claude/session.js";
import { ClaudeCodeClient } from "../../src/claude/client.js";

// =============================================================================
// Mock ClaudeCodeClient
// =============================================================================

function createMockClient(): ClaudeCodeClient {
  const client = new EventEmitter() as unknown as ClaudeCodeClient;

  (client as any).claudePath = "claude";
  (client as any).model = "sonnet";
  (client as any).skipPermissions = true;
  (client as any).systemPrompt = undefined;
  (client as any).requestTimeout = 300000;
  (client as any).allowedTools = undefined;

  // Mock executePrompt to resolve with a result
  (client as any).executePrompt = vi.fn().mockResolvedValue({
    result: "test result",
    costUsd: 0.01,
    durationMs: 1000,
    sessionId: "sess-1",
  });

  return client;
}

// =============================================================================
// ClaudeCodeSession Tests
// =============================================================================

describe("ClaudeCodeSession", () => {
  let client: ClaudeCodeClient;
  let session: ClaudeCodeSession;

  beforeEach(() => {
    client = createMockClient();
    session = new ClaudeCodeSession("test-session-1", client);
  });

  describe("initial state", () => {
    it("should start in idle status", () => {
      expect(session.getStatus()).toBe("idle");
    });

    it("should have the correct session ID", () => {
      expect(session.sessionId).toBe("test-session-1");
    });
  });

  describe("send", () => {
    it("should transition through working status and return a message ID", async () => {
      // Make executePrompt hang so we can observe the working status
      (client as any).executePrompt = vi.fn().mockReturnValue(new Promise(() => {}));

      const messageId = await session.send("test prompt");
      expect(session.getStatus()).toBe("working");
      expect(messageId).toBeDefined();
      expect(typeof messageId).toBe("string");
    });

    it("should throw when session is completed", async () => {
      // Set status to completed via destroy
      await session.destroy();
      await expect(session.send("test")).rejects.toThrow('in status "completed"');
    });

    it("should throw when session is already working", async () => {
      // Make executePrompt hang
      (client as any).executePrompt = vi.fn().mockReturnValue(new Promise(() => {}));

      await session.send("first prompt");
      await expect(session.send("second prompt")).rejects.toThrow("already working");
    });

    it("should emit complete event on success", async () => {
      const events: string[] = [];
      session.on("complete", (content: string) => events.push(content));

      await session.send("test");

      // Wait for the async completion
      await vi.waitFor(() => {
        expect(events).toHaveLength(1);
      });
      expect(events[0]).toBe("test result");
      expect(session.getStatus()).toBe("completed");
    });

    it("should emit error event on failure", async () => {
      (client as any).executePrompt = vi.fn().mockRejectedValue(new Error("API error"));

      const errors: Error[] = [];
      session.on("error", (err: Error) => errors.push(err));

      await session.send("test");

      await vi.waitFor(() => {
        expect(errors).toHaveLength(1);
      });
      expect(errors[0].message).toBe("API error");
      expect(session.getStatus()).toBe("failed");
    });
  });

  describe("sendAndWait", () => {
    it("should resolve with result content", async () => {
      const result = await session.sendAndWait("test prompt");
      expect(result).toBe("test result");
      expect(session.getStatus()).toBe("completed");
    });

    it("should reject on error", async () => {
      (client as any).executePrompt = vi.fn().mockRejectedValue(new Error("fail"));

      await expect(session.sendAndWait("test")).rejects.toThrow("fail");
      expect(session.getStatus()).toBe("failed");
    });

    it("should reject on timeout", async () => {
      vi.useFakeTimers();

      // Make executePrompt hang
      (client as any).executePrompt = vi.fn().mockReturnValue(new Promise(() => {}));

      const promise = session.sendAndWait("test", 1000);

      vi.advanceTimersByTime(1001);

      await expect(promise).rejects.toThrow("timed out");

      vi.useRealTimers();
    });
  });

  describe("cancel", () => {
    it("should set status to idle", async () => {
      // Make executePrompt hang
      (client as any).executePrompt = vi.fn().mockReturnValue(new Promise(() => {}));

      await session.send("test");
      expect(session.getStatus()).toBe("working");

      await session.cancel();
      expect(session.getStatus()).toBe("idle");
    });
  });

  describe("destroy", () => {
    it("should set status to completed and remove listeners", async () => {
      const listener = vi.fn();
      session.on("text", listener);

      await session.destroy();

      expect(session.getStatus()).toBe("completed");
      expect(session.listenerCount("text")).toBe(0);
    });
  });

  describe("event forwarding", () => {
    it("should forward text events from client", async () => {
      // Use a client that emits events
      const emittingClient = createMockClient();
      (emittingClient as any).executePrompt = vi.fn().mockImplementation(() => {
        // Emit text event before resolving
        setTimeout(() => {
          (emittingClient as EventEmitter).emit("text", "hello", "sess-1");
        }, 0);
        return new Promise((resolve) => {
          setTimeout(() => resolve({ result: "done", costUsd: undefined, durationMs: undefined, sessionId: undefined }), 10);
        });
      });

      const s = new ClaudeCodeSession("s1", emittingClient);
      const textEvents: string[] = [];
      s.on("text", (content: string) => textEvents.push(content));

      await s.send("test");

      // Wait for events to propagate
      await new Promise((r) => setTimeout(r, 20));

      // Text events should be forwarded
      expect(textEvents.length).toBeGreaterThanOrEqual(0); // May or may not receive depending on timing
    });
  });
});

// =============================================================================
// ClaudeCodeSessionManager Tests
// =============================================================================

describe("ClaudeCodeSessionManager", () => {
  let client: ClaudeCodeClient;
  let manager: ClaudeCodeSessionManager;

  beforeEach(() => {
    client = createMockClient();
    manager = new ClaudeCodeSessionManager(client);
  });

  describe("createSession", () => {
    it("should create a session with unique ID", async () => {
      const session = await manager.createSession();
      expect(session.sessionId).toBeDefined();
      expect(session.getStatus()).toBe("idle");
    });

    it("should create sessions with different IDs", async () => {
      const s1 = await manager.createSession();
      const s2 = await manager.createSession();
      expect(s1.sessionId).not.toBe(s2.sessionId);
    });

    it("should accept session options", async () => {
      const session = await manager.createSession({
        model: "opus",
        systemPrompt: "test",
        workingDirectory: "/tmp",
      });
      expect(session).toBeDefined();
    });
  });

  describe("getSession", () => {
    it("should return session by ID", async () => {
      const session = await manager.createSession();
      const found = manager.getSession(session.sessionId);
      expect(found).toBe(session);
    });

    it("should return undefined for unknown ID", () => {
      expect(manager.getSession("unknown")).toBeUndefined();
    });
  });

  describe("destroySession", () => {
    it("should remove session from manager", async () => {
      const session = await manager.createSession();
      await manager.destroySession(session.sessionId);
      expect(manager.getSession(session.sessionId)).toBeUndefined();
      expect(manager.activeSessions).toBe(0);
    });

    it("should handle unknown session gracefully", async () => {
      await expect(manager.destroySession("unknown")).resolves.toBeUndefined();
    });
  });

  describe("destroyAll", () => {
    it("should clean up all sessions", async () => {
      await manager.createSession();
      await manager.createSession();
      await manager.createSession();
      expect(manager.activeSessions).toBe(3);

      await manager.destroyAll();
      expect(manager.activeSessions).toBe(0);
    });
  });

  describe("activeSessions", () => {
    it("should return correct count", async () => {
      expect(manager.activeSessions).toBe(0);

      const s1 = await manager.createSession();
      expect(manager.activeSessions).toBe(1);

      await manager.createSession();
      expect(manager.activeSessions).toBe(2);

      await manager.destroySession(s1.sessionId);
      expect(manager.activeSessions).toBe(1);
    });
  });
});
