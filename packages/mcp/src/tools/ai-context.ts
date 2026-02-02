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
  // spectree__get_ai_context
  // ==========================================================================
  server.registerTool(
    "spectree__get_ai_context",
    {
      description:
        "Retrieve AI context for a feature or task. Returns structured context that was set " +
        "by previous AI sessions, along with an array of AI notes (observations, decisions, " +
        "blockers, next-steps). Use this at the start of a session to understand previous " +
        "work and continue from where the last session left off.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature or task identifier. Accepts UUID or human-readable identifier " +
            "(e.g., 'COM-123' for features, 'COM-123-1' for tasks)."
          ),
        type: z
          .enum(["feature", "task"])
          .describe(
            "Whether this is a 'feature' or 'task'."
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
        "Set structured context for a feature or task. This replaces the entire AI context " +
        "field. Use this to store a summary or structured data that future sessions should " +
        "know. For incremental updates, prefer spectree__append_ai_note instead.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature or task identifier. Accepts UUID or human-readable identifier " +
            "(e.g., 'COM-123' for features, 'COM-123-1' for tasks)."
          ),
        type: z
          .enum(["feature", "task"])
          .describe(
            "Whether this is a 'feature' or 'task'."
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
        "Append a note to a feature or task's AI notes array. Notes are never overwritten, " +
        "only appended. Use this to log observations, decisions, blockers, or next-steps " +
        "as you work. Each note is timestamped and can include a session identifier.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature or task identifier. Accepts UUID or human-readable identifier " +
            "(e.g., 'COM-123' for features, 'COM-123-1' for tasks)."
          ),
        type: z
          .enum(["feature", "task"])
          .describe(
            "Whether this is a 'feature' or 'task'."
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
