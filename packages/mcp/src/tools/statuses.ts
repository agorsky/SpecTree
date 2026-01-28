/**
 * MCP Tools for Status Management
 *
 * Provides tools for listing and retrieving statuses in SpecTree.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  statusService,
  prisma,
  NotFoundError,
} from "@spectree/api/src/services/index.js";
import { isValidUUID } from "../utils.js";

// Input schemas
const listStatusesSchema = {
  team: z
    .string()
    .describe(
      "The team to list statuses for (required). Accepts team ID (UUID), name, or key " +
      "(e.g., 'Engineering', 'ENG', or '550e8400-e29b-41d4-a716-446655440000'). " +
      "Each team has its own set of workflow statuses."
    ),
};

const getStatusSchema = {
  id: z
    .string()
    .describe(
      "The status to look up. Accepts status ID (UUID) or exact status name " +
      "(e.g., 'In Progress', 'Done'). When using a name, provide the team parameter " +
      "to avoid ambiguity since different teams may have statuses with the same name."
    ),
  team: z
    .string()
    .optional()
    .describe(
      "Team context for name-based lookup. Accepts team ID (UUID), name, or key " +
      "(e.g., 'Engineering', 'ENG'). Required when looking up a status by name to " +
      "ensure the correct team's status is returned. Not needed when using a status UUID."
    ),
};

// Helper to resolve team ID from name or ID
async function resolveTeamId(teamNameOrId: string): Promise<string> {
  // First try to find by ID - only if it's a valid UUID format
  if (isValidUUID(teamNameOrId)) {
    const teamById = await prisma.team.findUnique({
      where: { id: teamNameOrId },
      select: { id: true },
    });

    if (teamById) {
      return teamById.id;
    }
  }

  // Try to find by name
  const teamByName = await prisma.team.findFirst({
    where: { name: teamNameOrId },
    select: { id: true },
  });

  if (teamByName) {
    return teamByName.id;
  }

  // Try to find by key
  const teamByKey = await prisma.team.findFirst({
    where: { key: teamNameOrId },
    select: { id: true },
  });

  if (teamByKey) {
    return teamByKey.id;
  }

  throw new NotFoundError(`Team '${teamNameOrId}' not found`);
}

// Helper to format status for response
function formatStatus(status: {
  id: string;
  name: string;
  category: string;
  color: string | null;
  position: number;
}) {
  return {
    id: status.id,
    name: status.name,
    category: status.category,
    color: status.color,
    position: status.position,
  };
}

// Register all status tools
export function registerStatusTools(server: McpServer): void {
  // List statuses tool
  server.registerTool(
    "spectree__list_statuses",
    {
      description:
        "List all workflow statuses for a team, ordered by position. Returns status metadata " +
        "including ID, name, category (e.g., 'backlog', 'started', 'completed', 'canceled'), " +
        "color, and position. Use this to discover available statuses before creating or " +
        "updating features and tasks. Each team has its own set of customizable statuses.",
      inputSchema: listStatusesSchema,
    },
    async (input) => {
      try {
        const teamId = await resolveTeamId(input.team);
        const statuses = await statusService.listStatuses({ teamId });

        const result = statuses.map(formatStatus);

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        if (error instanceof NotFoundError) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }],
            isError: true,
          };
        }
        throw error;
      }
    }
  );

  // Get status tool
  server.registerTool(
    "spectree__get_status",
    {
      description:
        "Get detailed information about a specific status by ID or name. Returns the status " +
        "object including ID, name, category, color, and position. When looking up by name, " +
        "provide the team parameter to ensure the correct status is returned (different teams " +
        "may have statuses with the same name).",
      inputSchema: getStatusSchema,
    },
    async (input) => {
      try {
        // First try to get by ID
        const statusById = await statusService.getStatusById(input.id);

        if (statusById) {
          return {
            content: [{ type: "text", text: JSON.stringify(formatStatus(statusById), null, 2) }],
          };
        }

        // If not found by ID and team is provided, try by name within team
        if (input.team) {
          const teamId = await resolveTeamId(input.team);

          const statusByName = await prisma.status.findFirst({
            where: {
              name: input.id,
              teamId: teamId,
            },
          });

          if (statusByName) {
            return {
              content: [{ type: "text", text: JSON.stringify(formatStatus(statusByName), null, 2) }],
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: `Status '${input.id}' not found in team '${input.team}'` },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        // No team provided and not found by ID
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { error: `Status with ID '${input.id}' not found. Provide a team parameter to search by name.` },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      } catch (error) {
        if (error instanceof NotFoundError) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }],
            isError: true,
          };
        }
        throw error;
      }
    }
  );
}
