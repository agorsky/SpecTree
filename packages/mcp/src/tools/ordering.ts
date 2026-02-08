/**
 * MCP Tools for Ordering/Reordering operations
 *
 * Provides tools for reordering epics, features, and tasks in SpecTree.
 * Enables AI agents to programmatically organize work items.
 * Uses HTTP API client for all operations.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";

/**
 * Register all ordering-related tools
 */
export function registerOrderingTools(server: McpServer): void {
  // ==========================================================================
  // spectree__reorder_item (COMPOSITE)
  // ==========================================================================
  server.registerTool(
    "spectree__reorder_item",
    {
      description:
        "Reorder epics, features, or tasks using a unified interface. " +
        "This composite tool consolidates 3 reordering operations into a single tool with action-based routing.\n\n" +
        "Actions:\n" +
        "- 'reorder_epic': Change position of an epic within its team\n" +
        "- 'reorder_feature': Change position of a feature within its epic\n" +
        "- 'reorder_task': Change position of a task within its feature\n\n" +
        "Use afterId, beforeId, or both to specify the new position. " +
        "At least one position reference is required.\n\n" +
        "Use this instead of the individual reorder tools for a more streamlined workflow.",
      inputSchema: z.discriminatedUnion("action", [
        z.object({
          action: z.literal("reorder_epic"),
          id: z.string().uuid().describe("UUID of the epic to reorder"),
          afterId: z.string().uuid().optional().describe("UUID of the epic to place this after"),
          beforeId: z.string().uuid().optional().describe("UUID of the epic to place this before"),
        }),
        z.object({
          action: z.literal("reorder_feature"),
          id: z.string().uuid().describe("UUID of the feature to reorder"),
          afterId: z.string().uuid().optional().describe("UUID of the feature to place this after"),
          beforeId: z.string().uuid().optional().describe("UUID of the feature to place this before"),
        }),
        z.object({
          action: z.literal("reorder_task"),
          id: z.string().uuid().describe("UUID of the task to reorder"),
          afterId: z.string().uuid().optional().describe("UUID of the task to place this after"),
          beforeId: z.string().uuid().optional().describe("UUID of the task to place this before"),
        }),
      ]),
    },
    async (input) => {
      try {
        // Validate that at least one position reference is provided
        if (!input.afterId && !input.beforeId) {
          return createErrorResponse(new Error("At least one of afterId or beforeId must be provided"));
        }

        const apiClient = getApiClient();

        // Route based on action
        switch (input.action) {
          case "reorder_epic": {
            const { data: epic } = await apiClient.reorderEpic(input.id, {
              afterId: input.afterId,
              beforeId: input.beforeId,
            });
            return createResponse({
              id: epic.id,
              name: epic.name,
              sortOrder: epic.sortOrder,
              team: epic.team,
              updatedAt: epic.updatedAt,
            });
          }

          case "reorder_feature": {
            const { data: feature } = await apiClient.reorderFeature(input.id, {
              afterId: input.afterId,
              beforeId: input.beforeId,
            });
            return createResponse({
              id: feature.id,
              identifier: feature.identifier,
              title: feature.title,
              sortOrder: feature.sortOrder,
              updatedAt: feature.updatedAt,
            });
          }

          case "reorder_task": {
            const { data: task } = await apiClient.reorderTask(input.id, {
              afterId: input.afterId,
              beforeId: input.beforeId,
            });
            return createResponse({
              id: task.id,
              identifier: task.identifier,
              title: task.title,
              sortOrder: task.sortOrder,
              updatedAt: task.updatedAt,
            });
          }
        }
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404) {
            return createErrorResponse(new Error(`${input.action.replace('reorder_', '')} with id '${input.id}' not found`));
          }
          if (error.status === 400) {
            const body = error.body as { message?: string } | undefined;
            return createErrorResponse(new Error(body?.message ?? "Invalid request"));
          }
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__reorder_epic
  // ==========================================================================
  server.registerTool(
    "spectree__reorder_epic",
    {
      description:
        "⚠️ DEPRECATED: Use spectree__reorder_item with action='reorder_epic' instead.\n\n" +
        "Reorder an epic within its team's epic list. Use this to change the " +
        "position of an epic relative to other epics. Provide afterId to place " +
        "the epic after another one, or beforeId to place it before another one, " +
        "or both to place it precisely between two epics. " +
        "Epics must belong to the same team.",
      inputSchema: {
        id: z
          .string()
          .uuid()
          .describe(
            "The UUID of the epic to reorder."
          ),
        afterId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "The UUID of the epic to place this epic after. " +
            "If not provided, the epic will be placed at the start (when used with beforeId) " +
            "or at the end (when neither is provided)."
          ),
        beforeId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "The UUID of the epic to place this epic before. " +
            "If not provided, the epic will be placed at the end (when used with afterId) " +
            "or at the start (when neither is provided)."
          ),
      },
    },
    async (input) => {
      try {
        // Validate that at least one position reference is provided
        if (!input.afterId && !input.beforeId) {
          return createErrorResponse(new Error("At least one of afterId or beforeId must be provided"));
        }

        const apiClient = getApiClient();

        const { data: epic } = await apiClient.reorderEpic(input.id, {
          afterId: input.afterId,
          beforeId: input.beforeId,
        });

        return createResponse({
          id: epic.id,
          name: epic.name,
          sortOrder: epic.sortOrder,
          team: epic.team,
          updatedAt: epic.updatedAt,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404) {
            return createErrorResponse(new Error(`Epic with id '${input.id}' not found`));
          }
          if (error.status === 400) {
            const body = error.body as { message?: string } | undefined;
            return createErrorResponse(new Error(body?.message ?? "Invalid request"));
          }
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__reorder_feature
  // ==========================================================================
  server.registerTool(
    "spectree__reorder_feature",
    {
      description:
        "⚠️ DEPRECATED: Use spectree__reorder_item with action='reorder_feature' instead.\n\n" +
        "Reorder a feature within its epic. Use this to change the position of " +
        "a feature relative to other features. Provide afterId to place the feature " +
        "after another one, or beforeId to place it before another one, or both to " +
        "place it precisely between two features. " +
        "Features must belong to the same epic.",
      inputSchema: {
        id: z
          .string()
          .uuid()
          .describe(
            "The UUID of the feature to reorder."
          ),
        afterId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "The UUID of the feature to place this feature after. " +
            "If not provided, the feature will be placed at the start (when used with beforeId) " +
            "or at the end (when neither is provided)."
          ),
        beforeId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "The UUID of the feature to place this feature before. " +
            "If not provided, the feature will be placed at the end (when used with afterId) " +
            "or at the start (when neither is provided)."
          ),
      },
    },
    async (input) => {
      try {
        // Validate that at least one position reference is provided
        if (!input.afterId && !input.beforeId) {
          return createErrorResponse(new Error("At least one of afterId or beforeId must be provided"));
        }

        const apiClient = getApiClient();

        const { data: feature } = await apiClient.reorderFeature(input.id, {
          afterId: input.afterId,
          beforeId: input.beforeId,
        });

        return createResponse({
          id: feature.id,
          identifier: feature.identifier,
          title: feature.title,
          sortOrder: feature.sortOrder,
          updatedAt: feature.updatedAt,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404) {
            return createErrorResponse(new Error(`Feature with id '${input.id}' not found`));
          }
          if (error.status === 400) {
            const body = error.body as { message?: string } | undefined;
            return createErrorResponse(new Error(body?.message ?? "Invalid request"));
          }
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__reorder_task
  // ==========================================================================
  server.registerTool(
    "spectree__reorder_task",
    {
      description:
        "⚠️ DEPRECATED: Use spectree__reorder_item with action='reorder_task' instead.\n\n" +
        "Reorder a task within its parent feature. Use this to change the position " +
        "of a task relative to other tasks. Provide afterId to place the task after " +
        "another one, or beforeId to place it before another one, or both to place " +
        "it precisely between two tasks. " +
        "Tasks must belong to the same feature.",
      inputSchema: {
        id: z
          .string()
          .uuid()
          .describe(
            "The UUID of the task to reorder."
          ),
        afterId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "The UUID of the task to place this task after. " +
            "If not provided, the task will be placed at the start (when used with beforeId) " +
            "or at the end (when neither is provided)."
          ),
        beforeId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "The UUID of the task to place this task before. " +
            "If not provided, the task will be placed at the end (when used with afterId) " +
            "or at the start (when neither is provided)."
          ),
      },
    },
    async (input) => {
      try {
        // Validate that at least one position reference is provided
        if (!input.afterId && !input.beforeId) {
          return createErrorResponse(new Error("At least one of afterId or beforeId must be provided"));
        }

        const apiClient = getApiClient();

        const { data: task } = await apiClient.reorderTask(input.id, {
          afterId: input.afterId,
          beforeId: input.beforeId,
        });

        return createResponse({
          id: task.id,
          identifier: task.identifier,
          title: task.title,
          sortOrder: task.sortOrder,
          updatedAt: task.updatedAt,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404) {
            return createErrorResponse(new Error(`Task with id '${input.id}' not found`));
          }
          if (error.status === 400) {
            const body = error.body as { message?: string } | undefined;
            return createErrorResponse(new Error(body?.message ?? "Invalid request"));
          }
        }
        return createErrorResponse(error);
      }
    }
  );
}
