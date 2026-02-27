/**
 * MCP Tools for Law Registry operations
 *
 * Provides tools for managing enforceable rules for AI agent governance.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";

const lawSeverityValues = ["minor", "major", "critical"] as const;

export function registerLawTools(server: McpServer): void {
  // ==========================================================================
  // spectree__list_laws
  // ==========================================================================
  server.registerTool(
    "spectree__list_laws",
    {
      description:
        "List all laws in the registry. Laws define enforceable rules for AI agent governance. " +
        "Filter by severity, appliesTo (agent name), or active status.",
      inputSchema: {
        severity: z
          .enum(lawSeverityValues)
          .optional()
          .describe("Filter by severity: minor, major, or critical."),
        appliesTo: z
          .string()
          .optional()
          .describe("Filter by agent name the law applies to (e.g., 'feature-worker', 'planner')."),
        isActive: z
          .boolean()
          .optional()
          .describe("Filter by active status. Defaults to showing all."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Maximum number of laws to return (default: 20, max: 100)."),
        cursor: z
          .string()
          .optional()
          .describe("Pagination cursor from a previous response."),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.listLaws({
          severity: input.severity,
          appliesTo: input.appliesTo,
          isActive: input.isActive,
          limit: input.limit,
          cursor: input.cursor,
        });

        return createResponse({
          laws: result.data,
          meta: result.meta,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__get_law
  // ==========================================================================
  server.registerTool(
    "spectree__get_law",
    {
      description:
        "Get a specific law by its ID or lawCode (e.g., 'LAW-001'). " +
        "Returns the full law record including audit logic and consequence.",
      inputSchema: {
        idOrCode: z
          .string()
          .min(1)
          .describe("The law UUID or lawCode (e.g., 'LAW-001')."),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.getLaw(input.idOrCode);
        return createResponse(result.data);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Law '${input.idOrCode}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__create_law
  // ==========================================================================
  server.registerTool(
    "spectree__create_law",
    {
      description:
        "Create a new law in the registry. Laws define enforceable rules for AI agent behavior. " +
        "Each law has a unique lawCode (e.g., LAW-001), severity level, audit logic describing " +
        "how to verify compliance, and consequences for violations.",
      inputSchema: {
        lawCode: z
          .string()
          .regex(/^LAW-\d{3,}$/)
          .describe("Unique law code (e.g., 'LAW-001'). Must match format LAW-NNN."),
        title: z
          .string()
          .min(1)
          .max(255)
          .describe("Short descriptive title of the law."),
        description: z
          .string()
          .min(1)
          .max(5000)
          .describe("Detailed description of what the law requires."),
        severity: z
          .enum(lawSeverityValues)
          .describe("Severity level: minor (warning), major (escalation), critical (blocking)."),
        auditLogic: z
          .string()
          .min(1)
          .max(5000)
          .describe("How to verify compliance via MCP queries, git checks, or API calls."),
        consequence: z
          .string()
          .min(1)
          .max(2000)
          .describe("What happens when this law is violated."),
        appliesTo: z
          .string()
          .min(1)
          .max(255)
          .describe("Agent role name this law applies to (e.g., 'feature-worker', 'all')."),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.createLaw({
          lawCode: input.lawCode,
          title: input.title,
          description: input.description,
          severity: input.severity,
          auditLogic: input.auditLogic,
          consequence: input.consequence,
          appliesTo: input.appliesTo,
        });

        return createResponse({
          ...result.data,
          message: "Law created successfully",
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          return createErrorResponse(new Error(`Law with code '${input.lawCode}' already exists`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__update_law
  // ==========================================================================
  server.registerTool(
    "spectree__update_law",
    {
      description:
        "Update an existing law. Provide the law ID or lawCode and the fields to update.",
      inputSchema: {
        idOrCode: z
          .string()
          .min(1)
          .describe("The law UUID or lawCode (e.g., 'LAW-001') to update."),
        title: z.string().min(1).max(255).optional().describe("Updated title."),
        description: z.string().min(1).max(5000).optional().describe("Updated description."),
        severity: z.enum(lawSeverityValues).optional().describe("Updated severity."),
        auditLogic: z.string().min(1).max(5000).optional().describe("Updated audit logic."),
        consequence: z.string().min(1).max(2000).optional().describe("Updated consequence."),
        appliesTo: z.string().min(1).max(255).optional().describe("Updated appliesTo agent name."),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const { idOrCode, ...updateData } = input;
        const result = await apiClient.updateLaw(idOrCode, updateData);

        return createResponse({
          ...result.data,
          message: "Law updated successfully",
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Law '${input.idOrCode}' not found`));
        }
        if (error instanceof ApiError && error.status === 409) {
          return createErrorResponse(new Error("Duplicate lawCode conflict"));
        }
        return createErrorResponse(error);
      }
    }
  );
}
