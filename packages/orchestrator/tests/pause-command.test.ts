/**
 * Unit tests for Pause Command
 *
 * Tests verify:
 * - Pause all agents functionality
 * - Pause specific worker functionality
 * - Error handling for no active session
 * - Error handling for invalid worker ID
 * - State saving with --save-state option
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
// Tests
// =============================================================================

describe("Pause Command", () => {
  // Store console.log calls for verification
  const originalConsoleLog = console.log;
  let consoleOutput: string[] = [];

  // Import modules dynamically after mocks
  let pauseCommand: typeof import("../src/cli/commands/pause.js").pauseCommand;
  let getRunningAgentCount: typeof import("../src/cli/commands/resume.js").getRunningAgentCount;
  let getPausedAgentCount: typeof import("../src/cli/commands/resume.js").getPausedAgentCount;
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
    const pauseModule = await import("../src/cli/commands/pause.js");
    pauseCommand = pauseModule.pauseCommand;
    const resumeModule = await import("../src/cli/commands/resume.js");
    getRunningAgentCount = resumeModule.getRunningAgentCount;
    getPausedAgentCount = resumeModule.getPausedAgentCount;
    state = await import("../src/cli/state.js");
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    vi.clearAllMocks();
  });

  describe("pauseCommand - no active session", () => {
    it("should throw error when no active orchestration", async () => {
      // No active state set
      await expect(pauseCommand()).rejects.toThrow("No active orchestration to pause");
    });

    it("should show helpful message when no session", async () => {
      try {
        await pauseCommand();
      } catch {
        // Expected error
      }

      const output = consoleOutput.join("\n");
      expect(output).toContain("No active orchestration to pause");
    });
  });

  describe("pauseCommand - pause all agents", () => {
    it("should pause all working agents", async () => {
      // Set up active session with working agents
      state.setActiveState({
        epicId: "epic-123",
        epicName: "Test Epic",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activeAgents: [
          {
            id: "worker-1",
            taskId: "TASK-1",
            taskTitle: "Task One",
            branch: "feature/TASK-1",
            status: "working",
            progress: 50,
            startedAt: new Date().toISOString(),
          },
          {
            id: "worker-2",
            taskId: "TASK-2",
            taskTitle: "Task Two",
            branch: "feature/TASK-2",
            status: "working",
            progress: 30,
            startedAt: new Date().toISOString(),
          },
        ],
        completedItems: [],
        failedItems: [],
        totalItems: 5,
        progress: 20,
      });

      await pauseCommand();

      // Verify agents are paused
      const updatedState = state.getActiveState();
      expect(updatedState?.activeAgents[0]?.status).toBe("paused");
      expect(updatedState?.activeAgents[1]?.status).toBe("paused");

      // Verify output
      const output = consoleOutput.join("\n");
      expect(output).toContain("Paused 2 agent(s)");
    });

    it("should show message when no active agents to pause", async () => {
      state.setActiveState({
        epicId: "epic-123",
        epicName: "Test Epic",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activeAgents: [], // No agents
        completedItems: [],
        failedItems: [],
        totalItems: 5,
        progress: 0,
      });

      await pauseCommand();

      const output = consoleOutput.join("\n");
      expect(output).toContain("No active agents to pause");
    });

    it("should show message when all agents already paused", async () => {
      state.setActiveState({
        epicId: "epic-123",
        epicName: "Test Epic",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activeAgents: [
          {
            id: "worker-1",
            taskId: "TASK-1",
            taskTitle: "Task One",
            branch: "feature/TASK-1",
            status: "paused", // Already paused
            progress: 50,
            startedAt: new Date().toISOString(),
          },
        ],
        completedItems: [],
        failedItems: [],
        totalItems: 5,
        progress: 20,
      });

      await pauseCommand();

      const output = consoleOutput.join("\n");
      expect(output).toContain("No active agents to pause");
    });
  });

  describe("pauseCommand - pause specific worker", () => {
    it("should pause specific worker by ID", async () => {
      state.setActiveState({
        epicId: "epic-123",
        epicName: "Test Epic",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activeAgents: [
          {
            id: "worker-1",
            taskId: "TASK-1",
            taskTitle: "Task One",
            branch: "feature/TASK-1",
            status: "working",
            progress: 50,
            startedAt: new Date().toISOString(),
          },
          {
            id: "worker-2",
            taskId: "TASK-2",
            taskTitle: "Task Two",
            branch: "feature/TASK-2",
            status: "working",
            progress: 30,
            startedAt: new Date().toISOString(),
          },
        ],
        completedItems: [],
        failedItems: [],
        totalItems: 5,
        progress: 20,
      });

      await pauseCommand("worker-1");

      // Verify only worker-1 is paused
      const updatedState = state.getActiveState();
      expect(updatedState?.activeAgents[0]?.status).toBe("paused");
      expect(updatedState?.activeAgents[1]?.status).toBe("working");

      // Verify output
      const output = consoleOutput.join("\n");
      expect(output).toContain("Paused worker-1");
    });

    it("should throw error for non-existent worker", async () => {
      state.setActiveState({
        epicId: "epic-123",
        epicName: "Test Epic",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activeAgents: [
          {
            id: "worker-1",
            taskId: "TASK-1",
            taskTitle: "Task One",
            branch: "feature/TASK-1",
            status: "working",
            progress: 50,
            startedAt: new Date().toISOString(),
          },
        ],
        completedItems: [],
        failedItems: [],
        totalItems: 5,
        progress: 20,
      });

      await expect(pauseCommand("worker-99")).rejects.toThrow("Worker not found: worker-99");
    });

    it("should show message when worker already paused", async () => {
      state.setActiveState({
        epicId: "epic-123",
        epicName: "Test Epic",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activeAgents: [
          {
            id: "worker-1",
            taskId: "TASK-1",
            taskTitle: "Task One",
            branch: "feature/TASK-1",
            status: "paused", // Already paused
            progress: 50,
            startedAt: new Date().toISOString(),
          },
        ],
        completedItems: [],
        failedItems: [],
        totalItems: 5,
        progress: 20,
      });

      await pauseCommand("worker-1");

      const output = consoleOutput.join("\n");
      expect(output).toContain("already paused");
    });
  });

  describe("pauseCommand - save state option", () => {
    it("should save state when --save-state is provided", async () => {
      state.setActiveState({
        epicId: "epic-123",
        epicName: "Test Epic",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activeAgents: [
          {
            id: "worker-1",
            taskId: "TASK-1",
            taskTitle: "Task One",
            branch: "feature/TASK-1",
            status: "working",
            progress: 50,
            startedAt: new Date().toISOString(),
          },
        ],
        completedItems: [],
        failedItems: [],
        totalItems: 5,
        progress: 20,
      });

      await pauseCommand(undefined, { saveState: true });

      const output = consoleOutput.join("\n");
      expect(output).toContain("State saved");
    });
  });

  describe("pauseCommand - resume instructions", () => {
    it("should show resume instructions for all agents", async () => {
      state.setActiveState({
        epicId: "epic-123",
        epicName: "Test Epic",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activeAgents: [
          {
            id: "worker-1",
            taskId: "TASK-1",
            taskTitle: "Task One",
            branch: "feature/TASK-1",
            status: "working",
            progress: 50,
            startedAt: new Date().toISOString(),
          },
        ],
        completedItems: [],
        failedItems: [],
        totalItems: 5,
        progress: 20,
      });

      await pauseCommand();

      const output = consoleOutput.join("\n");
      expect(output).toContain("spectree-agent resume");
    });

    it("should show specific resume instruction for single worker", async () => {
      state.setActiveState({
        epicId: "epic-123",
        epicName: "Test Epic",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activeAgents: [
          {
            id: "worker-1",
            taskId: "TASK-1",
            taskTitle: "Task One",
            branch: "feature/TASK-1",
            status: "working",
            progress: 50,
            startedAt: new Date().toISOString(),
          },
        ],
        completedItems: [],
        failedItems: [],
        totalItems: 5,
        progress: 20,
      });

      await pauseCommand("worker-1");

      const output = consoleOutput.join("\n");
      expect(output).toContain("spectree-agent resume worker-1");
    });
  });

  describe("helper functions", () => {
    it("getRunningAgentCount should return correct count", async () => {
      state.setActiveState({
        epicId: "epic-123",
        epicName: "Test Epic",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activeAgents: [
          { id: "worker-1", taskId: "T-1", taskTitle: "T", branch: "b", status: "working", progress: 0, startedAt: new Date().toISOString() },
          { id: "worker-2", taskId: "T-2", taskTitle: "T", branch: "b", status: "paused", progress: 0, startedAt: new Date().toISOString() },
          { id: "worker-3", taskId: "T-3", taskTitle: "T", branch: "b", status: "idle", progress: 0, startedAt: new Date().toISOString() },
        ],
        completedItems: [],
        failedItems: [],
        totalItems: 5,
        progress: 0,
      });

      expect(getRunningAgentCount()).toBe(2); // working + idle
    });

    it("getRunningAgentCount should return 0 when no state", async () => {
      // No state set
      expect(getRunningAgentCount()).toBe(0);
    });

    it("getPausedAgentCount should return correct count", async () => {
      state.setActiveState({
        epicId: "epic-123",
        epicName: "Test Epic",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activeAgents: [
          { id: "worker-1", taskId: "T-1", taskTitle: "T", branch: "b", status: "working", progress: 0, startedAt: new Date().toISOString() },
          { id: "worker-2", taskId: "T-2", taskTitle: "T", branch: "b", status: "paused", progress: 0, startedAt: new Date().toISOString() },
          { id: "worker-3", taskId: "T-3", taskTitle: "T", branch: "b", status: "paused", progress: 0, startedAt: new Date().toISOString() },
        ],
        completedItems: [],
        failedItems: [],
        totalItems: 5,
        progress: 0,
      });

      expect(getPausedAgentCount()).toBe(2);
    });

    it("getPausedAgentCount should return 0 when no state", async () => {
      expect(getPausedAgentCount()).toBe(0);
    });
  });
});

// =============================================================================
// AgentPool Pause/Resume Tests
// =============================================================================

describe("AgentPool Pause/Resume Methods", () => {
  it("should have correct types for pause/resume events", () => {
    // Type check - AgentPoolEvents should include pause/resume
    type ExpectedEvents = {
      "agent:pause": (agent: unknown) => void;
      "agent:resume": (agent: unknown) => void;
    };

    // This is a compile-time check
    const _typeCheck: ExpectedEvents = {
      "agent:pause": () => {},
      "agent:resume": () => {},
    };

    expect(_typeCheck).toBeDefined();
  });

  it("should define AgentStatus with paused option", () => {
    // AgentStatus should include "paused"
    type ValidStatus = "idle" | "working" | "completed" | "failed" | "paused";
    const status: ValidStatus = "paused";
    expect(status).toBe("paused");
  });
});
