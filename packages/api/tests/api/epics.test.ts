/**
 * Integration Tests for Epics API Endpoints
 *
 * Tests CRUD operations for epics with team-scoped authorization.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../helpers/app.js";
import {
  createTestEpic,
  createAuthenticatedUser,
  createAuthenticatedTeamMember,
  createAuthenticatedAdmin,
  createAuthenticatedGuest,
  cleanupTestDatabase,
  disconnectTestDatabase,
} from "../fixtures/index.js";

describe("Epics API", () => {
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

  describe("GET /api/v1/epics", () => {
    it("should list all epics for authenticated user", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      await createTestEpic(team.id, { name: "Epic 1" });
      await createTestEpic(team.id, { name: "Epic 2" });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/epics",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("should filter epics by teamId", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      await createTestEpic(team.id, { name: "Team Epic" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/epics?teamId=${team.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.data.every((p: { teamId: string }) => p.teamId === team.id)).toBe(true);
    });

    it("should support cursor-based pagination", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      await createTestEpic(team.id, { name: "Epic A" });
      await createTestEpic(team.id, { name: "Epic B" });
      await createTestEpic(team.id, { name: "Epic C" });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/epics?limit=2",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.length).toBeLessThanOrEqual(2);
    });

    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/epics",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/epics/:id", () => {
    it("should get epic by ID for team member", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Test Epic" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/epics/${epic.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(epic.id);
      expect(body.data.name).toBe("Test Epic");
    });

    it("should allow guest to read epic", async () => {
      const { team, headers } = await createAuthenticatedGuest();
      const epic = await createTestEpic(team.id, { name: "Guest Epic" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/epics/${epic.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(epic.id);
    });

    it("should return 403 for non-team-member", async () => {
      const { team } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Restricted Epic" });
      const { headers: otherHeaders } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/epics/${epic.id}`,
        headers: otherHeaders,
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 for non-existent epic", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/epics/00000000-0000-0000-0000-000000000000",
        headers,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/v1/epics", () => {
    it("should create epic for team member", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/epics",
        headers,
        payload: {
          name: "New Epic",
          teamId: team.id,
          description: "A new epic description",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe("New Epic");
      expect(body.data.teamId).toBe(team.id);
      expect(body.data.description).toBe("A new epic description");
    });

    it("should create epic with optional styling", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/epics",
        headers,
        payload: {
          name: "Styled Epic",
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
        url: "/api/v1/epics",
        headers,
        payload: {
          name: "Guest Epic",
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
        url: "/api/v1/epics",
        headers: otherHeaders,
        payload: {
          name: "Unauthorized Epic",
          teamId: team.id,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("PUT /api/v1/epics/:id", () => {
    it("should update epic for team member", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Original Name" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/epics/${epic.id}`,
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
      const epic = await createTestEpic(team.id, { name: "Original" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/epics/${epic.id}`,
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
      const epic = await createTestEpic(team.id, { name: "Guest Epic" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/epics/${epic.id}`,
        headers,
        payload: {
          name: "Guest Update",
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 for non-team-member", async () => {
      const { team } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Protected Epic" });
      const { headers: otherHeaders } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/epics/${epic.id}`,
        headers: otherHeaders,
        payload: {
          name: "Hacked Name",
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("DELETE /api/v1/epics/:id", () => {
    it("should archive epic for admin", async () => {
      const { team, headers } = await createAuthenticatedAdmin();
      const epic = await createTestEpic(team.id, { name: "To Delete" });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/epics/${epic.id}`,
        headers,
      });

      expect(response.statusCode).toBe(204);
    });

    it("should allow member to delete project", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Member Epic" });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/epics/${epic.id}`,
        headers,
      });

      expect(response.statusCode).toBe(204);
    });

    it("should return 403 for guest trying to delete", async () => {
      const { team, headers } = await createAuthenticatedGuest();
      const epic = await createTestEpic(team.id, { name: "Guest Epic" });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/epics/${epic.id}`,
        headers,
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 for non-team-member", async () => {
      const { team } = await createAuthenticatedTeamMember();
      const epic = await createTestEpic(team.id, { name: "Other Team Epic" });
      const { headers: otherHeaders } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/epics/${epic.id}`,
        headers: otherHeaders,
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
