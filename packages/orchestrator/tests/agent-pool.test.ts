/**
 * Unit tests for Agent Pool
 *
 * Tests verify:
 * - Agent spawning with pool capacity limits
 * - Agent lifecycle (spawn, start, complete, terminate)
 * - Event emissions for state changes
 * - Waiting methods (waitForAgent, waitForAll, waitForAny)
 * - Error isolation (failed agents don't crash pool)
 * - Pool status reporting
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import {
  AgentPool,
  createAgentPool,
  type Agent,
  type AgentResult,
  type AgentPoolOptions,
} from "../src/orchestrator/agent-pool.js";
import type { SpecTreeClient, ExecutionItem } from "../src/spectree/api-client.js";
import { ClaudeCodeSessionManager, ClaudeCodeSession } from "../src/claude/index.js";
import { OrchestratorError } from "../src/errors.js";

// Mock the config module
vi.mock("../src/config/index.js", () => ({
  getApiUrl: () => "http://localhost:3001",
  getCopilotModel: () => "gpt-4.1",
}));

// =============================================================================
// Test Fixtures
// =============================================================================

const MOCK_TASK: ExecutionItem = {
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

const MOCK_TASK_2: ExecutionItem = {
  type: "feature",
  id: "feature-2",
  identifier: "COM-2",
  title: "Implement API",
  description: "Create REST API endpoints",
  statusId: null,
  executionOrder: 2,
  canParallelize: true,
  parallelGroup: "api",
  dependencies: ["feature-1"],
  estimatedComplexity: "complex",
};

// =============================================================================
// Mock Factories
// =============================================================================

function createMockSpecTreeClient(): SpecTreeClient {
  return {
    logProgress: vi.fn().mockResolvedValue({
      id: "feature-1",
      identifier: "COM-1",
      status: "In Progress",
      percentComplete: 50,
    }),
  } as unknown as SpecTreeClient;
}

/**
 * Creates a mock ClaudeCodeSession that behaves as an EventEmitter.
 * When send() is called, it schedules 'complete' (or 'error') events asynchronously.
 */
function createMockClaudeCodeSession(responseContent = "Task completed successfully", errorMessage?: string): ClaudeCodeSession {
  const session = new EventEmitter() as ClaudeCodeSession;

  // Add mock methods
  (session as unknown as Record<string, unknown>).send = vi.fn().mockImplementation(() => {
    setTimeout(() => {
      if (responseContent) {
        (session as EventEmitter).emit("text", responseContent);
      }
      if (errorMessage) {
        (session as EventEmitter).emit("error", new Error(errorMessage));
      } else {
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

function createMockSessionManager(responseContent = "Task completed successfully", errorMessage?: string): ClaudeCodeSessionManager {
  return {
    createSession: vi.fn().mockImplementation(() => {
      return Promise.resolve(createMockClaudeCodeSession(responseContent, errorMessage));
    }),
    getSession: vi.fn(),
    destroySession: vi.fn().mockResolvedValue(undefined),
    destroyAll: vi.fn().mockResolvedValue(undefined),
    activeSessions: 0,
  } as unknown as ClaudeCodeSessionManager;
}

function createPoolOptions(overrides?: Partial<AgentPoolOptions>): AgentPoolOptions {
  return {
    maxAgents: 4,
    sessionManager: createMockSessionManager(),
    specTreeClient: createMockSpecTreeClient(),
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("AgentPool", () => {
  let pool: AgentPool;
  let mockSessionManager: ClaudeCodeSessionManager;

  beforeEach(() => {
    mockSessionManager = createMockSessionManager();
    pool = new AgentPool(createPoolOptions({ sessionManager: mockSessionManager }));
  });

  describe("constructor", () => {
    it("should extend EventEmitter", () => {
      expect(pool).toBeInstanceOf(EventEmitter);
    });

    it("should initialize with zero active agents", () => {
      const status = pool.getStatus();
      expect(status.activeCount).toBe(0);
    });

    it("should use provided maxAgents", () => {
      const customPool = new AgentPool(createPoolOptions({ maxAgents: 8 }));
      const status = customPool.getStatus();
      expect(status.maxAgents).toBe(8);
    });
  });

  describe("spawnAgent()", () => {
    it("should create a new agent for a task", async () => {
      const agent = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      expect(agent).toBeDefined();
      expect(agent.id).toMatch(/^worker-\d+$/);
      expect(agent.taskId).toBe("COM-1");
      expect(agent.branch).toBe("feature/COM-1");
      expect(agent.status).toBe("idle");
      expect(agent.progress).toBe(0);
    });

    it("should create Claude Code session via session manager", async () => {
      await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      expect(mockSessionManager.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          systemMessage: expect.stringContaining("parallel execution team"),
        })
      );
    });

    it("should emit agent:spawn event", async () => {
      const spawnEvents: Agent[] = [];
      pool.on("agent:spawn", (agent) => spawnEvents.push(agent));
      await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      expect(spawnEvents).toHaveLength(1);
      expect(spawnEvents[0].taskId).toBe("COM-1");
    });

    it("should include task details in agent prompt", async () => {
      await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      expect(mockSessionManager.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          systemMessage: expect.stringContaining("COM-1"),
        })
      );
    });

    it("should increment agent ID for each spawn", async () => {
      const agent1 = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      const agent2 = await pool.spawnAgent(MOCK_TASK_2, "feature/COM-2");
      expect(agent1.id).toBe("worker-1");
      expect(agent2.id).toBe("worker-2");
    });

    it("should throw when pool is at capacity", async () => {
      const smallPool = new AgentPool(createPoolOptions({ maxAgents: 1 }));
      await smallPool.spawnAgent(MOCK_TASK, "feature/COM-1");
      await expect(smallPool.spawnAgent(MOCK_TASK_2, "feature/COM-2")).rejects.toThrow(OrchestratorError);
    });

    it("should emit pool:full when at capacity", async () => {
      const smallPool = new AgentPool(createPoolOptions({ maxAgents: 1 }));
      let fullEmitted = false;
      smallPool.on("pool:full", () => (fullEmitted = true));
      await smallPool.spawnAgent(MOCK_TASK, "feature/COM-1");
      try { await smallPool.spawnAgent(MOCK_TASK_2, "feature/COM-2"); } catch { /* Expected */ }
      expect(fullEmitted).toBe(true);
    });

    it("should store execution item in agent", async () => {
      const agent = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      expect(agent.item).toBe(MOCK_TASK);
    });
  });

  describe("startAgent()", () => {
    it("should send prompt to agent session", async () => {
      const agent = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      await pool.startAgent(agent.id, "Implement the auth system");
      expect(agent.session.send).toHaveBeenCalledWith("Implement the auth system");
    });

    it("should update agent status to working", async () => {
      const agent = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      const startPromise = pool.startAgent(agent.id, "Start work");
      expect(agent.status).toBe("working");
      await startPromise;
    });

    it("should emit agent:start event", async () => {
      const startEvents: Agent[] = [];
      pool.on("agent:start", (agent) => startEvents.push(agent));
      const agent = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      await pool.startAgent(agent.id, "Start work");
      expect(startEvents).toHaveLength(1);
      expect(startEvents[0].id).toBe(agent.id);
    });

    it("should return success result on completion", async () => {
      const agent = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      const result = await pool.startAgent(agent.id, "Do the work");
      expect(result.success).toBe(true);
      expect(result.agentId).toBe(agent.id);
      expect(result.taskId).toBe("COM-1");
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should emit agent:complete on success", async () => {
      const completeEvents: { agent: Agent; result: AgentResult }[] = [];
      pool.on("agent:complete", (agent, result) => completeEvents.push({ agent, result }));
      const agent = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      await pool.startAgent(agent.id, "Do the work");
      expect(completeEvents).toHaveLength(1);
      expect(completeEvents[0].result.success).toBe(true);
    });

    it("should update agent status to completed", async () => {
      const agent = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      await pool.startAgent(agent.id, "Do the work");
      expect(agent.status).toBe("completed");
      expect(agent.progress).toBe(100);
      expect(agent.completedAt).toBeDefined();
    });

    it("should handle agent failure", async () => {
      const failingManager = createMockSessionManager("", "Agent execution failed");
      const failPool = new AgentPool(createPoolOptions({ sessionManager: failingManager }));
      const agent = await failPool.spawnAgent(MOCK_TASK, "feature/COM-1");
      const result = await failPool.startAgent(agent.id, "Do the work");
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(agent.status).toBe("failed");
    });

    it("should emit agent:error on failure", async () => {
      const failingManager = createMockSessionManager("", "Agent execution failed");
      const failPool = new AgentPool(createPoolOptions({ sessionManager: failingManager }));
      const errorEvents: { agent: Agent; error: Error }[] = [];
      failPool.on("agent:error", (agent, error) => errorEvents.push({ agent, error }));
      const agent = await failPool.spawnAgent(MOCK_TASK, "feature/COM-1");
      await failPool.startAgent(agent.id, "Do the work");
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].error).toBeDefined();
    });

    it("should throw for non-existent agent", async () => {
      await expect(pool.startAgent("invalid-id", "prompt")).rejects.toThrow(OrchestratorError);
    });

    it("should extract summary from response", async () => {
      const customManager = createMockSessionManager("Implemented user authentication with OAuth");
      const customPool = new AgentPool(createPoolOptions({ sessionManager: customManager }));
      const agent = await customPool.spawnAgent(MOCK_TASK, "feature/COM-1");
      const result = await customPool.startAgent(agent.id, "Do the work");
      expect(result.summary).toBe("Implemented user authentication with OAuth");
    });
  });

  describe("getAgent()", () => {
    it("should return agent by ID", async () => {
      const spawned = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      expect(pool.getAgent(spawned.id)).toBe(spawned);
    });

    it("should return undefined for unknown ID", () => {
      expect(pool.getAgent("unknown")).toBeUndefined();
    });
  });

  describe("getActiveAgents()", () => {
    it("should return all active agents", async () => {
      await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      await pool.spawnAgent(MOCK_TASK_2, "feature/COM-2");
      expect(pool.getActiveAgents()).toHaveLength(2);
    });

    it("should return empty array when no agents", () => {
      expect(pool.getActiveAgents()).toHaveLength(0);
    });
  });

  describe("getAgentsByStatus()", () => {
    it("should filter agents by status", async () => {
      const agent1 = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      await pool.spawnAgent(MOCK_TASK_2, "feature/COM-2");
      const startPromise = pool.startAgent(agent1.id, "Work");
      expect(pool.getAgentsByStatus("idle")).toHaveLength(1);
      expect(pool.getAgentsByStatus("working")).toHaveLength(1);
      await startPromise;
    });
  });

  describe("waitForAgent()", () => {
    it("should resolve when agent completes", async () => {
      const agent = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      pool.startAgent(agent.id, "Do work");
      const result = await pool.waitForAgent(agent.id);
      expect(result.success).toBe(true);
      expect(result.agentId).toBe(agent.id);
    });

    it("should resolve with failure when agent fails", async () => {
      const failingManager = createMockSessionManager("", "Agent execution failed");
      const failPool = new AgentPool(createPoolOptions({ sessionManager: failingManager }));
      const agent = await failPool.spawnAgent(MOCK_TASK, "feature/COM-1");
      failPool.startAgent(agent.id, "Do work");
      const result = await failPool.waitForAgent(agent.id);
      expect(result.success).toBe(false);
    });

    it("should throw for unknown agent", async () => {
      await expect(pool.waitForAgent("unknown")).rejects.toThrow(OrchestratorError);
    });
  });

  describe("waitForAll()", () => {
    it("should resolve when all agents complete", async () => {
      const agent1 = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      const agent2 = await pool.spawnAgent(MOCK_TASK_2, "feature/COM-2");
      pool.startAgent(agent1.id, "Work 1");
      pool.startAgent(agent2.id, "Work 2");
      const results = await pool.waitForAll();
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it("should return empty array when no agents", async () => {
      expect(await pool.waitForAll()).toHaveLength(0);
    });

    it("should include failed agents in results", async () => {
      const failingManager = createMockSessionManager("", "Agent execution failed");
      const mixedPool = new AgentPool(createPoolOptions({ sessionManager: failingManager }));
      const agent1 = await mixedPool.spawnAgent(MOCK_TASK, "feature/COM-1");
      mixedPool.startAgent(agent1.id, "Work");
      const results = await mixedPool.waitForAll();
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
    });
  });

  describe("waitForAny()", () => {
    it("should resolve when first agent completes", async () => {
      const agent1 = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      await pool.spawnAgent(MOCK_TASK_2, "feature/COM-2");
      pool.startAgent(agent1.id, "Work 1");
      const result = await pool.waitForAny();
      expect(result).toBeDefined();
      expect(result.agentId).toBe(agent1.id);
    });

    it("should throw when no agents", async () => {
      await expect(pool.waitForAny()).rejects.toThrow(OrchestratorError);
    });
  });

  describe("terminateAgent()", () => {
    it("should destroy agent session", async () => {
      const agent = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      await pool.terminateAgent(agent.id);
      expect(agent.session.destroy).toHaveBeenCalled();
    });

    it("should remove agent from active agents", async () => {
      const agent = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      await pool.terminateAgent(agent.id);
      expect(pool.getAgent(agent.id)).toBeUndefined();
    });

    it("should resolve waiting promise with failure", async () => {
      const agent = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      const waitPromise = pool.waitForAgent(agent.id);
      await pool.terminateAgent(agent.id);
      const result = await waitPromise;
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should do nothing for unknown agent", async () => {
      await expect(pool.terminateAgent("unknown")).resolves.toBeUndefined();
    });
  });

  describe("terminateAll()", () => {
    it("should terminate all agents", async () => {
      await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      await pool.spawnAgent(MOCK_TASK_2, "feature/COM-2");
      await pool.terminateAll();
      expect(pool.getActiveAgents()).toHaveLength(0);
    });
  });

  describe("removeAgent()", () => {
    it("should remove completed agent", async () => {
      const agent = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      await pool.startAgent(agent.id, "Do work");
      pool.removeAgent(agent.id);
      expect(pool.getAgent(agent.id)).toBeUndefined();
    });

    it("should not remove working agent", async () => {
      const agent = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      pool.removeAgent(agent.id);
      expect(pool.getAgent(agent.id)).toBeDefined();
    });
  });

  describe("updateProgress()", () => {
    it("should update agent progress", async () => {
      const agent = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      pool.updateProgress(agent.id, 50);
      expect(agent.progress).toBe(50);
    });

    it("should emit agent:progress event", async () => {
      const progressEvents: { agent: Agent; progress: number; message?: string }[] = [];
      pool.on("agent:progress", (agent, progress, message) => progressEvents.push({ agent, progress, message }));
      const agent = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      pool.updateProgress(agent.id, 75, "Almost done");
      expect(progressEvents).toHaveLength(1);
      expect(progressEvents[0].progress).toBe(75);
      expect(progressEvents[0].message).toBe("Almost done");
    });

    it("should clamp progress to 0-100", async () => {
      const agent = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      pool.updateProgress(agent.id, 150);
      expect(agent.progress).toBe(100);
      pool.updateProgress(agent.id, -10);
      expect(agent.progress).toBe(0);
    });

    it("should do nothing for unknown agent", () => {
      pool.updateProgress("unknown", 50);
    });
  });

  describe("getStatus()", () => {
    it("should return pool status", () => {
      const status = pool.getStatus();
      expect(status.maxAgents).toBe(4);
      expect(status.activeCount).toBe(0);
      expect(status.idleCount).toBe(0);
      expect(status.workingCount).toBe(0);
      expect(status.completedCount).toBe(0);
      expect(status.failedCount).toBe(0);
      expect(status.atCapacity).toBe(false);
    });

    it("should track idle agents", async () => {
      await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      const status = pool.getStatus();
      expect(status.idleCount).toBe(1);
      expect(status.activeCount).toBe(1);
    });

    it("should track working agents", async () => {
      const agent = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      const startPromise = pool.startAgent(agent.id, "Work");
      expect(pool.getStatus().workingCount).toBe(1);
      await startPromise;
    });

    it("should track completed count", async () => {
      const agent = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      await pool.startAgent(agent.id, "Work");
      expect(pool.getStatus().completedCount).toBe(1);
    });

    it("should track failed count", async () => {
      const failingManager = createMockSessionManager("", "Agent execution failed");
      const failPool = new AgentPool(createPoolOptions({ sessionManager: failingManager }));
      const agent = await failPool.spawnAgent(MOCK_TASK, "feature/COM-1");
      await failPool.startAgent(agent.id, "Work");
      expect(failPool.getStatus().failedCount).toBe(1);
    });

    it("should report atCapacity correctly", async () => {
      const smallPool = new AgentPool(createPoolOptions({ maxAgents: 1 }));
      await smallPool.spawnAgent(MOCK_TASK, "feature/COM-1");
      expect(smallPool.getStatus().atCapacity).toBe(true);
    });
  });

  describe("hasCapacity()", () => {
    it("should return true when pool has space", async () => {
      await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      expect(pool.hasCapacity()).toBe(true);
    });

    it("should return false when pool is full", async () => {
      const smallPool = new AgentPool(createPoolOptions({ maxAgents: 1 }));
      await smallPool.spawnAgent(MOCK_TASK, "feature/COM-1");
      expect(smallPool.hasCapacity()).toBe(false);
    });
  });

  describe("getAvailableSlots()", () => {
    it("should return correct number of available slots", async () => {
      expect(pool.getAvailableSlots()).toBe(4);
      await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      expect(pool.getAvailableSlots()).toBe(3);
      await pool.spawnAgent(MOCK_TASK_2, "feature/COM-2");
      expect(pool.getAvailableSlots()).toBe(2);
    });
  });

  describe("pool:empty event", () => {
    it("should emit when all agents complete", async () => {
      let emptyEmitted = false;
      pool.on("pool:empty", () => (emptyEmitted = true));
      const agent = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      await pool.startAgent(agent.id, "Work");
      expect(emptyEmitted).toBe(true);
    });

    it("should emit when agent is terminated", async () => {
      let emptyEmitted = false;
      pool.on("pool:empty", () => (emptyEmitted = true));
      const agent = await pool.spawnAgent(MOCK_TASK, "feature/COM-1");
      await pool.terminateAgent(agent.id);
      expect(emptyEmitted).toBe(true);
    });
  });

  describe("error isolation", () => {
    it("should not affect other agents when one fails", async () => {
      let callCount = 0;
      const mixedManager = {
        createSession: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve(createMockClaudeCodeSession("", "Agent 1 failed"));
          }
          return Promise.resolve(createMockClaudeCodeSession("Done"));
        }),
      } as unknown as ClaudeCodeSessionManager;

      const mixedPool = new AgentPool(createPoolOptions({ sessionManager: mixedManager }));
      const agent1 = await mixedPool.spawnAgent(MOCK_TASK, "feature/COM-1");
      const agent2 = await mixedPool.spawnAgent(MOCK_TASK_2, "feature/COM-2");
      const results = await Promise.all([
        mixedPool.startAgent(agent1.id, "Work 1"),
        mixedPool.startAgent(agent2.id, "Work 2"),
      ]);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
    });
  });
});

describe("createAgentPool", () => {
  it("should create an AgentPool instance", () => {
    const pool = createAgentPool(createPoolOptions());
    expect(pool).toBeInstanceOf(AgentPool);
  });
});
