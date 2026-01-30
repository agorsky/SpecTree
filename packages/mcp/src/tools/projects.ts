/**
 * MCP Tools for Project operations
 *
 * Provides tools for listing, retrieving, and creating projects in SpecTree.
 * Uses HTTP API client for all operations.
 * 
 * Supports both team-scoped and personal-scoped projects via the scope parameter.
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
 * Helper to resolve team ID from name/key/id via API
 */
async function resolveTeamId(teamQuery: string): Promise<string | null> {
  const apiClient = getApiClient();
  const result = await apiClient.getTeam(teamQuery);
  return result?.data.id ?? null;
}

/**
 * Register all project-related tools
 */
export function registerProjectTools(server: McpServer): void {
  // ==========================================================================
  // spectree__list_projects
  // ==========================================================================
  server.registerTool(
    "spectree__list_projects",
    {
      description:
        "List projects in the user's SpecTree workspace. Returns paginated results " +
        "with project metadata including team information and feature counts. " +
        "Supports filtering by team, scope, and cursor-based pagination. Projects are " +
        "ordered by sort order then creation date (newest first). " +
        "Use scope='personal' to list only personal projects, scope='team' for team projects only, " +
        "or scope='all' (default) for all accessible projects.",
      inputSchema: {
        scope: z
          .enum(["personal", "team", "all"])
          .optional()
          .describe(
            "Filter by scope. 'personal' returns only projects in the user's personal scope, " +
            "'team' returns only team-scoped projects, 'all' (default) returns both. " +
            "When 'personal' is specified, the 'team' filter is ignored."
          ),
        team: z
          .string()
          .optional()
          .describe(
            "Filter by team. Accepts team ID (UUID), name, or key " +
            "(e.g., 'Engineering', 'ENG', or '550e8400-e29b-41d4-a716-446655440000'). " +
            "Only applies when scope is 'team' or 'all'."
          ),
        includeArchived: z
          .boolean()
          .optional()
          .describe(
            "Include archived projects in results. When false (default), only active " +
            "projects are returned. Set to true to see all projects including archived ones."
          ),
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
        const requestedScope = input.scope ?? "all";

        // Handle personal scope requests
        if (requestedScope === "personal") {
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
            team: null,
            featureCount: p._count?.features ?? 0,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          }));

          return createResponse({
            projects,
            meta: result.meta,
          });
        }

        // Handle team scope requests (team-only or all)
        let teamId: string | undefined;
        if (input.team) {
          const resolvedTeamId = await resolveTeamId(input.team);
          if (!resolvedTeamId) {
            throw new Error(`Team '${input.team}' not found`);
          }
          teamId = resolvedTeamId;
        }

        const teamResult = await apiClient.listProjects({
          team: teamId,
          includeArchived: input.includeArchived,
          limit: input.limit,
          cursor: input.cursor,
        });

        // Transform team projects
        const teamProjects = teamResult.data.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          icon: p.icon,
          color: p.color,
          sortOrder: p.sortOrder,
          isArchived: p.isArchived,
          scope: "team" as const,
          team: p.team,
          featureCount: p._count?.features ?? 0,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }));

        // For team-only scope, return just team projects
        if (requestedScope === "team") {
          return createResponse({
            projects: teamProjects,
            meta: teamResult.meta,
          });
        }

        // For "all" scope, also include personal projects
        // Note: This is a simplified implementation - in production you'd want
        // more sophisticated cursor handling for combined results
        const personalResult = await apiClient.listPersonalProjects({
          limit: input.limit,
        });

        const personalProjects = personalResult.data.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          icon: p.icon,
          color: p.color,
          sortOrder: p.sortOrder,
          isArchived: p.isArchived,
          scope: "personal" as const,
          personalScopeId: p.personalScopeId,
          team: null,
          featureCount: p._count?.features ?? 0,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }));

        // Combine and sort by creation date
        const allProjects = [...personalProjects, ...teamProjects].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Apply limit
        const limitedProjects = allProjects.slice(0, input.limit ?? 20);

        return createResponse({
          projects: limitedProjects,
          meta: {
            // For combined results, indicate if either source has more
            hasMore: teamResult.meta.hasMore || personalResult.meta.hasMore,
            cursor: teamResult.meta.cursor, // Use team cursor for pagination
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__get_project
  // ==========================================================================
  server.registerTool(
    "spectree__get_project",
    {
      description:
        "Get detailed information about a specific project by ID or name. " +
        "Returns the full project object including scope information (team or personal), metadata, " +
        "and a list of all features in the project. Features are ordered by " +
        "sort order then creation date (newest first). Only returns non-archived projects. " +
        "Works for both team-scoped and personal-scoped projects.",
      inputSchema: {
        query: z
          .string()
          .describe(
            "The project identifier to look up. Accepts either a UUID " +
            "(e.g., '550e8400-e29b-41d4-a716-446655440000') or an exact project name " +
            "(e.g., 'Mobile App Redesign'). Name matching is case-sensitive."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const { data: project } = await apiClient.getProject(input.query);

        // Fetch features for this project
        const featuresResult = await apiClient.listFeatures({
          projectId: project.id,
          limit: 100,
        });

        const result = {
          id: project.id,
          name: project.name,
          description: project.description,
          icon: project.icon,
          color: project.color,
          sortOrder: project.sortOrder,
          isArchived: project.isArchived,
          team: project.team,
          featureCount: project._count?.features ?? featuresResult.data.length,
          features: featuresResult.data.map((f) => ({
            id: f.id,
            identifier: f.identifier,
            title: f.title,
            description: f.description,
            statusId: f.statusId,
            assigneeId: f.assigneeId,
            sortOrder: f.sortOrder,
            createdAt: f.createdAt,
            updatedAt: f.updatedAt,
          })),
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        };

        return createResponse(result);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Project '${input.query}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__create_project
  // ==========================================================================
  server.registerTool(
    "spectree__create_project",
    {
      description:
        "Create a new team-scoped project in SpecTree. A project is a container for features " +
        "and must belong to a team. Returns the created project with all metadata " +
        "including the assigned team information and initial feature count (0). " +
        "For creating personal projects, use spectree__create_personal_project instead.",
      inputSchema: {
        name: z
          .string()
          .min(1)
          .describe(
            "The display name for the project (required). Should be descriptive " +
            "and unique within the team (e.g., 'Q1 2024 Features', 'Mobile App Redesign')."
          ),
        team: z
          .string()
          .describe(
            "The team to associate this project with (required). Accepts team ID (UUID), " +
            "name, or key (e.g., 'Engineering', 'ENG', or '550e8400-e29b-41d4-a716-446655440000'). " +
            "The team determines which statuses are available for features in this project."
          ),
        description: z
          .string()
          .optional()
          .describe(
            "A longer description of the project's purpose and scope. " +
            "Supports plain text (e.g., 'Features for the mobile app redesign initiative')."
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

        // Resolve team ID
        const teamId = await resolveTeamId(input.team);
        if (!teamId) {
          throw new Error(`Team '${input.team}' not found`);
        }

        const { data: project } = await apiClient.createProject({
          name: input.name,
          teamId,
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
          team: project.team,
          featureCount: 0,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        };

        return createResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
