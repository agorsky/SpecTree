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

/**
 * Schema for account activation request
 */
export const activateAccountSchema = z.object({
  email: z.string().email("Invalid email format").transform((e) => e.toLowerCase()),
  code: z
    .string()
    .length(8, "Code must be 8 characters")
    .transform((c) => c.toUpperCase()),
  name: z.string().min(2, "Name must be at least 2 characters"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

// Type exports for use in route handlers
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ActivateAccountInput = z.infer<typeof activateAccountSchema>;
