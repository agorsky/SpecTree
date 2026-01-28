/**
 * Integration tests for MCP Search tool
 *
 * Tests the search tool handler:
 * - spectree__search
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
  featureService: {
    listFeatures: vi.fn(),
  },
  taskService: {
    listTasks: vi.fn(),
  },
  userService: {
    getCurrentUser: vi.fn(),
  },
  prisma: {
    project: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    feature: {
      findMany: vi.fn(),
    },
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "NotFoundError";
    }
  },
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
import {
  featureService,
  taskService,
  userService,
  prisma,
} from "@spectree/api/src/services/index.js";

// Import the tools module to trigger registration
import "../src/tools/search.js";

describe("MCP Search Tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for getCurrentUser
    vi.mocked(userService.getCurrentUser).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("spectree__search", () => {
    const getHandler = () => registeredTools.get("spectree__search")?.handler;

    it("should search features and tasks with a query", async () => {
      const mockFeatures = [
        {
          id: "feat-1",
          identifier: "TT-1",
          title: "Login Feature",
          description: "User login functionality",
          statusId: "status-1",
          assigneeId: "user-1",
          projectId: "proj-1",
          createdAt: new Date("2024-01-15"),
          updatedAt: new Date("2024-01-16"),
        },
      ];

      const mockTasks = [
        {
          id: "task-1",
          identifier: "TT-1-1",
          title: "Implement login form",
          description: "Create the login form component",
          statusId: "status-2",
          assigneeId: "user-2",
          featureId: "feat-1",
          createdAt: new Date("2024-01-14"),
          updatedAt: new Date("2024-01-15"),
        },
      ];

      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: mockFeatures,
        meta: { cursor: null, hasMore: false },
      });

      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: mockTasks,
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      expect(handler).toBeDefined();

      const result = await handler!({ query: "login" });

      expect(vi.mocked(featureService.listFeatures)).toHaveBeenCalledWith(
        expect.objectContaining({ query: "login" })
      );
      expect(vi.mocked(taskService.listTasks)).toHaveBeenCalledWith(
        expect.objectContaining({ query: "login" })
      );
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.results).toHaveLength(2);
      expect(data.results[0].type).toBe("feature");
      expect(data.results[1].type).toBe("task");
    });

    it("should search only features when type is 'feature'", async () => {
      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: [
          {
            id: "feat-1",
            identifier: "TT-1",
            title: "Test Feature",
            description: null,
            statusId: null,
            assigneeId: null,
            projectId: "proj-1",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({ type: "feature", query: "test" });

      expect(vi.mocked(featureService.listFeatures)).toHaveBeenCalled();
      expect(vi.mocked(taskService.listTasks)).not.toHaveBeenCalled();
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.results.every((r: { type: string }) => r.type === "feature")).toBe(true);
    });

    it("should search only tasks when type is 'task'", async () => {
      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: [
          {
            id: "task-1",
            identifier: "TT-1-1",
            title: "Test Task",
            description: null,
            statusId: null,
            assigneeId: null,
            featureId: "feat-1",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({ type: "task", query: "test" });

      expect(vi.mocked(taskService.listTasks)).toHaveBeenCalled();
      expect(vi.mocked(featureService.listFeatures)).not.toHaveBeenCalled();
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.results.every((r: { type: string }) => r.type === "task")).toBe(true);
    });

    it("should filter by project", async () => {
      const mockProject = { id: "proj-uuid" };
      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject as never);
      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });
      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });
      vi.mocked(prisma.feature.findMany).mockResolvedValue([]);

      const handler = getHandler();
      const result = await handler!({ project: "proj-uuid" });

      expect(vi.mocked(prisma.project.findUnique)).toHaveBeenCalledWith({
        where: { id: "proj-uuid" },
        select: { id: true },
      });
      expect(vi.mocked(featureService.listFeatures)).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: "proj-uuid" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should resolve project by name", async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.project.findFirst).mockResolvedValue({ id: "resolved-proj-id" } as never);
      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });
      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });
      vi.mocked(prisma.feature.findMany).mockResolvedValue([]);

      const handler = getHandler();
      const result = await handler!({ project: "My Project" });

      expect(vi.mocked(prisma.project.findFirst)).toHaveBeenCalledWith({
        where: { name: "My Project", isArchived: false },
        select: { id: true },
      });
      expect(vi.mocked(featureService.listFeatures)).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: "resolved-proj-id" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should return error for non-existent project", async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.project.findFirst).mockResolvedValue(null);

      const handler = getHandler();
      const result = await handler!({ project: "NonExistentProject" });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("not found");
    });

    it("should filter by status", async () => {
      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });
      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({ status: "In Progress" });

      expect(vi.mocked(featureService.listFeatures)).toHaveBeenCalledWith(
        expect.objectContaining({ status: "In Progress" })
      );
      expect(vi.mocked(taskService.listTasks)).toHaveBeenCalledWith(
        expect.objectContaining({ status: "In Progress" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should filter by status category", async () => {
      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });
      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({ statusCategory: "started" });

      expect(vi.mocked(featureService.listFeatures)).toHaveBeenCalledWith(
        expect.objectContaining({ statusCategory: "started" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should filter by assignee", async () => {
      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });
      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({ assignee: "user-uuid" });

      expect(vi.mocked(featureService.listFeatures)).toHaveBeenCalledWith(
        expect.objectContaining({ assignee: "user-uuid" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should resolve 'me' assignee to current user", async () => {
      vi.mocked(userService.getCurrentUser).mockResolvedValue({
        id: "current-user-uuid",
        email: "user@example.com",
        name: "Current User",
      } as never);
      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });
      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({ assignee: "me" });

      expect(vi.mocked(featureService.listFeatures)).toHaveBeenCalledWith(
        expect.objectContaining({
          assignee: "me",
          currentUserId: "current-user-uuid",
        })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should filter by createdAt date", async () => {
      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });
      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({ createdAt: "2024-01-01" });

      expect(vi.mocked(featureService.listFeatures)).toHaveBeenCalledWith(
        expect.objectContaining({ createdAt: "2024-01-01" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should filter by updatedAt date with duration format", async () => {
      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });
      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({ updatedAt: "-P7D" });

      expect(vi.mocked(featureService.listFeatures)).toHaveBeenCalledWith(
        expect.objectContaining({ updatedAt: "-P7D" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should respect limit parameter", async () => {
      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });
      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({ limit: 10 });

      expect(vi.mocked(featureService.listFeatures)).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should handle pagination with feature cursor", async () => {
      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({
        type: "feature",
        cursor: "feature:some-cursor-id",
      });

      expect(vi.mocked(featureService.listFeatures)).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: "some-cursor-id" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should handle pagination with task cursor", async () => {
      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({
        type: "task",
        cursor: "task:some-task-cursor",
      });

      expect(vi.mocked(taskService.listTasks)).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: "some-task-cursor" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should handle combined cursor for 'all' type", async () => {
      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });
      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({
        type: "all",
        cursor: "combined:feat-cursor|task-cursor",
      });

      expect(vi.mocked(featureService.listFeatures)).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: "feat-cursor" })
      );
      expect(vi.mocked(taskService.listTasks)).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: "task-cursor" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should return hasMore and cursor in pagination metadata", async () => {
      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: [
          {
            id: "feat-1",
            identifier: "TT-1",
            title: "Feature",
            description: null,
            statusId: null,
            assigneeId: null,
            projectId: "proj-1",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        meta: { cursor: "next-feat-cursor", hasMore: true },
      });
      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({});

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.meta.hasMore).toBe(true);
      expect(data.meta.cursor).toContain("combined:");
    });

    it("should sort combined results by createdAt (newest first)", async () => {
      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: [
          {
            id: "feat-1",
            identifier: "TT-1",
            title: "Older Feature",
            description: null,
            statusId: null,
            assigneeId: null,
            projectId: "proj-1",
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
          },
        ],
        meta: { cursor: null, hasMore: false },
      });
      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: [
          {
            id: "task-1",
            identifier: "TT-1-1",
            title: "Newer Task",
            description: null,
            statusId: null,
            assigneeId: null,
            featureId: "feat-1",
            createdAt: new Date("2024-01-15"),
            updatedAt: new Date("2024-01-15"),
          },
        ],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({});

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.results[0].title).toBe("Newer Task");
      expect(data.results[1].title).toBe("Older Feature");
    });

    it("should filter tasks by project through parent features", async () => {
      const projectId = "proj-uuid";
      vi.mocked(prisma.project.findUnique).mockResolvedValue({ id: projectId } as never);
      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });
      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: [
          {
            id: "task-1",
            identifier: "TT-1-1",
            title: "Task in project",
            description: null,
            statusId: null,
            assigneeId: null,
            featureId: "feat-in-project",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "task-2",
            identifier: "TT-2-1",
            title: "Task not in project",
            description: null,
            statusId: null,
            assigneeId: null,
            featureId: "feat-not-in-project",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        meta: { cursor: null, hasMore: false },
      });
      // Mock feature lookup for filtering
      vi.mocked(prisma.feature.findMany).mockResolvedValue([
        { id: "feat-in-project" },
      ] as never);

      const handler = getHandler();
      const result = await handler!({ project: projectId });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      // Only the task in the project should be returned
      const taskResults = data.results.filter((r: { type: string }) => r.type === "task");
      expect(taskResults).toHaveLength(1);
      expect(taskResults[0].featureId).toBe("feat-in-project");
    });

    it("should return empty results when no matches", async () => {
      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });
      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({ query: "nonexistent" });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.results).toHaveLength(0);
      expect(data.meta.hasMore).toBe(false);
    });
  });

  describe("tool registration", () => {
    it("should register the search tool", () => {
      expect(registeredTools.has("spectree__search")).toBe(true);
    });

    it("should have proper description", () => {
      const searchTool = registeredTools.get("spectree__search");

      expect(searchTool?.config.description).toContain("Search");
      expect(searchTool?.config.description).toContain("features");
      expect(searchTool?.config.description).toContain("tasks");
    });

    it("should describe supported filters in description", () => {
      const searchTool = registeredTools.get("spectree__search");
      const desc = searchTool?.config.description ?? "";

      expect(desc).toContain("project");
      expect(desc).toContain("status");
      expect(desc).toContain("assignee");
    });
  });
});
