/**
 * MCP Tools for Agent Score management
 *
 * Provides tools for viewing the agent leaderboard, querying individual
 * scores, and manually adjusting scores.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";

export function registerAgentScoreTools(server: McpServer): void {
  // ==========================================================================
  // spectree__list_agent_scores
  // ==========================================================================
  server.registerTool(
    "spectree__list_agent_scores",
    {
      description:
        "Get the agent score leaderboard. Returns all agents sorted by " +
        "totalScore descending with rank positions, busts received/issued, " +
        "clean audit cycles, and last audit timestamp.",
      inputSchema: {},
    },
    async () => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.listAgentScores();
        return createResponse({ agents: result.data });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__get_agent_score
  // ==========================================================================
  server.registerTool(
    "spectree__get_agent_score",
    {
      description:
        "Get the score details for a single agent by name. Returns totalScore, " +
        "bustsReceived, bustsIssued, cleanCycles, and lastAuditAt.",
      inputSchema: {
        agentName: z
          .string()
          .min(1)
          .describe("The agent name (e.g., 'barney', 'bobby')."),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.getAgentScore(input.agentName);
        return createResponse(result.data);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(
            new Error(`Agent score for '${input.agentName}' not found`)
          );
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__adjust_agent_score
  // ==========================================================================
  server.registerTool(
    "spectree__adjust_agent_score",
    {
      description:
        "Manually adjust an agent's score. Use positive delta to add points " +
        "or negative delta to deduct. Requires a reason. " +
        "Intended for The Claw Father or administrative use.",
      inputSchema: {
        agentName: z
          .string()
          .min(1)
          .describe("The agent name to adjust."),
        delta: z
          .number()
          .int()
          .describe("Points to add (positive) or deduct (negative)."),
        reason: z
          .string()
          .min(1)
          .max(2000)
          .describe("Reason for the adjustment."),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.adjustAgentScore(input.agentName, {
          delta: input.delta,
          reason: input.reason,
        });

        const direction = input.delta >= 0 ? "added" : "deducted";
        return createResponse({
          ...result.data,
          message: `${direction} ${Math.abs(input.delta)} points ${input.delta >= 0 ? "to" : "from"} '${input.agentName}'`,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(
            new Error(`Agent score for '${input.agentName}' not found`)
          );
        }
        return createErrorResponse(error);
      }
    }
  );
}
