/**
 * Integration tests for MCP Search tools
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";

interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

const { mockApiClient } = vi.hoisted(() => {
  const mockApiClient = {
    search: vi.fn(),
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

import { registerSearchTools } from "../src/tools/search.js";

const mockServer = {
  registerTool: (name: string, config: any, handler: any) => {
    registeredTools.set(name, { config, handler });
  },
};

beforeAll(() => {
  registerSearchTools(mockServer as any);
});

describe("MCP Search Tools", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.resetAllMocks());

  describe("spectree__search", () => {
    const getHandler = () => registeredTools.get("spectree__search")?.handler;

    it("should search with query", async () => {
      const mockResults = [
        { type: "feature", id: "feat-1", identifier: "ENG-1", title: "Auth Feature" },
        { type: "task", id: "task-1", identifier: "ENG-1-1", title: "Login task" },
      ];

      mockApiClient.search.mockResolvedValue({
        results: mockResults,
        meta: { total: 2, cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({ query: "auth" });

      expect(mockApiClient.search).toHaveBeenCalledWith(
        expect.objectContaining({ query: "auth" })
      );
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.results).toHaveLength(2);
    });

    it("should filter by project", async () => {
      mockApiClient.search.mockResolvedValue({
        results: [],
        meta: { total: 0, cursor: null, hasMore: false },
      });

      const handler = getHandler();
      await handler!({ project: "Test Project" });

      expect(mockApiClient.search).toHaveBeenCalledWith(
        expect.objectContaining({ project: "Test Project" })
      );
    });

    it("should filter by type", async () => {
      mockApiClient.search.mockResolvedValue({
        results: [],
        meta: { total: 0, cursor: null, hasMore: false },
      });

      const handler = getHandler();
      await handler!({ type: "feature" });

      expect(mockApiClient.search).toHaveBeenCalledWith(
        expect.objectContaining({ type: "feature" })
      );
    });

    it("should handle pagination", async () => {
      mockApiClient.search.mockResolvedValue({
        results: [],
        meta: { total: 100, cursor: "next-cursor", hasMore: true },
      });

      const handler = getHandler();
      const result = await handler!({ limit: 10, cursor: "prev-cursor" });

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.meta.hasMore).toBe(true);
      expect(data.meta.cursor).toBe("next-cursor");
    });

    it("should handle API errors", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.search.mockRejectedValue(new ApiError("Server error", 500));

      const handler = getHandler();
      const result = await handler!({ query: "test" });

      expect(result.isError).toBe(true);
    });
  });

  describe("tool registration", () => {
    it("should register the search tool", () => {
      expect(registeredTools.has("spectree__search")).toBe(true);
    });
  });
});
