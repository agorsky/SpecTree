import { z } from "zod";

/**
 * Validation schemas for Project entities.
 */

/**
 * Schema for creating a new project
 */
export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  teamId: z.string().uuid("Invalid team ID"),
  description: z.string().max(5000).optional(),
  icon: z.string().max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  sortOrder: z.number().optional(),
});

/**
 * Schema for updating an existing project (teamId cannot be changed)
 */
export const updateProjectSchema = createProjectSchema
  .omit({ teamId: true })
  .partial();

/**
 * Schema for reordering a project
 * Either afterId or beforeId (or both) can be provided
 */
export const reorderProjectSchema = z.object({
  afterId: z.string().uuid("Invalid after project ID").optional(),
  beforeId: z.string().uuid("Invalid before project ID").optional(),
});

// Type exports for use in route handlers
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ReorderProjectInput = z.infer<typeof reorderProjectSchema>;
