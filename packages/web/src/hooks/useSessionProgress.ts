import { useReducer, useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import {
  SessionEvent,
  SessionEventType,
  isSessionPhaseEvent,
  isSessionFeatureEvent,
  isSessionTaskEvent,
} from "@spectree/shared";

/**
 * Connection status for the SSE connection
 */
export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

/**
 * Progress logged event received from SSE (type: "progress.logged")
 * These are emitted when AI agents call log_progress during execution.
 */
export interface ProgressLoggedDisplayEvent {
  /** Discriminator for union type */
  _type: "progress.logged";
  /** Entity type: feature, task, or epic */
  entityType: string;
  /** Entity ID */
  entityId: string;
  /** Progress message from the AI agent */
  message: string;
  /** Optional completion percentage (0-100) */
  percentComplete?: number;
  /** ISO 8601 timestamp */
  timestamp: string;
}

/**
 * Union type for all events displayed in the activity stream.
 * Includes both structured session events and progress log entries.
 */
export type ActivityEvent = SessionEvent | ProgressLoggedDisplayEvent;

/**
 * Type guard for ProgressLoggedDisplayEvent
 */
export function isProgressLoggedEvent(event: ActivityEvent): event is ProgressLoggedDisplayEvent {
  return "_type" in event && event._type === "progress.logged";
}

/**
 * Derived progress state computed from session events
 */
export interface ProgressState {
  /** Current phase number (1-indexed), null when no phase is active */
  currentPhase: number | null;
  /** Last completed phase number, null if no phase completed yet */
  lastCompletedPhase: number | null;
  /** Total number of phases */
  totalPhases: number | null;
  /** Overall progress percentage (0-100) */
  progressPercentage: number;
  /** Total features in the epic */
  totalFeatures: number;
  /** Completed features */
  completedFeatures: number;
  /** Total tasks across all features */
  totalTasks: number;
  /** Completed tasks */
  completedTasks: number;
}

/**
 * Session progress state managed by the hook
 */
export interface SessionProgressState {
  /** All received events — session events + progress logs (last 200) */
  events: ActivityEvent[];
  /** Set of received event IDs for deduplication */
  receivedEventIds: Set<string>;
  /** Current connection status */
  connectionStatus: ConnectionStatus;
  /** Timestamp of the last event received */
  lastEventTimestamp: string | null;
  /** Last event ID received (for reconnection replay) */
  lastEventId: string | null;
  /** Derived progress information */
  progress: ProgressState;
  /** Last connection error */
  error: Error | null;
}

/**
 * Options for useSessionProgress hook
 */
export interface UseSessionProgressOptions {
  /** Epic ID to monitor */
  epicId: string;
  /** Optional filter for specific event types */
  eventTypes?: SessionEventType[];
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
  /** Maximum number of events to keep in memory (default: 200) */
  maxEvents?: number;
}

/**
 * Actions for the session progress reducer
 */
type SessionProgressAction =
  | { type: "CONNECTING" }
  | { type: "CONNECTED" }
  | { type: "DISCONNECTED" }
  | { type: "ERROR"; error: Error }
  | { type: "ADD_EVENT"; event: ActivityEvent; eventId: string; maxEvents: number }
  | { type: "SET_LAST_EVENT_ID"; lastEventId: string }
  | { type: "RESET" };

/**
 * Initial state for the session progress reducer
 */
const initialState: SessionProgressState = {
  events: [],
  receivedEventIds: new Set<string>(),
  connectionStatus: "disconnected",
  lastEventTimestamp: null,
  lastEventId: null,
  progress: {
    currentPhase: null,
    lastCompletedPhase: null,
    totalPhases: null,
    progressPercentage: 0,
    totalFeatures: 0,
    completedFeatures: 0,
    totalTasks: 0,
    completedTasks: 0,
  },
  error: null,
};

/**
 * Compute derived progress state from events
 */
function computeProgress(events: ActivityEvent[]): ProgressState {
  const progress: ProgressState = {
    currentPhase: null,
    lastCompletedPhase: null,
    totalPhases: null,
    progressPercentage: 0,
    totalFeatures: 0,
    completedFeatures: 0,
    totalTasks: 0,
    completedTasks: 0,
  };

  // Track unique features and tasks
  const allFeatureIds = new Set<string>(); // All features known from phase + feature events
  const featuresCompleted = new Set<string>();
  const featuresStarted = new Set<string>();
  const featuresWithTaskCount = new Map<string, number>(); // featureId → taskCount (avoid double-counting)
  const allTaskIds = new Set<string>(); // All tasks seen from task events
  const tasksCompleted = new Set<string>();

  // Epic-level totals from SESSION_STARTED (authoritative if present)
  let epicTotalFeatures: number | null = null;
  let epicTotalTasks: number | null = null;

  // Execution plan phases from SESSION_STARTED (for phase inference)
  let executionPlanPhases: Array<{ phase: number; featureIds: string[] }> | null = null;

  // Process events in chronological order (oldest first).
  // The events array is stored newest-first, so we iterate in reverse
  // to ensure the final state reflects the most recent events.
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]!;

    // Skip non-session events (progress logs don't affect progress tracking)
    if (isProgressLoggedEvent(event)) continue;

    // Extract epic-level totals from SESSION_STARTED
    if (event.eventType === SessionEventType.SESSION_STARTED) {
      const payload = event.payload as Record<string, unknown>;
      if (typeof payload.totalFeatures === "number") {
        epicTotalFeatures = payload.totalFeatures;
      }
      if (typeof payload.totalTasks === "number") {
        epicTotalTasks = payload.totalTasks;
      }
      if (Array.isArray(payload.executionPlan)) {
        executionPlanPhases = payload.executionPlan as Array<{ phase: number; featureIds: string[] }>;
      }
    }

    // Track phase information
    if (isSessionPhaseEvent(event)) {
      progress.totalPhases = event.payload.totalPhases;
      // Collect all feature IDs from phase events for total count
      for (const fid of event.payload.featureIds) {
        allFeatureIds.add(fid);
      }
      if (event.eventType === SessionEventType.SESSION_PHASE_STARTED) {
        progress.currentPhase = event.payload.phaseNumber;
      } else if (event.eventType === SessionEventType.SESSION_PHASE_COMPLETED) {
        // Phase completed — track it and clear currentPhase
        progress.lastCompletedPhase = event.payload.phaseNumber;
        progress.currentPhase = null;
      }
    }

    // Track feature progress
    if (isSessionFeatureEvent(event)) {
      allFeatureIds.add(event.payload.featureId);
      if (event.eventType === SessionEventType.SESSION_FEATURE_STARTED) {
        featuresStarted.add(event.payload.featureId);
        // Use taskCount from FEATURE_STARTED to know total tasks for this feature
        if (event.payload.taskCount != null) {
          featuresWithTaskCount.set(event.payload.featureId, event.payload.taskCount);
        }
      }
      if (event.eventType === SessionEventType.SESSION_FEATURE_COMPLETED) {
        featuresCompleted.add(event.payload.featureId);
      }
    }

    // Track task progress
    if (isSessionTaskEvent(event)) {
      allTaskIds.add(event.payload.taskId);
      if (event.eventType === SessionEventType.SESSION_TASK_COMPLETED) {
        tasksCompleted.add(event.payload.taskId);
      }
    }
  }

  // Use epic-level totals from SESSION_STARTED when available (authoritative),
  // otherwise fall back to counting from events seen so far
  progress.totalFeatures = epicTotalFeatures ?? allFeatureIds.size;
  progress.completedFeatures = featuresCompleted.size;
  // Sum taskCount from feature events (deduplicated per feature), fall back to unique task IDs seen
  const eventBasedTaskCount = Math.max(
    Array.from(featuresWithTaskCount.values()).reduce((sum, n) => sum + n, 0),
    allTaskIds.size
  );
  progress.totalTasks = epicTotalTasks ?? eventBasedTaskCount;
  progress.completedTasks = tasksCompleted.size;

  // Infer current phase from executionPlan if phase events are absent or stale.
  // Phase events (SESSION_PHASE_STARTED/COMPLETED) are authoritative when present,
  // but for MCP-based sessions or when phase events are lost, we infer from feature activity.
  if (executionPlanPhases && executionPlanPhases.length > 0) {
    progress.totalPhases = progress.totalPhases ?? executionPlanPhases.length;

    // Only infer phase if no explicit phase event already set it
    if (progress.currentPhase === null) {
      // Find the phase that has features started but not all completed (= active phase)
      // Or the first phase with unstarted features (= next phase about to begin)
      let inferredLastCompleted: number | null = null;
      let inferredCurrent: number | null = null;

      for (const p of executionPlanPhases) {
        const phaseFeatureIds = p.featureIds;
        const allCompleted = phaseFeatureIds.every((id) => featuresCompleted.has(id));
        const anyStarted = phaseFeatureIds.some(
          (id) => featuresStarted.has(id) || featuresCompleted.has(id)
        );

        if (allCompleted) {
          inferredLastCompleted = p.phase;
        } else if (anyStarted && inferredCurrent === null) {
          inferredCurrent = p.phase;
        }
      }

      progress.currentPhase = inferredCurrent;
      if (inferredLastCompleted !== null) {
        progress.lastCompletedPhase = progress.lastCompletedPhase ?? inferredLastCompleted;
      }
    }
  }

  // Calculate overall progress percentage
  if (progress.totalTasks > 0) {
    progress.progressPercentage = Math.round(
      (progress.completedTasks / progress.totalTasks) * 100
    );
  } else if (progress.totalFeatures > 0) {
    progress.progressPercentage = Math.round(
      (progress.completedFeatures / progress.totalFeatures) * 100
    );
  }

  return progress;
}

/**
 * Reducer for managing session progress state
 */
function sessionProgressReducer(
  state: SessionProgressState,
  action: SessionProgressAction
): SessionProgressState {
  switch (action.type) {
    case "CONNECTING":
      return {
        ...state,
        connectionStatus: "connecting",
        error: null,
      };

    case "CONNECTED":
      return {
        ...state,
        connectionStatus: "connected",
        error: null,
      };

    case "DISCONNECTED":
      return {
        ...state,
        connectionStatus: "disconnected",
      };

    case "ERROR":
      return {
        ...state,
        connectionStatus: "error",
        error: action.error,
      };

    case "ADD_EVENT": {
      // Check for duplicate event ID
      if (state.receivedEventIds.has(action.eventId)) {
        console.log(`[useSessionProgress] Ignoring duplicate event: ${action.eventId}`);
        return state;
      }

      // Add event to the beginning of the array (newest first)
      const updatedEvents = [action.event, ...state.events];
      
      // Trim to maxEvents (circular buffer behavior)
      const trimmedEvents = updatedEvents.slice(0, action.maxEvents);

      // Update the set of received event IDs
      const updatedEventIds = new Set<string>(state.receivedEventIds);
      updatedEventIds.add(action.eventId);

      // Compute derived progress
      const progress = computeProgress(trimmedEvents);

      return {
        ...state,
        events: trimmedEvents,
        receivedEventIds: updatedEventIds,
        lastEventTimestamp: action.event.timestamp,
        progress,
      };
    }

    case "SET_LAST_EVENT_ID":
      return {
        ...state,
        lastEventId: action.lastEventId,
      };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

/**
 * React hook for monitoring session progress via SSE
 * 
 * Connects to the SSE endpoint and provides real-time session events
 * with derived progress information. Includes auto-reconnect with
 * exponential backoff and Last-Event-ID support for reconnection replay.
 * 
 * @example
 * ```tsx
 * const { sessionState } = useSessionProgress({
 *   epicId: "epic-123",
 *   eventTypes: [SessionEventType.SESSION_TASK_COMPLETED],
 * });
 * 
 * console.log(sessionState.progress.progressPercentage);
 * console.log(sessionState.connectionStatus);
 * ```
 */
export function useSessionProgress({
  epicId,
  eventTypes,
  enabled = true,
  maxEvents = 200,
}: UseSessionProgressOptions) {
  const [sessionState, dispatch] = useReducer(
    sessionProgressReducer,
    initialState
  );

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const backoffDelayRef = useRef<number>(1000); // Start with 1 second
  const lastEventIdRef = useRef<string | null>(null);
  const maxReconnectAttempts = 10;
  const maxBackoffDelay = 16000; // Max 16 seconds
  const accessToken = useAuthStore((state) => state.accessToken);

  // Keep lastEventIdRef in sync with state
  useEffect(() => {
    lastEventIdRef.current = sessionState.lastEventId;
  }, [sessionState.lastEventId]);

  /**
   * Check if parsed data is a valid SessionEvent (has required fields)
   */
  const isValidSessionEvent = useCallback((data: unknown): data is SessionEvent => {
    if (!data || typeof data !== "object") return false;
    const obj = data as Record<string, unknown>;
    return (
      typeof obj.epicId === "string" &&
      typeof obj.sessionId === "string" &&
      typeof obj.timestamp === "string" &&
      typeof obj.eventType === "string"
    );
  }, []);

  /**
   * Connect to the SSE endpoint with Last-Event-ID support
   */
  const connect = useCallback(() => {
    // Don't connect if disabled or no token
    if (!enabled || !accessToken) {
      dispatch({ type: "DISCONNECTED" });
      return;
    }

    // Check if we've exceeded max reconnect attempts
    if (reconnectAttemptRef.current >= maxReconnectAttempts) {
      const error = new Error(
        `Max reconnect attempts (${maxReconnectAttempts}) exceeded`
      );
      dispatch({ type: "ERROR", error });
      return;
    }

    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Build URL with query params
    const params = new URLSearchParams();
    params.append("epicId", epicId);
    params.append("token", accessToken);
    
    if (eventTypes && eventTypes.length > 0) {
      params.append("eventTypes", eventTypes.join(","));
    }

    // Send lastEventId as query param for replay on reconnect
    if (lastEventIdRef.current) {
      params.append("lastEventId", lastEventIdRef.current);
    }

    const url = `/api/v1/events?${params.toString()}`;

    dispatch({ type: "CONNECTING" });

    try {
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        dispatch({ type: "CONNECTED" });
        // Reset reconnect state on successful connection
        reconnectAttemptRef.current = 0;
        backoffDelayRef.current = 1000;
      };

      es.onmessage = (event) => {
        try {
          // Get the event ID (format: {epicId}:{counter})
          const eventId = event.lastEventId || `${epicId}:${Date.now()}`;
          
          // Store the event ID for reconnection
          if (event.lastEventId) {
            dispatch({ type: "SET_LAST_EVENT_ID", lastEventId: event.lastEventId });
          }

          // Parse the event data
          // SSE endpoint wraps events as { type: "session.event"|"progress.logged"|..., data: payload }
          const raw = JSON.parse(event.data);

          // Extract the payload from the wrapper
          const candidate = raw.data ?? raw;

          // Handle progress.logged events — these come from AI agents calling log_progress
          if (raw.type === "progress.logged" && candidate.message) {
            const progressEvent: ProgressLoggedDisplayEvent = {
              _type: "progress.logged",
              entityType: candidate.entityType || "unknown",
              entityId: candidate.entityId || "",
              message: candidate.message,
              percentComplete: candidate.percentComplete,
              timestamp: candidate.timestamp || new Date().toISOString(),
            };
            dispatch({ type: "ADD_EVENT", event: progressEvent, eventId, maxEvents });
            return;
          }

          // Only process valid session events (skip entity.created/updated/deleted etc.)
          if (!isValidSessionEvent(candidate)) {
            return;
          }

          dispatch({ type: "ADD_EVENT", event: candidate, eventId, maxEvents });
        } catch (err) {
          console.error("[useSessionProgress] Failed to parse SSE message:", err);
        }
      };

      es.onerror = () => {
        const error = new Error("EventSource connection failed");
        dispatch({ type: "ERROR", error });
        es.close();

        // Increment reconnect attempt
        reconnectAttemptRef.current += 1;

        // Schedule reconnection with exponential backoff
        scheduleReconnect();
      };
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to create EventSource");
      dispatch({ type: "ERROR", error });

      // Increment reconnect attempt
      reconnectAttemptRef.current += 1;

      // Schedule reconnection
      scheduleReconnect();
    }
    // Note: lastEventId is accessed via ref to avoid reconnect loops
  }, [epicId, eventTypes, enabled, accessToken, maxEvents, isValidSessionEvent]);

  /**
   * Schedule reconnection with exponential backoff
   * Backoff sequence: 1s, 2s, 4s, 8s, 16s (max)
   */
  const scheduleReconnect = useCallback(() => {
    // Clear any existing reconnect timer
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    // Don't schedule if we've hit max attempts
    if (reconnectAttemptRef.current >= maxReconnectAttempts) {
      console.log(
        `[useSessionProgress] Max reconnect attempts (${maxReconnectAttempts}) reached`
      );
      return;
    }

    console.log(
      `[useSessionProgress] Scheduling reconnect attempt ${reconnectAttemptRef.current + 1} in ${backoffDelayRef.current}ms`
    );

    reconnectTimerRef.current = setTimeout(() => {
      connect();
      // Exponential backoff: double the delay, max 16 seconds
      backoffDelayRef.current = Math.min(backoffDelayRef.current * 2, maxBackoffDelay);
    }, backoffDelayRef.current);
  }, [connect]);

  /**
   * Cleanup function to close the connection
   */
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    dispatch({ type: "DISCONNECTED" });
  }, []);

  // Connect on mount and when dependencies change
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  /**
   * Manual retry after max reconnect attempts exhausted.
   * Resets reconnect counters and initiates a fresh connection.
   */
  const retry = useCallback(() => {
    reconnectAttemptRef.current = 0;
    backoffDelayRef.current = 1000;
    connect();
  }, [connect]);

  return {
    sessionState,
    retry,
  };
}
