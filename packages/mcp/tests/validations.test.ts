/**
 * Integration tests for MCP Validation tools
 *
 * Tests for spectree__manage_validations composite tool
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";

interface ToolResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

const { mockApiClient } = vi.hoisted(() => {
  const mockApiClient = {
    getTask: vi.fn(),
    addValidation: vi.fn(),
    listValidations: vi.fn(),
    runValidation: vi.fn(),
    runAllValidations: vi.fn(),
    markManualValidated: vi.fn(),
    removeValidation: vi.fn(),
    resetValidations: vi.fn(),
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

import { registerValidationTools } from "../src/tools/validations.js";

const mockServer = {
  registerTool: (name: string, config: unknown, handler: (input: unknown) => Promise<ToolResponse>) => {
    registeredTools.set(name, { config, handler });
  },
};

beforeAll(() => {
  registerValidationTools(mockServer as any);
});

describe("MCP Validation Tools - spectree__manage_validations", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.resetAllMocks());

  const getHandler = () => registeredTools.get("spectree__manage_validations")?.handler;

  const mockTask = {
    id: "task-uuid-123",
    identifier: "ENG-42-1",
    title: "Test Task",
  };

  beforeEach(() => {
    mockApiClient.getTask.mockResolvedValue({ data: mockTask });
  });

  // ===========================================================================
  // Action: add
  // ===========================================================================
  describe("action: add", () => {
    it("should add a command validation check", async () => {
      const mockValidation = {
        id: "check-123",
        type: "command",
        description: "Run linter",
        command: "pnpm lint",
        status: "pending",
      };
      mockApiClient.addValidation.mockResolvedValue({ data: mockValidation });

      const handler = getHandler()!;
      const result = await handler({
        action: "add",
        taskId: "ENG-42-1",
        type: "command",
        description: "Run linter",
        command: "pnpm lint",
      });

      expect(result.isError).toBeFalsy();
      expect(mockApiClient.getTask).toHaveBeenCalledWith("ENG-42-1");
      expect(mockApiClient.addValidation).toHaveBeenCalledWith("task-uuid-123", {
        type: "command",
        description: "Run linter",
        command: "pnpm lint",
      });
      
      const content = JSON.parse(result.content[0].text);
      expect(content.message).toContain("Added validation check");
      expect(content.id).toBe("check-123");
    });

    it("should add a file_exists validation check", async () => {
      const mockValidation = {
        id: "check-456",
        type: "file_exists",
        description: "Config file exists",
        filePath: "config.json",
        status: "pending",
      };
      mockApiClient.addValidation.mockResolvedValue({ data: mockValidation });

      const handler = getHandler()!;
      const result = await handler({
        action: "add",
        taskId: "ENG-42-1",
        type: "file_exists",
        description: "Config file exists",
        filePath: "config.json",
      });

      expect(result.isError).toBeFalsy();
      expect(mockApiClient.addValidation).toHaveBeenCalledWith("task-uuid-123", {
        type: "file_exists",
        description: "Config file exists",
        filePath: "config.json",
      });
    });
  });

  // ===========================================================================
  // Action: list
  // ===========================================================================
  describe("action: list", () => {
    it("should list all validation checks for a task", async () => {
      const mockList = {
        checks: [
          { id: "check-1", description: "Test 1", status: "pending" },
          { id: "check-2", description: "Test 2", status: "passed" },
        ],
        summary: { total: 2, pending: 1, passed: 1, failed: 0 },
      };
      mockApiClient.listValidations.mockResolvedValue({ data: mockList });

      const handler = getHandler()!;
      const result = await handler({
        action: "list",
        taskId: "ENG-42-1",
      });

      expect(result.isError).toBeFalsy();
      expect(mockApiClient.getTask).toHaveBeenCalledWith("ENG-42-1");
      expect(mockApiClient.listValidations).toHaveBeenCalledWith("task-uuid-123");
      
      const content = JSON.parse(result.content[0].text);
      expect(content.checks).toHaveLength(2);
      expect(content.summary.total).toBe(2);
    });
  });

  // ===========================================================================
  // Action: run
  // ===========================================================================
  describe("action: run", () => {
    it("should run a single validation check", async () => {
      const mockResult = {
        id: "check-123",
        description: "Run tests",
        status: "passed",
        passed: true,
        output: "All tests passed",
      };
      mockApiClient.runValidation.mockResolvedValue({ data: mockResult });

      const handler = getHandler()!;
      const result = await handler({
        action: "run",
        taskId: "ENG-42-1",
        checkId: "check-123",
      });

      expect(result.isError).toBeFalsy();
      expect(mockApiClient.runValidation).toHaveBeenCalledWith(
        "task-uuid-123",
        "check-123",
        undefined
      );
      
      const content = JSON.parse(result.content[0].text);
      expect(content.passed).toBe(true);
    });

    it("should pass workingDirectory to run validation", async () => {
      const mockResult = {
        id: "check-123",
        status: "passed",
        passed: true,
      };
      mockApiClient.runValidation.mockResolvedValue({ data: mockResult });

      const handler = getHandler()!;
      await handler({
        action: "run",
        taskId: "ENG-42-1",
        checkId: "check-123",
        workingDirectory: "/custom/dir",
      });

      expect(mockApiClient.runValidation).toHaveBeenCalledWith(
        "task-uuid-123",
        "check-123",
        "/custom/dir"
      );
    });
  });

  // ===========================================================================
  // Action: run_all
  // ===========================================================================
  describe("action: run_all", () => {
    it("should run all validation checks", async () => {
      const mockResult = {
        summary: { total: 3, pending: 0, passed: 3, failed: 0 },
        results: [
          { id: "check-1", passed: true },
          { id: "check-2", passed: true },
          { id: "check-3", passed: true },
        ],
      };
      mockApiClient.runAllValidations.mockResolvedValue({ data: mockResult });

      const handler = getHandler()!;
      const result = await handler({
        action: "run_all",
        taskId: "ENG-42-1",
      });

      expect(result.isError).toBeFalsy();
      expect(mockApiClient.runAllValidations).toHaveBeenCalledWith("task-uuid-123", {});
      
      const content = JSON.parse(result.content[0].text);
      expect(content.summary.passed).toBe(3);
    });

    it("should pass options to run all validations", async () => {
      const mockResult = {
        summary: { total: 2, pending: 0, passed: 1, failed: 1 },
        results: [
          { id: "check-1", passed: true },
          { id: "check-2", passed: false },
        ],
      };
      mockApiClient.runAllValidations.mockResolvedValue({ data: mockResult });

      const handler = getHandler()!;
      await handler({
        action: "run_all",
        taskId: "ENG-42-1",
        stopOnFailure: true,
        workingDirectory: "/workspace",
      });

      expect(mockApiClient.runAllValidations).toHaveBeenCalledWith("task-uuid-123", {
        stopOnFailure: true,
        workingDirectory: "/workspace",
      });
    });
  });

  // ===========================================================================
  // Action: mark_manual
  // ===========================================================================
  describe("action: mark_manual", () => {
    it("should mark a manual validation as validated", async () => {
      const mockResult = {
        id: "check-789",
        description: "UI looks correct",
        status: "passed",
        type: "manual",
      };
      mockApiClient.markManualValidated.mockResolvedValue({ data: mockResult });

      const handler = getHandler()!;
      const result = await handler({
        action: "mark_manual",
        taskId: "ENG-42-1",
        checkId: "check-789",
        notes: "Verified in production",
      });

      expect(result.isError).toBeFalsy();
      expect(mockApiClient.markManualValidated).toHaveBeenCalledWith(
        "task-uuid-123",
        "check-789",
        "Verified in production"
      );
      
      const content = JSON.parse(result.content[0].text);
      expect(content.message).toContain("marked as passed");
    });
  });

  // ===========================================================================
  // Action: remove
  // ===========================================================================
  describe("action: remove", () => {
    it("should remove a validation check", async () => {
      mockApiClient.removeValidation.mockResolvedValue({});

      const handler = getHandler()!;
      const result = await handler({
        action: "remove",
        taskId: "ENG-42-1",
        checkId: "check-999",
      });

      expect(result.isError).toBeFalsy();
      expect(mockApiClient.removeValidation).toHaveBeenCalledWith(
        "task-uuid-123",
        "check-999"
      );
      
      const content = JSON.parse(result.content[0].text);
      expect(content.message).toContain("removed");
      expect(content.checkId).toBe("check-999");
    });
  });

  // ===========================================================================
  // Action: reset
  // ===========================================================================
  describe("action: reset", () => {
    it("should reset all validation checks to pending", async () => {
      const mockResult = {
        summary: { total: 5, pending: 5, passed: 0, failed: 0 },
      };
      mockApiClient.resetValidations.mockResolvedValue({ data: mockResult });

      const handler = getHandler()!;
      const result = await handler({
        action: "reset",
        taskId: "ENG-42-1",
      });

      expect(result.isError).toBeFalsy();
      expect(mockApiClient.resetValidations).toHaveBeenCalledWith("task-uuid-123");
      
      const content = JSON.parse(result.content[0].text);
      expect(content.message).toContain("Reset 5 validation checks");
    });
  });

  // ===========================================================================
  // Error Cases
  // ===========================================================================
  describe("error handling", () => {
    it("should handle task not found error", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.getTask.mockRejectedValue(
        new ApiError("Task not found", 404)
      );

      const handler = getHandler()!;
      const result = await handler({
        action: "list",
        taskId: "INVALID-TASK",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain("Task 'INVALID-TASK' not found");
    });

    it("should handle API errors gracefully", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.listValidations.mockRejectedValue(
        new ApiError("Server error", 500, { message: "Internal error" })
      );

      const handler = getHandler()!;
      const result = await handler({
        action: "list",
        taskId: "ENG-42-1",
      });

      expect(result.isError).toBe(true);
      expect(mockApiClient.getTask).toHaveBeenCalledWith("ENG-42-1");
    });
  });
});
