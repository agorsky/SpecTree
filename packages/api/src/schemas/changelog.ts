import { z } from "zod";
import { paginationQuerySchema, dateFilterQuerySchema } from "./common.js";

/**
 * Validation schemas for Changelog entities.
 * Changelogs are append-only records that track field-level changes to entities.
 */

/**
 * Valid entity types for changelog queries
 */
export const entityTypeValues = ["epic", "feature", "task"] as const;
export type EntityType = (typeof entityTypeValues)[number];

/**
 * Schema for validating entity changelog query parameters.
 * Used for GET /api/v1/changelog/:entityType/:entityId
 */
export const entityChangelogQuerySchema = paginationQuerySchema
  .merge(dateFilterQuerySchema)
  .extend({
    /** Filter by specific field name */
    field: z.string().max(255).optional(),
    /** Filter by changedBy user ID */
    changedBy: z.string().uuid("Invalid user ID format").optional(),
    /** Alias for createdAt (for semantic clarity in changelog context) */
    since: z.string().optional(),
    /** Alias for createdBefore (for semantic clarity in changelog context) */
    until: z.string().optional(),
  })
  .transform((data) => {
    // Map 'since' to 'createdAt' and 'until' to 'createdBefore' for internal use
    return {
      ...data,
      createdAt: data.since ?? data.createdAt,
      createdBefore: data.until ?? data.createdBefore,
    };
  });

/**
 * Schema for validating epic changelog query parameters.
 * Used for GET /api/v1/changelog/epic/:epicId
 */
export const epicChangelogQuerySchema = paginationQuerySchema
  .merge(dateFilterQuerySchema)
  .extend({
    /** Filter by entity type */
    entityType: z.enum(entityTypeValues).optional(),
    /** Filter by specific field name */
    field: z.string().max(255).optional(),
    /** Filter by changedBy user ID */
    changedBy: z.string().uuid("Invalid user ID format").optional(),
    /** Alias for createdAt */
    since: z.string().optional(),
    /** Alias for createdBefore */
    until: z.string().optional(),
  })
  .transform((data) => {
    // Map 'since' to 'createdAt' and 'until' to 'createdBefore' for internal use
    return {
      ...data,
      createdAt: data.since ?? data.createdAt,
      createdBefore: data.until ?? data.createdBefore,
    };
  });

/**
 * Schema for validating entityType path parameter
 */
export const entityTypeParamSchema = z.object({
  entityType: z.enum(entityTypeValues, {
    errorMap: () => ({ message: "Entity type must be one of: epic, feature, task" }),
  }),
});

/**
 * Schema for validating entityId path parameter
 */
export const entityIdParamSchema = z.object({
  entityId: z.string().uuid("Invalid entity ID format"),
});

/**
 * Schema for validating epicId path parameter
 */
export const epicIdParamSchema = z.object({
  epicId: z.string().uuid("Invalid epic ID format"),
});

// Type exports for use in route handlers and services
export type EntityChangelogQuery = z.infer<typeof entityChangelogQuerySchema>;
export type EpicChangelogQuery = z.infer<typeof epicChangelogQuerySchema>;
export type EntityTypeParam = z.infer<typeof entityTypeParamSchema>;
export type EntityIdParam = z.infer<typeof entityIdParamSchema>;
export type EpicIdParam = z.infer<typeof epicIdParamSchema>;
