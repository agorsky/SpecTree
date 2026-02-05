/**
 * Integration Tests: SpecTree API
 *
 * Tests against the actual SpecTree API (requires running server).
 * These tests are skipped in CI and run manually.
 *
 * To run these tests:
 *   RUN_INTEGRATION=true SPECTREE_TOKEN=<your-token> pnpm test tests/integration/spectree-api.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  SpecTreeClient,
  createSpecTreeClient,
  type Epic,
} from "../../src/spectree/api-client.js";

// Check if integration tests should run
const runIntegration = process.env.RUN_INTEGRATION === "true";
const spectreeToken = process.env.SPECTREE_TOKEN;
const apiUrl = process.env.SPECTREE_API_URL ?? "http://localhost:3001";

// Helper to conditionally run tests
const itIfIntegration = runIntegration && spectreeToken ? it : it.skip;

describe("SpecTree API Integration", () => {
  let client: SpecTreeClient;
  let testEpicId: string | null = null;
  let testTeamId: string | null = null;

  beforeAll(async () => {
    if (!runIntegration || !spectreeToken) {
      console.log("Skipping integration tests. Set RUN_INTEGRATION=true and SPECTREE_TOKEN to run.");
      return;
    }

    client = createSpecTreeClient({
      apiUrl,
      token: spectreeToken,
    });

    // Get a team to use for tests
    try {
      const teams = await client.listTeams();
      if (teams.data.length > 0) {
        testTeamId = teams.data[0]!.id;
      }
    } catch (error) {
      console.error("Failed to get teams:", error);
    }
  });

  afterAll(async () => {
    // Clean up: delete test epic if created
    // Note: In a real scenario, you might want to archive instead of delete
    // or use a test-specific team
    if (testEpicId) {
      try {
        // API doesn't have delete, so we just leave it
        console.log(`Test epic created: ${testEpicId}`);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  // ===========================================================================
  // Connection Tests
  // ===========================================================================

  describe("Connection", () => {
    itIfIntegration("connects to SpecTree API", async () => {
      const teams = await client.listTeams();
      expect(teams.data).toBeDefined();
      expect(Array.isArray(teams.data)).toBe(true);
    });

    itIfIntegration("authenticates with valid token", async () => {
      // If we get here without error, auth is working
      const teams = await client.listTeams();
      expect(teams.data.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Team Operations
  // ===========================================================================

  describe("Team Operations", () => {
    itIfIntegration("lists available teams", async () => {
      const result = await client.listTeams();

      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);

      const team = result.data[0]!;
      expect(team.id).toBeDefined();
      expect(team.name).toBeDefined();
      expect(team.key).toBeDefined();
    });

    itIfIntegration("gets a team by ID", async () => {
      if (!testTeamId) {
        expect.fail("No test team available");
        return;
      }

      const team = await client.getTeam(testTeamId);

      expect(team.id).toBe(testTeamId);
      expect(team.name).toBeDefined();
    });
  });

  // ===========================================================================
  // Epic CRUD
  // ===========================================================================

  describe("Epic CRUD", () => {
    itIfIntegration("creates and retrieves an epic", async () => {
      if (!testTeamId) {
        expect.fail("No test team available");
        return;
      }

      const timestamp = Date.now();
      const epic = await client.createEpic({
        name: `Integration Test Epic ${timestamp}`,
        teamId: testTeamId,
        description: "Created by integration test - safe to delete",
      });

      testEpicId = epic.id;

      expect(epic.id).toBeDefined();
      expect(epic.name).toContain("Integration Test Epic");
      expect(epic.teamId).toBe(testTeamId);

      // Retrieve it
      const retrieved = await client.getEpic(epic.id);
      expect(retrieved.id).toBe(epic.id);
      expect(retrieved.name).toBe(epic.name);
    });

    itIfIntegration("updates an epic", async () => {
      if (!testEpicId) {
        expect.fail("No test epic created");
        return;
      }

      const updated = await client.updateEpic(testEpicId, {
        description: "Updated description from integration test",
      });

      expect(updated.description).toBe("Updated description from integration test");
    });

    itIfIntegration("lists epics", async () => {
      const result = await client.listEpics();

      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.meta).toBeDefined();
    });
  });

  // ===========================================================================
  // Feature Operations
  // ===========================================================================

  describe("Feature Operations", () => {
    let testFeatureId: string | null = null;

    itIfIntegration("creates a feature under an epic", async () => {
      if (!testEpicId) {
        expect.fail("No test epic created");
        return;
      }

      const feature = await client.createFeature({
        title: "Integration Test Feature",
        epicId: testEpicId,
        description: "Created by integration test",
        executionOrder: 1,
        canParallelize: true,
      });

      testFeatureId = feature.id;

      expect(feature.id).toBeDefined();
      expect(feature.identifier).toBeDefined();
      expect(feature.epicId).toBe(testEpicId);
      expect(feature.canParallelize).toBe(true);
    });

    itIfIntegration("gets a feature by ID", async () => {
      if (!testFeatureId) {
        expect.fail("No test feature created");
        return;
      }

      const feature = await client.getFeature(testFeatureId);

      expect(feature.id).toBe(testFeatureId);
      expect(feature.title).toBe("Integration Test Feature");
    });

    itIfIntegration("lists features for an epic", async () => {
      if (!testEpicId) {
        expect.fail("No test epic created");
        return;
      }

      const result = await client.listFeatures({ epicId: testEpicId });

      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
    });

    itIfIntegration("tracks feature progress", async () => {
      if (!testFeatureId) {
        expect.fail("No test feature created");
        return;
      }

      // Start work
      const startResult = await client.startWork("feature", testFeatureId);
      expect(startResult.status).toBeDefined();

      // Complete work
      const completeResult = await client.completeWork("feature", testFeatureId, {
        summary: "Completed by integration test",
      });
      expect(completeResult.status).toBeDefined();
    });
  });

  // ===========================================================================
  // Task Operations
  // ===========================================================================

  describe("Task Operations", () => {
    let testFeatureId: string | null = null;
    let testTaskId: string | null = null;

    beforeAll(async () => {
      // Create a feature for task tests
      if (runIntegration && testEpicId) {
        try {
          const feature = await client.createFeature({
            title: "Task Test Feature",
            epicId: testEpicId,
            description: "Feature for task tests",
          });
          testFeatureId = feature.id;
        } catch {
          // Ignore errors in setup
        }
      }
    });

    itIfIntegration("creates a task under a feature", async () => {
      if (!testFeatureId) {
        expect.fail("No test feature available");
        return;
      }

      const task = await client.createTask({
        title: "Integration Test Task",
        featureId: testFeatureId,
        description: "Created by integration test",
      });

      testTaskId = task.id;

      expect(task.id).toBeDefined();
      expect(task.identifier).toBeDefined();
      expect(task.featureId).toBe(testFeatureId);
    });

    itIfIntegration("gets a task by ID", async () => {
      if (!testTaskId) {
        expect.fail("No test task created");
        return;
      }

      const task = await client.getTask(testTaskId);

      expect(task.id).toBe(testTaskId);
      expect(task.title).toBe("Integration Test Task");
    });

    itIfIntegration("tracks task progress", async () => {
      if (!testTaskId) {
        expect.fail("No test task created");
        return;
      }

      // Start work
      const startResult = await client.startWork("task", testTaskId);
      expect(startResult.status).toBeDefined();

      // Complete work
      const completeResult = await client.completeWork("task", testTaskId);
      expect(completeResult.status).toBeDefined();
    });
  });

  // ===========================================================================
  // Session Management
  // ===========================================================================

  describe("Session Management", () => {
    itIfIntegration("starts and ends a session", async () => {
      if (!testEpicId) {
        expect.fail("No test epic created");
        return;
      }

      // Start session
      const startResult = await client.startSession({ epicId: testEpicId });

      expect(startResult.session.id).toBeDefined();
      expect(startResult.session.status).toBe("active");
      expect(startResult.epicProgress).toBeDefined();

      // Get active session
      const activeSession = await client.getActiveSession(testEpicId);
      expect(activeSession?.id).toBe(startResult.session.id);

      // End session
      const endedSession = await client.endSession(testEpicId, {
        summary: "Integration test session completed",
        nextSteps: ["Verify results"],
      });

      expect(endedSession.status).toBe("completed");
      expect(endedSession.summary).toBe("Integration test session completed");
    });
  });

  // ===========================================================================
  // Execution Plan
  // ===========================================================================

  describe("Execution Plan", () => {
    itIfIntegration("generates execution plan for epic", async () => {
      if (!testEpicId) {
        expect.fail("No test epic created");
        return;
      }

      const plan = await client.getExecutionPlan(testEpicId);

      expect(plan.epicId).toBe(testEpicId);
      expect(plan.phases).toBeDefined();
      expect(Array.isArray(plan.phases)).toBe(true);
      expect(typeof plan.totalItems).toBe("number");
    });

    itIfIntegration("gets progress summary for epic", async () => {
      if (!testEpicId) {
        expect.fail("No test epic created");
        return;
      }

      const progress = await client.getProgressSummary(testEpicId);

      expect(progress.epic).toBeDefined();
      expect(progress.epic.id).toBe(testEpicId);
      expect(typeof progress.totalFeatures).toBe("number");
      expect(typeof progress.overallProgress).toBe("number");
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe("Error Handling", () => {
    itIfIntegration("handles not found errors", async () => {
      await expect(client.getEpic("nonexistent-epic-id")).rejects.toThrow();
    });

    itIfIntegration("handles validation errors", async () => {
      if (!testTeamId) {
        expect.fail("No test team available");
        return;
      }

      // Try to create an epic with missing required fields
      await expect(
        client.createEpic({
          name: "",
          teamId: testTeamId,
        })
      ).rejects.toThrow();
    });
  });
});
