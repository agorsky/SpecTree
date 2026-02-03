/**
 * MCP Tools for Template operations
 *
 * Provides tools for listing, previewing, creating from, and saving templates.
 * Templates define reusable structures for creating epics with features and tasks.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getApiClient, ApiError } from "../api-client.js";
import { createResponse, createErrorResponse } from "./utils.js";
import { addRemindersToResponse } from "./reminders.js";

/**
 * Helper to resolve team ID from name/key/id via API
 */
async function resolveTeamId(teamQuery: string): Promise<string | null> {
  const apiClient = getApiClient();
  const result = await apiClient.getTeam(teamQuery);
  return result?.data.id ?? null;
}

/**
 * Register all template-related tools
 */
export function registerTemplateTools(server: McpServer): void {
  // ==========================================================================
  // spectree__list_templates
  // ==========================================================================
  server.registerTool(
    "spectree__list_templates",
    {
      description:
        "List all available plan templates. Returns built-in templates first, " +
        "then user-created templates. Each template can be used to create " +
        "a complete epic/feature/task structure with a single command. " +
        "Built-in templates include: Code Feature, Bug Fix, Refactoring, API Endpoint.",
      inputSchema: {},
    },
    async () => {
      try {
        const apiClient = getApiClient();
        const { data: templates } = await apiClient.listTemplates();

        return createResponse({
          templates: templates.map((t) => ({
            name: t.name,
            description: t.description,
            isBuiltIn: t.isBuiltIn,
            featureCount: t.featureCount,
          })),
          count: templates.length,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__get_template
  // ==========================================================================
  server.registerTool(
    "spectree__get_template",
    {
      description:
        "Get detailed information about a specific template by name or ID. " +
        "Returns the complete template structure including all features, tasks, " +
        "and available variable placeholders that can be customized.",
      inputSchema: {
        name: z
          .string()
          .describe(
            "The template name or ID to retrieve (e.g., 'Code Feature', 'Bug Fix')."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const { data: template } = await apiClient.getTemplate(input.name);

        return createResponse({
          id: template.id,
          name: template.name,
          description: template.description,
          isBuiltIn: template.isBuiltIn,
          availableVariables: template.availableVariables,
          structure: template.structure,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Template '${input.name}' not found`));
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__preview_template
  // ==========================================================================
  server.registerTool(
    "spectree__preview_template",
    {
      description:
        "Preview what will be created from a template without actually creating anything. " +
        "Shows the expanded epic name, features, and tasks with variable substitution applied. " +
        "Use this to verify the structure before creating.",
      inputSchema: {
        templateName: z
          .string()
          .describe("The name or ID of the template to preview."),
        epicName: z
          .string()
          .describe("The name to use for the epic that will be created."),
        variables: z
          .record(z.string(), z.string())
          .optional()
          .describe(
            "Key-value pairs for variable substitution. Variables in templates " +
            "use {{variableName}} syntax. For example: { topic: 'Payment Processing' } " +
            "will replace {{topic}} with 'Payment Processing'."
          ),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();
        const { data: preview } = await apiClient.previewTemplate(
          input.templateName,
          input.epicName,
          input.variables
        );

        return createResponse({
          epic: {
            name: preview.epicName,
            description: preview.epicDescription,
            icon: preview.epicIcon,
            color: preview.epicColor,
          },
          features: preview.features.map((f) => ({
            title: f.title,
            description: f.description,
            executionOrder: f.executionOrder,
            canParallelize: f.canParallelize,
            taskCount: f.tasks.length,
            tasks: f.tasks,
          })),
          summary: {
            featureCount: preview.features.length,
            taskCount: preview.features.reduce((sum, f) => sum + f.tasks.length, 0),
          },
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(
            new Error(`Template '${input.templateName}' not found`)
          );
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__create_from_template
  // ==========================================================================
  server.registerTool(
    "spectree__create_from_template",
    {
      description:
        "Create a complete epic with features and tasks from a template. " +
        "This is the main tool for applying templates - it creates everything atomically. " +
        "Returns the created epic with all features and tasks.",
      inputSchema: {
        templateName: z
          .string()
          .describe("The name or ID of the template to use."),
        epicName: z
          .string()
          .min(1)
          .describe("The name for the new epic."),
        team: z
          .string()
          .describe(
            "The team to create the epic in. Accepts team ID (UUID), name, or key " +
            "(e.g., 'Engineering', 'ENG')."
          ),
        variables: z
          .record(z.string(), z.string())
          .optional()
          .describe(
            "Key-value pairs for variable substitution. Variables in templates " +
            "use {{variableName}} syntax."
          ),
        epicDescription: z
          .string()
          .optional()
          .describe("Custom description for the epic. Overrides template default."),
        epicIcon: z
          .string()
          .optional()
          .describe("Custom icon for the epic. Overrides template default."),
        epicColor: z
          .string()
          .optional()
          .describe("Custom color (hex code) for the epic. Overrides template default."),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // Resolve team ID
        const teamId = await resolveTeamId(input.team);
        if (!teamId) {
          throw new Error(`Team '${input.team}' not found`);
        }

        // Build input conditionally to avoid undefined values
        const createInput: {
          epicName: string;
          teamId: string;
          variables?: Record<string, string>;
          epicDescription?: string;
          epicIcon?: string;
          epicColor?: string;
        } = {
          epicName: input.epicName,
          teamId,
        };
        
        if (input.variables !== undefined) {
          createInput.variables = input.variables;
        }
        if (input.epicDescription !== undefined) {
          createInput.epicDescription = input.epicDescription;
        }
        if (input.epicIcon !== undefined) {
          createInput.epicIcon = input.epicIcon;
        }
        if (input.epicColor !== undefined) {
          createInput.epicColor = input.epicColor;
        }

        const { data: result } = await apiClient.createFromTemplate(
          input.templateName,
          createInput
        );

        // Build response with reminders
        const baseResponse = {
          epic: result.epic,
          features: result.features.map((f) => ({
            identifier: f.identifier,
            title: f.title,
            executionOrder: f.executionOrder,
            canParallelize: f.canParallelize,
            tasks: f.tasks.map((t) => ({
              identifier: t.identifier,
              title: t.title,
              executionOrder: t.executionOrder,
            })),
          })),
          summary: {
            featureCount: result.features.length,
            taskCount: result.features.reduce((sum, f) => sum + f.tasks.length, 0),
          },
          message: `Created epic "${result.epic.name}" with ${String(result.features.length)} features and ${String(result.features.reduce((sum, f) => sum + f.tasks.length, 0))} tasks.`,
        };

        // Add contextual reminders for next steps
        const responseWithReminders = addRemindersToResponse(
          baseResponse,
          "create_from_template",
          {
            id: result.epic.id,
            identifier: result.epic.name,
          }
        );

        return createResponse(responseWithReminders);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(
            new Error(`Template '${input.templateName}' not found`)
          );
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // spectree__save_as_template
  // ==========================================================================
  server.registerTool(
    "spectree__save_as_template",
    {
      description:
        "Save an existing epic's structure as a new reusable template. " +
        "Extracts the epic's features and tasks into a template that can be " +
        "used to create similar structures in the future.",
      inputSchema: {
        epicId: z
          .string()
          .describe(
            "The ID or name of the epic to save as a template. " +
            "The epic must have at least one feature."
          ),
        templateName: z
          .string()
          .min(1)
          .max(255)
          .describe("The name for the new template. Must be unique."),
        description: z
          .string()
          .max(5000)
          .optional()
          .describe("Optional description of the template."),
      },
    },
    async (input) => {
      try {
        const apiClient = getApiClient();

        // First resolve epic ID if a name was provided
        let epicId = input.epicId;
        const UUID_REGEX =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!UUID_REGEX.test(input.epicId)) {
          // Look up epic by name
          const { data: epic } = await apiClient.getEpic(input.epicId);
          epicId = epic.id;
        }

        // Build input conditionally to avoid undefined values
        const saveInput: {
          epicId: string;
          templateName: string;
          description?: string;
        } = {
          epicId,
          templateName: input.templateName,
        };
        
        if (input.description !== undefined) {
          saveInput.description = input.description;
        }

        const { data: template } = await apiClient.saveAsTemplate(saveInput);

        return createResponse({
          id: template.id,
          name: template.name,
          description: template.description,
          featureCount: template.structure.features.length,
          message: `Created template "${template.name}" from epic.`,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return createErrorResponse(new Error(`Epic '${input.epicId}' not found`));
        }
        if (error instanceof ApiError && error.status === 409) {
          return createErrorResponse(
            new Error(`Template with name '${input.templateName}' already exists`)
          );
        }
        return createErrorResponse(error);
      }
    }
  );
}
