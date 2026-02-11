/**
 * Session Event Types & Infrastructure
 * 
 * Defines TypeScript types for session lifecycle and progress events.
 * These types establish event schema contracts across backend and frontend
 * for real-time session tracking and progress monitoring.
 */

/**
 * Session event type enum
 * Defines all possible session-related events that can be emitted
 */
export enum SessionEventType {
  /** Emitted when a new AI session is started */
  SESSION_STARTED = "SESSION_STARTED",
  
  /** Emitted when an AI session is ended (completed or abandoned) */
  SESSION_ENDED = "SESSION_ENDED",
  
  /** Emitted when a new execution phase begins */
  SESSION_PHASE_STARTED = "SESSION_PHASE_STARTED",
  
  /** Emitted when an execution phase is completed */
  SESSION_PHASE_COMPLETED = "SESSION_PHASE_COMPLETED",
  
  /** Emitted when work begins on a feature within a session */
  SESSION_FEATURE_STARTED = "SESSION_FEATURE_STARTED",
  
  /** Emitted when a feature is completed within a session */
  SESSION_FEATURE_COMPLETED = "SESSION_FEATURE_COMPLETED",
  
  /** Emitted when work begins on a task within a session */
  SESSION_TASK_STARTED = "SESSION_TASK_STARTED",
  
  /** Emitted when a task is completed within a session */
  SESSION_TASK_COMPLETED = "SESSION_TASK_COMPLETED",
  
  /** Emitted when an error occurs during session execution */
  SESSION_ERROR = "SESSION_ERROR",
}

/**
 * Base interface for all session events
 * Contains fields common to all session event types
 */
export interface SessionEventBase {
  /** ID of the epic being worked on */
  epicId: string;
  
  /** ID of the active session */
  sessionId: string;
  
  /** ISO 8601 timestamp when the event was emitted */
  timestamp: string;
  
  /** The type of event being emitted */
  eventType: SessionEventType;
  
  /** Optional metadata associated with the event */
  metadata?: Record<string, unknown>;
}

/**
 * Session lifecycle events
 * Emitted when sessions start or end
 */
export interface SessionLifecycleEvent extends SessionEventBase {
  eventType: SessionEventType.SESSION_STARTED | SessionEventType.SESSION_ENDED;
  
  payload: {
    /** External session ID from AI agent (e.g., Copilot) */
    externalId?: string;
    
    /** Session status: active, completed, abandoned */
    status?: "active" | "completed" | "abandoned";
    
    /** Summary of work completed (for SESSION_ENDED) */
    summary?: string;
    
    /** Recommended next steps (for SESSION_ENDED) */
    nextSteps?: string[];
    
    /** Blockers encountered (for SESSION_ENDED) */
    blockers?: string[];
    
    /** Decisions made during session (for SESSION_ENDED) */
    decisions?: Array<{
      decision: string;
      rationale?: string | undefined;
    }>;
  };
}

/**
 * Session phase events
 * Emitted when execution phases start or complete
 */
export interface SessionPhaseEvent extends SessionEventBase {
  eventType: SessionEventType.SESSION_PHASE_STARTED | SessionEventType.SESSION_PHASE_COMPLETED;
  
  payload: {
    /** Phase number (1-indexed) */
    phaseNumber: number;
    
    /** Total number of phases in the execution plan */
    totalPhases: number;
    
    /** Features in this phase */
    featureIds: string[];
    
    /** Number of features in this phase */
    featureCount: number;
    
    /** Whether features in this phase can run in parallel */
    canParallelize: boolean;
  };
}

/**
 * Feature progress events
 * Emitted when features are started or completed within a session
 */
export interface SessionFeatureEvent extends SessionEventBase {
  eventType: SessionEventType.SESSION_FEATURE_STARTED | SessionEventType.SESSION_FEATURE_COMPLETED;
  
  payload: {
    /** ID of the feature */
    featureId: string;
    
    /** Human-readable identifier (e.g., ENG-42) */
    identifier: string;
    
    /** Feature title */
    title: string;
    
    /** Current status */
    statusId?: string;
    
    /** Status name (e.g., "In Progress", "Done") */
    statusName?: string;
    
    /** Number of tasks in this feature */
    taskCount?: number;
    
    /** Number of completed tasks (for SESSION_FEATURE_COMPLETED) */
    completedTaskCount?: number;
    
    /** Duration in milliseconds (for SESSION_FEATURE_COMPLETED) */
    durationMs?: number;
  };
}

/**
 * Task progress events
 * Emitted when tasks are started or completed within a session
 */
export interface SessionTaskEvent extends SessionEventBase {
  eventType: SessionEventType.SESSION_TASK_STARTED | SessionEventType.SESSION_TASK_COMPLETED;
  
  payload: {
    /** ID of the task */
    taskId: string;
    
    /** Human-readable identifier (e.g., ENG-42-1) */
    identifier: string;
    
    /** Task title */
    title: string;
    
    /** Parent feature ID */
    featureId: string;
    
    /** Parent feature identifier (e.g., ENG-42) */
    featureIdentifier: string;
    
    /** Current status */
    statusId?: string;
    
    /** Status name (e.g., "In Progress", "Done") */
    statusName?: string;
    
    /** Files modified during task implementation */
    filesModified?: string[];
    
    /** Validation results (for SESSION_TASK_COMPLETED) */
    validationsPassed?: boolean;
    
    /** Number of validation checks passed */
    validationChecksPassed?: number;
    
    /** Total number of validation checks */
    totalValidationChecks?: number;
    
    /** Duration in milliseconds (for SESSION_TASK_COMPLETED) */
    durationMs?: number;
  };
}

/**
 * Session error events
 * Emitted when errors occur during session execution
 */
export interface SessionErrorEvent extends SessionEventBase {
  eventType: SessionEventType.SESSION_ERROR;
  
  payload: {
    /** Error code or type */
    errorCode: string;
    
    /** Human-readable error message */
    errorMessage: string;
    
    /** Stack trace or detailed error info */
    errorDetails?: string;
    
    /** Context where the error occurred */
    context?: {
      /** Type of item being worked on when error occurred */
      itemType?: "feature" | "task";
      
      /** ID of item being worked on */
      itemId?: string;
      
      /** Identifier of item being worked on */
      identifier?: string;
    };
    
    /** Whether the error is recoverable */
    recoverable?: boolean;
  };
}

/**
 * Discriminated union of all session event types
 * Enables type-safe event handling with TypeScript's type narrowing
 */
export type SessionEvent =
  | SessionLifecycleEvent
  | SessionPhaseEvent
  | SessionFeatureEvent
  | SessionTaskEvent
  | SessionErrorEvent;

/**
 * Type guard to check if an event is a lifecycle event
 */
export function isSessionLifecycleEvent(event: SessionEvent): event is SessionLifecycleEvent {
  return (
    event.eventType === SessionEventType.SESSION_STARTED ||
    event.eventType === SessionEventType.SESSION_ENDED
  );
}

/**
 * Type guard to check if an event is a phase event
 */
export function isSessionPhaseEvent(event: SessionEvent): event is SessionPhaseEvent {
  return (
    event.eventType === SessionEventType.SESSION_PHASE_STARTED ||
    event.eventType === SessionEventType.SESSION_PHASE_COMPLETED
  );
}

/**
 * Type guard to check if an event is a feature event
 */
export function isSessionFeatureEvent(event: SessionEvent): event is SessionFeatureEvent {
  return (
    event.eventType === SessionEventType.SESSION_FEATURE_STARTED ||
    event.eventType === SessionEventType.SESSION_FEATURE_COMPLETED
  );
}

/**
 * Type guard to check if an event is a task event
 */
export function isSessionTaskEvent(event: SessionEvent): event is SessionTaskEvent {
  return (
    event.eventType === SessionEventType.SESSION_TASK_STARTED ||
    event.eventType === SessionEventType.SESSION_TASK_COMPLETED
  );
}

/**
 * Type guard to check if an event is an error event
 */
export function isSessionErrorEvent(event: SessionEvent): event is SessionErrorEvent {
  return event.eventType === SessionEventType.SESSION_ERROR;
}
