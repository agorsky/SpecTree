import { z } from "zod";
import {
  paginationQuerySchema,
  searchQuerySchema,
  dateFilterQuerySchema,
  statusFilterQuerySchema,
  assigneeFilterQuerySchema,
} from "./common.js";

/**
 * Validation schemas for Feature entities.
 */

/**
 * Schema for listing features with optional filters, search, and date range
 */
export const listFeaturesQuerySchema = paginationQuerySchema
  .merge(searchQuerySchema)
  .merge(dateFilterQuerySchema)
  .merge(statusFilterQuerySchema)
  .merge(assigneeFilterQuerySchema)
  .extend({
    projectId: z.string().uuid().optional(),
  });

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

/**
 * Schema for reordering a feature
 * At least one of afterId or beforeId must be provided
 */
export const reorderFeatureSchema = z.object({
  afterId: z.string().uuid("Invalid after ID").optional(),
  beforeId: z.string().uuid("Invalid before ID").optional(),
}).refine(
  (data) => data.afterId !== undefined || data.beforeId !== undefined,
  { message: "At least one of afterId or beforeId must be provided" }
);

// Type exports for use in route handlers
export type ListFeaturesQuery = z.infer<typeof listFeaturesQuerySchema>;
export type CreateFeatureInput = z.infer<typeof createFeatureSchema>;
export type UpdateFeatureInput = z.infer<typeof updateFeatureSchema>;
export type ReorderFeatureInput = z.infer<typeof reorderFeatureSchema>;
