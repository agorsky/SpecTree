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

// Shared base schema for composite tool actions
const baseSchema = {
  id: z.string().describe(
    "The feature, task, or epic identifier. Accepts UUID or human-readable identifier " +
    "(e.g., 'COM-123' for features, 'COM-123-1' for tasks). Epics use UUID or exact name."
  ),
  type: z.enum(["feature", "task", "epic"]).describe("Whether this is a 'feature', 'task', or 'epic'."),
};

// Register all structured description tools
export function registerStructuredDescTools(server: McpServer): void {
  // ==========================================================================
  // spectree__manage_description - NEW Consolidated Tool
  // ==========================================================================
  server.registerTool(
    "spectree__manage_description",
    {
      description:
        "✨ CONSOLIDATED TOOL: Manage structured descriptions for features, tasks, and epics. " +
        "Replaces 6 separate tools with a single interface.\n\n" +
        "**Actions:**\n" +
        "• 'get': Retrieve structured description with all sections\n" +
        "• 'set': Replace entire structured description (requires summary)\n" +
        "• 'update_section': Update a single section without affecting others\n" +
        "• 'add_criterion': Append acceptance criterion (deduplicates)\n" +
        "• 'link_file': Add file path to filesInvolved (deduplicates)\n" +
        "• 'add_link': Add external documentation link (deduplicates by URL)\n\n" +
        "Use this tool instead of the deprecated individual tools for better token efficiency.",
      inputSchema: z.discriminatedUnion("action", [
        // Action: get
        z.object({
          action: z.literal("get"),
          ...baseSchema,
        }),
        // Action: set
        z.object({
          action: z.literal("set"),
          ...baseSchema,
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
          }),
        }),
        // Action: update_section
        z.object({
          action: z.literal("update_section"),
          ...baseSchema,
          section: z.enum(SECTION_NAMES).describe(
            "Section to update: summary, aiInstructions, acceptanceCriteria, filesInvolved, " +
            "functionsToModify, testingStrategy, testFiles, relatedItemIds, externalLinks, " +
            "technicalNotes, riskLevel, estimatedEffort"
          ),
          value: z.unknown().describe(
            "New value (type varies by section: string, string[], object[], or enum)"
          ),
        }),
        // Action: add_criterion
        z.object({
          action: z.literal("add_criterion"),
          ...baseSchema,
          criterion: z.string().min(1).max(1000).describe(
            "Acceptance criterion to add (e.g., 'All unit tests pass')"
          ),
        }),
        // Action: link_file
        z.object({
          action: z.literal("link_file"),
          ...baseSchema,
          filePath: z.string().min(1).max(500).describe(
            "File path to link (e.g., 'src/services/user.ts')"
          ),
        }),
        // Action: add_link
        z.object({
          action: z.literal("add_link"),
          ...baseSchema,
          url: z.string().url().describe("URL to link"),
          title: z.string().min(1).max(255).describe("Descriptive title for the link"),
        }),
      ]),
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // Resolve entity (feature, task, or epic)
        let entityId: string;
        let entityIdentifier: string | undefined;
        let entityName: string | undefined;

        if (input.type === "feature") {
          const { data: feature } = await apiClient.getFeature(input.id);
          entityId = feature.id;
          entityIdentifier = feature.identifier;
        } else if (input.type === "epic") {
          const { data: epic } = await apiClient.getEpic(input.id);
          entityId = epic.id;
          entityName = epic.name;
        } else {
          const { data: task } = await apiClient.getTask(input.id);
          entityId = task.id;
          entityIdentifier = task.identifier;
        }

        // Execute action-specific logic
        let result: any;
        let actionMessage: string | undefined;

        switch (input.action) {
          case "get": {
            if (input.type === "feature") {
              const { data } = await apiClient.getFeatureStructuredDesc(entityId);
              result = data;
            } else if (input.type === "epic") {
              const { data } = await apiClient.getEpicStructuredDesc(entityId);
              result = data;
            } else {
              const { data } = await apiClient.getTaskStructuredDesc(entityId);
              result = data;
            }
            break;
          }

          case "set": {
            if (input.type === "feature") {
              const { data } = await apiClient.setFeatureStructuredDesc(
                entityId,
                input.structuredDesc as StructuredDescription
              );
              result = data;
            } else if (input.type === "epic") {
              const { data } = await apiClient.setEpicStructuredDesc(
                entityId,
                input.structuredDesc as StructuredDescription
              );
              result = data;
            } else {
              const { data } = await apiClient.setTaskStructuredDesc(
                entityId,
                input.structuredDesc as StructuredDescription
              );
              result = data;
            }
            actionMessage = "Structured description set successfully";
            break;
          }

          case "update_section": {
            if (input.type === "feature") {
              const { data } = await apiClient.updateFeatureSection(
                entityId,
                input.section as StructuredDescriptionSection,
                input.value
              );
              result = data;
            } else if (input.type === "epic") {
              const { data } = await apiClient.updateEpicSection(
                entityId,
                input.section as StructuredDescriptionSection,
                input.value
              );
              result = data;
            } else {
              const { data } = await apiClient.updateTaskSection(
                entityId,
                input.section as StructuredDescriptionSection,
                input.value
              );
              result = data;
            }
            actionMessage = `Section '${input.section}' updated successfully`;
            break;
          }

          case "add_criterion": {
            if (input.type === "feature") {
              const { data } = await apiClient.addFeatureAcceptanceCriterion(
                entityId,
                input.criterion
              );
              result = data;
            } else if (input.type === "epic") {
              const { data } = await apiClient.addEpicAcceptanceCriterion(
                entityId,
                input.criterion
              );
              result = data;
            } else {
              const { data } = await apiClient.addTaskAcceptanceCriterion(
                entityId,
                input.criterion
              );
              result = data;
            }
            const totalCriteria = result.structuredDesc?.acceptanceCriteria?.length ?? 0;
            actionMessage = `Added criterion. Total: ${totalCriteria}`;
            break;
          }

          case "link_file": {
            if (input.type === "feature") {
              const { data } = await apiClient.linkFeatureFile(entityId, input.filePath);
              result = data;
            } else if (input.type === "epic") {
              const { data } = await apiClient.linkEpicFile(entityId, input.filePath);
              result = data;
            } else {
              const { data } = await apiClient.linkTaskFile(entityId, input.filePath);
              result = data;
            }
            const totalFiles = result.structuredDesc?.filesInvolved?.length ?? 0;
            actionMessage = `Linked file '${input.filePath}'. Total: ${totalFiles}`;
            break;
          }

          case "add_link": {
            const link = { url: input.url, title: input.title };
            if (input.type === "feature") {
              const { data } = await apiClient.addFeatureExternalLink(entityId, link);
              result = data;
            } else if (input.type === "epic") {
              const { data } = await apiClient.addEpicExternalLink(entityId, link);
              result = data;
            } else {
              const { data } = await apiClient.addTaskExternalLink(entityId, link);
              result = data;
            }
            const totalLinks = result.structuredDesc?.externalLinks?.length ?? 0;
            actionMessage = `Added link '${input.title}'. Total: ${totalLinks}`;
            break;
          }
        }

        // Build response
        const response: any = {
          entityType: input.type,
          entityId,
          action: input.action,
          ...result,
        };

        if (entityIdentifier) response.identifier = entityIdentifier;
        if (entityName) response.name = entityName;
        if (actionMessage) response.message = actionMessage;

        return createResponse(response);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`${input.type} '${input.id}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // DEPRECATED TOOLS - Use spectree__manage_description instead
  // ==========================================================================
  // The following 6 tools are kept for backwards compatibility but are deprecated.
  // Please use spectree__manage_description with the appropriate action instead.

  // ==========================================================================
  // spectree__get_structured_description [DEPRECATED]
  // ==========================================================================
  server.registerTool(
    "spectree__get_structured_description",
    {
      description:
        "⚠️ DEPRECATED: Use spectree__manage_description with action='get' instead.\n\n" +
        "Get the structured description for a feature, task, or epic. Returns parsed sections like " +
        "summary, aiInstructions, acceptanceCriteria, filesInvolved, etc.",
      inputSchema: {
        id: z.string().describe(
          "The feature, task, or epic identifier. Accepts UUID or human-readable identifier " +
          "(e.g., 'COM-123' for features, 'COM-123-1' for tasks). Epics use UUID or exact name."
        ),
        type: z.enum(["feature", "task", "epic"]).describe("Whether this is a 'feature', 'task', or 'epic'."),
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
  // spectree__set_structured_description [DEPRECATED]
  // ==========================================================================
  server.registerTool(
    "spectree__set_structured_description",
    {
      description:
        "⚠️ DEPRECATED: Use spectree__manage_description with action='set' instead.\n\n" +
        "Set the entire structured description for a feature, task, or epic. This replaces any " +
        "existing structured description. The 'summary' field is required.",
      inputSchema: {
        id: z.string().describe(
          "The feature, task, or epic identifier. Accepts UUID or human-readable identifier. Epics use UUID or exact name."
        ),
        type: z.enum(["feature", "task", "epic"]).describe("Whether this is a 'feature', 'task', or 'epic'."),
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
  // spectree__update_section [DEPRECATED]
  // ==========================================================================
  server.registerTool(
    "spectree__update_section",
    {
      description:
        "⚠️ DEPRECATED: Use spectree__manage_description with action='update_section' instead.\n\n" +
        "Update a specific section of a feature, task, or epic's structured description without " +
        "touching other sections.",
      inputSchema: {
        id: z.string().describe(
          "The feature, task, or epic identifier. Accepts UUID or human-readable identifier. Epics use UUID or exact name."
        ),
        type: z.enum(["feature", "task", "epic"]).describe("Whether this is a 'feature', 'task', or 'epic'."),
        section: z.enum(SECTION_NAMES).describe(
          "The section to update: summary, aiInstructions, acceptanceCriteria, " +
          "filesInvolved, functionsToModify, testingStrategy, testFiles, " +
          "relatedItemIds, externalLinks, technicalNotes, riskLevel, estimatedEffort"
        ),
        value: z.unknown().describe(
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
  // spectree__add_acceptance_criterion [DEPRECATED]
  // ==========================================================================
  server.registerTool(
    "spectree__add_acceptance_criterion",
    {
      description:
        "⚠️ DEPRECATED: Use spectree__manage_description with action='add_criterion' instead.\n\n" +
        "Add an acceptance criterion to a feature, task, or epic. This appends to the existing " +
        "list without removing other criteria. Duplicates are ignored.",
      inputSchema: {
        id: z.string().describe(
          "The feature, task, or epic identifier. Accepts UUID or human-readable identifier. Epics use UUID or exact name."
        ),
        type: z.enum(["feature", "task", "epic"]).describe("Whether this is a 'feature', 'task', or 'epic'."),
        criterion: z.string().min(1).max(1000).describe("The acceptance criterion to add (e.g., 'All unit tests pass')"),
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
  // spectree__link_file [DEPRECATED]
  // ==========================================================================
  server.registerTool(
    "spectree__link_file",
    {
      description:
        "⚠️ DEPRECATED: Use spectree__manage_description with action='link_file' instead.\n\n" +
        "Link a file to a feature, task, or epic. This appends the file path to the filesInvolved " +
        "list. Useful for tracking which files are involved in implementing an item. " +
        "Duplicates are ignored.",
      inputSchema: {
        id: z.string().describe(
          "The feature, task, or epic identifier. Accepts UUID or human-readable identifier. Epics use UUID or exact name."
        ),
        type: z.enum(["feature", "task", "epic"]).describe("Whether this is a 'feature', 'task', or 'epic'."),
        filePath: z.string().min(1).max(500).describe("The file path to link (e.g., 'src/services/user.ts')"),
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
  // spectree__add_external_link [DEPRECATED]
  // ==========================================================================
  server.registerTool(
    "spectree__add_external_link",
    {
      description:
        "⚠️ DEPRECATED: Use spectree__manage_description with action='add_link' instead.\n\n" +
        "Add an external link to a feature, task, or epic. Useful for linking to documentation, " +
        "PRs, design docs, or other external resources. Duplicates (by URL) are ignored.",
      inputSchema: {
        id: z.string().describe(
          "The feature, task, or epic identifier. Accepts UUID or human-readable identifier. Epics use UUID or exact name."
        ),
        type: z.enum(["feature", "task", "epic"]).describe("Whether this is a 'feature', 'task', or 'epic'."),
        url: z.string().url().describe("The URL to link (e.g., 'https://docs.example.com/feature')"),
        title: z.string().min(1).max(255).describe("A descriptive title for the link"),
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
