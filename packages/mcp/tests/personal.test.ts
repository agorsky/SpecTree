/**
 * Integration tests for MCP Personal Scope tools
 *
 * Tests for:
 * - spectree__get_personal_scope
 * - spectree__list_personal_projects
 * - spectree__create_personal_project
 * - spectree__list_personal_statuses
 * - Scope filtering in spectree__list_projects
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";

interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

// Mock the API client
const { mockApiClient } = vi.hoisted(() => {
  const mockApiClient = {
    getPersonalScope: vi.fn(),
    listPersonalProjects: vi.fn(),
    createPersonalProject: vi.fn(),
    listPersonalStatuses: vi.fn(),
    listProjects: vi.fn(),
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

import { registerPersonalTools } from "../src/tools/personal.js";
import { registerProjectTools } from "../src/tools/projects.js";

const mockServer = {
  registerTool: (name: string, config: any, handler: any) => {
    registeredTools.set(name, { config, handler });
  },
};

beforeAll(() => {
  registerPersonalTools(mockServer as any);
  registerProjectTools(mockServer as any);
});

describe("MCP Personal Scope Tools", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.resetAllMocks());

  // ===========================================================================
  // spectree__get_personal_scope
  // ===========================================================================
  describe("spectree__get_personal_scope", () => {
    const getHandler = () => registeredTools.get("spectree__get_personal_scope")?.handler;

    it("should get personal scope", async () => {
      const mockScope = {
        id: "ps-123",
        userId: "user-456",
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      };

      mockApiClient.getPersonalScope.mockResolvedValue({ data: mockScope });

      const handler = getHandler();
      const result: ToolResponse = await handler!({});

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.id).toBe("ps-123");
      expect(data.userId).toBe("user-456");
    });

    it("should handle authentication errors", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.getPersonalScope.mockRejectedValue(new ApiError("Unauthorized", 401));

      const handler = getHandler();
      const result: ToolResponse = await handler!({});

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("Authentication required");
    });
  });

  // ===========================================================================
  // spectree__list_personal_projects
  // ===========================================================================
  describe("spectree__list_personal_projects", () => {
    const getHandler = () => registeredTools.get("spectree__list_personal_projects")?.handler;

    it("should list personal projects", async () => {
      const mockProjects = [
        {
          id: "proj-1",
          name: "Personal Project 1",
          description: "My first personal project",
          icon: null,
          color: null,
          sortOrder: 1,
          isArchived: false,
          personalScopeId: "ps-123",
          teamId: null,
          createdAt: "2026-01-15T10:00:00Z",
          updatedAt: "2026-01-15T10:00:00Z",
          _count: { features: 3 },
        },
        {
          id: "proj-2",
          name: "Personal Project 2",
          description: null,
          icon: "star",
          color: "#FF5733",
          sortOrder: 2,
          isArchived: false,
          personalScopeId: "ps-123",
          teamId: null,
          createdAt: "2026-01-16T10:00:00Z",
          updatedAt: "2026-01-16T10:00:00Z",
          _count: { features: 0 },
        },
      ];

      mockApiClient.listPersonalProjects.mockResolvedValue({
        data: mockProjects,
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result: ToolResponse = await handler!({});

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.projects).toHaveLength(2);
      expect(data.projects[0].scope).toBe("personal");
      expect(data.projects[0].personalScopeId).toBe("ps-123");
      expect(data.projects[0].featureCount).toBe(3);
    });

    it("should support pagination", async () => {
      mockApiClient.listPersonalProjects.mockResolvedValue({
        data: [],
        meta: { cursor: "next-cursor", hasMore: true },
      });

      const handler = getHandler();
      await handler!({ limit: 10, cursor: "prev-cursor" });

      expect(mockApiClient.listPersonalProjects).toHaveBeenCalledWith({
        limit: 10,
        cursor: "prev-cursor",
      });
    });

    it("should handle authentication errors", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.listPersonalProjects.mockRejectedValue(new ApiError("Unauthorized", 401));

      const handler = getHandler();
      const result: ToolResponse = await handler!({});

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("Authentication required");
    });
  });

  // ===========================================================================
  // spectree__create_personal_project
  // ===========================================================================
  describe("spectree__create_personal_project", () => {
    const getHandler = () => registeredTools.get("spectree__create_personal_project")?.handler;

    it("should create personal project", async () => {
      const mockProject = {
        id: "proj-new",
        name: "My New Personal Project",
        description: "A new project",
        icon: "rocket",
        color: "#3B82F6",
        sortOrder: 1,
        isArchived: false,
        personalScopeId: "ps-123",
        teamId: null,
        createdAt: "2026-01-20T10:00:00Z",
        updatedAt: "2026-01-20T10:00:00Z",
      };

      mockApiClient.createPersonalProject.mockResolvedValue({ data: mockProject });

      const handler = getHandler();
      const result: ToolResponse = await handler!({
        name: "My New Personal Project",
        description: "A new project",
        icon: "rocket",
        color: "#3B82F6",
      });

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.name).toBe("My New Personal Project");
      expect(data.scope).toBe("personal");
      expect(data.personalScopeId).toBe("ps-123");
      expect(data.featureCount).toBe(0);
    });

    it("should create project with minimal data", async () => {
      const mockProject = {
        id: "proj-min",
        name: "Minimal Project",
        description: null,
        icon: null,
        color: null,
        sortOrder: 1,
        isArchived: false,
        personalScopeId: "ps-123",
        teamId: null,
        createdAt: "2026-01-20T10:00:00Z",
        updatedAt: "2026-01-20T10:00:00Z",
      };

      mockApiClient.createPersonalProject.mockResolvedValue({ data: mockProject });

      const handler = getHandler();
      const result: ToolResponse = await handler!({ name: "Minimal Project" });

      expect(result.isError).toBeUndefined();
      expect(mockApiClient.createPersonalProject).toHaveBeenCalledWith({
        name: "Minimal Project",
        description: undefined,
        icon: undefined,
        color: undefined,
      });
    });

    it("should handle authentication errors", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.createPersonalProject.mockRejectedValue(new ApiError("Unauthorized", 401));

      const handler = getHandler();
      const result: ToolResponse = await handler!({ name: "Test" });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("Authentication required");
    });
  });

  // ===========================================================================
  // spectree__list_personal_statuses
  // ===========================================================================
  describe("spectree__list_personal_statuses", () => {
    const getHandler = () => registeredTools.get("spectree__list_personal_statuses")?.handler;

    it("should list personal statuses", async () => {
      const mockStatuses = [
        { id: "st-1", name: "Backlog", category: "backlog", color: "#808080", position: 0, personalScopeId: "ps-123", teamId: null },
        { id: "st-2", name: "In Progress", category: "started", color: "#FFCC00", position: 1, personalScopeId: "ps-123", teamId: null },
        { id: "st-3", name: "Done", category: "completed", color: "#00CC00", position: 2, personalScopeId: "ps-123", teamId: null },
      ];

      mockApiClient.listPersonalStatuses.mockResolvedValue({ data: mockStatuses });

      const handler = getHandler();
      const result: ToolResponse = await handler!({});

      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.statuses).toHaveLength(3);
      expect(data.statuses[0].scope).toBe("personal");
      expect(data.statuses[0].name).toBe("Backlog");
    });

    it("should handle authentication errors", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.listPersonalStatuses.mockRejectedValue(new ApiError("Unauthorized", 401));

      const handler = getHandler();
      const result: ToolResponse = await handler!({});

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("Authentication required");
    });
  });

  // ===========================================================================
  // Tool Registration
  // ===========================================================================
  describe("tool registration", () => {
    it("should register all personal scope tools", () => {
      expect(registeredTools.has("spectree__get_personal_scope")).toBe(true);
      expect(registeredTools.has("spectree__list_personal_projects")).toBe(true);
      expect(registeredTools.has("spectree__create_personal_project")).toBe(true);
      expect(registeredTools.has("spectree__list_personal_statuses")).toBe(true);
    });
  });
});

// ===========================================================================
// Scope-aware list_projects tests
// ===========================================================================
describe("Scope-aware spectree__list_projects", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.resetAllMocks());

  const getHandler = () => registeredTools.get("spectree__list_projects")?.handler;

  it("should filter by scope='personal' and return only personal projects", async () => {
    const mockPersonalProjects = [
      {
        id: "personal-1",
        name: "My Personal Project",
        personalScopeId: "ps-123",
        teamId: null,
        _count: { features: 2 },
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      },
    ];

    mockApiClient.listPersonalProjects.mockResolvedValue({
      data: mockPersonalProjects,
      meta: { cursor: null, hasMore: false },
    });

    const handler = getHandler();
    const result: ToolResponse = await handler!({ scope: "personal" });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0]?.text || "{}");
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].scope).toBe("personal");
    expect(mockApiClient.listPersonalProjects).toHaveBeenCalled();
    expect(mockApiClient.listProjects).not.toHaveBeenCalled();
  });

  it("should filter by scope='team' and return only team projects", async () => {
    const mockTeamProjects = [
      {
        id: "team-1",
        name: "Team Project",
        team: { id: "t-1", name: "Engineering", key: "ENG" },
        _count: { features: 5 },
        createdAt: "2026-01-10T10:00:00Z",
        updatedAt: "2026-01-10T10:00:00Z",
      },
    ];

    mockApiClient.listProjects.mockResolvedValue({
      data: mockTeamProjects,
      meta: { cursor: null, hasMore: false },
    });

    const handler = getHandler();
    const result: ToolResponse = await handler!({ scope: "team" });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0]?.text || "{}");
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].scope).toBe("team");
    expect(mockApiClient.listProjects).toHaveBeenCalled();
    expect(mockApiClient.listPersonalProjects).not.toHaveBeenCalled();
  });

  it("should combine personal and team projects when scope='all'", async () => {
    const mockPersonalProjects = [
      {
        id: "personal-1",
        name: "Personal Project",
        personalScopeId: "ps-123",
        teamId: null,
        _count: { features: 1 },
        createdAt: "2026-01-20T10:00:00Z",
        updatedAt: "2026-01-20T10:00:00Z",
      },
    ];

    const mockTeamProjects = [
      {
        id: "team-1",
        name: "Team Project",
        team: { id: "t-1", name: "Engineering", key: "ENG" },
        _count: { features: 3 },
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: "2026-01-15T10:00:00Z",
      },
    ];

    mockApiClient.listPersonalProjects.mockResolvedValue({
      data: mockPersonalProjects,
      meta: { cursor: null, hasMore: false },
    });

    mockApiClient.listProjects.mockResolvedValue({
      data: mockTeamProjects,
      meta: { cursor: null, hasMore: false },
    });

    const handler = getHandler();
    const result: ToolResponse = await handler!({ scope: "all" });

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0]?.text || "{}");
    expect(data.projects).toHaveLength(2);
    // Should be sorted by createdAt desc - personal project is newer
    expect(data.projects[0].name).toBe("Personal Project");
    expect(data.projects[0].scope).toBe("personal");
    expect(data.projects[1].name).toBe("Team Project");
    expect(data.projects[1].scope).toBe("team");
  });

  it("should default to scope='all' when not specified", async () => {
    mockApiClient.listPersonalProjects.mockResolvedValue({
      data: [],
      meta: { cursor: null, hasMore: false },
    });

    mockApiClient.listProjects.mockResolvedValue({
      data: [],
      meta: { cursor: null, hasMore: false },
    });

    const handler = getHandler();
    await handler!({});

    // Both should be called when scope is not specified (defaults to 'all')
    expect(mockApiClient.listPersonalProjects).toHaveBeenCalled();
    expect(mockApiClient.listProjects).toHaveBeenCalled();
  });

  it("should ignore team filter when scope='personal'", async () => {
    mockApiClient.listPersonalProjects.mockResolvedValue({
      data: [],
      meta: { cursor: null, hasMore: false },
    });

    const handler = getHandler();
    await handler!({ scope: "personal", team: "Engineering" });

    // Team filter should be ignored for personal scope
    expect(mockApiClient.listPersonalProjects).toHaveBeenCalled();
    expect(mockApiClient.getTeam).not.toHaveBeenCalled();
  });

  it("should apply team filter when scope='team'", async () => {
    const mockTeam = { id: "team-1", name: "Engineering", key: "ENG" };
    
    mockApiClient.getTeam.mockResolvedValue({ data: mockTeam });
    mockApiClient.listProjects.mockResolvedValue({
      data: [],
      meta: { cursor: null, hasMore: false },
    });

    const handler = getHandler();
    await handler!({ scope: "team", team: "Engineering" });

    expect(mockApiClient.getTeam).toHaveBeenCalledWith("Engineering");
    expect(mockApiClient.listProjects).toHaveBeenCalledWith(
      expect.objectContaining({ team: "team-1" })
    );
  });
});
