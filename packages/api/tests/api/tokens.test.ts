/**
 * Integration Tests for API Token Endpoints
 *
 * Tests the token creation, validation, listing, and revocation flows.
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
import { hashToken } from "../../src/services/tokenService.js";
import { getTestPrisma } from "../setup.js";

describe("Tokens API", () => {
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
  // POST /api/v1/tokens - Token Creation
  // ===========================================================================

  describe("POST /api/v1/tokens", () => {
    it("should create a token with valid name", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/tokens",
        headers,
        payload: {
          name: "My Test Token",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe("My Test Token");
      expect(body.data.token).toBeDefined();
      expect(body.data.token).toMatch(/^st_/);
      expect(body.data.id).toBeDefined();
      expect(body.data.scopes).toEqual([]);
      expect(body.data.expiresAt).toBeNull();
      expect(body.message).toContain("will not be shown again");
    });

    it("should create a token with scopes and expiration", async () => {
      const { headers } = await createAuthenticatedUser();
      const futureDate = new Date(Date.now() + 86400000).toISOString(); // +1 day

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/tokens",
        headers,
        payload: {
          name: "Scoped Token",
          scopes: ["read:projects", "write:features"],
          expiresAt: futureDate,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.scopes).toEqual(["read:projects", "write:features"]);
      expect(body.data.expiresAt).toBeDefined();
    });

    it("should store only the hash in database", async () => {
      const { headers, user } = await createAuthenticatedUser();
      const prisma = getTestPrisma();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/tokens",
        headers,
        payload: {
          name: "Hash Test Token",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      const plainToken = body.data.token;

      // Verify the hash is stored, not the plaintext
      const dbToken = await prisma.apiToken.findFirst({
        where: { userId: user.id },
      });

      expect(dbToken).toBeDefined();
      expect(dbToken!.tokenHash).not.toBe(plainToken);
      expect(dbToken!.tokenHash).toBe(hashToken(plainToken));
    });

    it("should return 400 for missing name", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/tokens",
        headers,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for empty name", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/tokens",
        headers,
        payload: {
          name: "   ",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for expiration in the past", async () => {
      const { headers } = await createAuthenticatedUser();
      const pastDate = new Date(Date.now() - 86400000).toISOString(); // -1 day

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/tokens",
        headers,
        payload: {
          name: "Expired Token",
          expiresAt: pastDate,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain("future");
    });

    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/tokens",
        payload: {
          name: "Unauthorized Token",
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ===========================================================================
  // GET /api/v1/tokens - List Tokens
  // ===========================================================================

  describe("GET /api/v1/tokens", () => {
    it("should list user tokens", async () => {
      const { headers, user } = await createAuthenticatedUser();

      // Create some tokens
      await app.inject({
        method: "POST",
        url: "/api/v1/tokens",
        headers,
        payload: { name: "Token 1" },
      });
      await app.inject({
        method: "POST",
        url: "/api/v1/tokens",
        headers,
        payload: { name: "Token 2" },
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/tokens",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].name).toBeDefined();
      // Token value should NOT be in the response
      expect(body.data[0].token).toBeUndefined();
      expect(body.data[0].tokenHash).toBeUndefined();
    });

    it("should return empty array for user with no tokens", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/tokens",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
    });

    it("should not show other user's tokens", async () => {
      const { headers: headers1 } = await createAuthenticatedUser({
        email: "user1@test.com",
      });
      const { headers: headers2 } = await createAuthenticatedUser({
        email: "user2@test.com",
      });

      // User 1 creates a token
      await app.inject({
        method: "POST",
        url: "/api/v1/tokens",
        headers: headers1,
        payload: { name: "User 1 Token" },
      });

      // User 2 should not see User 1's token
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/tokens",
        headers: headers2,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
    });

    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/tokens",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ===========================================================================
  // DELETE /api/v1/tokens/:id - Revoke Token
  // ===========================================================================

  describe("DELETE /api/v1/tokens/:id", () => {
    it("should revoke a token", async () => {
      const { headers } = await createAuthenticatedUser();

      // Create a token
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/v1/tokens",
        headers,
        payload: { name: "Token to Delete" },
      });
      const tokenId = JSON.parse(createResponse.body).data.id;

      // Delete the token
      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/api/v1/tokens/${tokenId}`,
        headers,
      });

      expect(deleteResponse.statusCode).toBe(204);

      // Verify token is gone
      const listResponse = await app.inject({
        method: "GET",
        url: "/api/v1/tokens",
        headers,
      });
      const body = JSON.parse(listResponse.body);
      expect(body.data).toEqual([]);
    });

    it("should return 404 for non-existent token", async () => {
      const { headers } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/tokens/00000000-0000-0000-0000-000000000000",
        headers,
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 403 when deleting another user's token", async () => {
      const { headers: headers1 } = await createAuthenticatedUser({
        email: "owner@test.com",
      });
      const { headers: headers2 } = await createAuthenticatedUser({
        email: "attacker@test.com",
      });

      // User 1 creates a token
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/v1/tokens",
        headers: headers1,
        payload: { name: "Owner's Token" },
      });
      const tokenId = JSON.parse(createResponse.body).data.id;

      // User 2 tries to delete User 1's token
      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/api/v1/tokens/${tokenId}`,
        headers: headers2,
      });

      expect(deleteResponse.statusCode).toBe(403);
    });

    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/tokens/some-id",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ===========================================================================
  // Token Validation (using tokens for authentication)
  // ===========================================================================

  describe("Token Validation", () => {
    it("should authenticate requests with valid API token", async () => {
      const { headers, user } = await createAuthenticatedUser();

      // Create an API token
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/v1/tokens",
        headers,
        payload: { name: "Auth Test Token" },
      });
      const apiToken = JSON.parse(createResponse.body).data.token;

      // Use the API token to access a protected endpoint
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users/me",
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(user.id);
      expect(body.data.email).toBe(user.email);
    });

    it("should reject invalid API token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users/me",
        headers: {
          Authorization: "Bearer st_invalid_token_here",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject expired API token", async () => {
      const { headers, user } = await createAuthenticatedUser();
      const prisma = getTestPrisma();

      // Create a token
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/v1/tokens",
        headers,
        payload: { name: "Expiring Token" },
      });
      const apiToken = JSON.parse(createResponse.body).data.token;
      const tokenId = JSON.parse(createResponse.body).data.id;

      // Manually expire the token in the database
      await prisma.apiToken.update({
        where: { id: tokenId },
        data: { expiresAt: new Date(Date.now() - 1000) }, // 1 second ago
      });

      // Try to use the expired token
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users/me",
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should update last_used_at on token use", async () => {
      const { headers } = await createAuthenticatedUser();
      const prisma = getTestPrisma();

      // Create a token
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/v1/tokens",
        headers,
        payload: { name: "Usage Tracking Token" },
      });
      const apiToken = JSON.parse(createResponse.body).data.token;
      const tokenId = JSON.parse(createResponse.body).data.id;

      // Verify lastUsedAt is initially null
      const beforeUse = await prisma.apiToken.findUnique({
        where: { id: tokenId },
      });
      expect(beforeUse!.lastUsedAt).toBeNull();

      // Use the token
      await app.inject({
        method: "GET",
        url: "/api/v1/users/me",
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      });

      // Give async update time to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify lastUsedAt is now set
      const afterUse = await prisma.apiToken.findUnique({
        where: { id: tokenId },
      });
      expect(afterUse!.lastUsedAt).not.toBeNull();
    });

    it("should reject token when user is inactive", async () => {
      const { headers, user } = await createAuthenticatedUser();
      const prisma = getTestPrisma();

      // Create a token
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/v1/tokens",
        headers,
        payload: { name: "Inactive User Token" },
      });
      const apiToken = JSON.parse(createResponse.body).data.token;

      // Deactivate the user
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false },
      });

      // Try to use the token
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users/me",
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should immediately invalidate revoked token", async () => {
      const { headers } = await createAuthenticatedUser();

      // Create a token
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/v1/tokens",
        headers,
        payload: { name: "Token to Revoke" },
      });
      const apiToken = JSON.parse(createResponse.body).data.token;
      const tokenId = JSON.parse(createResponse.body).data.id;

      // Verify token works
      const beforeRevoke = await app.inject({
        method: "GET",
        url: "/api/v1/users/me",
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      });
      expect(beforeRevoke.statusCode).toBe(200);

      // Revoke the token
      await app.inject({
        method: "DELETE",
        url: `/api/v1/tokens/${tokenId}`,
        headers,
      });

      // Token should no longer work
      const afterRevoke = await app.inject({
        method: "GET",
        url: "/api/v1/users/me",
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      });
      expect(afterRevoke.statusCode).toBe(401);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("Edge Cases", () => {
    it("should handle token name with max length", async () => {
      const { headers } = await createAuthenticatedUser();
      const maxLengthName = "a".repeat(255);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/tokens",
        headers,
        payload: { name: maxLengthName },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.name).toBe(maxLengthName);
    });

    it("should reject token name exceeding max length", async () => {
      const { headers } = await createAuthenticatedUser();
      const tooLongName = "a".repeat(256);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/tokens",
        headers,
        payload: { name: tooLongName },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should pass through non-API tokens to JWT auth", async () => {
      // A regular JWT token should still work
      const { headers, user } = await createAuthenticatedUser();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users/me",
        headers,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(user.id);
    });

    it("should generate unique tokens", async () => {
      const { headers } = await createAuthenticatedUser();
      const tokens: string[] = [];

      // Create multiple tokens
      for (let i = 0; i < 5; i++) {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/tokens",
          headers,
          payload: { name: `Token ${i}` },
        });
        tokens.push(JSON.parse(response.body).data.token);
      }

      // All tokens should be unique
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(5);
    });
  });
});
