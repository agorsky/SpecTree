/**
 * Integration tests for MCP Progress tools
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
    startFeatureWork: vi.fn(),
    startTaskWork: vi.fn(),
    completeFeatureWork: vi.fn(),
    completeTaskWork: vi.fn(),
    logFeatureProgress: vi.fn(),
    logTaskProgress: vi.fn(),
    reportFeatureBlocker: vi.fn(),
    reportTaskBlocker: vi.fn(),
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

import { registerProgressTools } from "../src/tools/progress.js";

const mockServer = {
  registerTool: (name: string, config: any, handler: any) => {
    registeredTools.set(name, { config, handler });
  },
};

beforeAll(() => {
  registerProgressTools(mockServer as any);
});

describe("MCP Progress Tools", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.resetAllMocks());

  describe("spectree__manage_progress (COMPOSITE)", () => {
    const getHandler = () => registeredTools.get("spectree__manage_progress")?.handler;

    describe("action='start_work'", () => {
      it("should start work on a feature", async () => {
        const mockFeature = { id: "feat-1", identifier: "ENG-1" };
        const mockResult = { id: "feat-1", identifier: "ENG-1", statusId: "in-progress", startedAt: "2024-01-01" };
        mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
        mockApiClient.startFeatureWork.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({ action: "start_work", id: "ENG-1", type: "feature" });

        expect(mockApiClient.getFeature).toHaveBeenCalledWith("ENG-1");
        expect(mockApiClient.startFeatureWork).toHaveBeenCalledWith("feat-1", { sessionId: undefined });
        expect(result.isError).toBeUndefined();
      });

      it("should start work on a task", async () => {
        const mockTask = { id: "task-1", identifier: "ENG-1-1" };
        const mockResult = { id: "task-1", identifier: "ENG-1-1", statusId: "in-progress", startedAt: "2024-01-01" };
        mockApiClient.getTask.mockResolvedValue({ data: mockTask });
        mockApiClient.startTaskWork.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({ action: "start_work", id: "ENG-1-1", type: "task", sessionId: "session-1" });

        expect(mockApiClient.getTask).toHaveBeenCalledWith("ENG-1-1");
        expect(mockApiClient.startTaskWork).toHaveBeenCalledWith("task-1", { sessionId: "session-1" });
        expect(result.isError).toBeUndefined();
      });
    });

    describe("action='complete_work'", () => {
      it("should complete work on a feature", async () => {
        const mockFeature = { id: "feat-1", identifier: "ENG-1" };
        const mockResult = { id: "feat-1", completedAt: "2024-01-01", durationMinutes: 60 };
        mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
        mockApiClient.completeFeatureWork.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({ action: "complete_work", id: "ENG-1", type: "feature", summary: "Done" });

        expect(mockApiClient.completeFeatureWork).toHaveBeenCalledWith("feat-1", { summary: "Done", sessionId: undefined });
        expect(result.isError).toBeUndefined();
      });

      it("should complete work on a task", async () => {
        const mockTask = { id: "task-1", identifier: "ENG-1-1" };
        const mockResult = { id: "task-1", completedAt: "2024-01-01", durationMinutes: 30 };
        mockApiClient.getTask.mockResolvedValue({ data: mockTask });
        mockApiClient.completeTaskWork.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({ action: "complete_work", id: "ENG-1-1", type: "task" });

        expect(mockApiClient.completeTaskWork).toHaveBeenCalledWith("task-1", { summary: undefined, sessionId: undefined });
        expect(result.isError).toBeUndefined();
      });
    });

    describe("action='log_progress'", () => {
      it("should log progress on a feature", async () => {
        const mockFeature = { id: "feat-1", identifier: "ENG-1" };
        const mockResult = { id: "feat-1", percentComplete: 50 };
        mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
        mockApiClient.logFeatureProgress.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({ action: "log_progress", id: "ENG-1", type: "feature", message: "Half done", percentComplete: 50 });

        expect(mockApiClient.logFeatureProgress).toHaveBeenCalledWith("feat-1", { message: "Half done", percentComplete: 50, sessionId: undefined });
        expect(result.isError).toBeUndefined();
      });

      it("should log progress on a task", async () => {
        const mockTask = { id: "task-1", identifier: "ENG-1-1" };
        const mockResult = { id: "task-1", percentComplete: 75 };
        mockApiClient.getTask.mockResolvedValue({ data: mockTask });
        mockApiClient.logTaskProgress.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({ action: "log_progress", id: "ENG-1-1", type: "task", message: "Almost done" });

        expect(mockApiClient.logTaskProgress).toHaveBeenCalledWith("task-1", { message: "Almost done", percentComplete: undefined, sessionId: undefined });
        expect(result.isError).toBeUndefined();
      });
    });

    describe("action='report_blocker'", () => {
      it("should report blocker on a feature", async () => {
        const mockFeature = { id: "feat-1", identifier: "ENG-1" };
        const mockResult = { id: "feat-1", blockerReason: "Waiting for API" };
        mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
        mockApiClient.reportFeatureBlocker.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({ action: "report_blocker", id: "ENG-1", type: "feature", reason: "Waiting for API", blockedById: "feat-2" });

        expect(mockApiClient.reportFeatureBlocker).toHaveBeenCalledWith("feat-1", { reason: "Waiting for API", blockedById: "feat-2", sessionId: undefined });
        expect(result.isError).toBeUndefined();
      });

      it("should report blocker on a task", async () => {
        const mockTask = { id: "task-1", identifier: "ENG-1-1" };
        const mockResult = { id: "task-1", blockerReason: "Missing dependency" };
        mockApiClient.getTask.mockResolvedValue({ data: mockTask });
        mockApiClient.reportTaskBlocker.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({ action: "report_blocker", id: "ENG-1-1", type: "task", reason: "Missing dependency" });

        expect(mockApiClient.reportTaskBlocker).toHaveBeenCalledWith("task-1", { reason: "Missing dependency", blockedById: undefined, sessionId: undefined });
        expect(result.isError).toBeUndefined();
      });
    });

    it("should handle API errors", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.getFeature.mockRejectedValue(new ApiError("Not found", 404));

      const handler = getHandler();
      const result = await handler!({ action: "start_work", id: "non-existent", type: "feature" });

      expect(result.isError).toBe(true);
    });
  });

  describe("spectree__start_work (deprecated)", () => {
    const getHandler = () => registeredTools.get("spectree__start_work")?.handler;

    it("should still work for backward compatibility", async () => {
      const mockFeature = { id: "feat-1", identifier: "ENG-1" };
      const mockResult = { id: "feat-1", identifier: "ENG-1", statusId: "in-progress", startedAt: "2024-01-01" };
      mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
      mockApiClient.startFeatureWork.mockResolvedValue({ data: mockResult });

      const handler = getHandler();
      const result = await handler!({ id: "ENG-1", type: "feature" });

      expect(mockApiClient.startFeatureWork).toHaveBeenCalled();
      expect(result.isError).toBeUndefined();
    });
  });

  describe("tool registration", () => {
    it("should register all progress tools", () => {
      expect(registeredTools.has("spectree__manage_progress")).toBe(true);
      expect(registeredTools.has("spectree__start_work")).toBe(true);
      expect(registeredTools.has("spectree__complete_work")).toBe(true);
      expect(registeredTools.has("spectree__log_progress")).toBe(true);
      expect(registeredTools.has("spectree__report_blocker")).toBe(true);
    });
  });
});
