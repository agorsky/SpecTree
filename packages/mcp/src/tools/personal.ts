/**
 * MCP Tools for Personal Scope operations
 *
 * Provides tools for managing the user's personal scope, including:
 * - Getting personal scope information
 * - Listing and creating personal projects
 * - Listing personal statuses
 *
 * Personal scope is a private container for the user's personal work items
 * that are not shared with any team.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";

/**
 * Register all personal scope-related tools
 */
export function registerPersonalTools(server: McpServer): void {
  // ==========================================================================
  // spectree__get_personal_scope
  // ==========================================================================
  server.registerTool(
    "spectree__get_personal_scope",
    {
      description:
        "Get the authenticated user's personal scope information. " +
        "The personal scope is a private container for personal projects, features, " +
        "and tasks that are not shared with any team. " +
        "If the personal scope doesn't exist, it will be created automatically (lazy initialization). " +
        "Returns the personal scope ID and metadata.",
      inputSchema: {},
    },
    async () => {
      try {
        const apiClient = getApiClient();
        const { data: personalScope } = await apiClient.getPersonalScope();

        return createResponse({
          id: personalScope.id,
          userId: personalScope.userId,
          createdAt: personalScope.createdAt,
          updatedAt: personalScope.updatedAt,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return createErrorResponse(new Error("Authentication required to access personal scope"));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__list_personal_projects
  // ==========================================================================
  server.registerTool(
    "spectree__list_personal_projects",
    {
      description:
        "List all projects in the authenticated user's personal scope. " +
        "Personal projects are private and only visible to the owner. " +
        "Returns paginated results ordered by sort order then creation date (newest first). " +
        "Use this tool when the user wants to see their private/personal projects.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe(
            "Maximum number of projects to return per page (default: 20, max: 100). " +
            "Use with cursor for pagination through large result sets."
          ),
        cursor: z
          .string()
          .optional()
          .describe(
            "Pagination cursor from a previous response's meta.cursor field. " +
            "Pass this to fetch the next page of results."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.listPersonalProjects({
          limit: input.limit,
          cursor: input.cursor,
        });

        // Transform response to expected format
        const projects = result.data.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          icon: p.icon,
          color: p.color,
          sortOrder: p.sortOrder,
          isArchived: p.isArchived,
          scope: "personal" as const,
          personalScopeId: p.personalScopeId,
          featureCount: p._count?.features ?? 0,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }));

        return createResponse({
          projects,
          meta: result.meta,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return createErrorResponse(new Error("Authentication required to access personal projects"));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__create_personal_project
  // ==========================================================================
  server.registerTool(
    "spectree__create_personal_project",
    {
      description:
        "Create a new project in the authenticated user's personal scope. " +
        "Personal projects are private and only visible to the owner. " +
        "Unlike team projects, personal projects use the user's personal statuses. " +
        "Returns the created project with all metadata. " +
        "Use this when the user wants to create a private project not associated with any team.",
      inputSchema: {
        name: z
          .string()
          .min(1)
          .describe(
            "The display name for the project (required). Should be descriptive " +
            "(e.g., 'Personal Tasks', 'Side Project Ideas', 'Learning Goals')."
          ),
        description: z
          .string()
          .optional()
          .describe(
            "A longer description of the project's purpose and scope. " +
            "Supports plain text (e.g., 'My personal task tracking and notes')."
          ),
        icon: z
          .string()
          .optional()
          .describe(
            "An icon identifier for visual display (e.g., 'rocket', 'star', 'folder'). " +
            "Used in the UI to help identify the project at a glance."
          ),
        color: z
          .string()
          .optional()
          .describe(
            "A hex color code for the project's visual theme (e.g., '#FF5733', '#3B82F6'). " +
            "Used in the UI for project badges and highlights."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        const { data: project } = await apiClient.createPersonalProject({
          name: input.name,
          description: input.description,
          icon: input.icon,
          color: input.color,
        });

        const result = {
          id: project.id,
          name: project.name,
          description: project.description,
          icon: project.icon,
          color: project.color,
          sortOrder: project.sortOrder,
          isArchived: project.isArchived,
          scope: "personal" as const,
          personalScopeId: project.personalScopeId,
          featureCount: 0,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        };

        return createResponse(result);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return createErrorResponse(new Error("Authentication required to create personal project"));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__list_personal_statuses
  // ==========================================================================
  server.registerTool(
    "spectree__list_personal_statuses",
    {
      description:
        "List all workflow statuses in the authenticated user's personal scope. " +
        "Personal statuses are used for features and tasks in personal projects. " +
        "Returns statuses ordered by position. " +
        "Use this to discover available statuses before creating or updating features/tasks in personal projects.",
      inputSchema: {},
    },
    async () => {
      try {
        const apiClient = getApiClient();
        const { data: statuses } = await apiClient.listPersonalStatuses();

        return createResponse({
          statuses: statuses.map((s) => ({
            id: s.id,
            name: s.name,
            category: s.category,
            color: s.color,
            position: s.position,
            scope: "personal" as const,
          })),
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return createErrorResponse(new Error("Authentication required to access personal statuses"));
        }
        return createErrorResponse(error);
      }
    }
  );
}
