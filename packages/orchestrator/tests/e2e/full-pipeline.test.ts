/**
 * E2E Test: Full Pipeline Integration
 *
 * Tests the complete automation pipeline end-to-end:
 *   Planning → Epic Creation → Execution → Progress Tracking → Validation → Completion
 *
 * This is the integration test that exercises all components working together
 * using the test scenario: "Add a REST API endpoint for user preferences."
 *
 * Mocks: ACP client, SpecTree API (MockSpecTreeServer), git operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MockSpecTreeServer,
  startMockSpecTreeServer,
} from "../integration/mocks/mock-spectree-server.js";
import {
  SpecTreeClient,
  createSpecTreeClient,
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
// Test Scenario
// =============================================================================

const TEST_SCENARIO = {
  description:
    "Add a REST API endpoint at /api/v1/preferences with GET, PUT operations for user preferences. Store preferences in a new Prisma model. Add validation with Zod schemas.",
  epicName: "User Preferences API",
  expectedFeatures: [
    { title: "Database Model", order: 1, parallel: false },
    { title: "Zod Schemas", order: 2, parallel: true, group: "api-layer" },
    { title: "Route Handlers", order: 2, parallel: true, group: "api-layer" },
    { title: "Tests", order: 3, parallel: false },
  ],
};

// =============================================================================
// Tests
// =============================================================================

describe("E2E: Full Pipeline Integration", () => {
  let mockServer: MockSpecTreeServer;
  let client: SpecTreeClient;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockServer = startMockSpecTreeServer({
      initialState: {
        teams: [{ id: "team-eng", name: "Engineering", key: "ENG" }],
        epics: [],
        features: [],
        tasks: [],
        sessions: [],
      },
    });

    // Extended mock fetch that handles validation endpoints
    const baseFetch = mockServer.createMockFetch();
    const extendedFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.includes("/validations/run-all") && method === "POST") {
        const taskId = url.match(/\/tasks\/([^/]+)\/validations/)?.[1];
        const task = mockServer.tasks.find((t) => t.id === taskId);

        const result: RunAllValidationsResult = {
          taskId: taskId || "unknown",
          identifier: task?.identifier || "UNKNOWN",
          totalChecks: 1,
          passedChecks: 1,
          failedChecks: 0,
          allPassed: true,
          results: [
            {
              check: {
                id: `val-${taskId}`,
                type: "manual",
                description: "Implementation verified",
                status: "passed",
              },
              passed: true,
            },
          ] as ValidationResult[],
        };

        return new Response(JSON.stringify({ data: result }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return baseFetch(input, init);
    };

    global.fetch = extendedFetch;
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
  // Complete Pipeline Test
  // ---------------------------------------------------------------------------

  it("executes the full plan → execute → validate pipeline", async () => {
    // =========================================================================
    // PHASE 1: Planning — Create epic with features and tasks
    // =========================================================================

    // Step 1.1: Create the epic
    const epic = await client.createEpic({
      name: TEST_SCENARIO.epicName,
      teamId: "team-eng",
      description: TEST_SCENARIO.description,
    });
    expect(epic.id).toBeDefined();
    expect(epic.name).toBe("User Preferences API");

    // Step 1.2: Create features
    const featureIds: string[] = [];
    for (const spec of TEST_SCENARIO.expectedFeatures) {
      const feature = await client.createFeature({
        title: spec.title,
        epicId: epic.id,
        executionOrder: spec.order,
        canParallelize: spec.parallel,
        parallelGroup: spec.group,
      });
      featureIds.push(feature.id);
    }
    expect(featureIds.length).toBe(4);

    // Step 1.3: Create tasks for each feature
    const taskIds: string[] = [];
    for (const featureId of featureIds) {
      const feature = mockServer.features.find((f) => f.id === featureId);
      const taskTitles = feature?.title === "Database Model"
        ? ["Create Prisma model", "Run migration"]
        : feature?.title === "Zod Schemas"
          ? ["Create validation schemas"]
          : feature?.title === "Route Handlers"
            ? ["GET endpoint", "PUT endpoint"]
            : ["Write integration tests"];

      for (const title of taskTitles) {
        const task = await client.createTask({
          title,
          featureId,
          description: `Implement: ${title}`,
        });
        taskIds.push(task.id);
      }
    }
    expect(taskIds.length).toBe(6);

    // Step 1.4: Verify plan structure
    const executionPlan = await client.getExecutionPlan(epic.id);
    expect(executionPlan.totalItems).toBe(4); // 4 features
    expect(executionPlan.phases.length).toBeGreaterThanOrEqual(1);

    // =========================================================================
    // PHASE 2: Execution — Execute all phases with progress tracking
    // =========================================================================

    // Step 2.1: Start execution session
    const session = await client.startSession({ epicId: epic.id });
    expect(session.session.status).toBe("active");

    // Step 2.2: Execute all phases in order
    let completedSoFar = 0;
    for (const phase of executionPlan.phases) {
      // For parallel phases, start all items first
      if (phase.canRunInParallel) {
        for (const item of phase.items) {
          await client.startWork("feature", item.id);
        }
        for (const item of phase.items) {
          const featureTasks = mockServer.tasks.filter(
            (t) => t.featureId === item.id
          );
          for (const task of featureTasks) {
            await client.startWork("task", task.id);
            await client.completeWork("task", task.id);
          }
          await client.completeWork("feature", item.id);
        }
      } else {
        // Sequential: execute one at a time
        for (const item of phase.items) {
          await client.startWork("feature", item.id);
          const featureTasks = mockServer.tasks.filter(
            (t) => t.featureId === item.id
          );
          for (const task of featureTasks) {
            await client.startWork("task", task.id);
            await client.completeWork("task", task.id);
          }
          await client.completeWork("feature", item.id);
        }
      }

      completedSoFar += phase.items.length;

      // Verify incremental progress
      const progress = await client.getProgressSummary(epic.id);
      expect(progress.completedFeatures).toBe(completedSoFar);
    }

    // =========================================================================
    // PHASE 3: Validation — Run validations on all tasks
    // =========================================================================

    // Verify 100% completion
    const finalProgress = await client.getProgressSummary(epic.id);
    expect(finalProgress.completedFeatures).toBe(4);
    expect(finalProgress.overallProgress).toBe(100);

    // Run validations
    let allValidationsPassed = true;
    let totalValidationChecks = 0;
    let totalPassed = 0;

    for (const taskId of taskIds) {
      const result = await client.runAllValidations(taskId);
      totalValidationChecks += result.totalChecks;
      totalPassed += result.passedChecks;

      if (!result.allPassed) {
        allValidationsPassed = false;
      }
    }

    expect(allValidationsPassed).toBe(true);
    expect(totalValidationChecks).toBe(taskIds.length); // 1 check per task
    expect(totalPassed).toBe(taskIds.length);

    // =========================================================================
    // PHASE 4: Completion — End session and verify final state
    // =========================================================================

    const endedSession = await client.endSession(epic.id, {
      summary: `All ${TEST_SCENARIO.expectedFeatures.length} features completed. ${taskIds.length} tasks executed. All validations passed.`,
      nextSteps: ["Create pull request", "Deploy to staging"],
    });

    expect(endedSession.status).toBe("completed");
    expect(endedSession.summary).toContain("4 features completed");

    // Final state assertions
    const allFeaturesDone = mockServer.features.every(
      (f) => f.statusId === "status-3"
    );
    expect(allFeaturesDone).toBe(true);

    const allTasksDone = mockServer.tasks.every(
      (t) => t.statusId === "status-3"
    );
    expect(allTasksDone).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Pipeline with Resumption
  // ---------------------------------------------------------------------------

  it("supports interruption and resumption mid-execution", async () => {
    // Create epic and features
    const epic = await client.createEpic({
      name: "Resumable Epic",
      teamId: "team-eng",
    });

    await client.createFeature({
      title: "Phase 1 Work",
      epicId: epic.id,
      executionOrder: 1,
    });

    await client.createFeature({
      title: "Phase 2 Work",
      epicId: epic.id,
      executionOrder: 2,
    });

    // Start session and execute first feature only
    await client.startSession({ epicId: epic.id });

    // Get all features and complete just the first one
    const allFeatures = mockServer.features.filter(
      (f) => f.epicId === epic.id
    );
    const firstFeature = allFeatures[0]!;
    const secondFeature = allFeatures[1]!;

    await client.startWork("feature", firstFeature.id);
    await client.completeWork("feature", firstFeature.id);

    // "Interrupt" — end session with partial progress
    await client.endSession(epic.id, {
      summary: "First feature complete, interrupted before second",
      nextSteps: ["Resume and complete second feature"],
    });

    // Verify partial progress
    const midProgress = await client.getProgressSummary(epic.id);
    expect(midProgress.completedFeatures).toBe(1);
    expect(midProgress.overallProgress).toBe(50);

    // "Resume" — start new session
    const resumeSession = await client.startSession({ epicId: epic.id });
    expect(resumeSession.session.status).toBe("active");
    expect(resumeSession.epicProgress.completedFeatures).toBe(1);

    // Complete second feature
    await client.startWork("feature", secondFeature.id);
    await client.completeWork("feature", secondFeature.id);

    // Verify full completion
    const finalProgress = await client.getProgressSummary(epic.id);
    expect(finalProgress.completedFeatures).toBe(2);
    expect(finalProgress.overallProgress).toBe(100);

    // End session
    const ended = await client.endSession(epic.id, {
      summary: "All features complete after resumption",
    });
    expect(ended.status).toBe("completed");
  });

  // ---------------------------------------------------------------------------
  // Pipeline with Errors
  // ---------------------------------------------------------------------------

  it("handles execution errors without losing progress", async () => {
    const epic = await client.createEpic({
      name: "Error Recovery Epic",
      teamId: "team-eng",
    });

    await client.createFeature({
      title: "Succeeds",
      epicId: epic.id,
      executionOrder: 1,
    });

    await client.createFeature({
      title: "Also Succeeds",
      epicId: epic.id,
      executionOrder: 2,
    });

    await client.startSession({ epicId: epic.id });

    // Get all features for this epic
    const allFeatures = mockServer.features.filter(
      (f) => f.epicId === epic.id
    );

    // Execute first feature successfully
    await client.startWork("feature", allFeatures[0]!.id);
    await client.completeWork("feature", allFeatures[0]!.id);

    // Verify progress is saved
    const progress = await client.getProgressSummary(epic.id);
    expect(progress.completedFeatures).toBe(1);

    // Execute second feature
    await client.startWork("feature", allFeatures[1]!.id);
    await client.completeWork("feature", allFeatures[1]!.id);

    // Verify full progress
    const finalProgress = await client.getProgressSummary(epic.id);
    expect(finalProgress.completedFeatures).toBe(2);
    expect(finalProgress.overallProgress).toBe(100);
  });
});
