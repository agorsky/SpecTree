import { z } from "zod";

/**
 * Validation schemas for Task entities.
 */

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
});

/**
 * Schema for updating an existing task (featureId cannot be changed)
 */
export const updateTaskSchema = createTaskSchema
  .omit({ featureId: true })
  .partial();

// Type exports for use in route handlers
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
