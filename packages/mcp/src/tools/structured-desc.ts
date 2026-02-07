/**
 * MCP Tools for Structured Description operations
 *
 * Provides tools for AI agents to work with structured, machine-readable
 * description sections instead of unstructured freeform text.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getApiClient,
  ApiError,
  type StructuredDescription,
  type StructuredDescriptionSection,
} from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";

// Valid section names for the update_section tool
const SECTION_NAMES = [
  "summary",
  "aiInstructions",
  "acceptanceCriteria",
  "filesInvolved",
  "functionsToModify",
  "testingStrategy",
  "testFiles",
  "relatedItemIds",
  "externalLinks",
  "technicalNotes",
  "riskLevel",
  "estimatedEffort",
] as const;

// Register all structured description tools
export function registerStructuredDescTools(server: McpServer): void {
  // ==========================================================================
  // spectree__get_structured_description
  // ==========================================================================
  server.registerTool(
    "spectree__get_structured_description",
    {
      description:
        "Get the structured description for a feature, task, or epic. Returns parsed sections like " +
        "summary, aiInstructions, acceptanceCriteria, filesInvolved, etc. Use this to extract " +
        "specific information about what needs to be done without parsing freeform text.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature, task, or epic identifier. Accepts UUID or human-readable identifier " +
            "(e.g., 'COM-123' for features, 'COM-123-1' for tasks). Epics use UUID or exact name."
          ),
        type: z
          .enum(["feature", "task", "epic"])
          .describe("Whether this is a 'feature', 'task', or 'epic'."),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        if (input.type === "feature") {
          const { data: feature } = await apiClient.getFeature(input.id);
          const { data: result } = await apiClient.getFeatureStructuredDesc(feature.id);
          return createResponse({
            entityType: "feature",
            entityId: feature.id,
            identifier: feature.identifier,
            ...result,
          });
        } else if (input.type === "epic") {
          const { data: epic } = await apiClient.getEpic(input.id);
          const { data: result } = await apiClient.getEpicStructuredDesc(epic.id);
          return createResponse({
            entityType: "epic",
            entityId: epic.id,
            name: epic.name,
            ...result,
          });
        } else {
          const { data: task } = await apiClient.getTask(input.id);
          const { data: result } = await apiClient.getTaskStructuredDesc(task.id);
          return createResponse({
            entityType: "task",
            entityId: task.id,
            identifier: task.identifier,
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
  // spectree__set_structured_description
  // ==========================================================================
  server.registerTool(
    "spectree__set_structured_description",
    {
      description:
        "Set the entire structured description for a feature, task, or epic. This replaces any " +
        "existing structured description. The 'summary' field is required. For partial " +
        "updates, use spectree__update_section instead.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature, task, or epic identifier. Accepts UUID or human-readable identifier. Epics use UUID or exact name."
          ),
        type: z
          .enum(["feature", "task", "epic"])
          .describe("Whether this is a 'feature', 'task', or 'epic'."),
        structuredDesc: z.object({
          summary: z.string().describe("Required: Human-readable summary"),
          aiInstructions: z.string().optional().describe("Instructions specifically for AI agents"),
          acceptanceCriteria: z.array(z.string()).optional().describe("List of acceptance criteria"),
          filesInvolved: z.array(z.string()).optional().describe("File paths involved"),
          functionsToModify: z.array(z.string()).optional().describe("Functions to modify (format: 'file:function')"),
          testingStrategy: z.string().optional().describe("Testing approach"),
          testFiles: z.array(z.string()).optional().describe("Test file paths"),
          relatedItemIds: z.array(z.string()).optional().describe("Related feature/task IDs"),
          externalLinks: z.array(z.object({
            url: z.string(),
            title: z.string(),
          })).optional().describe("External documentation links"),
          technicalNotes: z.string().optional().describe("Technical implementation notes"),
          riskLevel: z.enum(["low", "medium", "high"]).optional().describe("Risk assessment"),
          estimatedEffort: z.enum(["trivial", "small", "medium", "large", "xl"]).optional()
            .describe("Effort estimate: trivial (<1hr), small (1-4hr), medium (1-2d), large (3-5d), xl (>5d)"),
        }).describe("The structured description object"),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        if (input.type === "feature") {
          const { data: feature } = await apiClient.getFeature(input.id);
          const { data: result } = await apiClient.setFeatureStructuredDesc(
            feature.id,
            input.structuredDesc as StructuredDescription
          );
          return createResponse({
            entityType: "feature",
            entityId: feature.id,
            identifier: feature.identifier,
            message: "Structured description set successfully",
            ...result,
          });
        } else if (input.type === "epic") {
          const { data: epic } = await apiClient.getEpic(input.id);
          const { data: result } = await apiClient.setEpicStructuredDesc(
            epic.id,
            input.structuredDesc as StructuredDescription
          );
          return createResponse({
            entityType: "epic",
            entityId: epic.id,
            name: epic.name,
            message: "Structured description set successfully",
            ...result,
          });
        } else {
          const { data: task } = await apiClient.getTask(input.id);
          const { data: result } = await apiClient.setTaskStructuredDesc(
            task.id,
            input.structuredDesc as StructuredDescription
          );
          return createResponse({
            entityType: "task",
            entityId: task.id,
            identifier: task.identifier,
            message: "Structured description set successfully",
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
  // spectree__update_section
  // ==========================================================================
  server.registerTool(
    "spectree__update_section",
    {
      description:
        "Update a specific section of a feature, task, or epic's structured description without " +
        "touching other sections. Use this for targeted updates instead of replacing everything.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature, task, or epic identifier. Accepts UUID or human-readable identifier. Epics use UUID or exact name."
          ),
        type: z
          .enum(["feature", "task", "epic"])
          .describe("Whether this is a 'feature', 'task', or 'epic'."),
        section: z
          .enum(SECTION_NAMES)
          .describe(
            "The section to update: summary, aiInstructions, acceptanceCriteria, " +
            "filesInvolved, functionsToModify, testingStrategy, testFiles, " +
            "relatedItemIds, externalLinks, technicalNotes, riskLevel, estimatedEffort"
          ),
        value: z
          .unknown()
          .describe(
            "The new value for the section. Type depends on section: " +
            "string for summary/aiInstructions/testingStrategy/technicalNotes, " +
            "string[] for acceptanceCriteria/filesInvolved/functionsToModify/testFiles/relatedItemIds, " +
            "{ url: string, title: string }[] for externalLinks, " +
            "'low'|'medium'|'high' for riskLevel, " +
            "'trivial'|'small'|'medium'|'large'|'xl' for estimatedEffort"
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        if (input.type === "feature") {
          const { data: feature } = await apiClient.getFeature(input.id);
          const { data: result } = await apiClient.updateFeatureSection(
            feature.id,
            input.section as StructuredDescriptionSection,
            input.value
          );
          return createResponse({
            entityType: "feature",
            entityId: feature.id,
            identifier: feature.identifier,
            sectionUpdated: input.section,
            ...result,
          });
        } else if (input.type === "epic") {
          const { data: epic } = await apiClient.getEpic(input.id);
          const { data: result } = await apiClient.updateEpicSection(
            epic.id,
            input.section as StructuredDescriptionSection,
            input.value
          );
          return createResponse({
            entityType: "epic",
            entityId: epic.id,
            name: epic.name,
            sectionUpdated: input.section,
            ...result,
          });
        } else {
          const { data: task } = await apiClient.getTask(input.id);
          const { data: result } = await apiClient.updateTaskSection(
            task.id,
            input.section as StructuredDescriptionSection,
            input.value
          );
          return createResponse({
            entityType: "task",
            entityId: task.id,
            identifier: task.identifier,
            sectionUpdated: input.section,
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
  // spectree__add_acceptance_criterion
  // ==========================================================================
  server.registerTool(
    "spectree__add_acceptance_criterion",
    {
      description:
        "Add an acceptance criterion to a feature, task, or epic. This appends to the existing " +
        "list without removing other criteria. Duplicates are ignored.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature, task, or epic identifier. Accepts UUID or human-readable identifier. Epics use UUID or exact name."
          ),
        type: z
          .enum(["feature", "task", "epic"])
          .describe("Whether this is a 'feature', 'task', or 'epic'."),
        criterion: z
          .string()
          .min(1)
          .max(1000)
          .describe("The acceptance criterion to add (e.g., 'All unit tests pass')"),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        if (input.type === "feature") {
          const { data: feature } = await apiClient.getFeature(input.id);
          const { data: result } = await apiClient.addFeatureAcceptanceCriterion(
            feature.id,
            input.criterion
          );
          return createResponse({
            entityType: "feature",
            entityId: feature.id,
            identifier: feature.identifier,
            criterionAdded: input.criterion,
            totalCriteria: result.structuredDesc?.acceptanceCriteria?.length ?? 0,
            ...result,
          });
        } else if (input.type === "epic") {
          const { data: epic } = await apiClient.getEpic(input.id);
          const { data: result } = await apiClient.addEpicAcceptanceCriterion(
            epic.id,
            input.criterion
          );
          return createResponse({
            entityType: "epic",
            entityId: epic.id,
            name: epic.name,
            criterionAdded: input.criterion,
            totalCriteria: result.structuredDesc?.acceptanceCriteria?.length ?? 0,
            ...result,
          });
        } else {
          const { data: task } = await apiClient.getTask(input.id);
          const { data: result } = await apiClient.addTaskAcceptanceCriterion(
            task.id,
            input.criterion
          );
          return createResponse({
            entityType: "task",
            entityId: task.id,
            identifier: task.identifier,
            criterionAdded: input.criterion,
            totalCriteria: result.structuredDesc?.acceptanceCriteria?.length ?? 0,
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
  // spectree__link_file
  // ==========================================================================
  server.registerTool(
    "spectree__link_file",
    {
      description:
        "Link a file to a feature, task, or epic. This appends the file path to the filesInvolved " +
        "list. Useful for tracking which files are involved in implementing an item. " +
        "Duplicates are ignored.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature, task, or epic identifier. Accepts UUID or human-readable identifier. Epics use UUID or exact name."
          ),
        type: z
          .enum(["feature", "task", "epic"])
          .describe("Whether this is a 'feature', 'task', or 'epic'."),
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
          const { data: result } = await apiClient.linkFeatureFile(feature.id, input.filePath);
          return createResponse({
            entityType: "feature",
            entityId: feature.id,
            identifier: feature.identifier,
            fileLinked: input.filePath,
            totalFiles: result.structuredDesc?.filesInvolved?.length ?? 0,
            ...result,
          });
        } else if (input.type === "epic") {
          const { data: epic } = await apiClient.getEpic(input.id);
          const { data: result } = await apiClient.linkEpicFile(epic.id, input.filePath);
          return createResponse({
            entityType: "epic",
            entityId: epic.id,
            name: epic.name,
            fileLinked: input.filePath,
            totalFiles: result.structuredDesc?.filesInvolved?.length ?? 0,
            ...result,
          });
        } else {
          const { data: task } = await apiClient.getTask(input.id);
          const { data: result } = await apiClient.linkTaskFile(task.id, input.filePath);
          return createResponse({
            entityType: "task",
            entityId: task.id,
            identifier: task.identifier,
            fileLinked: input.filePath,
            totalFiles: result.structuredDesc?.filesInvolved?.length ?? 0,
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
  // spectree__add_external_link
  // ==========================================================================
  server.registerTool(
    "spectree__add_external_link",
    {
      description:
        "Add an external link to a feature, task, or epic. Useful for linking to documentation, " +
        "PRs, design docs, or other external resources. Duplicates (by URL) are ignored.",
      inputSchema: {
        id: z
          .string()
          .describe(
            "The feature, task, or epic identifier. Accepts UUID or human-readable identifier. Epics use UUID or exact name."
          ),
        type: z
          .enum(["feature", "task", "epic"])
          .describe("Whether this is a 'feature', 'task', or 'epic'."),
        url: z
          .string()
          .url()
          .describe("The URL to link (e.g., 'https://docs.example.com/feature')"),
        title: z
          .string()
          .min(1)
          .max(255)
          .describe("A descriptive title for the link"),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const link = { url: input.url, title: input.title };

        if (input.type === "feature") {
          const { data: feature } = await apiClient.getFeature(input.id);
          const { data: result } = await apiClient.addFeatureExternalLink(feature.id, link);
          return createResponse({
            entityType: "feature",
            entityId: feature.id,
            identifier: feature.identifier,
            linkAdded: link,
            totalLinks: result.structuredDesc?.externalLinks?.length ?? 0,
            ...result,
          });
        } else if (input.type === "epic") {
          const { data: epic } = await apiClient.getEpic(input.id);
          const { data: result } = await apiClient.addEpicExternalLink(epic.id, link);
          return createResponse({
            entityType: "epic",
            entityId: epic.id,
            name: epic.name,
            linkAdded: link,
            totalLinks: result.structuredDesc?.externalLinks?.length ?? 0,
            ...result,
          });
        } else {
          const { data: task } = await apiClient.getTask(input.id);
          const { data: result } = await apiClient.addTaskExternalLink(task.id, link);
          return createResponse({
            entityType: "task",
            entityId: task.id,
            identifier: task.identifier,
            linkAdded: link,
            totalLinks: result.structuredDesc?.externalLinks?.length ?? 0,
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
