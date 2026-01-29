/**
 * Integration tests for MCP Ordering tools
 *
 * Tests the ordering tool handlers:
 * - spectree__reorder_project
 * - spectree__reorder_feature
 * - spectree__reorder_task
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Type for tool handler
interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

// Use vi.hoisted to declare variables available to hoisted mocks
const { registeredTools } = vi.hoisted(() => {
  const registeredTools = new Map<
    string,
    {
      config: { description: string; inputSchema: Record<string, unknown> };
      handler: (input: Record<string, unknown>) => Promise<ToolResponse>;
    }
  >();
  return { registeredTools };
});

// Mock the API services before importing the tools
vi.mock("@spectree/api/src/services/index.js", () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    feature: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    task: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "NotFoundError";
    }
  },
  ValidationError: class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ValidationError";
    }
  },
}));

// Mock the ordering utility
vi.mock("@spectree/api/src/utils/ordering.js", () => ({
  generateSortOrderBetween: vi.fn((before, after) => {
    // Simple mock: return midpoint or default value
    if (before === null && after === null) return 1;
    if (before === null) return after! / 2;
    if (after === null) return before + 1;
    return (before + after) / 2;
  }),
}));

// Mock the tool registry
vi.mock("../src/tools/index.js", () => ({
  addToolRegistrar: vi.fn((registrar) => {
    const mockServer = {
      registerTool: (
        name: string,
        config: { description: string; inputSchema: Record<string, unknown> },
        handler: (input: Record<string, unknown>) => Promise<ToolResponse>
      ) => {
        registeredTools.set(name, { config, handler });
      },
    };
    registrar(mockServer);
  }),
}));

// Import after mocking
import { prisma } from "@spectree/api/src/services/index.js";
import { generateSortOrderBetween } from "@spectree/api/src/utils/ordering.js";

// Import the tools module to trigger registration
import "../src/tools/ordering.js";

describe("MCP Ordering Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("spectree__reorder_project", () => {
    const getHandler = () => registeredTools.get("spectree__reorder_project")?.handler;

    it("should reorder a project after another project", async () => {
      const projectId = "550e8400-e29b-41d4-a716-446655440000";
      const afterProjectId = "550e8400-e29b-41d4-a716-446655440001";
      const teamId = "team-1";

      const mockProject = {
        id: projectId,
        teamId,
        isArchived: false,
      };

      const mockAfterProject = {
        teamId,
        sortOrder: 1,
        isArchived: false,
      };

      const mockUpdatedProject = {
        id: projectId,
        name: "Test Project",
        sortOrder: 2,
        team: { id: teamId, name: "Test Team", key: "TT" },
        updatedAt: new Date(),
      };

      vi.mocked(prisma.project.findUnique)
        .mockResolvedValueOnce(mockProject as never)
        .mockResolvedValueOnce(mockAfterProject as never);
      vi.mocked(prisma.project.update).mockResolvedValue(mockUpdatedProject as never);
      vi.mocked(generateSortOrderBetween).mockReturnValue(2);

      const handler = getHandler();
      expect(handler).toBeDefined();

      const result = await handler!({
        id: projectId,
        afterId: afterProjectId,
      });

      expect(result.isError).toBeUndefined();
      expect(vi.mocked(generateSortOrderBetween)).toHaveBeenCalledWith(1, null);

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.id).toBe(projectId);
      expect(data.sortOrder).toBe(2);
    });

    it("should reorder a project before another project", async () => {
      const projectId = "550e8400-e29b-41d4-a716-446655440000";
      const beforeProjectId = "550e8400-e29b-41d4-a716-446655440002";
      const teamId = "team-1";

      const mockProject = {
        id: projectId,
        teamId,
        isArchived: false,
      };

      const mockBeforeProject = {
        teamId,
        sortOrder: 3,
        isArchived: false,
      };

      const mockUpdatedProject = {
        id: projectId,
        name: "Test Project",
        sortOrder: 1.5,
        team: { id: teamId, name: "Test Team", key: "TT" },
        updatedAt: new Date(),
      };

      vi.mocked(prisma.project.findUnique)
        .mockResolvedValueOnce(mockProject as never)
        .mockResolvedValueOnce(mockBeforeProject as never);
      vi.mocked(prisma.project.update).mockResolvedValue(mockUpdatedProject as never);
      vi.mocked(generateSortOrderBetween).mockReturnValue(1.5);

      const handler = getHandler();
      const result = await handler!({
        id: projectId,
        beforeId: beforeProjectId,
      });

      expect(result.isError).toBeUndefined();
      expect(vi.mocked(generateSortOrderBetween)).toHaveBeenCalledWith(null, 3);
    });

    it("should reorder a project between two projects", async () => {
      const projectId = "550e8400-e29b-41d4-a716-446655440000";
      const afterProjectId = "550e8400-e29b-41d4-a716-446655440001";
      const beforeProjectId = "550e8400-e29b-41d4-a716-446655440002";
      const teamId = "team-1";

      const mockProject = { id: projectId, teamId, isArchived: false };
      const mockAfterProject = { teamId, sortOrder: 1, isArchived: false };
      const mockBeforeProject = { teamId, sortOrder: 3, isArchived: false };
      const mockUpdatedProject = {
        id: projectId,
        name: "Test Project",
        sortOrder: 2,
        team: { id: teamId, name: "Test Team", key: "TT" },
        updatedAt: new Date(),
      };

      vi.mocked(prisma.project.findUnique)
        .mockResolvedValueOnce(mockProject as never)
        .mockResolvedValueOnce(mockAfterProject as never)
        .mockResolvedValueOnce(mockBeforeProject as never);
      vi.mocked(prisma.project.update).mockResolvedValue(mockUpdatedProject as never);
      vi.mocked(generateSortOrderBetween).mockReturnValue(2);

      const handler = getHandler();
      const result = await handler!({
        id: projectId,
        afterId: afterProjectId,
        beforeId: beforeProjectId,
      });

      expect(result.isError).toBeUndefined();
      expect(vi.mocked(generateSortOrderBetween)).toHaveBeenCalledWith(1, 3);
    });

    it("should return error when neither afterId nor beforeId provided", async () => {
      const handler = getHandler();
      const result = await handler!({
        id: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("afterId or beforeId");
    });

    it("should return error for non-existent project", async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);

      const handler = getHandler();
      const result = await handler!({
        id: "550e8400-e29b-41d4-a716-446655440000",
        afterId: "550e8400-e29b-41d4-a716-446655440001",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("not found");
    });

    it("should return error for archived project", async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValue({
        id: "proj-1",
        teamId: "team-1",
        isArchived: true,
      } as never);

      const handler = getHandler();
      const result = await handler!({
        id: "550e8400-e29b-41d4-a716-446655440000",
        afterId: "550e8400-e29b-41d4-a716-446655440001",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("not found");
    });

    it("should return error when projects belong to different teams", async () => {
      const projectId = "550e8400-e29b-41d4-a716-446655440000";
      const afterProjectId = "550e8400-e29b-41d4-a716-446655440001";

      vi.mocked(prisma.project.findUnique)
        .mockResolvedValueOnce({ id: projectId, teamId: "team-1", isArchived: false } as never)
        .mockResolvedValueOnce({ teamId: "team-2", sortOrder: 1, isArchived: false } as never);

      const handler = getHandler();
      const result = await handler!({
        id: projectId,
        afterId: afterProjectId,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("same team");
    });
  });

  describe("spectree__reorder_feature", () => {
    const getHandler = () => registeredTools.get("spectree__reorder_feature")?.handler;

    it("should reorder a feature after another feature", async () => {
      const featureId = "550e8400-e29b-41d4-a716-446655440000";
      const afterFeatureId = "550e8400-e29b-41d4-a716-446655440001";
      const projectId = "proj-1";

      const mockFeature = { id: featureId, projectId, identifier: "TT-1" };
      const mockAfterFeature = { projectId, sortOrder: 1 };
      const mockUpdatedFeature = {
        id: featureId,
        identifier: "TT-1",
        title: "Test Feature",
        sortOrder: 2,
        project: { id: projectId, name: "Test Project" },
        updatedAt: new Date(),
      };

      vi.mocked(prisma.feature.findUnique)
        .mockResolvedValueOnce(mockFeature as never)
        .mockResolvedValueOnce(mockAfterFeature as never);
      vi.mocked(prisma.feature.update).mockResolvedValue(mockUpdatedFeature as never);
      vi.mocked(generateSortOrderBetween).mockReturnValue(2);

      const handler = getHandler();
      expect(handler).toBeDefined();

      const result = await handler!({
        id: featureId,
        afterId: afterFeatureId,
      });

      expect(result.isError).toBeUndefined();
      expect(vi.mocked(generateSortOrderBetween)).toHaveBeenCalledWith(1, null);

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.id).toBe(featureId);
      expect(data.identifier).toBe("TT-1");
    });

    it("should reorder a feature between two features", async () => {
      const featureId = "550e8400-e29b-41d4-a716-446655440000";
      const projectId = "proj-1";

      vi.mocked(prisma.feature.findUnique)
        .mockResolvedValueOnce({ id: featureId, projectId, identifier: "TT-1" } as never)
        .mockResolvedValueOnce({ projectId, sortOrder: 1 } as never)
        .mockResolvedValueOnce({ projectId, sortOrder: 3 } as never);
      vi.mocked(prisma.feature.update).mockResolvedValue({
        id: featureId,
        identifier: "TT-1",
        title: "Test Feature",
        sortOrder: 2,
        project: { id: projectId, name: "Test Project" },
        updatedAt: new Date(),
      } as never);
      vi.mocked(generateSortOrderBetween).mockReturnValue(2);

      const handler = getHandler();
      const result = await handler!({
        id: featureId,
        afterId: "550e8400-e29b-41d4-a716-446655440001",
        beforeId: "550e8400-e29b-41d4-a716-446655440002",
      });

      expect(result.isError).toBeUndefined();
      expect(vi.mocked(generateSortOrderBetween)).toHaveBeenCalledWith(1, 3);
    });

    it("should return error when features belong to different projects", async () => {
      vi.mocked(prisma.feature.findUnique)
        .mockResolvedValueOnce({ id: "f1", projectId: "proj-1", identifier: "TT-1" } as never)
        .mockResolvedValueOnce({ projectId: "proj-2", sortOrder: 1 } as never);

      const handler = getHandler();
      const result = await handler!({
        id: "550e8400-e29b-41d4-a716-446655440000",
        afterId: "550e8400-e29b-41d4-a716-446655440001",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("same project");
    });

    it("should return error for non-existent feature", async () => {
      vi.mocked(prisma.feature.findUnique).mockResolvedValue(null);

      const handler = getHandler();
      const result = await handler!({
        id: "550e8400-e29b-41d4-a716-446655440000",
        afterId: "550e8400-e29b-41d4-a716-446655440001",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("not found");
    });
  });

  describe("spectree__reorder_task", () => {
    const getHandler = () => registeredTools.get("spectree__reorder_task")?.handler;

    it("should reorder a task after another task", async () => {
      const taskId = "550e8400-e29b-41d4-a716-446655440000";
      const afterTaskId = "550e8400-e29b-41d4-a716-446655440001";
      const featureId = "feat-1";

      const mockTask = { id: taskId, featureId, identifier: "TT-1-1" };
      const mockAfterTask = { featureId, sortOrder: 1 };
      const mockUpdatedTask = {
        id: taskId,
        identifier: "TT-1-1",
        title: "Test Task",
        sortOrder: 2,
        feature: { id: featureId, identifier: "TT-1", title: "Test Feature" },
        updatedAt: new Date(),
      };

      vi.mocked(prisma.task.findUnique)
        .mockResolvedValueOnce(mockTask as never)
        .mockResolvedValueOnce(mockAfterTask as never);
      vi.mocked(prisma.task.update).mockResolvedValue(mockUpdatedTask as never);
      vi.mocked(generateSortOrderBetween).mockReturnValue(2);

      const handler = getHandler();
      expect(handler).toBeDefined();

      const result = await handler!({
        id: taskId,
        afterId: afterTaskId,
      });

      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.id).toBe(taskId);
      expect(data.identifier).toBe("TT-1-1");
      expect(data.feature.id).toBe(featureId);
    });

    it("should reorder a task before another task", async () => {
      const taskId = "550e8400-e29b-41d4-a716-446655440000";
      const featureId = "feat-1";

      vi.mocked(prisma.task.findUnique)
        .mockResolvedValueOnce({ id: taskId, featureId, identifier: "TT-1-2" } as never)
        .mockResolvedValueOnce({ featureId, sortOrder: 3 } as never);
      vi.mocked(prisma.task.update).mockResolvedValue({
        id: taskId,
        identifier: "TT-1-2",
        title: "Test Task",
        sortOrder: 1.5,
        feature: { id: featureId, identifier: "TT-1", title: "Test Feature" },
        updatedAt: new Date(),
      } as never);

      const handler = getHandler();
      const result = await handler!({
        id: taskId,
        beforeId: "550e8400-e29b-41d4-a716-446655440002",
      });

      expect(result.isError).toBeUndefined();
    });

    it("should return error when tasks belong to different features", async () => {
      vi.mocked(prisma.task.findUnique)
        .mockResolvedValueOnce({ id: "t1", featureId: "feat-1", identifier: "TT-1-1" } as never)
        .mockResolvedValueOnce({ featureId: "feat-2", sortOrder: 1 } as never);

      const handler = getHandler();
      const result = await handler!({
        id: "550e8400-e29b-41d4-a716-446655440000",
        afterId: "550e8400-e29b-41d4-a716-446655440001",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("same feature");
    });

    it("should return error for non-existent task", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue(null);

      const handler = getHandler();
      const result = await handler!({
        id: "550e8400-e29b-41d4-a716-446655440000",
        afterId: "550e8400-e29b-41d4-a716-446655440001",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("not found");
    });

    it("should return error when neither afterId nor beforeId provided", async () => {
      const handler = getHandler();
      const result = await handler!({
        id: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("afterId or beforeId");
    });
  });

  describe("tool registration", () => {
    it("should register all ordering tools", () => {
      expect(registeredTools.has("spectree__reorder_project")).toBe(true);
      expect(registeredTools.has("spectree__reorder_feature")).toBe(true);
      expect(registeredTools.has("spectree__reorder_task")).toBe(true);
    });

    it("should have proper descriptions", () => {
      const projectTool = registeredTools.get("spectree__reorder_project");
      const featureTool = registeredTools.get("spectree__reorder_feature");
      const taskTool = registeredTools.get("spectree__reorder_task");

      expect(projectTool?.config.description).toContain("Reorder");
      expect(projectTool?.config.description).toContain("project");
      expect(featureTool?.config.description).toContain("Reorder");
      expect(featureTool?.config.description).toContain("feature");
      expect(taskTool?.config.description).toContain("Reorder");
      expect(taskTool?.config.description).toContain("task");
    });
  });
});
