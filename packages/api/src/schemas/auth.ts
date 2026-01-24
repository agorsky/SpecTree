import { z } from "zod";

/**
 * Validation schemas for authentication endpoints.
 */

/**
 * Schema for login request
 */
export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

/**
 * Schema for refresh token request
 */
export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

// Type exports for use in route handlers
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
