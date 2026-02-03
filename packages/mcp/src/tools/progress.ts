/**
 * MCP Tools for Progress Tracking
 *
 * Provides purpose-built tools for progress tracking that make status updates
 * natural and automatic for AI workflows. These tools help ensure AI sessions
 * properly track work progress without manual reminders.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";
import { addRemindersToResponse } from "./reminders.js";

// Register all progress tracking tools
export function registerProgressTools(server: McpServer): void {
  // ==========================================================================
  // spectree__start_work
  // ==========================================================================
  server.registerTool(
    "spectree__start_work",
    {
      description:
        "Begin working on a feature or task. This tool:\n" +
        "- Sets the status to 'In Progress'\n" +
        "- Records the start timestamp\n" +
        "- Logs an AI note about starting work\n\n" +
        "Use this at the beginning of working on any item to properly track timing and status.",
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
        sessionId: z
          .string()
          .max(255)
          .optional()
          .describe(
            "Optional identifier for this AI session. Helps track which session started the work."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        if (input.type === "feature") {
          // Resolve feature identifier to UUID if needed
          const { data: feature } = await apiClient.getFeature(input.id);
          const { data: result } = await apiClient.startFeatureWork(feature.id, {
            sessionId: input.sessionId,
          });
          return createResponse(result);
        } else {
          // Resolve task identifier to UUID if needed
          const { data: task } = await apiClient.getTask(input.id);
          const { data: result } = await apiClient.startTaskWork(task.id, {
            sessionId: input.sessionId,
          });
          return createResponse(result);
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
  // spectree__complete_work
  // ==========================================================================
  server.registerTool(
    "spectree__complete_work",
    {
      description:
        "Mark a feature or task as complete. This tool:\n" +
        "- Sets the status to 'Done'\n" +
        "- Records the completion timestamp\n" +
        "- Calculates and stores the duration (if started)\n" +
        "- Sets progress to 100%\n" +
        "- Clears any blocker reason\n" +
        "- Optionally logs a summary as an AI note\n\n" +
        "Use this when you've finished working on an item to properly close it out.",
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
        summary: z
          .string()
          .max(5000)
          .optional()
          .describe(
            "Optional summary of the work completed. Will be logged as an AI note for " +
            "future reference. Good for documenting what was done and any important decisions."
          ),
        sessionId: z
          .string()
          .max(255)
          .optional()
          .describe(
            "Optional identifier for this AI session."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        if (input.type === "feature") {
          // Resolve feature identifier to UUID if needed
          const { data: feature } = await apiClient.getFeature(input.id);
          const { data: result } = await apiClient.completeFeatureWork(feature.id, {
            summary: input.summary,
            sessionId: input.sessionId,
          });

          // Add contextual reminders
          const responseWithReminders = addRemindersToResponse(
            result as unknown as Record<string, unknown>,
            "complete_work",
            {
              id: feature.id,
              identifier: feature.identifier,
              type: "feature",
              hasActiveSession: true,
            }
          );
          return createResponse(responseWithReminders);
        } else {
          // Resolve task identifier to UUID if needed
          const { data: task } = await apiClient.getTask(input.id);
          const { data: result } = await apiClient.completeTaskWork(task.id, {
            summary: input.summary,
            sessionId: input.sessionId,
          });

          // Add contextual reminders
          const responseWithReminders = addRemindersToResponse(
            result as unknown as Record<string, unknown>,
            "complete_work",
            {
              id: task.id,
              identifier: task.identifier,
              type: "task",
              hasActiveSession: true,
            }
          );
          return createResponse(responseWithReminders);
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
  // spectree__log_progress
  // ==========================================================================
  server.registerTool(
    "spectree__log_progress",
    {
      description:
        "Log progress on a feature or task without changing its status. This tool:\n" +
        "- Appends a progress message to AI notes\n" +
        "- Optionally updates the percent complete (0-100)\n\n" +
        "Use this for long-running tasks to record incremental progress, decisions made, " +
        "or notable observations during work.",
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
        message: z
          .string()
          .min(1)
          .max(5000)
          .describe(
            "Progress message describing what has been done or the current state. " +
            "This will be logged as an AI note."
          ),
        percentComplete: z
          .number()
          .int()
          .min(0)
          .max(100)
          .optional()
          .describe(
            "Optional percentage (0-100) indicating overall completion. " +
            "Useful for tracking progress on multi-step work items."
          ),
        sessionId: z
          .string()
          .max(255)
          .optional()
          .describe(
            "Optional identifier for this AI session."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        if (input.type === "feature") {
          // Resolve feature identifier to UUID if needed
          const { data: feature } = await apiClient.getFeature(input.id);
          const { data: result } = await apiClient.logFeatureProgress(feature.id, {
            message: input.message,
            percentComplete: input.percentComplete,
            sessionId: input.sessionId,
          });
          return createResponse(result);
        } else {
          // Resolve task identifier to UUID if needed
          const { data: task } = await apiClient.getTask(input.id);
          const { data: result } = await apiClient.logTaskProgress(task.id, {
            message: input.message,
            percentComplete: input.percentComplete,
            sessionId: input.sessionId,
          });
          return createResponse(result);
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
  // spectree__report_blocker
  // ==========================================================================
  server.registerTool(
    "spectree__report_blocker",
    {
      description:
        "Report that a feature or task is blocked. This tool:\n" +
        "- Sets the status to 'Blocked' (if available)\n" +
        "- Records the blocker reason\n" +
        "- Optionally links to the blocking item\n" +
        "- Logs a blocker note for tracking\n\n" +
        "Use this when you encounter something preventing progress on an item.",
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
        reason: z
          .string()
          .min(1)
          .max(5000)
          .describe(
            "Description of what is blocking progress. Be specific about what needs " +
            "to happen to unblock."
          ),
        blockedById: z
          .string()
          .uuid()
          .optional()
          .describe(
            "Optional UUID of the feature or task that is blocking this item. " +
            "This creates a dependency relationship."
          ),
        sessionId: z
          .string()
          .max(255)
          .optional()
          .describe(
            "Optional identifier for this AI session."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        if (input.type === "feature") {
          // Resolve feature identifier to UUID if needed
          const { data: feature } = await apiClient.getFeature(input.id);
          const { data: result } = await apiClient.reportFeatureBlocker(feature.id, {
            reason: input.reason,
            blockedById: input.blockedById,
            sessionId: input.sessionId,
          });
          return createResponse(result);
        } else {
          // Resolve task identifier to UUID if needed
          const { data: task } = await apiClient.getTask(input.id);
          const { data: result } = await apiClient.reportTaskBlocker(task.id, {
            reason: input.reason,
            blockedById: input.blockedById,
            sessionId: input.sessionId,
          });
          return createResponse(result);
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
