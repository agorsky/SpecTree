/**
 * Integration tests for MCP Task tools
 *
 * Tests the task tool handlers:
 * - spectree__list_tasks
 * - spectree__get_task
 * - spectree__create_task
 * - spectree__update_task
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
  taskService: {
    listTasks: vi.fn(),
    getTaskById: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
  },
  prisma: {
    feature: {
      findUnique: vi.fn(),
    },
    task: {
      findUnique: vi.fn(),
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
  taskService,
  prisma,
} from "@spectree/api/src/services/index.js";

// Import the tools module to trigger registration
import "../src/tools/tasks.js";

describe("MCP Tasks Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("spectree__list_tasks", () => {
    const getHandler = () => registeredTools.get("spectree__list_tasks")?.handler;

    it("should list tasks without filters", async () => {
      const mockTasks = [
        {
          id: "task-1",
          identifier: "ENG-1-1",
          title: "Design API schema",
          description: "Create OpenAPI spec",
          featureId: "feat-1",
          statusId: "status-1",
          assigneeId: "user-1",
          sortOrder: 1,
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-02"),
        },
        {
          id: "task-2",
          identifier: "ENG-1-2",
          title: "Implement endpoints",
          description: null,
          featureId: "feat-1",
          statusId: null,
          assigneeId: null,
          sortOrder: 2,
          createdAt: new Date("2024-01-03"),
          updatedAt: new Date("2024-01-04"),
        },
      ];

      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: mockTasks,
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      expect(handler).toBeDefined();

      const result = await handler!({});

      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.tasks).toHaveLength(2);
      expect(data.tasks[0].identifier).toBe("ENG-1-1");
      expect(data.tasks[1].identifier).toBe("ENG-1-2");
    });

    it("should filter by feature UUID", async () => {
      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({ feature: "550e8400-e29b-41d4-a716-446655440000" });

      expect(vi.mocked(taskService.listTasks)).toHaveBeenCalledWith(
        expect.objectContaining({ featureId: "550e8400-e29b-41d4-a716-446655440000" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should filter by feature identifier (e.g., COM-123)", async () => {
      const mockFeature = {
        id: "resolved-feature-id",
        identifier: "COM-123",
        title: "Test Feature",
        description: null,
        projectId: "proj-1",
        statusId: null,
        assigneeId: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.feature.findUnique).mockResolvedValue(mockFeature);

      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({ feature: "COM-123" });

      expect(vi.mocked(prisma.feature.findUnique)).toHaveBeenCalledWith({
        where: { identifier: "COM-123" },
        select: { id: true },
      });
      expect(vi.mocked(taskService.listTasks)).toHaveBeenCalledWith(
        expect.objectContaining({ featureId: "resolved-feature-id" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should filter by status", async () => {
      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({ status: "status-uuid-123" });

      expect(vi.mocked(taskService.listTasks)).toHaveBeenCalledWith(
        expect.objectContaining({ statusId: "status-uuid-123" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should filter by assignee", async () => {
      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({ assignee: "user-uuid-456" });

      expect(vi.mocked(taskService.listTasks)).toHaveBeenCalledWith(
        expect.objectContaining({ assigneeId: "user-uuid-456" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should handle pagination", async () => {
      vi.mocked(taskService.listTasks).mockResolvedValue({
        data: [],
        meta: { cursor: "next-cursor-token", hasMore: true },
      });

      const handler = getHandler();
      const result = await handler!({ limit: 10, cursor: "prev-cursor" });

      expect(vi.mocked(taskService.listTasks)).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, cursor: "prev-cursor" })
      );

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.meta.hasMore).toBe(true);
      expect(data.meta.cursor).toBe("next-cursor-token");
    });

    it("should return error for non-existent feature", async () => {
      vi.mocked(prisma.feature.findUnique).mockResolvedValue(null);

      const handler = getHandler();
      const result = await handler!({ feature: "NON-EXISTENT" });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("not found");
    });
  });

  describe("spectree__get_task", () => {
    const getHandler = () => registeredTools.get("spectree__get_task")?.handler;

    it("should get task by UUID", async () => {
      const mockTask = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        identifier: "ENG-42-1",
        title: "Implement validation",
        description: "Add input validation",
        featureId: "feat-1",
        statusId: "status-1",
        assigneeId: "user-1",
        sortOrder: 1,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
      };

      vi.mocked(taskService.getTaskById).mockResolvedValue(mockTask);

      const handler = getHandler();
      expect(handler).toBeDefined();

      const result = await handler!({ id: "550e8400-e29b-41d4-a716-446655440000" });

      expect(vi.mocked(taskService.getTaskById)).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000"
      );
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.id).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(data.identifier).toBe("ENG-42-1");
      expect(data.title).toBe("Implement validation");
    });

    it("should get task by identifier (e.g., COM-123-1)", async () => {
      const mockTask = {
        id: "task-uuid",
        identifier: "COM-123-1",
        title: "Task from identifier",
        description: null,
        featureId: "feat-1",
        statusId: null,
        assigneeId: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.task.findUnique).mockResolvedValue(mockTask);

      const handler = getHandler();
      const result = await handler!({ id: "COM-123-1" });

      expect(vi.mocked(prisma.task.findUnique)).toHaveBeenCalledWith({
        where: { identifier: "COM-123-1" },
      });
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.identifier).toBe("COM-123-1");
    });

    it("should return error for non-existent task", async () => {
      vi.mocked(taskService.getTaskById).mockResolvedValue(null);
      vi.mocked(prisma.task.findUnique).mockResolvedValue(null);

      const handler = getHandler();
      const result = await handler!({ id: "non-existent" });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("not found");
    });
  });

  describe("spectree__create_task", () => {
    const getHandler = () => registeredTools.get("spectree__create_task")?.handler;

    it("should create a task with required fields", async () => {
      const mockCreatedTask = {
        id: "new-task-1",
        identifier: "ENG-1-1",
        title: "New Task",
        description: null,
        featureId: "feat-1",
        statusId: null,
        assigneeId: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // UUID check passes, feature ID is valid
      vi.mocked(taskService.createTask).mockResolvedValue(mockCreatedTask);

      const handler = getHandler();
      expect(handler).toBeDefined();

      const result = await handler!({
        title: "New Task",
        feature_id: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(vi.mocked(taskService.createTask)).toHaveBeenCalledWith({
        title: "New Task",
        featureId: "550e8400-e29b-41d4-a716-446655440000",
        description: undefined,
        statusId: undefined,
        assigneeId: undefined,
      });
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.title).toBe("New Task");
      expect(data.identifier).toBe("ENG-1-1");
    });

    it("should create a task with all optional fields", async () => {
      const mockCreatedTask = {
        id: "new-task-2",
        identifier: "ENG-2-1",
        title: "Full Task",
        description: "Detailed task description",
        featureId: "feat-1",
        statusId: "status-1",
        assigneeId: "user-1",
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(taskService.createTask).mockResolvedValue(mockCreatedTask);

      const handler = getHandler();
      const result = await handler!({
        title: "Full Task",
        feature_id: "550e8400-e29b-41d4-a716-446655440000",
        description: "Detailed task description",
        status: "status-1",
        assignee: "user-1",
      });

      expect(vi.mocked(taskService.createTask)).toHaveBeenCalledWith({
        title: "Full Task",
        featureId: "550e8400-e29b-41d4-a716-446655440000",
        description: "Detailed task description",
        statusId: "status-1",
        assigneeId: "user-1",
      });
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.description).toBe("Detailed task description");
    });

    it("should resolve feature identifier when creating task", async () => {
      const mockFeature = {
        id: "resolved-feature-uuid",
        identifier: "COM-123",
        title: "Test Feature",
        description: null,
        projectId: "proj-1",
        statusId: null,
        assigneeId: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.feature.findUnique).mockResolvedValue(mockFeature);
      vi.mocked(taskService.createTask).mockResolvedValue({
        id: "task-1",
        identifier: "COM-123-1",
        title: "Test",
        description: null,
        featureId: "resolved-feature-uuid",
        statusId: null,
        assigneeId: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const handler = getHandler();
      const result = await handler!({
        title: "Test",
        feature_id: "COM-123",
      });

      expect(vi.mocked(prisma.feature.findUnique)).toHaveBeenCalledWith({
        where: { identifier: "COM-123" },
        select: { id: true },
      });
      expect(vi.mocked(taskService.createTask)).toHaveBeenCalledWith(
        expect.objectContaining({ featureId: "resolved-feature-uuid" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should return error for non-existent feature", async () => {
      vi.mocked(prisma.feature.findUnique).mockResolvedValue(null);

      const handler = getHandler();
      const result = await handler!({
        title: "Test Task",
        feature_id: "NON-EXISTENT",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("not found");
    });
  });

  describe("spectree__update_task", () => {
    const getHandler = () => registeredTools.get("spectree__update_task")?.handler;

    it("should update task by UUID", async () => {
      const existingTask = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        identifier: "ENG-1-1",
        title: "Old Title",
        description: null,
        featureId: "feat-1",
        statusId: null,
        assigneeId: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedTask = {
        ...existingTask,
        title: "Updated Title",
        description: "New description",
        updatedAt: new Date(),
      };

      vi.mocked(taskService.getTaskById).mockResolvedValue(existingTask);
      vi.mocked(taskService.updateTask).mockResolvedValue(updatedTask);

      const handler = getHandler();
      expect(handler).toBeDefined();

      const result = await handler!({
        id: "550e8400-e29b-41d4-a716-446655440000",
        title: "Updated Title",
        description: "New description",
      });

      expect(vi.mocked(taskService.updateTask)).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        expect.objectContaining({
          title: "Updated Title",
          description: "New description",
        })
      );
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.title).toBe("Updated Title");
    });

    it("should update task by identifier", async () => {
      const existingTask = {
        id: "task-uuid",
        identifier: "COM-42-3",
        title: "Original",
        description: null,
        featureId: "feat-1",
        statusId: null,
        assigneeId: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.task.findUnique).mockResolvedValue(existingTask);
      vi.mocked(taskService.updateTask).mockResolvedValue({
        ...existingTask,
        title: "Changed",
      });

      const handler = getHandler();
      const result = await handler!({
        id: "COM-42-3",
        title: "Changed",
      });

      expect(vi.mocked(prisma.task.findUnique)).toHaveBeenCalledWith({
        where: { identifier: "COM-42-3" },
      });
      expect(vi.mocked(taskService.updateTask)).toHaveBeenCalledWith(
        "task-uuid",
        expect.any(Object)
      );
      expect(result.isError).toBeUndefined();
    });

    it("should update task status", async () => {
      const existingTask = {
        id: "task-1",
        identifier: "ENG-1-1",
        title: "Test",
        description: null,
        featureId: "feat-1",
        statusId: "old-status",
        assigneeId: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(taskService.getTaskById).mockResolvedValue(existingTask);
      vi.mocked(taskService.updateTask).mockResolvedValue({
        ...existingTask,
        statusId: "new-status-uuid",
      });

      const handler = getHandler();
      const result = await handler!({
        id: "550e8400-e29b-41d4-a716-446655440000",
        status: "new-status-uuid",
      });

      expect(vi.mocked(taskService.updateTask)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ statusId: "new-status-uuid" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should update task assignee", async () => {
      const existingTask = {
        id: "task-1",
        identifier: "ENG-1-1",
        title: "Test",
        description: null,
        featureId: "feat-1",
        statusId: null,
        assigneeId: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(taskService.getTaskById).mockResolvedValue(existingTask);
      vi.mocked(taskService.updateTask).mockResolvedValue({
        ...existingTask,
        assigneeId: "new-assignee-uuid",
      });

      const handler = getHandler();
      const result = await handler!({
        id: "550e8400-e29b-41d4-a716-446655440000",
        assignee: "new-assignee-uuid",
      });

      expect(vi.mocked(taskService.updateTask)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ assigneeId: "new-assignee-uuid" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should return error for non-existent task", async () => {
      vi.mocked(taskService.getTaskById).mockResolvedValue(null);
      vi.mocked(prisma.task.findUnique).mockResolvedValue(null);

      const handler = getHandler();
      const result = await handler!({
        id: "non-existent",
        title: "New Title",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("not found");
    });
  });

  describe("tool registration", () => {
    it("should register all task tools", () => {
      expect(registeredTools.has("spectree__list_tasks")).toBe(true);
      expect(registeredTools.has("spectree__get_task")).toBe(true);
      expect(registeredTools.has("spectree__create_task")).toBe(true);
      expect(registeredTools.has("spectree__update_task")).toBe(true);
    });

    it("should have proper descriptions", () => {
      const listTool = registeredTools.get("spectree__list_tasks");
      const getTool = registeredTools.get("spectree__get_task");
      const createTool = registeredTools.get("spectree__create_task");
      const updateTool = registeredTools.get("spectree__update_task");

      expect(listTool?.config.description).toContain("List tasks");
      expect(getTool?.config.description).toContain("Get detailed information");
      expect(createTool?.config.description).toContain("Create a new task");
      expect(updateTool?.config.description).toContain("Update an existing task");
    });
  });
});
