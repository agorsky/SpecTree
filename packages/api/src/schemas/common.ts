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

/**
 * Schema for text search query parameter
 */
export const searchQuerySchema = z.object({
  query: z.string().max(255).optional(),
});

/**
 * Date filter string validation.
 * Accepts ISO-8601 date (YYYY-MM-DD), datetime, or duration format (-P{n}D, -P{n}W, -P{n}M).
 */
const dateFilterString = z.string().refine(
  (val) => {
    // ISO-8601 date pattern (YYYY-MM-DD)
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
    // ISO-8601 datetime pattern
    const isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    // Duration pattern (-P{n}D, -P{n}W, -P{n}M)
    const durationPattern = /^-P\d+[DWM]$/;

    return isoDatePattern.test(val) || isoDateTimePattern.test(val) || durationPattern.test(val);
  },
  {
    message: "Invalid date format. Expected ISO-8601 date (YYYY-MM-DD), datetime, or duration (-P{n}D, -P{n}W, -P{n}M).",
  }
);

/**
 * Schema for date range filter query parameters.
 * Supports filtering by createdAt and updatedAt with "on or after" and "before" options.
 */
export const dateFilterQuerySchema = z.object({
  createdAt: dateFilterString.optional(),
  createdBefore: dateFilterString.optional(),
  updatedAt: dateFilterString.optional(),
  updatedBefore: dateFilterString.optional(),
});

/**
 * Valid status categories for filtering
 */
export const STATUS_CATEGORIES = ["backlog", "unstarted", "started", "completed", "canceled"] as const;
export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

/**
 * Schema for enhanced status filter query parameters.
 * Supports filtering by:
 * - status: Single or multiple status IDs or names
 * - statusCategory: Filter by status category (backlog, unstarted, started, completed, canceled)
 */
export const statusFilterQuerySchema = z.object({
  /** Status filter - can be ID or name (single or array via repeated param) */
  status: z.union([z.string(), z.array(z.string())]).optional(),
  /** Filter by status category */
  statusCategory: z.enum(STATUS_CATEGORIES).optional(),
  /** @deprecated Legacy status ID filter - use `status` instead */
  statusId: z.string().uuid().optional(),
});

/**
 * Schema for enhanced assignee filter query parameters.
 * Supports filtering by:
 * - assignee: "me", "none", email, or UUID
 */
export const assigneeFilterQuerySchema = z.object({
  /** Assignee filter - supports "me", "none", email, or UUID */
  assignee: z.string().optional(),
  /** @deprecated Legacy assignee ID filter - use `assignee` instead */
  assigneeId: z.string().uuid().optional(),
});

// Type exports for use in route handlers
export type UuidParam = z.infer<typeof uuidParamSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type DateFilterQuery = z.infer<typeof dateFilterQuerySchema>;
export type StatusFilterQuery = z.infer<typeof statusFilterQuerySchema>;
export type AssigneeFilterQuery = z.infer<typeof assigneeFilterQuerySchema>;
