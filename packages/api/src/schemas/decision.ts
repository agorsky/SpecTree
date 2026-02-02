import { z } from "zod";
import { paginationQuerySchema, searchQuerySchema, dateFilterQuerySchema } from "./common.js";

/**
 * Validation schemas for Decision entities.
 * Decisions are append-only records that preserve the rationale behind implementation choices.
 */

/**
 * Valid decision categories
 */
export const decisionCategoryValues = [
  "architecture",
  "library",
  "approach",
  "scope",
  "design",
  "tradeoff",
  "deferral",
] as const;
export type DecisionCategory = (typeof decisionCategoryValues)[number];

/**
 * Valid impact levels
 */
export const impactLevelValues = ["low", "medium", "high"] as const;
export type ImpactLevel = (typeof impactLevelValues)[number];

/**
 * Schema for creating a new decision
 */
export const createDecisionSchema = z.object({
  epicId: z.string().uuid("Invalid epic ID"),
  featureId: z.string().uuid("Invalid feature ID").optional(),
  taskId: z.string().uuid("Invalid task ID").optional(),
  question: z.string().min(1).max(1000).describe("What was being decided"),
  decision: z.string().min(1).max(2000).describe("The choice made"),
  rationale: z.string().min(1).max(5000).describe("Why this choice was made"),
  alternatives: z
    .array(z.string().max(500))
    .max(10)
    .optional()
    .describe("What else was considered"),
  madeBy: z
    .string()
    .min(1)
    .max(255)
    .default("AI")
    .describe("Who made the decision: 'AI', 'human', or user ID"),
  category: z.enum(decisionCategoryValues).optional(),
  impact: z.enum(impactLevelValues).optional(),
});

/**
 * Schema for listing decisions with optional filters
 */
export const listDecisionsQuerySchema = paginationQuerySchema
  .merge(dateFilterQuerySchema)
  .extend({
    epicId: z.string().uuid().optional(),
    featureId: z.string().uuid().optional(),
    taskId: z.string().uuid().optional(),
    category: z.enum(decisionCategoryValues).optional(),
    impact: z.enum(impactLevelValues).optional(),
  });

/**
 * Schema for searching decisions
 */
export const searchDecisionsQuerySchema = paginationQuerySchema
  .merge(searchQuerySchema)
  .extend({
    epicId: z.string().uuid().optional(),
  });

// Type exports for use in route handlers and services
export type CreateDecisionInput = z.infer<typeof createDecisionSchema>;
export type ListDecisionsQuery = z.infer<typeof listDecisionsQuerySchema>;
export type SearchDecisionsQuery = z.infer<typeof searchDecisionsQuerySchema>;
