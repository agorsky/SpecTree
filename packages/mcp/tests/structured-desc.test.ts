/**
 * Integration tests for MCP Structured Description tools
 *
 * Tests for spectree__manage_description composite tool with all 6 actions
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";

interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

const { mockApiClient } = vi.hoisted(() => {
  const mockApiClient = {
    getFeature: vi.fn(),
    getTask: vi.fn(),
    getEpic: vi.fn(),
    getFeatureStructuredDesc: vi.fn(),
    getTaskStructuredDesc: vi.fn(),
    getEpicStructuredDesc: vi.fn(),
    setFeatureStructuredDesc: vi.fn(),
    setTaskStructuredDesc: vi.fn(),
    setEpicStructuredDesc: vi.fn(),
    updateFeatureSection: vi.fn(),
    updateTaskSection: vi.fn(),
    updateEpicSection: vi.fn(),
    addFeatureAcceptanceCriterion: vi.fn(),
    addTaskAcceptanceCriterion: vi.fn(),
    addEpicAcceptanceCriterion: vi.fn(),
    linkFeatureFile: vi.fn(),
    linkTaskFile: vi.fn(),
    linkEpicFile: vi.fn(),
    addFeatureExternalLink: vi.fn(),
    addTaskExternalLink: vi.fn(),
    addEpicExternalLink: vi.fn(),
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

const registeredTools = new Map<string, { config: unknown; handler: (input: unknown) => Promise<ToolResponse> }>();

import { registerStructuredDescTools } from "../src/tools/structured-desc.js";

const mockServer = {
  registerTool: (name: string, config: unknown, handler: (input: unknown) => Promise<ToolResponse>) => {
    registeredTools.set(name, { config, handler });
  },
};

beforeAll(() => {
  registerStructuredDescTools(mockServer as any);
});

describe("MCP Structured Description Tools", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.resetAllMocks());

  // ===========================================================================
  // spectree__manage_description - Action: get
  // ===========================================================================
  describe("spectree__manage_description - action: get", () => {
    const getHandler = () => registeredTools.get("spectree__manage_description")?.handler;

    it("should get structured description for a feature", async () => {
      const mockFeature = { id: "feat-123", identifier: "ENG-42" };
      const mockStructuredDesc = {
        structuredDesc: {
          summary: "Test summary",
          aiInstructions: "Test instructions",
          acceptanceCriteria: ["Criterion 1", "Criterion 2"],
        },
      };

      mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
      mockApiClient.getFeatureStructuredDesc.mockResolvedValue({ data: mockStructuredDesc });

      const handler = getHandler();
      const result = await handler!({ action: "get", type: "feature", id: "ENG-42" });

      expect(mockApiClient.getFeature).toHaveBeenCalledWith("ENG-42");
      expect(mockApiClient.getFeatureStructuredDesc).toHaveBeenCalledWith("feat-123");
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain("ENG-42");
      expect(result.content[0].text).toContain("Test summary");
    });

    it("should get structured description for a task", async () => {
      const mockTask = { id: "task-456", identifier: "ENG-42-1" };
      const mockStructuredDesc = {
        structuredDesc: {
          summary: "Task summary",
          filesInvolved: ["src/test.ts"],
        },
      };

      mockApiClient.getTask.mockResolvedValue({ data: mockTask });
      mockApiClient.getTaskStructuredDesc.mockResolvedValue({ data: mockStructuredDesc });

      const handler = getHandler();
      const result = await handler!({ action: "get", type: "task", id: "ENG-42-1" });

      expect(mockApiClient.getTask).toHaveBeenCalledWith("ENG-42-1");
      expect(mockApiClient.getTaskStructuredDesc).toHaveBeenCalledWith("task-456");
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain("ENG-42-1");
    });

    it("should get structured description for an epic", async () => {
      const mockEpic = { id: "epic-789", name: "Test Epic" };
      const mockStructuredDesc = {
        structuredDesc: {
          summary: "Epic summary",
        },
      };

      mockApiClient.getEpic.mockResolvedValue({ data: mockEpic });
      mockApiClient.getEpicStructuredDesc.mockResolvedValue({ data: mockStructuredDesc });

      const handler = getHandler();
      const result = await handler!({ action: "get", type: "epic", id: "Test Epic" });

      expect(mockApiClient.getEpic).toHaveBeenCalledWith("Test Epic");
      expect(mockApiClient.getEpicStructuredDesc).toHaveBeenCalledWith("epic-789");
      expect(result.isError).toBeFalsy();
    });
  });

  // ===========================================================================
  // spectree__manage_description - Action: set
  // ===========================================================================
  describe("spectree__manage_description - action: set", () => {
    const getHandler = () => registeredTools.get("spectree__manage_description")?.handler;

    it("should set structured description for a feature", async () => {
      const mockFeature = { id: "feat-123", identifier: "ENG-42" };
      const structuredDesc = {
        summary: "New summary",
        aiInstructions: "New instructions",
        acceptanceCriteria: ["Criterion 1"],
      };
      const mockResponse = { structuredDesc };

      mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
      mockApiClient.setFeatureStructuredDesc.mockResolvedValue({ data: mockResponse });

      const handler = getHandler();
      const result = await handler!({ action: "set", type: "feature", id: "ENG-42", structuredDesc });

      expect(mockApiClient.setFeatureStructuredDesc).toHaveBeenCalledWith("feat-123", structuredDesc);
      expect(result.content[0].text).toContain("set successfully");
    });

    it("should set structured description for a task", async () => {
      const mockTask = { id: "task-456", identifier: "ENG-42-1" };
      const structuredDesc = { summary: "Task summary" };
      const mockResponse = { structuredDesc };

      mockApiClient.getTask.mockResolvedValue({ data: mockTask });
      mockApiClient.setTaskStructuredDesc.mockResolvedValue({ data: mockResponse });

      const handler = getHandler();
      const result = await handler!({ action: "set", type: "task", id: "ENG-42-1", structuredDesc });

      expect(mockApiClient.setTaskStructuredDesc).toHaveBeenCalledWith("task-456", structuredDesc);
      expect(result.isError).toBeFalsy();
    });

    it("should set structured description for an epic", async () => {
      const mockEpic = { id: "epic-789", name: "Test Epic" };
      const structuredDesc = { summary: "Epic summary" };
      const mockResponse = { structuredDesc };

      mockApiClient.getEpic.mockResolvedValue({ data: mockEpic });
      mockApiClient.setEpicStructuredDesc.mockResolvedValue({ data: mockResponse });

      const handler = getHandler();
      const result = await handler!({ action: "set", type: "epic", id: "epic-789", structuredDesc });

      expect(mockApiClient.setEpicStructuredDesc).toHaveBeenCalledWith("epic-789", structuredDesc);
      expect(result.isError).toBeFalsy();
    });
  });

  // ===========================================================================
  // spectree__manage_description - Action: update_section
  // ===========================================================================
  describe("spectree__manage_description - action: update_section", () => {
    const getHandler = () => registeredTools.get("spectree__manage_description")?.handler;

    it("should update a section for a feature", async () => {
      const mockFeature = { id: "feat-123", identifier: "ENG-42" };
      const mockResponse = {
        structuredDesc: {
          summary: "Updated summary",
        },
      };

      mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
      mockApiClient.updateFeatureSection.mockResolvedValue({ data: mockResponse });

      const handler = getHandler();
      const result = await handler!({
        action: "update_section",
        type: "feature",
        id: "ENG-42",
        section: "summary",
        value: "Updated summary",
      });

      expect(mockApiClient.updateFeatureSection).toHaveBeenCalledWith("feat-123", "summary", "Updated summary");
      expect(result.content[0].text).toContain("updated successfully");
    });

    it("should update a section for a task", async () => {
      const mockTask = { id: "task-456", identifier: "ENG-42-1" };
      const mockResponse = {
        structuredDesc: {
          riskLevel: "high",
        },
      };

      mockApiClient.getTask.mockResolvedValue({ data: mockTask });
      mockApiClient.updateTaskSection.mockResolvedValue({ data: mockResponse });

      const handler = getHandler();
      const result = await handler!({
        action: "update_section",
        type: "task",
        id: "task-456",
        section: "riskLevel",
        value: "high",
      });

      expect(mockApiClient.updateTaskSection).toHaveBeenCalledWith("task-456", "riskLevel", "high");
      expect(result.isError).toBeFalsy();
    });

    it("should update a section for an epic", async () => {
      const mockEpic = { id: "epic-789", name: "Test Epic" };
      const mockResponse = {
        structuredDesc: {
          technicalNotes: "Updated notes",
        },
      };

      mockApiClient.getEpic.mockResolvedValue({ data: mockEpic });
      mockApiClient.updateEpicSection.mockResolvedValue({ data: mockResponse });

      const handler = getHandler();
      const result = await handler!({
        action: "update_section",
        type: "epic",
        id: "epic-789",
        section: "technicalNotes",
        value: "Updated notes",
      });

      expect(mockApiClient.updateEpicSection).toHaveBeenCalledWith("epic-789", "technicalNotes", "Updated notes");
      expect(result.isError).toBeFalsy();
    });
  });

  // ===========================================================================
  // spectree__manage_description - Action: add_criterion
  // ===========================================================================
  describe("spectree__manage_description - action: add_criterion", () => {
    const getHandler = () => registeredTools.get("spectree__manage_description")?.handler;

    it("should add acceptance criterion to a feature", async () => {
      const mockFeature = { id: "feat-123", identifier: "ENG-42" };
      const mockResponse = {
        structuredDesc: {
          acceptanceCriteria: ["Criterion 1", "New criterion"],
        },
      };

      mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
      mockApiClient.addFeatureAcceptanceCriterion.mockResolvedValue({ data: mockResponse });

      const handler = getHandler();
      const result = await handler!({
        action: "add_criterion",
        type: "feature",
        id: "ENG-42",
        criterion: "New criterion",
      });

      expect(mockApiClient.addFeatureAcceptanceCriterion).toHaveBeenCalledWith("feat-123", "New criterion");
      expect(result.content[0].text).toContain("Total: 2");
    });

    it("should add acceptance criterion to a task", async () => {
      const mockTask = { id: "task-456", identifier: "ENG-42-1" };
      const mockResponse = {
        structuredDesc: {
          acceptanceCriteria: ["Task criterion"],
        },
      };

      mockApiClient.getTask.mockResolvedValue({ data: mockTask });
      mockApiClient.addTaskAcceptanceCriterion.mockResolvedValue({ data: mockResponse });

      const handler = getHandler();
      const result = await handler!({
        action: "add_criterion",
        type: "task",
        id: "task-456",
        criterion: "Task criterion",
      });

      expect(mockApiClient.addTaskAcceptanceCriterion).toHaveBeenCalledWith("task-456", "Task criterion");
      expect(result.isError).toBeFalsy();
    });

    it("should add acceptance criterion to an epic", async () => {
      const mockEpic = { id: "epic-789", name: "Test Epic" };
      const mockResponse = {
        structuredDesc: {
          acceptanceCriteria: ["Epic criterion"],
        },
      };

      mockApiClient.getEpic.mockResolvedValue({ data: mockEpic });
      mockApiClient.addEpicAcceptanceCriterion.mockResolvedValue({ data: mockResponse });

      const handler = getHandler();
      const result = await handler!({
        action: "add_criterion",
        type: "epic",
        id: "epic-789",
        criterion: "Epic criterion",
      });

      expect(mockApiClient.addEpicAcceptanceCriterion).toHaveBeenCalledWith("epic-789", "Epic criterion");
      expect(result.isError).toBeFalsy();
    });
  });

  // ===========================================================================
  // spectree__manage_description - Action: link_file
  // ===========================================================================
  describe("spectree__manage_description - action: link_file", () => {
    const getHandler = () => registeredTools.get("spectree__manage_description")?.handler;

    it("should link file to a feature", async () => {
      const mockFeature = { id: "feat-123", identifier: "ENG-42" };
      const mockResponse = {
        structuredDesc: {
          filesInvolved: ["src/test.ts", "src/new.ts"],
        },
      };

      mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
      mockApiClient.linkFeatureFile.mockResolvedValue({ data: mockResponse });

      const handler = getHandler();
      const result = await handler!({
        action: "link_file",
        type: "feature",
        id: "ENG-42",
        filePath: "src/new.ts",
      });

      expect(mockApiClient.linkFeatureFile).toHaveBeenCalledWith("feat-123", "src/new.ts");
      expect(result.content[0].text).toContain("Total: 2");
    });

    it("should link file to a task", async () => {
      const mockTask = { id: "task-456", identifier: "ENG-42-1" };
      const mockResponse = {
        structuredDesc: {
          filesInvolved: ["src/task.ts"],
        },
      };

      mockApiClient.getTask.mockResolvedValue({ data: mockTask });
      mockApiClient.linkTaskFile.mockResolvedValue({ data: mockResponse });

      const handler = getHandler();
      const result = await handler!({
        action: "link_file",
        type: "task",
        id: "task-456",
        filePath: "src/task.ts",
      });

      expect(mockApiClient.linkTaskFile).toHaveBeenCalledWith("task-456", "src/task.ts");
      expect(result.isError).toBeFalsy();
    });

    it("should link file to an epic", async () => {
      const mockEpic = { id: "epic-789", name: "Test Epic" };
      const mockResponse = {
        structuredDesc: {
          filesInvolved: ["src/epic.ts"],
        },
      };

      mockApiClient.getEpic.mockResolvedValue({ data: mockEpic });
      mockApiClient.linkEpicFile.mockResolvedValue({ data: mockResponse });

      const handler = getHandler();
      const result = await handler!({
        action: "link_file",
        type: "epic",
        id: "epic-789",
        filePath: "src/epic.ts",
      });

      expect(mockApiClient.linkEpicFile).toHaveBeenCalledWith("epic-789", "src/epic.ts");
      expect(result.isError).toBeFalsy();
    });
  });

  // ===========================================================================
  // spectree__manage_description - Action: add_link
  // ===========================================================================
  describe("spectree__manage_description - action: add_link", () => {
    const getHandler = () => registeredTools.get("spectree__manage_description")?.handler;

    it("should add external link to a feature", async () => {
      const mockFeature = { id: "feat-123", identifier: "ENG-42" };
      const mockResponse = {
        structuredDesc: {
          externalLinks: [
            { url: "https://docs.example.com", title: "Documentation" },
          ],
        },
      };

      mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
      mockApiClient.addFeatureExternalLink.mockResolvedValue({ data: mockResponse });

      const handler = getHandler();
      const result = await handler!({
        action: "add_link",
        type: "feature",
        id: "ENG-42",
        url: "https://docs.example.com",
        title: "Documentation",
      });

      expect(mockApiClient.addFeatureExternalLink).toHaveBeenCalledWith(
        "feat-123",
        { url: "https://docs.example.com", title: "Documentation" }
      );
      expect(result.content[0].text).toContain("Total: 1");
    });

    it("should add external link to a task", async () => {
      const mockTask = { id: "task-456", identifier: "ENG-42-1" };
      const mockResponse = {
        structuredDesc: {
          externalLinks: [
            { url: "https://example.com", title: "Link" },
          ],
        },
      };

      mockApiClient.getTask.mockResolvedValue({ data: mockTask });
      mockApiClient.addTaskExternalLink.mockResolvedValue({ data: mockResponse });

      const handler = getHandler();
      const result = await handler!({
        action: "add_link",
        type: "task",
        id: "task-456",
        url: "https://example.com",
        title: "Link",
      });

      expect(mockApiClient.addTaskExternalLink).toHaveBeenCalledWith(
        "task-456",
        { url: "https://example.com", title: "Link" }
      );
      expect(result.isError).toBeFalsy();
    });

    it("should add external link to an epic", async () => {
      const mockEpic = { id: "epic-789", name: "Test Epic" };
      const mockResponse = {
        structuredDesc: {
          externalLinks: [
            { url: "https://epic.example.com", title: "Epic Link" },
          ],
        },
      };

      mockApiClient.getEpic.mockResolvedValue({ data: mockEpic });
      mockApiClient.addEpicExternalLink.mockResolvedValue({ data: mockResponse });

      const handler = getHandler();
      const result = await handler!({
        action: "add_link",
        type: "epic",
        id: "epic-789",
        url: "https://epic.example.com",
        title: "Epic Link",
      });

      expect(mockApiClient.addEpicExternalLink).toHaveBeenCalledWith(
        "epic-789",
        { url: "https://epic.example.com", title: "Epic Link" }
      );
      expect(result.isError).toBeFalsy();
    });
  });

  // ===========================================================================
  // Error cases
  // ===========================================================================
  describe("spectree__manage_description - error handling", () => {
    const getHandler = () => registeredTools.get("spectree__manage_description")?.handler;

    it("should handle 404 error for non-existent feature", async () => {
      const ApiError = vi.mocked(await import("../src/api-client.js")).ApiError;
      mockApiClient.getFeature.mockRejectedValue(new ApiError("Not found", 404));

      const handler = getHandler();
      const result = await handler!({ action: "get", type: "feature", id: "NONEXISTENT" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });

    it("should handle generic errors", async () => {
      mockApiClient.getTask.mockRejectedValue(new Error("Network error"));

      const handler = getHandler();
      const result = await handler!({ action: "get", type: "task", id: "ENG-42-1" });

      expect(result.isError).toBe(true);
    });
  });
});
