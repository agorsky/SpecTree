import { z } from "zod";

/**
 * Validation schemas for User entities.
 */

/**
 * Schema for creating a new user
 */
export const createUserSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(1).max(255),
  password: z.string().min(8, "Password must be at least 8 characters"),
  avatarUrl: z.string().url().max(500).nullable().optional(),
});

/**
 * Schema for updating an existing user (all fields optional)
 */
export const updateUserSchema = createUserSchema.partial();

// Type exports for use in route handlers
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
