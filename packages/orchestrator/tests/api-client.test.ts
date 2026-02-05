/**
 * Unit tests for SpecTree API Client
 *
 * Tests use mocked fetch responses to verify:
 * - CRUD operations for epics, features, tasks
 * - Error handling and mapping
 * - Retry logic for transient failures
 * - Timeout handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SpecTreeClient,
  createSpecTreeClient,
  type Epic,
  type Feature,
  type Task,
} from "../src/spectree/api-client.js";
import {
  AuthError,
  NetworkError,
  SpecTreeAPIError,
  isAuthError,
  isNetworkError,
  isSpecTreeAPIError,
} from "../src/errors.js";

// Mock the config module
vi.mock("../src/config/index.js", () => ({
  getApiUrl: () => "http://localhost:3001",
}));

// Test fixtures
const mockEpic: Epic = {
  id: "epic-123",
  name: "Test Epic",
  description: "A test epic",
  icon: null,
  color: "#3B82F6",
  sortOrder: 1,
  isArchived: false,
  teamId: "team-456",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  _count: { features: 2 },
};

const mockFeature: Feature = {
  id: "feature-123",
  epicId: "epic-123",
  identifier: "TEAM-1",
  title: "Test Feature",
  description: "A test feature",
  statusId: "status-1",
  assigneeId: null,
  sortOrder: 1,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  executionOrder: 1,
  canParallelize: true,
  parallelGroup: "group-a",
  dependencies: null,
  estimatedComplexity: "moderate",
};

const mockTask: Task = {
  id: "task-123",
  featureId: "feature-123",
  identifier: "TEAM-1-1",
  title: "Test Task",
  description: "A test task",
  statusId: "status-1",
  assigneeId: null,
  sortOrder: 1,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  executionOrder: 1,
  canParallelize: false,
  parallelGroup: null,
  dependencies: null,
  estimatedComplexity: "simple",
};

// Helper to create mock responses
function createMockResponse(
  data: unknown,
  status = 200,
  ok = true
): Response {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response;
}

describe("SpecTreeClient", () => {
  let client: SpecTreeClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    client = createSpecTreeClient({
      token: "test-token-123",
      apiUrl: "http://localhost:3001",
    });
  });

  afterEach(async () => {
    // Ensure fake timers are restored to prevent unhandled rejections
    vi.useRealTimers();
    vi.restoreAllMocks();
    // Allow any pending microtasks to flush
    await new Promise((r) => setTimeout(r, 0));
  });

  // ===========================================================================
  // Epic Operations
  // ===========================================================================

  describe("Epic Operations", () => {
    it("should create an epic", async () => {
      fetchMock.mockResolvedValueOnce(
        createMockResponse({ data: mockEpic }, 201)
      );

      const result = await client.createEpic({
        name: "Test Epic",
        teamId: "team-456",
        description: "A test epic",
      });

      expect(result).toEqual(mockEpic);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3001/api/v1/epics",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token-123",
            "Content-Type": "application/json",
          }),
          body: expect.stringContaining('"name":"Test Epic"'),
        })
      );
    });

    it("should get an epic by ID", async () => {
      fetchMock.mockResolvedValueOnce(createMockResponse({ data: mockEpic }));

      const result = await client.getEpic("epic-123");

      expect(result).toEqual(mockEpic);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3001/api/v1/epics/epic-123",
        expect.objectContaining({ method: "GET" })
      );
    });

    it("should update an epic", async () => {
      const updatedEpic = { ...mockEpic, name: "Updated Epic" };
      fetchMock.mockResolvedValueOnce(createMockResponse({ data: updatedEpic }));

      const result = await client.updateEpic("epic-123", {
        name: "Updated Epic",
      });

      expect(result.name).toBe("Updated Epic");
    });

    it("should list epics with filters", async () => {
      fetchMock.mockResolvedValueOnce(
        createMockResponse({
          data: [mockEpic],
          meta: { cursor: null, hasMore: false },
        })
      );

      const result = await client.listEpics({
        teamId: "team-456",
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.hasMore).toBe(false);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("teamId=team-456"),
        expect.anything()
      );
    });
  });

  // ===========================================================================
  // Feature Operations
  // ===========================================================================

  describe("Feature Operations", () => {
    it("should create a feature", async () => {
      fetchMock.mockResolvedValueOnce(
        createMockResponse({ data: mockFeature }, 201)
      );

      const result = await client.createFeature({
        title: "Test Feature",
        epicId: "epic-123",
        executionOrder: 1,
        estimatedComplexity: "moderate",
      });

      expect(result.identifier).toBe("TEAM-1");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3001/api/v1/features",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("should get a feature by ID", async () => {
      fetchMock.mockResolvedValueOnce(createMockResponse({ data: mockFeature }));

      const result = await client.getFeature("feature-123");

      expect(result).toEqual(mockFeature);
    });

    it("should update a feature", async () => {
      const updated = { ...mockFeature, title: "Updated Feature" };
      fetchMock.mockResolvedValueOnce(createMockResponse({ data: updated }));

      const result = await client.updateFeature("feature-123", {
        title: "Updated Feature",
      });

      expect(result.title).toBe("Updated Feature");
    });

    it("should list features with epic filter", async () => {
      fetchMock.mockResolvedValueOnce(
        createMockResponse({
          data: [mockFeature],
          meta: { cursor: null, hasMore: false },
        })
      );

      const result = await client.listFeatures({ epicId: "epic-123" });

      expect(result.data).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("epicId=epic-123"),
        expect.anything()
      );
    });
  });

  // ===========================================================================
  // Task Operations
  // ===========================================================================

  describe("Task Operations", () => {
    it("should create a task", async () => {
      fetchMock.mockResolvedValueOnce(
        createMockResponse({ data: mockTask }, 201)
      );

      const result = await client.createTask({
        title: "Test Task",
        featureId: "feature-123",
      });

      expect(result.identifier).toBe("TEAM-1-1");
    });

    it("should get a task by ID", async () => {
      fetchMock.mockResolvedValueOnce(createMockResponse({ data: mockTask }));

      const result = await client.getTask("task-123");

      expect(result).toEqual(mockTask);
    });

    it("should update a task", async () => {
      const updated = { ...mockTask, title: "Updated Task" };
      fetchMock.mockResolvedValueOnce(createMockResponse({ data: updated }));

      const result = await client.updateTask("task-123", {
        title: "Updated Task",
      });

      expect(result.title).toBe("Updated Task");
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe("Error Handling", () => {
    it("should throw AuthError on 401", async () => {
      fetchMock.mockResolvedValueOnce(
        createMockResponse(
          { message: "Invalid token" },
          401,
          false
        )
      );

      try {
        await client.getEpic("epic-123");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(isAuthError(error)).toBe(true);
      }
    });

    it("should throw AuthError on 403", async () => {
      fetchMock.mockResolvedValueOnce(
        createMockResponse(
          { message: "Access denied" },
          403,
          false
        )
      );

      await expect(client.getEpic("epic-123")).rejects.toThrow(AuthError);
    });

    it("should throw SpecTreeAPIError on 404", async () => {
      fetchMock.mockResolvedValueOnce(
        createMockResponse(
          { message: "Epic not found" },
          404,
          false
        )
      );

      await expect(client.getEpic("nonexistent")).rejects.toThrow(
        SpecTreeAPIError
      );
    });

    it("should throw SpecTreeAPIError with validation errors on 400", async () => {
      fetchMock.mockResolvedValueOnce(
        createMockResponse(
          { message: "Validation failed", errors: ["Name is required"] },
          400,
          false
        )
      );

      try {
        await client.createEpic({ name: "", teamId: "team-1" });
      } catch (error) {
        expect(isSpecTreeAPIError(error)).toBe(true);
        expect((error as SpecTreeAPIError).message).toContain("Validation");
      }
    });

    it("should throw NetworkError on 429", async () => {
      vi.useFakeTimers();
      
      // Mock 3 rate limit responses (for all retries)
      fetchMock.mockResolvedValueOnce(
        createMockResponse({ message: "Rate limited" }, 429, false)
      );
      fetchMock.mockResolvedValueOnce(
        createMockResponse({ message: "Rate limited" }, 429, false)
      );
      fetchMock.mockResolvedValueOnce(
        createMockResponse({ message: "Rate limited" }, 429, false)
      );

      const promise = client.getEpic("epic-123");
      
      // Advance through all retries - run all pending timers
      await vi.runAllTimersAsync();

      try {
        await promise;
        expect.fail("Should have thrown");
      } catch (error) {
        // 429 is mapped to NetworkError with retryable: true
        expect(isNetworkError(error)).toBe(true);
        expect((error as NetworkError).retryable).toBe(true);
      }
      
      vi.useRealTimers();
    });

    it("should throw NetworkError on 500 server errors", async () => {
      vi.useFakeTimers();
      
      // Mock 3 responses for all retries
      fetchMock.mockResolvedValueOnce(
        createMockResponse({ message: "Internal error" }, 500, false)
      );
      fetchMock.mockResolvedValueOnce(
        createMockResponse({ message: "Internal error" }, 500, false)
      );
      fetchMock.mockResolvedValueOnce(
        createMockResponse({ message: "Internal error" }, 500, false)
      );

      const promise = client.getEpic("epic-123");
      
      // Run all pending timers to completion
      await vi.runAllTimersAsync();
      
      await expect(promise).rejects.toThrow(NetworkError);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      
      vi.useRealTimers();
    });
  });

  // ===========================================================================
  // Retry Logic
  // ===========================================================================

  describe("Retry Logic", () => {
    it("should retry on server errors and succeed", async () => {
      vi.useFakeTimers();
      
      fetchMock
        .mockResolvedValueOnce(
          createMockResponse({ message: "Server error" }, 500, false)
        )
        .mockResolvedValueOnce(createMockResponse({ data: mockEpic }));

      const promise = client.getEpic("epic-123");
      
      // Run all pending timers to completion
      await vi.runAllTimersAsync();
      
      const result = await promise;

      expect(result).toEqual(mockEpic);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      
      vi.useRealTimers();
    });

    it("should not retry on client errors", async () => {
      fetchMock.mockResolvedValueOnce(
        createMockResponse({ message: "Not found" }, 404, false)
      );

      await expect(client.getEpic("epic-123")).rejects.toThrow(SpecTreeAPIError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should retry on network errors", async () => {
      vi.useFakeTimers();
      
      const networkError = new TypeError("Failed to fetch");
      fetchMock
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(createMockResponse({ data: mockEpic }));

      const promise = client.getEpic("epic-123");
      
      // Run all pending timers to completion
      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toEqual(mockEpic);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      
      vi.useRealTimers();
    });

    it("should fail after max retries", async () => {
      vi.useFakeTimers();
      
      const networkError = new TypeError("Failed to fetch");
      fetchMock
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError);

      const promise = client.getEpic("epic-123");
      
      // Run all pending timers to completion
      await vi.runAllTimersAsync();
      
      // Await the promise to ensure all async work completes before restoring timers
      let caughtError: Error | null = null;
      try {
        await promise;
      } catch (error) {
        caughtError = error as Error;
      }
      
      expect(caughtError).toBeInstanceOf(NetworkError);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      
      vi.useRealTimers();
    });
  });

  // ===========================================================================
  // Execution Plan
  // ===========================================================================

  describe("Execution Plan", () => {
    it("should build execution plan from features", async () => {
      const features: Feature[] = [
        {
          ...mockFeature,
          id: "f1",
          identifier: "TEAM-1",
          executionOrder: 1,
          canParallelize: true,
          parallelGroup: "setup",
          dependencies: null,
        },
        {
          ...mockFeature,
          id: "f2",
          identifier: "TEAM-2",
          executionOrder: 1,
          canParallelize: true,
          parallelGroup: "setup",
          dependencies: null,
        },
        {
          ...mockFeature,
          id: "f3",
          identifier: "TEAM-3",
          executionOrder: 2,
          canParallelize: false,
          parallelGroup: null,
          dependencies: JSON.stringify(["f1", "f2"]),
        },
      ];

      fetchMock.mockResolvedValueOnce(
        createMockResponse({
          data: features,
          meta: { cursor: null, hasMore: false },
        })
      );

      const plan = await client.getExecutionPlan("epic-123");

      expect(plan.epicId).toBe("epic-123");
      expect(plan.totalItems).toBe(3);
      expect(plan.phases.length).toBeGreaterThan(0);

      // First phase should have parallel features
      const phase1 = plan.phases.find((p) => p.canRunInParallel);
      expect(phase1).toBeDefined();
      expect(phase1?.items.length).toBe(2);
    });

    it("should handle empty epic", async () => {
      fetchMock.mockResolvedValueOnce(
        createMockResponse({
          data: [],
          meta: { cursor: null, hasMore: false },
        })
      );

      const plan = await client.getExecutionPlan("epic-123");

      expect(plan.phases).toHaveLength(0);
      expect(plan.totalItems).toBe(0);
    });
  });

  // ===========================================================================
  // Session Management
  // ===========================================================================

  describe("Session Management", () => {
    it("should start a session", async () => {
      const mockResponse = {
        session: {
          id: "session-123",
          epicId: "epic-123",
          externalId: null,
          startedAt: "2024-01-01T00:00:00Z",
          endedAt: null,
          status: "active",
          itemsWorkedOn: [],
          summary: null,
          nextSteps: null,
          blockers: null,
          decisions: null,
          contextBlob: null,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
        previousSession: null,
        epicProgress: {
          totalFeatures: 5,
          completedFeatures: 2,
          inProgressFeatures: 1,
          totalTasks: 10,
          completedTasks: 5,
        },
      };

      fetchMock.mockResolvedValueOnce(
        createMockResponse({ data: mockResponse }, 201)
      );

      const result = await client.startSession({ epicId: "epic-123" });

      expect(result.session.id).toBe("session-123");
      expect(result.session.status).toBe("active");
      expect(result.epicProgress.totalFeatures).toBe(5);
    });

    it("should return null for non-existent active session", async () => {
      fetchMock.mockResolvedValueOnce(
        createMockResponse(
          { error: "No active session" },
          404,
          false
        )
      );

      const result = await client.getActiveSession("epic-123");

      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // Progress Tracking
  // ===========================================================================

  describe("Progress Tracking", () => {
    it("should start work on a feature", async () => {
      const mockResponse = {
        id: "feature-123",
        identifier: "TEAM-1",
        status: "In Progress",
        startedAt: "2024-01-01T00:00:00Z",
        completedAt: null,
        percentComplete: 0,
      };

      fetchMock.mockResolvedValueOnce(createMockResponse({ data: mockResponse }));

      const result = await client.startWork("feature", "feature-123");

      expect(result.status).toBe("In Progress");
      expect(result.startedAt).toBeTruthy();
    });

    it("should complete work on a task", async () => {
      const mockResponse = {
        id: "task-123",
        identifier: "TEAM-1-1",
        status: "Done",
        startedAt: "2024-01-01T00:00:00Z",
        completedAt: "2024-01-01T01:00:00Z",
        percentComplete: 100,
      };

      fetchMock.mockResolvedValueOnce(createMockResponse({ data: mockResponse }));

      const result = await client.completeWork("task", "task-123", {
        summary: "Task completed successfully",
      });

      expect(result.status).toBe("Done");
      expect(result.completedAt).toBeTruthy();
      expect(result.percentComplete).toBe(100);
    });

    it("should log progress", async () => {
      const mockResponse = {
        id: "feature-123",
        identifier: "TEAM-1",
        status: "In Progress",
        startedAt: "2024-01-01T00:00:00Z",
        completedAt: null,
        percentComplete: 50,
      };

      fetchMock.mockResolvedValueOnce(createMockResponse({ data: mockResponse }));

      const result = await client.logProgress("feature", "feature-123", {
        message: "Halfway done",
        percentComplete: 50,
      });

      expect(result.percentComplete).toBe(50);
    });
  });

  // ===========================================================================
  // Factory Function
  // ===========================================================================

  describe("createSpecTreeClient", () => {
    it("should create a client with token", () => {
      const client = createSpecTreeClient({ token: "my-token" });
      expect(client).toBeInstanceOf(SpecTreeClient);
    });

    it("should use custom API URL", async () => {
      const customClient = createSpecTreeClient({
        token: "my-token",
        apiUrl: "https://api.spectree.io",
      });

      fetchMock.mockResolvedValueOnce(createMockResponse({ data: mockEpic }));

      await customClient.getEpic("epic-123");

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.spectree.io/api/v1/epics/epic-123",
        expect.anything()
      );
    });
  });
});
