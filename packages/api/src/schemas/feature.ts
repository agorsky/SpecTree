import { z } from "zod";

/**
 * Validation schemas for Feature entities.
 */

/**
 * Schema for creating a new feature
 */
export const createFeatureSchema = z.object({
  title: z.string().min(1).max(255),
  projectId: z.string().uuid("Invalid project ID"),
  description: z.string().max(10000).optional(),
  statusId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().optional(),
});

/**
 * Schema for updating an existing feature (projectId cannot be changed)
 */
export const updateFeatureSchema = createFeatureSchema
  .omit({ projectId: true })
  .partial();

// Type exports for use in route handlers
export type CreateFeatureInput = z.infer<typeof createFeatureSchema>;
export type UpdateFeatureInput = z.infer<typeof updateFeatureSchema>;
