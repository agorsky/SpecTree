/**
 * Integration tests for MCP Code Context tools
 *
 * Tests for spectree__manage_code_context composite tool and all 7 actions
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
    getFeatureCodeContext: vi.fn(),
    getTaskCodeContext: vi.fn(),
    linkFeatureCodeFile: vi.fn(),
    linkTaskCodeFile: vi.fn(),
    unlinkFeatureCodeFile: vi.fn(),
    unlinkTaskCodeFile: vi.fn(),
    linkFeatureFunction: vi.fn(),
    linkTaskFunction: vi.fn(),
    linkFeatureBranch: vi.fn(),
    linkTaskBranch: vi.fn(),
    linkFeatureCommit: vi.fn(),
    linkTaskCommit: vi.fn(),
    linkFeaturePr: vi.fn(),
    linkTaskPr: vi.fn(),
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

import { registerCodeContextTools } from "../src/tools/code-context.js";

const mockServer = {
  registerTool: (name: string, config: unknown, handler: (input: unknown) => Promise<ToolResponse>) => {
    registeredTools.set(name, { config, handler });
  },
};

beforeAll(() => {
  registerCodeContextTools(mockServer as any);
});

describe("MCP Code Context Tools", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.resetAllMocks());

  // ===========================================================================
  // spectree__manage_code_context tests
  // ===========================================================================
  describe("spectree__manage_code_context", () => {
    const getHandler = () => registeredTools.get("spectree__manage_code_context")?.handler;

    // -------------------------------------------------------------------------
    // get_context action
    // -------------------------------------------------------------------------
    describe("action: get_context", () => {
      it("should get code context for a feature", async () => {
        const mockFeature = {
          id: "feat-123",
          identifier: "ENG-42",
          title: "Test Feature",
        };
        const mockContext = {
          files: ["src/file1.ts", "src/file2.ts"],
          functions: ["src/file1.ts:myFunction"],
          branch: "feature/eng-42",
          commits: ["abc1234"],
          pr: { number: 5, url: "https://github.com/org/repo/pull/5" },
        };

        mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
        mockApiClient.getFeatureCodeContext.mockResolvedValue({ data: mockContext });

        const handler = getHandler();
        const result = await handler!({
          action: "get_context",
          id: "ENG-42",
          type: "feature",
        });

        expect(result.isError).toBeFalsy();
        const responseText = JSON.parse(result.content[0].text);
        expect(responseText.files).toEqual(mockContext.files);
        expect(responseText.functions).toEqual(mockContext.functions);
        expect(responseText.branch).toEqual(mockContext.branch);
        expect(mockApiClient.getFeature).toHaveBeenCalledWith("ENG-42");
        expect(mockApiClient.getFeatureCodeContext).toHaveBeenCalledWith("feat-123");
      });

      it("should get code context for a task", async () => {
        const mockTask = {
          id: "task-456",
          identifier: "ENG-42-1",
          title: "Test Task",
        };
        const mockContext = {
          files: ["src/task-file.ts"],
          functions: [],
          branch: null,
          commits: [],
          pr: null,
        };

        mockApiClient.getTask.mockResolvedValue({ data: mockTask });
        mockApiClient.getTaskCodeContext.mockResolvedValue({ data: mockContext });

        const handler = getHandler();
        const result = await handler!({
          action: "get_context",
          id: "ENG-42-1",
          type: "task",
        });

        expect(result.isError).toBeFalsy();
        const responseText = JSON.parse(result.content[0].text);
        expect(responseText.files).toEqual(mockContext.files);
        expect(mockApiClient.getTask).toHaveBeenCalledWith("ENG-42-1");
        expect(mockApiClient.getTaskCodeContext).toHaveBeenCalledWith("task-456");
      });
    });

    // -------------------------------------------------------------------------
    // link_file action
    // -------------------------------------------------------------------------
    describe("action: link_file", () => {
      it("should link a file to a feature", async () => {
        const mockFeature = {
          id: "feat-123",
          identifier: "ENG-42",
          title: "Test Feature",
        };
        const mockResult = {
          files: ["src/new-file.ts"],
        };

        mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
        mockApiClient.linkFeatureCodeFile.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({
          action: "link_file",
          id: "ENG-42",
          type: "feature",
          filePath: "src/new-file.ts",
        });

        expect(result.isError).toBeFalsy();
        const responseText = JSON.parse(result.content[0].text);
        expect(responseText.message).toContain("src/new-file.ts");
        expect(responseText.message).toContain("ENG-42");
        expect(mockApiClient.linkFeatureCodeFile).toHaveBeenCalledWith("feat-123", "src/new-file.ts");
      });

      it("should link a file to a task", async () => {
        const mockTask = {
          id: "task-456",
          identifier: "ENG-42-1",
          title: "Test Task",
        };
        const mockResult = {
          files: ["src/task-file.ts"],
        };

        mockApiClient.getTask.mockResolvedValue({ data: mockTask });
        mockApiClient.linkTaskCodeFile.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({
          action: "link_file",
          id: "ENG-42-1",
          type: "task",
          filePath: "src/task-file.ts",
        });

        expect(result.isError).toBeFalsy();
        const responseText = JSON.parse(result.content[0].text);
        expect(responseText.message).toContain("src/task-file.ts");
        expect(responseText.message).toContain("ENG-42-1");
        expect(mockApiClient.linkTaskCodeFile).toHaveBeenCalledWith("task-456", "src/task-file.ts");
      });
    });

    // -------------------------------------------------------------------------
    // unlink_file action
    // -------------------------------------------------------------------------
    describe("action: unlink_file", () => {
      it("should unlink a file from a feature", async () => {
        const mockFeature = {
          id: "feat-123",
          identifier: "ENG-42",
          title: "Test Feature",
        };
        const mockResult = {
          files: [],
        };

        mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
        mockApiClient.unlinkFeatureCodeFile.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({
          action: "unlink_file",
          id: "ENG-42",
          type: "feature",
          filePath: "src/old-file.ts",
        });

        expect(result.isError).toBeFalsy();
        const responseText = JSON.parse(result.content[0].text);
        expect(responseText.message).toContain("unlinked");
        expect(responseText.message).toContain("src/old-file.ts");
        expect(mockApiClient.unlinkFeatureCodeFile).toHaveBeenCalledWith("feat-123", "src/old-file.ts");
      });

      it("should unlink a file from a task", async () => {
        const mockTask = {
          id: "task-456",
          identifier: "ENG-42-1",
          title: "Test Task",
        };
        const mockResult = {
          files: [],
        };

        mockApiClient.getTask.mockResolvedValue({ data: mockTask });
        mockApiClient.unlinkTaskCodeFile.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({
          action: "unlink_file",
          id: "ENG-42-1",
          type: "task",
          filePath: "src/task-file.ts",
        });

        expect(result.isError).toBeFalsy();
        const responseText = JSON.parse(result.content[0].text);
        expect(responseText.message).toContain("unlinked");
        expect(responseText.message).toContain("src/task-file.ts");
        expect(mockApiClient.unlinkTaskCodeFile).toHaveBeenCalledWith("task-456", "src/task-file.ts");
      });
    });

    // -------------------------------------------------------------------------
    // link_function action
    // -------------------------------------------------------------------------
    describe("action: link_function", () => {
      it("should link a function to a feature", async () => {
        const mockFeature = {
          id: "feat-123",
          identifier: "ENG-42",
          title: "Test Feature",
        };
        const mockResult = {
          functions: ["src/utils.ts:helperFunction"],
        };

        mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
        mockApiClient.linkFeatureFunction.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({
          action: "link_function",
          id: "ENG-42",
          type: "feature",
          filePath: "src/utils.ts",
          functionName: "helperFunction",
        });

        expect(result.isError).toBeFalsy();
        const responseText = JSON.parse(result.content[0].text);
        expect(responseText.message).toContain("src/utils.ts:helperFunction");
        expect(responseText.message).toContain("ENG-42");
        expect(mockApiClient.linkFeatureFunction).toHaveBeenCalledWith("feat-123", "src/utils.ts", "helperFunction");
      });

      it("should link a function to a task", async () => {
        const mockTask = {
          id: "task-456",
          identifier: "ENG-42-1",
          title: "Test Task",
        };
        const mockResult = {
          functions: ["src/services.ts:processData"],
        };

        mockApiClient.getTask.mockResolvedValue({ data: mockTask });
        mockApiClient.linkTaskFunction.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({
          action: "link_function",
          id: "ENG-42-1",
          type: "task",
          filePath: "src/services.ts",
          functionName: "processData",
        });

        expect(result.isError).toBeFalsy();
        const responseText = JSON.parse(result.content[0].text);
        expect(responseText.message).toContain("src/services.ts:processData");
        expect(responseText.message).toContain("ENG-42-1");
        expect(mockApiClient.linkTaskFunction).toHaveBeenCalledWith("task-456", "src/services.ts", "processData");
      });
    });

    // -------------------------------------------------------------------------
    // link_branch action
    // -------------------------------------------------------------------------
    describe("action: link_branch", () => {
      it("should link a git branch to a feature", async () => {
        const mockFeature = {
          id: "feat-123",
          identifier: "ENG-42",
          title: "Test Feature",
        };
        const mockResult = {
          branch: "feature/eng-42-implementation",
        };

        mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
        mockApiClient.linkFeatureBranch.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({
          action: "link_branch",
          id: "ENG-42",
          type: "feature",
          branchName: "feature/eng-42-implementation",
        });

        expect(result.isError).toBeFalsy();
        const responseText = JSON.parse(result.content[0].text);
        expect(responseText.message).toContain("feature/eng-42-implementation");
        expect(responseText.message).toContain("ENG-42");
        expect(mockApiClient.linkFeatureBranch).toHaveBeenCalledWith("feat-123", "feature/eng-42-implementation");
      });

      it("should link a git branch to a task", async () => {
        const mockTask = {
          id: "task-456",
          identifier: "ENG-42-1",
          title: "Test Task",
        };
        const mockResult = {
          branch: "feature/eng-42-1-task",
        };

        mockApiClient.getTask.mockResolvedValue({ data: mockTask });
        mockApiClient.linkTaskBranch.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({
          action: "link_branch",
          id: "ENG-42-1",
          type: "task",
          branchName: "feature/eng-42-1-task",
        });

        expect(result.isError).toBeFalsy();
        const responseText = JSON.parse(result.content[0].text);
        expect(responseText.message).toContain("feature/eng-42-1-task");
        expect(responseText.message).toContain("ENG-42-1");
        expect(mockApiClient.linkTaskBranch).toHaveBeenCalledWith("task-456", "feature/eng-42-1-task");
      });
    });

    // -------------------------------------------------------------------------
    // link_commit action
    // -------------------------------------------------------------------------
    describe("action: link_commit", () => {
      it("should link a commit to a feature", async () => {
        const mockFeature = {
          id: "feat-123",
          identifier: "ENG-42",
          title: "Test Feature",
        };
        const mockResult = {
          commits: ["abc1234"],
        };

        mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
        mockApiClient.linkFeatureCommit.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({
          action: "link_commit",
          id: "ENG-42",
          type: "feature",
          commitSha: "abc1234",
        });

        expect(result.isError).toBeFalsy();
        const responseText = JSON.parse(result.content[0].text);
        expect(responseText.message).toContain("abc1234");
        expect(responseText.message).toContain("ENG-42");
        expect(mockApiClient.linkFeatureCommit).toHaveBeenCalledWith("feat-123", "abc1234");
      });

      it("should link a commit to a task", async () => {
        const mockTask = {
          id: "task-456",
          identifier: "ENG-42-1",
          title: "Test Task",
        };
        const mockResult = {
          commits: ["def5678"],
        };

        mockApiClient.getTask.mockResolvedValue({ data: mockTask });
        mockApiClient.linkTaskCommit.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({
          action: "link_commit",
          id: "ENG-42-1",
          type: "task",
          commitSha: "def5678",
        });

        expect(result.isError).toBeFalsy();
        const responseText = JSON.parse(result.content[0].text);
        expect(responseText.message).toContain("def5678");
        expect(responseText.message).toContain("ENG-42-1");
        expect(mockApiClient.linkTaskCommit).toHaveBeenCalledWith("task-456", "def5678");
      });
    });

    // -------------------------------------------------------------------------
    // link_pr action
    // -------------------------------------------------------------------------
    describe("action: link_pr", () => {
      it("should link a PR to a feature", async () => {
        const mockFeature = {
          id: "feat-123",
          identifier: "ENG-42",
          title: "Test Feature",
        };
        const mockResult = {
          pr: {
            number: 42,
            url: "https://github.com/org/repo/pull/42",
          },
        };

        mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
        mockApiClient.linkFeaturePr.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({
          action: "link_pr",
          id: "ENG-42",
          type: "feature",
          prNumber: 42,
          prUrl: "https://github.com/org/repo/pull/42",
        });

        expect(result.isError).toBeFalsy();
        const responseText = JSON.parse(result.content[0].text);
        expect(responseText.message).toContain("PR #42");
        expect(responseText.message).toContain("ENG-42");
        expect(mockApiClient.linkFeaturePr).toHaveBeenCalledWith("feat-123", 42, "https://github.com/org/repo/pull/42");
      });

      it("should link a PR to a task", async () => {
        const mockTask = {
          id: "task-456",
          identifier: "ENG-42-1",
          title: "Test Task",
        };
        const mockResult = {
          pr: {
            number: 43,
            url: "https://github.com/org/repo/pull/43",
          },
        };

        mockApiClient.getTask.mockResolvedValue({ data: mockTask });
        mockApiClient.linkTaskPr.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({
          action: "link_pr",
          id: "ENG-42-1",
          type: "task",
          prNumber: 43,
          prUrl: "https://github.com/org/repo/pull/43",
        });

        expect(result.isError).toBeFalsy();
        const responseText = JSON.parse(result.content[0].text);
        expect(responseText.message).toContain("PR #43");
        expect(responseText.message).toContain("ENG-42-1");
        expect(mockApiClient.linkTaskPr).toHaveBeenCalledWith("task-456", 43, "https://github.com/org/repo/pull/43");
      });
    });

    // -------------------------------------------------------------------------
    // Error cases
    // -------------------------------------------------------------------------
    describe("error handling", () => {
      it("should return error when feature/task not found", async () => {
        const ApiError = (await import("../src/api-client.js")).ApiError;
        mockApiClient.getFeature.mockRejectedValue(new ApiError("Not found", 404));

        const handler = getHandler();
        const result = await handler!({
          action: "get_context",
          id: "NONEXISTENT-999",
          type: "feature",
        });

        expect(result.isError).toBeTruthy();
        const responseText = result.content[0].text;
        expect(responseText).toContain("not found");
        expect(responseText).toContain("NONEXISTENT-999");
      });

      it("should return error for general API failures", async () => {
        mockApiClient.getFeature.mockRejectedValue(new Error("Network error"));

        const handler = getHandler();
        const result = await handler!({
          action: "link_file",
          id: "ENG-42",
          type: "feature",
          filePath: "src/file.ts",
        });

        expect(result.isError).toBeTruthy();
        const responseText = result.content[0].text;
        expect(responseText).toContain("Network error");
      });
    });
  });
});
