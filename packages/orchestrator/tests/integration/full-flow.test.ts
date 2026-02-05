/**
 * Integration Tests: Full Orchestration Flow
 *
 * Tests the complete orchestration flow using mocked SpecTree API.
 * Validates that all components work together correctly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MockSpecTreeServer,
  startMockSpecTreeServer,
  createTestState,
} from "./mocks/mock-spectree-server.js";
import {
  SpecTreeClient,
  createSpecTreeClient,
} from "../../src/spectree/api-client.js";
import { NetworkError, SpecTreeAPIError } from "../../src/errors.js";

// Mock the config module
vi.mock("../../src/config/index.js", () => ({
  getApiUrl: () => "http://localhost:3001",
  getCopilotModel: () => "gpt-4",
  getConfig: () => ({
    spectreeApiUrl: "http://localhost:3001",
    copilotModel: "gpt-4",
  }),
}));

describe("Full Orchestration Flow", () => {
  let mockServer: MockSpecTreeServer;
  let client: SpecTreeClient;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    // Save original fetch
    originalFetch = global.fetch;

    // Create mock server with test state
    mockServer = startMockSpecTreeServer({ initialState: createTestState() });

    // Replace global fetch with mock
    global.fetch = mockServer.createMockFetch();

    // Create client
    client = createSpecTreeClient({
      token: "test-token",
      apiUrl: "http://localhost:3001",
    });
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Epic Lifecycle
  // ===========================================================================

  describe("Epic Lifecycle", () => {
    it("creates an epic and retrieves it", async () => {
      const epic = await client.createEpic({
        name: "New Test Epic",
        teamId: "team-test",
        description: "A test epic description",
      });

      expect(epic.id).toBeDefined();
      expect(epic.name).toBe("New Test Epic");
      expect(epic.description).toBe("A test epic description");

      // Verify it's stored in mock server
      expect(mockServer.epics).toContainEqual(expect.objectContaining({ id: epic.id }));

      // Retrieve it
      const retrieved = await client.getEpic(epic.id);
      expect(retrieved.name).toBe("New Test Epic");
    });

    it("lists epics with pre-existing data", async () => {
      const result = await client.listEpics();

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.meta.hasMore).toBe(false);
    });

    it("updates an epic", async () => {
      // Use pre-existing epic from test state
      const epic = mockServer.epics[0]!;

      const updated = await client.updateEpic(epic.id, {
        name: "Updated Epic Name",
        description: "Updated description",
      });

      expect(updated.name).toBe("Updated Epic Name");
      expect(updated.description).toBe("Updated description");
    });
  });

  // ===========================================================================
  // Feature Workflow
  // ===========================================================================

  describe("Feature Workflow", () => {
    it("creates features under an epic", async () => {
      const epic = mockServer.epics[0]!;

      const feature1 = await client.createFeature({
        title: "Feature One",
        epicId: epic.id,
        description: "First feature",
        executionOrder: 1,
        canParallelize: true,
      });

      const feature2 = await client.createFeature({
        title: "Feature Two",
        epicId: epic.id,
        description: "Second feature",
        executionOrder: 2,
        canParallelize: false,
      });

      expect(feature1.identifier).toBeDefined();
      expect(feature2.identifier).toBeDefined();
      expect(feature1.epicId).toBe(epic.id);
      expect(feature2.epicId).toBe(epic.id);
    });

    it("tracks feature progress through start and complete", async () => {
      // Use pre-existing feature from test state
      const feature = mockServer.features[0]!;

      // Start work
      const startResult = await client.startWork("feature", feature.id);
      expect(startResult.status).toBe("In Progress");
      expect(startResult.startedAt).toBeDefined();

      // Verify status changed in mock server
      const updatedFeature = mockServer.features.find((f) => f.id === feature.id);
      expect(updatedFeature?.statusId).toBe("status-2"); // In Progress

      // Complete work
      const completeResult = await client.completeWork("feature", feature.id);
      expect(completeResult.status).toBe("Done");
      expect(completeResult.completedAt).toBeDefined();
      expect(completeResult.percentComplete).toBe(100);
    });

    it("builds execution plan from features", async () => {
      const epic = mockServer.epics[0]!;

      const plan = await client.getExecutionPlan(epic.id);

      expect(plan.epicId).toBe(epic.id);
      expect(plan.totalItems).toBe(2); // Pre-existing features from test state
      expect(plan.phases.length).toBeGreaterThan(0);

      // Both features are parallelizable in the same group
      const parallelPhase = plan.phases.find((p) => p.canRunInParallel);
      expect(parallelPhase).toBeDefined();
      expect(parallelPhase?.items.length).toBe(2);
    });
  });

  // ===========================================================================
  // Session Management
  // ===========================================================================

  describe("Session Management", () => {
    it("starts and ends a session", async () => {
      const epic = mockServer.epics[0]!;

      // Start session
      const startResult = await client.startSession({ epicId: epic.id });
      expect(startResult.session.id).toBeDefined();
      expect(startResult.session.status).toBe("active");
      expect(startResult.epicProgress.totalFeatures).toBe(2);

      // Get active session
      const activeSession = await client.getActiveSession(epic.id);
      expect(activeSession?.id).toBe(startResult.session.id);

      // End session
      const endedSession = await client.endSession(epic.id, {
        summary: "Completed testing",
        nextSteps: ["Review results", "Deploy to staging"],
      });
      expect(endedSession.status).toBe("completed");
      expect(endedSession.summary).toBe("Completed testing");
    });

    it("tracks progress summary across session", async () => {
      const epic = mockServer.epics[0]!;
      const feature = mockServer.features[0]!;

      // Get initial progress
      const initialProgress = await client.getProgressSummary(epic.id);
      expect(initialProgress.totalFeatures).toBe(2);
      expect(initialProgress.completedFeatures).toBe(0);

      // Complete a feature
      await client.completeWork("feature", feature.id);

      // Check updated progress
      const updatedProgress = await client.getProgressSummary(epic.id);
      expect(updatedProgress.completedFeatures).toBe(1);
      expect(updatedProgress.overallProgress).toBe(50);
    });
  });

  // ===========================================================================
  // Task Workflow
  // ===========================================================================

  describe("Task Workflow", () => {
    it("creates and completes tasks under a feature", async () => {
      const feature = mockServer.features[0]!;

      // Create tasks
      const task1 = await client.createTask({
        title: "Task One",
        featureId: feature.id,
        description: "First task",
      });

      const task2 = await client.createTask({
        title: "Task Two",
        featureId: feature.id,
        description: "Second task",
      });

      expect(task1.identifier).toBeDefined();
      expect(task2.featureId).toBe(feature.id);

      // Complete tasks
      await client.startWork("task", task1.id);
      const completed = await client.completeWork("task", task1.id);
      expect(completed.status).toBe("Done");
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe("Error Handling", () => {
    it("handles API errors gracefully", async () => {
      // Inject a 500 error
      mockServer.setError("/epics", 500, "Internal server error", {
        method: "POST",
        count: 3, // All retry attempts will fail
      });

      // Use fake timers for retry delays
      vi.useFakeTimers();

      const promise = client.createEpic({
        name: "Will fail",
        teamId: "team-test",
      });

      // Advance through all retry delays
      await vi.runAllTimersAsync();

      // Properly catch and verify the error
      let caughtError: Error | null = null;
      try {
        await promise;
      } catch (error) {
        caughtError = error as Error;
      }

      expect(caughtError).toBeInstanceOf(NetworkError);

      vi.useRealTimers();
    });

    it("handles 404 not found errors", async () => {
      await expect(client.getEpic("nonexistent-id")).rejects.toThrow(
        SpecTreeAPIError
      );
    });

    it("recovers from transient errors with retry", async () => {
      // First request fails, second succeeds
      mockServer.setError("/epics", 500, "Temporary error", {
        method: "POST",
        count: 1, // Only fail once
      });

      // Enable fake timers for retry delays
      vi.useFakeTimers();

      const promise = client.createEpic({
        name: "Retry Test Epic",
        teamId: "team-test",
      });

      // Advance through retry delay
      await vi.runAllTimersAsync();

      const epic = await promise;
      expect(epic.name).toBe("Retry Test Epic");

      vi.useRealTimers();
    });
  });

  // ===========================================================================
  // End-to-End Scenario
  // ===========================================================================

  describe("End-to-End Scenario", () => {
    it("simulates complete orchestration workflow", async () => {
      // 1. Create a new epic
      const epic = await client.createEpic({
        name: "E2E Test Epic",
        teamId: "team-test",
        description: "End-to-end test epic",
      });
      expect(epic.id).toBeDefined();

      // 2. Start a session
      const sessionResponse = await client.startSession({ epicId: epic.id });
      expect(sessionResponse.session.status).toBe("active");

      // 3. Create features
      const feature1 = await client.createFeature({
        title: "Setup Infrastructure",
        epicId: epic.id,
        executionOrder: 1,
        canParallelize: true,
        parallelGroup: "setup",
      });

      const feature2 = await client.createFeature({
        title: "Configure Database",
        epicId: epic.id,
        executionOrder: 1,
        canParallelize: true,
        parallelGroup: "setup",
      });

      // 4. Get execution plan (should have the 2 features we just created)
      const plan = await client.getExecutionPlan(epic.id);
      expect(plan.totalItems).toBeGreaterThanOrEqual(2);

      // 5. Execute features (simulated)
      for (const phase of plan.phases) {
        for (const item of phase.items) {
          await client.startWork("feature", item.id);
          await client.completeWork("feature", item.id);
        }
      }

      // 6. Verify completion
      const progress = await client.getProgressSummary(epic.id);
      expect(progress.completedFeatures).toBe(2);
      expect(progress.overallProgress).toBe(100);

      // 7. End session
      const endedSession = await client.endSession(epic.id, {
        summary: "All features completed successfully",
        nextSteps: ["Create PR", "Deploy to production"],
      });
      expect(endedSession.status).toBe("completed");
    });
  });

  // ===========================================================================
  // Parallel Execution Scenarios
  // ===========================================================================

  describe("Parallel Execution Scenarios", () => {
    it("identifies parallelizable features in execution plan", async () => {
      const epic = await client.createEpic({
        name: "Parallel Test Epic",
        teamId: "team-test",
      });

      // Create parallel features
      await client.createFeature({
        title: "Parallel Feature A",
        epicId: epic.id,
        executionOrder: 1,
        canParallelize: true,
        parallelGroup: "group-1",
      });

      await client.createFeature({
        title: "Parallel Feature B",
        epicId: epic.id,
        executionOrder: 1,
        canParallelize: true,
        parallelGroup: "group-1",
      });

      // Create sequential feature depending on previous
      await client.createFeature({
        title: "Sequential Feature",
        epicId: epic.id,
        executionOrder: 2,
        canParallelize: false,
      });

      const plan = await client.getExecutionPlan(epic.id);

      // Should have at least one parallel phase
      const parallelPhases = plan.phases.filter((p) => p.canRunInParallel);
      expect(parallelPhases.length).toBeGreaterThan(0);

      // First parallel phase should have at least the 2 parallel items
      const firstParallelPhase = parallelPhases[0];
      expect(firstParallelPhase?.items.length).toBeGreaterThanOrEqual(2);
    });
  });
});
