/**
 * MCP Tools for AI Context operations
 *
 * Provides tools for AI sessions to store and retrieve context,
 * enabling cross-session continuity and knowledge transfer.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";

// Register all AI context tools
export function registerAiContextTools(server: McpServer): void {
  // ==========================================================================
  // spectree__manage_ai_context (COMPOSITE)
  // ==========================================================================
  server.registerTool(
    "spectree__manage_ai_context",
    {
      description:
        "Manage AI context and notes for features, tasks, and epics using a unified interface. " +
        "This composite tool consolidates 3 AI context operations into a single tool with action-based routing.\n\n" +
        "Actions:\n" +
        "- 'get_context': Retrieve AI context and notes for an item\n" +
        "- 'set_context': Replace the entire AI context field\n" +
        "- 'append_note': Add a new note to the AI notes array\n\n" +
        "Use this instead of the individual AI context tools for a more streamlined workflow.",
      inputSchema: z.discriminatedUnion("action", [
        z.object({
          action: z.literal("get_context"),
          id: z.string().describe("Feature, task, or epic identifier (UUID or human-readable)"),
          type: z.enum(["feature", "task", "epic"]).describe("Whether this is a 'feature', 'task', or 'epic'"),
        }),
        z.object({
          action: z.literal("set_context"),
          id: z.string().describe("Feature, task, or epic identifier (UUID or human-readable)"),
          type: z.enum(["feature", "task", "epic"]).describe("Whether this is a 'feature', 'task', or 'epic'"),
          context: z.string().max(50000).describe("Structured context for AI consumption (replaces entire field)"),
          sessionId: z.string().max(255).optional().describe("Optional AI session identifier"),
        }),
        z.object({
          action: z.literal("append_note"),
          id: z.string().describe("Feature, task, or epic identifier (UUID or human-readable)"),
          type: z.enum(["feature", "task", "epic"]).describe("Whether this is a 'feature', 'task', or 'epic'"),
          noteType: z.enum(["observation", "decision", "blocker", "next-step", "context"]).describe("Type of note"),
          content: z.string().min(1).max(10000).describe("Content of the note"),
          sessionId: z.string().max(255).optional().describe("Optional AI session identifier"),
        }),
      ]),
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // Route based on action
        switch (input.action) {
          case "get_context": {
            if (input.type === "feature") {
              const { data: feature } = await apiClient.getFeature(input.id);
              const { data: context } = await apiClient.getFeatureAiContext(feature.id);
              return createResponse({
                entityType: "feature",
                entityId: feature.id,
                identifier: feature.identifier,
                ...context,
              });
            } else if (input.type === "epic") {
              const { data: epic } = await apiClient.getEpic(input.id);
              const { data: context } = await apiClient.getEpicAiContext(epic.id);
              return createResponse({
                entityType: "epic",
                entityId: epic.id,
                name: epic.name,
                ...context,
              });
            } else {
              const { data: task } = await apiClient.getTask(input.id);
              const { data: context } = await apiClient.getTaskAiContext(task.id);
              return createResponse({
                entityType: "task",
                entityId: task.id,
                identifier: task.identifier,
                ...context,
              });
            }
          }

          case "set_context": {
            if (input.type === "feature") {
              const { data: feature } = await apiClient.getFeature(input.id);
              const { data: result } = await apiClient.setFeatureAiContext(feature.id, {
                context: input.context,
                sessionId: input.sessionId,
              });
              return createResponse({
                entityType: "feature",
                entityId: feature.id,
                identifier: feature.identifier,
                ...result,
              });
            } else if (input.type === "epic") {
              const { data: epic } = await apiClient.getEpic(input.id);
              const { data: result } = await apiClient.setEpicAiContext(epic.id, {
                context: input.context,
                sessionId: input.sessionId,
              });
              return createResponse({
                entityType: "epic",
                entityId: epic.id,
                name: epic.name,
                ...result,
              });
            } else {
              const { data: task } = await apiClient.getTask(input.id);
              const { data: result } = await apiClient.setTaskAiContext(task.id, {
                context: input.context,
                sessionId: input.sessionId,
              });
              return createResponse({
                entityType: "task",
                entityId: task.id,
                identifier: task.identifier,
                ...result,
              });
            }
          }

          case "append_note": {
            if (input.type === "feature") {
              const { data: feature } = await apiClient.getFeature(input.id);
              const { data: result } = await apiClient.appendFeatureAiNote(feature.id, {
                type: input.noteType,
                content: input.content,
                sessionId: input.sessionId,
              });
              return createResponse({
                entityType: "feature",
                entityId: feature.id,
                identifier: feature.identifier,
                noteAdded: {
                  type: input.noteType,
                  content: input.content,
                },
                totalNotes: result.aiNotes.length,
                ...result,
              });
            } else if (input.type === "epic") {
              const { data: epic } = await apiClient.getEpic(input.id);
              const { data: result } = await apiClient.appendEpicAiNote(epic.id, {
                type: input.noteType,
                content: input.content,
                sessionId: input.sessionId,
              });
              return createResponse({
                entityType: "epic",
                entityId: epic.id,
                name: epic.name,
                noteAdded: {
                  type: input.noteType,
                  content: input.content,
                },
                totalNotes: result.aiNotes.length,
                ...result,
              });
            } else {
              const { data: task } = await apiClient.getTask(input.id);
              const { data: result } = await apiClient.appendTaskAiNote(task.id, {
                type: input.noteType,
                content: input.content,
                sessionId: input.sessionId,
              });
              return createResponse({
                entityType: "task",
                entityId: task.id,
                identifier: task.identifier,
                noteAdded: {
                  type: input.noteType,
                  content: input.content,
                },
                totalNotes: result.aiNotes.length,
                ...result,
              });
            }
          }
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`${input.type} '${input.id}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__get_ai_context
  // ==========================================================================
  server.registerTool(
    "spectree__get_ai_context",
    {
      description:
        "⚠️ DEPRECATED: Use spectree__manage_ai_context with action='get_context' instead.\n\n" +
        "Retrieve AI context for a feature, task, or epic. Returns structured context that was set " +
        "by previous AI sessions, along with an array of AI notes (observations, decisions, " +
        "blockers, next-steps). Use this at the start of a session to understand previous " +
        "work and continue from where the last session left off.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature, task, or epic identifier. Accepts UUID or human-readable identifier " +
            "(e.g., 'COM-123' for features, 'COM-123-1' for tasks). Epics use UUID or exact name."
          ),
        type: z
          .enum(["feature", "task", "epic"])
          .describe(
            "Whether this is a 'feature', 'task', or 'epic'."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        if (input.type === "feature") {
          // Resolve feature identifier to UUID if needed
          const { data: feature } = await apiClient.getFeature(input.id);
          const { data: context } = await apiClient.getFeatureAiContext(feature.id);
          return createResponse({
            entityType: "feature",
            entityId: feature.id,
            identifier: feature.identifier,
            ...context,
          });
        } else if (input.type === "epic") {
          const { data: epic } = await apiClient.getEpic(input.id);
          const { data: context } = await apiClient.getEpicAiContext(epic.id);
          return createResponse({
            entityType: "epic",
            entityId: epic.id,
            name: epic.name,
            ...context,
          });
        } else {
          // Resolve task identifier to UUID if needed
          const { data: task } = await apiClient.getTask(input.id);
          const { data: context } = await apiClient.getTaskAiContext(task.id);
          return createResponse({
            entityType: "task",
            entityId: task.id,
            identifier: task.identifier,
            ...context,
          });
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`${input.type} '${input.id}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__set_ai_context
  // ==========================================================================
  server.registerTool(
    "spectree__set_ai_context",
    {
      description:
        "⚠️ DEPRECATED: Use spectree__manage_ai_context with action='set_context' instead.\n\n" +
        "Set structured context for a feature, task, or epic. This replaces the entire AI context " +
        "field. Use this to store a summary or structured data that future sessions should " +
        "know. For incremental updates, prefer spectree__append_ai_note instead.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature, task, or epic identifier. Accepts UUID or human-readable identifier " +
            "(e.g., 'COM-123' for features, 'COM-123-1' for tasks). Epics use UUID or exact name."
          ),
        type: z
          .enum(["feature", "task", "epic"])
          .describe(
            "Whether this is a 'feature', 'task', or 'epic'."
          ),
        context: z
          .string()
          .max(50000)
          .describe(
            "Structured context for AI consumption. Can be free-form text, markdown, " +
            "or structured data. This replaces the entire context field."
          ),
        sessionId: z
          .string()
          .max(255)
          .optional()
          .describe(
            "Optional identifier for this AI session. Helps track which session made changes."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        if (input.type === "feature") {
          // Resolve feature identifier to UUID if needed
          const { data: feature } = await apiClient.getFeature(input.id);
          const { data: result } = await apiClient.setFeatureAiContext(feature.id, {
            context: input.context,
            sessionId: input.sessionId,
          });
          return createResponse({
            entityType: "feature",
            entityId: feature.id,
            identifier: feature.identifier,
            ...result,
          });
        } else if (input.type === "epic") {
          const { data: epic } = await apiClient.getEpic(input.id);
          const { data: result } = await apiClient.setEpicAiContext(epic.id, {
            context: input.context,
            sessionId: input.sessionId,
          });
          return createResponse({
            entityType: "epic",
            entityId: epic.id,
            name: epic.name,
            ...result,
          });
        } else {
          // Resolve task identifier to UUID if needed
          const { data: task } = await apiClient.getTask(input.id);
          const { data: result } = await apiClient.setTaskAiContext(task.id, {
            context: input.context,
            sessionId: input.sessionId,
          });
          return createResponse({
            entityType: "task",
            entityId: task.id,
            identifier: task.identifier,
            ...result,
          });
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`${input.type} '${input.id}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__append_ai_note
  // ==========================================================================
  server.registerTool(
    "spectree__append_ai_note",
    {
      description:
        "⚠️ DEPRECATED: Use spectree__manage_ai_context with action='append_note' instead.\n\n" +
        "Append a note to a feature, task, or epic's AI notes array. Notes are never overwritten, " +
        "only appended. Use this to log observations, decisions, blockers, or next-steps " +
        "as you work. Each note is timestamped and can include a session identifier.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature, task, or epic identifier. Accepts UUID or human-readable identifier " +
            "(e.g., 'COM-123' for features, 'COM-123-1' for tasks). Epics use UUID or exact name."
          ),
        type: z
          .enum(["feature", "task", "epic"])
          .describe(
            "Whether this is a 'feature', 'task', or 'epic'."
          ),
        noteType: z
          .enum(["observation", "decision", "blocker", "next-step", "context"])
          .describe(
            "The type of note:\n" +
            "- 'observation': What you noticed or discovered\n" +
            "- 'decision': A choice made and why\n" +
            "- 'blocker': What's preventing progress\n" +
            "- 'next-step': What should happen next\n" +
            "- 'context': General background information"
          ),
        content: z
          .string()
          .min(1)
          .max(10000)
          .describe(
            "The content of the note. Should be clear and actionable for future AI sessions."
          ),
        sessionId: z
          .string()
          .max(255)
          .optional()
          .describe(
            "Optional identifier for this AI session. Helps track which session added the note."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        if (input.type === "feature") {
          // Resolve feature identifier to UUID if needed
          const { data: feature } = await apiClient.getFeature(input.id);
          const { data: result } = await apiClient.appendFeatureAiNote(feature.id, {
            type: input.noteType,
            content: input.content,
            sessionId: input.sessionId,
          });
          return createResponse({
            entityType: "feature",
            entityId: feature.id,
            identifier: feature.identifier,
            noteAdded: {
              type: input.noteType,
              content: input.content,
            },
            totalNotes: result.aiNotes.length,
            ...result,
          });
        } else if (input.type === "epic") {
          const { data: epic } = await apiClient.getEpic(input.id);
          const { data: result } = await apiClient.appendEpicAiNote(epic.id, {
            type: input.noteType,
            content: input.content,
            sessionId: input.sessionId,
          });
          return createResponse({
            entityType: "epic",
            entityId: epic.id,
            name: epic.name,
            noteAdded: {
              type: input.noteType,
              content: input.content,
            },
            totalNotes: result.aiNotes.length,
            ...result,
          });
        } else {
          // Resolve task identifier to UUID if needed
          const { data: task } = await apiClient.getTask(input.id);
          const { data: result } = await apiClient.appendTaskAiNote(task.id, {
            type: input.noteType,
            content: input.content,
            sessionId: input.sessionId,
          });
          return createResponse({
            entityType: "task",
            entityId: task.id,
            identifier: task.identifier,
            noteAdded: {
              type: input.noteType,
              content: input.content,
            },
            totalNotes: result.aiNotes.length,
            ...result,
          });
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`${input.type} '${input.id}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );
}
