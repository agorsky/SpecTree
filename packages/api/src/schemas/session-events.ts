import { z } from "zod";
import { SessionEventType } from "@spectree/shared";

/**
 * Session Event Validation Schemas
 * 
 * Zod schemas for validating session event payloads.
 * These schemas ensure type safety and runtime validation for session events
 * emitted from the backend to frontend via WebSocket or SSE.
 */

/**
 * Session event type enum values for Zod validation
 */
const sessionEventTypeValues = [
  SessionEventType.SESSION_STARTED,
  SessionEventType.SESSION_ENDED,
  SessionEventType.SESSION_PHASE_STARTED,
  SessionEventType.SESSION_PHASE_COMPLETED,
  SessionEventType.SESSION_FEATURE_STARTED,
  SessionEventType.SESSION_FEATURE_COMPLETED,
  SessionEventType.SESSION_TASK_STARTED,
  SessionEventType.SESSION_TASK_COMPLETED,
  SessionEventType.SESSION_TASK_PROGRESS,
  SessionEventType.SESSION_ERROR,
] as const;

/**
 * Base schema for all session events
 */
export const sessionEventBaseSchema = z.object({
  epicId: z.string().uuid().describe("ID of the epic being worked on"),
  sessionId: z.string().uuid().describe("ID of the active session"),
  timestamp: z.string().datetime().describe("ISO 8601 timestamp when the event was emitted"),
  eventType: z.enum(sessionEventTypeValues).describe("The type of event being emitted"),
  metadata: z.record(z.unknown()).optional().describe("Optional metadata associated with the event"),
});

/**
 * Schema for session lifecycle event payloads
 */
export const sessionLifecyclePayloadSchema = z.object({
  externalId: z.string().optional().describe("External session ID from AI agent"),
  status: z.enum(["active", "completed", "abandoned"]).optional().describe("Session status"),
  totalFeatures: z.number().int().nonnegative().optional().describe("Total features in the epic (for SESSION_STARTED)"),
  totalTasks: z.number().int().nonnegative().optional().describe("Total tasks across all features (for SESSION_STARTED)"),
  executionPlan: z.array(z.object({
    phase: z.number().int().positive().describe("Phase number (1-indexed)"),
    featureIds: z.array(z.string()).describe("Feature IDs in this phase"),
  })).optional().describe("Execution plan phases (for SESSION_STARTED)"),
  summary: z.string().optional().describe("Summary of work completed (for SESSION_ENDED)"),
  nextSteps: z.array(z.string()).optional().describe("Recommended next steps (for SESSION_ENDED)"),
  blockers: z.array(z.string()).optional().describe("Blockers encountered (for SESSION_ENDED)"),
  decisions: z.array(z.object({
    decision: z.string(),
    rationale: z.string().optional(),
  })).optional().describe("Decisions made during session (for SESSION_ENDED)"),
});

/**
 * Schema for session lifecycle events
 */
export const sessionLifecycleEventSchema = sessionEventBaseSchema.extend({
  eventType: z.enum([SessionEventType.SESSION_STARTED, SessionEventType.SESSION_ENDED]),
  payload: sessionLifecyclePayloadSchema,
});

/**
 * Schema for session phase event payloads
 */
export const sessionPhasePayloadSchema = z.object({
  phaseNumber: z.number().int().positive().describe("Phase number (1-indexed)"),
  totalPhases: z.number().int().positive().describe("Total number of phases in the execution plan"),
  featureIds: z.array(z.string().uuid()).describe("Features in this phase"),
  featureCount: z.number().int().nonnegative().describe("Number of features in this phase"),
  canParallelize: z.boolean().describe("Whether features in this phase can run in parallel"),
});

/**
 * Schema for session phase events
 */
export const sessionPhaseEventSchema = sessionEventBaseSchema.extend({
  eventType: z.enum([SessionEventType.SESSION_PHASE_STARTED, SessionEventType.SESSION_PHASE_COMPLETED]),
  payload: sessionPhasePayloadSchema,
});

/**
 * Schema for feature event payloads
 */
export const sessionFeaturePayloadSchema = z.object({
  featureId: z.string().uuid().describe("ID of the feature"),
  identifier: z.string().describe("Human-readable identifier (e.g., ENG-42)"),
  title: z.string().describe("Feature title"),
  statusId: z.string().uuid().optional().describe("Current status ID"),
  statusName: z.string().optional().describe("Status name (e.g., 'In Progress', 'Done')"),
  taskCount: z.number().int().nonnegative().optional().describe("Number of tasks in this feature"),
  completedTaskCount: z.number().int().nonnegative().optional().describe("Number of completed tasks"),
  durationMs: z.number().int().nonnegative().optional().describe("Duration in milliseconds"),
});

/**
 * Schema for session feature events
 */
export const sessionFeatureEventSchema = sessionEventBaseSchema.extend({
  eventType: z.enum([SessionEventType.SESSION_FEATURE_STARTED, SessionEventType.SESSION_FEATURE_COMPLETED]),
  payload: sessionFeaturePayloadSchema,
});

/**
 * Schema for task event payloads
 */
export const sessionTaskPayloadSchema = z.object({
  taskId: z.string().uuid().describe("ID of the task"),
  identifier: z.string().describe("Human-readable identifier (e.g., ENG-42-1)"),
  title: z.string().describe("Task title"),
  featureId: z.string().uuid().describe("Parent feature ID"),
  featureIdentifier: z.string().describe("Parent feature identifier (e.g., ENG-42)"),
  statusId: z.string().uuid().optional().describe("Current status ID"),
  statusName: z.string().optional().describe("Status name (e.g., 'In Progress', 'Done')"),
  filesModified: z.array(z.string()).optional().describe("Files modified during task implementation"),
  validationsPassed: z.boolean().optional().describe("Whether validations passed"),
  validationChecksPassed: z.number().int().nonnegative().optional().describe("Number of validation checks passed"),
  totalValidationChecks: z.number().int().nonnegative().optional().describe("Total number of validation checks"),
  durationMs: z.number().int().nonnegative().optional().describe("Duration in milliseconds"),
});

/**
 * Schema for session task events
 */
export const sessionTaskEventSchema = sessionEventBaseSchema.extend({
  eventType: z.enum([SessionEventType.SESSION_TASK_STARTED, SessionEventType.SESSION_TASK_COMPLETED]),
  payload: sessionTaskPayloadSchema,
});

/**
 * Schema for task progress event payloads
 */
export const sessionTaskProgressPayloadSchema = z.object({
  taskId: z.string().uuid().describe("ID of the task"),
  identifier: z.string().describe("Human-readable identifier (e.g., ENG-42-1)"),
  title: z.string().describe("Task title"),
  featureId: z.string().uuid().describe("Parent feature ID"),
  featureIdentifier: z.string().describe("Parent feature identifier (e.g., ENG-42)"),
  message: z.string().describe("Progress message"),
  percentComplete: z.number().int().min(0).max(100).optional().describe("Percent complete (0-100)"),
});

/**
 * Schema for session task progress events
 */
export const sessionTaskProgressEventSchema = sessionEventBaseSchema.extend({
  eventType: z.literal(SessionEventType.SESSION_TASK_PROGRESS),
  payload: sessionTaskProgressPayloadSchema,
});

/**
 * Schema for error event payloads
 */
export const sessionErrorPayloadSchema = z.object({
  errorCode: z.string().describe("Error code or type"),
  errorMessage: z.string().describe("Human-readable error message"),
  errorDetails: z.string().optional().describe("Stack trace or detailed error info"),
  context: z.object({
    itemType: z.enum(["feature", "task"]).optional().describe("Type of item being worked on"),
    itemId: z.string().uuid().optional().describe("ID of item being worked on"),
    identifier: z.string().optional().describe("Identifier of item being worked on"),
  }).optional().describe("Context where the error occurred"),
  recoverable: z.boolean().optional().describe("Whether the error is recoverable"),
});

/**
 * Schema for session error events
 */
export const sessionErrorEventSchema = sessionEventBaseSchema.extend({
  eventType: z.literal(SessionEventType.SESSION_ERROR),
  payload: sessionErrorPayloadSchema,
});

/**
 * Discriminated union schema for all session events
 */
export const sessionEventSchema = z.discriminatedUnion("eventType", [
  sessionLifecycleEventSchema,
  sessionPhaseEventSchema,
  sessionFeatureEventSchema,
  sessionTaskEventSchema,
  sessionTaskProgressEventSchema,
  sessionErrorEventSchema,
]);

/**
 * Type inference from schemas
 */
export type SessionLifecycleEventInput = z.infer<typeof sessionLifecycleEventSchema>;
export type SessionPhaseEventInput = z.infer<typeof sessionPhaseEventSchema>;
export type SessionFeatureEventInput = z.infer<typeof sessionFeatureEventSchema>;
export type SessionTaskEventInput = z.infer<typeof sessionTaskEventSchema>;
export type SessionTaskProgressEventInput = z.infer<typeof sessionTaskProgressEventSchema>;
export type SessionErrorEventInput = z.infer<typeof sessionErrorEventSchema>;
export type SessionEventInput = z.infer<typeof sessionEventSchema>;

// =============================================================================
// API Query Schemas
// =============================================================================

/**
 * Schema for epic ID path parameter
 */
export const epicIdParamSchema = z.object({
  epicId: z.string().uuid().describe("The epic ID to query events for"),
});

export type EpicIdParam = z.infer<typeof epicIdParamSchema>;

/**
 * Schema for session events query parameters
 * Used by GET /api/v1/sessions/:epicId/events endpoint
 */
export const sessionEventsQuerySchema = z.object({
  /** Filter events from this timestamp onwards (ISO 8601) */
  since: z.string().datetime().optional().describe(
    "Filter events from this timestamp onwards (ISO 8601 datetime)"
  ),
  
  /** Filter events for a specific session ID */
  sessionId: z.string().uuid().optional().describe(
    "Filter events for a specific session ID"
  ),
  
  /** Filter by event types (comma-separated list) */
  eventTypes: z.string().optional().transform((val) => {
    if (!val) return undefined;
    return val.split(",").map(s => s.trim()).filter(Boolean);
  }).describe(
    "Filter by event types (comma-separated, e.g., 'SESSION_STARTED,SESSION_ENDED')"
  ),
  
  /** Maximum number of events to return (default: 50, max: 200) */
  limit: z.coerce.number().int().min(1).max(200).optional().default(50).describe(
    "Maximum number of events to return (default: 50, max: 200)"
  ),
  
  /** Cursor for pagination */
  cursor: z.string().optional().describe(
    "Pagination cursor from previous response"
  ),
});

export type SessionEventsQuery = z.infer<typeof sessionEventsQuerySchema>;
