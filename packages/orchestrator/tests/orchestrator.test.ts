/**
 * Unit tests for Single Agent Orchestrator
 *
 * Tests verify:
 * - Orchestration run with sequential execution
 * - SpecTree session lifecycle (start/end)
 * - Item execution flow (start_work → agent → complete_work)
 * - Progress event emission
 * - Resume from specific feature
 * - Error handling for agent failures
 * - Copilot SDK session management
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { EventEmitter } from "events";
import {
  Orchestrator,
  createOrchestrator,
  type RunOptions,
  type RunResult,
  type ProgressEvent,
} from "../src/orchestrator/orchestrator.js";
import {
  SpecTreeClient,
  type ExecutionPlan,
  type ExecutionPhase,
  type ExecutionItem,
  type StartSessionResponse,
} from "../src/spectree/api-client.js";
import { CopilotClient, type Tool } from "@github/copilot-sdk";
import { AgentError, OrchestratorError, ErrorCode } from "../src/errors.js";

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

const MOCK_SESSION_WITH_HANDOFF: StartSessionResponse = {
  ...MOCK_SESSION_RESPONSE,
  previousSession: {
    id: "prev-session-123",
    epicId: "epic-123",
    externalId: null,
    startedAt: "2023-12-31T00:00:00Z",
    endedAt: "2023-12-31T23:59:59Z",
    status: "completed",
    itemsWorkedOn: [
      {
        type: "feature",
        id: "feature-0",
        identifier: "COM-0",
        action: "completed",
        timestamp: "2023-12-31T12:00:00Z",
      },
    ],
    summary: "Completed initial setup",
    nextSteps: ["Continue with database schema"],
    blockers: null,
    decisions: [
      {
        decision: "Use PostgreSQL",
        rationale: "Better support for complex queries",
      },
    ],
    contextBlob: null,
    createdAt: "2023-12-31T00:00:00Z",
    updatedAt: "2023-12-31T23:59:59Z",
  },
};

// =============================================================================
// Mock Factories
// =============================================================================

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
  } as unknown as SpecTreeClient;
}

function createMockCopilotClient(responseContent = "Task completed successfully"): CopilotClient {
  const mockSession = {
    sendAndWait: vi.fn().mockResolvedValue({
      type: "assistant.message",
      data: { content: responseContent },
    }),
    destroy: vi.fn().mockResolvedValue(undefined),
  };

  return {
    createSession: vi.fn().mockResolvedValue(mockSession),
  } as unknown as CopilotClient;
}

function createMockTools(): Tool<unknown>[] {
  return [
    {
      name: "log_progress",
      description: "Log progress",
      parameters: {},
      handler: vi.fn(),
    } as unknown as Tool<unknown>,
  ];
}

// =============================================================================
// Tests
// =============================================================================

describe("Orchestrator", () => {
  let mockClient: SpecTreeClient;
  let mockCopilotClient: CopilotClient;
  let mockTools: Tool<unknown>[];
  let orchestrator: Orchestrator;

  beforeEach(() => {
    mockClient = createMockSpecTreeClient();
    mockCopilotClient = createMockCopilotClient();
    mockTools = createMockTools();
    orchestrator = new Orchestrator({
      client: mockClient,
      tools: mockTools,
      copilotClient: mockCopilotClient,
    });
  });

  describe("run()", () => {
    it("should load execution plan for the epic", async () => {
      await orchestrator.run("epic-123", { sequential: true });

      expect(mockClient.getExecutionPlan).toHaveBeenCalledWith("epic-123");
    });

    it("should start a SpecTree session", async () => {
      await orchestrator.run("epic-123", { sequential: true });

      expect(mockClient.startSession).toHaveBeenCalledWith({
        epicId: "epic-123",
        externalId: undefined,
      });
    });

    it("should end the SpecTree session with summary", async () => {
      await orchestrator.run("epic-123", { sequential: true });

      expect(mockClient.endSession).toHaveBeenCalledWith(
        "epic-123",
        expect.objectContaining({
          summary: expect.any(String),
        })
      );
    });

    it("should execute all items sequentially", async () => {
      await orchestrator.run("epic-123", { sequential: true });

      // Should have started work on all 3 items
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

      expect(mockClient.startSession).toHaveBeenCalledWith({
        epicId: "epic-123",
        externalId: "external-session-id",
      });
    });
  });

  describe("run() - fromFeature option", () => {
    it("should start from specified feature", async () => {
      const result = await orchestrator.run("epic-123", { fromFeature: "COM-2", sequential: true });

      // Should only process COM-2 and COM-3 (skipping COM-1)
      expect(mockClient.startWork).toHaveBeenCalledTimes(2);
      expect(result.completedItems).toContain("COM-2");
      expect(result.completedItems).toContain("COM-3");
      expect(result.completedItems).not.toContain("COM-1");
    });

    it("should accept case-insensitive feature identifier", async () => {
      await orchestrator.run("epic-123", { fromFeature: "com-2", sequential: true });

      expect(mockClient.startWork).toHaveBeenCalledTimes(2);
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

  describe("run() - Session Handoff", () => {
    it("should use handoff context from previous session", async () => {
      (mockClient.startSession as Mock).mockResolvedValueOnce(MOCK_SESSION_WITH_HANDOFF);

      await orchestrator.run("epic-123", { sequential: true });

      // The Copilot session should be created (we can't easily verify context in prompt)
      expect(mockCopilotClient.createSession).toHaveBeenCalled();
    });
  });

  describe("run() - Error Handling", () => {
    it("should stop on first item failure", async () => {
      const failingCopilotClient = createMockCopilotClient();
      const mockSession = {
        sendAndWait: vi.fn().mockRejectedValue(new Error("Agent failed")),
        destroy: vi.fn().mockResolvedValue(undefined),
      };
      (failingCopilotClient.createSession as Mock).mockResolvedValue(mockSession);

      const orch = new Orchestrator({
        client: mockClient,
        tools: mockTools,
        copilotClient: failingCopilotClient,
      });

      const result = await orch.run("epic-123");

      expect(result.success).toBe(false);
      expect(result.failedItems).toHaveLength(1);
      expect(result.failedItems[0]).toBe("COM-1");
      // Should not have processed remaining items
      expect(mockClient.startWork).toHaveBeenCalledTimes(1);
    });

    it("should still end session on error", async () => {
      const failingCopilotClient = createMockCopilotClient();
      const mockSession = {
        sendAndWait: vi.fn().mockRejectedValue(new Error("Agent failed")),
        destroy: vi.fn().mockResolvedValue(undefined),
      };
      (failingCopilotClient.createSession as Mock).mockResolvedValue(mockSession);

      const orch = new Orchestrator({
        client: mockClient,
        tools: mockTools,
        copilotClient: failingCopilotClient,
      });

      await orch.run("epic-123");

      expect(mockClient.endSession).toHaveBeenCalled();
    });

    it("should include next steps for failed items", async () => {
      const failingCopilotClient = createMockCopilotClient();
      const mockSession = {
        sendAndWait: vi.fn().mockRejectedValue(new Error("Agent failed")),
        destroy: vi.fn().mockResolvedValue(undefined),
      };
      (failingCopilotClient.createSession as Mock).mockResolvedValue(mockSession);

      const orch = new Orchestrator({
        client: mockClient,
        tools: mockTools,
        copilotClient: failingCopilotClient,
      });

      await orch.run("epic-123");

      expect(mockClient.endSession).toHaveBeenCalledWith(
        "epic-123",
        expect.objectContaining({
          nextSteps: expect.arrayContaining([
            expect.stringContaining("Retry failed items"),
          ]),
        })
      );
    });
  });

  describe("Item Execution Flow", () => {
    it("should call startWork before agent execution", async () => {
      const callOrder: string[] = [];
      (mockClient.startWork as Mock).mockImplementation(() => {
        callOrder.push("startWork");
        return Promise.resolve({
          id: "feature-1",
          identifier: "COM-1",
          status: "In Progress",
        });
      });
      (mockCopilotClient.createSession as Mock).mockImplementation(() => {
        callOrder.push("createSession");
        return Promise.resolve({
          sendAndWait: vi.fn().mockResolvedValue({ data: { content: "Done" } }),
          destroy: vi.fn().mockResolvedValue(undefined),
        });
      });

      await orchestrator.run("epic-123", { sequential: true });

      // startWork should come before createSession for each item
      const startWorkIndex = callOrder.indexOf("startWork");
      const createSessionIndex = callOrder.indexOf("createSession");
      expect(startWorkIndex).toBeLessThan(createSessionIndex);
    });

    it("should call completeWork after successful agent execution", async () => {
      await orchestrator.run("epic-123", { sequential: true });

      // All items should have completeWork called
      expect(mockClient.completeWork).toHaveBeenCalledTimes(3);
    });

    it("should pass summary to completeWork", async () => {
      const copilotWithSummary = createMockCopilotClient("Implemented the database schema");
      const orch = new Orchestrator({
        client: mockClient,
        tools: mockTools,
        copilotClient: copilotWithSummary,
      });

      await orch.run("epic-123", { sequential: true });

      expect(mockClient.completeWork).toHaveBeenCalledWith(
        "feature",
        "feature-1",
        expect.objectContaining({
          summary: "Implemented the database schema",
        })
      );
    });
  });

  describe("Copilot SDK Integration", () => {
    it("should create session with correct model", async () => {
      await orchestrator.run("epic-123", { sequential: true });

      expect(mockCopilotClient.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4.1",
        })
      );
    });

    it("should create session with system message", async () => {
      await orchestrator.run("epic-123", { sequential: true });

      expect(mockCopilotClient.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          systemMessage: expect.objectContaining({
            content: expect.stringContaining("SpecTree orchestrator"),
          }),
        })
      );
    });

    it("should create session with tools", async () => {
      await orchestrator.run("epic-123", { sequential: true });

      expect(mockCopilotClient.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: mockTools,
        })
      );
    });

    it("should destroy session after each item", async () => {
      await orchestrator.run("epic-123", { sequential: true });

      // Get the mock session and verify destroy was called
      const mockSession = await (mockCopilotClient.createSession as Mock).mock.results[0].value;
      expect(mockSession.destroy).toHaveBeenCalled();
    });

    it("should send task prompt with title and description", async () => {
      await orchestrator.run("epic-123", { sequential: true });

      const mockSession = await (mockCopilotClient.createSession as Mock).mock.results[0].value;
      expect(mockSession.sendAndWait).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("Database Schema"),
        })
      );
    });
  });

  describe("Progress Events", () => {
    it("should emit item:start event when starting item", async () => {
      const events: ProgressEvent[] = [];
      orchestrator.on("item:start", (event) => events.push(event));

      await orchestrator.run("epic-123", { sequential: true });

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe("item:start");
      expect(events[0].item.identifier).toBe("COM-1");
    });

    it("should emit item:complete event when item completes", async () => {
      const events: ProgressEvent[] = [];
      orchestrator.on("item:complete", (event) => events.push(event));

      await orchestrator.run("epic-123", { sequential: true });

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe("item:complete");
      expect(events[0].result).toBeDefined();
      expect(events[0].result?.success).toBe(true);
    });

    it("should emit item:error event when item fails", async () => {
      const failingCopilotClient = createMockCopilotClient();
      const mockSession = {
        sendAndWait: vi.fn().mockRejectedValue(new Error("Agent failed")),
        destroy: vi.fn().mockResolvedValue(undefined),
      };
      (failingCopilotClient.createSession as Mock).mockResolvedValue(mockSession);

      const orch = new Orchestrator({
        client: mockClient,
        tools: mockTools,
        copilotClient: failingCopilotClient,
      });

      const events: ProgressEvent[] = [];
      orch.on("item:error", (event) => events.push(event));

      await orch.run("epic-123");

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("item:error");
      expect(events[0].error).toBeDefined();
    });

    it("should include item details in events", async () => {
      const events: ProgressEvent[] = [];
      orchestrator.on("item:start", (event) => events.push(event));

      await orchestrator.run("epic-123", { sequential: true });

      expect(events[0].item.id).toBe("feature-1");
      expect(events[0].item.title).toBe("Database Schema");
      expect(events[0].item.type).toBe("feature");
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

      // 3 items × 2 listeners = 6 calls
      expect(count).toBe(6);
    });

    it("should support once() listeners", async () => {
      let count = 0;
      orchestrator.once("item:start", () => count++);

      await orchestrator.run("epic-123", { sequential: true });

      expect(count).toBe(1);
    });
  });
});

describe("createOrchestrator", () => {
  it("should create an Orchestrator instance", () => {
    const mockClient = createMockSpecTreeClient();
    const mockTools = createMockTools();

    const orchestrator = createOrchestrator({
      client: mockClient,
      tools: mockTools,
    });

    expect(orchestrator).toBeInstanceOf(Orchestrator);
  });

  it("should accept optional copilotClient", () => {
    const mockClient = createMockSpecTreeClient();
    const mockTools = createMockTools();
    const mockCopilotClient = createMockCopilotClient();

    const orchestrator = createOrchestrator({
      client: mockClient,
      tools: mockTools,
      copilotClient: mockCopilotClient,
    });

    expect(orchestrator).toBeInstanceOf(Orchestrator);
  });
});
