import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("../../src/lib/db.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    userInvitation: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "../../src/lib/db.js";
import {
  generateInviteCode,
  createInvitation,
  listInvitations,
  getInvitationById,
  getInvitationByCode,
  revokeInvitation,
  validateAndUseInvitation,
} from "../../src/services/invitationService.js";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
} from "../../src/errors/index.js";

describe("invitationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // generateInviteCode
  // ==========================================================================
  describe("generateInviteCode", () => {
    it("generates 8-character codes", () => {
      const code = generateInviteCode();
      expect(code).toHaveLength(8);
    });

    it("uses only unambiguous characters (no 0, O, 1, I, L)", () => {
      // Generate multiple codes and verify character set
      for (let i = 0; i < 50; i++) {
        const code = generateInviteCode();
        expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
      }
    });

    it("generates unique codes", () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateInviteCode());
      }
      // All 100 codes should be unique
      expect(codes.size).toBe(100);
    });
  });

  // ==========================================================================
  // createInvitation
  // ==========================================================================
  describe("createInvitation", () => {
    const mockCreator = {
      id: "admin-123",
      name: "Admin User",
      email: "admin@toro.com",
    };

    it("creates invitation for valid @toro.com email", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.userInvitation.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.userInvitation.create).mockResolvedValue({
        id: "inv-123",
        email: "new@toro.com",
        code: "ABCD1234",
        createdBy: "admin-123",
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        usedAt: null,
        createdAt: new Date(),
        creator: mockCreator,
      } as any);

      const result = await createInvitation("New@Toro.com", "admin-123");

      expect(result.email).toBe("new@toro.com"); // Normalized to lowercase
      expect(result.code).toHaveLength(8);
      expect(prisma.userInvitation.create).toHaveBeenCalledWith({
        data: {
          email: "new@toro.com",
          code: expect.any(String),
          createdBy: "admin-123",
          expiresAt: expect.any(Date),
        },
        include: {
          creator: { select: { id: true, name: true, email: true } },
        },
      });
    });

    it("rejects non-@toro.com emails", async () => {
      await expect(
        createInvitation("test@gmail.com", "admin-123")
      ).rejects.toThrow(ValidationError);
      await expect(
        createInvitation("test@gmail.com", "admin-123")
      ).rejects.toThrow("must end with @toro.com");
    });

    it("rejects emails for existing users", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-existing",
        email: "existing@toro.com",
      } as any);

      await expect(
        createInvitation("existing@toro.com", "admin-123")
      ).rejects.toThrow(ConflictError);
      await expect(
        createInvitation("existing@toro.com", "admin-123")
      ).rejects.toThrow("User with this email already exists");
    });

    it("rejects when pending invitation exists", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.userInvitation.findUnique).mockResolvedValue({
        id: "existing-inv",
        email: "pending@toro.com",
        usedAt: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Still valid
      } as any);

      await expect(
        createInvitation("pending@toro.com", "admin-123")
      ).rejects.toThrow(ConflictError);
      await expect(
        createInvitation("pending@toro.com", "admin-123")
      ).rejects.toThrow("Pending invitation already exists");
    });

    it("allows new invitation when previous is expired", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.userInvitation.findUnique).mockResolvedValue({
        id: "expired-inv",
        email: "expired@toro.com",
        usedAt: null,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired
      } as any);
      vi.mocked(prisma.userInvitation.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.userInvitation.create).mockResolvedValue({
        id: "new-inv",
        email: "expired@toro.com",
        code: "NEWCODE1",
        createdBy: "admin-123",
        expiresAt: new Date(),
        usedAt: null,
        createdAt: new Date(),
        creator: mockCreator,
      } as any);

      const result = await createInvitation("expired@toro.com", "admin-123");

      expect(result.id).toBe("new-inv");
      expect(prisma.userInvitation.delete).toHaveBeenCalledWith({
        where: { id: "expired-inv" },
      });
    });

    it("allows new invitation when previous was used", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.userInvitation.findUnique).mockResolvedValue({
        id: "used-inv",
        email: "used@toro.com",
        usedAt: new Date(), // Already used
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      } as any);
      vi.mocked(prisma.userInvitation.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.userInvitation.create).mockResolvedValue({
        id: "new-inv",
        email: "used@toro.com",
        code: "NEWCODE2",
        createdBy: "admin-123",
        expiresAt: new Date(),
        usedAt: null,
        createdAt: new Date(),
        creator: mockCreator,
      } as any);

      const result = await createInvitation("used@toro.com", "admin-123");

      expect(result.id).toBe("new-inv");
    });
  });

  // ==========================================================================
  // listInvitations
  // ==========================================================================
  describe("listInvitations", () => {
    const mockInvitations = [
      {
        id: "inv-1",
        email: "user1@toro.com",
        code: "CODE1234",
        usedAt: null,
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        createdAt: new Date(),
        creator: { id: "admin-1", name: "Admin", email: "admin@toro.com" },
      },
      {
        id: "inv-2",
        email: "user2@toro.com",
        code: "CODE5678",
        usedAt: null,
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        createdAt: new Date(),
        creator: { id: "admin-1", name: "Admin", email: "admin@toro.com" },
      },
    ];

    it("lists pending invitations by default", async () => {
      vi.mocked(prisma.userInvitation.findMany).mockResolvedValue(
        mockInvitations as any
      );

      const result = await listInvitations();

      expect(result.invitations).toHaveLength(2);
      expect(prisma.userInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            usedAt: null,
            expiresAt: { gt: expect.any(Date) },
          },
          take: 21, // limit + 1 for hasMore check
          orderBy: { createdAt: "desc" },
          include: {
            creator: { select: { id: true, name: true, email: true } },
          },
        })
      );
    });

    it("filters by used status", async () => {
      vi.mocked(prisma.userInvitation.findMany).mockResolvedValue([]);

      await listInvitations({ status: "used" });

      expect(prisma.userInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { usedAt: { not: null } },
        })
      );
    });

    it("filters by expired status", async () => {
      vi.mocked(prisma.userInvitation.findMany).mockResolvedValue([]);

      await listInvitations({ status: "expired" });

      expect(prisma.userInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { usedAt: null, expiresAt: { lte: expect.any(Date) } },
        })
      );
    });

    it("returns all invitations when status is all", async () => {
      vi.mocked(prisma.userInvitation.findMany).mockResolvedValue([]);

      await listInvitations({ status: "all" });

      expect(prisma.userInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });

    it("handles pagination correctly", async () => {
      // Return limit + 1 items to indicate there's more
      const manyInvitations = [...Array(21)].map((_, i) => ({
        id: `inv-${i}`,
        email: `user${i}@toro.com`,
        code: `CODE${i}`,
        createdAt: new Date(),
        creator: { id: "admin-1", name: "Admin", email: "admin@toro.com" },
      }));
      vi.mocked(prisma.userInvitation.findMany).mockResolvedValue(
        manyInvitations as any
      );

      const result = await listInvitations({ limit: 20 });

      expect(result.invitations).toHaveLength(20);
      expect(result.meta.hasMore).toBe(true);
      expect(result.meta.cursor).toBe("inv-19");
    });

    it("handles cursor-based pagination", async () => {
      vi.mocked(prisma.userInvitation.findMany).mockResolvedValue([]);

      await listInvitations({ cursor: "inv-10", limit: 10 });

      expect(prisma.userInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: "inv-10" },
          skip: 1, // Skip the cursor item
          take: 11,
        })
      );
    });
  });

  // ==========================================================================
  // getInvitationById
  // ==========================================================================
  describe("getInvitationById", () => {
    it("returns invitation when found", async () => {
      const mockInvitation = {
        id: "inv-123",
        email: "test@toro.com",
        code: "TESTCODE",
        creator: { id: "admin-1", name: "Admin", email: "admin@toro.com" },
      };
      vi.mocked(prisma.userInvitation.findUnique).mockResolvedValue(
        mockInvitation as any
      );

      const result = await getInvitationById("inv-123");

      expect(result).toEqual(mockInvitation);
      expect(prisma.userInvitation.findUnique).toHaveBeenCalledWith({
        where: { id: "inv-123" },
        include: {
          creator: { select: { id: true, name: true, email: true } },
        },
      });
    });

    it("returns null when not found", async () => {
      vi.mocked(prisma.userInvitation.findUnique).mockResolvedValue(null);

      const result = await getInvitationById("nonexistent");

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // getInvitationByCode
  // ==========================================================================
  describe("getInvitationByCode", () => {
    it("returns invitation when found (case-insensitive)", async () => {
      const mockInvitation = { id: "inv-123", code: "ABCD1234" };
      vi.mocked(prisma.userInvitation.findUnique).mockResolvedValue(
        mockInvitation as any
      );

      const result = await getInvitationByCode("abcd1234");

      expect(result).toEqual(mockInvitation);
      expect(prisma.userInvitation.findUnique).toHaveBeenCalledWith({
        where: { code: "ABCD1234" }, // Uppercased
      });
    });

    it("returns null when not found", async () => {
      vi.mocked(prisma.userInvitation.findUnique).mockResolvedValue(null);

      const result = await getInvitationByCode("NOTFOUND");

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // revokeInvitation
  // ==========================================================================
  describe("revokeInvitation", () => {
    it("deletes pending invitation", async () => {
      vi.mocked(prisma.userInvitation.findUnique).mockResolvedValue({
        id: "inv-123",
        usedAt: null,
      } as any);
      vi.mocked(prisma.userInvitation.delete).mockResolvedValue({} as any);

      await revokeInvitation("inv-123");

      expect(prisma.userInvitation.delete).toHaveBeenCalledWith({
        where: { id: "inv-123" },
      });
    });

    it("throws NotFoundError when invitation not found", async () => {
      vi.mocked(prisma.userInvitation.findUnique).mockResolvedValue(null);

      await expect(revokeInvitation("nonexistent")).rejects.toThrow(
        NotFoundError
      );
      await expect(revokeInvitation("nonexistent")).rejects.toThrow(
        "Invitation not found"
      );
    });

    it("throws ValidationError when invitation already used", async () => {
      vi.mocked(prisma.userInvitation.findUnique).mockResolvedValue({
        id: "inv-123",
        usedAt: new Date(),
      } as any);

      await expect(revokeInvitation("inv-123")).rejects.toThrow(ValidationError);
      await expect(revokeInvitation("inv-123")).rejects.toThrow(
        "Cannot revoke used invitation"
      );
    });
  });

  // ==========================================================================
  // validateAndUseInvitation
  // ==========================================================================
  describe("validateAndUseInvitation", () => {
    it("validates and marks invitation as used", async () => {
      const mockInvitation = {
        id: "inv-123",
        email: "test@toro.com",
        code: "VALIDCODE",
        usedAt: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
      vi.mocked(prisma.userInvitation.findFirst).mockResolvedValue(
        mockInvitation as any
      );
      vi.mocked(prisma.userInvitation.update).mockResolvedValue({
        ...mockInvitation,
        usedAt: new Date(),
      } as any);

      const result = await validateAndUseInvitation(
        "Test@Toro.com",
        "validcode"
      );

      expect(result.usedAt).not.toBeNull();
      expect(prisma.userInvitation.findFirst).toHaveBeenCalledWith({
        where: {
          email: "test@toro.com", // Normalized
          code: "VALIDCODE", // Uppercased
        },
      });
      expect(prisma.userInvitation.update).toHaveBeenCalledWith({
        where: { id: "inv-123" },
        data: { usedAt: expect.any(Date) },
      });
    });

    it("throws NotFoundError for invalid email/code combination", async () => {
      vi.mocked(prisma.userInvitation.findFirst).mockResolvedValue(null);

      await expect(
        validateAndUseInvitation("test@toro.com", "WRONGCODE")
      ).rejects.toThrow(NotFoundError);
      await expect(
        validateAndUseInvitation("test@toro.com", "WRONGCODE")
      ).rejects.toThrow("Invalid email or code");
    });

    it("throws ValidationError when invitation already used", async () => {
      vi.mocked(prisma.userInvitation.findFirst).mockResolvedValue({
        id: "inv-123",
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      } as any);

      await expect(
        validateAndUseInvitation("test@toro.com", "USEDCODE")
      ).rejects.toThrow(ValidationError);
      await expect(
        validateAndUseInvitation("test@toro.com", "USEDCODE")
      ).rejects.toThrow("already been used");
    });

    it("throws ValidationError when invitation expired", async () => {
      vi.mocked(prisma.userInvitation.findFirst).mockResolvedValue({
        id: "inv-123",
        usedAt: null,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired
      } as any);

      await expect(
        validateAndUseInvitation("test@toro.com", "EXPIRED")
      ).rejects.toThrow(ValidationError);
      await expect(
        validateAndUseInvitation("test@toro.com", "EXPIRED")
      ).rejects.toThrow("expired");
    });
  });
});
