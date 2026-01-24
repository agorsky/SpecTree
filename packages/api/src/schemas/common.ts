import { z } from "zod";

/**
 * Common validation schemas used across multiple routes.
 */

/**
 * Schema for validating UUID parameters (e.g., /:id)
 */
export const uuidParamSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});

/**
 * Schema for cursor-based pagination query parameters
 */
export const paginationQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// Type exports for use in route handlers
export type UuidParam = z.infer<typeof uuidParamSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
