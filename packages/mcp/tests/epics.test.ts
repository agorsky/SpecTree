/**
 * Integration tests for MCP Epic tools
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";

interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

const { mockApiClient } = vi.hoisted(() => {
  const mockApiClient = {
    listEpics: vi.fn(),
    getEpic: vi.fn(),
    createEpic: vi.fn(),
    getTeam: vi.fn(),
    listFeatures: vi.fn(),
    listPersonalEpics: vi.fn(),
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

import { registerEpicTools } from "../src/tools/epics.js";

const mockServer = {
  registerTool: (name: string, config: any, handler: any) => {
    registeredTools.set(name, { config, handler });
  },
};

beforeAll(() => {
  registerEpicTools(mockServer as any);
});

describe("MCP Epics Tools", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.resetAllMocks());

  describe("spectree__list_epics", () => {
    const getHandler = () => registeredTools.get("spectree__list_epics")?.handler;

    it("should list epics", async () => {
      const mockEpics = [
        { id: "epic-1", name: "Epic Alpha", createdAt: "2026-01-10T00:00:00Z", updatedAt: "2026-01-10T00:00:00Z" },
        { id: "epic-2", name: "Epic Beta", createdAt: "2026-01-11T00:00:00Z", updatedAt: "2026-01-11T00:00:00Z" },
      ];

      mockApiClient.listEpics.mockResolvedValue({
        data: mockEpics,
        meta: { cursor: null, hasMore: false },
      });

      // Need to mock personal epics too since default scope is "all"
      mockApiClient.listPersonalEpics.mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({});

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.epics).toHaveLength(2);
    });

    it("should filter by team", async () => {
      const mockTeam = { id: "team-1", name: "Engineering", key: "ENG" };
      
      mockApiClient.getTeam.mockResolvedValue({ data: mockTeam });
      mockApiClient.listEpics.mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      await handler!({ team: "Engineering" });

      expect(mockApiClient.getTeam).toHaveBeenCalledWith("Engineering");
    });

    it("should handle API errors", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.getTeam.mockRejectedValue(new ApiError("Not found", 404));

      const handler = getHandler();
      const result = await handler!({ team: "Non-Existent" });

      expect(result.isError).toBe(true);
    });
  });

  describe("spectree__get_epic", () => {
    const getHandler = () => registeredTools.get("spectree__get_epic")?.handler;

    it("should get epic by query", async () => {
      const mockEpic = { id: "epic-1", name: "Test Epic" };
      mockApiClient.getEpic.mockResolvedValue({ data: mockEpic });
      mockApiClient.listFeatures.mockResolvedValue({ data: [], meta: { cursor: null, hasMore: false } });

      const handler = getHandler();
      const result = await handler!({ query: "Test Epic" });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.name).toBe("Test Epic");
    });

    it("should return error for non-existent epic", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.getEpic.mockRejectedValue(new ApiError("Not found", 404));

      const handler = getHandler();
      const result = await handler!({ query: "Non-Existent" });

      expect(result.isError).toBe(true);
    });
  });

  describe("spectree__create_epic", () => {
    const getHandler = () => registeredTools.get("spectree__create_epic")?.handler;

    it("should create epic", async () => {
      const mockTeam = { id: "team-1", name: "Engineering", key: "ENG" };
      const mockEpic = { id: "epic-1", name: "New Epic" };

      mockApiClient.getTeam.mockResolvedValue({ data: mockTeam });
      mockApiClient.createEpic.mockResolvedValue({ data: mockEpic });

      const handler = getHandler();
      const result = await handler!({ name: "New Epic", team: "Engineering" });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.name).toBe("New Epic");
    });

    it("should handle API errors on create", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.getTeam.mockRejectedValue(new ApiError("Not found", 404));

      const handler = getHandler();
      const result = await handler!({ name: "New", team: "Non-Existent" });

      expect(result.isError).toBe(true);
    });
  });

  describe("tool registration", () => {
    it("should register all epic tools", () => {
      expect(registeredTools.has("spectree__list_epics")).toBe(true);
      expect(registeredTools.has("spectree__get_epic")).toBe(true);
      expect(registeredTools.has("spectree__create_epic")).toBe(true);
    });
  });
});
