/**
 * MCP Tools for AI Session Management
 *
 * Provides tools for starting, ending, and querying AI sessions.
 * Sessions track AI agent work against epics and enable handoff between sessions.
 * Uses HTTP API client for all operations.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";

export function registerSessionTools(server: McpServer): void {
  // ==========================================================================
  // spectree__start_session
  // ==========================================================================
  server.registerTool(
    "spectree__start_session",
    {
      description:
        "Start a new AI session for an epic. Creates a session record, abandons any existing active session, " +
        "and returns the previous session's handoff data plus epic progress. " +
        "Call this at the START of any work session to properly track AI activity.",
      inputSchema: {
        epicId: z
          .string()
          .describe(
            "The epic to start a session for. Accepts epic ID (UUID) or exact epic name."
          ),
        externalId: z
          .string()
          .optional()
          .describe(
            "Optional external session identifier (e.g., from Copilot or another AI tool)."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.startSession({
          epicId: input.epicId,
          externalId: input.externalId,
        });
        return createResponse(result.data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__end_session
  // ==========================================================================
  server.registerTool(
    "spectree__end_session",
    {
      description:
        "End the active AI session for an epic with handoff data. Records summary, next steps, " +
        "blockers, and decisions for the next session. Call this at the END of a work session.",
      inputSchema: {
        epicId: z
          .string()
          .describe(
            "The epic whose active session to end. Accepts epic ID (UUID) or exact epic name."
          ),
        summary: z
          .string()
          .describe("Summary of work completed during this session."),
        nextSteps: z
          .array(z.string())
          .optional()
          .describe("Recommended next actions for the successor session."),
        blockers: z
          .array(z.string())
          .optional()
          .describe("Blockers encountered during this session."),
        decisions: z
          .array(
            z.object({
              decision: z.string(),
              rationale: z.string().optional(),
            })
          )
          .optional()
          .describe("Key decisions made during this session with rationale."),
        contextBlob: z
          .string()
          .optional()
          .describe("Optional free-form context blob for the next session."),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.endSession(input.epicId, {
          summary: input.summary,
          nextSteps: input.nextSteps,
          blockers: input.blockers,
          decisions: input.decisions,
          contextBlob: input.contextBlob,
        });
        return createResponse(result.data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__get_active_session
  // ==========================================================================
  server.registerTool(
    "spectree__get_active_session",
    {
      description:
        "Check if there is an active AI session for an epic. Returns the session if active, or null.",
      inputSchema: {
        epicId: z
          .string()
          .describe(
            "The epic to check. Accepts epic ID (UUID) or exact epic name."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.getActiveSession(input.epicId);
        return createResponse(result?.data ?? null);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__get_last_session
  // ==========================================================================
  server.registerTool(
    "spectree__get_last_session",
    {
      description:
        "Get the last completed session for an epic. Returns previous session handoff data " +
        "without starting a new session. Use this to review what happened in the previous session.",
      inputSchema: {
        epicId: z
          .string()
          .describe(
            "The epic to query. Accepts epic ID (UUID) or exact epic name."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.getLastSession(input.epicId);
        return createResponse(result?.data ?? null);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__get_session_history
  // ==========================================================================
  server.registerTool(
    "spectree__get_session_history",
    {
      description:
        "Get the history of AI sessions for an epic. Returns past sessions ordered by most recent first.",
      inputSchema: {
        epicId: z
          .string()
          .describe(
            "The epic to query. Accepts epic ID (UUID) or exact epic name."
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Maximum number of sessions to return (default: 10, max: 100)."),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.getSessionHistory(
          input.epicId,
          input.limit
        );
        return createResponse(result.data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
