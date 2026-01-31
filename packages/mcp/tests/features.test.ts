/**
 * Integration tests for MCP Feature tools
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";

interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

const { mockApiClient } = vi.hoisted(() => {
  const mockApiClient = {
    listFeatures: vi.fn(),
    getFeature: vi.fn(),
    createFeature: vi.fn(),
    updateFeature: vi.fn(),
    getEpic: vi.fn(),
    listTasks: vi.fn(),
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

import { registerFeatureTools } from "../src/tools/features.js";

const mockServer = {
  registerTool: (name: string, config: any, handler: any) => {
    registeredTools.set(name, { config, handler });
  },
};

beforeAll(() => {
  registerFeatureTools(mockServer as any);
});

describe("MCP Features Tools", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.resetAllMocks());

  describe("spectree__list_features", () => {
    const getHandler = () => registeredTools.get("spectree__list_features")?.handler;

    it("should list features", async () => {
      const mockFeatures = [
        { id: "feat-1", identifier: "ENG-1", title: "Feature One" },
        { id: "feat-2", identifier: "ENG-2", title: "Feature Two" },
      ];

      mockApiClient.listFeatures.mockResolvedValue({
        data: mockFeatures,
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({});

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.features).toHaveLength(2);
    });

    it("should filter by epic", async () => {
      mockApiClient.listFeatures.mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      await handler!({ epic: "Test Epic" });

      expect(mockApiClient.listFeatures).toHaveBeenCalledWith(
        expect.objectContaining({ epic: "Test Epic" })
      );
    });

    it("should handle API errors", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.listFeatures.mockRejectedValue(new ApiError("Not found", 404));

      const handler = getHandler();
      const result = await handler!({ epic: "Non-Existent" });

      expect(result.isError).toBe(true);
    });
  });

  describe("spectree__get_feature", () => {
    const getHandler = () => registeredTools.get("spectree__get_feature")?.handler;

    it("should get feature by UUID", async () => {
      const mockFeature = { id: "feat-1", identifier: "ENG-1", title: "Feature" };
      mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
      mockApiClient.listTasks.mockResolvedValue({ data: [], meta: { cursor: null, hasMore: false } });

      const handler = getHandler();
      const result = await handler!({ id: "feat-1" });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.id).toBe("feat-1");
    });

    it("should return error for non-existent feature", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.getFeature.mockRejectedValue(new ApiError("Not found", 404));

      const handler = getHandler();
      const result = await handler!({ id: "non-existent" });

      expect(result.isError).toBe(true);
    });
  });

  describe("spectree__create_feature", () => {
    const getHandler = () => registeredTools.get("spectree__create_feature")?.handler;

    it("should create feature", async () => {
      const mockEpic = { id: "epic-1", name: "Test", teamId: "team-1" };
      const mockFeature = { id: "feat-1", identifier: "ENG-1", title: "New Feature" };

      mockApiClient.getEpic.mockResolvedValue({ data: mockEpic });
      mockApiClient.createFeature.mockResolvedValue({ data: mockFeature });

      const handler = getHandler();
      const result = await handler!({ title: "New Feature", epic: "Test" });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.title).toBe("New Feature");
    });

    it("should handle API errors on create", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.getEpic.mockRejectedValue(new ApiError("Not found", 404));

      const handler = getHandler();
      const result = await handler!({ title: "New", epic: "Non-Existent" });

      expect(result.isError).toBe(true);
    });
  });

  describe("spectree__update_feature", () => {
    const getHandler = () => registeredTools.get("spectree__update_feature")?.handler;

    it("should update feature", async () => {
      const mockFeature = { id: "feat-1", identifier: "ENG-1", title: "Updated" };
      mockApiClient.updateFeature.mockResolvedValue({ data: mockFeature });

      const handler = getHandler();
      const result = await handler!({ id: "feat-1", title: "Updated" });

      expect(result.isError).toBeUndefined();
    });

    it("should return error for non-existent feature", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.updateFeature.mockRejectedValue(new ApiError("Not found", 404));

      const handler = getHandler();
      const result = await handler!({ id: "non-existent", title: "New" });

      expect(result.isError).toBe(true);
    });
  });

  describe("tool registration", () => {
    it("should register all feature tools", () => {
      expect(registeredTools.has("spectree__list_features")).toBe(true);
      expect(registeredTools.has("spectree__get_feature")).toBe(true);
      expect(registeredTools.has("spectree__create_feature")).toBe(true);
      expect(registeredTools.has("spectree__update_feature")).toBe(true);
    });
  });
});
