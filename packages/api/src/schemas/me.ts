import { z } from "zod";
import { statusCategoryEnum } from "./status.js";

/**
 * Validation schemas for /me/* routes (Personal Scope operations).
 */

// =============================================================================
// Response Schemas
// =============================================================================

/**
 * Schema for personal scope response
 */
export const personalScopeResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  _count: z.object({
    projects: z.number().int().min(0),
    statuses: z.number().int().min(0),
  }),
});

// =============================================================================
// Project Schemas
// =============================================================================

/**
 * Schema for creating a personal project
 * Note: personalScopeId is automatically set from authenticated user
 */
export const createPersonalProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(5000).optional(),
  icon: z.string().max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color code")
    .optional(),
  sortOrder: z.number().optional(),
});

/**
 * Schema for listing personal projects query params
 */
export const listPersonalProjectsQuerySchema = z.object({
  cursor: z.string().uuid("Invalid cursor").optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// =============================================================================
// Status Schemas
// =============================================================================

/**
 * Schema for creating a personal status
 * Note: personalScopeId is automatically set from authenticated user
 */
export const createPersonalStatusSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  category: statusCategoryEnum,
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color code")
    .optional(),
  position: z.number().int().min(0).optional(),
});

// =============================================================================
// Type Exports
// =============================================================================

export type PersonalScopeResponse = z.infer<typeof personalScopeResponseSchema>;
export type CreatePersonalProjectInput = z.infer<typeof createPersonalProjectSchema>;
export type ListPersonalProjectsQuery = z.infer<typeof listPersonalProjectsQuerySchema>;
export type CreatePersonalStatusInput = z.infer<typeof createPersonalStatusSchema>;
