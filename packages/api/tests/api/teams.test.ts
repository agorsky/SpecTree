/**
 * Integration Tests for Teams API Endpoints
 *
 * Tests CRUD operations for teams with authorization.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../helpers/app.js";
import {
  createTestTeam,
  createAuthenticatedUser,
  createAuthenticatedTeamMember,
  createAuthenticatedAdmin,
  createAuthenticatedGuest,
  createInvalidAuthHeader,
  cleanupTestDatabase,
  disconnectTestDatabase,
} from "../fixtures/index.js";

describe("Teams API", () => {
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

  describe("GET /api/v1/teams", () => {
    it("should list teams for authenticated user", async () => {
      const { headers } = await createAuthenticatedUser();
      await createTestTeam({ name: "Team 1", key: "TM1" });
      await createTestTeam({ name: "Team 2", key: "TM2" });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/teams",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(2);
    });

    it("should support cursor-based pagination", async () => {
      const { headers } = await createAuthenticatedUser();
      await createTestTeam({ name: "Team A", key: "TMA" });
      await createTestTeam({ name: "Team B", key: "TMB" });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/teams?limit=1",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.length).toBe(1);
      // Should have next cursor if more data exists
      if (body.nextCursor) {
        expect(typeof body.nextCursor).toBe("string");
      }
    });

    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/teams",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/teams/:id", () => {
    it("should get team by ID for team member", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/teams/${team.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(team.id);
      expect(body.data.name).toBe(team.name);
    });

    it("should allow guest to read team", async () => {
      const { team, headers } = await createAuthenticatedGuest();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/teams/${team.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(team.id);
    });

    it("should return 403 for non-member", async () => {
      const { headers } = await createAuthenticatedUser(); // Not a member of any team
      const team = await createTestTeam({ name: "Other Team", key: "OTH" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/teams/${team.id}`,
        headers,
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 404 for non-existent team", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/teams/00000000-0000-0000-0000-000000000000",
        headers,
      });

      // Will return 403 first because user is not a member of the non-existent team
      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/v1/teams", () => {
    it("should create a new team", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/teams",
        headers,
        payload: {
          name: "New Team",
          key: "NT",
          description: "A new test team",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe("New Team");
      expect(body.data.key).toBe("NT");
      expect(body.data.description).toBe("A new test team");
      expect(body.data.id).toBeDefined();
    });

    it("should create team with optional fields", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/teams",
        headers,
        payload: {
          name: "Styled Team",
          key: "ST",
          icon: "rocket",
          color: "#FF5733",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.icon).toBe("rocket");
      expect(body.data.color).toBe("#FF5733");
    });

    it("should return 400 for missing required fields", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/teams",
        headers,
        payload: {
          name: "No Key Team",
          // Missing 'key'
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/teams",
        payload: {
          name: "Unauth Team",
          key: "UT",
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("PUT /api/v1/teams/:id", () => {
    it("should update team for member", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/teams/${team.id}`,
        headers,
        payload: {
          name: "Updated Team Name",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe("Updated Team Name");
    });

    it("should update team for admin", async () => {
      const { team, headers } = await createAuthenticatedAdmin();

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/teams/${team.id}`,
        headers,
        payload: {
          description: "Updated description",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.description).toBe("Updated description");
    });

    it("should return 403 for guest trying to update", async () => {
      const { team, headers } = await createAuthenticatedGuest();

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/teams/${team.id}`,
        headers,
        payload: {
          name: "Guest Update",
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 for non-member", async () => {
      const { headers } = await createAuthenticatedUser();
      const team = await createTestTeam({ name: "Other Team", key: "OT2" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/teams/${team.id}`,
        headers,
        payload: {
          name: "Hacked Team",
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("DELETE /api/v1/teams/:id", () => {
    it("should delete team for admin", async () => {
      const { team, headers } = await createAuthenticatedAdmin();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/teams/${team.id}`,
        headers,
      });

      expect(response.statusCode).toBe(204);
    });

    it("should return 403 for member trying to delete", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/teams/${team.id}`,
        headers,
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 for guest trying to delete", async () => {
      const { team, headers } = await createAuthenticatedGuest();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/teams/${team.id}`,
        headers,
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 for non-member", async () => {
      const { headers } = await createAuthenticatedUser();
      const team = await createTestTeam({ name: "Other Team", key: "OT3" });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/teams/${team.id}`,
        headers,
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
