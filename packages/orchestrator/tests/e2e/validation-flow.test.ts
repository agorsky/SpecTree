/**
 * E2E Test: Validation Flow
 *
 * Tests the validate command end-to-end, verifying that validation checks
 * are run against completed tasks and results are correctly reported.
 *
 * Test scenario: Validate the "User Preferences API" epic after execution,
 * checking file_exists, command, and manual validation types.
 *
 * Mocks: SpecTree API (MockSpecTreeServer with validation endpoints)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MockSpecTreeServer,
  startMockSpecTreeServer,
} from "../integration/mocks/mock-spectree-server.js";
import {
  SpecTreeClient,
  createSpecTreeClient,
  type Feature,
  type Task,
  type RunAllValidationsResult,
  type ValidationResult,
} from "../../src/spectree/api-client.js";

// Mock config module
vi.mock("../../src/config/index.js", () => ({
  getApiUrl: () => "http://localhost:3001",
  getCopilotModel: () => "gpt-4",
  getDefaultTeam: () => "Engineering",
  initConfig: vi.fn(),
  getConfig: () => ({
    spectreeApiUrl: "http://localhost:3001",
    copilotModel: "gpt-4",
  }),
}));

// =============================================================================
// Test State Factory
// =============================================================================

function createCompletedEpicState() {
  const team = { id: "team-eng", name: "Engineering", key: "ENG" };

  const epic = {
    id: "epic-prefs-done",
    name: "User Preferences API",
    description: "Completed epic for validation testing",
    icon: null,
    color: "#3B82F6",
    sortOrder: 0,
    isArchived: false,
    teamId: team.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { features: 2 },
  };

  const features: Feature[] = [
    {
      id: "feat-model",
      epicId: epic.id,
      identifier: "ENG-200",
      title: "Prisma Model",
      description: "Create the UserPreference model",
      statusId: "status-3", // Done
      assigneeId: null,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionOrder: 1,
      canParallelize: false,
      parallelGroup: null,
      dependencies: null,
      estimatedComplexity: "simple",
    },
    {
      id: "feat-api",
      epicId: epic.id,
      identifier: "ENG-201",
      title: "API Endpoints",
      description: "Create GET and PUT endpoints",
      statusId: "status-3", // Done
      assigneeId: null,
      sortOrder: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionOrder: 2,
      canParallelize: false,
      parallelGroup: null,
      dependencies: null,
      estimatedComplexity: "moderate",
    },
  ];

  const tasks: Task[] = [
    {
      id: "task-model-1",
      featureId: "feat-model",
      identifier: "ENG-200-1",
      title: "Create Prisma schema",
      description: "Define UserPreference model in schema.prisma",
      statusId: "status-3",
      assigneeId: null,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionOrder: 1,
      canParallelize: false,
      parallelGroup: null,
      dependencies: null,
      estimatedComplexity: "simple",
    },
    {
      id: "task-api-1",
      featureId: "feat-api",
      identifier: "ENG-201-1",
      title: "GET endpoint",
      description: "Create GET /api/v1/preferences",
      statusId: "status-3",
      assigneeId: null,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionOrder: 1,
      canParallelize: false,
      parallelGroup: null,
      dependencies: null,
      estimatedComplexity: "simple",
    },
    {
      id: "task-api-2",
      featureId: "feat-api",
      identifier: "ENG-201-2",
      title: "PUT endpoint",
      description: "Create PUT /api/v1/preferences",
      statusId: "status-3",
      assigneeId: null,
      sortOrder: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionOrder: 2,
      canParallelize: false,
      parallelGroup: null,
      dependencies: null,
      estimatedComplexity: "simple",
    },
  ];

  return {
    teams: [team],
    epics: [epic],
    features,
    tasks,
    sessions: [],
  };
}

// =============================================================================
// Mock Validation Results
// =============================================================================

/**
 * Create mock validation results for testing.
 * Simulates the SpecTree API's POST /tasks/:id/validations/run-all endpoint.
 */
function createPassingValidationResult(
  taskId: string,
  identifier: string
): RunAllValidationsResult {
  return {
    taskId,
    identifier,
    totalChecks: 2,
    passedChecks: 2,
    failedChecks: 0,
    allPassed: true,
    results: [
      {
        check: {
          id: "check-1",
          type: "file_exists",
          description: "Schema file exists",
          status: "passed",
        },
        passed: true,
      },
      {
        check: {
          id: "check-2",
          type: "manual",
          description: "Code review completed",
          status: "passed",
        },
        passed: true,
      },
    ] as ValidationResult[],
  };
}

function createMixedValidationResult(
  taskId: string,
  identifier: string
): RunAllValidationsResult {
  return {
    taskId,
    identifier,
    totalChecks: 3,
    passedChecks: 2,
    failedChecks: 1,
    allPassed: false,
    results: [
      {
        check: {
          id: "check-1",
          type: "file_exists",
          description: "Route file exists",
          status: "passed",
        },
        passed: true,
      },
      {
        check: {
          id: "check-2",
          type: "command",
          description: "TypeScript compiles",
          status: "passed",
        },
        passed: true,
      },
      {
        check: {
          id: "check-3",
          type: "command",
          description: "Tests pass",
          status: "failed",
        },
        passed: false,
        error: "1 test failed: GET /preferences returns 500",
      },
    ] as ValidationResult[],
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("E2E: Validation Flow", () => {
  let mockServer: MockSpecTreeServer;
  let client: SpecTreeClient;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockServer = startMockSpecTreeServer({
      initialState: createCompletedEpicState(),
    });

    // Extend mock server to handle validation endpoints
    const baseMockFetch = mockServer.createMockFetch();
    const validationMockFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      // Handle validation run-all endpoints
      if (url.includes("/validations/run-all") && method === "POST") {
        const taskId = url.match(/\/tasks\/([^/]+)\/validations/)?.[1];
        if (!taskId) {
          return new Response(
            JSON.stringify({ message: "Task not found" }),
            { status: 404 }
          );
        }

        // Return different results based on task
        let result: RunAllValidationsResult;
        if (taskId === "task-api-2") {
          result = createMixedValidationResult(taskId, "ENG-201-2");
        } else if (taskId === "task-model-1") {
          result = createPassingValidationResult(taskId, "ENG-200-1");
        } else if (taskId === "task-api-1") {
          result = createPassingValidationResult(taskId, "ENG-201-1");
        } else {
          // Tasks with no validation checks
          result = {
            taskId,
            identifier: "UNKNOWN",
            totalChecks: 0,
            passedChecks: 0,
            failedChecks: 0,
            allPassed: true,
            results: [],
          };
        }

        return new Response(JSON.stringify({ data: result }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Delegate to base mock for all other requests
      return baseMockFetch(input, init);
    };

    global.fetch = validationMockFetch;
    client = createSpecTreeClient({
      token: "test-token",
      apiUrl: "http://localhost:3001",
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // 1. Validation Execution
  // ---------------------------------------------------------------------------

  describe("Validation Execution", () => {
    it("runs all validations for a task and returns results", async () => {
      const result = await client.runAllValidations("task-model-1");

      expect(result.taskId).toBe("task-model-1");
      expect(result.identifier).toBe("ENG-200-1");
      expect(result.totalChecks).toBe(2);
      expect(result.passedChecks).toBe(2);
      expect(result.failedChecks).toBe(0);
      expect(result.allPassed).toBe(true);
    });

    it("reports failed validation checks", async () => {
      const result = await client.runAllValidations("task-api-2");

      expect(result.taskId).toBe("task-api-2");
      expect(result.totalChecks).toBe(3);
      expect(result.passedChecks).toBe(2);
      expect(result.failedChecks).toBe(1);
      expect(result.allPassed).toBe(false);

      const failedCheck = result.results.find((r) => !r.passed);
      expect(failedCheck).toBeDefined();
      expect(failedCheck!.error).toContain("1 test failed");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Epic-Level Validation
  // ---------------------------------------------------------------------------

  describe("Epic-Level Validation", () => {
    it("runs validations for all tasks across features", async () => {
      // Get features
      const featuresResult = await client.listFeatures({
        epicId: "epic-prefs-done",
        limit: 100,
      });
      expect(featuresResult.data.length).toBe(2);

      // Collect all tasks
      const allResults: RunAllValidationsResult[] = [];
      for (const feature of featuresResult.data) {
        const tasksResult = await client.listTasks({
          featureId: feature.id,
          limit: 100,
        });

        for (const task of tasksResult.data) {
          const validationResult = await client.runAllValidations(task.id);
          if (validationResult.totalChecks > 0) {
            allResults.push(validationResult);
          }
        }
      }

      // Should have results for tasks with validation checks
      expect(allResults.length).toBeGreaterThan(0);
    });

    it("determines overall pass/fail status correctly", async () => {
      // Run validations for all tasks
      const taskIds = ["task-model-1", "task-api-1", "task-api-2"];
      const results = await Promise.all(
        taskIds.map((id) => client.runAllValidations(id))
      );

      // Overall should be fail because task-api-2 has a failure
      const overallPassed = results.every((r) => r.allPassed);
      expect(overallPassed).toBe(false);

      // Count totals
      const totalChecks = results.reduce((s, r) => s + r.totalChecks, 0);
      const totalPassed = results.reduce((s, r) => s + r.passedChecks, 0);
      const totalFailed = results.reduce((s, r) => s + r.failedChecks, 0);

      expect(totalChecks).toBe(7); // 2 + 2 + 3
      expect(totalPassed).toBe(6);
      expect(totalFailed).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Validation Result Analysis
  // ---------------------------------------------------------------------------

  describe("Validation Result Analysis", () => {
    it("categorizes validation check types", async () => {
      const result = await client.runAllValidations("task-api-2");

      const types = result.results.map((r) => r.check.type);
      expect(types).toContain("file_exists");
      expect(types).toContain("command");
    });

    it("provides error details for failed checks", async () => {
      const result = await client.runAllValidations("task-api-2");

      const failedResults = result.results.filter((r) => !r.passed);
      expect(failedResults.length).toBe(1);

      const failed = failedResults[0]!;
      expect(failed.check.description).toBe("Tests pass");
      expect(failed.error).toContain("test failed");
    });

    it("handles tasks with no validation checks", async () => {
      // Use a task ID that returns 0 checks
      const result = await client.runAllValidations("task-no-checks");

      expect(result.totalChecks).toBe(0);
      expect(result.allPassed).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Epic Resolution
  // ---------------------------------------------------------------------------

  describe("Epic Resolution for Validation", () => {
    it("resolves epic by UUID", async () => {
      const epic = await client.getEpic("epic-prefs-done");
      expect(epic.name).toBe("User Preferences API");
    });

    it("resolves epic by name search", async () => {
      const epicsResult = await client.listEpics({ limit: 100 });
      const epic = epicsResult.data.find(
        (e) => e.name.toLowerCase() === "user preferences api"
      );

      expect(epic).toBeDefined();
      expect(epic!.id).toBe("epic-prefs-done");
    });
  });
});
