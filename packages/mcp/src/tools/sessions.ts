/**
 * MCP Tools for AI Session operations
 *
 * Provides tools for explicit session handoff between AI sessions,
 * preserving context and enabling continuity across sessions.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";

// Register all session tools
export function registerSessionTools(server: McpServer): void {
  // ==========================================================================
  // spectree__start_session
  // ==========================================================================
  server.registerTool(
    "spectree__start_session",
    {
      description:
        "Start a new AI session for an epic. Creates a session record, abandons any existing " +
        "active sessions, and returns handoff data from the previous session along with epic " +
        "progress. Use this at the beginning of working on an epic to receive context from " +
        "previous sessions.",
      inputSchema: {
        epicId: z
          .string()
          .describe(
            "The epic to work on. Accepts epic ID (UUID) or exact epic name."
          ),
        externalId: z
          .string()
          .max(255)
          .optional()
          .describe(
            "Optional external session identifier from the AI agent (e.g., Copilot session ID)."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const { data } = await apiClient.startSession({
          epicId: input.epicId,
          externalId: input.externalId,
        });

        // Format the response for AI consumption
        const response: Record<string, unknown> = {
          sessionId: data.session.id,
          epicId: data.session.epicId,
          startedAt: data.session.startedAt,
          epicProgress: data.epicProgress,
        };

        // Include previous session handoff if available
        if (data.previousSession) {
          response.previousSession = {
            id: data.previousSession.id,
            status: data.previousSession.status,
            endedAt: data.previousSession.endedAt,
            summary: data.previousSession.summary,
            nextSteps: data.previousSession.nextSteps,
            blockers: data.previousSession.blockers,
            decisions: data.previousSession.decisions,
            contextBlob: data.previousSession.contextBlob,
            itemsWorkedOn: data.previousSession.itemsWorkedOn,
          };
        }

        return createResponse(response);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Epic '${input.epicId}' not found`));
        }
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
        "End the current AI session for an epic with handoff data. Records a summary, " +
        "recommended next steps, blockers encountered, and decisions made. This data will " +
        "be provided to the next session that starts working on this epic.",
      inputSchema: {
        epicId: z
          .string()
          .describe(
            "The epic whose session to end. Accepts epic ID (UUID) or exact epic name."
          ),
        summary: z
          .string()
          .min(1)
          .max(10000)
          .describe(
            "A summary of work completed during this session. Be specific about what was " +
            "accomplished, any code changes made, and current state."
          ),
        nextSteps: z
          .array(z.string().max(1000))
          .max(20)
          .optional()
          .describe(
            "Recommended next actions for the successor session. Be specific and actionable."
          ),
        blockers: z
          .array(z.string().max(1000))
          .max(20)
          .optional()
          .describe(
            "Blockers encountered during this session that may still be relevant."
          ),
        decisions: z
          .array(
            z.object({
              decision: z.string().max(500),
              rationale: z.string().max(1000).optional(),
            })
          )
          .max(20)
          .optional()
          .describe(
            "Key decisions made during this session with optional rationale."
          ),
        contextBlob: z
          .string()
          .max(50000)
          .optional()
          .describe(
            "Serialized context blob for next session (JSON, markdown, or structured data). " +
            "Use for complex state that doesn't fit in summary/nextSteps."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const { data } = await apiClient.endSession(input.epicId, {
          summary: input.summary,
          nextSteps: input.nextSteps,
          blockers: input.blockers,
          decisions: input.decisions,
          contextBlob: input.contextBlob,
        });

        return createResponse({
          sessionId: data.id,
          status: data.status,
          startedAt: data.startedAt,
          endedAt: data.endedAt,
          message: "Session ended successfully. Handoff data recorded for next session.",
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(
            new Error(`Epic '${input.epicId}' not found or no active session exists`)
          );
        }
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
        "Get the last completed session for an epic. Returns the handoff data including " +
        "summary, next steps, blockers, and decisions. Use this to understand what was " +
        "done in the previous session without starting a new session.",
      inputSchema: {
        epicId: z
          .string()
          .describe(
            "The epic to get the last session for. Accepts epic ID (UUID) or exact epic name."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.getLastSession(input.epicId);

        if (!result) {
          return createResponse({
            found: false,
            message: "No completed sessions found for this epic.",
          });
        }

        return createResponse({
          found: true,
          session: {
            id: result.data.id,
            status: result.data.status,
            startedAt: result.data.startedAt,
            endedAt: result.data.endedAt,
            summary: result.data.summary,
            nextSteps: result.data.nextSteps,
            blockers: result.data.blockers,
            decisions: result.data.decisions,
            contextBlob: result.data.contextBlob,
            itemsWorkedOn: result.data.itemsWorkedOn,
          },
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Epic '${input.epicId}' not found`));
        }
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
        "Get the history of all sessions for an epic. Returns a list of sessions with " +
        "their summaries and status. Useful for understanding the full work history on an epic.",
      inputSchema: {
        epicId: z
          .string()
          .describe(
            "The epic to get session history for. Accepts epic ID (UUID) or exact epic name."
          ),
        limit: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe(
            "Maximum number of sessions to return. Default is 10."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const { data } = await apiClient.getSessionHistory(input.epicId, input.limit);

        return createResponse({
          total: data.total,
          sessions: data.sessions.map((s) => ({
            id: s.id,
            status: s.status,
            startedAt: s.startedAt,
            endedAt: s.endedAt,
            summary: s.summary,
            itemsWorkedOnCount: s.itemsWorkedOn.length,
          })),
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Epic '${input.epicId}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__log_session_work
  // ==========================================================================
  server.registerTool(
    "spectree__log_session_work",
    {
      description:
        "Log work done on a feature or task during the active session. This is called " +
        "automatically by other tools when items are updated, but can be called manually " +
        "to track work that doesn't involve status changes.",
      inputSchema: {
        epicId: z
          .string()
          .describe(
            "The epic containing the item. Accepts epic ID (UUID) or exact epic name."
          ),
        itemId: z
          .string()
          .uuid()
          .describe(
            "The UUID of the feature or task that was worked on."
          ),
        itemType: z
          .enum(["feature", "task"])
          .describe(
            "Whether this is a 'feature' or 'task'."
          ),
        identifier: z
          .string()
          .describe(
            "The human-readable identifier (e.g., 'COM-123' or 'COM-123-1')."
          ),
        action: z
          .string()
          .max(50)
          .describe(
            "The action performed (e.g., 'reviewed', 'investigated', 'discussed')."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.logSessionWork(input.epicId, {
          itemId: input.itemId,
          itemType: input.itemType,
          identifier: input.identifier,
          action: input.action,
        });

        if (!result) {
          return createResponse({
            logged: false,
            message: "No active session found for this epic. Work not logged.",
          });
        }

        return createResponse({
          logged: true,
          sessionId: result.data.id,
          itemsWorkedOnCount: result.data.itemsWorkedOn.length,
        });
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
        "Check if there is an active session for an epic. Returns session details if " +
        "one exists, null otherwise.",
      inputSchema: {
        epicId: z
          .string()
          .describe(
            "The epic to check for an active session. Accepts epic ID (UUID) or exact epic name."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.getActiveSession(input.epicId);

        if (!result) {
          return createResponse({
            hasActiveSession: false,
            message: "No active session for this epic.",
          });
        }

        return createResponse({
          hasActiveSession: true,
          session: {
            id: result.data.id,
            externalId: result.data.externalId,
            startedAt: result.data.startedAt,
            itemsWorkedOnCount: result.data.itemsWorkedOn.length,
          },
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Epic '${input.epicId}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );
}
