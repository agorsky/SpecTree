import { z } from "zod";

/**
 * Validation schemas for Status entities.
 */

/**
 * Enum for status categories
 */
export const statusCategoryEnum = z.enum([
  "backlog",
  "unstarted",
  "started",
  "completed",
  "canceled",
]);

/**
 * Schema for creating a new status
 */
export const createStatusSchema = z.object({
  name: z.string().min(1).max(50),
  teamId: z.string().uuid("Invalid team ID"),
  category: statusCategoryEnum,
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  position: z.number().int().min(0).optional(),
});

/**
 * Schema for updating an existing status (teamId cannot be changed)
 */
export const updateStatusSchema = createStatusSchema
  .omit({ teamId: true })
  .partial();

// Type exports for use in route handlers
export type StatusCategory = z.infer<typeof statusCategoryEnum>;
export type CreateStatusInput = z.infer<typeof createStatusSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
