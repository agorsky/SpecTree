import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the db module before any imports that use it
vi.mock("../../src/lib/db.js", () => ({
  prisma: {
    changeLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    epic: {
      findUnique: vi.fn(),
    },
    feature: {
      findUnique: vi.fn(),
    },
    task: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock the dateParser module
vi.mock("../../src/utils/dateParser.js", () => ({
  buildDateFilters: vi.fn((options) => {
    const filters: { createdAt?: { gte?: Date; lt?: Date } } = {};
    if (options.createdAt) {
      filters.createdAt = { gte: new Date(options.createdAt) };
    }
    if (options.createdBefore) {
      if (!filters.createdAt) {
        filters.createdAt = {};
      }
      filters.createdAt.lt = new Date(options.createdBefore);
    }
    return filters;
  }),
}));

import { prisma } from "../../src/lib/db.js";
import {
  recordChange,
  recordChanges,
  diffAndRecord,
  getEntityChangelog,
  getEpicChangelog,
  type RecordChangeInput,
  type RecordChangesInput,
} from "../../src/services/changelogService.js";

describe("changelogService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("recordChange", () => {
    it("should record a single change for an epic", async () => {
      const input: RecordChangeInput = {
        entityType: "epic",
        entityId: "epic-1",
        field: "name",
        oldValue: "Old Name",
        newValue: "New Name",
        changedBy: "user-1",
      };

      const mockChangeLog = {
        id: "changelog-1",
        entityType: "epic",
        entityId: "epic-1",
        field: "name",
        oldValue: JSON.stringify("Old Name"),
        newValue: JSON.stringify("New Name"),
        changedBy: "user-1",
        epicId: "epic-1",
        changedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.changeLog.create).mockResolvedValue(mockChangeLog);

      const result = await recordChange(input);

      expect(result).toEqual(mockChangeLog);
      expect(prisma.changeLog.create).toHaveBeenCalledWith({
        data: {
          entityType: "epic",
          entityId: "epic-1",
          field: "name",
          oldValue: JSON.stringify("Old Name"),
          newValue: JSON.stringify("New Name"),
          changedBy: "user-1",
          epicId: "epic-1",
        },
      });
    });

    it("should resolve epicId for a feature", async () => {
      const input: RecordChangeInput = {
        entityType: "feature",
        entityId: "feature-1",
        field: "title",
        oldValue: "Old Title",
        newValue: "New Title",
        changedBy: "user-1",
      };

      const mockFeature = {
        id: "feature-1",
        epicId: "epic-1",
      };

      const mockChangeLog = {
        id: "changelog-1",
        entityType: "feature",
        entityId: "feature-1",
        field: "title",
        oldValue: JSON.stringify("Old Title"),
        newValue: JSON.stringify("New Title"),
        changedBy: "user-1",
        epicId: "epic-1",
        changedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.feature.findUnique).mockResolvedValue(mockFeature as any);
      vi.mocked(prisma.changeLog.create).mockResolvedValue(mockChangeLog);

      const result = await recordChange(input);

      expect(result).toEqual(mockChangeLog);
      expect(prisma.feature.findUnique).toHaveBeenCalledWith({
        where: { id: "feature-1" },
        select: { epicId: true },
      });
      expect(prisma.changeLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          epicId: "epic-1",
        }),
      });
    });

    it("should resolve epicId for a task via feature", async () => {
      const input: RecordChangeInput = {
        entityType: "task",
        entityId: "task-1",
        field: "title",
        oldValue: "Old Title",
        newValue: "New Title",
        changedBy: "user-1",
      };

      const mockTask = {
        id: "task-1",
        feature: {
          epicId: "epic-1",
        },
      };

      const mockChangeLog = {
        id: "changelog-1",
        entityType: "task",
        entityId: "task-1",
        field: "title",
        oldValue: JSON.stringify("Old Title"),
        newValue: JSON.stringify("New Title"),
        changedBy: "user-1",
        epicId: "epic-1",
        changedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.task.findUnique).mockResolvedValue(mockTask as any);
      vi.mocked(prisma.changeLog.create).mockResolvedValue(mockChangeLog);

      const result = await recordChange(input);

      expect(result).toEqual(mockChangeLog);
      expect(prisma.task.findUnique).toHaveBeenCalledWith({
        where: { id: "task-1" },
        select: {
          feature: {
            select: { epicId: true },
          },
        },
      });
      expect(prisma.changeLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          epicId: "epic-1",
        }),
      });
    });

    it("should return null and log error on failure", async () => {
      const input: RecordChangeInput = {
        entityType: "epic",
        entityId: "epic-1",
        field: "name",
        oldValue: "Old Name",
        newValue: "New Name",
        changedBy: "user-1",
      };

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(prisma.changeLog.create).mockRejectedValue(new Error("Database error"));

      const result = await recordChange(input);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to record change:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("recordChanges", () => {
    it("should record multiple changes in a transaction", async () => {
      const input: RecordChangesInput = {
        entityType: "feature",
        entityId: "feature-1",
        changes: [
          { field: "title", oldValue: "Old Title", newValue: "New Title" },
          { field: "status", oldValue: "backlog", newValue: "in-progress" },
        ],
        changedBy: "user-1",
        epicId: "epic-1",
      };

      const mockChangeLogs = [
        {
          id: "changelog-1",
          entityType: "feature",
          entityId: "feature-1",
          field: "title",
          oldValue: JSON.stringify("Old Title"),
          newValue: JSON.stringify("New Title"),
          changedBy: "user-1",
          epicId: "epic-1",
          changedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "changelog-2",
          entityType: "feature",
          entityId: "feature-1",
          field: "status",
          oldValue: JSON.stringify("backlog"),
          newValue: JSON.stringify("in-progress"),
          changedBy: "user-1",
          epicId: "epic-1",
          changedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.$transaction).mockResolvedValue(mockChangeLogs as any);

      const result = await recordChanges(input);

      expect(result).toEqual(mockChangeLogs);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("should return null and log error on failure", async () => {
      const input: RecordChangesInput = {
        entityType: "epic",
        entityId: "epic-1",
        changes: [{ field: "name", oldValue: "Old", newValue: "New" }],
        changedBy: "user-1",
      };

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error("Transaction failed"));

      const result = await recordChanges(input);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to record changes:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("diffAndRecord", () => {
    it("should detect and record changed fields", async () => {
      const beforeSnapshot = {
        id: "feature-1",
        title: "Old Title",
        status: "backlog",
        assignee: "user-1",
        updatedAt: new Date("2024-01-01"),
      };

      const afterSnapshot = {
        id: "feature-1",
        title: "New Title",
        status: "in-progress",
        assignee: "user-1",
        updatedAt: new Date("2024-01-02"),
      };

      const mockChangeLogs = [
        {
          id: "changelog-1",
          entityType: "feature",
          entityId: "feature-1",
          field: "title",
          oldValue: JSON.stringify("Old Title"),
          newValue: JSON.stringify("New Title"),
          changedBy: "user-1",
          epicId: "epic-1",
          changedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "changelog-2",
          entityType: "feature",
          entityId: "feature-1",
          field: "status",
          oldValue: JSON.stringify("backlog"),
          newValue: JSON.stringify("in-progress"),
          changedBy: "user-1",
          epicId: "epic-1",
          changedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.$transaction).mockResolvedValue(mockChangeLogs as any);

      const result = await diffAndRecord(
        "feature",
        "feature-1",
        beforeSnapshot,
        afterSnapshot,
        "user-1",
        "epic-1"
      );

      expect(result).toEqual(mockChangeLogs);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("should skip auto-managed fields (id, createdAt, updatedAt)", async () => {
      const beforeSnapshot = {
        id: "feature-1",
        title: "Same Title",
        updatedAt: new Date("2024-01-01"),
        createdAt: new Date("2024-01-01"),
      };

      const afterSnapshot = {
        id: "feature-1",
        title: "Same Title",
        updatedAt: new Date("2024-01-02"), // Changed but should be skipped
        createdAt: new Date("2024-01-01"),
      };

      const result = await diffAndRecord(
        "feature",
        "feature-1",
        beforeSnapshot,
        afterSnapshot,
        "user-1",
        "epic-1"
      );

      // Should return empty array since only auto-managed fields changed
      expect(result).toEqual([]);
    });

    it("should return empty array when no changes detected", async () => {
      const beforeSnapshot = { title: "Same Title", status: "backlog" };
      const afterSnapshot = { title: "Same Title", status: "backlog" };

      const result = await diffAndRecord(
        "feature",
        "feature-1",
        beforeSnapshot,
        afterSnapshot,
        "user-1",
        "epic-1"
      );

      expect(result).toEqual([]);
    });
  });

  describe("getEntityChangelog", () => {
    it("should return paginated changelog for an entity", async () => {
      const mockChangeLogs = [
        {
          id: "changelog-1",
          entityType: "feature",
          entityId: "feature-1",
          field: "title",
          oldValue: JSON.stringify("Old Title"),
          newValue: JSON.stringify("New Title"),
          changedBy: "user-1",
          epicId: "epic-1",
          changedAt: new Date("2024-01-02"),
          createdAt: new Date("2024-01-02"),
          updatedAt: new Date("2024-01-02"),
        },
        {
          id: "changelog-2",
          entityType: "feature",
          entityId: "feature-1",
          field: "status",
          oldValue: JSON.stringify("backlog"),
          newValue: JSON.stringify("in-progress"),
          changedBy: "user-1",
          epicId: "epic-1",
          changedAt: new Date("2024-01-01"),
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
        },
      ];

      vi.mocked(prisma.changeLog.findMany).mockResolvedValue(mockChangeLogs);

      const result = await getEntityChangelog({
        entityType: "feature",
        entityId: "feature-1",
        limit: 20,
      });

      expect(result.data).toEqual(mockChangeLogs);
      expect(result.meta.hasMore).toBe(false);
      expect(result.meta.cursor).toBeNull();
      expect(prisma.changeLog.findMany).toHaveBeenCalledWith({
        take: 21, // limit + 1
        where: {
          entityType: "feature",
          entityId: "feature-1",
        },
        orderBy: [{ changedAt: "desc" }, { createdAt: "desc" }],
      });
    });

    it("should support field filtering", async () => {
      vi.mocked(prisma.changeLog.findMany).mockResolvedValue([]);

      await getEntityChangelog({
        entityType: "feature",
        entityId: "feature-1",
        field: "title",
      });

      expect(prisma.changeLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            field: "title",
          }),
        })
      );
    });

    it("should support user filtering", async () => {
      vi.mocked(prisma.changeLog.findMany).mockResolvedValue([]);

      await getEntityChangelog({
        entityType: "feature",
        entityId: "feature-1",
        changedBy: "user-1",
      });

      expect(prisma.changeLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            changedBy: "user-1",
          }),
        })
      );
    });

    it("should support cursor-based pagination", async () => {
      const mockChangeLogs = Array.from({ length: 21 }, (_, i) => ({
        id: `changelog-${i}`,
        entityType: "feature",
        entityId: "feature-1",
        field: "title",
        oldValue: null,
        newValue: null,
        changedBy: "user-1",
        epicId: "epic-1",
        changedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      vi.mocked(prisma.changeLog.findMany).mockResolvedValue(mockChangeLogs);

      const result = await getEntityChangelog({
        entityType: "feature",
        entityId: "feature-1",
        limit: 20,
      });

      expect(result.meta.hasMore).toBe(true);
      expect(result.meta.cursor).toBe("changelog-19");
      expect(result.data.length).toBe(20);
    });
  });

  describe("getEpicChangelog", () => {
    it("should return paginated changelog for an epic and its children", async () => {
      const mockChangeLogs = [
        {
          id: "changelog-1",
          entityType: "epic",
          entityId: "epic-1",
          field: "name",
          oldValue: JSON.stringify("Old Name"),
          newValue: JSON.stringify("New Name"),
          changedBy: "user-1",
          epicId: "epic-1",
          changedAt: new Date("2024-01-03"),
          createdAt: new Date("2024-01-03"),
          updatedAt: new Date("2024-01-03"),
        },
        {
          id: "changelog-2",
          entityType: "feature",
          entityId: "feature-1",
          field: "title",
          oldValue: JSON.stringify("Old Title"),
          newValue: JSON.stringify("New Title"),
          changedBy: "user-1",
          epicId: "epic-1",
          changedAt: new Date("2024-01-02"),
          createdAt: new Date("2024-01-02"),
          updatedAt: new Date("2024-01-02"),
        },
        {
          id: "changelog-3",
          entityType: "task",
          entityId: "task-1",
          field: "status",
          oldValue: JSON.stringify("todo"),
          newValue: JSON.stringify("done"),
          changedBy: "user-1",
          epicId: "epic-1",
          changedAt: new Date("2024-01-01"),
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
        },
      ];

      vi.mocked(prisma.changeLog.findMany).mockResolvedValue(mockChangeLogs);

      const result = await getEpicChangelog({
        epicId: "epic-1",
        limit: 20,
      });

      expect(result.data).toEqual(mockChangeLogs);
      expect(result.meta.hasMore).toBe(false);
      expect(prisma.changeLog.findMany).toHaveBeenCalledWith({
        take: 21,
        where: {
          epicId: "epic-1",
        },
        orderBy: [{ changedAt: "desc" }, { createdAt: "desc" }],
      });
    });

    it("should support entity type filtering", async () => {
      vi.mocked(prisma.changeLog.findMany).mockResolvedValue([]);

      await getEpicChangelog({
        epicId: "epic-1",
        entityType: "feature",
      });

      expect(prisma.changeLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entityType: "feature",
          }),
        })
      );
    });

    it("should support combined filters", async () => {
      vi.mocked(prisma.changeLog.findMany).mockResolvedValue([]);

      await getEpicChangelog({
        epicId: "epic-1",
        entityType: "task",
        field: "status",
        changedBy: "user-1",
      });

      expect(prisma.changeLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            epicId: "epic-1",
            entityType: "task",
            field: "status",
            changedBy: "user-1",
          }),
        })
      );
    });
  });
});
