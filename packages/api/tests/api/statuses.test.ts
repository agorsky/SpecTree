/**
 * Integration Tests for Statuses API Endpoints
 *
 * Tests CRUD operations for statuses with team-scoped authorization.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../helpers/app.js";
import {
  createTestStatus,
  createAuthenticatedUser,
  createAuthenticatedTeamMember,
  createAuthenticatedAdmin,
  createAuthenticatedGuest,
  cleanupTestDatabase,
  disconnectTestDatabase,
} from "../fixtures/index.js";

describe("Statuses API", () => {
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

  describe("GET /api/v1/statuses", () => {
    it("should list statuses for authenticated user", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      await createTestStatus(team.id, { name: "To Do", category: "unstarted" });
      await createTestStatus(team.id, { name: "Done", category: "completed" });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/statuses",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("should filter statuses by teamId", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      await createTestStatus(team.id, { name: "Team Status", category: "unstarted" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/statuses?teamId=${team.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.data.every((s: { teamId: string }) => s.teamId === team.id)).toBe(true);
    });

    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/statuses",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/statuses/:id", () => {
    it("should get status by ID for authenticated user", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const status = await createTestStatus(team.id, { name: "In Progress", category: "started" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/statuses/${status.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(status.id);
      expect(body.data.name).toBe("In Progress");
      expect(body.data.category).toBe("started");
    });

    it("should return 404 for non-existent status", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/statuses/00000000-0000-0000-0000-000000000000",
        headers,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/v1/statuses", () => {
    it("should create status for team member", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/statuses",
        headers,
        payload: {
          name: "New Status",
          teamId: team.id,
          category: "unstarted",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe("New Status");
      expect(body.data.teamId).toBe(team.id);
      expect(body.data.category).toBe("unstarted");
    });

    it("should create status with color and position", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/statuses",
        headers,
        payload: {
          name: "Styled Status",
          teamId: team.id,
          category: "started",
          color: "#FF5733",
          position: 5,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.color).toBe("#FF5733");
      expect(body.data.position).toBe(5);
    });

    it("should create status with different categories", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();

      // Test backlog category
      const backlogResponse = await app.inject({
        method: "POST",
        url: "/api/v1/statuses",
        headers,
        payload: {
          name: "Backlog",
          teamId: team.id,
          category: "backlog",
        },
      });
      expect(backlogResponse.statusCode).toBe(201);
      expect(JSON.parse(backlogResponse.body).data.category).toBe("backlog");

      // Test completed category
      const completedResponse = await app.inject({
        method: "POST",
        url: "/api/v1/statuses",
        headers,
        payload: {
          name: "Done",
          teamId: team.id,
          category: "completed",
        },
      });
      expect(completedResponse.statusCode).toBe(201);
      expect(JSON.parse(completedResponse.body).data.category).toBe("completed");

      // Test canceled category
      const canceledResponse = await app.inject({
        method: "POST",
        url: "/api/v1/statuses",
        headers,
        payload: {
          name: "Canceled",
          teamId: team.id,
          category: "canceled",
        },
      });
      expect(canceledResponse.statusCode).toBe(201);
      expect(JSON.parse(canceledResponse.body).data.category).toBe("canceled");
    });

    it("should return 403 for guest trying to create", async () => {
      const { team, headers } = await createAuthenticatedGuest();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/statuses",
        headers,
        payload: {
          name: "Guest Status",
          teamId: team.id,
          category: "unstarted",
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 for non-team-member", async () => {
      const { team } = await createAuthenticatedTeamMember();
      const { headers: otherHeaders } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/statuses",
        headers: otherHeaders,
        payload: {
          name: "Unauthorized Status",
          teamId: team.id,
          category: "unstarted",
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("PUT /api/v1/statuses/:id", () => {
    it("should update status for team member", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const status = await createTestStatus(team.id, { name: "Original Name", category: "unstarted" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/statuses/${status.id}`,
        headers,
        payload: {
          name: "Updated Name",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe("Updated Name");
    });

    it("should update status category", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const status = await createTestStatus(team.id, { name: "Status", category: "unstarted" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/statuses/${status.id}`,
        headers,
        payload: {
          category: "started",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.category).toBe("started");
    });

    it("should update status color and position", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const status = await createTestStatus(team.id, { name: "Status", category: "unstarted" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/statuses/${status.id}`,
        headers,
        payload: {
          color: "#00FF00",
          position: 10,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.color).toBe("#00FF00");
      expect(body.data.position).toBe(10);
    });

    it("should return 403 for guest trying to update", async () => {
      const { team, headers } = await createAuthenticatedGuest();
      const status = await createTestStatus(team.id, { name: "Guest Status", category: "unstarted" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/statuses/${status.id}`,
        headers,
        payload: {
          name: "Guest Update",
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 for non-team-member", async () => {
      const { team } = await createAuthenticatedTeamMember();
      const status = await createTestStatus(team.id, { name: "Protected Status", category: "unstarted" });
      const { headers: otherHeaders } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/statuses/${status.id}`,
        headers: otherHeaders,
        payload: {
          name: "Hacked Name",
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("DELETE /api/v1/statuses/:id", () => {
    it("should delete status for admin", async () => {
      const { team, headers } = await createAuthenticatedAdmin();
      const status = await createTestStatus(team.id, { name: "To Delete", category: "unstarted" });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/statuses/${status.id}`,
        headers,
      });

      expect(response.statusCode).toBe(204);
    });

    it("should return 403 for member trying to delete", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      const status = await createTestStatus(team.id, { name: "Member Status", category: "unstarted" });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/statuses/${status.id}`,
        headers,
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 for guest trying to delete", async () => {
      const { team, headers } = await createAuthenticatedGuest();
      const status = await createTestStatus(team.id, { name: "Guest Status", category: "unstarted" });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/statuses/${status.id}`,
        headers,
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 for non-team-member", async () => {
      const { team } = await createAuthenticatedTeamMember();
      const status = await createTestStatus(team.id, { name: "Other Team Status", category: "unstarted" });
      const { headers: otherHeaders } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/statuses/${status.id}`,
        headers: otherHeaders,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("Status ordering", () => {
    it("should maintain default position ordering", async () => {
      const { team, headers } = await createAuthenticatedTeamMember();
      await createTestStatus(team.id, { name: "First", category: "unstarted", position: 1 });
      await createTestStatus(team.id, { name: "Second", category: "started", position: 2 });
      await createTestStatus(team.id, { name: "Third", category: "completed", position: 3 });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/statuses?teamId=${team.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.length).toBe(3);
      // Statuses should be ordered by position
      const positions = body.data.map((s: { position: number }) => s.position);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    });
  });
});
