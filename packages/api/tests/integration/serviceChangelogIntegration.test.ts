/**
 * Integration tests for service changelog hooks
 * 
 * These tests verify that service operations (create, update) properly
 * record changelog entries using the diffAndRecord pattern.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the db module before any imports
vi.mock("../../src/lib/db.js", () => ({
  prisma: {
    epic: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    feature: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    task: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    status: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    changeLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock ordering utility
vi.mock("../../src/utils/ordering.js", () => ({
  generateSortOrderBetween: vi.fn().mockReturnValue(1.0),
}));

// Mock events
vi.mock("../../src/events/index.js", () => ({
  emitStatusChanged: vi.fn(),
}));

import { prisma } from "../../src/lib/db.js";
import * as changelogService from "../../src/services/changelogService.js";
import { createEpic, updateEpic, archiveEpic } from "../../src/services/epicService.js";
import { createFeature, updateFeature } from "../../src/services/featureService.js";
import { createTask, updateTask } from "../../src/services/taskService.js";

describe("Service Changelog Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks for common dependencies
    vi.mocked(prisma.team.findUnique).mockResolvedValue({
      id: "team-1",
      name: "Test Team",
      key: "TEST",
      isArchived: false,
    } as any);

    vi.mocked(prisma.status.findFirst).mockResolvedValue({
      id: "status-1",
      name: "Backlog",
      category: "backlog",
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("epicService changelog hooks", () => {
    it("should record _created field when creating an epic", async () => {
      const mockEpic = {
        id: "epic-1",
        name: "Test Epic",
        description: "Test description",
        teamId: "team-1",
        sortOrder: 1.0,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.epic.create).mockResolvedValue(mockEpic as any);
      
      // Spy on recordChange to verify it's called
      const recordChangeSpy = vi.spyOn(changelogService, "recordChange");

      await createEpic({
        name: "Test Epic",
        teamId: "team-1",
        description: "Test description",
      });

      // Verify recordChange was called with _created field
      expect(recordChangeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "epic",
          entityId: "epic-1",
          field: "_created",
          oldValue: null,
          newValue: expect.any(String), // JSON.stringify(epic)
          epicId: "epic-1",
        })
      );
    });

    it("should record field changes when updating an epic", async () => {
      const beforeEpic = {
        id: "epic-1",
        name: "Old Name",
        description: "Old description",
        teamId: "team-1",
        sortOrder: 1.0,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const afterEpic = {
        ...beforeEpic,
        name: "New Name",
        description: "New description",
        updatedAt: new Date(),
      };

      vi.mocked(prisma.epic.findFirst).mockResolvedValue(beforeEpic as any);
      vi.mocked(prisma.epic.findUnique).mockResolvedValue(beforeEpic as any);
      vi.mocked(prisma.epic.update).mockResolvedValue(afterEpic as any);

      // Spy on diffAndRecord to verify it's called
      const diffAndRecordSpy = vi.spyOn(changelogService, "diffAndRecord");

      await updateEpic("epic-1", {
        name: "New Name",
        description: "New description",
      });

      // Verify diffAndRecord was called with before and after snapshots
      expect(diffAndRecordSpy).toHaveBeenCalledWith(
        "epic",
        "epic-1",
        beforeEpic,
        afterEpic,
        expect.any(String), // changedBy
        "epic-1" // epicId
      );
    });

    it("should record _archived field when archiving an epic", async () => {
      const existingEpic = {
        id: "epic-1",
        name: "Test Epic",
        isArchived: false,
        teamId: "team-1",
        sortOrder: 1.0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const archivedEpic = {
        ...existingEpic,
        isArchived: true,
        updatedAt: new Date(),
      };

      vi.mocked(prisma.epic.findFirst).mockResolvedValue(existingEpic as any);
      vi.mocked(prisma.epic.update).mockResolvedValue(archivedEpic as any);

      // Spy on recordChange to verify it's called
      const recordChangeSpy = vi.spyOn(changelogService, "recordChange");

      await archiveEpic("epic-1");

      // Verify recordChange was called with _archived field
      expect(recordChangeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "epic",
          entityId: "epic-1",
          field: "_archived",
          oldValue: false,
          newValue: true,
          epicId: "epic-1",
        })
      );
    });

    it("should not break epic operations if changelog recording fails", async () => {
      const mockEpic = {
        id: "epic-1",
        name: "Test Epic",
        teamId: "team-1",
        sortOrder: 1.0,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.epic.create).mockResolvedValue(mockEpic as any);
      
      // Make recordChange throw an error
      vi.spyOn(changelogService, "recordChange").mockRejectedValue(
        new Error("Changelog service unavailable")
      );

      // The operation should still succeed
      const result = await createEpic({
        name: "Test Epic",
        teamId: "team-1",
      });

      expect(result).toEqual(mockEpic);
    });
  });

  describe("featureService changelog hooks", () => {
    it("should record _created field when creating a feature", async () => {
      const mockFeature = {
        id: "feature-1",
        identifier: "TEST-1",
        title: "Test Feature",
        epicId: "epic-1",
        sortOrder: 1.0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockEpic = {
        id: "epic-1",
        teamId: "team-1",
        isArchived: false,
      };

      vi.mocked(prisma.epic.findUnique).mockResolvedValue(mockEpic as any);
      vi.mocked(prisma.feature.findMany).mockResolvedValue([]);
      vi.mocked(prisma.feature.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.feature.create).mockResolvedValue(mockFeature as any);

      // Spy on recordChange to verify it's called
      const recordChangeSpy = vi.spyOn(changelogService, "recordChange");

      await createFeature({
        title: "Test Feature",
        epicId: "epic-1",
      });

      // Verify recordChange was called with _created field and correct epicId
      expect(recordChangeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "feature",
          entityId: "feature-1",
          field: "_created",
          oldValue: null,
          newValue: expect.any(String),
          epicId: "epic-1", // epicId from the feature
        })
      );
    });

    it("should record field changes when updating a feature", async () => {
      const beforeFeature = {
        id: "feature-1",
        identifier: "TEST-1",
        title: "Old Title",
        description: "Old description",
        epicId: "epic-1",
        statusId: "status-1",
        sortOrder: 1.0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const afterFeature = {
        ...beforeFeature,
        title: "New Title",
        description: "New description",
        updatedAt: new Date(),
      };

      vi.mocked(prisma.feature.findFirst).mockResolvedValue(beforeFeature as any);
      vi.mocked(prisma.feature.findUnique).mockResolvedValue(beforeFeature as any);
      vi.mocked(prisma.feature.update).mockResolvedValue(afterFeature as any);

      // Spy on diffAndRecord to verify it's called
      const diffAndRecordSpy = vi.spyOn(changelogService, "diffAndRecord");

      await updateFeature("feature-1", {
        title: "New Title",
        description: "New description",
      });

      // Verify diffAndRecord was called with before and after snapshots and epicId
      expect(diffAndRecordSpy).toHaveBeenCalledWith(
        "feature",
        "feature-1",
        beforeFeature,
        afterFeature,
        expect.any(String), // changedBy
        "epic-1" // epicId from the feature
      );
    });

    it("should not break feature operations if changelog recording fails", async () => {
      const mockFeature = {
        id: "feature-1",
        identifier: "TEST-1",
        title: "Test Feature",
        epicId: "epic-1",
        sortOrder: 1.0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockEpic = {
        id: "epic-1",
        teamId: "team-1",
        isArchived: false,
      };

      vi.mocked(prisma.epic.findUnique).mockResolvedValue(mockEpic as any);
      vi.mocked(prisma.feature.findMany).mockResolvedValue([]);
      vi.mocked(prisma.feature.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.feature.create).mockResolvedValue(mockFeature as any);

      // Make recordChange throw an error
      vi.spyOn(changelogService, "recordChange").mockRejectedValue(
        new Error("Changelog service unavailable")
      );

      // The operation should still succeed
      const result = await createFeature({
        title: "Test Feature",
        epicId: "epic-1",
      });

      expect(result).toEqual(mockFeature);
    });
  });

  describe("taskService changelog hooks", () => {
    it("should record _created field when creating a task with epicId resolved via feature", async () => {
      const mockTask = {
        id: "task-1",
        identifier: "TEST-1-1",
        title: "Test Task",
        featureId: "feature-1",
        sortOrder: 1.0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockFeature = {
        id: "feature-1",
        epicId: "epic-1",
        epic: {
          teamId: "team-1",
        },
      };

      const mockTaskWithFeature = {
        id: "task-1",
        feature: {
          epicId: "epic-1",
        },
      };

      vi.mocked(prisma.feature.findUnique).mockResolvedValue(mockFeature as any);
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.task.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.task.create).mockResolvedValue(mockTask as any);
      
      // Mock the second findUnique call (for epicId resolution)
      vi.mocked(prisma.task.findUnique)
        .mockResolvedValueOnce(null) // First call in generateIdentifier
        .mockResolvedValueOnce(mockTaskWithFeature as any); // Second call for epicId

      // Spy on recordChange to verify it's called
      const recordChangeSpy = vi.spyOn(changelogService, "recordChange");

      await createTask({
        title: "Test Task",
        featureId: "feature-1",
      });

      // Verify recordChange was called with _created field and epicId resolved via feature
      expect(recordChangeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "task",
          entityId: "task-1",
          field: "_created",
          oldValue: null,
          newValue: expect.any(String),
          epicId: "epic-1", // epicId resolved via task -> feature -> epicId
        })
      );
    });

    it("should record field changes when updating a task with epicId resolved via feature", async () => {
      const beforeTask = {
        id: "task-1",
        identifier: "TEST-1-1",
        title: "Old Title",
        description: "Old description",
        featureId: "feature-1",
        statusId: "status-1",
        sortOrder: 1.0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const afterTask = {
        ...beforeTask,
        title: "New Title",
        description: "New description",
        updatedAt: new Date(),
      };

      const mockTaskWithFeature = {
        id: "task-1",
        feature: {
          epicId: "epic-1",
        },
      };

      vi.mocked(prisma.task.findFirst).mockResolvedValue(beforeTask as any);
      vi.mocked(prisma.task.findUnique)
        .mockResolvedValueOnce(beforeTask as any) // First call for beforeSnapshot
        .mockResolvedValueOnce(mockTaskWithFeature as any); // Second call for epicId resolution
      vi.mocked(prisma.task.update).mockResolvedValue(afterTask as any);

      // Spy on diffAndRecord to verify it's called
      const diffAndRecordSpy = vi.spyOn(changelogService, "diffAndRecord");

      await updateTask("task-1", {
        title: "New Title",
        description: "New description",
      });

      // Verify diffAndRecord was called with before and after snapshots and epicId
      expect(diffAndRecordSpy).toHaveBeenCalledWith(
        "task",
        "task-1",
        beforeTask,
        afterTask,
        expect.any(String), // changedBy
        "epic-1" // epicId resolved via task -> feature -> epicId
      );
    });

    it("should not break task operations if changelog recording fails", async () => {
      const mockTask = {
        id: "task-1",
        identifier: "TEST-1-1",
        title: "Test Task",
        featureId: "feature-1",
        sortOrder: 1.0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockFeature = {
        id: "feature-1",
        epicId: "epic-1",
        epic: {
          teamId: "team-1",
        },
      };

      vi.mocked(prisma.feature.findUnique).mockResolvedValue(mockFeature as any);
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.task.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.task.create).mockResolvedValue(mockTask as any);

      // Make recordChange throw an error
      vi.spyOn(changelogService, "recordChange").mockRejectedValue(
        new Error("Changelog service unavailable")
      );

      // The operation should still succeed
      const result = await createTask({
        title: "Test Task",
        featureId: "feature-1",
      });

      expect(result).toEqual(mockTask);
    });
  });

  describe("changelog hooks resilience", () => {
    it("should handle changelog errors gracefully without breaking parent operations", async () => {
      const mockEpic = {
        id: "epic-1",
        name: "Test Epic",
        teamId: "team-1",
        sortOrder: 1.0,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.epic.create).mockResolvedValue(mockEpic as any);
      
      // Simulate various changelog failures
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(changelogService, "recordChange").mockRejectedValue(
        new Error("Database connection lost")
      );

      // Epic creation should still work
      const result = await createEpic({
        name: "Test Epic",
        teamId: "team-1",
      });

      expect(result).toEqual(mockEpic);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to record epic creation in changelog"),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it("should catch errors from diffAndRecord without breaking updates", async () => {
      const beforeEpic = {
        id: "epic-1",
        name: "Old Name",
        teamId: "team-1",
        sortOrder: 1.0,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const afterEpic = {
        ...beforeEpic,
        name: "New Name",
        updatedAt: new Date(),
      };

      vi.mocked(prisma.epic.findFirst).mockResolvedValue(beforeEpic as any);
      vi.mocked(prisma.epic.findUnique).mockResolvedValue(beforeEpic as any);
      vi.mocked(prisma.epic.update).mockResolvedValue(afterEpic as any);

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(changelogService, "diffAndRecord").mockRejectedValue(
        new Error("Changelog diff failed")
      );

      // Update should still work
      const result = await updateEpic("epic-1", { name: "New Name" });

      expect(result).toEqual(afterEpic);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to record epic update in changelog"),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
