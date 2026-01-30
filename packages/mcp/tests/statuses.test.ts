/**
 * Integration tests for MCP Status tools
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";

interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

const { mockApiClient } = vi.hoisted(() => {
  const mockApiClient = {
    listStatuses: vi.fn(),
    getStatus: vi.fn(),
    getTeam: vi.fn(),
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

import { registerStatusTools } from "../src/tools/statuses.js";

const mockServer = {
  registerTool: (name: string, config: any, handler: any) => {
    registeredTools.set(name, { config, handler });
  },
};

beforeAll(() => {
  registerStatusTools(mockServer as any);
});

describe("MCP Statuses Tools", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.resetAllMocks());

  describe("spectree__list_statuses", () => {
    const getHandler = () => registeredTools.get("spectree__list_statuses")?.handler;

    it("should list statuses for a team by UUID", async () => {
      const mockStatuses = [
        { id: "status-1", name: "Backlog", category: "backlog" },
        { id: "status-2", name: "In Progress", category: "started" },
        { id: "status-3", name: "Done", category: "completed" },
      ];

      // resolveTeamId calls getTeam first
      mockApiClient.getTeam.mockResolvedValue({ data: { id: "team-1", name: "Engineering" } });
      mockApiClient.listStatuses.mockResolvedValue({ data: mockStatuses });

      const handler = getHandler();
      const result = await handler!({ team: "team-1" });

      expect(mockApiClient.getTeam).toHaveBeenCalledWith("team-1");
      expect(mockApiClient.listStatuses).toHaveBeenCalledWith("team-1");
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "[]");
      expect(data).toHaveLength(3);
    });

    it("should resolve team by name", async () => {
      const mockTeam = { id: "team-1", name: "Engineering", key: "ENG" };
      
      mockApiClient.getTeam.mockResolvedValue({ data: mockTeam });
      mockApiClient.listStatuses.mockResolvedValue({ data: [] });

      const handler = getHandler();
      await handler!({ team: "Engineering" });

      expect(mockApiClient.getTeam).toHaveBeenCalledWith("Engineering");
      expect(mockApiClient.listStatuses).toHaveBeenCalledWith("team-1");
    });

    it("should handle API errors", async () => {
      mockApiClient.getTeam.mockResolvedValue(null);

      const handler = getHandler();
      const result = await handler!({ team: "Non-Existent" });

      expect(result.isError).toBe(true);
    });
  });

  describe("spectree__get_status", () => {
    const getHandler = () => registeredTools.get("spectree__get_status")?.handler;

    it("should get status by ID", async () => {
      const mockStatus = { id: "status-1", name: "In Progress", category: "started" };
      mockApiClient.getStatus.mockResolvedValue({ data: mockStatus });

      const handler = getHandler();
      const result = await handler!({ id: "status-1" });

      expect(mockApiClient.getStatus).toHaveBeenCalledWith("status-1");
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.name).toBe("In Progress");
    });

    it("should return error for non-existent status", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.getStatus.mockRejectedValue(new ApiError("Not found", 404));

      const handler = getHandler();
      const result = await handler!({ id: "non-existent" });

      expect(result.isError).toBe(true);
    });
  });

  describe("tool registration", () => {
    it("should register all status tools", () => {
      expect(registeredTools.has("spectree__list_statuses")).toBe(true);
      expect(registeredTools.has("spectree__get_status")).toBe(true);
    });
  });
});
