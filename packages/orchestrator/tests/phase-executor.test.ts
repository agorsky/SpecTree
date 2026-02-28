/**
 * Unit tests for Phase Executor
 *
 * Tests verify:
 * - Phase execution with parallel items
 * - Phase execution with sequential items
 * - Item progress tracking via SpecTree
 * - Event emissions for phase and item lifecycle
 * - Error handling and failure isolation
 * - Branch management during execution
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { EventEmitter } from "events";
import {
  PhaseExecutor,
  createPhaseExecutor,
  type PhaseResult,
  type ItemResult,
  type PhaseExecutorOptions,
} from "../src/orchestrator/phase-executor.js";
import {
  AgentPool,
  type Agent,
  type AgentResult,
} from "../src/orchestrator/agent-pool.js";
import { BranchManager } from "../src/git/branch-manager.js";
import type {
  SpecTreeClient,
  ExecutionItem,
  ExecutionPhase,
} from "../src/spectree/api-client.js";
import { OrchestratorError, AgentError, ErrorCode } from "../src/errors.js";

// Mock the config module
vi.mock("../src/config/index.js", () => ({
  getApiUrl: () => "http://localhost:3001",
  getCopilotModel: () => "gpt-4.1",
}));

// =============================================================================
// Test Fixtures
// =============================================================================

const createMockItem = (overrides?: Partial<ExecutionItem>): ExecutionItem => ({
  type: "feature",
  id: `feature-${Math.random().toString(36).slice(2)}`,
  identifier: `COM-${Math.floor(Math.random() * 100)}`,
  title: "Test Feature",
  description: "Test description",
  statusId: null,
  executionOrder: 1,
  canParallelize: true,
  parallelGroup: "default",
  dependencies: [],
  estimatedComplexity: "moderate",
  ...overrides,
});

const MOCK_ITEM_1: ExecutionItem = {
  type: "feature",
  id: "feature-1",
  identifier: "COM-1",
  title: "Implement User Auth",
  description: "Create user authentication system",
  statusId: null,
  executionOrder: 1,
  canParallelize: true,
  parallelGroup: "auth",
  dependencies: [],
  estimatedComplexity: "moderate",
};

const MOCK_ITEM_2: ExecutionItem = {
  type: "feature",
  id: "feature-2",
  identifier: "COM-2",
  title: "Implement API",
  description: "Create REST API endpoints",
  statusId: null,
  executionOrder: 2,
  canParallelize: true,
  parallelGroup: "api",
  dependencies: [],
  estimatedComplexity: "complex",
};

const MOCK_ITEM_3: ExecutionItem = {
  type: "task",
  id: "task-1",
  identifier: "COM-3",
  title: "Write tests",
  description: "Add unit tests",
  statusId: null,
  executionOrder: 3,
  canParallelize: false,
  parallelGroup: null,
  dependencies: ["feature-1"],
  estimatedComplexity: "simple",
};

const createMockPhase = (
  items: ExecutionItem[],
  canRunInParallel: boolean
): ExecutionPhase => ({
  order: 1,
  items,
  canRunInParallel,
  estimatedComplexity: "moderate",
});

// =============================================================================
// Mock Factories
// =============================================================================

function createMockSpecTreeClient(): SpecTreeClient {
  return {
    startWork: vi.fn().mockResolvedValue({
      id: "feature-1",
      identifier: "COM-1",
      status: "In Progress",
    }),
    completeWork: vi.fn().mockResolvedValue({
      id: "feature-1",
      identifier: "COM-1",
      status: "Done",
    }),
    logProgress: vi.fn().mockResolvedValue({
      id: "feature-1",
      identifier: "COM-1",
      percentComplete: 50,
    }),
  } as unknown as SpecTreeClient;
}

function createMockBranchManager(): BranchManager {
  return {
    createBranch: vi.fn().mockResolvedValue(undefined),
    checkout: vi.fn().mockResolvedValue(undefined),
    getCurrentBranch: vi.fn().mockResolvedValue("main"),
    getDefaultBranch: vi.fn().mockResolvedValue("main"),
    generateBranchName: vi
      .fn()
      .mockImplementation(
        (identifier: string, title: string) =>
          `feature/${identifier}-${title.toLowerCase().replace(/\s+/g, "-").slice(0, 20)}`
      ),
    branchExists: vi.fn().mockResolvedValue(false),
    getBranchPrefix: vi.fn().mockReturnValue("feature/"),
  } as unknown as BranchManager;
}

let agentIdCounter = 1;

function createMockAgentPool(): AgentPool {
  const mockAgents = new Map<string, Agent>();

  const pool = {
    spawnAgent: vi.fn().mockImplementation(async (item: ExecutionItem, branch: string) => {
      const agent: Agent = {
        id: `worker-${agentIdCounter++}`,
        taskId: item.identifier,
        branch,
        status: "idle",
        session: {} as never,
        progress: 0,
        startedAt: new Date(),
        item,
      };
      mockAgents.set(agent.id, agent);
      return agent;
    }),
    startAgent: vi.fn().mockImplementation(async (agentId: string, _prompt: string) => {
      const agent = mockAgents.get(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }
      return {
        agentId,
        taskId: agent.taskId,
        success: true,
        summary: "Task completed successfully",
        duration: 1000,
      } as AgentResult;
    }),
    getAgent: vi.fn().mockImplementation((id: string) => mockAgents.get(id)),
    removeAgent: vi.fn().mockImplementation((id: string) => mockAgents.delete(id)),
    getStatus: vi.fn().mockReturnValue({
      maxAgents: 4,
      activeCount: mockAgents.size,
      idleCount: 0,
      workingCount: 0,
      completedCount: 0,
      failedCount: 0,
      atCapacity: false,
    }),
    hasCapacity: vi.fn().mockReturnValue(true),
    on: vi.fn(),
    emit: vi.fn(),
  } as unknown as AgentPool;

  return pool;
}

function createMockAgentPoolWithFailure(
  failingItemId?: string
): AgentPool {
  const mockAgents = new Map<string, Agent>();

  const pool = {
    spawnAgent: vi.fn().mockImplementation(async (item: ExecutionItem, branch: string) => {
      if (item.id === failingItemId) {
        throw AgentError.spawnFailed(`spawn-${item.identifier}`, item.id);
      }
      const agent: Agent = {
        id: `worker-${agentIdCounter++}`,
        taskId: item.identifier,
        branch,
        status: "idle",
        session: {} as never,
        progress: 0,
        startedAt: new Date(),
        item,
      };
      mockAgents.set(agent.id, agent);
      return agent;
    }),
    startAgent: vi.fn().mockImplementation(async (agentId: string, _prompt: string) => {
      const agent = mockAgents.get(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }
      if (agent.item.id === failingItemId) {
        return {
          agentId,
          taskId: agent.taskId,
          success: false,
          error: AgentError.executionFailed(agentId, agent.taskId, "Execution failed"),
          duration: 500,
        } as AgentResult;
      }
      return {
        agentId,
        taskId: agent.taskId,
        success: true,
        summary: "Task completed successfully",
        duration: 1000,
      } as AgentResult;
    }),
    getAgent: vi.fn().mockImplementation((id: string) => mockAgents.get(id)),
    removeAgent: vi.fn().mockImplementation((id: string) => mockAgents.delete(id)),
    hasCapacity: vi.fn().mockReturnValue(true),
    on: vi.fn(),
    emit: vi.fn(),
  } as unknown as AgentPool;

  return pool;
}

function createExecutorOptions(overrides?: Partial<PhaseExecutorOptions>): PhaseExecutorOptions {
  return {
    agentPool: createMockAgentPool(),
    branchManager: createMockBranchManager(),
    specTreeClient: createMockSpecTreeClient(),
    taskLevelAgents: false,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("PhaseExecutor", () => {
  beforeEach(() => {
    agentIdCounter = 1;
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should extend EventEmitter", () => {
      const executor = new PhaseExecutor(createExecutorOptions());
      expect(executor).toBeInstanceOf(EventEmitter);
    });

    it("should accept session ID", () => {
      const executor = new PhaseExecutor(
        createExecutorOptions({ sessionId: "test-session" })
      );
      expect(executor).toBeDefined();
    });

    it("should accept base branch override", () => {
      const executor = new PhaseExecutor(
        createExecutorOptions({ baseBranch: "develop" })
      );
      expect(executor).toBeDefined();
    });
  });

  describe("createPhaseExecutor()", () => {
    it("should create a new PhaseExecutor instance", () => {
      const executor = createPhaseExecutor(createExecutorOptions());
      expect(executor).toBeInstanceOf(PhaseExecutor);
    });
  });

  describe("executePhase() - parallel execution", () => {
    it("should execute multiple items in parallel when canRunInParallel is true", async () => {
      const agentPool = createMockAgentPool();
      const executor = new PhaseExecutor(createExecutorOptions({ agentPool }));
      const phase = createMockPhase([MOCK_ITEM_1, MOCK_ITEM_2], true);

      const result = await executor.executePhase(phase);

      expect(result.success).toBe(true);
      expect(result.completedItems).toHaveLength(2);
      expect(result.completedItems).toContain("COM-1");
      expect(result.completedItems).toContain("COM-2");
      expect(result.failedItems).toHaveLength(0);
    });

    it("should create separate branches for parallel items", async () => {
      const branchManager = createMockBranchManager();
      const executor = new PhaseExecutor(
        createExecutorOptions({ branchManager })
      );
      const phase = createMockPhase([MOCK_ITEM_1, MOCK_ITEM_2], true);

      await executor.executePhase(phase);

      expect(branchManager.createBranch).toHaveBeenCalledTimes(2);
      expect(branchManager.generateBranchName).toHaveBeenCalledWith(
        "COM-1",
        "Implement User Auth"
      );
      expect(branchManager.generateBranchName).toHaveBeenCalledWith(
        "COM-2",
        "Implement API"
      );
    });

    it("should spawn separate agents for each parallel item", async () => {
      const agentPool = createMockAgentPool();
      const executor = new PhaseExecutor(createExecutorOptions({ agentPool }));
      const phase = createMockPhase([MOCK_ITEM_1, MOCK_ITEM_2], true);

      await executor.executePhase(phase);

      expect(agentPool.spawnAgent).toHaveBeenCalledTimes(2);
    });

    it("should mark work started for each item", async () => {
      const specTreeClient = createMockSpecTreeClient();
      const executor = new PhaseExecutor(
        createExecutorOptions({ specTreeClient })
      );
      const phase = createMockPhase([MOCK_ITEM_1, MOCK_ITEM_2], true);

      await executor.executePhase(phase);

      expect(specTreeClient.startWork).toHaveBeenCalledTimes(2);
      expect(specTreeClient.startWork).toHaveBeenCalledWith(
        "feature",
        "feature-1",
        undefined
      );
      expect(specTreeClient.startWork).toHaveBeenCalledWith(
        "feature",
        "feature-2",
        undefined
      );
    });

    it("should mark work completed for successful items", async () => {
      const specTreeClient = createMockSpecTreeClient();
      const executor = new PhaseExecutor(
        createExecutorOptions({ specTreeClient })
      );
      const phase = createMockPhase([MOCK_ITEM_1], true);

      await executor.executePhase(phase);

      expect(specTreeClient.completeWork).toHaveBeenCalledWith(
        "feature",
        "feature-1",
        expect.objectContaining({ summary: "Task completed successfully" })
      );
    });

    it("should include session ID in SpecTree calls when provided", async () => {
      const specTreeClient = createMockSpecTreeClient();
      const executor = new PhaseExecutor(
        createExecutorOptions({ specTreeClient, sessionId: "test-session" })
      );
      const phase = createMockPhase([MOCK_ITEM_1], true);

      await executor.executePhase(phase);

      expect(specTreeClient.startWork).toHaveBeenCalledWith(
        "feature",
        "feature-1",
        { sessionId: "test-session" }
      );
    });

    it("should continue executing other items if one fails to spawn", async () => {
      const agentPool = createMockAgentPoolWithFailure("feature-1");
      const executor = new PhaseExecutor(createExecutorOptions({ agentPool }));
      const phase = createMockPhase([MOCK_ITEM_1, MOCK_ITEM_2], true);

      const result = await executor.executePhase(phase);

      expect(result.success).toBe(false);
      expect(result.completedItems).toContain("COM-2");
      expect(result.failedItems).toContain("COM-1");
    });

    it("should emit phase:start event", async () => {
      const executor = new PhaseExecutor(createExecutorOptions());
      const phase = createMockPhase([MOCK_ITEM_1], true);
      const phaseStartEvents: ExecutionPhase[] = [];
      executor.on("phase:start", (p) => phaseStartEvents.push(p));

      await executor.executePhase(phase);

      expect(phaseStartEvents).toHaveLength(1);
      expect(phaseStartEvents[0]).toBe(phase);
    });

    it("should emit phase:complete event", async () => {
      const executor = new PhaseExecutor(createExecutorOptions());
      const phase = createMockPhase([MOCK_ITEM_1], true);
      const phaseCompleteEvents: Array<{ phase: ExecutionPhase; result: PhaseResult }> = [];
      executor.on("phase:complete", (p, r) =>
        phaseCompleteEvents.push({ phase: p, result: r })
      );

      await executor.executePhase(phase);

      expect(phaseCompleteEvents).toHaveLength(1);
      expect(phaseCompleteEvents[0]!.result.success).toBe(true);
    });

    it("should emit item:start events for each item", async () => {
      const executor = new PhaseExecutor(createExecutorOptions());
      const phase = createMockPhase([MOCK_ITEM_1, MOCK_ITEM_2], true);
      const itemStartEvents: ExecutionItem[] = [];
      executor.on("item:start", (item) => itemStartEvents.push(item));

      await executor.executePhase(phase);

      expect(itemStartEvents).toHaveLength(2);
    });

    it("should emit item:complete events for successful items", async () => {
      const executor = new PhaseExecutor(createExecutorOptions());
      const phase = createMockPhase([MOCK_ITEM_1], true);
      const itemCompleteEvents: Array<{ item: ExecutionItem; result: ItemResult }> = [];
      executor.on("item:complete", (item, result) =>
        itemCompleteEvents.push({ item, result })
      );

      await executor.executePhase(phase);

      expect(itemCompleteEvents).toHaveLength(1);
      expect(itemCompleteEvents[0]!.result.success).toBe(true);
    });

    it("should emit item:error events for failed items", async () => {
      const agentPool = createMockAgentPoolWithFailure("feature-1");
      const executor = new PhaseExecutor(createExecutorOptions({ agentPool }));
      const phase = createMockPhase([MOCK_ITEM_1], true);
      const itemErrorEvents: Array<{ item: ExecutionItem; error: Error }> = [];
      executor.on("item:error", (item, error) =>
        itemErrorEvents.push({ item, error })
      );

      await executor.executePhase(phase);

      expect(itemErrorEvents).toHaveLength(1);
      expect(itemErrorEvents[0]!.item.identifier).toBe("COM-1");
    });

    it("should record branch used in item results", async () => {
      const executor = new PhaseExecutor(createExecutorOptions());
      const phase = createMockPhase([MOCK_ITEM_1], true);

      const result = await executor.executePhase(phase);

      expect(result.itemResults[0]!.branch).toMatch(/feature\/COM-1/);
    });
  });

  describe("executePhase() - sequential execution", () => {
    it("should execute items sequentially when canRunInParallel is false", async () => {
      const agentPool = createMockAgentPool();
      const executor = new PhaseExecutor(createExecutorOptions({ agentPool }));
      const phase = createMockPhase([MOCK_ITEM_1, MOCK_ITEM_2], false);

      const result = await executor.executePhase(phase);

      expect(result.success).toBe(true);
      expect(result.completedItems).toHaveLength(2);
    });

    it("should use shared branch for sequential items", async () => {
      const branchManager = createMockBranchManager();
      const executor = new PhaseExecutor(
        createExecutorOptions({ branchManager })
      );
      const phase = createMockPhase([MOCK_ITEM_1, MOCK_ITEM_2], false);

      await executor.executePhase(phase);

      // Only one branch should be created for sequential execution
      expect(branchManager.createBranch).toHaveBeenCalledTimes(1);
    });

    it("should stop on first failure in sequential mode", async () => {
      const agentPool = createMockAgentPoolWithFailure("feature-1");
      const executor = new PhaseExecutor(createExecutorOptions({ agentPool }));
      const phase = createMockPhase([MOCK_ITEM_1, MOCK_ITEM_2], false);

      const result = await executor.executePhase(phase);

      expect(result.success).toBe(false);
      expect(result.failedItems).toContain("COM-1");
      // Second item should not have been executed
      expect(result.completedItems).not.toContain("COM-2");
      expect(result.itemResults).toHaveLength(1);
    });

    it("should clean up agent after each sequential item", async () => {
      const agentPool = createMockAgentPool();
      const executor = new PhaseExecutor(createExecutorOptions({ agentPool }));
      const phase = createMockPhase([MOCK_ITEM_1, MOCK_ITEM_2], false);

      await executor.executePhase(phase);

      expect(agentPool.removeAgent).toHaveBeenCalledTimes(2);
    });

    it("should execute single item sequentially even with canRunInParallel=true", async () => {
      const agentPool = createMockAgentPool();
      const executor = new PhaseExecutor(createExecutorOptions({ agentPool }));
      // Single item phase uses sequential path even if canRunInParallel=true
      const phase = createMockPhase([MOCK_ITEM_1], true);

      const result = await executor.executePhase(phase);

      expect(result.success).toBe(true);
      expect(result.completedItems).toHaveLength(1);
    });
  });

  describe("executePhase() - with different item types", () => {
    it("should handle task type items", async () => {
      const specTreeClient = createMockSpecTreeClient();
      const executor = new PhaseExecutor(
        createExecutorOptions({ specTreeClient })
      );
      const phase = createMockPhase([MOCK_ITEM_3], false);

      const result = await executor.executePhase(phase);

      expect(result.success).toBe(true);
      expect(specTreeClient.startWork).toHaveBeenCalledWith(
        "task",
        "task-1",
        undefined
      );
    });

    it("should include item type in results", async () => {
      const executor = new PhaseExecutor(createExecutorOptions());
      const phase = createMockPhase([MOCK_ITEM_1, MOCK_ITEM_3], true);

      const result = await executor.executePhase(phase);

      const featureResult = result.itemResults.find((r) => r.identifier === "COM-1");
      const taskResult = result.itemResults.find((r) => r.identifier === "COM-3");

      expect(featureResult?.type).toBe("feature");
      expect(taskResult?.type).toBe("task");
    });
  });

  describe("executePhase() - error handling", () => {
    it("should handle SpecTree startWork errors gracefully", async () => {
      const specTreeClient = createMockSpecTreeClient();
      (specTreeClient.startWork as Mock).mockRejectedValue(
        new Error("SpecTree unavailable")
      );
      const executor = new PhaseExecutor(
        createExecutorOptions({ specTreeClient })
      );
      const phase = createMockPhase([MOCK_ITEM_1], true);

      // Should not throw - SpecTree errors are logged but don't stop execution
      const result = await executor.executePhase(phase);

      expect(result.success).toBe(true);
    });

    it("should handle SpecTree completeWork errors gracefully", async () => {
      const specTreeClient = createMockSpecTreeClient();
      (specTreeClient.completeWork as Mock).mockRejectedValue(
        new Error("SpecTree unavailable")
      );
      const executor = new PhaseExecutor(
        createExecutorOptions({ specTreeClient })
      );
      const phase = createMockPhase([MOCK_ITEM_1], true);

      // Should not throw
      const result = await executor.executePhase(phase);

      expect(result.success).toBe(true);
    });

    it("should include duration in failed item results", async () => {
      const agentPool = createMockAgentPoolWithFailure("feature-1");
      const executor = new PhaseExecutor(createExecutorOptions({ agentPool }));
      const phase = createMockPhase([MOCK_ITEM_1], true);

      const result = await executor.executePhase(phase);

      expect(result.itemResults[0]!.duration).toBeGreaterThanOrEqual(0);
    });

    it("should track total phase duration", async () => {
      const executor = new PhaseExecutor(createExecutorOptions());
      const phase = createMockPhase([MOCK_ITEM_1], true);

      const result = await executor.executePhase(phase);

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe("utility methods", () => {
    it("setSessionId should update session ID", async () => {
      const specTreeClient = createMockSpecTreeClient();
      const executor = new PhaseExecutor(
        createExecutorOptions({ specTreeClient })
      );

      executor.setSessionId("new-session");
      const phase = createMockPhase([MOCK_ITEM_1], true);
      await executor.executePhase(phase);

      expect(specTreeClient.startWork).toHaveBeenCalledWith(
        "feature",
        "feature-1",
        { sessionId: "new-session" }
      );
    });

    it("setBaseBranch should update base branch", async () => {
      const branchManager = createMockBranchManager();
      const executor = new PhaseExecutor(
        createExecutorOptions({ branchManager })
      );

      executor.setBaseBranch("develop");
      const phase = createMockPhase([MOCK_ITEM_1], true);
      await executor.executePhase(phase);

      expect(branchManager.createBranch).toHaveBeenCalledWith(
        expect.any(String),
        "develop"
      );
    });
  });

  describe("prompt building", () => {
    it("should include item title in task prompt", async () => {
      const agentPool = createMockAgentPool();
      const executor = new PhaseExecutor(createExecutorOptions({ agentPool }));
      const phase = createMockPhase([MOCK_ITEM_1], true);

      await executor.executePhase(phase);

      expect(agentPool.startAgent).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("Implement User Auth")
      );
    });

    it("should include item identifier in task prompt", async () => {
      const agentPool = createMockAgentPool();
      const executor = new PhaseExecutor(createExecutorOptions({ agentPool }));
      const phase = createMockPhase([MOCK_ITEM_1], true);

      await executor.executePhase(phase);

      expect(agentPool.startAgent).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("COM-1")
      );
    });

    it("should include description in task prompt", async () => {
      const agentPool = createMockAgentPool();
      const executor = new PhaseExecutor(createExecutorOptions({ agentPool }));
      const phase = createMockPhase([MOCK_ITEM_1], true);

      await executor.executePhase(phase);

      expect(agentPool.startAgent).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("user authentication system")
      );
    });

    it("should include dependencies in task prompt when present", async () => {
      const agentPool = createMockAgentPool();
      const executor = new PhaseExecutor(createExecutorOptions({ agentPool }));
      const phase = createMockPhase([MOCK_ITEM_3], true);

      await executor.executePhase(phase);

      expect(agentPool.startAgent).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("Dependencies")
      );
    });

    it("should include complexity in task prompt when present", async () => {
      const agentPool = createMockAgentPool();
      const executor = new PhaseExecutor(createExecutorOptions({ agentPool }));
      const phase = createMockPhase([MOCK_ITEM_1], true);

      await executor.executePhase(phase);

      expect(agentPool.startAgent).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("moderate")
      );
    });
  });

  // ===========================================================================
  // ENG-70: Feature Completion Marking
  // ===========================================================================

  describe("feature completion marking (ENG-70)", () => {
    function createTaskLevelMockClient() {
      return {
        startWork: vi.fn().mockResolvedValue({}),
        completeWork: vi.fn().mockResolvedValue({}),
        logProgress: vi.fn().mockResolvedValue({}),
        linkBranch: vi.fn().mockResolvedValue(undefined),
        linkCodeFile: vi.fn().mockResolvedValue(undefined),
        updateFeature: vi.fn().mockResolvedValue({}),
        getFeature: vi.fn().mockResolvedValue({ id: "feature-1", tasks: [{ id: "t1" }], status: { name: "Done" } }),
        getTask: vi.fn().mockResolvedValue({ id: "t1", status: { name: "Done" } }),
        emitSessionEvent: vi.fn().mockResolvedValue(undefined),
        listTasks: vi.fn().mockResolvedValue({
          data: [
            {
              id: "task-a",
              identifier: "COM-1-1",
              title: "Task A",
              description: "Do A",
              statusId: null,
              executionOrder: 1,
              sortOrder: 1,
              canParallelize: false,
              parallelGroup: null,
              dependencies: null,
              estimatedComplexity: "simple",
            },
          ],
          meta: { cursor: null, hasMore: false },
        }),
      } as unknown as SpecTreeClient;
    }

    it("should mark feature as Done when all tasks succeed", async () => {
      const client = createTaskLevelMockClient();
      const branchManager = createMockBranchManager();
      (branchManager as any).getLatestCommitHash = vi.fn().mockResolvedValue("abc123");
      (branchManager as any).getModifiedFiles = vi.fn().mockResolvedValue([]);
      const agentPool = createMockAgentPool();
      const executor = new PhaseExecutor({
        agentPool,
        branchManager,
        specTreeClient: client,
        taskLevelAgents: true,
        sessionId: "test-session",
      });

      const feature: ExecutionItem = {
        ...MOCK_ITEM_1,
        epicId: "epic-1",
      };
      const phase = createMockPhase([feature], false);

      const result = await executor.executePhase(phase);

      expect(result.success).toBe(true);
      expect((client as any).updateFeature).toHaveBeenCalledWith(
        feature.id,
        { statusId: "52e901cb-0e67-4136-8f03-ba62d7daa891" }
      );
    });

    it("should NOT mark feature as Done when a task fails", async () => {
      const client = createTaskLevelMockClient();
      const branchManager = createMockBranchManager();
      (branchManager as any).getLatestCommitHash = vi.fn().mockResolvedValue("abc123");
      (branchManager as any).getModifiedFiles = vi.fn().mockResolvedValue([]);
      const agentPool = createMockAgentPool();
      // Make the agent fail
      (agentPool.startAgent as Mock).mockResolvedValue({
        agentId: "worker-1",
        taskId: "COM-1-1",
        success: false,
        error: new Error("Agent failed"),
        duration: 500,
      });
      const executor = new PhaseExecutor({
        agentPool,
        branchManager,
        specTreeClient: client,
        taskLevelAgents: true,
        sessionId: "test-session",
      });

      const feature: ExecutionItem = {
        ...MOCK_ITEM_1,
        epicId: "epic-1",
      };
      const phase = createMockPhase([feature], false);

      const result = await executor.executePhase(phase);

      expect(result.success).toBe(false);
      expect((client as any).updateFeature).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // ENG-73: Post-Feature Barney Trigger
  // ===========================================================================

  describe("post-feature Barney trigger (ENG-73)", () => {
    it("should spawn barney-dispatcher when hook is enabled and feature succeeds", async () => {
      // Mock child_process.spawn at module level via vi.spyOn
      const spawnMock = vi.fn().mockReturnValue({
        unref: vi.fn(),
        on: vi.fn(),
        pid: 12345,
      });
      // We can't easily mock spawn at module level in this test, so we verify
      // the console output indicates the hook was triggered
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const client = (() => {
        const c = {
          startWork: vi.fn().mockResolvedValue({}),
          completeWork: vi.fn().mockResolvedValue({}),
          logProgress: vi.fn().mockResolvedValue({}),
          linkBranch: vi.fn().mockResolvedValue(undefined),
          linkCodeFile: vi.fn().mockResolvedValue(undefined),
          updateFeature: vi.fn().mockResolvedValue({}),
          getFeature: vi.fn().mockResolvedValue({ id: "feature-1", tasks: [{ id: "t1" }], status: { name: "Done" } }),
          getTask: vi.fn().mockResolvedValue({ id: "t1", status: { name: "Done" } }),
          emitSessionEvent: vi.fn().mockResolvedValue(undefined),
          listTasks: vi.fn().mockResolvedValue({
            data: [{
              id: "task-a", identifier: "COM-1-1", title: "Task A", description: "Do A",
              statusId: null, executionOrder: 1, sortOrder: 1, canParallelize: false,
              parallelGroup: null, dependencies: null, estimatedComplexity: "simple",
            }],
            meta: { cursor: null, hasMore: false },
          }),
        };
        return c as unknown as SpecTreeClient;
      })();

      const branchManager = createMockBranchManager();
      (branchManager as any).getLatestCommitHash = vi.fn().mockResolvedValue("abc123");
      (branchManager as any).getModifiedFiles = vi.fn().mockResolvedValue([]);
      const agentPool = createMockAgentPool();
      const executor = new PhaseExecutor({
        agentPool,
        branchManager,
        specTreeClient: client,
        taskLevelAgents: true,
        sessionId: "test-session",
        postFeatureHooks: {
          barneyAudit: { enabled: true, scriptPath: "~/clawd/bin/barney-dispatcher.js" },
        },
      });

      const feature: ExecutionItem = { ...MOCK_ITEM_1, epicId: "epic-1" };
      const phase = createMockPhase([feature], false);

      const result = await executor.executePhase(phase);

      expect(result.success).toBe(true);
      // Verify the hook was triggered (console output logged)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Triggering Barney post-feature audit")
      );

      consoleSpy.mockRestore();
    });

    it("should NOT trigger hook when disabled", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const client = (() => {
        const c = {
          startWork: vi.fn().mockResolvedValue({}),
          completeWork: vi.fn().mockResolvedValue({}),
          logProgress: vi.fn().mockResolvedValue({}),
          linkBranch: vi.fn().mockResolvedValue(undefined),
          linkCodeFile: vi.fn().mockResolvedValue(undefined),
          updateFeature: vi.fn().mockResolvedValue({}),
          getFeature: vi.fn().mockResolvedValue({ id: "feature-1", tasks: [{ id: "t1" }], status: { name: "Done" } }),
          getTask: vi.fn().mockResolvedValue({ id: "t1", status: { name: "Done" } }),
          emitSessionEvent: vi.fn().mockResolvedValue(undefined),
          listTasks: vi.fn().mockResolvedValue({
            data: [{
              id: "task-a", identifier: "COM-1-1", title: "Task A", description: "Do A",
              statusId: null, executionOrder: 1, sortOrder: 1, canParallelize: false,
              parallelGroup: null, dependencies: null, estimatedComplexity: "simple",
            }],
            meta: { cursor: null, hasMore: false },
          }),
        };
        return c as unknown as SpecTreeClient;
      })();

      const branchManager = createMockBranchManager();
      (branchManager as any).getLatestCommitHash = vi.fn().mockResolvedValue("abc123");
      (branchManager as any).getModifiedFiles = vi.fn().mockResolvedValue([]);
      const agentPool = createMockAgentPool();
      const executor = new PhaseExecutor({
        agentPool,
        branchManager,
        specTreeClient: client,
        taskLevelAgents: true,
        sessionId: "test-session",
        postFeatureHooks: {
          barneyAudit: { enabled: false, scriptPath: "~/clawd/bin/barney-dispatcher.js" },
        },
      });

      const feature: ExecutionItem = { ...MOCK_ITEM_1, epicId: "epic-1" };
      const phase = createMockPhase([feature], false);

      await executor.executePhase(phase);

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Triggering Barney")
      );

      consoleSpy.mockRestore();
    });
  });
});
