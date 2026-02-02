import { z } from "zod";

/**
 * Validation schemas for Progress Summary entities.
 * These schemas support the progress dashboard feature for AI session orientation.
 */

/**
 * Blocked item in summary
 */
export const blockedItemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["feature", "task"]),
  identifier: z.string(),
  title: z.string(),
  blockerReason: z.string(),
});

export type BlockedItem = z.infer<typeof blockedItemSchema>;

/**
 * Actionable item ready to work on
 */
export const actionableItemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["feature", "task"]),
  identifier: z.string(),
  title: z.string(),
  executionOrder: z.number().nullable(),
  complexity: z.enum(["trivial", "simple", "moderate", "complex"]).nullable(),
});

export type ActionableItem = z.infer<typeof actionableItemSchema>;

/**
 * Recently completed item
 */
export const recentlyCompletedItemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["feature", "task"]),
  identifier: z.string(),
  title: z.string(),
  completedAt: z.string().datetime(),
});

export type RecentlyCompletedItem = z.infer<typeof recentlyCompletedItemSchema>;

/**
 * Last session summary for context
 */
export const lastSessionSummarySchema = z.object({
  endedAt: z.string().datetime(),
  summary: z.string(),
  nextSteps: z.array(z.string()),
});

export type LastSessionSummary = z.infer<typeof lastSessionSummarySchema>;

/**
 * Progress summary response schema
 */
export const progressSummarySchema = z.object({
  epic: z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
  }),
  
  // Counts
  totalFeatures: z.number().int(),
  completedFeatures: z.number().int(),
  inProgressFeatures: z.number().int(),
  blockedFeatures: z.number().int(),
  
  totalTasks: z.number().int(),
  completedTasks: z.number().int(),
  inProgressTasks: z.number().int(),
  blockedTasks: z.number().int(),
  
  // Calculated metrics
  overallProgress: z.number().min(0).max(100),
  estimatedRemaining: z.string(),
  
  // Actionable items
  blockedItems: z.array(blockedItemSchema),
  nextActionable: z.array(actionableItemSchema),
  recentlyCompleted: z.array(recentlyCompletedItemSchema),
  
  // Session context
  lastSession: lastSessionSummarySchema.nullable(),
});

export type ProgressSummary = z.infer<typeof progressSummarySchema>;

/**
 * My work item schema (assigned to current user)
 */
export const myWorkItemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["feature", "task"]),
  identifier: z.string(),
  title: z.string(),
  epicId: z.string().uuid(),
  epicName: z.string(),
  status: z.string().nullable(),
  statusCategory: z.string().nullable(),
  executionOrder: z.number().nullable(),
  complexity: z.enum(["trivial", "simple", "moderate", "complex"]).nullable(),
  percentComplete: z.number().nullable(),
});

export type MyWorkItem = z.infer<typeof myWorkItemSchema>;

/**
 * My work response schema
 */
export const myWorkResponseSchema = z.object({
  items: z.array(myWorkItemSchema),
  inProgress: z.number().int(),
  blocked: z.number().int(),
  total: z.number().int(),
});

export type MyWorkResponse = z.infer<typeof myWorkResponseSchema>;

/**
 * Blocked summary item schema (cross-epic)
 */
export const blockedSummaryItemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["feature", "task"]),
  identifier: z.string(),
  title: z.string(),
  epicId: z.string().uuid(),
  epicName: z.string(),
  blockerReason: z.string(),
  blockedSince: z.string().datetime().nullable(),
});

export type BlockedSummaryItem = z.infer<typeof blockedSummaryItemSchema>;

/**
 * Blocked summary response schema
 */
export const blockedSummaryResponseSchema = z.object({
  items: z.array(blockedSummaryItemSchema),
  totalBlocked: z.number().int(),
  byEpic: z.array(z.object({
    epicId: z.string().uuid(),
    epicName: z.string(),
    count: z.number().int(),
  })),
});

export type BlockedSummaryResponse = z.infer<typeof blockedSummaryResponseSchema>;
