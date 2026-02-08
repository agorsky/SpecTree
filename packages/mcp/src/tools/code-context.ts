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
  // spectree__manage_code_context (COMPOSITE TOOL)
  // ==========================================================================
  server.registerTool(
    "spectree__manage_code_context",
    {
      description:
        "Manage code context for features and tasks. This composite tool provides 7 actions:\n\n" +
        "**get_context** - Get all code artifacts (files, functions, branch, commits, PR)\n" +
        "**link_file** - Link a file path to track files involved in implementation\n" +
        "**unlink_file** - Remove a file from the tracked files list\n" +
        "**link_function** - Link a function (stored as 'filePath:functionName')\n" +
        "**link_branch** - Link the git branch used for this work (replaces previous)\n" +
        "**link_commit** - Link a git commit SHA (multiple commits supported)\n" +
        "**link_pr** - Link a pull request by number and URL (replaces previous)\n\n" +
        "Use this instead of individual code context tools for more efficient token usage.",
      inputSchema: z.discriminatedUnion("action", [
        // get_context action
        z.object({
          action: z.literal("get_context").describe("Get all code artifacts"),
          id: z
            .string()
            .describe("Feature or task identifier (UUID or human-readable like 'COM-123')"),
          type: z.enum(["feature", "task"]).describe("Whether this is a 'feature' or 'task'"),
        }),
        // link_file action
        z.object({
          action: z.literal("link_file").describe("Link a file to the work item"),
          id: z
            .string()
            .describe("Feature or task identifier (UUID or human-readable like 'COM-123')"),
          type: z.enum(["feature", "task"]).describe("Whether this is a 'feature' or 'task'"),
          filePath: z
            .string()
            .min(1)
            .max(500)
            .describe("File path to link (e.g., 'src/services/user.ts')"),
        }),
        // unlink_file action
        z.object({
          action: z.literal("unlink_file").describe("Unlink a file from the work item"),
          id: z
            .string()
            .describe("Feature or task identifier (UUID or human-readable like 'COM-123')"),
          type: z.enum(["feature", "task"]).describe("Whether this is a 'feature' or 'task'"),
          filePath: z
            .string()
            .min(1)
            .max(500)
            .describe("File path to unlink"),
        }),
        // link_function action
        z.object({
          action: z.literal("link_function").describe("Link a function to the work item"),
          id: z
            .string()
            .describe("Feature or task identifier (UUID or human-readable like 'COM-123')"),
          type: z.enum(["feature", "task"]).describe("Whether this is a 'feature' or 'task'"),
          filePath: z
            .string()
            .min(1)
            .max(500)
            .describe("File path containing the function"),
          functionName: z
            .string()
            .min(1)
            .max(200)
            .describe("Name of the function"),
        }),
        // link_branch action
        z.object({
          action: z.literal("link_branch").describe("Link a git branch to the work item"),
          id: z
            .string()
            .describe("Feature or task identifier (UUID or human-readable like 'COM-123')"),
          type: z.enum(["feature", "task"]).describe("Whether this is a 'feature' or 'task'"),
          branchName: z
            .string()
            .min(1)
            .max(255)
            .describe("Git branch name (e.g., 'feature/COM-7-integration')"),
        }),
        // link_commit action
        z.object({
          action: z.literal("link_commit").describe("Link a git commit to the work item"),
          id: z
            .string()
            .describe("Feature or task identifier (UUID or human-readable like 'COM-123')"),
          type: z.enum(["feature", "task"]).describe("Whether this is a 'feature' or 'task'"),
          commitSha: z
            .string()
            .min(7)
            .max(40)
            .describe("Git commit SHA (short or full, e.g., 'abc1234')"),
        }),
        // link_pr action
        z.object({
          action: z.literal("link_pr").describe("Link a pull request to the work item"),
          id: z
            .string()
            .describe("Feature or task identifier (UUID or human-readable like 'COM-123')"),
          type: z.enum(["feature", "task"]).describe("Whether this is a 'feature' or 'task'"),
          prNumber: z
            .number()
            .int()
            .positive()
            .describe("Pull request number"),
          prUrl: z
            .string()
            .url()
            .max(2048)
            .describe("Full URL to the pull request"),
        }),
      ]),
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // Route based on action type
        switch (input.action) {
          case "get_context": {
            if (input.type === "feature") {
              const { data: feature } = await apiClient.getFeature(input.id);
              const { data: result } = await apiClient.getFeatureCodeContext(feature.id);
              return createResponse(result);
            } else {
              const { data: task } = await apiClient.getTask(input.id);
              const { data: result } = await apiClient.getTaskCodeContext(task.id);
              return createResponse(result);
            }
          }

          case "link_file": {
            if (input.type === "feature") {
              const { data: feature } = await apiClient.getFeature(input.id);
              const { data: result } = await apiClient.linkFeatureCodeFile(
                feature.id,
                input.filePath
              );
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
          }

          case "unlink_file": {
            if (input.type === "feature") {
              const { data: feature } = await apiClient.getFeature(input.id);
              const { data: result } = await apiClient.unlinkFeatureCodeFile(
                feature.id,
                input.filePath
              );
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
          }

          case "link_function": {
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
          }

          case "link_branch": {
            if (input.type === "feature") {
              const { data: feature } = await apiClient.getFeature(input.id);
              const { data: result } = await apiClient.linkFeatureBranch(
                feature.id,
                input.branchName
              );
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
          }

          case "link_commit": {
            if (input.type === "feature") {
              const { data: feature } = await apiClient.getFeature(input.id);
              const { data: result } = await apiClient.linkFeatureCommit(
                feature.id,
                input.commitSha
              );
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
          }

          case "link_pr": {
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
          }

          default:
            // TypeScript exhaustiveness check ensures this is unreachable
            return createErrorResponse(
              new Error(`Unknown action: ${(input as any).action}`)
            );
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(
            new Error(`${input.type} '${input.id}' not found`)
          );
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__get_code_context
  // ==========================================================================
  server.registerTool(
    "spectree__get_code_context",
    {
      description:
        "⚠️ DEPRECATED: Prefer spectree__manage_code_context with action='get_context'. " +
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
        "⚠️ DEPRECATED: Prefer spectree__manage_code_context with action='link_file'. " +
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
        "⚠️ DEPRECATED: Prefer spectree__manage_code_context with action='unlink_file'. " +
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
        "⚠️ DEPRECATED: Prefer spectree__manage_code_context with action='link_function'. " +
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
        "⚠️ DEPRECATED: Prefer spectree__manage_code_context with action='link_branch'. " +
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
        "⚠️ DEPRECATED: Prefer spectree__manage_code_context with action='link_commit'. " +
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
        "⚠️ DEPRECATED: Prefer spectree__manage_code_context with action='link_pr'. " +
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
