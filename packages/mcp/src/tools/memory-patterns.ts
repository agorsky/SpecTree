/**
 * MCP Tools for Memory Pattern Registry (ENG-65)
 *
 * Manages reusable patterns and conventions for cross-session learning.
 * Composite tool: spectree__manage_patterns (list, get, create, update, delete).
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";

export function registerMemoryPatternTools(server: McpServer): void {
  server.registerTool(
    "spectree__manage_patterns",
    {
      description:
        "Manage reusable patterns and conventions in the pattern registry.\n\n" +
        "Actions:\n" +
        "- 'list': List patterns with optional filters (epicId, category, global)\n" +
        "- 'get': Get a single pattern by ID\n" +
        "- 'create': Create a new pattern\n" +
        "- 'update': Update an existing pattern\n" +
        "- 'delete': Delete a pattern\n\n" +
        "Patterns are reusable conventions and approaches that help maintain consistency " +
        "across sessions and epics. Global patterns (epicId=null) apply everywhere.",
      inputSchema: z.discriminatedUnion("action", [
        z.object({
          action: z.literal("list"),
          epicId: z.string().optional().describe("Filter by epic ID"),
          category: z.string().optional().describe("Filter by category"),
          global: z.boolean().optional().describe("If true, list only global patterns (epicId=null)"),
        }),
        z.object({
          action: z.literal("get"),
          id: z.string().describe("Pattern ID"),
        }),
        z.object({
          action: z.literal("create"),
          name: z.string().describe("Pattern name"),
          category: z.string().describe("Category: architecture, testing, naming, workflow, etc."),
          description: z.string().describe("What this pattern is and when to apply it"),
          examples: z.array(z.string()).optional().describe("Example usages"),
          epicId: z.string().nullable().optional().describe("Epic ID, or null for global"),
          source: z.string().optional().describe("Source: debrief, manual, promoted"),
          confidence: z.number().min(0).max(1).optional().describe("Confidence 0-1"),
        }),
        z.object({
          action: z.literal("update"),
          id: z.string().describe("Pattern ID"),
          name: z.string().optional(),
          category: z.string().optional(),
          description: z.string().optional(),
          examples: z.array(z.string()).optional(),
          epicId: z.string().nullable().optional(),
          source: z.string().optional(),
          confidence: z.number().min(0).max(1).optional(),
        }),
        z.object({
          action: z.literal("delete"),
          id: z.string().describe("Pattern ID"),
        }),
      ]),
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        switch (input.action) {
          case "list": {
            const listParams: { epicId?: string; category?: string; global?: boolean } = {};
            if (input.epicId !== undefined) listParams.epicId = input.epicId;
            if (input.category !== undefined) listParams.category = input.category;
            if (input.global !== undefined) listParams.global = input.global;
            const result = await apiClient.listPatterns(listParams);
            return createResponse(result);
          }

          case "get": {
            const result = await apiClient.getPattern(input.id);
            return createResponse(result);
          }

          case "create": {
            const createInput: {
              name: string;
              category: string;
              description: string;
              examples?: string[];
              epicId?: string | null;
              source?: string;
              confidence?: number;
            } = {
              name: input.name,
              category: input.category,
              description: input.description,
              source: input.source ?? "manual",
            };
            if (input.examples !== undefined) createInput.examples = input.examples;
            if (input.epicId !== undefined) createInput.epicId = input.epicId;
            if (input.confidence !== undefined) createInput.confidence = input.confidence;
            const result = await apiClient.createPattern(createInput);
            return createResponse(result);
          }

          case "update": {
            const body: Record<string, unknown> = {};
            if (input.name !== undefined) body.name = input.name;
            if (input.category !== undefined) body.category = input.category;
            if (input.description !== undefined) body.description = input.description;
            if (input.examples !== undefined) body.examples = input.examples;
            if (input.epicId !== undefined) body.epicId = input.epicId;
            if (input.source !== undefined) body.source = input.source;
            if (input.confidence !== undefined) body.confidence = input.confidence;
            const result = await apiClient.updatePattern(input.id, body);
            return createResponse(result);
          }

          case "delete": {
            await apiClient.deletePattern(input.id);
            return createResponse({ deleted: true, id: input.id });
          }
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error("Pattern not found"));
        }
        return createErrorResponse(error);
      }
    }
  );
}
