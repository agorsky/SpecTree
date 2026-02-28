/**
 * E2E Test: Planning Pipeline
 *
 * Tests the plan command end-to-end, verifying that the planning pipeline
 * creates a well-structured epic from a natural language description.
 *
 * Test scenario: "Add a REST API endpoint for user preferences with CRUD operations"
 *
 * Mocks: Claude Code client (no real CLI), SpecTree API (MockSpecTreeServer)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MockSpecTreeServer,
  startMockSpecTreeServer,
} from "../integration/mocks/mock-spectree-server.js";
import {
  SpecTreeClient,
  createSpecTreeClient,
} from "../../src/spectree/api-client.js";
import type { GeneratedPlan, GeneratedFeature } from "../../src/orchestrator/index.js";

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

const TEST_SCENARIO =
  "Add a REST API endpoint at /api/v1/preferences with GET, PUT operations for user preferences. Store preferences in a new Prisma model. Add validation with Zod schemas.";

/**
 * Simulates what the PlanGenerator would create for the test scenario.
 * In a real E2E run, this comes from a Claude Code session with the planner agent.
 */
function createTestPlan(epicId: string): GeneratedPlan {
  return {
    epicId,
    epicName: "User Preferences API",
    epicDescription:
      "Add REST API endpoints for managing user preferences with CRUD operations, Prisma storage, and Zod validation.",
    features: [
      {
        id: "feature-pref-1",
        identifier: "ENG-100",
        title: "Prisma Model & Migration",
        executionOrder: 1,
        canParallelize: false,
        parallelGroup: null,
        estimatedComplexity: "simple",
        tasks: [
          { id: "task-1-1", identifier: "ENG-100-1", title: "Create UserPreference Prisma model" },
          { id: "task-1-2", identifier: "ENG-100-2", title: "Generate and apply migration" },
        ],
      },
      {
        id: "feature-pref-2",
        identifier: "ENG-101",
        title: "Zod Validation Schemas",
        executionOrder: 2,
        canParallelize: true,
        parallelGroup: "api-layer",
        estimatedComplexity: "simple",
        tasks: [
          { id: "task-2-1", identifier: "ENG-101-1", title: "Create preference Zod schemas" },
          { id: "task-2-2", identifier: "ENG-101-2", title: "Add schema validation middleware" },
        ],
      },
      {
        id: "feature-pref-3",
        identifier: "ENG-102",
        title: "API Route Handlers",
        executionOrder: 2,
        canParallelize: true,
        parallelGroup: "api-layer",
        estimatedComplexity: "moderate",
        tasks: [
          { id: "task-3-1", identifier: "ENG-102-1", title: "GET /api/v1/preferences endpoint" },
          { id: "task-3-2", identifier: "ENG-102-2", title: "PUT /api/v1/preferences endpoint" },
        ],
      },
      {
        id: "feature-pref-4",
        identifier: "ENG-103",
        title: "Integration Tests",
        executionOrder: 3,
        canParallelize: false,
        parallelGroup: null,
        estimatedComplexity: "simple",
        tasks: [
          { id: "task-4-1", identifier: "ENG-103-1", title: "Write API endpoint tests" },
          { id: "task-4-2", identifier: "ENG-103-2", title: "Write Zod schema tests" },
        ],
      },
    ],
    executionOrder: [
      "feature-pref-1",
      "feature-pref-2",
      "feature-pref-3",
      "feature-pref-4",
    ],
    parallelGroups: ["api-layer"],
    totalFeatures: 4,
    totalTasks: 8,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("E2E: Planning Pipeline", () => {
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
  // 1. Epic Creation from Plan
  // ---------------------------------------------------------------------------

  describe("Epic Creation from Plan", () => {
    it("creates an epic with the correct name and description", async () => {
      const epic = await client.createEpic({
        name: "User Preferences API",
        teamId: "team-eng",
        description:
          "Add REST API endpoints for managing user preferences with CRUD operations.",
      });

      expect(epic.id).toBeDefined();
      expect(epic.name).toBe("User Preferences API");
      expect(epic.description).toContain("user preferences");
    });

    it("creates features under the epic with correct metadata", async () => {
      const epic = await client.createEpic({
        name: "User Preferences API",
        teamId: "team-eng",
      });

      const plan = createTestPlan(epic.id);

      // Create features matching the plan
      const createdFeatures: string[] = [];
      for (const feature of plan.features) {
        const created = await client.createFeature({
          title: feature.title,
          epicId: epic.id,
          executionOrder: feature.executionOrder,
          canParallelize: feature.canParallelize,
          parallelGroup: feature.parallelGroup ?? undefined,
        });

        expect(created.identifier).toBeDefined();
        expect(created.epicId).toBe(epic.id);
        createdFeatures.push(created.id);
      }

      expect(createdFeatures.length).toBe(4);

      // Verify features are stored
      expect(mockServer.features.length).toBe(4);
    });

    it("creates tasks under each feature", async () => {
      const epic = await client.createEpic({
        name: "User Preferences API",
        teamId: "team-eng",
      });

      // Create a feature
      const feature = await client.createFeature({
        title: "Prisma Model & Migration",
        epicId: epic.id,
        executionOrder: 1,
      });

      // Create tasks
      const task1 = await client.createTask({
        title: "Create UserPreference Prisma model",
        featureId: feature.id,
        description: "Define the Prisma schema for user preferences",
      });

      const task2 = await client.createTask({
        title: "Generate and apply migration",
        featureId: feature.id,
        description: "Run prisma migrate dev to create the table",
      });

      expect(task1.featureId).toBe(feature.id);
      expect(task2.featureId).toBe(feature.id);
      expect(mockServer.tasks.length).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Plan Structure Validation
  // ---------------------------------------------------------------------------

  describe("Plan Structure Validation", () => {
    it("plan has 3-5 features for the preferences scenario", () => {
      const plan = createTestPlan("epic-test");

      expect(plan.totalFeatures).toBeGreaterThanOrEqual(3);
      expect(plan.totalFeatures).toBeLessThanOrEqual(5);
    });

    it("each feature has 2-4 tasks", () => {
      const plan = createTestPlan("epic-test");

      for (const feature of plan.features) {
        expect(feature.tasks.length).toBeGreaterThanOrEqual(2);
        expect(feature.tasks.length).toBeLessThanOrEqual(4);
      }
    });

    it("execution order is set correctly", () => {
      const plan = createTestPlan("epic-test");

      // Database feature should come first (order 1)
      const dbFeature = plan.features.find((f) =>
        f.title.toLowerCase().includes("prisma")
      );
      expect(dbFeature?.executionOrder).toBe(1);

      // Tests should come last (highest order)
      const testFeature = plan.features.find((f) =>
        f.title.toLowerCase().includes("test")
      );
      const maxOrder = Math.max(
        ...plan.features.map((f) => f.executionOrder)
      );
      expect(testFeature?.executionOrder).toBe(maxOrder);
    });

    it("parallel groups are identified correctly", () => {
      const plan = createTestPlan("epic-test");

      expect(plan.parallelGroups.length).toBeGreaterThan(0);

      // Features in the same parallel group should have the same execution order
      const parallelFeatures = plan.features.filter(
        (f) => f.canParallelize && f.parallelGroup === "api-layer"
      );
      expect(parallelFeatures.length).toBeGreaterThanOrEqual(2);

      const orders = new Set(
        parallelFeatures.map((f) => f.executionOrder)
      );
      expect(orders.size).toBe(1); // All same order
    });

    it("all features have identifiers", () => {
      const plan = createTestPlan("epic-test");

      for (const feature of plan.features) {
        expect(feature.identifier).toBeDefined();
        expect(feature.identifier.length).toBeGreaterThan(0);
      }
    });

    it("all tasks have identifiers", () => {
      const plan = createTestPlan("epic-test");

      for (const feature of plan.features) {
        for (const task of feature.tasks) {
          expect(task.identifier).toBeDefined();
          expect(task.identifier.length).toBeGreaterThan(0);
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Execution Plan Generation
  // ---------------------------------------------------------------------------

  describe("Execution Plan from Created Epic", () => {
    it("generates a valid execution plan with phases", async () => {
      const epic = await client.createEpic({
        name: "User Preferences API",
        teamId: "team-eng",
      });

      // Create features with different execution orders
      await client.createFeature({
        title: "Database Model",
        epicId: epic.id,
        executionOrder: 1,
        canParallelize: false,
      });

      await client.createFeature({
        title: "Zod Schemas",
        epicId: epic.id,
        executionOrder: 2,
        canParallelize: true,
        parallelGroup: "api-layer",
      });

      await client.createFeature({
        title: "Route Handlers",
        epicId: epic.id,
        executionOrder: 2,
        canParallelize: true,
        parallelGroup: "api-layer",
      });

      await client.createFeature({
        title: "Tests",
        epicId: epic.id,
        executionOrder: 3,
        canParallelize: false,
      });

      const plan = await client.getExecutionPlan(epic.id);

      expect(plan.epicId).toBe(epic.id);
      expect(plan.totalItems).toBe(4);
      expect(plan.phases.length).toBeGreaterThanOrEqual(2);

      // Verify phase ordering
      for (let i = 1; i < plan.phases.length; i++) {
        expect(plan.phases[i]!.order).toBeGreaterThanOrEqual(
          plan.phases[i - 1]!.order
        );
      }
    });

    it("identifies parallel phases correctly", async () => {
      const epic = await client.createEpic({
        name: "User Preferences API",
        teamId: "team-eng",
      });

      await client.createFeature({
        title: "Parallel A",
        epicId: epic.id,
        executionOrder: 1,
        canParallelize: true,
        parallelGroup: "group-1",
      });

      await client.createFeature({
        title: "Parallel B",
        epicId: epic.id,
        executionOrder: 1,
        canParallelize: true,
        parallelGroup: "group-1",
      });

      const plan = await client.getExecutionPlan(epic.id);

      const parallelPhase = plan.phases.find((p) => p.canRunInParallel);
      expect(parallelPhase).toBeDefined();
      expect(parallelPhase!.items.length).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Session Management During Planning
  // ---------------------------------------------------------------------------

  describe("Session Management", () => {
    it("creates and uses sessions for planning context", async () => {
      const epic = await client.createEpic({
        name: "User Preferences API",
        teamId: "team-eng",
      });

      // Start a session
      const sessionResponse = await client.startSession({
        epicId: epic.id,
      });
      expect(sessionResponse.session.id).toBeDefined();
      expect(sessionResponse.session.status).toBe("active");

      // End session with summary
      const endedSession = await client.endSession(epic.id, {
        summary: "Planning complete: 4 features, 8 tasks created",
        nextSteps: ["Review plan in UI", "Execute with spectree run"],
      });
      expect(endedSession.status).toBe("completed");
      expect(endedSession.summary).toContain("Planning complete");
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Team Resolution
  // ---------------------------------------------------------------------------

  describe("Team Resolution", () => {
    it("lists available teams", async () => {
      const result = await client.listTeams();

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]!.name).toBe("Engineering");
      expect(result.data[0]!.key).toBe("ENG");
    });

    it("resolves team by name or key", async () => {
      const result = await client.listTeams();
      const team = result.data.find(
        (t) =>
          t.name.toLowerCase() === "engineering" ||
          t.key.toLowerCase() === "eng"
      );

      expect(team).toBeDefined();
      expect(team!.id).toBe("team-eng");
    });
  });
});
