/**
 * MCP Tools for Code Context operations
 *
 * Provides tools for AI agents to link features/tasks to code artifacts
 * like files, functions, git branches, commits, and pull requests.
 * This enables instant code context without separate exploration work.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getApiClient,
  ApiError,
} from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";

// Register all code context tools
export function registerCodeContextTools(server: McpServer): void {
  // ==========================================================================
  // spectree__get_code_context
  // ==========================================================================
  server.registerTool(
    "spectree__get_code_context",
    {
      description:
        "Get all code artifacts linked to a feature or task. Returns files, functions, " +
        "git branch, commits, and pull request info. Use this at the start of a session " +
        "to instantly understand the code context without separate exploration.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature or task identifier. Accepts UUID or human-readable identifier " +
            "(e.g., 'COM-123' for features, 'COM-123-1' for tasks)."
          ),
        type: z
          .enum(["feature", "task"])
          .describe("Whether this is a 'feature' or 'task'."),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        if (input.type === "feature") {
          const { data: feature } = await apiClient.getFeature(input.id);
          const { data: result } = await apiClient.getFeatureCodeContext(feature.id);
          return createResponse(result);
        } else {
          const { data: task } = await apiClient.getTask(input.id);
          const { data: result } = await apiClient.getTaskCodeContext(task.id);
          return createResponse(result);
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`${input.type} '${input.id}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__link_code_file
  // ==========================================================================
  server.registerTool(
    "spectree__link_code_file",
    {
      description:
        "Link a file to a feature or task. This records which files are involved in " +
        "implementing the work item. The file path is added to the list of related files. " +
        "Duplicates are ignored. Use this as you work on files to build context for future sessions.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature or task identifier. Accepts UUID or human-readable identifier."
          ),
        type: z
          .enum(["feature", "task"])
          .describe("Whether this is a 'feature' or 'task'."),
        filePath: z
          .string()
          .min(1)
          .max(500)
          .describe("The file path to link (e.g., 'src/services/user.ts')"),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        if (input.type === "feature") {
          const { data: feature } = await apiClient.getFeature(input.id);
          const { data: result } = await apiClient.linkFeatureCodeFile(feature.id, input.filePath);
          return createResponse({
            message: `File '${input.filePath}' linked to feature ${feature.identifier}`,
            ...result,
          });
        } else {
          const { data: task } = await apiClient.getTask(input.id);
          const { data: result } = await apiClient.linkTaskCodeFile(task.id, input.filePath);
          return createResponse({
            message: `File '${input.filePath}' linked to task ${task.identifier}`,
            ...result,
          });
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`${input.type} '${input.id}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__unlink_code_file
  // ==========================================================================
  server.registerTool(
    "spectree__unlink_code_file",
    {
      description:
        "Unlink a file from a feature or task. Removes the file path from the list " +
        "of related files. Use this if a file is no longer relevant to the work item.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature or task identifier. Accepts UUID or human-readable identifier."
          ),
        type: z
          .enum(["feature", "task"])
          .describe("Whether this is a 'feature' or 'task'."),
        filePath: z
          .string()
          .min(1)
          .max(500)
          .describe("The file path to unlink"),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        if (input.type === "feature") {
          const { data: feature } = await apiClient.getFeature(input.id);
          const { data: result } = await apiClient.unlinkFeatureCodeFile(feature.id, input.filePath);
          return createResponse({
            message: `File '${input.filePath}' unlinked from feature ${feature.identifier}`,
            ...result,
          });
        } else {
          const { data: task } = await apiClient.getTask(input.id);
          const { data: result } = await apiClient.unlinkTaskCodeFile(task.id, input.filePath);
          return createResponse({
            message: `File '${input.filePath}' unlinked from task ${task.identifier}`,
            ...result,
          });
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`${input.type} '${input.id}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__link_function
  // ==========================================================================
  server.registerTool(
    "spectree__link_function",
    {
      description:
        "Link a function to a feature or task. Records which functions need to be " +
        "modified or are relevant to the work item. Stored as 'filePath:functionName'. " +
        "Duplicates are ignored.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature or task identifier. Accepts UUID or human-readable identifier."
          ),
        type: z
          .enum(["feature", "task"])
          .describe("Whether this is a 'feature' or 'task'."),
        filePath: z
          .string()
          .min(1)
          .max(500)
          .describe("The file path containing the function"),
        functionName: z
          .string()
          .min(1)
          .max(200)
          .describe("The name of the function"),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        if (input.type === "feature") {
          const { data: feature } = await apiClient.getFeature(input.id);
          const { data: result } = await apiClient.linkFeatureFunction(
            feature.id,
            input.filePath,
            input.functionName
          );
          return createResponse({
            message: `Function '${input.filePath}:${input.functionName}' linked to feature ${feature.identifier}`,
            ...result,
          });
        } else {
          const { data: task } = await apiClient.getTask(input.id);
          const { data: result } = await apiClient.linkTaskFunction(
            task.id,
            input.filePath,
            input.functionName
          );
          return createResponse({
            message: `Function '${input.filePath}:${input.functionName}' linked to task ${task.identifier}`,
            ...result,
          });
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`${input.type} '${input.id}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__link_branch
  // ==========================================================================
  server.registerTool(
    "spectree__link_branch",
    {
      description:
        "Link a git branch to a feature or task. Records which branch is being used " +
        "for this work item. Only one branch can be linked at a time (replaces previous).",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature or task identifier. Accepts UUID or human-readable identifier."
          ),
        type: z
          .enum(["feature", "task"])
          .describe("Whether this is a 'feature' or 'task'."),
        branchName: z
          .string()
          .min(1)
          .max(255)
          .describe("The git branch name (e.g., 'feature/COM-7-codebase-integration')"),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        if (input.type === "feature") {
          const { data: feature } = await apiClient.getFeature(input.id);
          const { data: result } = await apiClient.linkFeatureBranch(feature.id, input.branchName);
          return createResponse({
            message: `Branch '${input.branchName}' linked to feature ${feature.identifier}`,
            ...result,
          });
        } else {
          const { data: task } = await apiClient.getTask(input.id);
          const { data: result } = await apiClient.linkTaskBranch(task.id, input.branchName);
          return createResponse({
            message: `Branch '${input.branchName}' linked to task ${task.identifier}`,
            ...result,
          });
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`${input.type} '${input.id}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__link_commit
  // ==========================================================================
  server.registerTool(
    "spectree__link_commit",
    {
      description:
        "Link a git commit to a feature or task. Records commits made as part of " +
        "implementing this work item. Multiple commits can be linked. Duplicates are ignored.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature or task identifier. Accepts UUID or human-readable identifier."
          ),
        type: z
          .enum(["feature", "task"])
          .describe("Whether this is a 'feature' or 'task'."),
        commitSha: z
          .string()
          .min(7)
          .max(40)
          .describe("The git commit SHA (short or full, e.g., 'abc1234')"),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        if (input.type === "feature") {
          const { data: feature } = await apiClient.getFeature(input.id);
          const { data: result } = await apiClient.linkFeatureCommit(feature.id, input.commitSha);
          return createResponse({
            message: `Commit '${input.commitSha}' linked to feature ${feature.identifier}`,
            ...result,
          });
        } else {
          const { data: task } = await apiClient.getTask(input.id);
          const { data: result } = await apiClient.linkTaskCommit(task.id, input.commitSha);
          return createResponse({
            message: `Commit '${input.commitSha}' linked to task ${task.identifier}`,
            ...result,
          });
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`${input.type} '${input.id}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__link_pr
  // ==========================================================================
  server.registerTool(
    "spectree__link_pr",
    {
      description:
        "Link a pull request to a feature or task. Records the PR number and URL " +
        "associated with this work item. Only one PR can be linked at a time (replaces previous).",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature or task identifier. Accepts UUID or human-readable identifier."
          ),
        type: z
          .enum(["feature", "task"])
          .describe("Whether this is a 'feature' or 'task'."),
        prNumber: z
          .number()
          .int()
          .positive()
          .describe("The pull request number"),
        prUrl: z
          .string()
          .url()
          .max(2048)
          .describe("The full URL to the pull request"),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        if (input.type === "feature") {
          const { data: feature } = await apiClient.getFeature(input.id);
          const { data: result } = await apiClient.linkFeaturePr(
            feature.id,
            input.prNumber,
            input.prUrl
          );
          return createResponse({
            message: `PR #${input.prNumber} linked to feature ${feature.identifier}`,
            ...result,
          });
        } else {
          const { data: task } = await apiClient.getTask(input.id);
          const { data: result } = await apiClient.linkTaskPr(
            task.id,
            input.prNumber,
            input.prUrl
          );
          return createResponse({
            message: `PR #${input.prNumber} linked to task ${task.identifier}`,
            ...result,
          });
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`${input.type} '${input.id}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );
}
