/**
 * Reusable utilities for building composite tools with action-based routing
 * 
 * This module provides helpers for creating composite tools that consolidate
 * multiple related operations behind an action parameter. Uses Zod discriminated
 * unions for type-safe action routing.
 * 
 * @module composite-builder
 */

import { z } from "zod";

/**
 * Action definition for building composite schemas
 */
export interface ActionDefinition<T extends z.ZodRawShape> {
  /** The action name (literal value) */
  action: string;
  /** Zod schema for this action's parameters (excluding the action field) */
  schema: z.ZodObject<T>;
  /** Human-readable description of what this action does */
  description: string;
}

/**
 * Build a Zod discriminated union schema for action-based routing
 * 
 * Takes an array of action definitions and creates a discriminated union
 * that provides type-safe parameter validation per action.
 * 
 * @example
 * ```typescript
 * const schema = buildCompositeSchema([
 *   {
 *     action: "create",
 *     schema: z.object({
 *       name: z.string(),
 *       description: z.string().optional(),
 *     }),
 *     description: "Create a new project",
 *   },
 *   {
 *     action: "update",
 *     schema: z.object({
 *       id: z.string(),
 *       name: z.string().optional(),
 *     }),
 *     description: "Update an existing project",
 *   },
 * ]);
 * ```
 * 
 * @param actions - Array of action definitions
 * @returns Zod discriminated union schema
 */
export function buildCompositeSchema(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actions: readonly [ActionDefinition<any>, ...ActionDefinition<any>[]]
) {
  // Convert action definitions to Zod objects with action literal
  const actionSchemas = actions.map((actionDef) =>
    actionDef.schema.extend({
      action: z.literal(actionDef.action).describe(actionDef.description),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as unknown as [z.ZodObject<any>, z.ZodObject<any>, ...z.ZodObject<any>[]];

  return z.discriminatedUnion("action", actionSchemas);
}

/**
 * Handler function for a specific action
 */
export type ActionHandler<TInput = unknown, TOutput = unknown> = (
  input: TInput
) => Promise<TOutput> | TOutput;

/**
 * Map of action names to handler functions
 */
export type ActionHandlers<TInput = unknown, TOutput = unknown> = Record<
  string,
  ActionHandler<TInput, TOutput>
>;

/**
 * Route an action to its handler function
 * 
 * Dispatches to the appropriate handler based on the action field.
 * Provides centralized error handling and unknown action detection.
 * 
 * @example
 * ```typescript
 * const result = await routeAction(input.action, {
 *   create: async (params) => createProject(params),
 *   update: async (params) => updateProject(params),
 *   delete: async (params) => deleteProject(params),
 * }, input);
 * ```
 * 
 * @param action - The action string from validated input
 * @param handlers - Map of action names to handler functions
 * @param input - The full validated input object (passed to handler)
 * @returns Result from the handler function
 * @throws {Error} If action is not found in handlers map
 */
export async function routeAction<TInput extends { action: string }, TOutput>(
  action: string,
  handlers: ActionHandlers<TInput, TOutput>,
  input: TInput
): Promise<TOutput> {
  const handler = handlers[action];

  if (!handler) {
    const availableActions = Object.keys(handlers).join(", ");
    throw new Error(
      `Unknown action: '${action}'. Available actions: ${availableActions}`
    );
  }

  return await handler(input);
}

/**
 * Standard success response format
 */
export interface CompositeResponse<T = unknown> {
  /** Success indicator */
  success: boolean;
  /** Human-readable message */
  message: string;
  /** Response data (optional) */
  data?: T;
  /** Additional metadata (optional) */
  meta?: Record<string, unknown>;
}

/**
 * Format a successful composite tool response
 * 
 * Creates a standardized response object for successful operations.
 * Use this for consistency across all composite tools.
 * 
 * @example
 * ```typescript
 * return formatCompositeResponse({
 *   message: "Project created successfully",
 *   data: { id: "abc-123", name: "New Project" },
 * });
 * ```
 * 
 * @param options - Response options
 * @returns Formatted response object
 */
export function formatCompositeResponse<T = unknown>(options: {
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
}): CompositeResponse<T> {
  return {
    success: true,
    message: options.message,
    ...(options.data !== undefined && { data: options.data }),
    ...(options.meta !== undefined && { meta: options.meta }),
  };
}

/**
 * Format a composite list response with pagination
 * 
 * Standardized format for list responses with optional pagination metadata.
 * 
 * @example
 * ```typescript
 * return formatCompositeListResponse({
 *   message: "Found 10 projects",
 *   items: projects,
 *   total: 10,
 *   cursor: "next-page-cursor",
 * });
 * ```
 * 
 * @param options - List response options
 * @returns Formatted list response
 */
export function formatCompositeListResponse<T = unknown>(options: {
  message: string;
  items: T[];
  total?: number;
  cursor?: string | null;
  limit?: number;
}): CompositeResponse<T[]> {
  const meta: Record<string, unknown> = {};
  
  if (options.total !== undefined) meta.total = options.total;
  if (options.cursor !== undefined) meta.cursor = options.cursor;
  if (options.limit !== undefined) meta.limit = options.limit;

  return {
    success: true,
    message: options.message,
    data: options.items,
    ...(Object.keys(meta).length > 0 && { meta }),
  };
}

/**
 * Build a tool description that documents all available actions
 * 
 * Creates a formatted description string that lists all actions
 * and their purposes. Use this in the tool's description field.
 * 
 * @example
 * ```typescript
 * const description = buildActionDescription(
 *   "Manage projects with action-based routing.",
 *   [
 *     { action: "create", description: "Create a new project" },
 *     { action: "update", description: "Update an existing project" },
 *     { action: "delete", description: "Delete a project" },
 *   ]
 * );
 * ```
 * 
 * @param intro - Introductory text for the tool
 * @param actions - Array of action definitions
 * @returns Formatted description string
 */
export function buildActionDescription(
  intro: string,
  actions: Pick<ActionDefinition<z.ZodRawShape>, "action" | "description">[]
): string {
  const actionList = actions
    .map((a) => `- '${a.action}': ${a.description}`)
    .join("\n");

  return (
    `${intro}\n\n` +
    "Actions:\n" +
    `${actionList}\n\n` +
    "Use the 'action' parameter to specify which operation to perform. " +
    "Each action has its own required parameters shown in the schema."
  );
}

/**
 * Type guard to check if a value has an action property
 */
export function hasAction(value: unknown): value is { action: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "action" in value &&
    typeof (value as { action: unknown }).action === "string"
  );
}

/**
 * Extract action name from validated input (type-safe)
 */
export function getAction(input: { action: string }): string {
  return input.action;
}
