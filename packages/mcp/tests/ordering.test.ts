/**
 * Integration tests for MCP Ordering tools
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";

interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

const { mockApiClient } = vi.hoisted(() => {
  const mockApiClient = {
    reorderEpic: vi.fn(),
    reorderFeature: vi.fn(),
    reorderTask: vi.fn(),
  };
  return { mockApiClient };
});

vi.mock("../src/api-client.js", () => ({
  getApiClient: () => mockApiClient,
  ApiError: class ApiError extends Error {
    status: number;
    body: unknown;
    constructor(message: string, status: number, body?: unknown) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.body = body;
    }
  },
}));

const registeredTools = new Map<string, { config: any; handler: any }>();

import { registerOrderingTools } from "../src/tools/ordering.js";

const mockServer = {
  registerTool: (name: string, config: any, handler: any) => {
    registeredTools.set(name, { config, handler });
  },
};

beforeAll(() => {
  registerOrderingTools(mockServer as any);
});

describe("MCP Ordering Tools", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.resetAllMocks());

  describe("spectree__reorder_item (COMPOSITE)", () => {
    const getHandler = () => registeredTools.get("spectree__reorder_item")?.handler;

    it("should reorder epic with action='reorder_epic'", async () => {
      const mockEpic = { id: "epic-1", name: "Epic Alpha", sortOrder: 2, team: {}, updatedAt: "2024-01-01" };
      mockApiClient.reorderEpic.mockResolvedValue({ data: mockEpic });

      const handler = getHandler();
      const result = await handler!({ action: "reorder_epic", id: "epic-1", afterId: "epic-2" });

      expect(mockApiClient.reorderEpic).toHaveBeenCalledWith("epic-1", {
        afterId: "epic-2",
        beforeId: undefined,
      });
      expect(result.isError).toBeUndefined();
    });

    it("should reorder feature with action='reorder_feature'", async () => {
      const mockFeature = { id: "feat-1", identifier: "ENG-1", title: "Feature", sortOrder: 2, updatedAt: "2024-01-01" };
      mockApiClient.reorderFeature.mockResolvedValue({ data: mockFeature });

      const handler = getHandler();
      const result = await handler!({ action: "reorder_feature", id: "feat-1", beforeId: "feat-3" });

      expect(mockApiClient.reorderFeature).toHaveBeenCalledWith("feat-1", {
        afterId: undefined,
        beforeId: "feat-3",
      });
      expect(result.isError).toBeUndefined();
    });

    it("should reorder task with action='reorder_task'", async () => {
      const mockTask = { id: "task-1", identifier: "ENG-1-1", title: "Task", sortOrder: 2, updatedAt: "2024-01-01" };
      mockApiClient.reorderTask.mockResolvedValue({ data: mockTask });

      const handler = getHandler();
      const result = await handler!({ action: "reorder_task", id: "task-1", afterId: "task-2", beforeId: "task-3" });

      expect(mockApiClient.reorderTask).toHaveBeenCalledWith("task-1", {
        afterId: "task-2",
        beforeId: "task-3",
      });
      expect(result.isError).toBeUndefined();
    });

    it("should validate that afterId or beforeId is provided", async () => {
      const handler = getHandler();
      const result = await handler!({ action: "reorder_epic", id: "epic-1" });

      expect(result.isError).toBe(true);
      expect(mockApiClient.reorderEpic).not.toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.reorderFeature.mockRejectedValue(new ApiError("Not found", 404));

      const handler = getHandler();
      const result = await handler!({ action: "reorder_feature", id: "non-existent", afterId: "feat-2" });

      expect(result.isError).toBe(true);
    });
  });

  describe("spectree__reorder_epic", () => {
    const getHandler = () => registeredTools.get("spectree__reorder_epic")?.handler;

    it("should reorder epic with afterId", async () => {
      const mockEpic = { id: "epic-1", name: "Epic Alpha", sortOrder: 2 };
      mockApiClient.reorderEpic.mockResolvedValue({ data: mockEpic });

      const handler = getHandler();
      const result = await handler!({ id: "epic-1", afterId: "epic-2" });

      expect(mockApiClient.reorderEpic).toHaveBeenCalledWith("epic-1", {
        afterId: "epic-2",
        beforeId: undefined,
      });
      expect(result.isError).toBeUndefined();
    });

    it("should reorder epic with beforeId", async () => {
      const mockEpic = { id: "epic-1", name: "Epic Alpha", sortOrder: 1 };
      mockApiClient.reorderEpic.mockResolvedValue({ data: mockEpic });

      const handler = getHandler();
      await handler!({ id: "epic-1", beforeId: "epic-3" });

      expect(mockApiClient.reorderEpic).toHaveBeenCalledWith("epic-1", {
        afterId: undefined,
        beforeId: "epic-3",
      });
    });

    it("should handle API errors", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.reorderEpic.mockRejectedValue(new ApiError("Not found", 404));

      const handler = getHandler();
      const result = await handler!({ id: "non-existent", afterId: "epic-2" });

      expect(result.isError).toBe(true);
    });
  });

  describe("spectree__reorder_feature", () => {
    const getHandler = () => registeredTools.get("spectree__reorder_feature")?.handler;

    it("should reorder feature", async () => {
      const mockFeature = { id: "feat-1", identifier: "ENG-1", sortOrder: 2 };
      mockApiClient.reorderFeature.mockResolvedValue({ data: mockFeature });

      const handler = getHandler();
      const result = await handler!({ id: "feat-1", afterId: "feat-2" });

      expect(mockApiClient.reorderFeature).toHaveBeenCalledWith("feat-1", {
        afterId: "feat-2",
        beforeId: undefined,
      });
      expect(result.isError).toBeUndefined();
    });

    it("should handle API errors", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.reorderFeature.mockRejectedValue(new ApiError("Not found", 404));

      const handler = getHandler();
      const result = await handler!({ id: "non-existent", afterId: "feat-2" });

      expect(result.isError).toBe(true);
    });
  });

  describe("spectree__reorder_task", () => {
    const getHandler = () => registeredTools.get("spectree__reorder_task")?.handler;

    it("should reorder task", async () => {
      const mockTask = { id: "task-1", identifier: "ENG-1-1", sortOrder: 2 };
      mockApiClient.reorderTask.mockResolvedValue({ data: mockTask });

      const handler = getHandler();
      const result = await handler!({ id: "task-1", afterId: "task-2" });

      expect(mockApiClient.reorderTask).toHaveBeenCalledWith("task-1", {
        afterId: "task-2",
        beforeId: undefined,
      });
      expect(result.isError).toBeUndefined();
    });

    it("should handle API errors", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.reorderTask.mockRejectedValue(new ApiError("Not found", 404));

      const handler = getHandler();
      const result = await handler!({ id: "non-existent", afterId: "task-2" });

      expect(result.isError).toBe(true);
    });
  });

  describe("tool registration", () => {
    it("should register all ordering tools", () => {
      expect(registeredTools.has("spectree__reorder_item")).toBe(true);
      expect(registeredTools.has("spectree__reorder_epic")).toBe(true);
      expect(registeredTools.has("spectree__reorder_feature")).toBe(true);
      expect(registeredTools.has("spectree__reorder_task")).toBe(true);
    });
  });
});
