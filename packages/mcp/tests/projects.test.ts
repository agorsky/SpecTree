/**
 * Integration tests for MCP Project tools
 *
 * Tests the project tool handlers:
 * - spectree__list_projects
 * - spectree__get_project
 * - spectree__create_project
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Type for tool handler - represents the MCP response shape
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
  projectService: {
    listProjects: vi.fn(),
    getProjectById: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
  },
  prisma: {
    team: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
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
    // Create a mock server that captures registrations
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
  projectService,
  prisma,
  NotFoundError,
} from "@spectree/api/src/services/index.js";

// Import the tools module to trigger registration
import "../src/tools/projects.js";

describe("MCP Projects Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("spectree__list_projects", () => {
    const getHandler = () => registeredTools.get("spectree__list_projects")?.handler;

    it("should list projects without filters", async () => {
      const mockProjects = [
        {
          id: "proj-1",
          name: "Project 1",
          description: "Test project",
          icon: null,
          color: "#FF0000",
          sortOrder: 1,
          isArchived: false,
          teamId: "team-1",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-02"),
          _count: { features: 3 },
        },
      ];

      vi.mocked(projectService.listProjects).mockResolvedValue({
        data: mockProjects,
        meta: { cursor: null, hasMore: false },
      });

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-1",
        name: "Test Team",
        key: "TT",
        description: null,
        icon: null,
        color: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const handler = getHandler();
      expect(handler).toBeDefined();

      const result = await handler!({});

      expect(result.isError).toBeUndefined();
      expect(result.content).toHaveLength(1);
      expect(result.content[0]?.type).toBe("text");

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.projects).toHaveLength(1);
      expect(data.projects[0].name).toBe("Project 1");
      expect(data.projects[0].featureCount).toBe(3);
    });

    it("should filter by team name", async () => {
      const mockTeam = {
        id: "team-1",
        name: "Engineering",
        key: "ENG",
        description: null,
        icon: null,
        color: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.team.findFirst).mockResolvedValue(mockTeam);

      vi.mocked(projectService.listProjects).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({ team: "Engineering" });

      expect(vi.mocked(prisma.team.findFirst)).toHaveBeenCalledWith({
        where: { name: "Engineering", isArchived: false },
        select: { id: true },
      });
      expect(vi.mocked(projectService.listProjects)).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: "team-1" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should filter by team key", async () => {
      const mockTeam = {
        id: "team-1",
        name: "Engineering",
        key: "ENG",
        description: null,
        icon: null,
        color: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.team.findFirst)
        .mockResolvedValueOnce(null) // First call for name lookup
        .mockResolvedValueOnce(mockTeam); // Second call for key lookup

      vi.mocked(projectService.listProjects).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({ team: "ENG" });

      expect(vi.mocked(prisma.team.findFirst)).toHaveBeenLastCalledWith({
        where: { key: "ENG", isArchived: false },
        select: { id: true },
      });
      expect(result.isError).toBeUndefined();
    });

    it("should return error for non-existent team", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.team.findFirst).mockResolvedValue(null);

      const handler = getHandler();
      const result = await handler!({ team: "NonExistentTeam" });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("not found");
    });

    it("should handle pagination parameters", async () => {
      vi.mocked(projectService.listProjects).mockResolvedValue({
        data: [],
        meta: { cursor: "next-cursor", hasMore: true },
      });

      const handler = getHandler();
      const result = await handler!({ limit: 10, cursor: "prev-cursor" });

      expect(vi.mocked(projectService.listProjects)).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, cursor: "prev-cursor" })
      );
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.meta.hasMore).toBe(true);
      expect(data.meta.cursor).toBe("next-cursor");
    });

    it("should include archived projects when requested", async () => {
      const mockProjects = [
        {
          id: "proj-1",
          name: "Active Project",
          description: null,
          icon: null,
          color: null,
          sortOrder: 1,
          isArchived: false,
          teamId: "team-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { features: 0 },
          team: { id: "team-1", name: "Test Team", key: "TT" },
        },
        {
          id: "proj-2",
          name: "Archived Project",
          description: null,
          icon: null,
          color: null,
          sortOrder: 2,
          isArchived: true,
          teamId: "team-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { features: 1 },
          team: { id: "team-1", name: "Test Team", key: "TT" },
        },
      ];

      vi.mocked(prisma.project.findMany).mockResolvedValue(mockProjects);

      const handler = getHandler();
      const result = await handler!({ includeArchived: true });

      expect(vi.mocked(prisma.project.findMany)).toHaveBeenCalled();
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.projects).toHaveLength(2);
      expect(data.projects.some((p: { isArchived: boolean }) => p.isArchived)).toBe(true);
    });
  });

  describe("spectree__get_project", () => {
    const getHandler = () => registeredTools.get("spectree__get_project")?.handler;

    it("should get project by UUID", async () => {
      const mockProject = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Test Project",
        description: "A test project",
        icon: "rocket",
        color: "#3B82F6",
        sortOrder: 1,
        isArchived: false,
        teamId: "team-1",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
        _count: { features: 5 },
        team: { id: "team-1", name: "Test Team", key: "TT" },
        features: [
          {
            id: "feat-1",
            identifier: "TT-1",
            title: "Feature 1",
            description: null,
            statusId: null,
            assigneeId: null,
            sortOrder: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject);

      const handler = getHandler();
      expect(handler).toBeDefined();

      const result = await handler!({ query: "550e8400-e29b-41d4-a716-446655440000" });

      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.id).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(data.name).toBe("Test Project");
      expect(data.features).toHaveLength(1);
      expect(data.featureCount).toBe(5);
    });

    it("should get project by name", async () => {
      const mockProject = {
        id: "proj-1",
        name: "Mobile App Redesign",
        description: "Redesign mobile app",
        icon: null,
        color: null,
        sortOrder: 1,
        isArchived: false,
        teamId: "team-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { features: 0 },
        team: { id: "team-1", name: "Test Team", key: "TT" },
        features: [],
      };

      // First lookup by ID fails
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);
      // Then lookup by name succeeds
      vi.mocked(prisma.project.findFirst).mockResolvedValue(mockProject);

      const handler = getHandler();
      const result = await handler!({ query: "Mobile App Redesign" });

      expect(vi.mocked(prisma.project.findFirst)).toHaveBeenCalledWith({
        where: { name: "Mobile App Redesign", isArchived: false },
        include: expect.any(Object),
      });
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.name).toBe("Mobile App Redesign");
    });

    it("should return error for non-existent project", async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.project.findFirst).mockResolvedValue(null);

      const handler = getHandler();
      const result = await handler!({ query: "NonExistentProject" });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("not found");
    });
  });

  describe("spectree__create_project", () => {
    const getHandler = () => registeredTools.get("spectree__create_project")?.handler;

    it("should create a project with required fields", async () => {
      const mockTeam = {
        id: "team-1",
        name: "Engineering",
        key: "ENG",
        description: null,
        icon: null,
        color: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCreatedProject = {
        id: "new-proj-1",
        name: "New Project",
        description: null,
        icon: null,
        color: null,
        sortOrder: 1,
        isArchived: false,
        teamId: "team-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam);
      vi.mocked(projectService.createProject).mockResolvedValue(mockCreatedProject);

      const handler = getHandler();
      expect(handler).toBeDefined();

      const result = await handler!({
        name: "New Project",
        team: "team-1",
      });

      expect(vi.mocked(projectService.createProject)).toHaveBeenCalledWith({
        name: "New Project",
        teamId: "team-1",
        description: undefined,
        icon: undefined,
        color: undefined,
      });
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.name).toBe("New Project");
      expect(data.featureCount).toBe(0);
    });

    it("should create a project with all optional fields", async () => {
      const mockTeam = {
        id: "team-1",
        name: "Engineering",
        key: "ENG",
        description: null,
        icon: null,
        color: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCreatedProject = {
        id: "new-proj-1",
        name: "Full Project",
        description: "A detailed description",
        icon: "rocket",
        color: "#FF5733",
        sortOrder: 1,
        isArchived: false,
        teamId: "team-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam);
      vi.mocked(projectService.createProject).mockResolvedValue(mockCreatedProject);

      const handler = getHandler();
      const result = await handler!({
        name: "Full Project",
        team: "team-1",
        description: "A detailed description",
        icon: "rocket",
        color: "#FF5733",
      });

      expect(vi.mocked(projectService.createProject)).toHaveBeenCalledWith({
        name: "Full Project",
        teamId: "team-1",
        description: "A detailed description",
        icon: "rocket",
        color: "#FF5733",
      });
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.description).toBe("A detailed description");
      expect(data.icon).toBe("rocket");
      expect(data.color).toBe("#FF5733");
    });

    it("should resolve team by name when creating project", async () => {
      const mockTeam = {
        id: "resolved-team-id",
        name: "Engineering",
        key: "ENG",
        description: null,
        icon: null,
        color: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.team.findFirst).mockResolvedValue(mockTeam);

      vi.mocked(projectService.createProject).mockResolvedValue({
        id: "proj-1",
        name: "Test",
        description: null,
        icon: null,
        color: null,
        sortOrder: 1,
        isArchived: false,
        teamId: "resolved-team-id",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const handler = getHandler();
      const result = await handler!({
        name: "Test",
        team: "Engineering",
      });

      expect(vi.mocked(projectService.createProject)).toHaveBeenCalledWith(
        expect.objectContaining({ teamId: "resolved-team-id" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should return error for non-existent team", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.team.findFirst).mockResolvedValue(null);

      const handler = getHandler();
      const result = await handler!({
        name: "Test Project",
        team: "NonExistentTeam",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("not found");
    });
  });

  describe("tool registration", () => {
    it("should register all project tools", () => {
      expect(registeredTools.has("spectree__list_projects")).toBe(true);
      expect(registeredTools.has("spectree__get_project")).toBe(true);
      expect(registeredTools.has("spectree__create_project")).toBe(true);
    });

    it("should have proper descriptions for tools", () => {
      const listTool = registeredTools.get("spectree__list_projects");
      const getTool = registeredTools.get("spectree__get_project");
      const createTool = registeredTools.get("spectree__create_project");

      expect(listTool?.config.description).toContain("List projects");
      expect(getTool?.config.description).toContain("Get detailed information");
      expect(createTool?.config.description).toContain("Create a new project");
    });
  });
});
