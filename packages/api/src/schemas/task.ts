import { z } from "zod";
import {
  paginationQuerySchema,
  searchQuerySchema,
  dateFilterQuerySchema,
  statusFilterQuerySchema,
  assigneeFilterQuerySchema,
} from "./common.js";

/**
 * Validation schemas for Task entities.
 */

/**
 * Schema for listing tasks with optional filters, search, and date range
 */
export const listTasksQuerySchema = paginationQuerySchema
  .merge(searchQuerySchema)
  .merge(dateFilterQuerySchema)
  .merge(statusFilterQuerySchema)
  .merge(assigneeFilterQuerySchema)
  .extend({
    featureId: z.string().uuid().optional(),
  });

/**
 * Valid values for estimated complexity
 */
export const estimatedComplexityValues = ["trivial", "simple", "moderate", "complex"] as const;
export type EstimatedComplexity = typeof estimatedComplexityValues[number];

/**
 * Schema for execution metadata fields
 */
export const executionMetadataSchema = z.object({
  executionOrder: z.number().int().positive().optional(),
  canParallelize: z.boolean().optional(),
  parallelGroup: z.string().max(100).optional(),
  dependencies: z.array(z.string().uuid()).optional(),
  estimatedComplexity: z.enum(estimatedComplexityValues).optional(),
});

/**
 * Schema for creating a new task
 */
export const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  featureId: z.string().uuid("Invalid feature ID"),
  description: z.string().max(10000).optional(),
  statusId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().optional(),
  // Execution metadata
  executionOrder: z.number().int().positive().optional(),
  canParallelize: z.boolean().optional(),
  parallelGroup: z.string().max(100).optional(),
  dependencies: z.array(z.string().uuid()).optional(),
  estimatedComplexity: z.enum(estimatedComplexityValues).optional(),
});

/**
 * Schema for updating an existing task (featureId cannot be changed)
 */
export const updateTaskSchema = createTaskSchema
  .omit({ featureId: true })
  .partial();

/**
 * Schema for reordering a task within its feature
 * At least one of afterId or beforeId must be provided
 */
export const reorderTaskSchema = z
  .object({
    afterId: z.string().uuid("Invalid afterId format").optional(),
    beforeId: z.string().uuid("Invalid beforeId format").optional(),
  })
  .refine((data) => data.afterId !== undefined || data.beforeId !== undefined, {
    message: "At least one of afterId or beforeId must be provided",
  });

// Type exports for use in route handlers
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ReorderTaskInput = z.infer<typeof reorderTaskSchema>;
export type ExecutionMetadataInput = z.infer<typeof executionMetadataSchema>;
