/**
 * Integration Tests for Features API Endpoints
 *
 * Tests CRUD operations for features with team-scoped authorization.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../helpers/app.js";
import {
  createTestEpic,
  createTestFeature,
  createTestStatus,
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
      const epic = await createTestEpic(team.id, { name: "Test Epic" });
      await createTestFeature(epic.id, { title: "Feature 1" });
      await createTestFeature(epic.id, { title: "Feature 2" });

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

    it("should filter features by epicId", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const epic1 = await createTestEpic(team.id, { name: "Epic 1" });
      const epic2 = await createTestEpic(team.id, { name: "Epic 2" });
      await createTestFeature(epic1.id, { title: "Feature in P1" });
      await createTestFeature(epic2.id, { title: "Feature in P2" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/features?epicId=${epic1.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.every((f: { epicId: string }) => f.epicId === epic1.id)).toBe(true);
    });

    it("should filter features by statusId", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Test Epic" });
      const status = await createTestStatus(team.id, { name: "In Progress", category: "started" });
      await createTestFeature(epic.id, { title: "Feature with Status", statusId: status.id });
      await createTestFeature(epic.id, { title: "Feature without Status" });

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
      const epic = await createTestEpic(team.id, { name: "Test Epic" });
      await createTestFeature(epic.id, { title: "Login Feature" });
      await createTestFeature(epic.id, { title: "Dashboard Feature" });

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
      const epic = await createTestEpic(team.id, { name: "Test Epic" });
      const feature = await createTestFeature(epic.id, { title: "Test Feature" });

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
      const epic = await createTestEpic(team.id, { name: "Guest Epic" });
      const feature = await createTestFeature(epic.id, { title: "Guest Feature" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/features/${feature.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(feature.id);
    });

  });

  describe("POST /api/v1/features", () => {
    it("should create feature for team member with auto-generated identifier", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Test Epic" });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/features",
        headers,
        payload: {
          title: "New Feature",
          epicId: epic.id,
          description: "A new feature description",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.title).toBe("New Feature");
      expect(body.data.epicId).toBe(epic.id);
      expect(body.data.description).toBe("A new feature description");
      expect(body.data.identifier).toBeDefined();
    });

    it("should create feature with status", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Test Epic" });
      const status = await createTestStatus(team.id, { name: "To Do", category: "unstarted" });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/features",
        headers,
        payload: {
          title: "Feature with Status",
          epicId: epic.id,
          statusId: status.id,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.statusId).toBe(status.id);
    });

    it("should create feature with assignee", async () => {
      const { team, headers, user } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Test Epic" });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/features",
        headers,
        payload: {
          title: "Assigned Feature",
          epicId: epic.id,
          assigneeId: user.id,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.assigneeId).toBe(user.id);
    });

  });

  describe("PUT /api/v1/features/:id", () => {
    it("should update feature for team member", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Test Epic" });
      const feature = await createTestFeature(epic.id, { title: "Original Title" });

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
      const epic = await createTestEpic(team.id, { name: "Test Epic" });
      const status = await createTestStatus(team.id, { name: "In Progress", category: "started" });
      const feature = await createTestFeature(epic.id, { title: "Feature" });

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

  });

  describe("DELETE /api/v1/features/:id", () => {
    it("should delete feature for admin", async () => {
      const { team, headers } = await createAuthenticatedAdmin();
      const epic = await createTestEpic(team.id, { name: "Test Epic" });
      const feature = await createTestFeature(epic.id, { title: "To Delete" });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/features/${feature.id}`,
        headers,
      });

      expect(response.statusCode).toBe(204);
    });

  });

  describe("PUT /api/v1/features/bulk-update", () => {
    it("should bulk update feature statuses", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Test Epic" });
      const status = await createTestStatus(team.id, { name: "Done", category: "completed" });
      const feature1 = await createTestFeature(epic.id, { title: "Feature 1" });
      const feature2 = await createTestFeature(epic.id, { title: "Feature 2" });

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
