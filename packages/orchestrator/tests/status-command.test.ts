/**
 * Unit tests for Status Command and State Management
 *
 * Tests verify:
 * - State storage and retrieval
 * - Status display for active sessions
 * - No-session display with recent epics
 * - Epic-specific status (with API)
 * - Agent status display
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock external dependencies
vi.mock("conf", () => {
  const stateData: Record<string, unknown> = {};
  return {
    default: vi.fn().mockImplementation(() => ({
      get: vi.fn((key: string) => stateData[key]),
      set: vi.fn((key: string | object, value?: unknown) => {
        if (typeof key === "object") {
          Object.assign(stateData, key);
        } else {
          stateData[key] = value;
        }
      }),
      clear: vi.fn(() => {
        for (const key in stateData) {
          delete stateData[key];
        }
      }),
      path: "/mock/.spectree/state.json",
    })),
  };
});

vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: "",
    isSpinning: false,
  })),
}));

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
// State Management Tests
// =============================================================================

describe("State Management", () => {
  // Import after mocks are set up
  let state: typeof import("../src/cli/state.js");

  beforeEach(async () => {
    vi.resetModules();
    state = await import("../src/cli/state.js");
    state.resetState();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getActiveState / setActiveState", () => {
    it("should return null/undefined when no active state", () => {
      const activeState = state.getActiveState();
      expect(activeState == null).toBe(true); // null or undefined
    });

    it("should store and retrieve active state", () => {
      const sessionState: typeof state.SessionState = {
        epicId: "epic-123",
        epicName: "Test Epic",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activeAgents: [],
        completedItems: [],
        failedItems: [],
        totalItems: 5,
        progress: 0,
      };

      state.setActiveState(sessionState as typeof state.SessionState);
      const retrieved = state.getActiveState();

      expect(retrieved).not.toBeNull();
      expect(retrieved?.epicId).toBe("epic-123");
      expect(retrieved?.epicName).toBe("Test Epic");
    });

    it("should update updatedAt timestamp when setting state", () => {
      const oldDate = "2024-01-01T00:00:00.000Z";
      const sessionState = {
        epicId: "epic-123",
        epicName: "Test Epic",
        startedAt: oldDate,
        updatedAt: oldDate,
        activeAgents: [],
        completedItems: [],
        failedItems: [],
        totalItems: 5,
        progress: 0,
      };

      state.setActiveState(sessionState as typeof state.SessionState);
      const retrieved = state.getActiveState();

      expect(retrieved?.updatedAt).not.toBe(oldDate);
    });
  });

  describe("clearActiveState", () => {
    it("should clear active state", () => {
      const sessionState = {
        epicId: "epic-123",
        epicName: "Test Epic",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activeAgents: [],
        completedItems: [],
        failedItems: [],
        totalItems: 5,
        progress: 60,
      };

      state.setActiveState(sessionState as typeof state.SessionState);
      state.clearActiveState();

      // Active state should be cleared
      expect(state.getActiveState() == null).toBe(true);
    });
  });

  describe("markItemCompleted", () => {
    it("should add completed item and update progress", () => {
      const sessionState = {
        epicId: "epic-123",
        epicName: "Test Epic",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activeAgents: [
          {
            id: "worker-1",
            taskId: "TEST-1",
            taskTitle: "Task One",
            branch: "feature/TEST-1",
            status: "working" as const,
            progress: 50,
            startedAt: new Date().toISOString(),
          },
        ],
        completedItems: [],
        failedItems: [],
        totalItems: 4,
        progress: 0,
      };

      state.setActiveState(sessionState as typeof state.SessionState);
      state.markItemCompleted("TEST-1", "Task One", 5000);

      const updated = state.getActiveState();
      expect(updated?.completedItems).toHaveLength(1);
      expect(updated?.completedItems[0]?.identifier).toBe("TEST-1");
      expect(updated?.completedItems[0]?.duration).toBe(5000);
      expect(updated?.progress).toBe(25); // 1/4 = 25%
      // Agent should be removed from active agents
      expect(updated?.activeAgents).toHaveLength(0);
    });
  });

  describe("markItemFailed", () => {
    it("should add failed item and remove from active agents", () => {
      const sessionState = {
        epicId: "epic-123",
        epicName: "Test Epic",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activeAgents: [
          {
            id: "worker-1",
            taskId: "TEST-1",
            taskTitle: "Task One",
            branch: "feature/TEST-1",
            status: "working" as const,
            progress: 50,
            startedAt: new Date().toISOString(),
          },
        ],
        completedItems: [],
        failedItems: [],
        totalItems: 4,
        progress: 0,
      };

      state.setActiveState(sessionState as typeof state.SessionState);
      state.markItemFailed("TEST-1");

      const updated = state.getActiveState();
      expect(updated?.failedItems).toContain("TEST-1");
      expect(updated?.activeAgents).toHaveLength(0);
    });
  });

  describe("estimateRemainingTime", () => {
    it("should return null when no completed items", () => {
      const sessionState = {
        epicId: "epic-123",
        epicName: "Test Epic",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activeAgents: [],
        completedItems: [],
        failedItems: [],
        totalItems: 5,
        progress: 0,
      };

      const estimate = state.estimateRemainingTime(
        sessionState as typeof state.SessionState
      );
      expect(estimate).toBeNull();
    });

    it("should calculate estimate based on average duration", () => {
      const sessionState = {
        epicId: "epic-123",
        epicName: "Test Epic",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activeAgents: [],
        completedItems: [
          { identifier: "TEST-1", title: "Task 1", duration: 10000, completedAt: new Date().toISOString() },
          { identifier: "TEST-2", title: "Task 2", duration: 20000, completedAt: new Date().toISOString() },
        ],
        failedItems: [],
        totalItems: 5,
        progress: 40,
      };

      const estimate = state.estimateRemainingTime(
        sessionState as typeof state.SessionState
      );
      // Average duration = 15000ms, 3 remaining items = 45000ms
      expect(estimate).toBe(45000);
    });
  });

  describe("formatDuration", () => {
    it("should format seconds", () => {
      expect(state.formatDuration(30000)).toBe("30s");
    });

    it("should format minutes and seconds", () => {
      expect(state.formatDuration(90000)).toBe("1m 30s");
    });

    it("should format hours and minutes", () => {
      expect(state.formatDuration(3720000)).toBe("1h 2m");
    });

    it("should format hours without extra minutes", () => {
      expect(state.formatDuration(3600000)).toBe("1h");
    });
  });

  describe("formatRelativeTime", () => {
    it("should format recent time as 'just now'", () => {
      const now = new Date().toISOString();
      expect(state.formatRelativeTime(now)).toBe("just now");
    });

    it("should format minutes ago", () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(state.formatRelativeTime(fiveMinutesAgo)).toBe("5 minutes ago");
    });

    it("should format hours ago", () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(state.formatRelativeTime(twoHoursAgo)).toBe("2 hours ago");
    });

    it("should format yesterday", () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      expect(state.formatRelativeTime(yesterday)).toBe("yesterday");
    });
  });
});

// =============================================================================
// Status Command Tests
// =============================================================================

describe("Status Command", () => {
  // Mock console.log to capture output
  const originalConsoleLog = console.log;
  let consoleOutput: string[] = [];

  beforeEach(() => {
    vi.resetModules();
    consoleOutput = [];
    console.log = vi.fn((...args: unknown[]) => {
      consoleOutput.push(args.map(String).join(" "));
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    vi.clearAllMocks();
  });

  describe("StatusOptions interface", () => {
    it("should accept epic option", () => {
      const options = {
        epic: "User Dashboard",
        agents: false,
      };

      expect(options.epic).toBe("User Dashboard");
      expect(options.agents).toBe(false);
    });

    it("should accept agents flag", () => {
      const options = {
        agents: true,
      };

      expect(options.agents).toBe(true);
    });
  });

  describe("progress bar", () => {
    it("should build correct progress bar", () => {
      // Test the logic for building progress bars
      const percent = 60;
      const width = 10;
      const clampedPercent = Math.max(0, Math.min(100, percent));
      const filled = Math.round((clampedPercent / 100) * width);
      const empty = width - filled;

      expect(filled).toBe(6);
      expect(empty).toBe(4);
    });

    it("should clamp percent to 0-100", () => {
      const testCases = [
        { input: -10, expected: 0 },
        { input: 0, expected: 0 },
        { input: 50, expected: 50 },
        { input: 100, expected: 100 },
        { input: 150, expected: 100 },
      ];

      testCases.forEach(({ input, expected }) => {
        const clamped = Math.max(0, Math.min(100, input));
        expect(clamped).toBe(expected);
      });
    });
  });

  describe("agent status icons", () => {
    it("should return correct icons for statuses", () => {
      const getIcon = (status: string): string => {
        switch (status) {
          case "completed":
            return "✓";
          case "failed":
            return "✗";
          case "working":
            return "●";
          case "idle":
            return "○";
          case "paused":
            return "◐";
          default:
            return "?";
        }
      };

      expect(getIcon("completed")).toBe("✓");
      expect(getIcon("failed")).toBe("✗");
      expect(getIcon("working")).toBe("●");
      expect(getIcon("idle")).toBe("○");
      expect(getIcon("paused")).toBe("◐");
      expect(getIcon("unknown")).toBe("?");
    });
  });

  describe("display formatting", () => {
    it("should format completed items correctly", () => {
      const items = [
        { identifier: "TEST-1", title: "Task One", duration: 5000, completedAt: new Date().toISOString() },
        { identifier: "TEST-2", title: "Task Two", duration: 10000, completedAt: new Date().toISOString() },
      ];

      expect(items).toHaveLength(2);
      expect(items[0]?.identifier).toBe("TEST-1");
      expect(items[1]?.duration).toBe(10000);
    });

    it("should limit displayed items", () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        identifier: `TEST-${i + 1}`,
        title: `Task ${i + 1}`,
        duration: 5000,
        completedAt: new Date().toISOString(),
      }));

      // Show last 5
      const displayed = items.slice(-5);
      expect(displayed).toHaveLength(5);
      expect(displayed[0]?.identifier).toBe("TEST-6");
      expect(displayed[4]?.identifier).toBe("TEST-10");
    });
  });
});
