/**
 * MCP Tools for Ordering/Reordering operations
 *
 * Provides tools for reordering projects, features, and tasks in SpecTree.
 * Enables AI agents to programmatically organize work items.
 * Uses HTTP API client for all operations.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../api-client.js";

/**
 * Create MCP-compliant response
 */
function createResponse(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Create MCP error response
 */
function createErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

/**
 * Register all ordering-related tools
 */
export function registerOrderingTools(server: McpServer): void {
  // ==========================================================================
  // spectree__reorder_project
  // ==========================================================================
  server.registerTool(
    "spectree__reorder_project",
    {
      description:
        "Reorder a project within its team's project list. Use this to change the " +
        "position of a project relative to other projects. Provide afterId to place " +
        "the project after another one, or beforeId to place it before another one, " +
        "or both to place it precisely between two projects. " +
        "Projects must belong to the same team.",
      inputSchema: {
        id: z
          .string()
          .uuid()
          .describe(
            "The UUID of the project to reorder."
          ),
        afterId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "The UUID of the project to place this project after. " +
            "If not provided, the project will be placed at the start (when used with beforeId) " +
            "or at the end (when neither is provided)."
          ),
        beforeId: z
          .string()
          .uuid()
          .optional()
          .describe(
            "The UUID of the project to place this project before. " +
            "If not provided, the project will be placed at the end (when used with afterId) " +
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

        const { data: project } = await apiClient.reorderProject(input.id, {
          afterId: input.afterId,
          beforeId: input.beforeId,
        });

        return createResponse({
          id: project.id,
          name: project.name,
          sortOrder: project.sortOrder,
          team: project.team,
          updatedAt: project.updatedAt,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404) {
            return createErrorResponse(new Error(`Project with id '${input.id}' not found`));
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
        "Reorder a feature within its project. Use this to change the position of " +
        "a feature relative to other features. Provide afterId to place the feature " +
        "after another one, or beforeId to place it before another one, or both to " +
        "place it precisely between two features. " +
        "Features must belong to the same project.",
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
