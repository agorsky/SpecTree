/**
 * MCP Tools for Project operations
 *
 * Provides tools for listing, retrieving, and creating projects in SpecTree.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  projectService,
  prisma,
  NotFoundError,
} from "@spectree/api/src/services/index.js";
import { isValidUUID } from "../utils.js";

/**
 * Helper to resolve team identifier (ID, name, or key) to team ID
 */
async function resolveTeamId(teamQuery: string): Promise<string | null> {
  // First try to find by ID (UUID) - only if it's a valid UUID format
  if (isValidUUID(teamQuery)) {
    const teamById = await prisma.team.findUnique({
      where: { id: teamQuery },
      select: { id: true, isArchived: true },
    });
    if (teamById && !teamById.isArchived) {
      return teamById.id;
    }
  }

  // Then try to find by name (exact match, case-sensitive)
  const teamByName = await prisma.team.findFirst({
    where: {
      name: teamQuery,
      isArchived: false,
    },
    select: { id: true },
  });
  if (teamByName) {
    return teamByName.id;
  }

  // Also try by key (exact match)
  const teamByKey = await prisma.team.findFirst({
    where: {
      key: teamQuery,
      isArchived: false,
    },
    select: { id: true },
  });
  if (teamByKey) {
    return teamByKey.id;
  }

  return null;
}

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
        "Supports filtering by team and cursor-based pagination. Projects are " +
        "ordered by sort order then creation date (newest first).",
      inputSchema: {
        team: z
          .string()
          .optional()
          .describe(
            "Filter by team. Accepts team ID (UUID), name, or key " +
            "(e.g., 'Engineering', 'ENG', or '550e8400-e29b-41d4-a716-446655440000')"
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
        // Resolve team if provided
        let teamId: string | undefined;
        if (input.team) {
          const resolvedTeamId = await resolveTeamId(input.team);
          if (!resolvedTeamId) {
            throw new NotFoundError(`Team '${input.team}' not found`);
          }
          teamId = resolvedTeamId;
        }

        // Query directly if includeArchived is true (service doesn't support this yet)
        if (input.includeArchived) {
          const limit = Math.min(100, Math.max(1, input.limit ?? 20));
          const whereClause: { teamId?: string } = {};
          if (teamId) {
            whereClause.teamId = teamId;
          }

          const projects = await prisma.project.findMany({
            take: limit + 1,
            ...(input.cursor ? { cursor: { id: input.cursor } } : {}),
            where: whereClause,
            orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
            include: {
              _count: { select: { features: true } },
              team: { select: { id: true, name: true, key: true } },
            },
          });

          const hasMore = projects.length > limit;
          if (hasMore) {
            projects.pop();
          }

          const lastProject = projects.at(-1);
          const nextCursor = hasMore && lastProject ? lastProject.id : null;

          const result = {
            projects: projects.map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              icon: p.icon,
              color: p.color,
              sortOrder: p.sortOrder,
              isArchived: p.isArchived,
              team: p.team,
              featureCount: p._count.features,
              createdAt: p.createdAt.toISOString(),
              updatedAt: p.updatedAt.toISOString(),
            })),
            meta: {
              cursor: nextCursor,
              hasMore,
            },
          };

          return createResponse(result);
        }

        // Use the service for non-archived projects
        const result = await projectService.listProjects({
          cursor: input.cursor,
          limit: input.limit,
          teamId,
        });

        // Fetch team info for each project
        const projectsWithTeam = await Promise.all(
          result.data.map(async (p) => {
            const team = await prisma.team.findUnique({
              where: { id: p.teamId },
              select: { id: true, name: true, key: true },
            });
            return {
              id: p.id,
              name: p.name,
              description: p.description,
              icon: p.icon,
              color: p.color,
              sortOrder: p.sortOrder,
              isArchived: p.isArchived,
              team,
              featureCount: p._count.features,
              createdAt: p.createdAt.toISOString(),
              updatedAt: p.updatedAt.toISOString(),
            };
          })
        );

        return createResponse({
          projects: projectsWithTeam,
          meta: result.meta,
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
        "Returns the full project object including team information, metadata, " +
        "and a list of all features in the project. Features are ordered by " +
        "sort order then creation date (newest first). Only returns non-archived projects.",
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
        // First try to find by ID (UUID)
        let project = await prisma.project.findUnique({
          where: { id: input.query, isArchived: false },
          include: {
            _count: { select: { features: true } },
            team: { select: { id: true, name: true, key: true } },
            features: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
              select: {
                id: true,
                identifier: true,
                title: true,
                description: true,
                statusId: true,
                assigneeId: true,
                sortOrder: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        });

        // If not found by ID, try by name (exact match)
        project ??= await prisma.project.findFirst({
            where: {
              name: input.query,
              isArchived: false,
            },
            include: {
              _count: { select: { features: true } },
              team: { select: { id: true, name: true, key: true } },
              features: {
                orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
                select: {
                  id: true,
                  identifier: true,
                  title: true,
                  description: true,
                  statusId: true,
                  assigneeId: true,
                  sortOrder: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          });

        if (!project) {
          throw new NotFoundError(`Project '${input.query}' not found`);
        }

        const result = {
          id: project.id,
          name: project.name,
          description: project.description,
          icon: project.icon,
          color: project.color,
          sortOrder: project.sortOrder,
          isArchived: project.isArchived,
          team: project.team,
          featureCount: project._count.features,
          features: project.features.map((f) => ({
            id: f.id,
            identifier: f.identifier,
            title: f.title,
            description: f.description,
            statusId: f.statusId,
            assigneeId: f.assigneeId,
            sortOrder: f.sortOrder,
            createdAt: f.createdAt.toISOString(),
            updatedAt: f.updatedAt.toISOString(),
          })),
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
        };

        return createResponse(result);
      } catch (error) {
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
        "Create a new project in SpecTree. A project is a container for features " +
        "and must belong to a team. Returns the created project with all metadata " +
        "including the assigned team information and initial feature count (0).",
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
        // Resolve team
        const teamId = await resolveTeamId(input.team);
        if (!teamId) {
          throw new NotFoundError(`Team '${input.team}' not found`);
        }

        // Create the project using the service
        const project = await projectService.createProject({
          name: input.name,
          teamId,
          description: input.description,
          icon: input.icon,
          color: input.color,
        });

        // Fetch the team info for the response
        const team = await prisma.team.findUnique({
          where: { id: teamId },
          select: { id: true, name: true, key: true },
        });

        const result = {
          id: project.id,
          name: project.name,
          description: project.description,
          icon: project.icon,
          color: project.color,
          sortOrder: project.sortOrder,
          isArchived: project.isArchived,
          team,
          featureCount: 0,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
        };

        return createResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
