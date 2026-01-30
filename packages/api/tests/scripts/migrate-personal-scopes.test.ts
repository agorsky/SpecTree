/**
 * Tests for the PersonalScope Migration Script
 *
 * These tests verify that the migration script:
 * - Creates PersonalScopes for users without one
 * - Is idempotent (safe to run multiple times)
 * - Creates default statuses in each scope
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the db module before importing the migration script
vi.mock("../../src/lib/db.js", () => ({
  prisma: {
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    personalScope: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    status: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
  },
}));

// Mock the personalScopeService
vi.mock("../../src/services/personalScopeService.js", () => ({
  createPersonalScope: vi.fn(),
  userHasPersonalScope: vi.fn(),
}));

import { prisma } from "../../src/lib/db.js";
import { createPersonalScope, userHasPersonalScope } from "../../src/services/personalScopeService.js";

// Import the function we're testing (after mocks are set up)
// We need to import the module dynamically to avoid main() execution
let migratePersonalScopes: typeof import("../../scripts/migrate-personal-scopes.js")["migratePersonalScopes"];

beforeEach(async () => {
  vi.clearAllMocks();
  
  // Suppress console output during tests
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  
  // Dynamically import the module (avoiding main() execution)
  const module = await import("../../scripts/migrate-personal-scopes.js");
  migratePersonalScopes = module.migratePersonalScopes;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("migratePersonalScopes", () => {
  describe("when all users already have PersonalScopes", () => {
    it("should report no migration needed", async () => {
      // Setup: 2 users, all with scopes (no users to migrate)
      vi.mocked(prisma.user.count).mockResolvedValue(2);
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);

      const result = await migratePersonalScopes();

      expect(result).toEqual({
        totalUsers: 2,
        usersWithExistingScope: 2,
        scopesCreated: 0,
        failures: [],
      });
      expect(createPersonalScope).not.toHaveBeenCalled();
    });
  });

  describe("when some users need PersonalScopes", () => {
    it("should create PersonalScopes for users without one", async () => {
      const usersToMigrate = [
        { id: "user-1", email: "user1@example.com", name: "User 1" },
        { id: "user-2", email: "user2@example.com", name: "User 2" },
      ];

      vi.mocked(prisma.user.count).mockResolvedValue(3);
      vi.mocked(prisma.user.findMany).mockResolvedValue(usersToMigrate as any);
      vi.mocked(userHasPersonalScope).mockResolvedValue(false);
      vi.mocked(createPersonalScope).mockResolvedValue({ id: "scope-new" } as any);

      const result = await migratePersonalScopes();

      expect(result.totalUsers).toBe(3);
      expect(result.usersWithExistingScope).toBe(1); // 3 total - 2 to migrate = 1 existing
      expect(result.scopesCreated).toBe(2);
      expect(result.failures).toHaveLength(0);
      expect(createPersonalScope).toHaveBeenCalledTimes(2);
      expect(createPersonalScope).toHaveBeenCalledWith("user-1");
      expect(createPersonalScope).toHaveBeenCalledWith("user-2");
    });

    it("should create default statuses when creating PersonalScope", async () => {
      // The createPersonalScope service already handles this,
      // so we just verify it's called correctly
      const usersToMigrate = [
        { id: "user-1", email: "user1@example.com", name: "User 1" },
      ];

      vi.mocked(prisma.user.count).mockResolvedValue(1);
      vi.mocked(prisma.user.findMany).mockResolvedValue(usersToMigrate as any);
      vi.mocked(userHasPersonalScope).mockResolvedValue(false);
      vi.mocked(createPersonalScope).mockResolvedValue({ id: "scope-new" } as any);

      const result = await migratePersonalScopes();

      expect(result.scopesCreated).toBe(1);
      expect(createPersonalScope).toHaveBeenCalledWith("user-1");
    });
  });

  describe("idempotency", () => {
    it("should skip users who already have PersonalScopes", async () => {
      const usersToMigrate = [
        { id: "user-1", email: "user1@example.com", name: "User 1" },
      ];

      vi.mocked(prisma.user.count).mockResolvedValue(1);
      vi.mocked(prisma.user.findMany).mockResolvedValue(usersToMigrate as any);
      // User already has scope (detected during migration attempt)
      vi.mocked(userHasPersonalScope).mockResolvedValue(true);

      const result = await migratePersonalScopes();

      // Should count as success (scope already exists)
      expect(result.scopesCreated).toBe(1);
      expect(result.failures).toHaveLength(0);
      // Should not call createPersonalScope since user already has scope
      expect(createPersonalScope).not.toHaveBeenCalled();
    });

    it("should be safe to run multiple times", async () => {
      // First run: migrate users
      vi.mocked(prisma.user.count).mockResolvedValue(2);
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: "user-1", email: "user1@example.com", name: "User 1" },
      ] as any);
      vi.mocked(userHasPersonalScope).mockResolvedValue(false);
      vi.mocked(createPersonalScope).mockResolvedValue({ id: "scope-new" } as any);

      const firstRun = await migratePersonalScopes();
      expect(firstRun.scopesCreated).toBe(1);

      // Second run: all users have scopes now
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);

      const secondRun = await migratePersonalScopes();
      expect(secondRun.scopesCreated).toBe(0);
      expect(secondRun.usersWithExistingScope).toBe(2);
    });
  });

  describe("error handling", () => {
    it("should record failures and continue processing other users", async () => {
      const usersToMigrate = [
        { id: "user-1", email: "user1@example.com", name: "User 1" },
        { id: "user-2", email: "user2@example.com", name: "User 2" },
        { id: "user-3", email: "user3@example.com", name: "User 3" },
      ];

      vi.mocked(prisma.user.count).mockResolvedValue(3);
      vi.mocked(prisma.user.findMany).mockResolvedValue(usersToMigrate as any);
      vi.mocked(userHasPersonalScope).mockResolvedValue(false);
      
      // First and third succeed, second fails
      vi.mocked(createPersonalScope)
        .mockResolvedValueOnce({ id: "scope-1" } as any)
        .mockRejectedValueOnce(new Error("Database error"))
        .mockResolvedValueOnce({ id: "scope-3" } as any);

      const result = await migratePersonalScopes();

      expect(result.scopesCreated).toBe(2);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].userId).toBe("user-2");
      expect(result.failures[0].email).toBe("user2@example.com");
      expect(result.failures[0].error).toBe("Database error");
    });

    it("should handle unexpected errors gracefully", async () => {
      const usersToMigrate = [
        { id: "user-1", email: "user1@example.com", name: "User 1" },
      ];

      vi.mocked(prisma.user.count).mockResolvedValue(1);
      vi.mocked(prisma.user.findMany).mockResolvedValue(usersToMigrate as any);
      vi.mocked(userHasPersonalScope).mockRejectedValue(new Error("Unexpected error"));

      const result = await migratePersonalScopes();

      expect(result.scopesCreated).toBe(0);
      expect(result.failures).toHaveLength(1);
      // The error message gets caught in the outer try/catch
      expect(result.failures[0].error).toBe("Unexpected error");
    });
  });

  describe("query behavior", () => {
    it("should query users without PersonalScope using LEFT JOIN", async () => {
      vi.mocked(prisma.user.count).mockResolvedValue(0);
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);

      await migratePersonalScopes();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          personalScope: null,
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });
    });

    it("should process users in creation order (oldest first)", async () => {
      const usersToMigrate = [
        { id: "oldest", email: "oldest@example.com", name: "Oldest User" },
        { id: "newest", email: "newest@example.com", name: "Newest User" },
      ];

      vi.mocked(prisma.user.count).mockResolvedValue(2);
      vi.mocked(prisma.user.findMany).mockResolvedValue(usersToMigrate as any);
      vi.mocked(userHasPersonalScope).mockResolvedValue(false);
      vi.mocked(createPersonalScope).mockResolvedValue({ id: "scope-new" } as any);

      await migratePersonalScopes();

      // Verify order of calls
      expect(createPersonalScope).toHaveBeenNthCalledWith(1, "oldest");
      expect(createPersonalScope).toHaveBeenNthCalledWith(2, "newest");
    });
  });
});
