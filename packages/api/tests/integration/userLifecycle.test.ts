/**
 * Integration Tests: User Lifecycle (COM-319)
 *
 * Tests the complete user lifecycle with PersonalScope:
 * - User creation automatically creates PersonalScope with default statuses
 * - PersonalScope is cascade deleted when user is deleted (if supported)
 *
 * @see COM-319, COM-277
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { getTestPrisma, cleanupTestDatabase } from "../setup.js";
import { createUser, softDeleteUser, getUserById } from "../../src/services/userService.js";
import { getPersonalScopeByUserId } from "../../src/services/personalScopeService.js";

describe("User Lifecycle Integration Tests", () => {
  let prisma: ReturnType<typeof getTestPrisma>;

  beforeAll(async () => {
    prisma = getTestPrisma();
  });

  beforeEach(async () => {
    await cleanupTestDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("User Creation with PersonalScope", () => {
    it("should automatically create PersonalScope when user is created", async () => {
      // Create a new user
      const user = await createUser({
        email: "newuser@test.com",
        name: "New User",
        password: "password123",
      });

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe("newuser@test.com");

      // Verify PersonalScope was created
      const personalScope = await getPersonalScopeByUserId(user.id);
      expect(personalScope).not.toBeNull();
      expect(personalScope!.userId).toBe(user.id);
    });

    it("should create default statuses for the PersonalScope", async () => {
      const user = await createUser({
        email: "statususer@test.com",
        name: "Status User",
        password: "password123",
      });

      // Get the PersonalScope
      const personalScope = await getPersonalScopeByUserId(user.id);
      expect(personalScope).not.toBeNull();

      // Verify default statuses were created
      const statuses = await prisma.status.findMany({
        where: { personalScopeId: personalScope!.id },
        orderBy: { position: "asc" },
      });

      expect(statuses.length).toBeGreaterThanOrEqual(4);

      // Check expected default status categories
      const categories = statuses.map((s) => s.category);
      expect(categories).toContain("backlog");
      expect(categories).toContain("unstarted");
      expect(categories).toContain("started");
      expect(categories).toContain("completed");
    });

    it("should NOT auto-join user to any teams", async () => {
      // Create some teams first
      await prisma.team.create({
        data: { name: "Team A", key: "TA" },
      });
      await prisma.team.create({
        data: { name: "Team B", key: "TB" },
      });

      // Create a new user
      const user = await createUser({
        email: "isolated@test.com",
        name: "Isolated User",
        password: "password123",
      });

      // Verify user has no team memberships
      const memberships = await prisma.membership.findMany({
        where: { userId: user.id },
      });

      expect(memberships).toHaveLength(0);
    });

    it("should handle concurrent user creation correctly", async () => {
      // Create multiple users concurrently
      const userPromises = [
        createUser({ email: "user1@test.com", name: "User 1", password: "pass1" }),
        createUser({ email: "user2@test.com", name: "User 2", password: "pass2" }),
        createUser({ email: "user3@test.com", name: "User 3", password: "pass3" }),
      ];

      const users = await Promise.all(userPromises);

      // Each user should have their own PersonalScope
      for (const user of users) {
        const scope = await getPersonalScopeByUserId(user.id);
        expect(scope).not.toBeNull();
        expect(scope!.userId).toBe(user.id);
      }

      // Verify all scopes are unique
      const scopeIds = await Promise.all(
        users.map(async (u) => {
          const s = await getPersonalScopeByUserId(u.id);
          return s!.id;
        })
      );
      const uniqueIds = new Set(scopeIds);
      expect(uniqueIds.size).toBe(users.length);
    });

    it("should create user with avatar URL and still create PersonalScope", async () => {
      const user = await createUser({
        email: "avatar@test.com",
        name: "Avatar User",
        password: "password123",
        avatarUrl: "https://example.com/avatar.png",
      });

      expect(user.avatarUrl).toBe("https://example.com/avatar.png");

      // PersonalScope should still be created
      const personalScope = await getPersonalScopeByUserId(user.id);
      expect(personalScope).not.toBeNull();
    });
  });

  describe("User Soft Delete", () => {
    it("should soft delete user (set isActive to false)", async () => {
      const user = await createUser({
        email: "todelete@test.com",
        name: "To Delete",
        password: "password123",
      });

      expect(user.isActive).toBe(true);

      // Soft delete
      const deletedUser = await softDeleteUser(user.id);

      expect(deletedUser).not.toBeNull();
      expect(deletedUser!.isActive).toBe(false);

      // Verify via direct query
      const foundUser = await getUserById(user.id);
      expect(foundUser!.isActive).toBe(false);
    });

    it("should preserve PersonalScope after soft delete", async () => {
      const user = await createUser({
        email: "softdel@test.com",
        name: "Soft Delete User",
        password: "password123",
      });

      const personalScope = await getPersonalScopeByUserId(user.id);
      expect(personalScope).not.toBeNull();

      // Soft delete
      await softDeleteUser(user.id);

      // PersonalScope should still exist (soft delete doesn't remove data)
      const scopeAfterDelete = await getPersonalScopeByUserId(user.id);
      expect(scopeAfterDelete).not.toBeNull();
      expect(scopeAfterDelete!.id).toBe(personalScope!.id);
    });

    it("should preserve user's personal projects after soft delete", async () => {
      const user = await createUser({
        email: "projectuser@test.com",
        name: "Project User",
        password: "password123",
      });

      const personalScope = await getPersonalScopeByUserId(user.id);

      // Create a personal project
      const project = await prisma.project.create({
        data: {
          name: "My Personal Project",
          personalScopeId: personalScope!.id,
          scopeType: "personal",
          sortOrder: 0,
        },
      });

      // Soft delete user
      await softDeleteUser(user.id);

      // Project should still exist
      const foundProject = await prisma.project.findUnique({
        where: { id: project.id },
      });
      expect(foundProject).not.toBeNull();
      expect(foundProject!.name).toBe("My Personal Project");
    });
  });

  describe("New User Onboarding Behavior", () => {
    it("should start new users with PersonalScope only, no team memberships", async () => {
      // Setup: Create multiple teams
      const team1 = await prisma.team.create({
        data: { name: "Engineering", key: "ENG" },
      });
      const team2 = await prisma.team.create({
        data: { name: "Marketing", key: "MKT" },
      });

      // Add an existing user to both teams
      const existingUser = await createUser({
        email: "existing@test.com",
        name: "Existing User",
        password: "password123",
      });
      await prisma.membership.create({
        data: { userId: existingUser.id, teamId: team1.id, role: "admin" },
      });
      await prisma.membership.create({
        data: { userId: existingUser.id, teamId: team2.id, role: "member" },
      });

      // Create a new user (simulating new signup)
      const newUser = await createUser({
        email: "newbie@test.com",
        name: "New User",
        password: "password123",
      });

      // New user should have PersonalScope
      const personalScope = await getPersonalScopeByUserId(newUser.id);
      expect(personalScope).not.toBeNull();

      // New user should have NO team memberships
      const memberships = await prisma.membership.findMany({
        where: { userId: newUser.id },
      });
      expect(memberships).toHaveLength(0);

      // Verify this is different from existing user (who has memberships)
      const existingMemberships = await prisma.membership.findMany({
        where: { userId: existingUser.id },
      });
      expect(existingMemberships.length).toBeGreaterThan(0);
    });

    it("should allow admin to add new user to team after creation", async () => {
      const team = await prisma.team.create({
        data: { name: "New Team", key: "NT" },
      });

      const newUser = await createUser({
        email: "addtoteam@test.com",
        name: "Add To Team",
        password: "password123",
      });

      // Initially no memberships
      let memberships = await prisma.membership.findMany({
        where: { userId: newUser.id },
      });
      expect(memberships).toHaveLength(0);

      // Admin adds user to team (direct add)
      await prisma.membership.create({
        data: { userId: newUser.id, teamId: team.id, role: "member" },
      });

      // Now has membership
      memberships = await prisma.membership.findMany({
        where: { userId: newUser.id },
      });
      expect(memberships).toHaveLength(1);
      expect(memberships[0].teamId).toBe(team.id);
    });
  });
});
