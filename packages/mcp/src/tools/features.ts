/**
 * MCP Tools for Feature operations
 *
 * Provides tools for listing, getting, creating, and updating features
 * in the SpecTree application.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  featureService,
  userService,
  prisma,
  NotFoundError,
} from "@spectree/api/src/services/index.js";
import { isValidUUID } from "../utils.js";

/**
 * Helper to resolve "me" assignee value to actual user ID
 */
async function resolveAssigneeId(
  assignee: string | undefined
): Promise<string | undefined> {
  if (!assignee) return undefined;

  if (assignee.toLowerCase() === "me") {
    const currentUser = await userService.getCurrentUser();
    if (!currentUser) {
      throw new Error("No current user context available to resolve 'me'");
    }
    return currentUser.id;
  }

  return assignee;
}

/**
 * Helper to resolve project name/ID to project ID
 */
async function resolveProjectId(project: string): Promise<string> {
  // First try to find by ID (UUID) - only if it's a valid UUID format
  if (isValidUUID(project)) {
    const projectById = await prisma.project.findUnique({
      where: { id: project },
      select: { id: true },
    });

    if (projectById) return projectById.id;
  }

  // Try to find by name
  const projectByName = await prisma.project.findFirst({
    where: { name: project, isArchived: false },
    select: { id: true },
  });

  if (projectByName) return projectByName.id;

  throw new NotFoundError(`Project '${project}' not found`);
}

/**
 * Helper to resolve status name/ID to status ID
 */
async function resolveStatusId(
  status: string,
  teamId?: string
): Promise<string> {
  // First try to find by ID (UUID) - only if it's a valid UUID format
  if (isValidUUID(status)) {
    const statusById = await prisma.status.findUnique({
      where: { id: status },
      select: { id: true },
    });

    if (statusById) return statusById.id;
  }

  // Try to find by name (optionally scoped to team)
  const statusByName = await prisma.status.findFirst({
    where: {
      name: status,
      ...(teamId ? { teamId } : {}),
    },
    select: { id: true },
  });

  if (statusByName) return statusByName.id;

  throw new NotFoundError(`Status '${status}' not found`);
}

/**
 * Helper to get feature by ID or identifier (e.g., COM-123)
 */
async function getFeatureByIdOrIdentifier(id: string) {
  // Check if this looks like a UUID
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (uuidRegex.test(id)) {
    return featureService.getFeatureById(id);
  }

  // Try to find by identifier (e.g., COM-123)
  const feature = await prisma.feature.findUnique({
    where: { identifier: id },
    include: {
      tasks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      },
    },
  });

  return feature;
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

// Register all feature tools
export function registerFeatureTools(server: McpServer): void {
  // ==========================================================================
  // spectree__list_features
  // ==========================================================================
  server.registerTool(
    "spectree__list_features",
    {
      description:
        "List features in SpecTree with optional filtering by project, status, assignee, " +
        "or search query. Returns paginated results ordered by sort order then creation date " +
        "(newest first). Features are the primary work items in SpecTree, similar to issues " +
        "in other project management tools. Each feature has an auto-generated identifier " +
        "(e.g., 'COM-123') based on its team key.",
      inputSchema: {
        project: z
          .string()
          .optional()
          .describe(
            "Filter by project. Accepts project ID (UUID) or exact project name " +
            "(e.g., 'Mobile App Redesign' or '550e8400-e29b-41d4-a716-446655440000'). " +
            "Name matching is case-sensitive."
          ),
        status: z
          .string()
          .optional()
          .describe(
            "Filter by status. Accepts status ID (UUID) or exact status name " +
            "(e.g., 'In Progress', 'Done'). Status names are team-specific."
          ),
        assignee: z
          .string()
          .optional()
          .describe(
            "Filter by assignee. Accepts user ID (UUID) or the special value 'me' " +
            "to filter by the current authenticated user. Use 'me' for 'my features' queries."
          ),
        query: z
          .string()
          .optional()
          .describe(
            "Search query to filter features by title (case-insensitive substring match). " +
            "For example, 'login' will match 'User Login Flow' and 'Login Page Redesign'."
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe(
            "Maximum number of features to return per page (default: 20, max: 100). " +
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
        // Resolve project ID if provided
        let projectId: string | undefined;
        if (input.project) {
          projectId = await resolveProjectId(input.project);
        }

        // Resolve assignee ID if provided
        const assigneeId = await resolveAssigneeId(input.assignee);

        // Resolve status ID if provided
        let statusId: string | undefined;
        if (input.status) {
          statusId = await resolveStatusId(input.status);
        }

        // List features with filters
        const result = await featureService.listFeatures({
          projectId,
          statusId,
          assigneeId,
          limit: input.limit,
          cursor: input.cursor,
        });

        // If query is provided, filter results by title (client-side filtering)
        // Note: For production, this should be done at the database level
        let features = result.data;
        if (input.query) {
          const queryLower = input.query.toLowerCase();
          features = features.filter((f) =>
            f.title.toLowerCase().includes(queryLower)
          );
        }

        return createResponse({
          features,
          meta: result.meta,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__get_feature
  // ==========================================================================
  server.registerTool(
    "spectree__get_feature",
    {
      description:
        "Get detailed information about a specific feature by ID or identifier. " +
        "Returns the full feature object including all metadata and a list of all " +
        "tasks (sub-issues) associated with the feature. Tasks are ordered by sort " +
        "order then creation date (newest first).",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature identifier to look up. Accepts either a UUID " +
            "(e.g., '550e8400-e29b-41d4-a716-446655440000') or a human-readable identifier " +
            "(e.g., 'COM-123'). The identifier format is '{TEAM_KEY}-{NUMBER}'."
          ),
      },
    },
    async (input) => {
      try {
        const feature = await getFeatureByIdOrIdentifier(input.id);

        if (!feature) {
          throw new NotFoundError(`Feature '${input.id}' not found`);
        }

        return createResponse(feature);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__create_feature
  // ==========================================================================
  server.registerTool(
    "spectree__create_feature",
    {
      description:
        "Create a new feature in a project. Features are the primary work items in SpecTree. " +
        "Each feature is automatically assigned a unique identifier based on the project's " +
        "team key (e.g., if the team key is 'COM', the feature might be 'COM-123'). " +
        "Returns the created feature with all metadata including the generated identifier.",
      inputSchema: {
        title: z
          .string()
          .min(1)
          .describe(
            "The title of the feature (required). Should be a concise description of the work " +
            "(e.g., 'User Authentication Flow', 'Add Dark Mode Support')."
          ),
        project: z
          .string()
          .describe(
            "The project to add this feature to (required). Accepts project ID (UUID) or " +
            "exact project name (e.g., 'Mobile App Redesign'). The project's team determines " +
            "the identifier prefix and available statuses."
          ),
        description: z
          .string()
          .optional()
          .describe(
            "A detailed description of the feature in Markdown format. Can include requirements, " +
            "acceptance criteria, technical notes, etc. Supports full Markdown syntax."
          ),
        status: z
          .string()
          .optional()
          .describe(
            "Initial status for the feature. Accepts status ID (UUID) or exact status name " +
            "(e.g., 'Backlog', 'In Progress'). If not provided, the feature is created without a status. " +
            "Status names are resolved within the project's team context."
          ),
        assignee: z
          .string()
          .optional()
          .describe(
            "User to assign this feature to. Accepts user ID (UUID) or the special value 'me' " +
            "to assign to the current authenticated user. If not provided, the feature is unassigned."
          ),
      },
    },
    async (input) => {
      try {
        // Resolve project ID
        const projectId = await resolveProjectId(input.project);

        // Resolve assignee ID if provided
        const assigneeId = await resolveAssigneeId(input.assignee);

        // Resolve status ID if provided
        let statusId: string | undefined;
        if (input.status) {
          // Get the project to find its team for status resolution
          const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { teamId: true },
          });
          if (project) {
            statusId = await resolveStatusId(input.status, project.teamId);
          }
        }

        // Create the feature
        const feature = await featureService.createFeature({
          title: input.title,
          projectId,
          description: input.description,
          statusId,
          assigneeId,
        });

        return createResponse(feature);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__update_feature
  // ==========================================================================
  server.registerTool(
    "spectree__update_feature",
    {
      description:
        "Update an existing feature. Only the fields you provide will be updated; " +
        "omitted fields retain their current values. Returns the updated feature with " +
        "all current field values. Use this to change status, reassign, or modify content.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature to update (required). Accepts either a UUID " +
            "(e.g., '550e8400-e29b-41d4-a716-446655440000') or a human-readable identifier " +
            "(e.g., 'COM-123')."
          ),
        title: z
          .string()
          .min(1)
          .optional()
          .describe(
            "New title for the feature. Only provide if you want to change the title " +
            "(e.g., 'Updated: User Authentication Flow')."
          ),
        description: z
          .string()
          .optional()
          .describe(
            "New description in Markdown format. Replaces the entire description; " +
            "there is no append mode. Supports full Markdown syntax."
          ),
        status: z
          .string()
          .optional()
          .describe(
            "New status for the feature. Accepts status ID (UUID) or exact status name " +
            "(e.g., 'In Progress', 'Done'). Status names are resolved within the feature's " +
            "team context."
          ),
        assignee: z
          .string()
          .optional()
          .describe(
            "New assignee for the feature. Accepts user ID (UUID) or the special value 'me' " +
            "to assign to the current authenticated user."
          ),
      },
    },
    async (input) => {
      try {
        // First, find the feature to get its UUID
        const existingFeature = await getFeatureByIdOrIdentifier(input.id);
        if (!existingFeature) {
          throw new NotFoundError(`Feature '${input.id}' not found`);
        }

        // Resolve assignee ID if provided
        const assigneeId = await resolveAssigneeId(input.assignee);

        // Resolve status ID if provided
        let statusId: string | undefined;
        if (input.status) {
          // Get the project to find its team for status resolution
          const project = await prisma.project.findUnique({
            where: { id: existingFeature.projectId },
            select: { teamId: true },
          });
          if (project) {
            statusId = await resolveStatusId(input.status, project.teamId);
          }
        }

        // Update the feature
        const feature = await featureService.updateFeature(existingFeature.id, {
          title: input.title,
          description: input.description,
          statusId,
          assigneeId,
        });

        return createResponse(feature);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
