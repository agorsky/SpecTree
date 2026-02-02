import { z } from "zod";

/**
 * Validation schemas for Progress entities.
 * These schemas support the auto-progress tracking feature for AI workflows.
 */

/**
 * Entity type for progress operations
 */
export const progressEntityTypeValues = ["feature", "task"] as const;
export type ProgressEntityType = (typeof progressEntityTypeValues)[number];

/**
 * Schema for starting work on a feature or task
 */
export const startWorkSchema = z.object({
  sessionId: z.string().max(255).optional().describe(
    "Optional identifier for the AI session starting work."
  ),
});

export type StartWorkInput = z.infer<typeof startWorkSchema>;

/**
 * Schema for completing work on a feature or task
 */
export const completeWorkSchema = z.object({
  summary: z.string().max(5000).optional().describe(
    "Optional summary of the work completed. Will be logged as an AI note."
  ),
  sessionId: z.string().max(255).optional().describe(
    "Optional identifier for the AI session completing work."
  ),
});

export type CompleteWorkInput = z.infer<typeof completeWorkSchema>;

/**
 * Schema for logging progress on a feature or task
 */
export const logProgressSchema = z.object({
  message: z.string().min(1).max(5000).describe(
    "Progress message describing what has been done or the current state."
  ),
  percentComplete: z.number().int().min(0).max(100).optional().describe(
    "Optional percentage (0-100) indicating overall completion."
  ),
  sessionId: z.string().max(255).optional().describe(
    "Optional identifier for the AI session logging progress."
  ),
});

export type LogProgressInput = z.infer<typeof logProgressSchema>;

/**
 * Schema for reporting a blocker on a feature or task
 */
export const reportBlockerSchema = z.object({
  reason: z.string().min(1).max(5000).describe(
    "Description of what is blocking progress."
  ),
  blockedById: z.string().uuid().optional().describe(
    "Optional UUID of the feature or task that is blocking this item."
  ),
  sessionId: z.string().max(255).optional().describe(
    "Optional identifier for the AI session reporting the blocker."
  ),
});

export type ReportBlockerInput = z.infer<typeof reportBlockerSchema>;

/**
 * Response schema for start work operation
 */
export const startWorkResponseSchema = z.object({
  id: z.string().uuid(),
  identifier: z.string(),
  title: z.string(),
  statusId: z.string().uuid().nullable(),
  startedAt: z.string().datetime(),
  message: z.string(),
});

export type StartWorkResponse = z.infer<typeof startWorkResponseSchema>;

/**
 * Response schema for complete work operation
 */
export const completeWorkResponseSchema = z.object({
  id: z.string().uuid(),
  identifier: z.string(),
  title: z.string(),
  statusId: z.string().uuid().nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime(),
  durationMinutes: z.number().int().nullable(),
  message: z.string(),
});

export type CompleteWorkResponse = z.infer<typeof completeWorkResponseSchema>;

/**
 * Response schema for log progress operation
 */
export const logProgressResponseSchema = z.object({
  id: z.string().uuid(),
  identifier: z.string(),
  title: z.string(),
  percentComplete: z.number().int().nullable(),
  message: z.string(),
});

export type LogProgressResponse = z.infer<typeof logProgressResponseSchema>;

/**
 * Response schema for report blocker operation
 */
export const reportBlockerResponseSchema = z.object({
  id: z.string().uuid(),
  identifier: z.string(),
  title: z.string(),
  statusId: z.string().uuid().nullable(),
  blockerReason: z.string(),
  blockedById: z.string().uuid().nullable(),
  message: z.string(),
});

export type ReportBlockerResponse = z.infer<typeof reportBlockerResponseSchema>;
