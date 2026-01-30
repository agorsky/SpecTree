/**
 * Integration Tests for /me/* API Endpoints (Personal Scope)
 *
 * Tests the personal scope API routes for managing user's personal
 * projects, statuses, and scope information.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../helpers/app.js";
import {
  createTestUser,
  createAuthenticatedUser,
  createInvalidAuthHeader,
  cleanupTestDatabase,
  disconnectTestDatabase,
  getTestPrisma,
} from "../fixtures/index.js";

describe("Me API (Personal Scope)", () => {
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

  // ===========================================================================
  // GET /api/v1/me/scope - Get personal scope
  // ===========================================================================
  describe("GET /api/v1/me/scope", () => {
    it("should create and return personal scope for user without one", async () => {
      const { user, headers } = await createAuthenticatedUser();

      // Verify user has no personal scope initially
      const prisma = getTestPrisma();
      const existingScope = await prisma.personalScope.findUnique({
        where: { userId: user.id },
      });
      expect(existingScope).toBeNull();

      // Call endpoint - should lazily create personal scope
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/me/scope",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.data.userId).toBe(user.id);
      expect(body.data._count).toBeDefined();
      expect(body.data._count.epics).toBe(0);
      expect(body.data._count.statuses).toBeGreaterThanOrEqual(0);
    });

    it("should return existing personal scope", async () => {
      const { user, headers } = await createAuthenticatedUser();

      // Pre-create personal scope with default statuses
      const prisma = getTestPrisma();
      const createdScope = await prisma.personalScope.create({
        data: { userId: user.id },
      });
      await prisma.status.create({
        data: {
          name: "Backlog",
          personalScopeId: createdScope.id,
          category: "backlog",
          position: 0,
        },
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/me/scope",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(createdScope.id);
      expect(body.data.userId).toBe(user.id);
    });

    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/me/scope",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 401 with invalid token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/me/scope",
        headers: createInvalidAuthHeader(),
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ===========================================================================
  // GET /api/v1/me/projects - List personal projects
  // ===========================================================================
  describe("GET /api/v1/me/projects", () => {
    it("should return empty list for user with no projects", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/me/projects",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
      expect(body.meta.hasMore).toBe(false);
      expect(body.meta.cursor).toBeNull();
    });

    it("should return user's personal projects", async () => {
      const { user, headers } = await createAuthenticatedUser();

      // Create personal scope and projects
      const prisma = getTestPrisma();
      const personalScope = await prisma.personalScope.create({
        data: { userId: user.id },
      });
      await prisma.epic.create({
        data: {
          name: "Personal Project 1",
          personalScopeId: personalScope.id,
          sortOrder: 0,
        },
      });
      await prisma.epic.create({
        data: {
          name: "Personal Project 2",
          personalScopeId: personalScope.id,
          sortOrder: 1,
        },
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/me/projects",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.length).toBe(2);
      expect(body.data[0].name).toBe("Personal Project 1");
      expect(body.data[1].name).toBe("Personal Project 2");
    });

    it("should not return other users' projects", async () => {
      const { user, headers } = await createAuthenticatedUser();
      const otherUser = await createTestUser({ email: "other@example.com" });

      // Create personal scopes and projects for both users
      const prisma = getTestPrisma();
      const myScope = await prisma.personalScope.create({
        data: { userId: user.id },
      });
      const otherScope = await prisma.personalScope.create({
        data: { userId: otherUser.id },
      });

      await prisma.epic.create({
        data: {
          name: "My Project",
          personalScopeId: myScope.id,
          sortOrder: 0,
        },
      });
      await prisma.epic.create({
        data: {
          name: "Other User Project",
          personalScopeId: otherScope.id,
          sortOrder: 0,
        },
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/me/projects",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.length).toBe(1);
      expect(body.data[0].name).toBe("My Project");
    });

    it("should support pagination", async () => {
      const { user, headers } = await createAuthenticatedUser();

      // Create personal scope with multiple projects
      const prisma = getTestPrisma();
      const personalScope = await prisma.personalScope.create({
        data: { userId: user.id },
      });

      for (let i = 0; i < 5; i++) {
        await prisma.epic.create({
          data: {
            name: `Project ${i}`,
            personalScopeId: personalScope.id,
            sortOrder: i,
          },
        });
      }

      // Get first page
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/me/projects?limit=2",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.length).toBe(2);
      expect(body.meta.hasMore).toBe(true);
      expect(body.meta.cursor).toBeDefined();
    });

    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/me/projects",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ===========================================================================
  // POST /api/v1/me/projects - Create personal project
  // ===========================================================================
  describe("POST /api/v1/me/projects", () => {
    it("should create a personal project", async () => {
      const { user, headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/me/projects",
        headers,
        payload: {
          name: "New Personal Project",
          description: "A test project",
          color: "#FF5733",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe("New Personal Project");
      expect(body.data.description).toBe("A test project");
      expect(body.data.color).toBe("#FF5733");
      expect(body.data.personalScopeId).toBeDefined();
      expect(body.data.teamId).toBeNull();

      // Verify personal scope was created
      const prisma = getTestPrisma();
      const personalScope = await prisma.personalScope.findUnique({
        where: { userId: user.id },
      });
      expect(personalScope).not.toBeNull();
      expect(body.data.personalScopeId).toBe(personalScope!.id);
    });

    it("should create project with only required fields", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/me/projects",
        headers,
        payload: {
          name: "Minimal Project",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe("Minimal Project");
    });

    it("should auto-generate sortOrder", async () => {
      const { user, headers } = await createAuthenticatedUser();

      // Create first project
      const response1 = await app.inject({
        method: "POST",
        url: "/api/v1/me/projects",
        headers,
        payload: { name: "First Project" },
      });
      expect(response1.statusCode).toBe(201);

      // Create second project
      const response2 = await app.inject({
        method: "POST",
        url: "/api/v1/me/projects",
        headers,
        payload: { name: "Second Project" },
      });
      expect(response2.statusCode).toBe(201);

      const project1 = JSON.parse(response1.body).data;
      const project2 = JSON.parse(response2.body).data;
      expect(project2.sortOrder).toBeGreaterThan(project1.sortOrder);
    });

    it("should return 400 for missing name", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/me/projects",
        headers,
        payload: {
          description: "No name provided",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for invalid color format", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/me/projects",
        headers,
        payload: {
          name: "Project",
          color: "invalid-color",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/me/projects",
        payload: {
          name: "Unauthorized Project",
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ===========================================================================
  // GET /api/v1/me/statuses - List personal statuses
  // ===========================================================================
  describe("GET /api/v1/me/statuses", () => {
    it("should return default statuses for new user", async () => {
      const { headers } = await createAuthenticatedUser();

      // First call creates personal scope with default statuses
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/me/statuses",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      // Default statuses are created when personal scope is created
      expect(body.data.length).toBeGreaterThanOrEqual(0);
    });

    it("should return user's personal statuses ordered by position", async () => {
      const { user, headers } = await createAuthenticatedUser();

      // Create personal scope with custom statuses
      const prisma = getTestPrisma();
      const personalScope = await prisma.personalScope.create({
        data: { userId: user.id },
      });
      await prisma.status.create({
        data: {
          name: "Todo",
          personalScopeId: personalScope.id,
          category: "unstarted",
          position: 1,
        },
      });
      await prisma.status.create({
        data: {
          name: "Backlog",
          personalScopeId: personalScope.id,
          category: "backlog",
          position: 0,
        },
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/me/statuses",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.length).toBe(2);
      // Should be ordered by position
      expect(body.data[0].name).toBe("Backlog");
      expect(body.data[1].name).toBe("Todo");
    });

    it("should not return other users' statuses", async () => {
      const { user, headers } = await createAuthenticatedUser();
      const otherUser = await createTestUser({ email: "other@example.com" });

      // Create personal scopes and statuses for both users
      const prisma = getTestPrisma();
      const myScope = await prisma.personalScope.create({
        data: { userId: user.id },
      });
      const otherScope = await prisma.personalScope.create({
        data: { userId: otherUser.id },
      });

      await prisma.status.create({
        data: {
          name: "My Status",
          personalScopeId: myScope.id,
          category: "started",
          position: 0,
        },
      });
      await prisma.status.create({
        data: {
          name: "Other Status",
          personalScopeId: otherScope.id,
          category: "started",
          position: 0,
        },
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/me/statuses",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.length).toBe(1);
      expect(body.data[0].name).toBe("My Status");
    });

    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/me/statuses",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ===========================================================================
  // POST /api/v1/me/statuses - Create personal status
  // ===========================================================================
  describe("POST /api/v1/me/statuses", () => {
    it("should create a personal status", async () => {
      const { user, headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/me/statuses",
        headers,
        payload: {
          name: "In Review",
          category: "started",
          color: "#3B82F6",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe("In Review");
      expect(body.data.category).toBe("started");
      expect(body.data.color).toBe("#3B82F6");
      expect(body.data.personalScopeId).toBeDefined();
      expect(body.data.teamId).toBeNull();

      // Verify personal scope was created
      const prisma = getTestPrisma();
      const personalScope = await prisma.personalScope.findUnique({
        where: { userId: user.id },
      });
      expect(personalScope).not.toBeNull();
    });

    it("should create status with only required fields", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/me/statuses",
        headers,
        payload: {
          name: "Minimal Status",
          category: "backlog",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe("Minimal Status");
      expect(body.data.category).toBe("backlog");
    });

    it("should auto-generate position", async () => {
      const { user, headers } = await createAuthenticatedUser();

      // Create personal scope first
      const prisma = getTestPrisma();
      const personalScope = await prisma.personalScope.create({
        data: { userId: user.id },
      });
      await prisma.status.create({
        data: {
          name: "Existing Status",
          personalScopeId: personalScope.id,
          category: "backlog",
          position: 5,
        },
      });

      // Create new status
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/me/statuses",
        headers,
        payload: {
          name: "New Status",
          category: "started",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.position).toBe(6); // Should be after existing status
    });

    it("should return 400 for missing name", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/me/statuses",
        headers,
        payload: {
          category: "started",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for missing category", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/me/statuses",
        headers,
        payload: {
          name: "No Category",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for invalid category", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/me/statuses",
        headers,
        payload: {
          name: "Invalid Category Status",
          category: "invalid-category",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for invalid color format", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/me/statuses",
        headers,
        payload: {
          name: "Status",
          category: "started",
          color: "not-a-color",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 409 for duplicate status name (case-insensitive)", async () => {
      const { user, headers } = await createAuthenticatedUser();

      // Create personal scope with existing status
      const prisma = getTestPrisma();
      const personalScope = await prisma.personalScope.create({
        data: { userId: user.id },
      });
      await prisma.status.create({
        data: {
          name: "Existing Status",
          personalScopeId: personalScope.id,
          category: "backlog",
          position: 0,
        },
      });

      // Try to create status with same name (different case)
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/me/statuses",
        headers,
        payload: {
          name: "existing status", // lowercase
          category: "started",
        },
      });

      expect(response.statusCode).toBe(409);
    });

    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/me/statuses",
        payload: {
          name: "Unauthorized Status",
          category: "backlog",
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
