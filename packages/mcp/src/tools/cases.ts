/**
 * MCP Tools for Case management
 *
 * Provides tools for filing, reviewing, and managing court cases
 * against AI agents for law violations.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";

const caseStatusValues = ["open", "hearing", "verdict", "corrected", "dismissed"] as const;
const caseVerdictValues = ["guilty", "not_guilty", "dismissed"] as const;
const deductionLevelValues = ["none", "minor", "major", "critical"] as const;
const severityValues = ["minor", "major", "critical"] as const;

export function registerCaseTools(server: McpServer): void {
  // ==========================================================================
  // spectree__list_cases
  // ==========================================================================
  server.registerTool(
    "spectree__list_cases",
    {
      description:
        "List court cases filed against AI agents. " +
        "Filter by status (open, hearing, verdict, corrected, dismissed), " +
        "accusedAgent name, severity, or lawId.",
      inputSchema: {
        status: z
          .enum(caseStatusValues)
          .optional()
          .describe("Filter by case status."),
        accusedAgent: z
          .string()
          .optional()
          .describe("Filter by accused agent name."),
        severity: z
          .enum(severityValues)
          .optional()
          .describe("Filter by severity: minor, major, or critical."),
        lawId: z
          .string()
          .optional()
          .describe("Filter by the law ID that was violated."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Maximum number of cases to return (default: 20, max: 100)."),
        cursor: z
          .string()
          .optional()
          .describe("Pagination cursor from a previous response."),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const params: Parameters<typeof apiClient.listCases>[0] = {};
        if (input.status !== undefined) params.status = input.status;
        if (input.accusedAgent !== undefined) params.accusedAgent = input.accusedAgent;
        if (input.severity !== undefined) params.severity = input.severity;
        if (input.lawId !== undefined) params.lawId = input.lawId;
        if (input.limit !== undefined) params.limit = input.limit;
        if (input.cursor !== undefined) params.cursor = input.cursor;
        const result = await apiClient.listCases(params);

        return createResponse({
          cases: result.data,
          meta: result.meta,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__get_case
  // ==========================================================================
  server.registerTool(
    "spectree__get_case",
    {
      description:
        "Get full details of a court case including the violated law, evidence, " +
        "verdict info, and linked remediation task.",
      inputSchema: {
        id: z
          .string()
          .min(1)
          .describe("The case UUID."),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.getCase(input.id);
        return createResponse(result.data);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Case '${input.id}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__file_case
  // ==========================================================================
  server.registerTool(
    "spectree__file_case",
    {
      description:
        "File a new court case against an AI agent for a law violation. " +
        "Requires the accused agent name, the law ID being violated, evidence items, " +
        "and severity level. Used by Barney (The Fed) to initiate enforcement.",
      inputSchema: {
        accusedAgent: z
          .string()
          .min(1)
          .max(255)
          .describe("Name of the AI agent being accused (e.g., 'bobby', 'planner')."),
        lawId: z
          .string()
          .uuid()
          .describe("UUID of the law that was violated."),
        evidence: z
          .array(
            z.object({
              type: z.string().min(1).describe("Type of evidence (e.g., 'git_diff', 'api_log', 'file_content')."),
              reference: z.string().min(1).describe("Reference to the evidence (e.g., file path, commit SHA)."),
              description: z.string().min(1).describe("Description of what this evidence shows."),
            })
          )
          .min(1)
          .describe("Array of evidence items supporting the case."),
        severity: z
          .enum(severityValues)
          .describe("Severity level: minor (warning), major (escalation), critical (blocking)."),
        filedBy: z
          .string()
          .min(1)
          .max(255)
          .optional()
          .describe("Who is filing the case (defaults to 'barney')."),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.fileCase({
          accusedAgent: input.accusedAgent,
          lawId: input.lawId,
          evidence: input.evidence,
          severity: input.severity,
          filedBy: input.filedBy,
        });

        return createResponse({
          ...result.data,
          message: `Case #${result.data.caseNumber} filed successfully against '${input.accusedAgent}'`,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Law '${input.lawId}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__issue_verdict
  // ==========================================================================
  server.registerTool(
    "spectree__issue_verdict",
    {
      description:
        "Issue a verdict on a court case. Used by The Judge to render judgment. " +
        "Case must be in 'hearing' status. If guilty, a remediation task may be created " +
        "and agent scores will be updated. If not_guilty, the filer may be penalized.",
      inputSchema: {
        id: z
          .string()
          .min(1)
          .describe("The case UUID to issue verdict on."),
        verdict: z
          .enum(caseVerdictValues)
          .describe("The verdict: guilty, not_guilty, or dismissed."),
        verdictReason: z
          .string()
          .min(1)
          .max(5000)
          .describe("Detailed reasoning for the verdict."),
        deductionLevel: z
          .enum(deductionLevelValues)
          .describe("Score deduction level: none, minor, major, or critical."),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.issueVerdict(input.id, {
          verdict: input.verdict,
          verdictReason: input.verdictReason,
          deductionLevel: input.deductionLevel,
        });

        return createResponse({
          ...result.data,
          message: `Verdict '${input.verdict}' issued on case`,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Case '${input.id}' not found`));
        }
        if (error instanceof ApiError && error.status === 400) {
          return createErrorResponse(new Error(
            (error.body as { message?: string })?.message ?? "Invalid state transition"
          ));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__mark_case_corrected
  // ==========================================================================
  server.registerTool(
    "spectree__mark_case_corrected",
    {
      description:
        "Mark a case as corrected after the agent has completed remediation. " +
        "Case must be in 'verdict' status with a guilty verdict.",
      inputSchema: {
        id: z
          .string()
          .min(1)
          .describe("The case UUID to mark as corrected."),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.markCaseCorrected(input.id);

        return createResponse({
          ...result.data,
          message: "Case marked as corrected",
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Case '${input.id}' not found`));
        }
        if (error instanceof ApiError && error.status === 400) {
          return createErrorResponse(new Error(
            (error.body as { message?: string })?.message ?? "Invalid state transition"
          ));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__dismiss_case
  // ==========================================================================
  server.registerTool(
    "spectree__dismiss_case",
    {
      description:
        "Dismiss a court case. Can be done from any status. " +
        "Requires a reason for dismissal.",
      inputSchema: {
        id: z
          .string()
          .min(1)
          .describe("The case UUID to dismiss."),
        reason: z
          .string()
          .min(1)
          .max(5000)
          .describe("Reason for dismissing the case."),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const result = await apiClient.dismissCase(input.id, input.reason);

        return createResponse({
          ...result.data,
          message: "Case dismissed",
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Case '${input.id}' not found`));
        }
        if (error instanceof ApiError && error.status === 400) {
          return createErrorResponse(new Error(
            (error.body as { message?: string })?.message ?? "Invalid state transition"
          ));
        }
        return createErrorResponse(error);
      }
    }
  );
}
