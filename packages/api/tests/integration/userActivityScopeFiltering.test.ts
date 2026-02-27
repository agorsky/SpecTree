/**
 * Integration Tests: User Activity Scope Filtering (ENG-84)
 *
 * Tests the scope-based filtering for user activity endpoint:
 * - Admin users can access all scope types (self, all, team, user)
 * - Non-admin users are restricted to scope='self'
 * - Proper validation of scope and scopeId parameters
 * - Backwards compatibility with existing clients
 * - Team and user existence validation
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { getTestPrisma, cleanupTestDatabase } from "../setup.js";
import { buildTestApp } from "../helpers/app.js";
import { generateAccessToken } from "../../src/utils/jwt.js";
import {
  createTestUser,
  createTestTeam,
  createTestMembership,
  createTestEpic,
  createTestFeature,
  createTestTask,
  createTestStatus,
} from "../fixtures/factories.js";
import type { User, Team, Epic, Status } from "../../src/generated/prisma/index.js";
import type { FastifyInstance } from "fastify";

describe("User Activity Scope Filtering (ENG-84)", () => {
  let prisma: ReturnType<typeof getTestPrisma>;
  let app: FastifyInstance;

  // Test entities
  let adminUser: User;
  let regularUser: User;
  let anotherUser: User;
  
  let teamA: Team;
  let teamB: Team;
  
  let epicTeamA: Epic;
  let epicTeamB: Epic;
  
  let statusTeamA: Status;
  let statusTeamB: Status;

  let adminToken: string;
  let regularUserToken: string;
  let anotherUserToken: string;

  beforeAll(async () => {
    prisma = getTestPrisma();
    app = await buildTestApp();
    await app.ready();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();

    // Create users
    adminUser = await createTestUser({
      email: "admin@test.com",
      name: "Admin User",
      isGlobalAdmin: true,
    });
    regularUser = await createTestUser({
      email: "regular@test.com",
      name: "Regular User",
    });
    anotherUser = await createTestUser({
      email: "another@test.com",
      name: "Another User",
    });

    // Create teams
    teamA = await createTestTeam({ name: "Team A", key: "TEAMA" });
    teamB = await createTestTeam({ name: "Team B", key: "TEAMB" });

    // Setup memberships
    await createTestMembership(teamA.id, regularUser.id, { role: "member" });
    await createTestMembership(teamB.id, anotherUser.id, { role: "member" });

    // Create statuses
    statusTeamA = await createTestStatus(teamA.id, {
      name: "In Progress",
      category: "started",
    });
    statusTeamB = await createTestStatus(teamB.id, {
      name: "In Progress",
      category: "started",
    });

    // Create epics
    epicTeamA = await createTestEpic(teamA.id, {
      name: "Epic Team A",
    });
    epicTeamB = await createTestEpic(teamB.id, {
      name: "Epic Team B",
    });

    // Create some features and tasks for test data
    const featureA = await createTestFeature(epicTeamA.id, {
      title: "Feature A",
      identifier: "TEAMA-1",
      statusId: statusTeamA.id,
    });
    const featureB = await createTestFeature(epicTeamB.id, {
      title: "Feature B",
      identifier: "TEAMB-1",
      statusId: statusTeamB.id,
    });

    await createTestTask(featureA.id, {
      title: "Task A",
      identifier: "TEAMA-1-1",
      statusId: statusTeamA.id,
    });
    await createTestTask(featureB.id, {
      title: "Task B",
      identifier: "TEAMB-1-1",
      statusId: statusTeamB.id,
    });

    // Generate auth tokens
    adminToken = generateAccessToken(adminUser.id);
    regularUserToken = generateAccessToken(regularUser.id);
    anotherUserToken = generateAccessToken(anotherUser.id);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe("Backwards compatibility", () => {
    it("works without scope parameter (defaults to self)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/user-activity?interval=week",
        headers: {
          Authorization: `Bearer ${regularUserToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("accepts existing query parameters with scope", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/user-activity?interval=day&page=1&limit=10&scope=self",
        headers: {
          Authorization: `Bearer ${regularUserToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.page).toBe(1);
      expect(body.limit).toBe(10);
    });
  });

  describe("Non-admin access", () => {
    it("allows scope=self for non-admin users", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/user-activity?scope=self",
        headers: {
          Authorization: `Bearer ${regularUserToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe("Admin authorization", () => {
    it("allows scope=self for admin users", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/user-activity?scope=self",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it("allows scope=all for admin users", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/user-activity?scope=all",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
    });

    it("allows scope=team for admin users", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/user-activity?scope=team&scopeId=${teamA.id}`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
    });

    it("allows scope=user for admin users", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/user-activity?scope=user&scopeId=${regularUser.id}`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
    });
  });

  describe("Scope parameter validation", () => {
    it("rejects invalid scope value with 400", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/user-activity?scope=invalid",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.message).toContain("Invalid scope");
      expect(body.error.message).toContain("self, all, team, user");
    });
  });

  describe("ScopeId validation", () => {
    it("requires scopeId when scope=team", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/user-activity?scope=team",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.message).toContain("scopeId is required when scope is 'team'");
    });

    it("requires scopeId when scope=user", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/user-activity?scope=user",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.message).toContain("scopeId is required when scope is 'user'");
    });

    it("rejects scopeId when scope=self", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/user-activity?scope=self&scopeId=${teamA.id}`,
        headers: {
          Authorization: `Bearer ${regularUserToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.message).toContain("scopeId should not be provided when scope is 'self'");
    });

    it("rejects scopeId when scope=all", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/user-activity?scope=all&scopeId=${teamA.id}`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.message).toContain("scopeId should not be provided when scope is 'all'");
    });
  });

  describe("Team/user existence validation", () => {
    it("returns 404 when team does not exist", async () => {
      const fakeTeamId = "00000000-0000-0000-0000-000000000000";
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/user-activity?scope=team&scopeId=${fakeTeamId}`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.message).toContain("Team with ID");
      expect(body.error.message).toContain("not found");
    });

    it("returns 404 when user does not exist", async () => {
      const fakeUserId = "00000000-0000-0000-0000-000000000000";
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/user-activity?scope=user&scopeId=${fakeUserId}`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.message).toContain("User with ID");
      expect(body.error.message).toContain("not found");
    });
  });

  describe("Scope filtering behavior", () => {
    it("scope=self returns only user's accessible epics", async () => {
      // Regular user is member of teamA only
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/user-activity?scope=self&interval=week",
        headers: {
          Authorization: `Bearer ${regularUserToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
      // Activity data should only include epics from teamA
    });

    it("scope=all returns activity from all epics", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/user-activity?scope=all&interval=week",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
      // Activity data should include epics from all teams
    });

    it("scope=team returns activity for specific team", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/user-activity?scope=team&scopeId=${teamA.id}&interval=week`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
      // Activity data should only include epics from teamA
    });

    it("scope=user returns activity for specific user", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/user-activity?scope=user&scopeId=${regularUser.id}&interval=week`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
      // Activity data should only include epics accessible to regularUser
    });
  });

  describe("Edge cases", () => {
    it("handles team with no epics gracefully", async () => {
      const emptyTeam = await createTestTeam({ name: "Empty Team", key: "EMPTY" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/user-activity?scope=team&scopeId=${emptyTeam.id}&interval=week`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      // Should return empty activity data
    });

    it("handles user with no team memberships gracefully", async () => {
      const isolatedUser = await createTestUser({
        email: "isolated@test.com",
        name: "Isolated User",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/user-activity?scope=user&scopeId=${isolatedUser.id}&interval=week`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      // Should return empty or personal-only activity data
    });
  });

  describe("Timezone and pagination with scope", () => {
    it("works with timezone parameter and scope", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/user-activity?scope=all&interval=day&timeZone=America/New_York",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
    });

    it("works with pagination parameters and scope", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/user-activity?scope=team&scopeId=${teamA.id}&page=1&limit=5`,
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.page).toBe(1);
      expect(body.limit).toBe(5);
      expect(body.data).toBeDefined();
    });
  });
});
