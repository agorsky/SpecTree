/**
 * Integration tests for MCP Composite tools
 *
 * Tests for spectree__create_epic_complete and spectree__complete_task_with_validation
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";

interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

const { mockApiClient } = vi.hoisted(() => {
  const mockApiClient = {
    createEpicComplete: vi.fn(),
    getTask: vi.fn(),
    runAllValidations: vi.fn(),
    completeTaskWork: vi.fn(),
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

import { registerCompositeTools } from "../src/tools/composite.js";

const mockServer = {
  registerTool: (name: string, config: unknown, handler: (input: unknown) => Promise<ToolResponse>) => {
    registeredTools.set(name, { config, handler });
  },
};

beforeAll(() => {
  registerCompositeTools(mockServer as any);
});

describe("MCP Composite Tools", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.resetAllMocks());

  // ===========================================================================
  // spectree__create_epic_complete tests
  // ===========================================================================
  describe("spectree__create_epic_complete", () => {
    const getHandler = () => registeredTools.get("spectree__create_epic_complete")?.handler;

    it("should create an epic with features and tasks atomically", async () => {
      const mockResponse = {
        epic: {
          id: "epic-123",
          name: "Test Epic",
          description: "Test description",
          teamId: "team-abc",
        },
        features: [
          {
            id: "feat-1",
            identifier: "ENG-1",
            title: "Feature One",
            executionOrder: 1,
            estimatedComplexity: "moderate",
            canParallelize: false,
            parallelGroup: null,
            dependencies: null,
            statusId: "status-backlog",
            tasks: [
              {
                id: "task-1",
                identifier: "ENG-1-1",
                title: "Task One",
                executionOrder: 1,
                estimatedComplexity: "simple",
                statusId: "status-backlog",
              },
            ],
          },
        ],
        summary: {
          totalFeatures: 1,
          totalTasks: 1,
        },
      };

      mockApiClient.createEpicComplete.mockResolvedValue({ data: mockResponse });

      const handler = getHandler();
      const result = await handler!({
        name: "Test Epic",
        team: "Engineering",
        description: "Test description",
        features: [
          {
            title: "Feature One",
            executionOrder: 1,
            estimatedComplexity: "moderate",
            tasks: [
              {
                title: "Task One",
                executionOrder: 1,
                estimatedComplexity: "simple",
              },
            ],
          },
        ],
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.message).toContain("Successfully created epic");
      expect(data.epic.id).toBe("epic-123");
      expect(data.features).toHaveLength(1);
      expect(data.features[0].identifier).toBe("ENG-1");
      expect(data.features[0].tasks[0].identifier).toBe("ENG-1-1");
      expect(data.summary.totalFeatures).toBe(1);
      expect(data.summary.totalTasks).toBe(1);
    });

    it("should handle multiple features with dependencies", async () => {
      const mockResponse = {
        epic: {
          id: "epic-456",
          name: "Multi-Feature Epic",
          description: null,
          teamId: "team-abc",
        },
        features: [
          {
            id: "feat-1",
            identifier: "ENG-10",
            title: "Database Schema",
            executionOrder: 1,
            estimatedComplexity: "moderate",
            canParallelize: false,
            parallelGroup: null,
            dependencies: null,
            statusId: "status-backlog",
            tasks: [{ id: "task-1", identifier: "ENG-10-1", title: "Create tables", executionOrder: 1, estimatedComplexity: "simple", statusId: "s1" }],
          },
          {
            id: "feat-2",
            identifier: "ENG-11",
            title: "API Endpoints",
            executionOrder: 2,
            estimatedComplexity: "complex",
            canParallelize: false,
            parallelGroup: null,
            dependencies: JSON.stringify(["feat-1"]),
            statusId: "status-backlog",
            tasks: [{ id: "task-2", identifier: "ENG-11-1", title: "Create routes", executionOrder: 1, estimatedComplexity: "moderate", statusId: "s1" }],
          },
        ],
        summary: {
          totalFeatures: 2,
          totalTasks: 2,
        },
      };

      mockApiClient.createEpicComplete.mockResolvedValue({ data: mockResponse });

      const handler = getHandler();
      const result = await handler!({
        name: "Multi-Feature Epic",
        team: "Engineering",
        features: [
          {
            title: "Database Schema",
            executionOrder: 1,
            estimatedComplexity: "moderate",
            tasks: [{ title: "Create tables" }],
          },
          {
            title: "API Endpoints",
            executionOrder: 2,
            estimatedComplexity: "complex",
            dependencies: [0], // Depends on first feature (index 0)
            tasks: [{ title: "Create routes" }],
          },
        ],
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.summary.totalFeatures).toBe(2);
      expect(mockApiClient.createEpicComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Multi-Feature Epic",
          team: "Engineering",
          features: expect.arrayContaining([
            expect.objectContaining({
              title: "Database Schema",
              executionOrder: 1,
            }),
            expect.objectContaining({
              title: "API Endpoints",
              dependencies: [0],
            }),
          ]),
        })
      );
    });

    it("should include structured descriptions when provided", async () => {
      const mockResponse = {
        epic: { id: "epic-789", name: "Test", description: null, teamId: "team-abc" },
        features: [
          {
            id: "feat-1",
            identifier: "ENG-1",
            title: "Feature",
            executionOrder: 1,
            estimatedComplexity: "simple",
            canParallelize: false,
            parallelGroup: null,
            dependencies: null,
            statusId: "s1",
            tasks: [{ id: "t1", identifier: "ENG-1-1", title: "Task", executionOrder: 1, estimatedComplexity: "trivial", statusId: "s1" }],
          },
        ],
        summary: { totalFeatures: 1, totalTasks: 1 },
      };

      mockApiClient.createEpicComplete.mockResolvedValue({ data: mockResponse });

      const handler = getHandler();
      await handler!({
        name: "Test",
        team: "ENG",
        features: [
          {
            title: "Feature",
            executionOrder: 1,
            estimatedComplexity: "simple",
            structuredDesc: {
              summary: "Implement the feature",
              aiInstructions: "Follow TDD approach",
              acceptanceCriteria: ["All tests pass", "Code reviewed"],
              riskLevel: "low",
            },
            tasks: [
              {
                title: "Task",
                structuredDesc: {
                  summary: "Complete the task",
                  filesInvolved: ["src/feature.ts"],
                },
              },
            ],
          },
        ],
      });

      expect(mockApiClient.createEpicComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          features: expect.arrayContaining([
            expect.objectContaining({
              structuredDesc: expect.objectContaining({
                summary: "Implement the feature",
                aiInstructions: "Follow TDD approach",
                acceptanceCriteria: expect.arrayContaining(["All tests pass"]),
              }),
              tasks: expect.arrayContaining([
                expect.objectContaining({
                  structuredDesc: expect.objectContaining({
                    summary: "Complete the task",
                    filesInvolved: ["src/feature.ts"],
                  }),
                }),
              ]),
            }),
          ]),
        })
      );
    });

    it("should return error when team not found", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.createEpicComplete.mockRejectedValue(new ApiError("Not found", 404));

      const handler = getHandler();
      const result = await handler!({
        name: "Test",
        team: "NonExistentTeam",
        features: [
          { title: "Feature", executionOrder: 1, estimatedComplexity: "simple", tasks: [{ title: "Task" }] },
        ],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("Team 'NonExistentTeam' not found");
    });

    it("should handle validation errors", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.createEpicComplete.mockRejectedValue(
        new ApiError("Bad request", 400, { error: "Feature at index 1 has invalid dependency" })
      );

      const handler = getHandler();
      const result = await handler!({
        name: "Test",
        team: "ENG",
        features: [
          { title: "Feature", executionOrder: 1, estimatedComplexity: "simple", tasks: [{ title: "Task" }] },
        ],
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("Validation error");
    });
  });

  // ===========================================================================
  // spectree__complete_task_with_validation tests
  // ===========================================================================
  describe("spectree__complete_task_with_validation", () => {
    const getHandler = () => registeredTools.get("spectree__complete_task_with_validation")?.handler;

    const mockTask = {
      id: "task-123",
      identifier: "ENG-1-1",
      title: "Test Task",
      featureId: "feat-1",
    };

    it("should complete task when all validations pass", async () => {
      mockApiClient.getTask.mockResolvedValue({ data: mockTask });
      mockApiClient.runAllValidations.mockResolvedValue({
        data: {
          taskId: "task-123",
          identifier: "ENG-1-1",
          totalChecks: 2,
          passed: 2,
          failed: 0,
          pending: 0,
          allPassed: true,
          results: [
            { id: "check-1", description: "Build passes", type: "command", status: "passed", passed: true },
            { id: "check-2", description: "Tests pass", type: "test_passes", status: "passed", passed: true },
          ],
        },
      });
      mockApiClient.completeTaskWork.mockResolvedValue({
        data: {
          completedAt: "2024-01-15T10:00:00Z",
          durationMinutes: 45,
        },
      });

      const handler = getHandler();
      const result = await handler!({
        taskId: "ENG-1-1",
        summary: "Implemented the feature successfully",
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.completed).toBe(true);
      expect(data.message).toContain("completed");
      expect(data.message).toContain("All 2 validations passed");
      expect(data.task.status).toBe("Done");
      expect(mockApiClient.completeTaskWork).toHaveBeenCalledWith("task-123", {
        summary: "Implemented the feature successfully",
      });
    });

    it("should NOT complete task when validations fail", async () => {
      mockApiClient.getTask.mockResolvedValue({ data: mockTask });
      mockApiClient.runAllValidations.mockResolvedValue({
        data: {
          taskId: "task-123",
          identifier: "ENG-1-1",
          totalChecks: 2,
          passed: 1,
          failed: 1,
          pending: 0,
          allPassed: false,
          results: [
            { id: "check-1", description: "Build passes", type: "command", status: "passed", passed: true },
            { id: "check-2", description: "Tests pass", type: "test_passes", status: "failed", passed: false, error: "2 tests failed" },
          ],
        },
      });

      const handler = getHandler();
      const result = await handler!({
        taskId: "ENG-1-1",
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.completed).toBe(false);
      expect(data.message).toContain("NOT completed");
      expect(data.message).toContain("1 of 2 validations failed");
      expect(data.failedValidations).toHaveLength(1);
      expect(data.failedValidations[0].description).toBe("Tests pass");
      expect(data.task.status).toBe("In Progress");
      expect(mockApiClient.completeTaskWork).not.toHaveBeenCalled();
    });

    it("should complete task when no validations are defined", async () => {
      mockApiClient.getTask.mockResolvedValue({ data: mockTask });
      mockApiClient.runAllValidations.mockResolvedValue({
        data: {
          taskId: "task-123",
          identifier: "ENG-1-1",
          totalChecks: 0,
          passed: 0,
          failed: 0,
          pending: 0,
          allPassed: true,
          results: [],
        },
      });
      mockApiClient.completeTaskWork.mockResolvedValue({
        data: { completedAt: "2024-01-15T10:00:00Z", durationMinutes: 30 },
      });

      const handler = getHandler();
      const result = await handler!({
        taskId: "ENG-1-1",
        summary: "No validations needed",
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.validationsRun).toBe(false);
      expect(data.message).toContain("no validations defined");
      expect(data.task.status).toBe("Done");
      expect(mockApiClient.completeTaskWork).toHaveBeenCalled();
    });

    it("should skip validations when skipValidations is true", async () => {
      mockApiClient.getTask.mockResolvedValue({ data: mockTask });
      mockApiClient.completeTaskWork.mockResolvedValue({
        data: { completedAt: "2024-01-15T10:00:00Z", durationMinutes: 15 },
      });

      const handler = getHandler();
      const result = await handler!({
        taskId: "ENG-1-1",
        skipValidations: true,
        summary: "Skipping validations",
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.validationsSkipped).toBe(true);
      expect(data.message).toContain("validations skipped");
      expect(mockApiClient.runAllValidations).not.toHaveBeenCalled();
      expect(mockApiClient.completeTaskWork).toHaveBeenCalledWith("task-123", {
        summary: "Skipping validations",
      });
    });

    it("should pass workingDirectory to validation runner", async () => {
      mockApiClient.getTask.mockResolvedValue({ data: mockTask });
      mockApiClient.runAllValidations.mockResolvedValue({
        data: {
          taskId: "task-123",
          identifier: "ENG-1-1",
          totalChecks: 1,
          passed: 1,
          failed: 0,
          pending: 0,
          allPassed: true,
          results: [{ id: "check-1", description: "Build", type: "command", status: "passed", passed: true }],
        },
      });
      mockApiClient.completeTaskWork.mockResolvedValue({
        data: { completedAt: "2024-01-15T10:00:00Z", durationMinutes: 10 },
      });

      const handler = getHandler();
      await handler!({
        taskId: "ENG-1-1",
        workingDirectory: "/path/to/project",
      });

      expect(mockApiClient.runAllValidations).toHaveBeenCalledWith(
        "task-123",
        expect.objectContaining({ workingDirectory: "/path/to/project" })
      );
    });

    it("should return error when task not found", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.getTask.mockRejectedValue(new ApiError("Not found", 404));

      const handler = getHandler();
      const result = await handler!({
        taskId: "NONEXISTENT-1-1",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("Task 'NONEXISTENT-1-1' not found");
    });
  });
});
