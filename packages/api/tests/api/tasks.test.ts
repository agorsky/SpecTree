/**
 * Integration Tests for Tasks API Endpoints
 *
 * Tests CRUD operations for tasks with team-scoped authorization.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../helpers/app.js";
import {
  createTestProject,
  createTestFeature,
  createTestTask,
  createTestStatus,
  createAuthenticatedUser,
  createAuthenticatedTeamMember,
  createAuthenticatedAdmin,
  createAuthenticatedGuest,
  cleanupTestDatabase,
  disconnectTestDatabase,
} from "../fixtures/index.js";

describe("Tasks API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  afterAll(async () => {
    await app.close();
    await disconnectTestDatabase();
  });

  describe("GET /api/v1/tasks", () => {
    it("should list tasks for authenticated user", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });
      const feature = await createTestFeature(project.id, { title: "Test Feature" });
      await createTestTask(feature.id, { title: "Task 1" });
      await createTestTask(feature.id, { title: "Task 2" });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/tasks",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("should filter tasks by featureId", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });
      const feature1 = await createTestFeature(project.id, { title: "Feature 1" });
      const feature2 = await createTestFeature(project.id, { title: "Feature 2" });
      await createTestTask(feature1.id, { title: "Task in F1" });
      await createTestTask(feature2.id, { title: "Task in F2" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/tasks?featureId=${feature1.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.every((t: { featureId: string }) => t.featureId === feature1.id)).toBe(true);
    });

    it("should filter tasks by statusId", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });
      const feature = await createTestFeature(project.id, { title: "Test Feature" });
      const status = await createTestStatus(team.id, { name: "In Progress", category: "started" });
      await createTestTask(feature.id, { title: "Task with Status", statusId: status.id });
      await createTestTask(feature.id, { title: "Task without Status" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/tasks?statusId=${status.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.every((t: { statusId: string }) => t.statusId === status.id)).toBe(true);
    });

    it("should support text query search", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });
      const feature = await createTestFeature(project.id, { title: "Test Feature" });
      await createTestTask(feature.id, { title: "Implement Login" });
      await createTestTask(feature.id, { title: "Write Tests" });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/tasks?query=Login",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.some((t: { title: string }) => t.title.includes("Login"))).toBe(true);
    });

    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/tasks",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/tasks/:id", () => {
    it("should get task by ID for team member", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });
      const feature = await createTestFeature(project.id, { title: "Test Feature" });
      const task = await createTestTask(feature.id, { title: "Test Task" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/tasks/${task.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(task.id);
      expect(body.data.title).toBe("Test Task");
    });

    it("should allow guest to read task", async () => {
      const { team, headers } = await createAuthenticatedGuest();
      const project = await createTestProject(team.id, { name: "Guest Project" });
      const feature = await createTestFeature(project.id, { title: "Guest Feature" });
      const task = await createTestTask(feature.id, { title: "Guest Task" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/tasks/${task.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(task.id);
    });

    it("should return 403 for non-team-member", async () => {
      const { team } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Protected Project" });
      const feature = await createTestFeature(project.id, { title: "Protected Feature" });
      const task = await createTestTask(feature.id, { title: "Protected Task" });
      const { headers: otherHeaders } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/tasks/${task.id}`,
        headers: otherHeaders,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/v1/tasks", () => {
    it("should create task for team member with auto-generated identifier", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });
      const feature = await createTestFeature(project.id, { title: "Test Feature" });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/tasks",
        headers,
        payload: {
          title: "New Task",
          featureId: feature.id,
          description: "A new task description",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.title).toBe("New Task");
      expect(body.data.featureId).toBe(feature.id);
      expect(body.data.description).toBe("A new task description");
      expect(body.data.identifier).toBeDefined();
    });

    it("should create task with status", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });
      const feature = await createTestFeature(project.id, { title: "Test Feature" });
      const status = await createTestStatus(team.id, { name: "To Do", category: "unstarted" });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/tasks",
        headers,
        payload: {
          title: "Task with Status",
          featureId: feature.id,
          statusId: status.id,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.statusId).toBe(status.id);
    });

    it("should create task with assignee", async () => {
      const { team, headers, user } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });
      const feature = await createTestFeature(project.id, { title: "Test Feature" });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/tasks",
        headers,
        payload: {
          title: "Assigned Task",
          featureId: feature.id,
          assigneeId: user.id,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.assigneeId).toBe(user.id);
    });

    it("should return 403 for guest trying to create", async () => {
      const { team, headers } = await createAuthenticatedGuest();
      const project = await createTestProject(team.id, { name: "Guest Project" });
      const feature = await createTestFeature(project.id, { title: "Guest Feature" });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/tasks",
        headers,
        payload: {
          title: "Guest Task",
          featureId: feature.id,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 for non-team-member", async () => {
      const { team } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Protected Project" });
      const feature = await createTestFeature(project.id, { title: "Protected Feature" });
      const { headers: otherHeaders } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/tasks",
        headers: otherHeaders,
        payload: {
          title: "Unauthorized Task",
          featureId: feature.id,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("PUT /api/v1/tasks/:id", () => {
    it("should update task for team member", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });
      const feature = await createTestFeature(project.id, { title: "Test Feature" });
      const task = await createTestTask(feature.id, { title: "Original Title" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/tasks/${task.id}`,
        headers,
        payload: {
          title: "Updated Title",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.title).toBe("Updated Title");
    });

    it("should update task status", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });
      const feature = await createTestFeature(project.id, { title: "Test Feature" });
      const status = await createTestStatus(team.id, { name: "In Progress", category: "started" });
      const task = await createTestTask(feature.id, { title: "Task" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/tasks/${task.id}`,
        headers,
        payload: {
          statusId: status.id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.statusId).toBe(status.id);
    });

    it("should return 403 for guest trying to update", async () => {
      const { team, headers } = await createAuthenticatedGuest();
      const project = await createTestProject(team.id, { name: "Guest Project" });
      const feature = await createTestFeature(project.id, { title: "Guest Feature" });
      const task = await createTestTask(feature.id, { title: "Guest Task" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/tasks/${task.id}`,
        headers,
        payload: {
          title: "Guest Update",
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 for non-team-member", async () => {
      const { team } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Protected Project" });
      const feature = await createTestFeature(project.id, { title: "Protected Feature" });
      const task = await createTestTask(feature.id, { title: "Protected Task" });
      const { headers: otherHeaders } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/tasks/${task.id}`,
        headers: otherHeaders,
        payload: {
          title: "Hacked Title",
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("DELETE /api/v1/tasks/:id", () => {
    it("should delete task for admin", async () => {
      const { team, headers } = await createAuthenticatedAdmin();
      const project = await createTestProject(team.id, { name: "Test Project" });
      const feature = await createTestFeature(project.id, { title: "Test Feature" });
      const task = await createTestTask(feature.id, { title: "To Delete" });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/tasks/${task.id}`,
        headers,
      });

      expect(response.statusCode).toBe(204);
    });

    it("should return 403 for member trying to delete", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });
      const feature = await createTestFeature(project.id, { title: "Test Feature" });
      const task = await createTestTask(feature.id, { title: "Member Task" });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/tasks/${task.id}`,
        headers,
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 for guest trying to delete", async () => {
      const { team, headers } = await createAuthenticatedGuest();
      const project = await createTestProject(team.id, { name: "Guest Project" });
      const feature = await createTestFeature(project.id, { title: "Guest Feature" });
      const task = await createTestTask(feature.id, { title: "Guest Task" });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/tasks/${task.id}`,
        headers,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("GET /api/v1/features/:featureId/tasks", () => {
    it("should list tasks for a specific feature", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });
      const feature = await createTestFeature(project.id, { title: "Test Feature" });
      await createTestTask(feature.id, { title: "Task 1" });
      await createTestTask(feature.id, { title: "Task 2" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/features/${feature.id}/tasks`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.every((t: { featureId: string }) => t.featureId === feature.id)).toBe(true);
    });

    it("should allow guest to read feature tasks", async () => {
      const { team, headers } = await createAuthenticatedGuest();
      const project = await createTestProject(team.id, { name: "Guest Project" });
      const feature = await createTestFeature(project.id, { title: "Guest Feature" });
      await createTestTask(feature.id, { title: "Guest Task" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/features/${feature.id}/tasks`,
        headers,
      });

      expect(response.statusCode).toBe(200);
    });

    it("should return 403 for non-team-member", async () => {
      const { team } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Protected Project" });
      const feature = await createTestFeature(project.id, { title: "Protected Feature" });
      const { headers: otherHeaders } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/features/${feature.id}/tasks`,
        headers: otherHeaders,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("PUT /api/v1/tasks/bulk-update", () => {
    it("should bulk update task statuses", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });
      const feature = await createTestFeature(project.id, { title: "Test Feature" });
      const status = await createTestStatus(team.id, { name: "Done", category: "completed" });
      const task1 = await createTestTask(feature.id, { title: "Task 1" });
      const task2 = await createTestTask(feature.id, { title: "Task 2" });

      const response = await app.inject({
        method: "PUT",
        url: "/api/v1/tasks/bulk-update",
        headers,
        payload: {
          ids: [task1.id, task2.id],
          statusId: status.id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.updated).toBe(2);
    });

    it("should return 400 for empty ids array", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const status = await createTestStatus(team.id, { name: "Done", category: "completed" });

      const response = await app.inject({
        method: "PUT",
        url: "/api/v1/tasks/bulk-update",
        headers,
        payload: {
          ids: [],
          statusId: status.id,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
