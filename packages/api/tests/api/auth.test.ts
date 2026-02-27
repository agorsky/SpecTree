/**
 * Integration Tests for Auth API Endpoints
 *
 * Tests the authentication flows including login, token refresh, and logout.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../helpers/app.js";
import {
  createTestUser,
  createTestGlobalAdmin,
  createAuthenticatedUser,
  createInvalidAuthHeader,
  cleanupTestDatabase,
  disconnectTestDatabase,
} from "../fixtures/index.js";

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
    const TEST_PASSPHRASE = "test-passphrase-secret";

    beforeAll(() => {
      process.env.SPECTREE_PASSPHRASE = TEST_PASSPHRASE;
    });

    afterAll(() => {
      delete process.env.SPECTREE_PASSPHRASE;
    });

    it("should login with valid passphrase and return admin user tokens", async () => {
      const admin = await createTestGlobalAdmin({
        email: "admin-login@example.com",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { passphrase: TEST_PASSPHRASE },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.user.id).toBe(admin.id);
      expect(body.user.email).toBe(admin.email);
      expect(body.user.passwordHash).toBeUndefined();
    });

    it("should return 401 for wrong passphrase", async () => {
      await createTestGlobalAdmin({ email: "admin-wrong@example.com" });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { passphrase: "wrong-passphrase" },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 for missing passphrase", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {},
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 401 when no admin user exists", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { passphrase: TEST_PASSPHRASE },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 when SPECTREE_PASSPHRASE env var is not set", async () => {
      const saved = process.env.SPECTREE_PASSPHRASE;
      delete process.env.SPECTREE_PASSPHRASE;

      await createTestGlobalAdmin({ email: "admin-noenv@example.com" });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { passphrase: "anything" },
      });

      expect(response.statusCode).toBe(401);

      process.env.SPECTREE_PASSPHRASE = saved;
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

  describe("Passphrase session token authentication", () => {
    const TEST_PASSPHRASE = "test-session-passphrase";

    beforeAll(() => {
      process.env.SPECTREE_PASSPHRASE = TEST_PASSPHRASE;
    });

    afterAll(() => {
      delete process.env.SPECTREE_PASSPHRASE;
    });

    it("should authenticate with passphrase as Bearer token on protected route", async () => {
      const admin = await createTestGlobalAdmin({
        email: "admin-session@example.com",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { Authorization: `Bearer ${TEST_PASSPHRASE}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(admin.id);
      expect(body.email).toBe(admin.email);
      expect(body.passwordHash).toBeUndefined();
    });

    it("should return 401 when passphrase is correct but no admin user exists", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { Authorization: `Bearer ${TEST_PASSPHRASE}` },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 401 when passphrase is correct but admin is inactive", async () => {
      await createTestGlobalAdmin({
        email: "admin-inactive@example.com",
        isActive: false,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { Authorization: `Bearer ${TEST_PASSPHRASE}` },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should not authenticate with wrong passphrase (falls through to JWT)", async () => {
      await createTestGlobalAdmin({ email: "admin-wrong-pp@example.com" });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { Authorization: "Bearer wrong-passphrase" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should not authenticate when SPECTREE_PASSPHRASE is not set", async () => {
      const saved = process.env.SPECTREE_PASSPHRASE;
      delete process.env.SPECTREE_PASSPHRASE;

      await createTestGlobalAdmin({ email: "admin-noenv-pp@example.com" });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { Authorization: `Bearer ${TEST_PASSPHRASE}` },
      });

      expect(response.statusCode).toBe(401);

      process.env.SPECTREE_PASSPHRASE = saved;
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
