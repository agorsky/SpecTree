/**
 * Integration Tests: User Invitation Flow (ENG-42)
 *
 * End-to-end tests covering the complete invitation workflow:
 * - Admin creates invitation
 * - Admin manages pending invitations
 * - User activates account with code
 * - Error scenarios and edge cases
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import Fastify from "fastify";
import { getTestPrisma, cleanupTestDatabase } from "../setup.js";
import authRoutes from "../../src/routes/auth.js";
import invitationRoutes from "../../src/routes/admin/invitations.js";
import { registerErrorHandler } from "../../src/middleware/errorHandler.js";
import {
  createTestGlobalAdmin,
  createTestUser,
  createTestInvitation,
  createExpiredTestInvitation,
  createUsedTestInvitation,
} from "../fixtures/factories.js";
import { createAuthHeader } from "../fixtures/auth.js";
import { createInvitation } from "../../src/services/invitationService.js";

describe("User Invitation Flow (E2E)", () => {
  let prisma: ReturnType<typeof getTestPrisma>;
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    prisma = getTestPrisma();

    // Create Fastify app with error handler and routes
    app = Fastify({ logger: false });
    registerErrorHandler(app);
    await app.register(authRoutes, { prefix: "/api/v1/auth" });
    await app.register(invitationRoutes, { prefix: "/api/v1/admin/invitations" });
    await app.ready();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // ===========================================================================
  // Happy Path: Complete Invitation Flow
  // ===========================================================================
  describe("Happy Path: Admin invites user, user activates", () => {
    it("completes full invitation flow successfully", async () => {
      // Step 1: Create admin user
      const admin = await createTestGlobalAdmin({
        email: "admin@toro.com",
        name: "Admin User",
      });
      const adminHeaders = createAuthHeader(admin.id);

      // Step 2: Admin creates invitation via service (simpler than route for setup)
      const invitation = await createInvitation("newuser@toro.com", admin.id);

      expect(invitation.code).toHaveLength(8);
      expect(invitation.email).toBe("newuser@toro.com");
      expect(invitation.usedAt).toBeNull();

      // Step 3: Admin can view pending invitation via API
      const listResponse = await app.inject({
        method: "GET",
        url: "/api/v1/admin/invitations",
        headers: adminHeaders,
      });

      expect(listResponse.statusCode).toBe(200);
      const pending = listResponse.json().invitations.find(
        (i: { id: string }) => i.id === invitation.id
      );
      expect(pending).toBeDefined();
      expect(pending.usedAt).toBeNull();

      // Step 4: User activates account with code
      const activateResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: "newuser@toro.com",
          code: invitation.code,
          name: "New User",
          password: "SecureP@ss123",
        },
      });

      expect(activateResponse.statusCode).toBe(201);
      const activateBody = activateResponse.json();
      expect(activateBody.user.email).toBe("newuser@toro.com");
      expect(activateBody.user.name).toBe("New User");
      expect(activateBody.tokens.accessToken).toBeDefined();
      expect(activateBody.tokens.refreshToken).toBeDefined();

      // Step 5: Verify invitation is marked as used
      const listAfterResponse = await app.inject({
        method: "GET",
        url: "/api/v1/admin/invitations?status=all",
        headers: adminHeaders,
      });

      const usedInvitation = listAfterResponse.json().invitations.find(
        (i: { id: string }) => i.id === invitation.id
      );
      expect(usedInvitation.usedAt).not.toBeNull();

      // Step 6: Verify same code cannot be reused
      const reuseResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: "another@toro.com",
          code: invitation.code,
          name: "Another User",
          password: "SecureP@ss123",
        },
      });

      expect(reuseResponse.statusCode).toBe(404);
    });

    it("allows admin to get specific invitation details", async () => {
      const admin = await createTestGlobalAdmin();
      const adminHeaders = createAuthHeader(admin.id);
      const invitation = await createTestInvitation(admin.id, {
        email: "detail@toro.com",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/admin/invitations/${invitation.id}`,
        headers: adminHeaders,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.email).toBe("detail@toro.com");
    });

    it("allows admin to revoke pending invitation", async () => {
      const admin = await createTestGlobalAdmin();
      const adminHeaders = createAuthHeader(admin.id);
      const invitation = await createTestInvitation(admin.id, {
        email: "revoke@toro.com",
      });

      // Revoke the invitation
      const revokeResponse = await app.inject({
        method: "DELETE",
        url: `/api/v1/admin/invitations/${invitation.id}`,
        headers: adminHeaders,
      });

      expect(revokeResponse.statusCode).toBe(204);

      // Verify activation fails
      const activateResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: "revoke@toro.com",
          code: invitation.code,
          name: "Revoked User",
          password: "SecureP@ss123",
        },
      });

      expect(activateResponse.statusCode).toBe(404);
    });

    it("creates invitation via POST endpoint", async () => {
      const admin = await createTestGlobalAdmin();
      const adminHeaders = createAuthHeader(admin.id);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/admin/invitations",
        headers: adminHeaders,
        payload: { email: "viapost@toro.com" },
      });

      expect(response.statusCode).toBe(201);
      const data = response.json().data;
      expect(data.email).toBe("viapost@toro.com");
      expect(data.code).toHaveLength(8);
    });
  });

  // ===========================================================================
  // Invitation Creation Errors
  // ===========================================================================
  describe("Invitation Creation Errors", () => {
    it("rejects non-admin users creating invitations", async () => {
      const regularUser = await createTestUser({
        email: "regular@toro.com",
        name: "Regular User",
      });
      const userHeaders = createAuthHeader(regularUser.id);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/admin/invitations",
        headers: userHeaders,
        payload: { email: "test@toro.com" },
      });

      expect(response.statusCode).toBe(403);
    });

    it("rejects non-@toro.com emails", async () => {
      const admin = await createTestGlobalAdmin();
      const adminHeaders = createAuthHeader(admin.id);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/admin/invitations",
        headers: adminHeaders,
        payload: { email: "user@gmail.com" },
      });

      expect(response.statusCode).toBe(400);
      // Check validation error details contain the domain message
      const body = response.json();
      expect(body.error.details?.errors?.[0]?.message).toContain("@toro.com");
    });

    it("rejects duplicate pending invitations", async () => {
      const admin = await createTestGlobalAdmin();
      const adminHeaders = createAuthHeader(admin.id);

      // Create first invitation via service
      await createInvitation("duplicate@toro.com", admin.id);

      // Try to create second via API
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/admin/invitations",
        headers: adminHeaders,
        payload: { email: "duplicate@toro.com" },
      });

      expect(response.statusCode).toBe(409);
    });

    it("rejects invitations for existing users", async () => {
      const admin = await createTestGlobalAdmin();
      const adminHeaders = createAuthHeader(admin.id);
      await createTestUser({ email: "existing@toro.com" });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/admin/invitations",
        headers: adminHeaders,
        payload: { email: "existing@toro.com" },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().error.message).toContain("already exists");
    });

    it("rejects unauthenticated requests", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/admin/invitations",
        payload: { email: "test@toro.com" },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ===========================================================================
  // Activation Errors
  // ===========================================================================
  describe("Activation Errors", () => {
    it("rejects expired codes", async () => {
      const admin = await createTestGlobalAdmin();
      const expiredInvitation = await createExpiredTestInvitation(admin.id, "expired@toro.com");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: expiredInvitation.email,
          code: expiredInvitation.code,
          name: "Expired User",
          password: "SecureP@ss123",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain("expired");
    });

    it("rejects already used codes", async () => {
      const admin = await createTestGlobalAdmin();
      const usedInvitation = await createUsedTestInvitation(admin.id, "used@toro.com");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: usedInvitation.email,
          code: usedInvitation.code,
          name: "Already Used",
          password: "SecureP@ss123",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain("already been used");
    });

    it("rejects code with wrong email", async () => {
      const admin = await createTestGlobalAdmin();
      const invitation = await createTestInvitation(admin.id, {
        email: "correct@toro.com",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: "wrong@toro.com",
          code: invitation.code,
          name: "Wrong Email",
          password: "SecureP@ss123",
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("rejects invalid code format", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: "test@toro.com",
          code: "SHORT", // Not 8 characters
          name: "Test User",
          password: "SecureP@ss123",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects weak passwords - too short", async () => {
      const admin = await createTestGlobalAdmin();
      const invitation = await createTestInvitation(admin.id, {
        email: "weakpass@toro.com",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: invitation.email,
          code: invitation.code,
          name: "Weak Password",
          password: "Pass1", // Too short
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects passwords without uppercase", async () => {
      const admin = await createTestGlobalAdmin();
      const invitation = await createTestInvitation(admin.id, {
        email: "noupper@toro.com",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: invitation.email,
          code: invitation.code,
          name: "No Upper",
          password: "password123", // No uppercase
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects passwords without lowercase", async () => {
      const admin = await createTestGlobalAdmin();
      const invitation = await createTestInvitation(admin.id, {
        email: "nolower@toro.com",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: invitation.email,
          code: invitation.code,
          name: "No Lower",
          password: "PASSWORD123", // No lowercase
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects passwords without numbers", async () => {
      const admin = await createTestGlobalAdmin();
      const invitation = await createTestInvitation(admin.id, {
        email: "nonumber@toro.com",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: invitation.email,
          code: invitation.code,
          name: "No Number",
          password: "PasswordOnly", // No number
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ===========================================================================
  // List Invitations with Filters
  // ===========================================================================
  describe("List Invitations Filtering", () => {
    it("filters pending invitations by default", async () => {
      const admin = await createTestGlobalAdmin();
      const adminHeaders = createAuthHeader(admin.id);
      
      // Create invitations in different states
      await createTestInvitation(admin.id, { email: "pending1@toro.com" });
      await createTestInvitation(admin.id, { email: "pending2@toro.com" });
      await createUsedTestInvitation(admin.id, "used@toro.com");
      await createExpiredTestInvitation(admin.id, "expired@toro.com");

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/admin/invitations",
        headers: adminHeaders,
      });

      expect(response.statusCode).toBe(200);
      const invitations = response.json().invitations;
      // Only pending (not expired, not used) should be returned
      expect(invitations.every((i: { usedAt: null }) => i.usedAt === null)).toBe(true);
      expect(invitations.length).toBe(2);
    });

    it("filters used invitations", async () => {
      const admin = await createTestGlobalAdmin();
      const adminHeaders = createAuthHeader(admin.id);
      
      await createTestInvitation(admin.id, { email: "pending@toro.com" });
      await createUsedTestInvitation(admin.id, "used@toro.com");

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/admin/invitations?status=used",
        headers: adminHeaders,
      });

      expect(response.statusCode).toBe(200);
      const invitations = response.json().invitations;
      expect(invitations.every((i: { usedAt: string | null }) => i.usedAt !== null)).toBe(true);
    });

    it("returns all invitations when status=all", async () => {
      const admin = await createTestGlobalAdmin();
      const adminHeaders = createAuthHeader(admin.id);
      
      await createTestInvitation(admin.id, { email: "pending@toro.com" });
      await createUsedTestInvitation(admin.id, "used@toro.com");
      await createExpiredTestInvitation(admin.id, "expired@toro.com");

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/admin/invitations?status=all",
        headers: adminHeaders,
      });

      expect(response.statusCode).toBe(200);
      const invitations = response.json().invitations;
      expect(invitations.length).toBe(3);
    });
  });

  // ===========================================================================
  // Revocation Edge Cases
  // ===========================================================================
  describe("Revocation Edge Cases", () => {
    it("cannot revoke already used invitations", async () => {
      const admin = await createTestGlobalAdmin();
      const adminHeaders = createAuthHeader(admin.id);
      const usedInvitation = await createUsedTestInvitation(admin.id);

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/admin/invitations/${usedInvitation.id}`,
        headers: adminHeaders,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain("Cannot revoke used invitation");
    });

    it("returns 404 for non-existent invitation", async () => {
      const admin = await createTestGlobalAdmin();
      const adminHeaders = createAuthHeader(admin.id);

      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/admin/invitations/00000000-0000-0000-0000-000000000000",
        headers: adminHeaders,
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
