import { z } from "zod";

/**
 * Validation schemas for Epic Request entities.
 * 
 * Epic Requests are user proposals for new epics that require approval
 * before conversion to actual epics.
 */

/**
 * Valid epic request status values
 */
export const epicRequestStatusValues = ["pending", "approved", "rejected", "converted"] as const;
export type EpicRequestStatus = (typeof epicRequestStatusValues)[number];

/**
 * Structured description schema for Epic Requests
 * Requires minimum 3 sections: problemStatement, proposedSolution, impactAssessment
 */
export const epicRequestStructuredDescSchema = z.object({
  // Required sections
  problemStatement: z.string().min(1).max(5000).describe(
    "Clear statement of the problem or opportunity this epic would address"
  ),
  proposedSolution: z.string().min(1).max(5000).describe(
    "High-level description of how this epic would solve the problem"
  ),
  impactAssessment: z.string().min(1).max(5000).describe(
    "Expected impact and benefits of implementing this epic"
  ),
  
  // Optional additional sections
  targetAudience: z.string().max(2000).optional().describe(
    "Who will benefit from this epic (users, teams, etc.)"
  ),
  successMetrics: z.string().max(2000).optional().describe(
    "How success will be measured if this epic is implemented"
  ),
  alternatives: z.string().max(3000).optional().describe(
    "Alternative approaches considered"
  ),
  dependencies: z.string().max(2000).optional().describe(
    "External dependencies or prerequisites"
  ),
  estimatedEffort: z.string().max(1000).optional().describe(
    "Rough effort estimate (e.g., '2-3 weeks', '1 quarter')"
  ),
});

export type EpicRequestStructuredDesc = z.infer<typeof epicRequestStructuredDescSchema>;

/**
 * Schema for creating a new epic request
 */
export const createEpicRequestSchema = z.object({
  title: z.string().min(1).max(500).describe(
    "Title of the epic request"
  ),
  description: z.string().max(10000).optional().describe(
    "Plain markdown description of the epic request"
  ),
  structuredDesc: epicRequestStructuredDescSchema.optional().describe(
    "Structured description with required problemStatement, proposedSolution, and impactAssessment"
  ),
});

/**
 * Schema for updating an existing epic request
 * All fields are optional
 */
export const updateEpicRequestSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  structuredDesc: epicRequestStructuredDescSchema.optional(),
  status: z.enum(epicRequestStatusValues).optional(),
});

/**
 * Schema for list query parameters
 */
export const listEpicRequestsQuerySchema = z.object({
  cursor: z.string().uuid().optional().describe(
    "Pagination cursor from previous response"
  ),
  limit: z.coerce.number().int().min(1).max(100).optional().describe(
    "Maximum number of results to return (default: 20, max: 100)"
  ),
  status: z.enum(epicRequestStatusValues).optional().describe(
    "Filter by request status"
  ),
  requestedById: z.string().uuid().optional().describe(
    "Filter by user who created the request"
  ),
});

/**
 * Valid reaction type values
 */
export const reactionTypeValues = ["like", "fire", "dislike"] as const;
export type ReactionType = (typeof reactionTypeValues)[number];

/**
 * Schema for adding/updating a reaction
 */
export const addReactionSchema = z.object({
  reactionType: z.enum(reactionTypeValues).describe(
    "Type of reaction: like, fire, or dislike"
  ),
});

/**
 * Schema for creating a new comment
 */
export const createCommentSchema = z.object({
  content: z.string().min(1).max(5000).describe(
    "Content of the comment"
  ),
});

/**
 * Schema for updating a comment
 */
export const updateCommentSchema = z.object({
  content: z.string().min(1).max(5000).describe(
    "Updated content of the comment"
  ),
});

/**
 * Schema for list comments query parameters
 */
export const listCommentsQuerySchema = z.object({
  cursor: z.string().uuid().optional().describe(
    "Pagination cursor from previous response"
  ),
  limit: z.coerce.number().int().min(1).max(100).optional().describe(
    "Maximum number of results to return (default: 20, max: 100)"
  ),
});

// Type exports for use in route handlers and services
export type CreateEpicRequestInput = z.infer<typeof createEpicRequestSchema>;
export type UpdateEpicRequestInput = z.infer<typeof updateEpicRequestSchema>;
export type ListEpicRequestsQuery = z.infer<typeof listEpicRequestsQuerySchema>;
export type AddReactionInput = z.infer<typeof addReactionSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;
