/**
 * Integration Tests: Account Activation Endpoint (ENG-46)
 *
 * Tests the POST /api/v1/auth/activate endpoint:
 * - Activates account with valid invitation code
 * - Validates password requirements
 * - Rejects expired/used codes
 * - Handles race conditions
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import Fastify from "fastify";
import { getTestPrisma, cleanupTestDatabase } from "../setup.js";
import authRoutes from "../../src/routes/auth.js";
import {
  createInvitation,
  validateAndUseInvitation,
} from "../../src/services/invitationService.js";
import { createTestUser } from "../fixtures/factories.js";

describe("POST /api/v1/auth/activate", () => {
  let prisma: ReturnType<typeof getTestPrisma>;
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    prisma = getTestPrisma();
    
    // Create Fastify app for testing
    app = Fastify();
    await app.register(authRoutes, { prefix: "/api/v1/auth" });
    await app.ready();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe("successful activation", () => {
    it("activates account with valid code", async () => {
      // Create admin user to create invitation
      const admin = await createTestUser({
        email: "admin@toro.com",
        name: "Admin User",
      });

      // Create invitation
      const invitation = await createInvitation("newuser@toro.com", admin.id);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: invitation.email,
          code: invitation.code,
          name: "New User",
          password: "SecureP@ss1",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.user.email).toBe("newuser@toro.com");
      expect(body.user.name).toBe("New User");
      expect(body.tokens.accessToken).toBeDefined();
      expect(body.tokens.refreshToken).toBeDefined();

      // Verify user was created in database
      const user = await prisma.user.findUnique({
        where: { email: "newuser@toro.com" },
      });
      expect(user).not.toBeNull();
      expect(user!.name).toBe("New User");
      expect(user!.isActive).toBe(true);

      // Verify PersonalScope was created
      const personalScope = await prisma.personalScope.findFirst({
        where: { userId: user!.id },
      });
      expect(personalScope).not.toBeNull();
    });

    it("activates multiple accounts without unique constraint collision", async () => {
      const admin = await createTestUser({
        email: "admin-multi@toro.com",
        name: "Admin",
      });

      // Create two invitations
      const invitation1 = await createInvitation("user1@toro.com", admin.id);
      const invitation2 = await createInvitation("user2@toro.com", admin.id);

      // Activate first user
      const response1 = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: invitation1.email,
          code: invitation1.code,
          name: "User One",
          password: "SecureP@ss1",
        },
      });
      expect(response1.statusCode).toBe(201);

      // Activate second user — this previously failed on SQL Server
      // due to @@unique([teamId, name]) treating NULL teamId as duplicate
      const response2 = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: invitation2.email,
          code: invitation2.code,
          name: "User Two",
          password: "SecureP@ss2",
        },
      });
      expect(response2.statusCode).toBe(201);

      // Verify both users have personal scopes with statuses
      const user1 = await prisma.user.findUnique({ where: { email: "user1@toro.com" } });
      const user2 = await prisma.user.findUnique({ where: { email: "user2@toro.com" } });
      expect(user1).not.toBeNull();
      expect(user2).not.toBeNull();

      const scope1 = await prisma.personalScope.findFirst({ where: { userId: user1!.id } });
      const scope2 = await prisma.personalScope.findFirst({ where: { userId: user2!.id } });
      expect(scope1).not.toBeNull();
      expect(scope2).not.toBeNull();

      // Verify each scope has its own statuses
      const statuses1 = await prisma.status.findMany({ where: { personalScopeId: scope1!.id } });
      const statuses2 = await prisma.status.findMany({ where: { personalScopeId: scope2!.id } });
      expect(statuses1.length).toBe(5);
      expect(statuses2.length).toBe(5);
    });

    it("normalizes email to lowercase", async () => {
      const admin = await createTestUser({
        email: "admin2@toro.com",
        name: "Admin",
      });
      const invitation = await createInvitation("UPPER@toro.com", admin.id);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: "UPPER@TORO.COM",
          code: invitation.code,
          name: "Upper Case User",
          password: "SecureP@ss1",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.user.email).toBe("upper@toro.com");
    });

    it("accepts lowercase invitation code", async () => {
      const admin = await createTestUser({
        email: "admin3@toro.com",
        name: "Admin",
      });
      const invitation = await createInvitation("lowercase@toro.com", admin.id);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: invitation.email,
          code: invitation.code.toLowerCase(),
          name: "Lowercase Code User",
          password: "SecureP@ss1",
        },
      });

      expect(response.statusCode).toBe(201);
    });
  });

  describe("validation errors", () => {
    it("rejects invalid email format", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: "not-an-email",
          code: "ABCD1234",
          name: "Test User",
          password: "SecureP@ss1",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects short name", async () => {
      const admin = await createTestUser({
        email: "admin4@toro.com",
        name: "Admin",
      });
      const invitation = await createInvitation("shortname@toro.com", admin.id);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: invitation.email,
          code: invitation.code,
          name: "A", // Too short
          password: "SecureP@ss1",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects weak password - too short", async () => {
      const admin = await createTestUser({
        email: "admin5@toro.com",
        name: "Admin",
      });
      const invitation = await createInvitation("weakpass@toro.com", admin.id);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: invitation.email,
          code: invitation.code,
          name: "Weak Password User",
          password: "Pass1", // Too short
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects password without uppercase", async () => {
      const admin = await createTestUser({
        email: "admin6@toro.com",
        name: "Admin",
      });
      const invitation = await createInvitation("nouppercase@toro.com", admin.id);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: invitation.email,
          code: invitation.code,
          name: "No Uppercase User",
          password: "password1", // No uppercase
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects password without lowercase", async () => {
      const admin = await createTestUser({
        email: "admin7@toro.com",
        name: "Admin",
      });
      const invitation = await createInvitation("nolowercase@toro.com", admin.id);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: invitation.email,
          code: invitation.code,
          name: "No Lowercase User",
          password: "PASSWORD1", // No lowercase
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects password without number", async () => {
      const admin = await createTestUser({
        email: "admin8@toro.com",
        name: "Admin",
      });
      const invitation = await createInvitation("nonumber@toro.com", admin.id);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: invitation.email,
          code: invitation.code,
          name: "No Number User",
          password: "PasswordOnly", // No number
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("rejects invalid code length", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: "test@toro.com",
          code: "SHORT", // Not 8 characters
          name: "Test User",
          password: "SecureP@ss1",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("invitation errors", () => {
    it("rejects invalid code", async () => {
      const admin = await createTestUser({
        email: "admin9@toro.com",
        name: "Admin",
      });
      await createInvitation("valid@toro.com", admin.id);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: "valid@toro.com",
          code: "WRONGCOD", // Wrong code
          name: "Wrong Code User",
          password: "SecureP@ss1",
        },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.message).toContain("Invalid email or code");
    });

    it("rejects already used codes", async () => {
      const admin = await createTestUser({
        email: "admin10@toro.com",
        name: "Admin",
      });
      const invitation = await createInvitation("usedcode@toro.com", admin.id);

      // Use the invitation first
      await validateAndUseInvitation(invitation.email, invitation.code);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: invitation.email,
          code: invitation.code,
          name: "Already Used User",
          password: "SecureP@ss1",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.message).toContain("already been used");
    });

    it("rejects expired codes", async () => {
      const admin = await createTestUser({
        email: "admin11@toro.com",
        name: "Admin",
      });

      // Create invitation manually with past expiry
      const expiredInvitation = await prisma.userInvitation.create({
        data: {
          email: "expired@toro.com",
          code: "EXPIRED1",
          createdBy: admin.id,
          expiresAt: new Date(Date.now() - 1000), // Already expired
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: expiredInvitation.email,
          code: expiredInvitation.code,
          name: "Expired User",
          password: "SecureP@ss1",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.message).toContain("expired");
    });

    it("rejects mismatched email", async () => {
      const admin = await createTestUser({
        email: "admin12@toro.com",
        name: "Admin",
      });
      const invitation = await createInvitation("correct@toro.com", admin.id);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: "wrong@toro.com", // Different email
          code: invitation.code,
          name: "Wrong Email User",
          password: "SecureP@ss1",
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("conflict errors", () => {
    it("rejects if email already has an account", async () => {
      const admin = await createTestUser({
        email: "admin13@toro.com",
        name: "Admin",
      });
      
      // Create invitation
      const invitation = await createInvitation("existing@toro.com", admin.id);

      // Create user with same email directly
      await createTestUser({
        email: "existing@toro.com",
        name: "Existing User",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/activate",
        payload: {
          email: invitation.email,
          code: invitation.code,
          name: "Duplicate User",
          password: "SecureP@ss1",
        },
      });

      expect(response.statusCode).toBe(409);
      const body = response.json();
      expect(body.message).toContain("already exists");

      // Verify invitation was NOT consumed (atomicity)
      const inv = await prisma.userInvitation.findUnique({
        where: { id: invitation.id },
      });
      expect(inv).not.toBeNull();
      expect(inv!.usedAt).toBeNull();
    });
  });
});
