/**
 * Integration Tests for Users API Endpoints
 *
 * Tests user management including listing, creating, updating, and deleting users.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../helpers/app.js";
import {
  createTestUser,
  createAuthenticatedUser,
  cleanupTestDatabase,
  disconnectTestDatabase,
} from "../fixtures/index.js";

describe("Users API", () => {
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

  describe("GET /api/v1/users", () => {
    it("should list users for authenticated user", async () => {
      const { headers } = await createAuthenticatedUser();
      await createTestUser({ name: "User 1" });
      await createTestUser({ name: "User 2" });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("should support pagination parameters", async () => {
      const { headers } = await createAuthenticatedUser();
      // Create several users
      for (let i = 0; i < 5; i++) {
        await createTestUser({ name: `User ${i}` });
      }

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users?page=1&limit=2",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.limit).toBe(2);
      expect(body.pagination.page).toBe(1);
    });

    it("should return pagination info", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.total).toBeGreaterThanOrEqual(1);
      expect(body.pagination.totalPages).toBeGreaterThanOrEqual(1);
    });

    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/users/:id", () => {
    it("should get user by ID for authenticated user", async () => {
      const { headers } = await createAuthenticatedUser();
      const user = await createTestUser({ name: "Specific User" });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/users/${user.id}`,
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(user.id);
      expect(body.data.name).toBe("Specific User");
      expect(body.data.passwordHash).toBeUndefined();
    });

    it("should return 404 for non-existent user", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users/00000000-0000-0000-0000-000000000000",
        headers,
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 401 without authentication", async () => {
      const user = await createTestUser();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/users/${user.id}`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/users/me", () => {
    it("should get current authenticated user", async () => {
      const { user, headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users/me",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(user.id);
      expect(body.data.email).toBe(user.email);
      expect(body.data.passwordHash).toBeUndefined();
    });

    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users/me",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("PUT /api/v1/users/:id", () => {
    it("should update user name", async () => {
      const { headers } = await createAuthenticatedUser();
      const user = await createTestUser({ name: "Original Name" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/users/${user.id}`,
        headers,
        payload: {
          name: "Updated Name",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe("Updated Name");
    });

    it("should update user email", async () => {
      const { headers } = await createAuthenticatedUser();
      const user = await createTestUser({ email: "original@example.com" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/users/${user.id}`,
        headers,
        payload: {
          email: "updated@example.com",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.email).toBe("updated@example.com");
    });

    it("should update user avatar URL", async () => {
      const { headers } = await createAuthenticatedUser();
      const user = await createTestUser({ name: "Avatar User" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/users/${user.id}`,
        headers,
        payload: {
          avatarUrl: "https://example.com/new-avatar.png",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.avatarUrl).toBe("https://example.com/new-avatar.png");
    });

    it("should update user password", async () => {
      const { headers } = await createAuthenticatedUser();
      const user = await createTestUser({ name: "Password User" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/users/${user.id}`,
        headers,
        payload: {
          password: "newSecurePassword123",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.passwordHash).toBeUndefined();
    });

    it("should update isActive status", async () => {
      const { headers } = await createAuthenticatedUser();
      const user = await createTestUser({ name: "Active User" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/users/${user.id}`,
        headers,
        payload: {
          isActive: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.isActive).toBe(false);
    });

    it("should return 409 for duplicate email on update", async () => {
      const { headers } = await createAuthenticatedUser();
      const existingUser = await createTestUser({ email: "existing@example.com" });
      const userToUpdate = await createTestUser({ email: "toupdate@example.com" });

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/users/${userToUpdate.id}`,
        headers,
        payload: {
          email: existingUser.email,
        },
      });

      expect(response.statusCode).toBe(409);
    });

    it("should return 404 for non-existent user", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "PUT",
        url: "/api/v1/users/00000000-0000-0000-0000-000000000000",
        headers,
        payload: {
          name: "Non-existent User",
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 401 without authentication", async () => {
      const user = await createTestUser();

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/users/${user.id}`,
        payload: {
          name: "Unauthorized Update",
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("DELETE /api/v1/users/:id (soft delete)", () => {
    it("should soft delete user (set isActive to false)", async () => {
      const { headers } = await createAuthenticatedUser();
      const user = await createTestUser({ name: "To Delete User" });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/users/${user.id}`,
        headers,
      });

      expect(response.statusCode).toBe(204);

      // Verify user is soft deleted by fetching it
      const getResponse = await app.inject({
        method: "GET",
        url: `/api/v1/users/${user.id}`,
        headers,
      });

      expect(getResponse.statusCode).toBe(200);
      const body = JSON.parse(getResponse.body);
      expect(body.data.isActive).toBe(false);
    });

    it("should return 404 for non-existent user", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/users/00000000-0000-0000-0000-000000000000",
        headers,
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 401 without authentication", async () => {
      const user = await createTestUser();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/users/${user.id}`,
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
