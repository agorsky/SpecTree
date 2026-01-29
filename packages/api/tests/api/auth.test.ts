/**
 * Integration Tests for Auth API Endpoints
 *
 * Tests the authentication flows including login, token refresh, and logout.
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
} from "../fixtures/index.js";
import bcrypt from "bcrypt";

describe("Auth API", () => {
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

  describe("POST /api/v1/auth/login", () => {
    it("should login with valid credentials", async () => {
      // Create a user with a known password
      const password = "testPassword123";
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await createTestUser({
        email: "login-test@example.com",
        passwordHash,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: user.email,
          password,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.user.email).toBe(user.email);
      expect(body.user.id).toBe(user.id);
      expect(body.user.passwordHash).toBeUndefined();
    });

    it("should return 401 for invalid email", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "nonexistent@example.com",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 for invalid password", async () => {
      const password = "correctPassword";
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await createTestUser({
        email: "wrong-password@example.com",
        passwordHash,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: user.email,
          password: "wrongPassword",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 for missing credentials", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {},
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 403 for inactive user", async () => {
      const password = "testPassword123";
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await createTestUser({
        email: "inactive@example.com",
        passwordHash,
        isActive: false,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: user.email,
          password,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    it("should refresh token with valid refresh token", async () => {
      const { refreshToken } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        payload: {
          refreshToken,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.accessToken).toBeDefined();
    });

    it("should return 401 for invalid refresh token", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        payload: {
          refreshToken: "invalid-token",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 401 for missing refresh token", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        payload: {},
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 401 when using access token instead of refresh token", async () => {
      const { accessToken } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        payload: {
          refreshToken: accessToken, // Using access token instead
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("should logout authenticated user", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe("Logged out successfully");
    });

    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 401 with invalid token", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers: createInvalidAuthHeader(),
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/users/me (protected route)", () => {
    it("should return current user when authenticated", async () => {
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

    it("should return 401 with invalid token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users/me",
        headers: createInvalidAuthHeader(),
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
