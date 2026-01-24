import { z } from "zod";

/**
 * Validation schemas for Team entities.
 */

/**
 * Schema for creating a new team
 */
export const createTeamSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  key: z
    .string()
    .min(1)
    .max(10)
    .regex(/^[A-Z]+$/, "Key must be uppercase letters only"),
  description: z.string().max(5000).optional(),
  icon: z.string().max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be valid hex color")
    .optional(),
});

/**
 * Schema for updating an existing team (all fields optional)
 */
export const updateTeamSchema = createTeamSchema.partial();

// Type exports for use in route handlers
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
