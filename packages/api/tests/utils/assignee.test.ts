import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock prisma before importing the module
vi.mock("../../src/lib/db.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import {
  resolveAssigneeId,
  isAssigneeNone,
  isAssigneeInvalid,
  ASSIGNEE_NONE,
  ASSIGNEE_INVALID,
} from "../../src/utils/assignee.js";
import { prisma } from "../../src/lib/db.js";

describe("Assignee Utilities", () => {
  const MOCK_USER_ID = "123e4567-e89b-12d3-a456-426614174000";
  const MOCK_CURRENT_USER_ID = "987fcdeb-51a2-3b4c-d567-890123456789";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("resolveAssigneeId", () => {
    describe("handling 'me' keyword", () => {
      it("should resolve 'me' to currentUserId when provided", async () => {
        const result = await resolveAssigneeId("me", MOCK_CURRENT_USER_ID);
        expect(result).toBe(MOCK_CURRENT_USER_ID);
      });

      it("should resolve 'ME' (uppercase) to currentUserId", async () => {
        const result = await resolveAssigneeId("ME", MOCK_CURRENT_USER_ID);
        expect(result).toBe(MOCK_CURRENT_USER_ID);
      });

      it("should resolve ' me ' (with whitespace) to currentUserId", async () => {
        const result = await resolveAssigneeId("  me  ", MOCK_CURRENT_USER_ID);
        expect(result).toBe(MOCK_CURRENT_USER_ID);
      });

      it("should return ASSIGNEE_INVALID when 'me' is used without currentUserId", async () => {
        const result = await resolveAssigneeId("me");
        expect(result).toBe(ASSIGNEE_INVALID);
      });

      it("should return ASSIGNEE_INVALID when 'me' is used with undefined currentUserId", async () => {
        const result = await resolveAssigneeId("me", undefined);
        expect(result).toBe(ASSIGNEE_INVALID);
      });
    });

    describe("handling 'none' keyword", () => {
      it("should return ASSIGNEE_NONE for 'none'", async () => {
        const result = await resolveAssigneeId("none");
        expect(result).toBe(ASSIGNEE_NONE);
      });

      it("should return ASSIGNEE_NONE for 'NONE' (uppercase)", async () => {
        const result = await resolveAssigneeId("NONE");
        expect(result).toBe(ASSIGNEE_NONE);
      });

      it("should return ASSIGNEE_NONE for ' none ' (with whitespace)", async () => {
        const result = await resolveAssigneeId("  none  ");
        expect(result).toBe(ASSIGNEE_NONE);
      });
    });

    describe("handling UUID format", () => {
      it("should return UUID as-is for valid UUID format", async () => {
        const uuid = "123e4567-e89b-12d3-a456-426614174000";
        const result = await resolveAssigneeId(uuid);
        expect(result).toBe(uuid);
      });

      it("should return UUID as-is for uppercase UUID", async () => {
        const uuid = "123E4567-E89B-12D3-A456-426614174000";
        const result = await resolveAssigneeId(uuid);
        expect(result).toBe(uuid);
      });

      it("should not perform database lookup for UUID format", async () => {
        const uuid = "123e4567-e89b-12d3-a456-426614174000";
        await resolveAssigneeId(uuid);
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
      });
    });

    describe("handling email addresses", () => {
      it("should resolve email to user ID when user is found and active", async () => {
        const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
        mockFindUnique.mockResolvedValue({
          id: MOCK_USER_ID,
          isActive: true,
        });

        const result = await resolveAssigneeId("user@example.com");

        expect(result).toBe(MOCK_USER_ID);
        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: { email: "user@example.com" },
          select: { id: true, isActive: true },
        });
      });

      it("should return ASSIGNEE_INVALID when user is not found", async () => {
        const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
        mockFindUnique.mockResolvedValue(null);

        const result = await resolveAssigneeId("unknown@example.com");

        expect(result).toBe(ASSIGNEE_INVALID);
      });

      it("should return ASSIGNEE_INVALID when user is inactive", async () => {
        const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
        mockFindUnique.mockResolvedValue({
          id: MOCK_USER_ID,
          isActive: false,
        });

        const result = await resolveAssigneeId("inactive@example.com");

        expect(result).toBe(ASSIGNEE_INVALID);
      });

      it("should handle email with different casing in query", async () => {
        const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
        mockFindUnique.mockResolvedValue({
          id: MOCK_USER_ID,
          isActive: true,
        });

        // Note: The original email casing is preserved for the database query
        await resolveAssigneeId("User@Example.COM");

        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: { email: "User@Example.COM" },
          select: { id: true, isActive: true },
        });
      });
    });

    describe("handling various string inputs", () => {
      it("should treat non-UUID non-keyword strings as email addresses", async () => {
        const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
        mockFindUnique.mockResolvedValue(null);

        await resolveAssigneeId("some-random-string");

        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: { email: "some-random-string" },
          select: { id: true, isActive: true },
        });
      });

      it("should handle strings that look like partial UUIDs", async () => {
        const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
        mockFindUnique.mockResolvedValue(null);

        // Missing parts of UUID format
        await resolveAssigneeId("123e4567-e89b-12d3");

        expect(prisma.user.findUnique).toHaveBeenCalled();
      });
    });
  });

  describe("isAssigneeNone", () => {
    it("should return true for ASSIGNEE_NONE symbol", () => {
      expect(isAssigneeNone(ASSIGNEE_NONE)).toBe(true);
    });

    it("should return false for ASSIGNEE_INVALID symbol", () => {
      expect(isAssigneeNone(ASSIGNEE_INVALID)).toBe(false);
    });

    it("should return false for string values", () => {
      expect(isAssigneeNone("123e4567-e89b-12d3-a456-426614174000")).toBe(false);
    });

    it("should return false for 'none' string (not the symbol)", () => {
      expect(isAssigneeNone("none")).toBe(false);
    });
  });

  describe("isAssigneeInvalid", () => {
    it("should return true for ASSIGNEE_INVALID symbol", () => {
      expect(isAssigneeInvalid(ASSIGNEE_INVALID)).toBe(true);
    });

    it("should return false for ASSIGNEE_NONE symbol", () => {
      expect(isAssigneeInvalid(ASSIGNEE_NONE)).toBe(false);
    });

    it("should return false for string values", () => {
      expect(isAssigneeInvalid("123e4567-e89b-12d3-a456-426614174000")).toBe(false);
    });

    it("should return false for 'invalid' string (not the symbol)", () => {
      expect(isAssigneeInvalid("invalid")).toBe(false);
    });
  });

  describe("Symbol uniqueness", () => {
    it("ASSIGNEE_NONE should be a unique Symbol", () => {
      expect(typeof ASSIGNEE_NONE).toBe("symbol");
      expect(ASSIGNEE_NONE.description).toBe("ASSIGNEE_NONE");
    });

    it("ASSIGNEE_INVALID should be a unique Symbol", () => {
      expect(typeof ASSIGNEE_INVALID).toBe("symbol");
      expect(ASSIGNEE_INVALID.description).toBe("ASSIGNEE_INVALID");
    });

    it("ASSIGNEE_NONE and ASSIGNEE_INVALID should be different", () => {
      expect(ASSIGNEE_NONE).not.toBe(ASSIGNEE_INVALID);
    });
  });

  describe("integration scenarios", () => {
    it("should correctly identify resolved values in typical workflow", async () => {
      const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
      mockFindUnique.mockResolvedValue({
        id: MOCK_USER_ID,
        isActive: true,
      });

      // Test 'me' path
      const meResult = await resolveAssigneeId("me", MOCK_CURRENT_USER_ID);
      expect(isAssigneeNone(meResult)).toBe(false);
      expect(isAssigneeInvalid(meResult)).toBe(false);
      expect(meResult).toBe(MOCK_CURRENT_USER_ID);

      // Test 'none' path
      const noneResult = await resolveAssigneeId("none");
      expect(isAssigneeNone(noneResult)).toBe(true);
      expect(isAssigneeInvalid(noneResult)).toBe(false);

      // Test email path
      const emailResult = await resolveAssigneeId("user@example.com");
      expect(isAssigneeNone(emailResult)).toBe(false);
      expect(isAssigneeInvalid(emailResult)).toBe(false);
      expect(emailResult).toBe(MOCK_USER_ID);

      // Test invalid path
      mockFindUnique.mockResolvedValue(null);
      const invalidResult = await resolveAssigneeId("notfound@example.com");
      expect(isAssigneeNone(invalidResult)).toBe(false);
      expect(isAssigneeInvalid(invalidResult)).toBe(true);
    });
  });
});
