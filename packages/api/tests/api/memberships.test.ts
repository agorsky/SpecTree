/**
 * Integration Tests for Memberships API Endpoints
 *
 * Tests team membership operations including listing members,
 * adding/removing members, and role management.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../helpers/app.js";
import {
  createTestUser,
  createTestMembership,
  createAuthenticatedUser,
  createAuthenticatedTeamMember,
  createAuthenticatedAdmin,
  createAuthenticatedGuest,
  cleanupTestDatabase,
  disconnectTestDatabase,
} from "../fixtures/index.js";

describe("Memberships API", () => {
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

  describe("GET /api/v1/teams/:teamId/members", () => {
    it("should list team members for team member", async () => {
      const { team, headers, user } = await createAuthenticatedTeamMember();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/teams/${team.id}/members`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      // Members are returned with nested user object
      expect(body.data.some((m: { user: { id: string } }) => m.user.id === user.id)).toBe(true);
    });

    it("should allow guest to list team members", async () => {
      const { team, headers } = await createAuthenticatedGuest();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/teams/${team.id}/members`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
    });

    it("should return 401 without authentication", async () => {
      const { team } = await createAuthenticatedTeamMember();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/teams/${team.id}/members`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /api/v1/teams/:teamId/members", () => {
    it("should add member to team as admin", async () => {
      const { team, headers } = await createAuthenticatedAdmin();
      const newUser = await createTestUser({ name: "New Member" });

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/teams/${team.id}/members`,
        headers,
        payload: {
          userId: newUser.id,
          role: "member",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.userId).toBe(newUser.id);
      expect(body.data.teamId).toBe(team.id);
      expect(body.data.role).toBe("member");
    });

    it("should add member with default role", async () => {
      const { team, headers } = await createAuthenticatedAdmin();
      const newUser = await createTestUser({ name: "Default Role User" });

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/teams/${team.id}/members`,
        headers,
        payload: {
          userId: newUser.id,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.role).toBe("member");
    });

    it("should add member with guest role", async () => {
      const { team, headers } = await createAuthenticatedAdmin();
      const newUser = await createTestUser({ name: "Guest User" });

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/teams/${team.id}/members`,
        headers,
        payload: {
          userId: newUser.id,
          role: "guest",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.role).toBe("guest");
    });

    it("should add member with admin role", async () => {
      const { team, headers } = await createAuthenticatedAdmin();
      const newUser = await createTestUser({ name: "Admin User" });

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/teams/${team.id}/members`,
        headers,
        payload: {
          userId: newUser.id,
          role: "admin",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.role).toBe("admin");
    });

    it("should return 400 for invalid role", async () => {
      const { team, headers } = await createAuthenticatedAdmin();
      const newUser = await createTestUser({ name: "Invalid Role User" });

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/teams/${team.id}/members`,
        headers,
        payload: {
          userId: newUser.id,
          role: "superadmin", // Invalid role
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for missing userId", async () => {
      const { team, headers } = await createAuthenticatedAdmin();

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/teams/${team.id}/members`,
        headers,
        payload: {
          role: "member",
        },
      });

      expect(response.statusCode).toBe(400);
    });

  });

  describe("PUT /api/v1/teams/:teamId/members/:userId", () => {
    it("should update member role as admin", async () => {
      const { team, headers } = await createAuthenticatedAdmin();
      const user = await createTestUser({ name: "Role Update User" });
      await createTestMembership(team.id, user.id, { role: "member" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/teams/${team.id}/members/${user.id}`,
        headers,
        payload: {
          role: "admin",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.role).toBe("admin");
    });

    it("should downgrade member to guest", async () => {
      const { team, headers } = await createAuthenticatedAdmin();
      const user = await createTestUser({ name: "Downgrade User" });
      await createTestMembership(team.id, user.id, { role: "member" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/teams/${team.id}/members/${user.id}`,
        headers,
        payload: {
          role: "guest",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.role).toBe("guest");
    });

    it("should return 400 for invalid role", async () => {
      const { team, headers } = await createAuthenticatedAdmin();
      const user = await createTestUser({ name: "Invalid Role User" });
      await createTestMembership(team.id, user.id, { role: "member" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/teams/${team.id}/members/${user.id}`,
        headers,
        payload: {
          role: "invalid_role",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for missing role", async () => {
      const { team, headers } = await createAuthenticatedAdmin();
      const user = await createTestUser({ name: "Missing Role User" });
      await createTestMembership(team.id, user.id, { role: "member" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/teams/${team.id}/members/${user.id}`,
        headers,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

  });

  describe("DELETE /api/v1/teams/:teamId/members/:userId", () => {
    it("should remove member from team as admin", async () => {
      const { team, headers } = await createAuthenticatedAdmin();
      const user = await createTestUser({ name: "To Remove User" });
      await createTestMembership(team.id, user.id, { role: "member" });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/teams/${team.id}/members/${user.id}`,
        headers,
      });

      expect(response.statusCode).toBe(204);
    });

  });

  describe("GET /api/v1/users/:userId/teams", () => {
    it("should list teams for a user", async () => {
      const { team, headers, user } = await createAuthenticatedTeamMember();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/users/${user.id}/teams`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      // User teams are returned with nested team object
      expect(body.data.some((t: { team: { id: string } }) => t.team.id === team.id)).toBe(true);
    });

    it("should return empty array for user with no teams", async () => {
      const { headers } = await createAuthenticatedUser();
      const otherUser = await createTestUser({ name: "No Teams User" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/users/${otherUser.id}/teams`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
    });

    it("should return 401 without authentication", async () => {
      const { user } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/users/${user.id}/teams`,
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
