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
    reorderProject: vi.fn(),
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

  describe("spectree__reorder_project", () => {
    const getHandler = () => registeredTools.get("spectree__reorder_project")?.handler;

    it("should reorder project with afterId", async () => {
      const mockProject = { id: "proj-1", name: "Project Alpha", sortOrder: 2 };
      mockApiClient.reorderProject.mockResolvedValue({ data: mockProject });

      const handler = getHandler();
      const result = await handler!({ id: "proj-1", afterId: "proj-2" });

      expect(mockApiClient.reorderProject).toHaveBeenCalledWith("proj-1", {
        afterId: "proj-2",
        beforeId: undefined,
      });
      expect(result.isError).toBeUndefined();
    });

    it("should reorder project with beforeId", async () => {
      const mockProject = { id: "proj-1", name: "Project Alpha", sortOrder: 1 };
      mockApiClient.reorderProject.mockResolvedValue({ data: mockProject });

      const handler = getHandler();
      await handler!({ id: "proj-1", beforeId: "proj-3" });

      expect(mockApiClient.reorderProject).toHaveBeenCalledWith("proj-1", {
        afterId: undefined,
        beforeId: "proj-3",
      });
    });

    it("should handle API errors", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.reorderProject.mockRejectedValue(new ApiError("Not found", 404));

      const handler = getHandler();
      const result = await handler!({ id: "non-existent", afterId: "proj-2" });

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
      expect(registeredTools.has("spectree__reorder_project")).toBe(true);
      expect(registeredTools.has("spectree__reorder_feature")).toBe(true);
      expect(registeredTools.has("spectree__reorder_task")).toBe(true);
    });
  });
});
