/**
 * Unit tests for MCP Workflow tools
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";

interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

const { mockApiClient } = vi.hoisted(() => {
  const mockApiClient = {
    getActiveSession: vi.fn(),
    getFeature: vi.fn(),
    getTask: vi.fn(),
    listTasks: vi.fn(),
    getFeatureCodeContext: vi.fn(),
    getTaskCodeContext: vi.fn(),
    listValidations: vi.fn(),
    getStatus: vi.fn(),
  };
  return { mockApiClient };
});

vi.mock("../src/api-client.js", () => ({
  getApiClient: () => mockApiClient,
  ApiError: class ApiError extends Error {
    status: number;
    body: unknown;
    constructor(message: string, status: number, body?: unknown) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.body = body;
    }
  },
}));

const registeredTools = new Map<string, { config: unknown; handler: (input: unknown) => Promise<ToolResponse> }>();

import { registerWorkflowTools } from "../src/tools/workflow.js";

const mockServer = {
  registerTool: (name: string, config: unknown, handler: (input: unknown) => Promise<ToolResponse>) => {
    registeredTools.set(name, { config, handler });
  },
};

beforeAll(() => {
  registerWorkflowTools(mockServer as never);
});

describe("MCP Workflow Tools", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.resetAllMocks());

  describe("spectree__get_next_required_action", () => {
    const getHandler = () => registeredTools.get("spectree__get_next_required_action")?.handler;

    describe("session_start context", () => {
      it("should return start_session action when no active session exists", async () => {
        mockApiClient.getActiveSession.mockResolvedValue(null);

        const handler = getHandler();
        const result = await handler!({
          context: "session_start",
          epicId: "test-epic-id",
        });

        expect(result.isError).toBeUndefined();
        const data = JSON.parse(result.content[0]?.text || "{}");
        expect(data.allComplete).toBe(false);
        expect(data.toolToCall).toBe("spectree__start_session");
        expect(data.action).toContain("Start a session");
      });

      it("should return allComplete when session exists", async () => {
        mockApiClient.getActiveSession.mockResolvedValue({
          data: { id: "session-1", startedAt: new Date().toISOString() },
        });

        const handler = getHandler();
        const result = await handler!({
          context: "session_start",
          epicId: "test-epic-id",
        });

        expect(result.isError).toBeUndefined();
        const data = JSON.parse(result.content[0]?.text || "{}");
        expect(data.allComplete).toBe(true);
      });

      it("should require epicId for session_start context", async () => {
        const handler = getHandler();
        const result = await handler!({ context: "session_start" });

        expect(result.isError).toBe(true);
        expect(result.content[0]?.text).toContain("Epic ID is required");
      });
    });

    describe("feature_created context", () => {
      it("should return set_structured_description action when feature lacks description", async () => {
        mockApiClient.getFeature.mockResolvedValue({
          data: {
            id: "feat-1",
            identifier: "ENG-1",
            title: "Test Feature",
            executionOrder: null,
            estimatedComplexity: null,
            statusId: null,
          },
        });
        mockApiClient.listTasks.mockResolvedValue({ data: [] });
        mockApiClient.getFeatureCodeContext.mockRejectedValue(new Error("Not found"));

        const handler = getHandler();
        const result = await handler!({
          context: "feature_created",
          featureId: "ENG-1",
        });

        expect(result.isError).toBeUndefined();
        const data = JSON.parse(result.content[0]?.text || "{}");
        expect(data.allComplete).toBe(false);
        expect(data.toolToCall).toBe("spectree__set_structured_description");
        expect(data.action).toContain("structured description");
      });

      it("should return create_task action when feature has <3 tasks", async () => {
        mockApiClient.getFeature.mockResolvedValue({
          data: {
            id: "feat-1",
            identifier: "ENG-1",
            title: "Test Feature",
            executionOrder: 1,
            estimatedComplexity: "moderate",
            statusId: "status-1",
            structuredDesc: JSON.stringify({ summary: "Test summary" }),
          },
        });
        mockApiClient.listTasks.mockResolvedValue({
          data: [
            { id: "task-1", identifier: "ENG-1-1", title: "Task 1" },
            { id: "task-2", identifier: "ENG-1-2", title: "Task 2" },
          ],
        });
        mockApiClient.getFeatureCodeContext.mockRejectedValue(new Error("Not found"));
        mockApiClient.getStatus.mockResolvedValue({
          data: { id: "status-1", category: "backlog" },
        });

        const handler = getHandler();
        const result = await handler!({
          context: "feature_created",
          featureId: "ENG-1",
        });

        expect(result.isError).toBeUndefined();
        const data = JSON.parse(result.content[0]?.text || "{}");
        expect(data.allComplete).toBe(false);
        expect(data.toolToCall).toBe("spectree__create_task");
        expect(data.reason).toContain("minimum 3 required");
      });

      it("should return allComplete when feature has all requirements", async () => {
        mockApiClient.getFeature.mockResolvedValue({
          data: {
            id: "feat-1",
            identifier: "ENG-1",
            title: "Test Feature",
            executionOrder: 1,
            estimatedComplexity: "moderate",
            statusId: "status-1",
            structuredDesc: JSON.stringify({
              summary: "Test summary",
              acceptanceCriteria: ["Criterion 1"],
            }),
          },
        });
        mockApiClient.listTasks.mockResolvedValue({
          data: [
            { id: "task-1", identifier: "ENG-1-1", title: "Task 1" },
            { id: "task-2", identifier: "ENG-1-2", title: "Task 2" },
            { id: "task-3", identifier: "ENG-1-3", title: "Task 3" },
          ],
        });
        mockApiClient.getFeatureCodeContext.mockRejectedValue(new Error("Not found"));
        mockApiClient.getStatus.mockResolvedValue({
          data: { id: "status-1", category: "backlog" },
        });

        const handler = getHandler();
        const result = await handler!({
          context: "feature_created",
          featureId: "ENG-1",
        });

        expect(result.isError).toBeUndefined();
        const data = JSON.parse(result.content[0]?.text || "{}");
        expect(data.allComplete).toBe(true);
      });

      it("should require featureId for feature_created context", async () => {
        const handler = getHandler();
        const result = await handler!({ context: "feature_created" });

        expect(result.isError).toBe(true);
        expect(result.content[0]?.text).toContain("Feature ID is required");
      });
    });

    describe("task_created context", () => {
      it("should return set_structured_description action when task lacks description", async () => {
        mockApiClient.getTask.mockResolvedValue({
          data: {
            id: "task-1",
            identifier: "ENG-1-1",
            title: "Test Task",
            executionOrder: null,
            estimatedComplexity: null,
            statusId: null,
          },
        });
        mockApiClient.listValidations.mockResolvedValue({ data: { checks: [] } });
        mockApiClient.getTaskCodeContext.mockRejectedValue(new Error("Not found"));

        const handler = getHandler();
        const result = await handler!({
          context: "task_created",
          taskId: "ENG-1-1",
        });

        expect(result.isError).toBeUndefined();
        const data = JSON.parse(result.content[0]?.text || "{}");
        expect(data.allComplete).toBe(false);
        expect(data.toolToCall).toBe("spectree__set_structured_description");
      });

      it("should return allComplete when task has all requirements", async () => {
        mockApiClient.getTask.mockResolvedValue({
          data: {
            id: "task-1",
            identifier: "ENG-1-1",
            title: "Test Task",
            executionOrder: 1,
            estimatedComplexity: "simple",
            statusId: "status-1",
            structuredDesc: JSON.stringify({
              summary: "Test summary",
              acceptanceCriteria: ["Criterion 1"],
            }),
          },
        });
        mockApiClient.listValidations.mockResolvedValue({
          data: { checks: [{ id: "check-1" }] },
        });
        mockApiClient.getTaskCodeContext.mockRejectedValue(new Error("Not found"));
        mockApiClient.getStatus.mockResolvedValue({
          data: { id: "status-1", category: "backlog" },
        });

        const handler = getHandler();
        const result = await handler!({
          context: "task_created",
          taskId: "ENG-1-1",
        });

        expect(result.isError).toBeUndefined();
        const data = JSON.parse(result.content[0]?.text || "{}");
        expect(data.allComplete).toBe(true);
      });

      it("should require taskId for task_created context", async () => {
        const handler = getHandler();
        const result = await handler!({ context: "task_created" });

        expect(result.isError).toBe(true);
        expect(result.content[0]?.text).toContain("Task ID is required");
      });
    });

    describe("completing_task context", () => {
      it("should return run_all_validations when task has validations to run", async () => {
        mockApiClient.getTask.mockResolvedValue({
          data: {
            id: "task-1",
            identifier: "ENG-1-1",
            title: "Test Task",
            statusId: "status-1",
            structuredDesc: JSON.stringify({ summary: "Test" }),
          },
        });
        mockApiClient.listValidations.mockResolvedValue({
          data: { checks: [{ id: "check-1", status: "pending" }] },
        });
        mockApiClient.getTaskCodeContext.mockRejectedValue(new Error("Not found"));
        mockApiClient.getStatus.mockResolvedValue({
          data: { id: "status-1", category: "started" },
        });

        const handler = getHandler();
        const result = await handler!({
          context: "completing_task",
          taskId: "ENG-1-1",
        });

        expect(result.isError).toBeUndefined();
        const data = JSON.parse(result.content[0]?.text || "{}");
        expect(data.allComplete).toBe(false);
        // Should want to run validations
        expect(data.toolToCall).toBe("spectree__run_all_validations");
      });
    });
  });

  describe("spectree__get_workflow_stages", () => {
    const getHandler = () => registeredTools.get("spectree__get_workflow_stages")?.handler;

    it("should return all stages when no filter specified", async () => {
      const handler = getHandler();
      const result = await handler!({});

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.totalStages).toBeGreaterThan(0);
      expect(data.stages).toBeInstanceOf(Array);
      expect(data.stages[0]).toHaveProperty("id");
      expect(data.stages[0]).toHaveProperty("description");
    });

    it("should return all stages when stage is 'all'", async () => {
      const handler = getHandler();
      const result = await handler!({ stage: "all" });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.totalStages).toBeGreaterThan(0);
    });

    it("should return details for a specific stage", async () => {
      const handler = getHandler();
      const result = await handler!({ stage: "session_start" });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.id).toBe("session_start");
      expect(data.requirements).toBeInstanceOf(Array);
      expect(data.requirements[0]).toHaveProperty("check");
      expect(data.requirements[0]).toHaveProperty("tool");
    });

    it("should return details for feature_created stage", async () => {
      const handler = getHandler();
      const result = await handler!({ stage: "feature_created" });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.id).toBe("feature_created");
      expect(data.requirements.length).toBeGreaterThan(0);
      // Verify expected requirements
      const checks = data.requirements.map((r: { check: string }) => r.check);
      expect(checks).toContain("hasStructuredDescription");
      expect(checks).toContain("hasMinimumTasks");
    });
  });
});

describe("Workflow Stages", () => {
  it("should export valid workflow contexts", async () => {
    const { WORKFLOW_STAGES, getWorkflowStage, getRequirements } = await import(
      "../src/tools/workflowStages.js"
    );

    expect(WORKFLOW_STAGES).toBeDefined();
    expect(Object.keys(WORKFLOW_STAGES).length).toBeGreaterThan(0);

    // All stages should have required properties
    for (const [key, stage] of Object.entries(WORKFLOW_STAGES)) {
      expect(stage).toHaveProperty("id", key);
      expect(stage).toHaveProperty("description");
      expect(stage).toHaveProperty("requirements");
      expect(stage).toHaveProperty("completionCriteria");
      expect(Array.isArray((stage as { requirements: unknown[] }).requirements)).toBe(true);
    }
  });

  it("should return requirements sorted by priority", async () => {
    const { getRequirements } = await import("../src/tools/workflowStages.js");

    const requirements = getRequirements("feature_created");

    for (let i = 1; i < requirements.length; i++) {
      const prev = requirements[i - 1]!;
      const curr = requirements[i]!;
      expect(prev.priority).toBeLessThanOrEqual(curr.priority);
    }
  });
});
