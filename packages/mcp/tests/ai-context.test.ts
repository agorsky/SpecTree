/**
 * Integration tests for MCP AI Context tools
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
    getFeatureAiContext: vi.fn(),
    getTaskAiContext: vi.fn(),
    getEpicAiContext: vi.fn(),
    setFeatureAiContext: vi.fn(),
    setTaskAiContext: vi.fn(),
    setEpicAiContext: vi.fn(),
    appendFeatureAiNote: vi.fn(),
    appendTaskAiNote: vi.fn(),
    appendEpicAiNote: vi.fn(),
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

import { registerAiContextTools } from "../src/tools/ai-context.js";

const mockServer = {
  registerTool: (name: string, config: any, handler: any) => {
    registeredTools.set(name, { config, handler });
  },
};

beforeAll(() => {
  registerAiContextTools(mockServer as any);
});

describe("MCP AI Context Tools", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.resetAllMocks());

  describe("spectree__manage_ai_context (COMPOSITE)", () => {
    const getHandler = () => registeredTools.get("spectree__manage_ai_context")?.handler;

    describe("action='get_context'", () => {
      it("should get context for a feature", async () => {
        const mockFeature = { id: "feat-1", identifier: "ENG-1" };
        const mockContext = { aiContext: "Some context", aiNotes: [] };
        mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
        mockApiClient.getFeatureAiContext.mockResolvedValue({ data: mockContext });

        const handler = getHandler();
        const result = await handler!({ action: "get_context", id: "ENG-1", type: "feature" });

        expect(mockApiClient.getFeature).toHaveBeenCalledWith("ENG-1");
        expect(mockApiClient.getFeatureAiContext).toHaveBeenCalledWith("feat-1");
        expect(result.isError).toBeUndefined();
      });

      it("should get context for a task", async () => {
        const mockTask = { id: "task-1", identifier: "ENG-1-1" };
        const mockContext = { aiContext: "Task context", aiNotes: [] };
        mockApiClient.getTask.mockResolvedValue({ data: mockTask });
        mockApiClient.getTaskAiContext.mockResolvedValue({ data: mockContext });

        const handler = getHandler();
        const result = await handler!({ action: "get_context", id: "ENG-1-1", type: "task" });

        expect(mockApiClient.getTask).toHaveBeenCalledWith("ENG-1-1");
        expect(mockApiClient.getTaskAiContext).toHaveBeenCalledWith("task-1");
        expect(result.isError).toBeUndefined();
      });

      it("should get context for an epic", async () => {
        const mockEpic = { id: "epic-1", name: "Epic Alpha" };
        const mockContext = { aiContext: "Epic context", aiNotes: [] };
        mockApiClient.getEpic.mockResolvedValue({ data: mockEpic });
        mockApiClient.getEpicAiContext.mockResolvedValue({ data: mockContext });

        const handler = getHandler();
        const result = await handler!({ action: "get_context", id: "Epic Alpha", type: "epic" });

        expect(mockApiClient.getEpic).toHaveBeenCalledWith("Epic Alpha");
        expect(mockApiClient.getEpicAiContext).toHaveBeenCalledWith("epic-1");
        expect(result.isError).toBeUndefined();
      });
    });

    describe("action='set_context'", () => {
      it("should set context for a feature", async () => {
        const mockFeature = { id: "feat-1", identifier: "ENG-1" };
        const mockResult = { aiContext: "New context" };
        mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
        mockApiClient.setFeatureAiContext.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({ action: "set_context", id: "ENG-1", type: "feature", context: "New context", sessionId: "session-1" });

        expect(mockApiClient.setFeatureAiContext).toHaveBeenCalledWith("feat-1", { context: "New context", sessionId: "session-1" });
        expect(result.isError).toBeUndefined();
      });

      it("should set context for a task", async () => {
        const mockTask = { id: "task-1", identifier: "ENG-1-1" };
        const mockResult = { aiContext: "Updated context" };
        mockApiClient.getTask.mockResolvedValue({ data: mockTask });
        mockApiClient.setTaskAiContext.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({ action: "set_context", id: "ENG-1-1", type: "task", context: "Updated context" });

        expect(mockApiClient.setTaskAiContext).toHaveBeenCalledWith("task-1", { context: "Updated context", sessionId: undefined });
        expect(result.isError).toBeUndefined();
      });

      it("should set context for an epic", async () => {
        const mockEpic = { id: "epic-1", name: "Epic Alpha" };
        const mockResult = { aiContext: "Epic updated" };
        mockApiClient.getEpic.mockResolvedValue({ data: mockEpic });
        mockApiClient.setEpicAiContext.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({ action: "set_context", id: "epic-1", type: "epic", context: "Epic updated" });

        expect(mockApiClient.setEpicAiContext).toHaveBeenCalledWith("epic-1", { context: "Epic updated", sessionId: undefined });
        expect(result.isError).toBeUndefined();
      });
    });

    describe("action='append_note'", () => {
      it("should append note to a feature", async () => {
        const mockFeature = { id: "feat-1", identifier: "ENG-1" };
        const mockResult = { aiNotes: [{ type: "observation", content: "Found a bug" }] };
        mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
        mockApiClient.appendFeatureAiNote.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({ action: "append_note", id: "ENG-1", type: "feature", noteType: "observation", content: "Found a bug" });

        expect(mockApiClient.appendFeatureAiNote).toHaveBeenCalledWith("feat-1", { type: "observation", content: "Found a bug", sessionId: undefined });
        expect(result.isError).toBeUndefined();
      });

      it("should append note to a task", async () => {
        const mockTask = { id: "task-1", identifier: "ENG-1-1" };
        const mockResult = { aiNotes: [{ type: "decision", content: "Using Redux" }] };
        mockApiClient.getTask.mockResolvedValue({ data: mockTask });
        mockApiClient.appendTaskAiNote.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({ action: "append_note", id: "ENG-1-1", type: "task", noteType: "decision", content: "Using Redux", sessionId: "session-2" });

        expect(mockApiClient.appendTaskAiNote).toHaveBeenCalledWith("task-1", { type: "decision", content: "Using Redux", sessionId: "session-2" });
        expect(result.isError).toBeUndefined();
      });

      it("should append note to an epic", async () => {
        const mockEpic = { id: "epic-1", name: "Epic Alpha" };
        const mockResult = { aiNotes: [{ type: "next-step", content: "Complete feature 1" }] };
        mockApiClient.getEpic.mockResolvedValue({ data: mockEpic });
        mockApiClient.appendEpicAiNote.mockResolvedValue({ data: mockResult });

        const handler = getHandler();
        const result = await handler!({ action: "append_note", id: "epic-1", type: "epic", noteType: "next-step", content: "Complete feature 1" });

        expect(mockApiClient.appendEpicAiNote).toHaveBeenCalledWith("epic-1", { type: "next-step", content: "Complete feature 1", sessionId: undefined });
        expect(result.isError).toBeUndefined();
      });
    });

    it("should handle API errors", async () => {
      const ApiError = (await import("../src/api-client.js")).ApiError;
      mockApiClient.getFeature.mockRejectedValue(new ApiError("Not found", 404));

      const handler = getHandler();
      const result = await handler!({ action: "get_context", id: "non-existent", type: "feature" });

      expect(result.isError).toBe(true);
    });
  });

  describe("spectree__get_ai_context (deprecated)", () => {
    const getHandler = () => registeredTools.get("spectree__get_ai_context")?.handler;

    it("should still work for backward compatibility", async () => {
      const mockFeature = { id: "feat-1", identifier: "ENG-1" };
      const mockContext = { aiContext: "Some context", aiNotes: [] };
      mockApiClient.getFeature.mockResolvedValue({ data: mockFeature });
      mockApiClient.getFeatureAiContext.mockResolvedValue({ data: mockContext });

      const handler = getHandler();
      const result = await handler!({ id: "ENG-1", type: "feature" });

      expect(mockApiClient.getFeatureAiContext).toHaveBeenCalled();
      expect(result.isError).toBeUndefined();
    });
  });

  describe("tool registration", () => {
    it("should register all AI context tools", () => {
      expect(registeredTools.has("spectree__manage_ai_context")).toBe(true);
      expect(registeredTools.has("spectree__get_ai_context")).toBe(true);
      expect(registeredTools.has("spectree__set_ai_context")).toBe(true);
      expect(registeredTools.has("spectree__append_ai_note")).toBe(true);
    });
  });
});
