/**
 * Unit tests for MCP Bridge (Copilot SDK Tools)
 *
 * Tests verify:
 * - Tool creation with correct names and descriptions
 * - Parameter validation
 * - Error handling returns structured errors
 * - Integration with SpecTree API client
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createAgentTools,
  createAgentTool,
  agentToolNames,
  type AgentToolName,
} from "../src/spectree/mcp-bridge.js";
import { SpecTreeClient } from "../src/spectree/api-client.js";

// Mock the config module
vi.mock("../src/config/index.js", () => ({
  getApiUrl: () => "http://localhost:3001",
}));

// Mock client factory
function createMockClient(): SpecTreeClient {
  return {
    logProgress: vi.fn(),
    getFeature: vi.fn(),
    getTask: vi.fn(),
  } as unknown as SpecTreeClient;
}

describe("MCP Bridge - Tool Creation", () => {
  let mockClient: SpecTreeClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  describe("createAgentTools", () => {
    it("should create all 5 agent tools", () => {
      const tools = createAgentTools(mockClient);

      expect(tools).toHaveLength(5);
    });

    it("should create tools with correct names", () => {
      const tools = createAgentTools(mockClient);
      const toolNames = tools.map((t) => t.name);

      expect(toolNames).toContain("log_progress");
      expect(toolNames).toContain("log_decision");
      expect(toolNames).toContain("link_code_file");
      expect(toolNames).toContain("get_task_context");
      expect(toolNames).toContain("get_code_context");
    });

    it("should create tools with descriptions", () => {
      const tools = createAgentTools(mockClient);

      for (const tool of tools) {
        expect(tool.description).toBeDefined();
        expect(tool.description!.length).toBeGreaterThan(10);
      }
    });

    it("should create tools with handlers", () => {
      const tools = createAgentTools(mockClient);

      for (const tool of tools) {
        expect(typeof tool.handler).toBe("function");
      }
    });
  });

  describe("createAgentTool", () => {
    it.each(agentToolNames)("should create %s tool individually", (name) => {
      const tool = createAgentTool(name, mockClient);

      expect(tool).toBeDefined();
      expect(tool!.name).toBe(name);
    });

    it("should return undefined for unknown tool name", () => {
      const tool = createAgentTool("unknown_tool" as AgentToolName, mockClient);

      expect(tool).toBeUndefined();
    });
  });

  describe("agentToolNames", () => {
    it("should contain exactly 5 tool names", () => {
      expect(agentToolNames).toHaveLength(5);
    });

    it("should be a readonly tuple", () => {
      // TypeScript compile-time check - if this compiles, the type is correct
      const names: readonly string[] = agentToolNames;
      expect(names).toBeDefined();
    });
  });
});

describe("MCP Bridge - log_progress Tool", () => {
  let mockClient: SpecTreeClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it("should call client.logProgress with correct arguments", async () => {
    const tool = createAgentTool("log_progress", mockClient);
    const mockResponse = {
      id: "task-123",
      identifier: "TEAM-1-1",
      status: "In Progress",
      percentComplete: 50,
    };

    vi.mocked(mockClient.logProgress).mockResolvedValue(mockResponse);

    const result = await tool!.handler(
      {
        type: "task",
        id: "TEAM-1-1",
        message: "Completed first phase",
        percentComplete: 50,
      },
      { sessionId: "test-session", toolCallId: "call-1", toolName: "log_progress", arguments: {} }
    );

    expect(mockClient.logProgress).toHaveBeenCalledWith("task", "TEAM-1-1", {
      message: "Completed first phase",
      percentComplete: 50,
    });
    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        id: "task-123",
        identifier: "TEAM-1-1",
        message: expect.stringContaining("Progress logged"),
      }),
    });
  });

  it("should handle missing percentComplete", async () => {
    const tool = createAgentTool("log_progress", mockClient);
    const mockResponse = {
      id: "feature-123",
      identifier: "TEAM-1",
      status: "In Progress",
      percentComplete: null,
    };

    vi.mocked(mockClient.logProgress).mockResolvedValue(mockResponse);

    await tool!.handler(
      {
        type: "feature",
        id: "TEAM-1",
        message: "Working on implementation",
      },
      { sessionId: "test-session", toolCallId: "call-1", toolName: "log_progress", arguments: {} }
    );

    expect(mockClient.logProgress).toHaveBeenCalledWith("feature", "TEAM-1", {
      message: "Working on implementation",
    });
  });

  it("should return error result on API failure", async () => {
    const tool = createAgentTool("log_progress", mockClient);
    const error = new Error("Network error");

    vi.mocked(mockClient.logProgress).mockRejectedValue(error);

    const result = await tool!.handler(
      {
        type: "task",
        id: "TEAM-1-1",
        message: "Test message",
      },
      { sessionId: "test-session", toolCallId: "call-1", toolName: "log_progress", arguments: {} }
    );

    expect(result).toEqual({
      success: false,
      error: expect.objectContaining({
        message: "Network error",
      }),
    });
  });
});

describe("MCP Bridge - log_decision Tool", () => {
  let mockClient: SpecTreeClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it("should log decision to task when taskId provided", async () => {
    const tool = createAgentTool("log_decision", mockClient);
    vi.mocked(mockClient.logProgress).mockResolvedValue({
      id: "task-123",
      identifier: "TEAM-1-1",
      status: null,
      percentComplete: null,
      startedAt: null,
      completedAt: null,
    });

    const result = await tool!.handler(
      {
        epicId: "epic-123",
        taskId: "task-123",
        question: "Which library to use?",
        decision: "Use Zustand",
        rationale: "Simple API and small bundle",
        alternatives: ["Redux", "MobX"],
        category: "library",
        impact: "medium",
      },
      { sessionId: "test-session", toolCallId: "call-1", toolName: "log_decision", arguments: {} }
    );

    expect(mockClient.logProgress).toHaveBeenCalledWith("task", "task-123", {
      message: expect.stringContaining("DECISION: Which library to use?"),
    });
    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        decision: "Use Zustand",
        message: "Decision logged successfully",
      }),
    });
  });

  it("should log decision to feature when featureId provided but no taskId", async () => {
    const tool = createAgentTool("log_decision", mockClient);
    vi.mocked(mockClient.logProgress).mockResolvedValue({
      id: "feature-123",
      identifier: "TEAM-1",
      status: null,
      percentComplete: null,
      startedAt: null,
      completedAt: null,
    });

    await tool!.handler(
      {
        epicId: "epic-123",
        featureId: "feature-123",
        question: "API design approach?",
        decision: "REST over GraphQL",
        rationale: "Team familiarity",
      },
      { sessionId: "test-session", toolCallId: "call-1", toolName: "log_decision", arguments: {} }
    );

    expect(mockClient.logProgress).toHaveBeenCalledWith("feature", "feature-123", {
      message: expect.stringContaining("DECISION: API design approach?"),
    });
  });
});

describe("MCP Bridge - get_task_context Tool", () => {
  let mockClient: SpecTreeClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it("should return task and parent feature context", async () => {
    const tool = createAgentTool("get_task_context", mockClient);
    const mockTask = {
      id: "task-123",
      featureId: "feature-123",
      identifier: "TEAM-1-1",
      title: "Implement login form",
      description: "Create a login form with validation",
      status: { name: "In Progress" },
      executionOrder: 1,
      estimatedComplexity: "simple" as const,
      canParallelize: false,
      parallelGroup: null,
      statusId: "status-1",
      assigneeId: null,
      sortOrder: 1,
      dependencies: null,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const mockFeature = {
      id: "feature-123",
      epicId: "epic-123",
      identifier: "TEAM-1",
      title: "User Authentication",
      description: "Implement user auth flow",
      statusId: "status-1",
      assigneeId: null,
      sortOrder: 1,
      dependencies: null,
      executionOrder: 1,
      canParallelize: true,
      parallelGroup: null,
      estimatedComplexity: "moderate" as const,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    vi.mocked(mockClient.getTask).mockResolvedValue(mockTask);
    vi.mocked(mockClient.getFeature).mockResolvedValue(mockFeature);

    const result = await tool!.handler(
      { id: "TEAM-1-1" },
      { sessionId: "test-session", toolCallId: "call-1", toolName: "get_task_context", arguments: {} }
    );

    expect(mockClient.getTask).toHaveBeenCalledWith("TEAM-1-1");
    expect(mockClient.getFeature).toHaveBeenCalledWith("feature-123");
    expect(result).toEqual({
      success: true,
      data: {
        task: expect.objectContaining({
          identifier: "TEAM-1-1",
          title: "Implement login form",
          status: "In Progress",
        }),
        parentFeature: expect.objectContaining({
          identifier: "TEAM-1",
          title: "User Authentication",
        }),
      },
    });
  });
});

describe("MCP Bridge - link_code_file Tool", () => {
  let mockClient: SpecTreeClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it("should link file to task and log progress", async () => {
    const tool = createAgentTool("link_code_file", mockClient);
    const mockTask = {
      id: "task-123",
      featureId: "feature-123",
      identifier: "TEAM-1-1",
      title: "Test Task",
      description: null,
      statusId: null,
      assigneeId: null,
      sortOrder: 1,
      dependencies: null,
      executionOrder: 1,
      canParallelize: false,
      parallelGroup: null,
      estimatedComplexity: null,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    vi.mocked(mockClient.getTask).mockResolvedValue(mockTask);
    vi.mocked(mockClient.logProgress).mockResolvedValue({
      id: "task-123",
      identifier: "TEAM-1-1",
      status: null,
      percentComplete: null,
      startedAt: null,
      completedAt: null,
    });

    const result = await tool!.handler(
      {
        type: "task",
        id: "TEAM-1-1",
        filePath: "src/components/LoginForm.tsx",
      },
      { sessionId: "test-session", toolCallId: "call-1", toolName: "link_code_file", arguments: {} }
    );

    expect(mockClient.getTask).toHaveBeenCalledWith("TEAM-1-1");
    expect(mockClient.logProgress).toHaveBeenCalledWith("task", "TEAM-1-1", {
      message: "Linked file: src/components/LoginForm.tsx",
    });
    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        filePath: "src/components/LoginForm.tsx",
        message: expect.stringContaining("linked"),
      }),
    });
  });
});

describe("MCP Bridge - get_code_context Tool", () => {
  let mockClient: SpecTreeClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it("should return code context for feature", async () => {
    const tool = createAgentTool("get_code_context", mockClient);
    const mockFeature = {
      id: "feature-123",
      epicId: "epic-123",
      identifier: "TEAM-1",
      title: "User Authentication",
      description: null,
      statusId: null,
      assigneeId: null,
      sortOrder: 1,
      dependencies: null,
      executionOrder: 1,
      canParallelize: true,
      parallelGroup: null,
      estimatedComplexity: null,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    vi.mocked(mockClient.getFeature).mockResolvedValue(mockFeature);

    const result = await tool!.handler(
      {
        type: "feature",
        id: "TEAM-1",
      },
      { sessionId: "test-session", toolCallId: "call-1", toolName: "get_code_context", arguments: {} }
    );

    expect(mockClient.getFeature).toHaveBeenCalledWith("TEAM-1");
    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        type: "feature",
        identifier: "TEAM-1",
        codeContext: {
          files: [],
          functions: [],
          branch: null,
          commits: [],
          pr: null,
        },
      }),
    });
  });
});
