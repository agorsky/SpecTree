/**
 * MCP Tools for Progress Summary
 *
 * Provides tools for quick project status orientation at session start.
 * Returns comprehensive summary information for AI consumption.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";

// Register all summary tools
export function registerSummaryTools(server: McpServer): void {
  // ==========================================================================
  // spectree__get_progress_summary
  // ==========================================================================
  server.registerTool(
    "spectree__get_progress_summary",
    {
      description:
        "Get comprehensive progress summary for an epic. Returns:\n" +
        "- Feature/task counts (total, completed, in-progress, blocked)\n" +
        "- Overall progress percentage and estimated remaining work\n" +
        "- All blocked items with reasons\n" +
        "- Next actionable items (ready to work on, sorted by execution order)\n" +
        "- Recently completed items\n" +
        "- Last session context (summary, next steps)\n\n" +
        "Use this at the START of a session to quickly understand project status " +
        "and what to work on next.",
      inputSchema: {
        epicId: z
          .string()
          .describe(
            "The epic to get progress summary for. Accepts epic ID (UUID) or exact epic name."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const { data: summary } = await apiClient.getProgressSummary(input.epicId);
        return createResponse(summary);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Epic '${input.epicId}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__get_my_work
  // ==========================================================================
  server.registerTool(
    "spectree__get_my_work",
    {
      description:
        "Get all work items assigned to the current user/session. Returns:\n" +
        "- Features and tasks assigned to you\n" +
        "- Status and progress information\n" +
        "- Sorted by: in-progress items first, then by execution order\n" +
        "- Counts of in-progress and blocked items\n\n" +
        "Use this to see your personal work queue across all epics.",
      inputSchema: {},
    },
    async () => {
      try {
        const apiClient = getApiClient();
        const { data: myWork } = await apiClient.getMyWork();
        return createResponse(myWork);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__get_blocked_summary
  // ==========================================================================
  server.registerTool(
    "spectree__get_blocked_summary",
    {
      description:
        "Get all blocked items across all accessible epics. Returns:\n" +
        "- All blocked features and tasks with blocker reasons\n" +
        "- Grouped by epic for easy navigation\n" +
        "- Total count of blocked items\n\n" +
        "Use this to identify bottlenecks and items that need attention.",
      inputSchema: {},
    },
    async () => {
      try {
        const apiClient = getApiClient();
        const { data: blocked } = await apiClient.getBlockedSummary();
        return createResponse(blocked);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
