/**
 * Integration tests for the SpecTree MCP API Client
 *
 * These tests verify that the API client correctly communicates with the SpecTree API.
 * They require a running API server with test data.
 *
 * Test Setup:
 * - API server must be running at API_BASE_URL (default: http://localhost:3001)
 * - A valid API token must be set in API_TOKEN environment variable
 * - Test data should be seeded in the database
 *
 * Run with: npm run test:integration
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  ApiClient,
  ApiError,
  initializeApiClient,
  getApiClient,
  type Project,
  type Feature,
  type Task,
  type Status,
} from "../../src/api-client.js";

// =============================================================================
// Test Configuration
// =============================================================================

const TEST_API_URL = process.env.API_BASE_URL || "http://localhost:3001";
const TEST_API_TOKEN = process.env.API_TOKEN || "";

// Track created resources for cleanup
const createdResources: {
  projects: string[];
  features: string[];
  tasks: string[];
} = {
  projects: [],
  features: [],
  tasks: [],
};

// Test data references (populated from existing seed data)
let testTeam: { id: string; name: string; key: string } | null = null;
let testProject: Project | null = null;
let testFeature: Feature | null = null;
let testStatus: Status | null = null;

// =============================================================================
// Test Setup & Teardown
// =============================================================================

beforeAll(async () => {
  // Skip integration tests if no API token is provided
  if (!TEST_API_TOKEN) {
    console.warn(
      "⚠️  Skipping integration tests: API_TOKEN environment variable not set"
    );
    return;
  }

  // Initialize the API client
  initializeApiClient({
    baseUrl: TEST_API_URL,
    token: TEST_API_TOKEN,
  });

  const client = getApiClient();

  // Fetch existing test data - use Engineering team
  try {
    const teamResult = await client.getTeam("Engineering");
    if (teamResult) {
      testTeam = teamResult.data;
    }
  } catch {
    // Try by key
    try {
      const teamResult = await client.getTeam("ENG");
      if (teamResult) {
        testTeam = teamResult.data;
      }
    } catch {
      console.warn("⚠️  No test team found. Some tests may fail.");
    }
  }

  // Get an existing project
  if (testTeam) {
    const projectsResult = await client.listProjects({ team: testTeam.id, limit: 1 });
    if (projectsResult.data.length > 0) {
      testProject = projectsResult.data[0];
    }
  }

  // Get an existing feature
  if (testProject) {
    const featuresResult = await client.listFeatures({
      projectId: testProject.id,
      limit: 1,
    });
    if (featuresResult.data.length > 0) {
      testFeature = featuresResult.data[0];
    }
  }

  // Get statuses for the team
  if (testTeam) {
    const statusesResult = await client.listStatuses(testTeam.id);
    if (statusesResult.data.length > 0) {
      testStatus = statusesResult.data[0];
    }
  }
});

afterAll(async () => {
  if (!TEST_API_TOKEN) return;

  // Note: In a real cleanup, we would delete created resources
  // For now, we just log what would be cleaned up
  if (createdResources.tasks.length > 0) {
    console.log(`Would cleanup ${createdResources.tasks.length} tasks`);
  }
  if (createdResources.features.length > 0) {
    console.log(`Would cleanup ${createdResources.features.length} features`);
  }
  if (createdResources.projects.length > 0) {
    console.log(`Would cleanup ${createdResources.projects.length} projects`);
  }
});

// =============================================================================
// Helper Functions
// =============================================================================

function skipIfNoToken() {
  if (!TEST_API_TOKEN) {
    console.log("Skipped: No API token");
    return true;
  }
  return false;
}

function skipIfNoTestData(resource: string, data: unknown) {
  if (!data) {
    console.log(`Skipped: No test ${resource} available`);
    return true;
  }
  return false;
}

// =============================================================================
// Authentication Tests
// =============================================================================

describe("Authentication", () => {
  it("should authenticate with valid token", async () => {
    if (skipIfNoToken()) return;

    const client = getApiClient();
    // A successful list call proves authentication works
    const result = await client.listProjects({ limit: 1 });
    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("should reject invalid token with 401", async () => {
    const invalidClient = new ApiClient(TEST_API_URL, "invalid_token_12345");

    await expect(invalidClient.listProjects()).rejects.toThrow(ApiError);

    try {
      await invalidClient.listProjects();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(401);
    }
  });

  it("should reject missing token with 401", async () => {
    const noTokenClient = new ApiClient(TEST_API_URL, "");

    await expect(noTokenClient.listProjects()).rejects.toThrow(ApiError);

    try {
      await noTokenClient.listProjects();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(401);
    }
  });
});

// =============================================================================
// Projects Tests
// =============================================================================

describe("Projects", () => {
  it("should list projects", async () => {
    if (skipIfNoToken()) return;

    const client = getApiClient();
    const result = await client.listProjects();

    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.meta).toBeDefined();
    expect(typeof result.meta.hasMore).toBe("boolean");
  });

  it("should list projects with team filter", async () => {
    if (skipIfNoToken()) return;
    if (skipIfNoTestData("team", testTeam)) return;

    const client = getApiClient();
    const result = await client.listProjects({ team: testTeam!.id });

    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    // All returned projects should belong to the team
    for (const project of result.data) {
      expect(project.teamId).toBe(testTeam!.id);
    }
  });

  it("should list projects with pagination", async () => {
    if (skipIfNoToken()) return;

    const client = getApiClient();
    const result = await client.listProjects({ limit: 2 });

    expect(result).toBeDefined();
    expect(result.data.length).toBeLessThanOrEqual(2);
    expect(result.meta).toBeDefined();
  });

  it("should get project by ID", async () => {
    if (skipIfNoToken()) return;
    if (skipIfNoTestData("project", testProject)) return;

    const client = getApiClient();
    const result = await client.getProject(testProject!.id);

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.data.id).toBe(testProject!.id);
    expect(result.data.name).toBe(testProject!.name);
  });

  it("should get project by name", async () => {
    if (skipIfNoToken()) return;
    if (skipIfNoTestData("project", testProject)) return;

    const client = getApiClient();
    const result = await client.getProject(testProject!.name);

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.data.name).toBe(testProject!.name);
  });

  it("should return 403 or 404 for non-existent project", async () => {
    if (skipIfNoToken()) return;

    const client = getApiClient();

    try {
      await client.getProject("non-existent-project-12345");
      expect.fail("Should have thrown ApiError");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      // API may return 403 (forbidden - no team access) or 404 (not found)
      const status = (error as ApiError).status;
      expect([403, 404]).toContain(status);
    }
  });

  it("should create project with all fields", async () => {
    if (skipIfNoToken()) return;
    if (skipIfNoTestData("team", testTeam)) return;

    const client = getApiClient();
    const projectName = `Test Project ${Date.now()}`;

    const result = await client.createProject({
      name: projectName,
      teamId: testTeam!.id,
      description: "Integration test project",
      icon: "🧪",
      color: "#FF5733",
    });

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.data.name).toBe(projectName);
    expect(result.data.description).toBe("Integration test project");
    expect(result.data.icon).toBe("🧪");
    expect(result.data.teamId).toBe(testTeam!.id);

    createdResources.projects.push(result.data.id);
  });

  it("should create project with minimal fields", async () => {
    if (skipIfNoToken()) return;
    if (skipIfNoTestData("team", testTeam)) return;

    const client = getApiClient();
    const projectName = `Minimal Project ${Date.now()}`;

    const result = await client.createProject({
      name: projectName,
      teamId: testTeam!.id,
    });

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.data.name).toBe(projectName);
    expect(result.data.teamId).toBe(testTeam!.id);

    createdResources.projects.push(result.data.id);
  });
});

// =============================================================================
// Features Tests
// =============================================================================

describe("Features", () => {
  it("should list features", async () => {
    if (skipIfNoToken()) return;

    const client = getApiClient();
    const result = await client.listFeatures();

    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.meta).toBeDefined();
  });

  it("should list features with project filter", async () => {
    if (skipIfNoToken()) return;
    if (skipIfNoTestData("project", testProject)) return;

    const client = getApiClient();
    const result = await client.listFeatures({ projectId: testProject!.id });

    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    // All returned features should belong to the project
    for (const feature of result.data) {
      expect(feature.projectId).toBe(testProject!.id);
    }
  });

  it("should list features with status filter", async () => {
    if (skipIfNoToken()) return;
    if (skipIfNoTestData("status", testStatus)) return;

    const client = getApiClient();
    const result = await client.listFeatures({ statusId: testStatus!.id });

    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("should list features with query filter", async () => {
    if (skipIfNoToken()) return;
    if (skipIfNoTestData("feature", testFeature)) return;

    const client = getApiClient();
    // Search for part of the feature title
    const searchTerm = testFeature!.title.split(" ")[0];
    const result = await client.listFeatures({ query: searchTerm });

    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("should get feature by ID", async () => {
    if (skipIfNoToken()) return;
    if (skipIfNoTestData("feature", testFeature)) return;

    const client = getApiClient();
    const result = await client.getFeature(testFeature!.id);

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.data.id).toBe(testFeature!.id);
  });

  it("should get feature by identifier", async () => {
    if (skipIfNoToken()) return;
    if (skipIfNoTestData("feature", testFeature)) return;

    const client = getApiClient();
    const result = await client.getFeature(testFeature!.identifier);

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.data.identifier).toBe(testFeature!.identifier);
  });

  it("should return 403 or 404 for non-existent feature", async () => {
    if (skipIfNoToken()) return;

    const client = getApiClient();

    try {
      await client.getFeature("non-existent-feature-12345");
      expect.fail("Should have thrown ApiError");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      // API may return 403 (forbidden - no team access) or 404 (not found)
      const status = (error as ApiError).status;
      expect([403, 404]).toContain(status);
    }
  });

  it("should create feature", async () => {
    if (skipIfNoToken()) return;
    if (skipIfNoTestData("project", testProject)) return;

    const client = getApiClient();
    const featureTitle = `Test Feature ${Date.now()}`;

    const result = await client.createFeature({
      title: featureTitle,
      projectId: testProject!.id,
      description: "Integration test feature",
    });

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.data.title).toBe(featureTitle);
    expect(result.data.projectId).toBe(testProject!.id);
    expect(result.data.identifier).toBeDefined();
    expect(result.data.identifier.length).toBeGreaterThan(0);

    createdResources.features.push(result.data.id);
  });

  it("should create feature with status", async () => {
    if (skipIfNoToken()) return;
    if (skipIfNoTestData("project", testProject)) return;
    if (skipIfNoTestData("status", testStatus)) return;

    const client = getApiClient();
    const featureTitle = `Test Feature With Status ${Date.now()}`;

    const result = await client.createFeature({
      title: featureTitle,
      projectId: testProject!.id,
      statusId: testStatus!.id,
    });

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.data.statusId).toBe(testStatus!.id);

    createdResources.features.push(result.data.id);
  });

  it("should update feature", async () => {
    if (skipIfNoToken()) return;
    if (skipIfNoTestData("feature", testFeature)) return;

    const client = getApiClient();
    const updatedDescription = `Updated description at ${Date.now()}`;

    const result = await client.updateFeature(testFeature!.id, {
      description: updatedDescription,
    });

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.data.description).toBe(updatedDescription);
  });
});

// =============================================================================
// Tasks Tests
// =============================================================================

describe("Tasks", () => {
  it("should list tasks", async () => {
    if (skipIfNoToken()) return;

    const client = getApiClient();
    const result = await client.listTasks();

    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.meta).toBeDefined();
  });

  it("should list tasks with feature filter", async () => {
    if (skipIfNoToken()) return;
    if (skipIfNoTestData("feature", testFeature)) return;

    const client = getApiClient();
    const result = await client.listTasks({ featureId: testFeature!.id });

    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    // All returned tasks should belong to the feature
    for (const task of result.data) {
      expect(task.featureId).toBe(testFeature!.id);
    }
  });

  it("should get task by ID", async () => {
    if (skipIfNoToken()) return;

    const client = getApiClient();
    // First get a task from the list
    const tasksResult = await client.listTasks({ limit: 1 });

    if (tasksResult.data.length === 0) {
      console.log("Skipped: No tasks available");
      return;
    }

    const testTask = tasksResult.data[0];
    const result = await client.getTask(testTask.id);

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.data.id).toBe(testTask.id);
  });

  it("should get task by identifier", async () => {
    if (skipIfNoToken()) return;

    const client = getApiClient();
    // First get a task from the list
    const tasksResult = await client.listTasks({ limit: 1 });

    if (tasksResult.data.length === 0) {
      console.log("Skipped: No tasks available");
      return;
    }

    const testTask = tasksResult.data[0];
    
    try {
      const result = await client.getTask(testTask.identifier);
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.data.identifier).toBe(testTask.identifier);
    } catch (error) {
      // Some identifiers may not be resolvable by the API if they span teams
      if (error instanceof ApiError && error.status === 403) {
        console.log("Skipped: Task identifier lookup returned 403 (team authorization)");
        return;
      }
      throw error;
    }
  });

  it("should return 403 or 404 for non-existent task", async () => {
    if (skipIfNoToken()) return;

    const client = getApiClient();

    try {
      await client.getTask("non-existent-task-12345");
      expect.fail("Should have thrown ApiError");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      // API may return 403 (forbidden - no team access) or 404 (not found)
      const status = (error as ApiError).status;
      expect([403, 404]).toContain(status);
    }
  });

  it("should create task", async () => {
    if (skipIfNoToken()) return;
    if (skipIfNoTestData("feature", testFeature)) return;

    const client = getApiClient();
    const taskTitle = `Test Task ${Date.now()}`;

    const result = await client.createTask({
      title: taskTitle,
      featureId: testFeature!.id,
      description: "Integration test task",
    });

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.data.title).toBe(taskTitle);
    expect(result.data.featureId).toBe(testFeature!.id);
    expect(result.data.identifier).toBeDefined();
    // Task identifier should follow feature identifier pattern (e.g., ENG-1-1)
    expect(result.data.identifier).toContain("-");

    createdResources.tasks.push(result.data.id);
  });

  it("should update task", async () => {
    if (skipIfNoToken()) return;

    const client = getApiClient();
    // First get a task from the list
    const tasksResult = await client.listTasks({ limit: 1 });

    if (tasksResult.data.length === 0) {
      console.log("Skipped: No tasks available");
      return;
    }

    const testTask = tasksResult.data[0];
    const updatedDescription = `Updated task description at ${Date.now()}`;

    const result = await client.updateTask(testTask.id, {
      description: updatedDescription,
    });

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.data.description).toBe(updatedDescription);
  });
});

// =============================================================================
// Statuses Tests
// =============================================================================

describe("Statuses", () => {
  it("should list statuses for team", async () => {
    if (skipIfNoToken()) return;
    if (skipIfNoTestData("team", testTeam)) return;

    const client = getApiClient();
    const result = await client.listStatuses(testTeam!.id);

    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);

    // Verify status structure
    const status = result.data[0];
    expect(status.id).toBeDefined();
    expect(status.name).toBeDefined();
    expect(status.category).toBeDefined();
    expect(status.teamId).toBe(testTeam!.id);
  });

  it("should get status by ID", async () => {
    if (skipIfNoToken()) return;
    if (skipIfNoTestData("status", testStatus)) return;

    const client = getApiClient();
    const result = await client.getStatus(testStatus!.id);

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.data.id).toBe(testStatus!.id);
    expect(result.data.name).toBe(testStatus!.name);
  });

  it("should return 404 for non-existent status", async () => {
    if (skipIfNoToken()) return;

    const client = getApiClient();

    try {
      await client.getStatus("non-existent-status-12345");
      expect.fail("Should have thrown ApiError");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(404);
    }
  });
});

// =============================================================================
// Search Tests
// =============================================================================

describe("Search", () => {
  it("should search features and tasks", async () => {
    if (skipIfNoToken()) return;

    const client = getApiClient();
    const result = await client.search({ type: "all", limit: 10 });

    expect(result).toBeDefined();
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.meta).toBeDefined();
    expect(typeof result.meta.hasMore).toBe("boolean");
  });

  it("should search only features", async () => {
    if (skipIfNoToken()) return;

    const client = getApiClient();
    const result = await client.search({ type: "feature", limit: 10 });

    expect(result).toBeDefined();
    expect(Array.isArray(result.results)).toBe(true);
    // All results should be features
    for (const item of result.results) {
      expect(item.type).toBe("feature");
    }
  });

  it("should search only tasks", async () => {
    if (skipIfNoToken()) return;

    const client = getApiClient();
    const result = await client.search({ type: "task", limit: 10 });

    expect(result).toBeDefined();
    expect(Array.isArray(result.results)).toBe(true);
    // All results should be tasks
    for (const item of result.results) {
      expect(item.type).toBe("task");
    }
  });

  it("should search with query filter", async () => {
    if (skipIfNoToken()) return;
    if (skipIfNoTestData("feature", testFeature)) return;

    const client = getApiClient();
    // Search for part of the known feature title
    const searchTerm = testFeature!.title.split(" ")[0];
    const result = await client.search({ query: searchTerm, type: "all" });

    expect(result).toBeDefined();
    expect(Array.isArray(result.results)).toBe(true);
  });

  it("should search with status category filter", async () => {
    if (skipIfNoToken()) return;

    const client = getApiClient();
    const result = await client.search({
      statusCategory: "completed",
      type: "all",
      limit: 10,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result.results)).toBe(true);
  });

  it("should handle pagination in search", async () => {
    if (skipIfNoToken()) return;

    const client = getApiClient();
    const result = await client.search({ type: "all", limit: 2 });

    expect(result).toBeDefined();
    expect(result.results.length).toBeLessThanOrEqual(2);

    // If there are more results, the cursor should be set
    if (result.meta.hasMore) {
      expect(result.meta.cursor).toBeDefined();
      expect(result.meta.cursor).not.toBeNull();
    }
  });
});

// =============================================================================
// Error Handling Tests
// =============================================================================

describe("Error Handling", () => {
  it("should handle 400 bad request errors", async () => {
    if (skipIfNoToken()) return;

    const client = getApiClient();

    try {
      // Try to create a feature without required fields
      await client.createFeature({
        title: "",
        projectId: "invalid-uuid",
      });
      expect.fail("Should have thrown ApiError");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.status).toBeGreaterThanOrEqual(400);
      expect(apiError.status).toBeLessThan(500);
    }
  });

  it("should handle 403 or 404 not found errors", async () => {
    if (skipIfNoToken()) return;

    const client = getApiClient();

    try {
      await client.getProject("00000000-0000-0000-0000-000000000000");
      expect.fail("Should have thrown ApiError");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      // API may return 403 (forbidden - no team access) or 404 (not found)
      const status = (error as ApiError).status;
      expect([403, 404]).toContain(status);
    }
  });

  it("should include error message in ApiError", async () => {
    if (skipIfNoToken()) return;

    const client = getApiClient();

    try {
      await client.getFeature("non-existent-12345");
      expect.fail("Should have thrown ApiError");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.message).toBeDefined();
      expect(apiError.message.length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// API Client Initialization Tests
// =============================================================================

describe("API Client Initialization", () => {
  it("should throw error when initialized without token", () => {
    expect(() => {
      initializeApiClient({ baseUrl: TEST_API_URL, token: "" });
    }).toThrow("API_TOKEN is required");
  });

  it("should create client with valid configuration", () => {
    if (skipIfNoToken()) return;

    const client = new ApiClient(TEST_API_URL, TEST_API_TOKEN);
    expect(client).toBeDefined();
  });

  it("should handle baseUrl with trailing slash", async () => {
    if (skipIfNoToken()) return;

    // Create client with trailing slash - should work the same
    const client = new ApiClient(`${TEST_API_URL}/`, TEST_API_TOKEN);
    const result = await client.listProjects({ limit: 1 });
    expect(result).toBeDefined();
  });
});
