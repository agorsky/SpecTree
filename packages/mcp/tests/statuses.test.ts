/**
 * Integration tests for MCP Status tools
 *
 * Tests the status tool handlers:
 * - spectree__list_statuses
 * - spectree__get_status
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
  statusService: {
    listStatuses: vi.fn(),
    getStatusById: vi.fn(),
  },
  prisma: {
    team: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    status: {
      findFirst: vi.fn(),
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
  statusService,
  prisma,
} from "@spectree/api/src/services/index.js";

// Import the tools module to trigger registration
import "../src/tools/statuses.js";

describe("MCP Statuses Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("spectree__list_statuses", () => {
    const getHandler = () => registeredTools.get("spectree__list_statuses")?.handler;

    it("should list statuses for a team by UUID", async () => {
      const mockTeam = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Engineering",
        key: "ENG",
        description: null,
        icon: null,
        color: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockStatuses = [
        {
          id: "status-1",
          name: "Backlog",
          category: "backlog",
          color: "#808080",
          position: 0,
          teamId: "550e8400-e29b-41d4-a716-446655440000",
        },
        {
          id: "status-2",
          name: "In Progress",
          category: "started",
          color: "#3B82F6",
          position: 1,
          teamId: "550e8400-e29b-41d4-a716-446655440000",
        },
        {
          id: "status-3",
          name: "Done",
          category: "completed",
          color: "#10B981",
          position: 2,
          teamId: "550e8400-e29b-41d4-a716-446655440000",
        },
      ];

      vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam);
      vi.mocked(statusService.listStatuses).mockResolvedValue(mockStatuses);

      const handler = getHandler();
      expect(handler).toBeDefined();

      const result = await handler!({ team: "550e8400-e29b-41d4-a716-446655440000" });

      expect(vi.mocked(statusService.listStatuses)).toHaveBeenCalledWith({
        teamId: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "[]");
      expect(data).toHaveLength(3);
      expect(data[0].name).toBe("Backlog");
      expect(data[0].category).toBe("backlog");
      expect(data[1].name).toBe("In Progress");
      expect(data[2].name).toBe("Done");
    });

    it("should list statuses for a team by name", async () => {
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
      vi.mocked(statusService.listStatuses).mockResolvedValue([]);

      const handler = getHandler();
      const result = await handler!({ team: "Engineering" });

      expect(vi.mocked(prisma.team.findFirst)).toHaveBeenCalledWith({
        where: { name: "Engineering" },
        select: { id: true },
      });
      expect(vi.mocked(statusService.listStatuses)).toHaveBeenCalledWith({
        teamId: "team-1",
      });
      expect(result.isError).toBeUndefined();
    });

    it("should return statuses ordered by position", async () => {
      const mockTeam = {
        id: "team-1",
        name: "Test Team",
        key: "TT",
        description: null,
        icon: null,
        color: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockStatuses = [
        { id: "s1", name: "Backlog", category: "backlog", color: null, position: 0, teamId: "team-1" },
        { id: "s2", name: "Todo", category: "unstarted", color: null, position: 1, teamId: "team-1" },
        { id: "s3", name: "In Progress", category: "started", color: null, position: 2, teamId: "team-1" },
        { id: "s4", name: "Done", category: "completed", color: null, position: 3, teamId: "team-1" },
        { id: "s5", name: "Canceled", category: "canceled", color: null, position: 4, teamId: "team-1" },
      ];

      vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam);
      vi.mocked(statusService.listStatuses).mockResolvedValue(mockStatuses);

      const handler = getHandler();
      const result = await handler!({ team: "team-1" });

      const data = JSON.parse(result.content[0]?.text || "[]");
      expect(data).toHaveLength(5);
      expect(data[0].position).toBe(0);
      expect(data[4].position).toBe(4);
    });

    it("should return error for non-existent team", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.team.findFirst).mockResolvedValue(null);

      const handler = getHandler();
      const result = await handler!({ team: "NonExistentTeam" });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("not found");
    });

    it("should include all status metadata", async () => {
      const mockTeam = {
        id: "team-1",
        name: "Test",
        key: "T",
        description: null,
        icon: null,
        color: null,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockStatuses = [
        {
          id: "status-uuid",
          name: "In Progress",
          category: "started",
          color: "#3B82F6",
          position: 2,
          teamId: "team-1",
        },
      ];

      vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam);
      vi.mocked(statusService.listStatuses).mockResolvedValue(mockStatuses);

      const handler = getHandler();
      const result = await handler!({ team: "team-1" });

      const data = JSON.parse(result.content[0]?.text || "[]");
      expect(data[0]).toEqual({
        id: "status-uuid",
        name: "In Progress",
        category: "started",
        color: "#3B82F6",
        position: 2,
      });
    });
  });

  describe("spectree__get_status", () => {
    const getHandler = () => registeredTools.get("spectree__get_status")?.handler;

    it("should get status by UUID", async () => {
      const mockStatus = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "In Progress",
        category: "started",
        color: "#3B82F6",
        position: 2,
        teamId: "team-1",
      };

      vi.mocked(statusService.getStatusById).mockResolvedValue(mockStatus);

      const handler = getHandler();
      expect(handler).toBeDefined();

      const result = await handler!({ id: "550e8400-e29b-41d4-a716-446655440000" });

      expect(vi.mocked(statusService.getStatusById)).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000"
      );
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.id).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(data.name).toBe("In Progress");
      expect(data.category).toBe("started");
    });

    it("should get status by name when team is provided", async () => {
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

      const mockStatus = {
        id: "status-1",
        name: "Done",
        category: "completed",
        color: "#10B981",
        position: 3,
        teamId: "team-1",
      };

      vi.mocked(statusService.getStatusById).mockResolvedValue(null);
      vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam);
      vi.mocked(prisma.status.findFirst).mockResolvedValue(mockStatus);

      const handler = getHandler();
      const result = await handler!({ id: "Done", team: "team-1" });

      expect(vi.mocked(prisma.status.findFirst)).toHaveBeenCalledWith({
        where: {
          name: "Done",
          teamId: "team-1",
        },
      });
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.name).toBe("Done");
    });

    it("should return error when status not found by ID", async () => {
      vi.mocked(statusService.getStatusById).mockResolvedValue(null);

      const handler = getHandler();
      const result = await handler!({ id: "non-existent-uuid" });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("not found");
    });

    it("should return error when status not found by name in team", async () => {
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

      vi.mocked(statusService.getStatusById).mockResolvedValue(null);
      vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam);
      vi.mocked(prisma.status.findFirst).mockResolvedValue(null);

      const handler = getHandler();
      const result = await handler!({ id: "NonExistentStatus", team: "team-1" });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("not found");
    });

    it("should suggest providing team when searching by name without team", async () => {
      vi.mocked(statusService.getStatusById).mockResolvedValue(null);

      const handler = getHandler();
      const result = await handler!({ id: "In Progress" });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("team");
    });

    it("should resolve team by name when getting status", async () => {
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

      const mockStatus = {
        id: "status-1",
        name: "Backlog",
        category: "backlog",
        color: null,
        position: 0,
        teamId: "resolved-team-id",
      };

      vi.mocked(statusService.getStatusById).mockResolvedValue(null);
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.team.findFirst).mockResolvedValue(mockTeam);
      vi.mocked(prisma.status.findFirst).mockResolvedValue(mockStatus);

      const handler = getHandler();
      const result = await handler!({ id: "Backlog", team: "Engineering" });

      expect(vi.mocked(prisma.team.findFirst)).toHaveBeenCalledWith({
        where: { name: "Engineering" },
        select: { id: true },
      });
      expect(vi.mocked(prisma.status.findFirst)).toHaveBeenCalledWith({
        where: {
          name: "Backlog",
          teamId: "resolved-team-id",
        },
      });
      expect(result.isError).toBeUndefined();
    });
  });

  describe("tool registration", () => {
    it("should register all status tools", () => {
      expect(registeredTools.has("spectree__list_statuses")).toBe(true);
      expect(registeredTools.has("spectree__get_status")).toBe(true);
    });

    it("should have proper descriptions", () => {
      const listTool = registeredTools.get("spectree__list_statuses");
      const getTool = registeredTools.get("spectree__get_status");

      expect(listTool?.config.description).toContain("List");
      expect(listTool?.config.description).toContain("statuses");
      expect(getTool?.config.description).toContain("Get");
    });

    it("should describe valid status categories in tool description", () => {
      const listTool = registeredTools.get("spectree__list_statuses");

      expect(listTool?.config.description).toContain("backlog");
      expect(listTool?.config.description).toContain("started");
      expect(listTool?.config.description).toContain("completed");
    });
  });
});
