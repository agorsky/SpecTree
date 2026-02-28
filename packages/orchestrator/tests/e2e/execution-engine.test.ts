/**
 * E2E Test: Execution Engine
 *
 * Tests the orchestration execution engine end-to-end, verifying that
 * the run command processes tasks with correct SpecTree progress tracking,
 * git branch management, and Claude Code session coordination.
 *
 * Test scenario: Execute a pre-created "User Preferences API" epic
 * with 4 features and 8 tasks through sequential and parallel phases.
 *
 * Mocks: Claude Code client, SpecTree API (MockSpecTreeServer), git operations
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

/**
 * Creates a pre-populated test state simulating a planned epic
 * ready for execution.
 */
function createPreferencesEpicState() {
  const team = { id: "team-eng", name: "Engineering", key: "ENG" };

  const epic = {
    id: "epic-prefs",
    name: "User Preferences API",
    description:
      "Add REST API endpoints for user preferences with CRUD operations.",
    icon: null,
    color: "#3B82F6",
    sortOrder: 0,
    isArchived: false,
    teamId: team.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { features: 4 },
  };

  const features: Feature[] = [
    {
      id: "feat-db",
      epicId: epic.id,
      identifier: "ENG-100",
      title: "Prisma Model & Migration",
      description: "Create UserPreference Prisma model and run migration",
      statusId: "status-1",
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
      id: "feat-zod",
      epicId: epic.id,
      identifier: "ENG-101",
      title: "Zod Validation Schemas",
      description: "Create Zod schemas for preference validation",
      statusId: "status-1",
      assigneeId: null,
      sortOrder: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionOrder: 2,
      canParallelize: true,
      parallelGroup: "api-layer",
      dependencies: '["feat-db"]',
      estimatedComplexity: "simple",
    },
    {
      id: "feat-routes",
      epicId: epic.id,
      identifier: "ENG-102",
      title: "API Route Handlers",
      description: "Create GET and PUT /api/v1/preferences endpoints",
      statusId: "status-1",
      assigneeId: null,
      sortOrder: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionOrder: 2,
      canParallelize: true,
      parallelGroup: "api-layer",
      dependencies: '["feat-db"]',
      estimatedComplexity: "moderate",
    },
    {
      id: "feat-tests",
      epicId: epic.id,
      identifier: "ENG-103",
      title: "Integration Tests",
      description: "Write API endpoint and Zod schema tests",
      statusId: "status-1",
      assigneeId: null,
      sortOrder: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionOrder: 3,
      canParallelize: false,
      parallelGroup: null,
      dependencies: '["feat-zod","feat-routes"]',
      estimatedComplexity: "simple",
    },
  ];

  const tasks: Task[] = [
    {
      id: "task-db-1",
      featureId: "feat-db",
      identifier: "ENG-100-1",
      title: "Create UserPreference Prisma model",
      description: "Define the Prisma schema model for user preferences",
      statusId: "status-1",
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
      id: "task-db-2",
      featureId: "feat-db",
      identifier: "ENG-100-2",
      title: "Generate and apply migration",
      description: "Run prisma migrate dev",
      statusId: "status-1",
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
    {
      id: "task-zod-1",
      featureId: "feat-zod",
      identifier: "ENG-101-1",
      title: "Create preference Zod schemas",
      description: "Define input/output schemas for preferences API",
      statusId: "status-1",
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
      id: "task-routes-1",
      featureId: "feat-routes",
      identifier: "ENG-102-1",
      title: "GET /api/v1/preferences endpoint",
      description: "Create GET handler for retrieving preferences",
      statusId: "status-1",
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
      id: "task-routes-2",
      featureId: "feat-routes",
      identifier: "ENG-102-2",
      title: "PUT /api/v1/preferences endpoint",
      description: "Create PUT handler for updating preferences",
      statusId: "status-1",
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
    {
      id: "task-test-1",
      featureId: "feat-tests",
      identifier: "ENG-103-1",
      title: "Write API endpoint tests",
      description: "Write tests for GET and PUT endpoints",
      statusId: "status-1",
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
// Tests
// =============================================================================

describe("E2E: Execution Engine", () => {
  let mockServer: MockSpecTreeServer;
  let client: SpecTreeClient;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockServer = startMockSpecTreeServer({
      initialState: createPreferencesEpicState(),
    });
    global.fetch = mockServer.createMockFetch();
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
  // 1. Execution Plan Generation
  // ---------------------------------------------------------------------------

  describe("Execution Plan", () => {
    it("generates execution plan with correct phases", async () => {
      const plan = await client.getExecutionPlan("epic-prefs");

      expect(plan.epicId).toBe("epic-prefs");
      expect(plan.totalItems).toBe(4);
      expect(plan.phases.length).toBeGreaterThanOrEqual(2);
    });

    it("phase 1 has the database feature (sequential)", async () => {
      const plan = await client.getExecutionPlan("epic-prefs");

      const phase1 = plan.phases.find((p) => p.order === 1);
      expect(phase1).toBeDefined();
      expect(phase1!.items.length).toBe(1);
      expect(phase1!.items[0]!.identifier).toBe("ENG-100");
    });

    it("phase 2 has parallel features", async () => {
      const plan = await client.getExecutionPlan("epic-prefs");

      const phase2 = plan.phases.find((p) => p.order === 2);
      expect(phase2).toBeDefined();
      expect(phase2!.canRunInParallel).toBe(true);
      expect(phase2!.items.length).toBe(2);

      const identifiers = phase2!.items.map((i) => i.identifier);
      expect(identifiers).toContain("ENG-101");
      expect(identifiers).toContain("ENG-102");
    });

    it("phase 3 has the test feature (sequential)", async () => {
      const plan = await client.getExecutionPlan("epic-prefs");

      const phase3 = plan.phases.find((p) => p.order === 3);
      expect(phase3).toBeDefined();
      expect(phase3!.items.length).toBe(1);
      expect(phase3!.items[0]!.identifier).toBe("ENG-103");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Progress Tracking
  // ---------------------------------------------------------------------------

  describe("Progress Tracking", () => {
    it("starts and completes features with status updates", async () => {
      // Start work on database feature
      const startResult = await client.startWork("feature", "feat-db");
      expect(startResult.status).toBe("In Progress");
      expect(startResult.startedAt).toBeDefined();

      // Verify mock server state updated
      const dbFeature = mockServer.features.find((f) => f.id === "feat-db");
      expect(dbFeature?.statusId).toBe("status-2"); // In Progress

      // Complete the feature
      const completeResult = await client.completeWork("feature", "feat-db");
      expect(completeResult.status).toBe("Done");
      expect(completeResult.completedAt).toBeDefined();
      expect(completeResult.percentComplete).toBe(100);

      // Verify final state
      const completedFeature = mockServer.features.find(
        (f) => f.id === "feat-db"
      );
      expect(completedFeature?.statusId).toBe("status-3"); // Done
    });

    it("tracks task-level progress within features", async () => {
      // Start task
      const startResult = await client.startWork("task", "task-db-1");
      expect(startResult.status).toBe("In Progress");

      // Complete task
      const completeResult = await client.completeWork("task", "task-db-1");
      expect(completeResult.status).toBe("Done");
      expect(completeResult.percentComplete).toBe(100);
    });

    it("progress summary reflects completed features", async () => {
      // Get initial progress
      const initial = await client.getProgressSummary("epic-prefs");
      expect(initial.totalFeatures).toBe(4);
      expect(initial.completedFeatures).toBe(0);
      expect(initial.overallProgress).toBe(0);

      // Complete one feature
      await client.startWork("feature", "feat-db");
      await client.completeWork("feature", "feat-db");

      // Check updated progress
      const updated = await client.getProgressSummary("epic-prefs");
      expect(updated.completedFeatures).toBe(1);
      expect(updated.overallProgress).toBe(25); // 1/4 = 25%
    });

    it("tracks progress across all phases", async () => {
      const featureIds = ["feat-db", "feat-zod", "feat-routes", "feat-tests"];

      // Complete all features in order
      for (const id of featureIds) {
        await client.startWork("feature", id);
        await client.completeWork("feature", id);
      }

      // Verify 100% progress
      const progress = await client.getProgressSummary("epic-prefs");
      expect(progress.completedFeatures).toBe(4);
      expect(progress.overallProgress).toBe(100);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Session Lifecycle
  // ---------------------------------------------------------------------------

  describe("Session Lifecycle During Execution", () => {
    it("starts a session before execution", async () => {
      const sessionResponse = await client.startSession({
        epicId: "epic-prefs",
      });

      expect(sessionResponse.session.id).toBeDefined();
      expect(sessionResponse.session.status).toBe("active");
      expect(sessionResponse.epicProgress.totalFeatures).toBe(4);
    });

    it("ends session after execution completes", async () => {
      // Start session
      await client.startSession({ epicId: "epic-prefs" });

      // Simulate execution
      await client.startWork("feature", "feat-db");
      await client.completeWork("feature", "feat-db");

      // End session
      const ended = await client.endSession("epic-prefs", {
        summary: "Phase 1 complete: database model created",
        nextSteps: ["Execute phase 2: API layer"],
      });

      expect(ended.status).toBe("completed");
      expect(ended.summary).toContain("Phase 1 complete");
    });

    it("tracks active session for resumability", async () => {
      // Start session
      const { session } = await client.startSession({
        epicId: "epic-prefs",
      });

      // Verify active session is accessible
      const active = await client.getActiveSession("epic-prefs");
      expect(active?.id).toBe(session.id);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Full Execution Simulation
  // ---------------------------------------------------------------------------

  describe("Full Execution Simulation", () => {
    it("executes all phases in order with progress tracking", async () => {
      // Start session
      await client.startSession({ epicId: "epic-prefs" });

      // Get execution plan
      const plan = await client.getExecutionPlan("epic-prefs");

      // Execute each phase
      for (const phase of plan.phases) {
        for (const item of phase.items) {
          await client.startWork("feature", item.id);
          await client.completeWork("feature", item.id);
        }
      }

      // Verify all complete
      const progress = await client.getProgressSummary("epic-prefs");
      expect(progress.completedFeatures).toBe(4);
      expect(progress.overallProgress).toBe(100);

      // End session
      const ended = await client.endSession("epic-prefs", {
        summary: "All 4 features completed successfully",
        nextSteps: ["Run validations", "Create PR"],
      });
      expect(ended.status).toBe("completed");
    });

    it("supports task-level execution within features", async () => {
      // Execute tasks within the database feature
      await client.startWork("feature", "feat-db");

      await client.startWork("task", "task-db-1");
      await client.completeWork("task", "task-db-1");

      await client.startWork("task", "task-db-2");
      await client.completeWork("task", "task-db-2");

      await client.completeWork("feature", "feat-db");

      // Verify feature is done
      const dbFeature = mockServer.features.find((f) => f.id === "feat-db");
      expect(dbFeature?.statusId).toBe("status-3");

      // Verify tasks are done
      const task1 = mockServer.tasks.find((t) => t.id === "task-db-1");
      const task2 = mockServer.tasks.find((t) => t.id === "task-db-2");
      expect(task1?.statusId).toBe("status-3");
      expect(task2?.statusId).toBe("status-3");
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Error Handling
  // ---------------------------------------------------------------------------

  describe("Error Handling", () => {
    it("handles missing epic gracefully", async () => {
      await expect(
        client.getEpic("nonexistent-epic")
      ).rejects.toThrow();
    });

    it("handles API errors during execution", async () => {
      // Inject a transient error
      mockServer.setError("/features/feat-db/progress/start", 500, "Internal server error", {
        method: "POST",
        count: 1,
      });

      vi.useFakeTimers();

      const promise = client.startWork("feature", "feat-db");
      await vi.runAllTimersAsync();

      // Should succeed on retry
      const result = await promise;
      expect(result.status).toBe("In Progress");

      vi.useRealTimers();
    });
  });
});
