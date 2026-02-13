/**
 * MCP Tools for Epic operations
 *
 * Provides tools for listing, retrieving, and creating epics in SpecTree.
 * Uses HTTP API client for all operations.
 * 
 * Supports both team-scoped and personal-scoped epics via the scope parameter.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";

/**
 * Helper to resolve team ID from name/key/id via API
 */
async function resolveTeamId(teamQuery: string): Promise<string | null> {
  const apiClient = getApiClient();
  const result = await apiClient.getTeam(teamQuery);
  return result?.data.id ?? null;
}

/**
 * Register all epic-related tools
 */
export function registerEpicTools(server: McpServer): void {
  // ==========================================================================
  // spectree__list_epics
  // ==========================================================================
  server.registerTool(
    "spectree__list_epics",
    {
      description:
        "List epics in the user's SpecTree workspace. Returns paginated results " +
        "with epic metadata including team information and feature counts. " +
        "Supports filtering by team, scope, and cursor-based pagination. Epics are " +
        "ordered by sort order then creation date (newest first). " +
        "Use scope='personal' to list only personal epics, scope='team' for team epics only, " +
        "or scope='all' (default) for all accessible epics.",
      inputSchema: {
        scope: z
          .enum(["personal", "team", "all"])
          .optional()
          .describe(
            "Filter by scope. 'personal' returns only epics in the user's personal scope, " +
            "'team' returns only team-scoped epics, 'all' (default) returns both. " +
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
            "Include archived epics in results. When false (default), only active " +
            "epics are returned. Set to true to see all epics including archived ones."
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe(
            "Maximum number of epics to return per page (default: 20, max: 100). " +
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
          const result = await apiClient.listPersonalEpics({
            limit: input.limit,
            cursor: input.cursor,
          });

          // Transform response to expected format
          const epics = result.data.map((e) => ({
            id: e.id,
            name: e.name,
            description: e.description,
            icon: e.icon,
            color: e.color,
            sortOrder: e.sortOrder,
            isArchived: e.isArchived,
            scope: "personal" as const,
            personalScopeId: e.personalScopeId,
            team: null,
            featureCount: e._count?.features ?? 0,
            createdAt: e.createdAt,
            updatedAt: e.updatedAt,
            // Attribution fields
            createdBy: e.createdBy ?? null,
            creator: e.creator ?? null,
            implementedBy: e.implementedBy ?? null,
            implementer: e.implementer ?? null,
            implementedDate: e.implementedDate ?? null,
          }));

          return createResponse({
            epics,
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

        const teamResult = await apiClient.listEpics({
          team: teamId,
          includeArchived: input.includeArchived,
          limit: input.limit,
          cursor: input.cursor,
        });

        // Transform team epics
        const teamEpics = teamResult.data.map((e) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          icon: e.icon,
          color: e.color,
          sortOrder: e.sortOrder,
          isArchived: e.isArchived,
          scope: "team" as const,
          team: e.team,
          featureCount: e._count?.features ?? 0,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
          // Attribution fields
          createdBy: e.createdBy ?? null,
          creator: e.creator ?? null,
          implementedBy: e.implementedBy ?? null,
          implementer: e.implementer ?? null,
          implementedDate: e.implementedDate ?? null,
        }));

        // For team-only scope, return just team epics
        if (requestedScope === "team") {
          return createResponse({
            epics: teamEpics,
            meta: teamResult.meta,
          });
        }

        // For "all" scope, also include personal epics
        // Note: This is a simplified implementation - in production you'd want
        // more sophisticated cursor handling for combined results
        const personalResult = await apiClient.listPersonalEpics({
          limit: input.limit,
        });

        const personalEpics = personalResult.data.map((e) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          icon: e.icon,
          color: e.color,
          sortOrder: e.sortOrder,
          isArchived: e.isArchived,
          scope: "personal" as const,
          personalScopeId: e.personalScopeId,
          team: null,
          featureCount: e._count?.features ?? 0,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
          // Attribution fields
          createdBy: e.createdBy ?? null,
          creator: e.creator ?? null,
          implementedBy: e.implementedBy ?? null,
          implementer: e.implementer ?? null,
          implementedDate: e.implementedDate ?? null,
        }));

        // Combine and sort by creation date
        const allEpics = [...personalEpics, ...teamEpics].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Apply limit
        const limitedEpics = allEpics.slice(0, input.limit ?? 20);

        return createResponse({
          epics: limitedEpics,
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
  // spectree__get_epic
  // ==========================================================================
  server.registerTool(
    "spectree__get_epic",
    {
      description:
        "Get detailed information about a specific epic by ID or name. " +
        "Returns the full epic object including scope information (team or personal), metadata, " +
        "and a list of all features in the epic. Features are ordered by " +
        "sort order then creation date (newest first). Only returns non-archived epics. " +
        "Works for both team-scoped and personal-scoped epics.",
      inputSchema: {
        query: z
          .string()
          .describe(
            "The epic identifier to look up. Accepts either a UUID " +
            "(e.g., '550e8400-e29b-41d4-a716-446655440000') or an exact epic name " +
            "(e.g., 'Mobile App Redesign'). Name matching is case-sensitive."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const { data: epic } = await apiClient.getEpic(input.query);

        // Fetch features for this epic
        const featuresResult = await apiClient.listFeatures({
          epicId: epic.id,
          limit: 100,
        });

        const result = {
          id: epic.id,
          name: epic.name,
          description: epic.description,
          icon: epic.icon,
          color: epic.color,
          sortOrder: epic.sortOrder,
          isArchived: epic.isArchived,
          team: epic.team,
          featureCount: epic._count?.features ?? featuresResult.data.length,
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
          createdAt: epic.createdAt,
          updatedAt: epic.updatedAt,
          // Attribution fields
          createdBy: epic.createdBy ?? null,
          creator: epic.creator ?? null,
          implementedBy: epic.implementedBy ?? null,
          implementer: epic.implementer ?? null,
          implementedDate: epic.implementedDate ?? null,
        };

        return createResponse(result);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Epic '${input.query}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__create_epic
  // ==========================================================================
  server.registerTool(
    "spectree__create_epic",
    {
      description:
        "Create a new epic in SpecTree. An epic is a container for features " +
        "and must belong to a team. Returns the created epic with all metadata " +
        "including the assigned team information and initial feature count (0). " +
        "For creating personal epics, use spectree__create_personal_epic instead.",
      inputSchema: {
        name: z
          .string()
          .min(1)
          .describe(
            "The display name for the epic (required). Should be descriptive " +
            "and unique within the team (e.g., 'Q1 2024 Features', 'Mobile App Redesign')."
          ),
        team: z
          .string()
          .describe(
            "The team to associate this epic with (required). Accepts team ID (UUID), " +
            "name, or key (e.g., 'Engineering', 'ENG', or '550e8400-e29b-41d4-a716-446655440000'). " +
            "The team determines which statuses are available for features in this epic."
          ),
        description: z
          .string()
          .optional()
          .describe(
            "A longer description of the epic's purpose and scope. " +
            "Supports plain text (e.g., 'Features for the mobile app redesign initiative')."
          ),
        icon: z
          .string()
          .optional()
          .describe(
            "An icon identifier for visual display (e.g., 'rocket', 'star', 'folder'). " +
            "Used in the UI to help identify the epic at a glance."
          ),
        color: z
          .string()
          .optional()
          .describe(
            "A hex color code for the epic's visual theme (e.g., '#FF5733', '#3B82F6'). " +
            "Used in the UI for epic badges and highlights."
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

        const { data: epic } = await apiClient.createEpic({
          name: input.name,
          teamId,
          description: input.description,
          icon: input.icon,
          color: input.color,
        });

        const result = {
          id: epic.id,
          name: epic.name,
          description: epic.description,
          icon: epic.icon,
          color: epic.color,
          sortOrder: epic.sortOrder,
          isArchived: epic.isArchived,
          team: epic.team,
          featureCount: 0,
          createdAt: epic.createdAt,
          updatedAt: epic.updatedAt,
          // Attribution fields
          createdBy: epic.createdBy ?? null,
          creator: epic.creator ?? null,
          implementedBy: epic.implementedBy ?? null,
          implementer: epic.implementer ?? null,
          implementedDate: epic.implementedDate ?? null,
        };

        return createResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__update_epic
  // ==========================================================================
  server.registerTool(
    "spectree__update_epic",
    {
      description:
        "Update an existing epic. Only the fields you provide will be updated; " +
        "omitted fields retain their current values. Returns the updated epic " +
        "with all current field values. Use this to change the name, description, " +
        "icon, or color of an epic.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The epic to update (required). Accepts either a UUID " +
            "(e.g., '550e8400-e29b-41d4-a716-446655440000') or an exact epic name " +
            "(e.g., 'Mobile App Redesign'). Name matching is case-sensitive."
          ),
        name: z
          .string()
          .min(1)
          .optional()
          .describe(
            "New name for the epic. Only provide if you want to change the name."
          ),
        description: z
          .string()
          .optional()
          .describe(
            "New description for the epic in Markdown format. Replaces the entire " +
            "description; there is no append mode. Supports full Markdown syntax."
          ),
        icon: z
          .string()
          .optional()
          .describe(
            "New icon identifier for visual display (e.g., 'rocket', 'star', 'folder')."
          ),
        color: z
          .string()
          .optional()
          .describe(
            "New hex color code for the epic's visual theme (e.g., '#FF5733', '#3B82F6')."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // First, resolve the epic ID if a name was provided
        let epicId = input.id;
        
        // Check if it's a UUID pattern
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidPattern.test(input.id)) {
          // It's a name, need to look up the epic first
          const { data: existingEpic } = await apiClient.getEpic(input.id);
          epicId = existingEpic.id;
        }

        // Build update payload with only provided fields
        const updateData: {
          name?: string;
          description?: string;
          icon?: string;
          color?: string;
        } = {};

        if (input.name !== undefined) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.icon !== undefined) updateData.icon = input.icon;
        if (input.color !== undefined) updateData.color = input.color;

        const { data: epic } = await apiClient.updateEpic(epicId, updateData);

        const result = {
          id: epic.id,
          name: epic.name,
          description: epic.description,
          icon: epic.icon,
          color: epic.color,
          sortOrder: epic.sortOrder,
          isArchived: epic.isArchived,
          team: epic.team,
          createdAt: epic.createdAt,
          updatedAt: epic.updatedAt,
          // Attribution fields
          createdBy: epic.createdBy ?? null,
          creator: epic.creator ?? null,
          implementedBy: epic.implementedBy ?? null,
          implementer: epic.implementer ?? null,
          implementedDate: epic.implementedDate ?? null,
        };

        return createResponse(result);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Epic '${input.id}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );
}
