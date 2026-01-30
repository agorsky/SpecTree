/**
 * Integration tests for MCP Project tools
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";

interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

const { mockApiClient } = vi.hoisted(() => {
  const mockApiClient = {
    listProjects: vi.fn(),
    getProject: vi.fn(),
    createProject: vi.fn(),
    getTeam: vi.fn(),
    listFeatures: vi.fn(),
    listPersonalProjects: vi.fn(),
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

import { registerProjectTools } from "../src/tools/projects.js";

const mockServer = {
  registerTool: (name: string, config: any, handler: any) => {
    registeredTools.set(name, { config, handler });
  },
};

beforeAll(() => {
  registerProjectTools(mockServer as any);
});

describe("MCP Projects Tools", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.resetAllMocks());

  describe("spectree__list_projects", () => {
    const getHandler = () => registeredTools.get("spectree__list_projects")?.handler;

    it("should list projects", async () => {
      const mockProjects = [
        { id: "proj-1", name: "Project Alpha", createdAt: "2026-01-10T00:00:00Z", updatedAt: "2026-01-10T00:00:00Z" },
        { id: "proj-2", name: "Project Beta", createdAt: "2026-01-11T00:00:00Z", updatedAt: "2026-01-11T00:00:00Z" },
      ];

      mockApiClient.listProjects.mockResolvedValue({
        data: mockProjects,
        meta: { cursor: null, hasMore: false },
      });

      // Need to mock personal projects too since default scope is "all"
      mockApiClient.listPersonalProjects.mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({});

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.projects).toHaveLength(2);
    });

    it("should filter by team", async () => {
      const mockTeam = { id: "team-1", name: "Engineering", key: "ENG" };
      
      mockApiClient.getTeam.mockResolvedValue({ data: mockTeam });
      mockApiClient.listProjects.mockResolvedValue({
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

  describe("spectree__get_project", () => {
    const getHandler = () => registeredTools.get("spectree__get_project")?.handler;

    it("should get project by query", async () => {
      const mockProject = { id: "proj-1", name: "Test Project" };
      mockApiClient.getProject.mockResolvedValue({ data: mockProject });
      mockApiClient.listFeatures.mockResolvedValue({ data: [], meta: { cursor: null, hasMore: false } });

      const handler = getHandler();
      const result = await handler!({ query: "Test Project" });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.name).toBe("Test Project");
    });

    it("should return error for non-existent project", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.getProject.mockRejectedValue(new ApiError("Not found", 404));

      const handler = getHandler();
      const result = await handler!({ query: "Non-Existent" });

      expect(result.isError).toBe(true);
    });
  });

  describe("spectree__create_project", () => {
    const getHandler = () => registeredTools.get("spectree__create_project")?.handler;

    it("should create project", async () => {
      const mockTeam = { id: "team-1", name: "Engineering", key: "ENG" };
      const mockProject = { id: "proj-1", name: "New Project" };

      mockApiClient.getTeam.mockResolvedValue({ data: mockTeam });
      mockApiClient.createProject.mockResolvedValue({ data: mockProject });

      const handler = getHandler();
      const result = await handler!({ name: "New Project", team: "Engineering" });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.name).toBe("New Project");
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
    it("should register all project tools", () => {
      expect(registeredTools.has("spectree__list_projects")).toBe(true);
      expect(registeredTools.has("spectree__get_project")).toBe(true);
      expect(registeredTools.has("spectree__create_project")).toBe(true);
    });
  });
});
