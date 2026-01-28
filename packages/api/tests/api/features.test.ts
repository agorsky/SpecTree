/**
 * Integration Tests for Features API Endpoints
 *
 * Tests CRUD operations for features with team-scoped authorization.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../helpers/app.js";
import {
  createTestProject,
  createTestFeature,
  createTestStatus,
  createAuthenticatedUser,
  createAuthenticatedTeamMember,
  createAuthenticatedAdmin,
  createAuthenticatedGuest,
  cleanupTestDatabase,
  disconnectTestDatabase,
} from "../fixtures/index.js";

describe("Features API", () => {
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

  describe("GET /api/v1/features", () => {
    it("should list features for authenticated user", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });
      await createTestFeature(project.id, { title: "Feature 1" });
      await createTestFeature(project.id, { title: "Feature 2" });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/features",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("should filter features by projectId", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project1 = await createTestProject(team.id, { name: "Project 1" });
      const project2 = await createTestProject(team.id, { name: "Project 2" });
      await createTestFeature(project1.id, { title: "Feature in P1" });
      await createTestFeature(project2.id, { title: "Feature in P2" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/features?projectId=${project1.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.every((f: { projectId: string }) => f.projectId === project1.id)).toBe(true);
    });

    it("should filter features by statusId", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });
      const status = await createTestStatus(team.id, { name: "In Progress", category: "started" });
      await createTestFeature(project.id, { title: "Feature with Status", statusId: status.id });
      await createTestFeature(project.id, { title: "Feature without Status" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/features?statusId=${status.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.every((f: { statusId: string }) => f.statusId === status.id)).toBe(true);
    });

    it("should support text query search", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });
      await createTestFeature(project.id, { title: "Login Feature" });
      await createTestFeature(project.id, { title: "Dashboard Feature" });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/features?query=Login",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.some((f: { title: string }) => f.title.includes("Login"))).toBe(true);
    });

    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/features",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/features/:id", () => {
    it("should get feature by ID for team member", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });
      const feature = await createTestFeature(project.id, { title: "Test Feature" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/features/${feature.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(feature.id);
      expect(body.data.title).toBe("Test Feature");
    });

    it("should allow guest to read feature", async () => {
      const { team, headers } = await createAuthenticatedGuest();
      const project = await createTestProject(team.id, { name: "Guest Project" });
      const feature = await createTestFeature(project.id, { title: "Guest Feature" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/features/${feature.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(feature.id);
    });

    it("should return 403 for non-team-member", async () => {
      const { team } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Protected Project" });
      const feature = await createTestFeature(project.id, { title: "Protected Feature" });
      const { headers: otherHeaders } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/features/${feature.id}`,
        headers: otherHeaders,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/v1/features", () => {
    it("should create feature for team member with auto-generated identifier", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/features",
        headers,
        payload: {
          title: "New Feature",
          projectId: project.id,
          description: "A new feature description",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.title).toBe("New Feature");
      expect(body.data.projectId).toBe(project.id);
      expect(body.data.description).toBe("A new feature description");
      expect(body.data.identifier).toBeDefined();
    });

    it("should create feature with status", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });
      const status = await createTestStatus(team.id, { name: "To Do", category: "unstarted" });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/features",
        headers,
        payload: {
          title: "Feature with Status",
          projectId: project.id,
          statusId: status.id,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.statusId).toBe(status.id);
    });

    it("should create feature with assignee", async () => {
      const { team, headers, user } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/features",
        headers,
        payload: {
          title: "Assigned Feature",
          projectId: project.id,
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

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/features",
        headers,
        payload: {
          title: "Guest Feature",
          projectId: project.id,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 for non-team-member", async () => {
      const { team } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Protected Project" });
      const { headers: otherHeaders } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/features",
        headers: otherHeaders,
        payload: {
          title: "Unauthorized Feature",
          projectId: project.id,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("PUT /api/v1/features/:id", () => {
    it("should update feature for team member", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });
      const feature = await createTestFeature(project.id, { title: "Original Title" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/features/${feature.id}`,
        headers,
        payload: {
          title: "Updated Title",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.title).toBe("Updated Title");
    });

    it("should update feature status", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });
      const status = await createTestStatus(team.id, { name: "In Progress", category: "started" });
      const feature = await createTestFeature(project.id, { title: "Feature" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/features/${feature.id}`,
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

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/features/${feature.id}`,
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
      const { headers: otherHeaders } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/features/${feature.id}`,
        headers: otherHeaders,
        payload: {
          title: "Hacked Title",
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("DELETE /api/v1/features/:id", () => {
    it("should delete feature for admin", async () => {
      const { team, headers } = await createAuthenticatedAdmin();
      const project = await createTestProject(team.id, { name: "Test Project" });
      const feature = await createTestFeature(project.id, { title: "To Delete" });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/features/${feature.id}`,
        headers,
      });

      expect(response.statusCode).toBe(204);
    });

    it("should return 403 for member trying to delete", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });
      const feature = await createTestFeature(project.id, { title: "Member Feature" });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/features/${feature.id}`,
        headers,
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 for guest trying to delete", async () => {
      const { team, headers } = await createAuthenticatedGuest();
      const project = await createTestProject(team.id, { name: "Guest Project" });
      const feature = await createTestFeature(project.id, { title: "Guest Feature" });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/features/${feature.id}`,
        headers,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("PUT /api/v1/features/bulk-update", () => {
    it("should bulk update feature statuses", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });
      const status = await createTestStatus(team.id, { name: "Done", category: "completed" });
      const feature1 = await createTestFeature(project.id, { title: "Feature 1" });
      const feature2 = await createTestFeature(project.id, { title: "Feature 2" });

      const response = await app.inject({
        method: "PUT",
        url: "/api/v1/features/bulk-update",
        headers,
        payload: {
          ids: [feature1.id, feature2.id],
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
        url: "/api/v1/features/bulk-update",
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
