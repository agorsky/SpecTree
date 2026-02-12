import { z } from "zod";

/**
 * Validation schemas for User Activity endpoints.
 */

/**
 * Valid metric types for activity details
 */
export const metricTypeValues = ["features", "tasks", "decisions", "sessions"] as const;
export type MetricType = typeof metricTypeValues[number];

/**
 * Valid intervals for activity bucketing
 */
export const intervalValues = ["day", "week", "month"] as const;
export type ActivityInterval = typeof intervalValues[number];

/**
 * Valid scope types for activity filtering
 */
export const scopeValues = ["self", "all", "team", "user"] as const;
export type ActivityScope = typeof scopeValues[number];

/**
 * Schema for activity details query parameters
 * Used by GET /api/v1/user-activity/details
 */
export const activityDetailsQuerySchema = z.object({
  metricType: z
    .enum(metricTypeValues)
    .describe("The type of metric to retrieve details for: features, tasks, decisions, or sessions"),
  
  interval: z
    .enum(intervalValues)
    .describe("The time interval for bucketing: day, week, or month"),
  
  page: z
    .coerce.number()
    .int()
    .min(0)
    .default(0)
    .describe("The page number of time buckets to query (0-indexed)"),
  
  scope: z
    .enum(scopeValues)
    .default("self")
    .describe("The scope of data to retrieve: self (user's own), all (system-wide), team (specific team), or user (specific user)"),
  
  scopeId: z
    .string()
    .uuid("Invalid scope ID format")
    .optional()
    .describe("Required when scope is 'team' or 'user'. The UUID of the team or user to filter by"),
  
  timeZone: z
    .string()
    .default("UTC")
    .describe("IANA time zone identifier for date bucketing (e.g., 'America/New_York', 'Europe/London')"),
  
  limit: z
    .coerce.number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of records to return per page"),
  
  cursor: z
    .string()
    .uuid("Invalid cursor format")
    .optional()
    .describe("Pagination cursor from the previous response to fetch the next page of results"),
});

// Type export for use in route handlers
export type ActivityDetailsQuery = z.infer<typeof activityDetailsQuerySchema>;
