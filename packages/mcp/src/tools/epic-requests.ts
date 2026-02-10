/**
 * MCP Tools for Epic Request operations
 *
 * Provides tools for managing Epic Requests - user proposals for new epics
 * that require approval before conversion. Includes CRUD operations, reactions,
 * and comments functionality.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";

/**
 * Register all epic request tools
 */
export function registerEpicRequestTools(server: McpServer): void {
  // ==========================================================================
  // spectree__draft_epic_request
  // ==========================================================================
  server.registerTool(
    "spectree__draft_epic_request",
    {
      description:
        "Get an empty template for creating an Epic Request with field descriptions. " +
        "This is a read-only tool that returns the structured description template " +
        "with descriptions for each field. Use this to understand what information " +
        "should be provided when creating an epic request. No parameters needed.",
      inputSchema: {},
    },
    () => {
      try {
        // Return the empty template with field descriptions
        const template = {
          title: "Enter the title of your epic request here (required)",
          description: "Optional plain markdown description of the epic request",
          structuredDesc: {
            problemStatement:
              "Clear statement of the problem or opportunity this epic would address (required, max 5000 chars)",
            proposedSolution:
              "High-level description of how this epic would solve the problem (required, max 5000 chars)",
            impactAssessment:
              "Expected impact and benefits of implementing this epic (required, max 5000 chars)",
            targetAudience:
              "Who will benefit from this epic - users, teams, etc. (optional, max 2000 chars)",
            successMetrics:
              "How success will be measured if this epic is implemented (optional, max 2000 chars)",
            alternatives:
              "Alternative approaches considered (optional, max 3000 chars)",
            dependencies:
              "External dependencies or prerequisites (optional, max 2000 chars)",
            estimatedEffort:
              "Rough effort estimate, e.g., '2-3 weeks', '1 quarter' (optional, max 1000 chars)",
          },
        };

        return createResponse({
          template,
          description:
            "Use this template as a guide when creating epic requests. " +
            "The structuredDesc section is optional but highly recommended. " +
            "If provided, problemStatement, proposedSolution, and impactAssessment are required.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__create_epic_request
  // ==========================================================================
  server.registerTool(
    "spectree__create_epic_request",
    {
      description:
        "Create a new Epic Request - a proposal for a new epic that requires approval. " +
        "Epic Requests are used to suggest new initiatives or major features. " +
        "The request will be created with 'pending' status and can be reviewed by admins. " +
        "Supports optional structuredDesc with detailed proposal information. " +
        "Returns the created epic request with metadata.",
      inputSchema: {
        title: z
          .string()
          .min(1)
          .max(500)
          .describe("Title of the epic request (required, max 500 chars)"),
        description: z
          .string()
          .max(10000)
          .optional()
          .describe(
            "Plain markdown description of the epic request (optional, max 10000 chars)"
          ),
        structuredDesc: z
          .object({
            problemStatement: z
              .string()
              .min(1)
              .max(5000)
              .describe(
                "Clear statement of the problem or opportunity this epic would address (required, max 5000 chars)"
              ),
            proposedSolution: z
              .string()
              .min(1)
              .max(5000)
              .describe(
                "High-level description of how this epic would solve the problem (required, max 5000 chars)"
              ),
            impactAssessment: z
              .string()
              .min(1)
              .max(5000)
              .describe(
                "Expected impact and benefits of implementing this epic (required, max 5000 chars)"
              ),
            targetAudience: z
              .string()
              .max(2000)
              .optional()
              .describe(
                "Who will benefit from this epic - users, teams, etc. (optional, max 2000 chars)"
              ),
            successMetrics: z
              .string()
              .max(2000)
              .optional()
              .describe(
                "How success will be measured if this epic is implemented (optional, max 2000 chars)"
              ),
            alternatives: z
              .string()
              .max(3000)
              .optional()
              .describe(
                "Alternative approaches considered (optional, max 3000 chars)"
              ),
            dependencies: z
              .string()
              .max(2000)
              .optional()
              .describe(
                "External dependencies or prerequisites (optional, max 2000 chars)"
              ),
            estimatedEffort: z
              .string()
              .max(1000)
              .optional()
              .describe(
                "Rough effort estimate, e.g., '2-3 weeks', '1 quarter' (optional, max 1000 chars)"
              ),
          })
          .optional()
          .describe(
            "Structured description with detailed proposal information. " +
              "If provided, problemStatement, proposedSolution, and impactAssessment are required."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        const createInput: {
          title: string;
          description?: string;
          structuredDesc?: {
            problemStatement: string;
            proposedSolution: string;
            impactAssessment: string;
            targetAudience?: string;
            successMetrics?: string;
            alternatives?: string;
            dependencies?: string;
            estimatedEffort?: string;
          };
        } = {
          title: input.title,
        };

        if (input.description !== undefined) {
          createInput.description = input.description;
        }
        if (input.structuredDesc !== undefined) {
          createInput.structuredDesc = {
            problemStatement: input.structuredDesc.problemStatement,
            proposedSolution: input.structuredDesc.proposedSolution,
            impactAssessment: input.structuredDesc.impactAssessment,
          };
          if (input.structuredDesc.targetAudience !== undefined) {
            createInput.structuredDesc.targetAudience = input.structuredDesc.targetAudience;
          }
          if (input.structuredDesc.successMetrics !== undefined) {
            createInput.structuredDesc.successMetrics = input.structuredDesc.successMetrics;
          }
          if (input.structuredDesc.alternatives !== undefined) {
            createInput.structuredDesc.alternatives = input.structuredDesc.alternatives;
          }
          if (input.structuredDesc.dependencies !== undefined) {
            createInput.structuredDesc.dependencies = input.structuredDesc.dependencies;
          }
          if (input.structuredDesc.estimatedEffort !== undefined) {
            createInput.structuredDesc.estimatedEffort = input.structuredDesc.estimatedEffort;
          }
        }

        const result = await apiClient.createEpicRequest(createInput);

        return createResponse({
          epicRequest: result.data,
          message: "Epic request created successfully with status 'pending'",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__list_epic_requests
  // ==========================================================================
  server.registerTool(
    "spectree__list_epic_requests",
    {
      description:
        "List all epic requests with cursor-based pagination and optional filtering. " +
        "Returns requests with aggregated reaction counts (like, fire, dislike) and the " +
        "current user's reaction if any. Supports filtering by status (pending, approved, " +
        "rejected, converted) and by the user who created the request. Results are ordered " +
        "by creation date (newest first).",
      inputSchema: {
        cursor: z
          .string()
          .optional()
          .describe(
            "Pagination cursor from a previous response's meta.cursor field. " +
              "Pass this to fetch the next page of results."
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe(
            "Maximum number of epic requests to return per page (default: 20, max: 100). " +
              "Use with cursor for pagination through large result sets."
          ),
        status: z
          .enum(["pending", "approved", "rejected", "converted"])
          .optional()
          .describe(
            "Filter by request status: 'pending' (awaiting review), 'approved' (approved by admin), " +
              "'rejected' (rejected by admin), or 'converted' (already converted to epic)"
          ),
        requestedById: z
          .string()
          .optional()
          .describe(
            "Filter by the user ID who created the request. Returns only requests created by this user."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        const result = await apiClient.listEpicRequests({
          cursor: input.cursor,
          limit: input.limit,
          status: input.status,
          requestedById: input.requestedById,
        });

        return createResponse({
          epicRequests: result.data,
          meta: result.meta,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__get_epic_request
  // ==========================================================================
  server.registerTool(
    "spectree__get_epic_request",
    {
      description:
        "Get a single epic request by ID with full details including reaction counts and " +
        "the current user's reaction. Returns the complete epic request object with " +
        "structured description if present, requester information, and aggregated reactions. " +
        "Use this to view the full details of a specific epic request.",
      inputSchema: {
        id: z
          .string()
          .uuid()
          .describe(
            "The UUID of the epic request to retrieve. Get this from list_epic_requests."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.getEpicRequest(input.id);

        return createResponse({
          epicRequest: result.data,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(
            new Error(`Epic request with id '${input.id}' not found`)
          );
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__update_epic_request
  // ==========================================================================
  server.registerTool(
    "spectree__update_epic_request",
    {
      description:
        "Update an existing epic request. Only the creator can update the request, and " +
        "only if it hasn't been approved or converted. All fields are optional - only " +
        "provide the fields you want to change. Admins can update the status field. " +
        "Returns the updated epic request.",
      inputSchema: {
        id: z
          .string()
          .uuid()
          .describe("The UUID of the epic request to update"),
        title: z
          .string()
          .min(1)
          .max(500)
          .optional()
          .describe("New title for the epic request (optional, max 500 chars)"),
        description: z
          .string()
          .max(10000)
          .optional()
          .describe(
            "New plain markdown description (optional, max 10000 chars). " +
              "This replaces the entire description."
          ),
        structuredDesc: z
          .object({
            problemStatement: z
              .string()
              .min(1)
              .max(5000)
              .describe("Problem statement (required if structuredDesc provided)"),
            proposedSolution: z
              .string()
              .min(1)
              .max(5000)
              .describe("Proposed solution (required if structuredDesc provided)"),
            impactAssessment: z
              .string()
              .min(1)
              .max(5000)
              .describe("Impact assessment (required if structuredDesc provided)"),
            targetAudience: z
              .string()
              .max(2000)
              .optional()
              .describe("Target audience (optional)"),
            successMetrics: z
              .string()
              .max(2000)
              .optional()
              .describe("Success metrics (optional)"),
            alternatives: z
              .string()
              .max(3000)
              .optional()
              .describe("Alternative approaches (optional)"),
            dependencies: z
              .string()
              .max(2000)
              .optional()
              .describe("Dependencies (optional)"),
            estimatedEffort: z
              .string()
              .max(1000)
              .optional()
              .describe("Estimated effort (optional)"),
          })
          .optional()
          .describe(
            "New structured description (optional). This replaces the entire structuredDesc."
          ),
        status: z
          .enum(["pending", "approved", "rejected", "converted"])
          .optional()
          .describe(
            "New status (optional, admin only). Use approve/reject endpoints instead when possible."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        const updateData: {
          title?: string;
          description?: string;
          structuredDesc?: {
            problemStatement: string;
            proposedSolution: string;
            impactAssessment: string;
            targetAudience?: string;
            successMetrics?: string;
            alternatives?: string;
            dependencies?: string;
            estimatedEffort?: string;
          };
          status?: "pending" | "approved" | "rejected" | "converted";
        } = {};

        if (input.title !== undefined) updateData.title = input.title;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.structuredDesc !== undefined) {
          updateData.structuredDesc = {
            problemStatement: input.structuredDesc.problemStatement,
            proposedSolution: input.structuredDesc.proposedSolution,
            impactAssessment: input.structuredDesc.impactAssessment,
          };
          if (input.structuredDesc.targetAudience !== undefined) {
            updateData.structuredDesc.targetAudience = input.structuredDesc.targetAudience;
          }
          if (input.structuredDesc.successMetrics !== undefined) {
            updateData.structuredDesc.successMetrics = input.structuredDesc.successMetrics;
          }
          if (input.structuredDesc.alternatives !== undefined) {
            updateData.structuredDesc.alternatives = input.structuredDesc.alternatives;
          }
          if (input.structuredDesc.dependencies !== undefined) {
            updateData.structuredDesc.dependencies = input.structuredDesc.dependencies;
          }
          if (input.structuredDesc.estimatedEffort !== undefined) {
            updateData.structuredDesc.estimatedEffort = input.structuredDesc.estimatedEffort;
          }
        }
        if (input.status !== undefined) updateData.status = input.status;

        const result = await apiClient.updateEpicRequest(input.id, updateData);

        return createResponse({
          epicRequest: result.data,
          message: "Epic request updated successfully",
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(
            new Error(`Epic request with id '${input.id}' not found`)
          );
        }
        if (error instanceof ApiError && error.status === 403) {
          return createErrorResponse(
            new Error(
              "You don't have permission to update this epic request. " +
                "Only the creator can update, and only pending requests can be modified."
            )
          );
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__delete_epic_request
  // ==========================================================================
  server.registerTool(
    "spectree__delete_epic_request",
    {
      description:
        "Delete an epic request. Only the creator or a global admin can delete a request. " +
        "This permanently removes the epic request and all associated reactions and comments. " +
        "Use with caution - this action cannot be undone.",
      inputSchema: {
        id: z
          .string()
          .uuid()
          .describe("The UUID of the epic request to delete"),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        await apiClient.deleteEpicRequest(input.id);

        return createResponse({
          message: "Epic request deleted successfully",
          deletedId: input.id,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(
            new Error(`Epic request with id '${input.id}' not found`)
          );
        }
        if (error instanceof ApiError && error.status === 403) {
          return createErrorResponse(
            new Error(
              "You don't have permission to delete this epic request. " +
                "Only the creator or global admin can delete."
            )
          );
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__react_to_epic_request
  // ==========================================================================
  server.registerTool(
    "spectree__react_to_epic_request",
    {
      description:
        "Add or update a reaction on an epic request. Valid reaction types are 'like', 'fire', " +
        "and 'dislike'. If you've already reacted to this request, this will replace your " +
        "existing reaction with the new one. Each user can have only one reaction per request. " +
        "Use this to show support or feedback on epic proposals.",
      inputSchema: {
        id: z
          .string()
          .uuid()
          .describe("The UUID of the epic request to react to"),
        reactionType: z
          .enum(["like", "fire", "dislike"])
          .describe(
            "Type of reaction: 'like' (positive), 'fire' (excited/strong support), or 'dislike' (negative)"
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.addEpicRequestReaction(input.id, {
          reactionType: input.reactionType,
        });

        return createResponse({
          message: result.message,
          reactionType: input.reactionType,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(
            new Error(`Epic request with id '${input.id}' not found`)
          );
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__comment_on_epic_request
  // ==========================================================================
  server.registerTool(
    "spectree__comment_on_epic_request",
    {
      description:
        "Create a new comment on an epic request. Comments are used for discussion, " +
        "feedback, and questions about the proposal. The current user is automatically " +
        "set as the comment author. Comments support plain text up to 5000 characters. " +
        "Returns the created comment with author information.",
      inputSchema: {
        id: z
          .string()
          .uuid()
          .describe("The UUID of the epic request to comment on"),
        content: z
          .string()
          .min(1)
          .max(5000)
          .describe(
            "Content of the comment (required, 1-5000 chars). Plain text only."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.createEpicRequestComment(input.id, {
          content: input.content,
        });

        return createResponse({
          comment: result.data,
          message: "Comment created successfully",
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(
            new Error(`Epic request with id '${input.id}' not found`)
          );
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__list_epic_request_comments
  // ==========================================================================
  server.registerTool(
    "spectree__list_epic_request_comments",
    {
      description:
        "List all comments for an epic request with cursor-based pagination. " +
        "Returns comments with author information (name and email). Comments are ordered " +
        "by creation date (oldest first) to show the discussion flow. Use this to view " +
        "feedback and discussion on an epic request.",
      inputSchema: {
        id: z
          .string()
          .uuid()
          .describe("The UUID of the epic request to list comments for"),
        cursor: z
          .string()
          .optional()
          .describe(
            "Pagination cursor from a previous response's meta.cursor field. " +
              "Pass this to fetch the next page of results."
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe(
            "Maximum number of comments to return per page (default: 20, max: 100)"
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.listEpicRequestComments(input.id, {
          cursor: input.cursor,
          limit: input.limit,
        });

        return createResponse({
          comments: result.data,
          meta: result.meta,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(
            new Error(`Epic request with id '${input.id}' not found`)
          );
        }
        return createErrorResponse(error);
      }
    }
  );
}
