import { z } from "zod";

/**
 * Validation schemas for Epic entities.
 */

/**
 * Schema for creating a new epic
 */
export const createEpicSchema = z.object({
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
 * Schema for updating an existing epic (teamId cannot be changed)
 */
export const updateEpicSchema = createEpicSchema
  .omit({ teamId: true })
  .partial();

/**
 * Schema for reordering an epic
 * Either afterId or beforeId (or both) can be provided
 */
export const reorderEpicSchema = z.object({
  afterId: z.string().uuid("Invalid after epic ID").optional(),
  beforeId: z.string().uuid("Invalid before epic ID").optional(),
});

// Type exports for use in route handlers
export type CreateEpicInput = z.infer<typeof createEpicSchema>;
export type UpdateEpicInput = z.infer<typeof updateEpicSchema>;
export type ReorderEpicInput = z.infer<typeof reorderEpicSchema>;
