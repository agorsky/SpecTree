/**
 * Unit tests for Orchestrator with Parallel Agent Support
 *
 * Tests verify:
 * - Orchestration run with sequential execution
 * - SpecTree session lifecycle (start/end)
 * - Phase-based execution flow
 * - Progress event emission
 * - Resume from specific feature
 * - Error handling for agent failures
 * - ACP session management
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import {
  Orchestrator,
  createOrchestrator,
  type ProgressEvent,
} from "../src/orchestrator/orchestrator.js";
import {
  SpecTreeClient,
  type ExecutionPlan,
  type StartSessionResponse,
} from "../src/spectree/api-client.js";
import { AcpSessionManager, AcpSession } from "../src/acp/index.js";
import { OrchestratorError } from "../src/errors.js";
import { BranchManager } from "../src/git/branch-manager.js";
import { MergeCoordinator } from "../src/git/merge-coordinator.js";

// Mock the config module
vi.mock("../src/config/index.js", () => ({
  getApiUrl: () => "http://localhost:3001",
  getCopilotModel: () => "gpt-4.1",
  getConfig: () => ({
    apiUrl: "http://localhost:3001",
    maxConcurrentAgents: 4,
    copilot: { model: "gpt-4.1" },
  }),
}));

// =============================================================================
// Test Fixtures
// =============================================================================

const MOCK_EXECUTION_PLAN: ExecutionPlan = {
  epicId: "epic-123",
  phases: [
    {
      order: 1,
      items: [
        {
          type: "feature",
          id: "feature-1",
          identifier: "COM-1",
          title: "Database Schema",
          description: "Create user tables",
          statusId: null,
          executionOrder: 1,
          canParallelize: false,
          parallelGroup: null,
          dependencies: [],
          estimatedComplexity: "moderate",
        },
      ],
      canRunInParallel: false,
      estimatedComplexity: "moderate",
    },
    {
      order: 2,
      items: [
        {
          type: "feature",
          id: "feature-2",
          identifier: "COM-2",
          title: "REST API",
          description: "Implement API endpoints",
          statusId: null,
          executionOrder: 2,
          canParallelize: true,
          parallelGroup: "api",
          dependencies: ["feature-1"],
          estimatedComplexity: "complex",
        },
        {
          type: "feature",
          id: "feature-3",
          identifier: "COM-3",
          title: "MCP Tools",
          description: "Implement MCP tool handlers",
          statusId: null,
          executionOrder: 3,
          canParallelize: true,
          parallelGroup: "api",
          dependencies: ["feature-1"],
          estimatedComplexity: "complex",
        },
      ],
      canRunInParallel: true,
      estimatedComplexity: "complex",
    },
  ],
  totalItems: 3,
};

const MOCK_SESSION_RESPONSE: StartSessionResponse = {
  session: {
    id: "session-123",
    epicId: "epic-123",
    externalId: null,
    startedAt: "2024-01-01T00:00:00Z",
    endedAt: null,
    status: "active",
    itemsWorkedOn: [],
    summary: null,
    nextSteps: null,
    blockers: null,
    decisions: null,
    contextBlob: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  previousSession: null,
  epicProgress: {
    totalFeatures: 3,
    completedFeatures: 0,
    inProgressFeatures: 0,
    totalTasks: 0,
    completedTasks: 0,
  },
};

// =============================================================================
// Mock Factories
// =============================================================================

function createMockAcpSession(responseContent = "Task completed successfully", errorMessage?: string): AcpSession {
  const session = new EventEmitter() as AcpSession;

  (session as unknown as Record<string, unknown>).send = vi.fn().mockImplementation(() => {
    setTimeout(() => {
      if (errorMessage) {
        (session as EventEmitter).emit("error", new Error(errorMessage));
      } else {
        if (responseContent) {
          (session as EventEmitter).emit("text", responseContent);
        }
        (session as EventEmitter).emit("complete", responseContent);
      }
    }, 10);
    return Promise.resolve("msg-1");
  });

  (session as unknown as Record<string, unknown>).sendAndWait = vi.fn().mockImplementation(() => {
    if (errorMessage) {
      return Promise.reject(new Error(errorMessage));
    }
    return Promise.resolve(responseContent);
  });

  (session as unknown as Record<string, unknown>).destroy = vi.fn().mockResolvedValue(undefined);
  (session as unknown as Record<string, unknown>).sessionId = "mock-session-id";
  (session as unknown as Record<string, unknown>).getStatus = vi.fn().mockReturnValue("idle");

  return session;
}

function createMockSessionManager(responseContent = "Task completed successfully", errorMessage?: string): AcpSessionManager {
  return {
    createSession: vi.fn().mockImplementation(() => {
      return Promise.resolve(createMockAcpSession(responseContent, errorMessage));
    }),
    getSession: vi.fn(),
    destroySession: vi.fn().mockResolvedValue(undefined),
    destroyAll: vi.fn().mockResolvedValue(undefined),
    activeSessions: 0,
  } as unknown as AcpSessionManager;
}

function createMockSpecTreeClient(): SpecTreeClient {
  return {
    getExecutionPlan: vi.fn().mockResolvedValue(MOCK_EXECUTION_PLAN),
    startSession: vi.fn().mockResolvedValue(MOCK_SESSION_RESPONSE),
    endSession: vi.fn().mockResolvedValue(MOCK_SESSION_RESPONSE.session),
    startWork: vi.fn().mockResolvedValue({
      id: "feature-1",
      identifier: "COM-1",
      status: "In Progress",
      startedAt: new Date().toISOString(),
      completedAt: null,
      percentComplete: 0,
    }),
    completeWork: vi.fn().mockResolvedValue({
      id: "feature-1",
      identifier: "COM-1",
      status: "Done",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      percentComplete: 100,
    }),
    logProgress: vi.fn().mockResolvedValue({
      id: "feature-1",
      identifier: "COM-1",
      status: "In Progress",
      percentComplete: 50,
    }),
    listTasks: vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
  } as unknown as SpecTreeClient;
}

function createMockBranchManager(): BranchManager {
  return {
    generateBranchName: vi.fn().mockImplementation((id: string, title: string) =>
      `feature/${id}-${title.toLowerCase().replace(/\s+/g, "-").substring(0, 20)}`
    ),
    createBranch: vi.fn().mockResolvedValue(undefined),
    getDefaultBranch: vi.fn().mockResolvedValue("main"),
    getCurrentBranch: vi.fn().mockResolvedValue("main"),
    deleteBranch: vi.fn().mockResolvedValue(undefined),
    branchExists: vi.fn().mockResolvedValue(false),
    checkout: vi.fn().mockResolvedValue(undefined),
  } as unknown as BranchManager;
}

function createMockMergeCoordinator(): MergeCoordinator {
  return {
    mergeBranch: vi.fn().mockResolvedValue(undefined),
    formatConflictGuidance: vi.fn().mockReturnValue("Resolve conflicts manually"),
  } as unknown as MergeCoordinator;
}

// =============================================================================
// Tests
// =============================================================================

describe("Orchestrator", () => {
  let mockClient: SpecTreeClient;
  let mockSessionManager: AcpSessionManager;
  let mockBranchManager: BranchManager;
  let mockMergeCoordinator: MergeCoordinator;
  let orchestrator: Orchestrator;

  beforeEach(() => {
    mockClient = createMockSpecTreeClient();
    mockSessionManager = createMockSessionManager();
    mockBranchManager = createMockBranchManager();
    mockMergeCoordinator = createMockMergeCoordinator();
    orchestrator = new Orchestrator({
      client: mockClient,
      sessionManager: mockSessionManager,
      branchManager: mockBranchManager,
      mergeCoordinator: mockMergeCoordinator,
    });
  });

  describe("run()", () => {
    it("should load execution plan for the epic", async () => {
      await orchestrator.run("epic-123", { sequential: true });
      expect(mockClient.getExecutionPlan).toHaveBeenCalledWith("epic-123");
    });

    it("should start a SpecTree session", async () => {
      await orchestrator.run("epic-123", { sequential: true });
      expect(mockClient.startSession).toHaveBeenCalledWith(
        expect.objectContaining({ epicId: "epic-123" })
      );
    });

    it("should end the SpecTree session with summary", async () => {
      await orchestrator.run("epic-123", { sequential: true });
      expect(mockClient.endSession).toHaveBeenCalledWith(
        "epic-123",
        expect.objectContaining({ summary: expect.any(String) })
      );
    });

    it("should execute all items sequentially", async () => {
      await orchestrator.run("epic-123", { sequential: true });
      expect(mockClient.startWork).toHaveBeenCalledTimes(3);
      expect(mockClient.completeWork).toHaveBeenCalledTimes(3);
    });

    it("should return success when all items complete", async () => {
      const result = await orchestrator.run("epic-123", { sequential: true });
      expect(result.success).toBe(true);
      expect(result.completedItems).toHaveLength(3);
      expect(result.failedItems).toHaveLength(0);
    });

    it("should return duration in milliseconds", async () => {
      const result = await orchestrator.run("epic-123", { sequential: true });
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe("number");
    });

    it("should return a summary", async () => {
      const result = await orchestrator.run("epic-123", { sequential: true });
      expect(result.summary).toBeDefined();
      expect(result.summary).toContain("Completed 3 item(s)");
    });

    it("should respect sessionId option", async () => {
      await orchestrator.run("epic-123", { sessionId: "external-session-id", sequential: true });
      expect(mockClient.startSession).toHaveBeenCalledWith(
        expect.objectContaining({ epicId: "epic-123", externalId: "external-session-id" })
      );
    });
  });

  describe("run() - fromFeature option", () => {
    it("should start from specified feature", async () => {
      const result = await orchestrator.run("epic-123", { fromFeature: "COM-2", sequential: true });
      expect(result.completedItems).toContain("COM-2");
      expect(result.completedItems).toContain("COM-3");
      expect(result.completedItems).not.toContain("COM-1");
    });

    it("should accept case-insensitive feature identifier", async () => {
      const result = await orchestrator.run("epic-123", { fromFeature: "com-2", sequential: true });
      expect(result.completedItems).toContain("COM-2");
    });

    it("should throw error for non-existent feature", async () => {
      await expect(
        orchestrator.run("epic-123", { fromFeature: "INVALID", sequential: true })
      ).rejects.toThrow(OrchestratorError);
    });

    it("should include available features in error hint", async () => {
      try {
        await orchestrator.run("epic-123", { fromFeature: "INVALID", sequential: true });
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as OrchestratorError).recoveryHint).toContain("COM-1");
        expect((error as OrchestratorError).recoveryHint).toContain("COM-2");
        expect((error as OrchestratorError).recoveryHint).toContain("COM-3");
      }
    });
  });

  describe("run() - Error Handling", () => {
    it("should handle item failure", async () => {
      const failingManager = createMockSessionManager("", "Agent failed");
      const orch = new Orchestrator({
        client: mockClient,
        sessionManager: failingManager,
        branchManager: mockBranchManager,
        mergeCoordinator: mockMergeCoordinator,
      });
      const result = await orch.run("epic-123", { sequential: true });
      expect(result.success).toBe(false);
      expect(result.failedItems.length).toBeGreaterThan(0);
    });

    it("should still end session on error", async () => {
      const failingManager = createMockSessionManager("", "Agent failed");
      const orch = new Orchestrator({
        client: mockClient,
        sessionManager: failingManager,
        branchManager: mockBranchManager,
        mergeCoordinator: mockMergeCoordinator,
      });
      await orch.run("epic-123", { sequential: true });
      expect(mockClient.endSession).toHaveBeenCalled();
    });
  });

  describe("ACP Session Integration", () => {
    it("should create ACP sessions via session manager", async () => {
      await orchestrator.run("epic-123", { sequential: true });
      expect(mockSessionManager.createSession).toHaveBeenCalled();
    });

    it("should create session with system message", async () => {
      await orchestrator.run("epic-123", { sequential: true });
      expect(mockSessionManager.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          systemMessage: expect.stringContaining("parallel execution team"),
        })
      );
    });
  });

  describe("Progress Events", () => {
    it("should emit phase:start event", async () => {
      const events: ProgressEvent[] = [];
      orchestrator.on("phase:start", (event) => events.push(event));
      await orchestrator.run("epic-123", { sequential: true });
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].type).toBe("phase:start");
    });

    it("should emit phase:complete event", async () => {
      const events: ProgressEvent[] = [];
      orchestrator.on("phase:complete", (event) => events.push(event));
      await orchestrator.run("epic-123", { sequential: true });
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].type).toBe("phase:complete");
    });

    it("should emit item:start event when starting item", async () => {
      const events: ProgressEvent[] = [];
      orchestrator.on("item:start", (event) => events.push(event));
      await orchestrator.run("epic-123", { sequential: true });
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].type).toBe("item:start");
    });

    it("should emit item:complete event when item completes", async () => {
      const events: ProgressEvent[] = [];
      orchestrator.on("item:complete", (event) => events.push(event));
      await orchestrator.run("epic-123", { sequential: true });
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].type).toBe("item:complete");
    });
  });

  describe("EventEmitter behavior", () => {
    it("should extend EventEmitter", () => {
      expect(orchestrator).toBeInstanceOf(EventEmitter);
    });

    it("should support multiple listeners", async () => {
      let count = 0;
      orchestrator.on("item:start", () => count++);
      orchestrator.on("item:start", () => count++);
      await orchestrator.run("epic-123", { sequential: true });
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it("should support once() listeners", async () => {
      let count = 0;
      orchestrator.once("item:start", () => count++);
      await orchestrator.run("epic-123", { sequential: true });
      expect(count).toBe(1);
    });
  });

  describe("Branch Management", () => {
    it("should use branch manager for branch operations", async () => {
      await orchestrator.run("epic-123", { sequential: true });
      expect(mockBranchManager.createBranch).toHaveBeenCalled();
    });

    it("should get default branch", async () => {
      await orchestrator.run("epic-123", { sequential: true });
      expect(mockBranchManager.getDefaultBranch).toHaveBeenCalled();
    });
  });

  describe("Agent Pool Status", () => {
    it("should return null pool status when not running", () => {
      expect(orchestrator.getAgentPoolStatus()).toBeNull();
    });
  });
});

describe("createOrchestrator", () => {
  it("should create an Orchestrator instance", () => {
    const mockClient = createMockSpecTreeClient();
    const mockSessionManager = createMockSessionManager();
    const orchestrator = createOrchestrator({
      client: mockClient,
      sessionManager: mockSessionManager,
    });
    expect(orchestrator).toBeInstanceOf(Orchestrator);
  });
});
