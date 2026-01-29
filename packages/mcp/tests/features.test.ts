/**
 * Integration tests for MCP Feature tools
 *
 * Tests the feature tool handlers:
 * - spectree__list_features
 * - spectree__get_feature
 * - spectree__create_feature
 * - spectree__update_feature
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
  featureService: {
    listFeatures: vi.fn(),
    getFeatureById: vi.fn(),
    createFeature: vi.fn(),
    updateFeature: vi.fn(),
  },
  userService: {
    getCurrentUser: vi.fn(),
  },
  prisma: {
    project: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    status: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    feature: {
      findUnique: vi.fn(),
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
  featureService,
  userService,
  prisma,
} from "@spectree/api/src/services/index.js";

// Import the tools module to trigger registration
import "../src/tools/features.js";

describe("MCP Features Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("spectree__list_features", () => {
    const getHandler = () => registeredTools.get("spectree__list_features")?.handler;

    it("should list features without filters", async () => {
      const mockFeatures = [
        {
          id: "feat-1",
          identifier: "ENG-1",
          title: "User Authentication",
          description: "Implement OAuth2",
          projectId: "proj-1",
          statusId: "status-1",
          assigneeId: "user-1",
          sortOrder: 1,
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-02"),
          _count: { tasks: 3 },
        },
      ];

      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: mockFeatures,
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      expect(handler).toBeDefined();

      const result = await handler!({});

      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.features).toHaveLength(1);
      expect(data.features[0].identifier).toBe("ENG-1");
      expect(data.features[0].title).toBe("User Authentication");
    });

    it("should filter by project name", async () => {
      const mockProject = {
        id: "proj-1",
        name: "Mobile App",
        description: null,
        icon: null,
        color: null,
        sortOrder: 1,
        isArchived: false,
        teamId: "team-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.project.findFirst).mockResolvedValue(mockProject);

      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({ project: "Mobile App" });

      expect(vi.mocked(prisma.project.findFirst)).toHaveBeenCalledWith({
        where: { name: "Mobile App", isArchived: false },
        select: { id: true },
      });
      expect(vi.mocked(featureService.listFeatures)).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: "proj-1" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should filter by status", async () => {
      const mockStatus = {
        id: "status-1",
        name: "In Progress",
        category: "started",
        color: null,
        position: 2,
        teamId: "team-1",
      };

      vi.mocked(prisma.status.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.status.findFirst).mockResolvedValue(mockStatus);

      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({ status: "In Progress" });

      expect(vi.mocked(featureService.listFeatures)).toHaveBeenCalledWith(
        expect.objectContaining({ statusId: "status-1" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should resolve 'me' assignee to current user", async () => {
      const mockUser = {
        id: "current-user-id",
        email: "user@example.com",
        name: "Current User",
        avatarUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(userService.getCurrentUser).mockResolvedValue(mockUser);

      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({ assignee: "me" });

      expect(vi.mocked(userService.getCurrentUser)).toHaveBeenCalled();
      expect(vi.mocked(featureService.listFeatures)).toHaveBeenCalledWith(
        expect.objectContaining({ assigneeId: "current-user-id" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should return error when 'me' cannot be resolved", async () => {
      vi.mocked(userService.getCurrentUser).mockResolvedValue(null);

      const handler = getHandler();
      const result = await handler!({ assignee: "me" });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("current user");
    });

    it("should filter by search query", async () => {
      const mockFeatures = [
        {
          id: "feat-1",
          identifier: "ENG-1",
          title: "User Login Flow",
          description: null,
          projectId: "proj-1",
          statusId: null,
          assigneeId: null,
          sortOrder: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { tasks: 0 },
        },
        {
          id: "feat-2",
          identifier: "ENG-2",
          title: "Login Page Redesign",
          description: null,
          projectId: "proj-1",
          statusId: null,
          assigneeId: null,
          sortOrder: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { tasks: 0 },
        },
      ];

      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: mockFeatures,
        meta: { cursor: null, hasMore: false },
      });

      const handler = getHandler();
      const result = await handler!({ query: "login" });

      // Query filtering is done client-side in the tool
      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.features).toHaveLength(2);
    });

    it("should handle pagination", async () => {
      vi.mocked(featureService.listFeatures).mockResolvedValue({
        data: [],
        meta: { cursor: "next-cursor", hasMore: true },
      });

      const handler = getHandler();
      const result = await handler!({ limit: 25, cursor: "prev-cursor" });

      expect(vi.mocked(featureService.listFeatures)).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 25, cursor: "prev-cursor" })
      );

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.meta.hasMore).toBe(true);
    });

    it("should return error for non-existent project", async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.project.findFirst).mockResolvedValue(null);

      const handler = getHandler();
      const result = await handler!({ project: "NonExistent" });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("not found");
    });
  });

  describe("spectree__get_feature", () => {
    const getHandler = () => registeredTools.get("spectree__get_feature")?.handler;

    it("should get feature by UUID", async () => {
      const mockFeature = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        identifier: "ENG-42",
        title: "API Integration",
        description: "Integrate with external API",
        projectId: "proj-1",
        statusId: "status-1",
        assigneeId: "user-1",
        sortOrder: 1,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
        tasks: [
          {
            id: "task-1",
            identifier: "ENG-42-1",
            title: "Design API schema",
            description: null,
            featureId: "550e8400-e29b-41d4-a716-446655440000",
            statusId: null,
            assigneeId: null,
            sortOrder: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      vi.mocked(featureService.getFeatureById).mockResolvedValue(mockFeature);

      const handler = getHandler();
      expect(handler).toBeDefined();

      const result = await handler!({ id: "550e8400-e29b-41d4-a716-446655440000" });

      expect(vi.mocked(featureService.getFeatureById)).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000"
      );
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.id).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(data.identifier).toBe("ENG-42");
      expect(data.tasks).toHaveLength(1);
    });

    it("should get feature by identifier (e.g., COM-123)", async () => {
      const mockFeature = {
        id: "feat-1",
        identifier: "COM-123",
        title: "Feature from identifier",
        description: null,
        projectId: "proj-1",
        statusId: null,
        assigneeId: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        tasks: [],
      };

      // Not a UUID, so getFeatureById won't be called
      // Instead it will look up by identifier
      vi.mocked(prisma.feature.findUnique).mockResolvedValue(mockFeature);

      const handler = getHandler();
      const result = await handler!({ id: "COM-123" });

      expect(vi.mocked(prisma.feature.findUnique)).toHaveBeenCalledWith({
        where: { identifier: "COM-123" },
        include: expect.any(Object),
      });
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.identifier).toBe("COM-123");
    });

    it("should return error for non-existent feature", async () => {
      vi.mocked(featureService.getFeatureById).mockResolvedValue(null);
      vi.mocked(prisma.feature.findUnique).mockResolvedValue(null);

      const handler = getHandler();
      const result = await handler!({ id: "non-existent" });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("not found");
    });
  });

  describe("spectree__create_feature", () => {
    const getHandler = () => registeredTools.get("spectree__create_feature")?.handler;

    it("should create a feature with required fields", async () => {
      const mockProject = {
        id: "proj-1",
        name: "Test Project",
        description: null,
        icon: null,
        color: null,
        sortOrder: 1,
        isArchived: false,
        teamId: "team-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCreatedFeature = {
        id: "new-feat-1",
        identifier: "ENG-1",
        title: "New Feature",
        description: null,
        projectId: "proj-1",
        statusId: null,
        assigneeId: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject);
      vi.mocked(featureService.createFeature).mockResolvedValue(mockCreatedFeature);

      const handler = getHandler();
      expect(handler).toBeDefined();

      const result = await handler!({
        title: "New Feature",
        project: "proj-1",
      });

      expect(vi.mocked(featureService.createFeature)).toHaveBeenCalledWith({
        title: "New Feature",
        projectId: "proj-1",
        description: undefined,
        statusId: undefined,
        assigneeId: undefined,
      });
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.title).toBe("New Feature");
      expect(data.identifier).toBe("ENG-1");
    });

    it("should create a feature with all optional fields", async () => {
      const mockProject = {
        id: "proj-1",
        name: "Test Project",
        description: null,
        icon: null,
        color: null,
        sortOrder: 1,
        isArchived: false,
        teamId: "team-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockStatus = {
        id: "status-1",
        name: "In Progress",
        category: "started",
        color: null,
        position: 2,
        teamId: "team-1",
      };

      const mockCreatedFeature = {
        id: "new-feat-1",
        identifier: "ENG-2",
        title: "Full Feature",
        description: "Detailed description",
        projectId: "proj-1",
        statusId: "status-1",
        assigneeId: "user-1",
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject);
      vi.mocked(prisma.status.findUnique).mockResolvedValue(mockStatus);
      vi.mocked(prisma.status.findFirst).mockResolvedValue(mockStatus);
      vi.mocked(featureService.createFeature).mockResolvedValue(mockCreatedFeature);

      const handler = getHandler();
      const result = await handler!({
        title: "Full Feature",
        project: "proj-1",
        description: "Detailed description",
        status: "In Progress",
        assignee: "user-1",
      });

      expect(vi.mocked(featureService.createFeature)).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Full Feature",
          description: "Detailed description",
          statusId: "status-1",
          assigneeId: "user-1",
        })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should resolve 'me' assignee when creating feature", async () => {
      const mockProject = {
        id: "proj-1",
        name: "Test",
        description: null,
        icon: null,
        color: null,
        sortOrder: 1,
        isArchived: false,
        teamId: "team-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUser = {
        id: "current-user-id",
        email: "user@example.com",
        name: "Current User",
        avatarUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject);
      vi.mocked(userService.getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(featureService.createFeature).mockResolvedValue({
        id: "feat-1",
        identifier: "ENG-1",
        title: "Test",
        description: null,
        projectId: "proj-1",
        statusId: null,
        assigneeId: "current-user-id",
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const handler = getHandler();
      const result = await handler!({
        title: "Test",
        project: "proj-1",
        assignee: "me",
      });

      expect(vi.mocked(featureService.createFeature)).toHaveBeenCalledWith(
        expect.objectContaining({ assigneeId: "current-user-id" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should return error for non-existent project", async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.project.findFirst).mockResolvedValue(null);

      const handler = getHandler();
      const result = await handler!({
        title: "Test",
        project: "NonExistent",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("not found");
    });
  });

  describe("spectree__update_feature", () => {
    const getHandler = () => registeredTools.get("spectree__update_feature")?.handler;

    it("should update feature by UUID", async () => {
      const existingFeature = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        identifier: "ENG-1",
        title: "Old Title",
        description: null,
        projectId: "proj-1",
        statusId: null,
        assigneeId: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        tasks: [],
      };

      const updatedFeature = {
        ...existingFeature,
        title: "Updated Title",
        description: "New description",
        updatedAt: new Date(),
      };

      vi.mocked(featureService.getFeatureById).mockResolvedValue(existingFeature);
      vi.mocked(featureService.updateFeature).mockResolvedValue(updatedFeature);

      const handler = getHandler();
      expect(handler).toBeDefined();

      const result = await handler!({
        id: "550e8400-e29b-41d4-a716-446655440000",
        title: "Updated Title",
        description: "New description",
      });

      expect(vi.mocked(featureService.updateFeature)).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        expect.objectContaining({
          title: "Updated Title",
          description: "New description",
        })
      );
      expect(result.isError).toBeUndefined();

      const data = JSON.parse(result.content[0]?.text || "{}");
      expect(data.title).toBe("Updated Title");
    });

    it("should update feature by identifier", async () => {
      const existingFeature = {
        id: "feat-uuid",
        identifier: "COM-42",
        title: "Original",
        description: null,
        projectId: "proj-1",
        statusId: null,
        assigneeId: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        tasks: [],
      };

      vi.mocked(prisma.feature.findUnique).mockResolvedValue(existingFeature);
      vi.mocked(featureService.updateFeature).mockResolvedValue({
        ...existingFeature,
        title: "Changed",
      });

      const handler = getHandler();
      const result = await handler!({
        id: "COM-42",
        title: "Changed",
      });

      // Should resolve identifier to UUID first
      expect(vi.mocked(prisma.feature.findUnique)).toHaveBeenCalledWith({
        where: { identifier: "COM-42" },
        include: expect.any(Object),
      });
      expect(vi.mocked(featureService.updateFeature)).toHaveBeenCalledWith(
        "feat-uuid",
        expect.any(Object)
      );
      expect(result.isError).toBeUndefined();
    });

    it("should update feature status", async () => {
      const existingFeature = {
        id: "feat-1",
        identifier: "ENG-1",
        title: "Test",
        description: null,
        projectId: "proj-1",
        statusId: "old-status",
        assigneeId: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        tasks: [],
      };

      const mockProject = {
        id: "proj-1",
        teamId: "team-1",
      };

      const mockStatus = {
        id: "new-status-id",
        name: "Done",
        category: "completed",
        color: null,
        position: 3,
        teamId: "team-1",
      };

      vi.mocked(featureService.getFeatureById).mockResolvedValue(existingFeature);
      vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject);
      vi.mocked(prisma.status.findUnique).mockResolvedValue(mockStatus);
      vi.mocked(prisma.status.findFirst).mockResolvedValue(mockStatus);
      vi.mocked(featureService.updateFeature).mockResolvedValue({
        ...existingFeature,
        statusId: "new-status-id",
      });

      const handler = getHandler();
      const result = await handler!({
        id: "550e8400-e29b-41d4-a716-446655440000",
        status: "Done",
      });

      expect(vi.mocked(featureService.updateFeature)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ statusId: "new-status-id" })
      );
      expect(result.isError).toBeUndefined();
    });

    it("should return error for non-existent feature", async () => {
      vi.mocked(featureService.getFeatureById).mockResolvedValue(null);
      vi.mocked(prisma.feature.findUnique).mockResolvedValue(null);

      const handler = getHandler();
      const result = await handler!({
        id: "non-existent",
        title: "New Title",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("not found");
    });
  });

  describe("tool registration", () => {
    it("should register all feature tools", () => {
      expect(registeredTools.has("spectree__list_features")).toBe(true);
      expect(registeredTools.has("spectree__get_feature")).toBe(true);
      expect(registeredTools.has("spectree__create_feature")).toBe(true);
      expect(registeredTools.has("spectree__update_feature")).toBe(true);
    });

    it("should have proper descriptions", () => {
      const listTool = registeredTools.get("spectree__list_features");
      const getTool = registeredTools.get("spectree__get_feature");
      const createTool = registeredTools.get("spectree__create_feature");
      const updateTool = registeredTools.get("spectree__update_feature");

      expect(listTool?.config.description).toContain("List features");
      expect(getTool?.config.description).toContain("Get detailed information");
      expect(createTool?.config.description).toContain("Create a new feature");
      expect(updateTool?.config.description).toContain("Update an existing feature");
    });
  });
});
