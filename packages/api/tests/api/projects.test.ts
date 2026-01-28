/**
 * Integration Tests for Projects API Endpoints
 *
 * Tests CRUD operations for projects with team-scoped authorization.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../helpers/app.js";
import {
  createTestProject,
  createAuthenticatedUser,
  createAuthenticatedTeamMember,
  createAuthenticatedAdmin,
  createAuthenticatedGuest,
  cleanupTestDatabase,
  disconnectTestDatabase,
} from "../fixtures/index.js";

describe("Projects API", () => {
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

  describe("GET /api/v1/projects", () => {
    it("should list all projects for authenticated user", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      await createTestProject(team.id, { name: "Project 1" });
      await createTestProject(team.id, { name: "Project 2" });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/projects",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("should filter projects by teamId", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      await createTestProject(team.id, { name: "Team Project" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/projects?teamId=${team.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.data.every((p: { teamId: string }) => p.teamId === team.id)).toBe(true);
    });

    it("should support cursor-based pagination", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      await createTestProject(team.id, { name: "Project A" });
      await createTestProject(team.id, { name: "Project B" });
      await createTestProject(team.id, { name: "Project C" });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/projects?limit=2",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.length).toBeLessThanOrEqual(2);
    });

    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/projects",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/projects/:id", () => {
    it("should get project by ID for team member", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Test Project" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/projects/${project.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(project.id);
      expect(body.data.name).toBe("Test Project");
    });

    it("should allow guest to read project", async () => {
      const { team, headers } = await createAuthenticatedGuest();
      const project = await createTestProject(team.id, { name: "Guest Project" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/projects/${project.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(project.id);
    });

    it("should return 403 for non-team-member", async () => {
      const { team } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Restricted Project" });
      const { headers: otherHeaders } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/projects/${project.id}`,
        headers: otherHeaders,
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 for non-existent project", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/projects/00000000-0000-0000-0000-000000000000",
        headers,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/v1/projects", () => {
    it("should create project for team member", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/projects",
        headers,
        payload: {
          name: "New Project",
          teamId: team.id,
          description: "A new project description",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe("New Project");
      expect(body.data.teamId).toBe(team.id);
      expect(body.data.description).toBe("A new project description");
    });

    it("should create project with optional styling", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/projects",
        headers,
        payload: {
          name: "Styled Project",
          teamId: team.id,
          icon: "star",
          color: "#00FF00",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.icon).toBe("star");
      expect(body.data.color).toBe("#00FF00");
    });

    it("should return 403 for guest trying to create", async () => {
      const { team, headers } = await createAuthenticatedGuest();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/projects",
        headers,
        payload: {
          name: "Guest Project",
          teamId: team.id,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 for non-team-member", async () => {
      const { team } = await createAuthenticatedTeamMember();
      const { headers: otherHeaders } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/projects",
        headers: otherHeaders,
        payload: {
          name: "Unauthorized Project",
          teamId: team.id,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("PUT /api/v1/projects/:id", () => {
    it("should update project for team member", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Original Name" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/projects/${project.id}`,
        headers,
        payload: {
          name: "Updated Name",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe("Updated Name");
    });

    it("should update multiple fields", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Original" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/projects/${project.id}`,
        headers,
        payload: {
          name: "Updated",
          description: "New description",
          icon: "folder",
          color: "#0000FF",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe("Updated");
      expect(body.data.description).toBe("New description");
      expect(body.data.icon).toBe("folder");
      expect(body.data.color).toBe("#0000FF");
    });

    it("should return 403 for guest trying to update", async () => {
      const { team, headers } = await createAuthenticatedGuest();
      const project = await createTestProject(team.id, { name: "Guest Project" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/projects/${project.id}`,
        headers,
        payload: {
          name: "Guest Update",
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 for non-team-member", async () => {
      const { team } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Protected Project" });
      const { headers: otherHeaders } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/projects/${project.id}`,
        headers: otherHeaders,
        payload: {
          name: "Hacked Name",
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("DELETE /api/v1/projects/:id", () => {
    it("should archive project for admin", async () => {
      const { team, headers } = await createAuthenticatedAdmin();
      const project = await createTestProject(team.id, { name: "To Delete" });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/projects/${project.id}`,
        headers,
      });

      expect(response.statusCode).toBe(204);
    });

    it("should return 403 for member trying to delete", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Member Project" });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/projects/${project.id}`,
        headers,
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 for guest trying to delete", async () => {
      const { team, headers } = await createAuthenticatedGuest();
      const project = await createTestProject(team.id, { name: "Guest Project" });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/projects/${project.id}`,
        headers,
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 for non-team-member", async () => {
      const { team } = await createAuthenticatedTeamMember();
      const project = await createTestProject(team.id, { name: "Other Team Project" });
      const { headers: otherHeaders } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/projects/${project.id}`,
        headers: otherHeaders,
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
