/**
 * Unit tests for Resume Command
 *
 * Tests verify:
 * - Resume all paused agents functionality
 * - Resume specific worker functionality
 * - Error handling for no saved state
 * - Error handling for invalid worker ID
 * - Stale state warning handling
 * - Helper functions (canResume, getResumePreview, etc.)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock state data store
const mockStateData: Record<string, unknown> = {};

// Mock external dependencies
vi.mock("conf", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      get: vi.fn((key: string) => mockStateData[key]),
      set: vi.fn((key: string | object, value?: unknown) => {
        if (typeof key === "object") {
          Object.assign(mockStateData, key);
        } else {
          mockStateData[key] = value;
        }
      }),
      clear: vi.fn(() => {
        for (const key in mockStateData) {
          delete mockStateData[key];
        }
      }),
      path: "/mock/.spectree/state.json",
    })),
  };
});

vi.mock("chalk", () => ({
  default: {
    cyan: Object.assign(vi.fn((s: string) => s), {
      bold: vi.fn((s: string) => s),
    }),
    white: vi.fn((s: string) => s),
    gray: vi.fn((s: string) => s),
    yellow: vi.fn((s: string) => s),
    green: vi.fn((s: string) => s),
    red: vi.fn((s: string) => s),
    blue: vi.fn((s: string) => s),
  },
}));

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockSessionState(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    epicId: "epic-123",
    epicName: "Test Epic",
    startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    updatedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
    sessionId: "session-456",
    activeAgents: [],
    completedItems: [],
    failedItems: [],
    totalItems: 10,
    progress: 50,
    ...overrides,
  };
}

function createMockAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: "worker-1",
    taskId: "COM-5",
    taskTitle: "API endpoints",
    branch: "feature/COM-5",
    status: "paused" as const,
    progress: 40,
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("Resume Command", () => {
  // Store console.log calls for verification
  const originalConsoleLog = console.log;
  let consoleOutput: string[] = [];

  // Import modules dynamically after mocks
  let resumeCommand: typeof import("../src/cli/commands/resume.js").resumeCommand;
  let canResume: typeof import("../src/cli/commands/resume.js").canResume;
  let getResumePreview: typeof import("../src/cli/commands/resume.js").getResumePreview;
  let getPausedAgentCount: typeof import("../src/cli/commands/resume.js").getPausedAgentCount;
  let getRunningAgentCount: typeof import("../src/cli/commands/resume.js").getRunningAgentCount;
  let state: typeof import("../src/cli/state.js");

  beforeEach(async () => {
    vi.resetModules();

    // Clear mock state
    for (const key in mockStateData) {
      delete mockStateData[key];
    }

    // Capture console output
    consoleOutput = [];
    console.log = vi.fn((...args: unknown[]) => {
      consoleOutput.push(args.map(String).join(" "));
    });

    // Import modules fresh
    const resumeModule = await import("../src/cli/commands/resume.js");
    resumeCommand = resumeModule.resumeCommand;
    canResume = resumeModule.canResume;
    getResumePreview = resumeModule.getResumePreview;
    getPausedAgentCount = resumeModule.getPausedAgentCount;
    getRunningAgentCount = resumeModule.getRunningAgentCount;
    state = await import("../src/cli/state.js");
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    vi.clearAllMocks();
  });

  describe("resumeCommand - no saved state", () => {
    it("should throw error when no saved state exists", () => {
      // No active state set
      expect(() => resumeCommand()).toThrow("No saved state to resume from");
    });

    it("should display helpful message when no saved state", () => {
      try {
        resumeCommand();
      } catch {
        // Expected to throw
      }

      const output = consoleOutput.join("\n");
      expect(output).toContain("No saved state to resume from");
      expect(output).toContain("spectree-agent run");
    });
  });

  describe("resumeCommand - no paused agents", () => {
    it("should handle case with no paused agents gracefully", () => {
      // Set up state with running agents but no paused ones
      const sessionState = createMockSessionState({
        activeAgents: [
          createMockAgent({ id: "worker-1", status: "working" }),
        ],
      });
      mockStateData["activeSession"] = sessionState;

      const result = resumeCommand();

      expect(result.resumedCount).toBe(0);
      expect(result.alreadyRunning).toBe(1);

      const output = consoleOutput.join("\n");
      expect(output).toContain("No paused agents to resume");
      expect(output).toContain("currently running");
    });

    it("should handle case with no active agents at all", () => {
      // Set up state with no agents
      const sessionState = createMockSessionState({
        activeAgents: [],
      });
      mockStateData["activeSession"] = sessionState;

      const result = resumeCommand();

      expect(result.resumedCount).toBe(0);
      expect(result.alreadyRunning).toBe(0);

      const output = consoleOutput.join("\n");
      expect(output).toContain("No agents to resume");
    });
  });

  describe("resumeCommand - resume all agents", () => {
    it("should resume all paused agents", () => {
      // Set up state with paused agents
      const sessionState = createMockSessionState({
        activeAgents: [
          createMockAgent({ id: "worker-1", status: "paused", taskId: "COM-5" }),
          createMockAgent({ id: "worker-2", status: "paused", taskId: "COM-6" }),
        ],
      });
      mockStateData["activeSession"] = sessionState;

      const result = resumeCommand();

      expect(result.resumedCount).toBe(2);
      expect(result.resumedAgents).toContain("worker-1");
      expect(result.resumedAgents).toContain("worker-2");

      // Verify agents were updated to idle
      const updatedState = state.getActiveState();
      expect(updatedState?.activeAgents[0]?.status).toBe("idle");
      expect(updatedState?.activeAgents[1]?.status).toBe("idle");
    });

    it("should display resume context", () => {
      const sessionState = createMockSessionState({
        activeAgents: [
          createMockAgent({ id: "worker-1", status: "paused", progress: 40 }),
        ],
        completedItems: [
          { identifier: "COM-1", title: "Task 1", duration: 60000, completedAt: new Date().toISOString() },
        ],
      });
      mockStateData["activeSession"] = sessionState;

      resumeCommand();

      const output = consoleOutput.join("\n");
      expect(output).toContain("Resuming orchestration");
      expect(output).toContain("Test Epic");
      expect(output).toContain("50% complete");
      expect(output).toContain("COM-1");
    });
  });

  describe("resumeCommand - resume specific worker", () => {
    it("should resume specific paused worker", () => {
      const sessionState = createMockSessionState({
        activeAgents: [
          createMockAgent({ id: "worker-1", status: "paused", taskId: "COM-5" }),
          createMockAgent({ id: "worker-2", status: "paused", taskId: "COM-6" }),
        ],
      });
      mockStateData["activeSession"] = sessionState;

      const result = resumeCommand("worker-1");

      expect(result.resumedCount).toBe(1);
      expect(result.resumedAgents).toEqual(["worker-1"]);

      // Verify only worker-1 was resumed
      const updatedState = state.getActiveState();
      expect(updatedState?.activeAgents[0]?.status).toBe("idle");
      expect(updatedState?.activeAgents[1]?.status).toBe("paused");
    });

    it("should throw error for invalid worker ID", () => {
      const sessionState = createMockSessionState({
        activeAgents: [
          createMockAgent({ id: "worker-1", status: "paused" }),
        ],
      });
      mockStateData["activeSession"] = sessionState;

      expect(() => resumeCommand("worker-999")).toThrow("Worker not found");

      const output = consoleOutput.join("\n");
      expect(output).toContain("Worker not found");
      expect(output).toContain("Available workers");
    });

    it("should handle worker that is not paused", () => {
      const sessionState = createMockSessionState({
        activeAgents: [
          createMockAgent({ id: "worker-1", status: "working" }),
          createMockAgent({ id: "worker-2", status: "paused" }), // Need at least one paused agent to reach specific worker check
        ],
      });
      mockStateData["activeSession"] = sessionState;

      const result = resumeCommand("worker-1");

      expect(result.resumedCount).toBe(0);
      expect(result.alreadyRunning).toBe(1);

      const output = consoleOutput.join("\n");
      expect(output).toContain("is not paused");
    });
  });

  describe("resumeCommand - stale state handling", () => {
    it("should warn about stale state (>24 hours old)", () => {
      const now = new Date();
      const sessionState = createMockSessionState({
        updatedAt: new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
        activeAgents: [
          createMockAgent({ id: "worker-1", status: "paused" }),
        ],
      });
      mockStateData["activeSession"] = sessionState;

      const result = resumeCommand();

      // Should still resume (with warning)
      expect(result.resumedCount).toBe(1);

      const output = consoleOutput.join("\n");
      expect(output).toContain("more than 24 hours old");
    });

    it("should skip stale warning with force option", () => {
      const now = new Date();
      const sessionState = createMockSessionState({
        updatedAt: new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
        activeAgents: [
          createMockAgent({ id: "worker-1", status: "paused" }),
        ],
      });
      mockStateData["activeSession"] = sessionState;

      resumeCommand(undefined, { force: true });

      const output = consoleOutput.join("\n");
      expect(output).not.toContain("more than 24 hours old");
    });
  });

  describe("canResume helper", () => {
    it("should return false when no state exists", () => {
      expect(canResume()).toBe(false);
    });

    it("should return false when no paused agents", () => {
      const sessionState = createMockSessionState({
        activeAgents: [
          createMockAgent({ id: "worker-1", status: "working" }),
        ],
      });
      mockStateData["activeSession"] = sessionState;

      expect(canResume()).toBe(false);
    });

    it("should return true when paused agents exist", () => {
      const sessionState = createMockSessionState({
        activeAgents: [
          createMockAgent({ id: "worker-1", status: "paused" }),
        ],
      });
      mockStateData["activeSession"] = sessionState;

      expect(canResume()).toBe(true);
    });
  });

  describe("getResumePreview helper", () => {
    it("should return null when no state exists", () => {
      expect(getResumePreview()).toBeNull();
    });

    it("should return preview information", () => {
      const sessionState = createMockSessionState({
        activeAgents: [
          createMockAgent({ id: "worker-1", status: "paused", taskId: "COM-5", progress: 40 }),
          createMockAgent({ id: "worker-2", status: "working", taskId: "COM-6", progress: 20 }),
        ],
        completedItems: [
          { identifier: "COM-1", title: "Task 1", duration: 60000, completedAt: new Date().toISOString() },
        ],
      });
      mockStateData["activeSession"] = sessionState;

      const preview = getResumePreview();

      expect(preview).not.toBeNull();
      expect(preview!.epicName).toBe("Test Epic");
      expect(preview!.progress).toBe(50);
      expect(preview!.completedCount).toBe(1);
      expect(preview!.pausedAgents).toHaveLength(1);
      expect(preview!.pausedAgents[0]?.id).toBe("worker-1");
      expect(preview!.pausedAgents[0]?.progress).toBe(40);
    });
  });

  describe("getPausedAgentCount helper", () => {
    it("should return 0 when no state exists", () => {
      expect(getPausedAgentCount()).toBe(0);
    });

    it("should return count of paused agents", () => {
      const sessionState = createMockSessionState({
        activeAgents: [
          createMockAgent({ id: "worker-1", status: "paused" }),
          createMockAgent({ id: "worker-2", status: "paused" }),
          createMockAgent({ id: "worker-3", status: "working" }),
        ],
      });
      mockStateData["activeSession"] = sessionState;

      expect(getPausedAgentCount()).toBe(2);
    });
  });

  describe("getRunningAgentCount helper", () => {
    it("should return 0 when no state exists", () => {
      expect(getRunningAgentCount()).toBe(0);
    });

    it("should return count of running agents (working or idle)", () => {
      const sessionState = createMockSessionState({
        activeAgents: [
          createMockAgent({ id: "worker-1", status: "working" }),
          createMockAgent({ id: "worker-2", status: "idle" }),
          createMockAgent({ id: "worker-3", status: "paused" }),
        ],
      });
      mockStateData["activeSession"] = sessionState;

      expect(getRunningAgentCount()).toBe(2);
    });
  });
});
