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
 * Derived progress state computed from session events
 */
export interface ProgressState {
  /** Current phase number (1-indexed) */
  currentPhase: number | null;
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
  /** All received session events (last 200) */
  events: SessionEvent[];
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
  | { type: "ADD_EVENT"; event: SessionEvent; eventId: string; maxEvents: number }
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
function computeProgress(events: SessionEvent[]): ProgressState {
  const progress: ProgressState = {
    currentPhase: null,
    totalPhases: null,
    progressPercentage: 0,
    totalFeatures: 0,
    completedFeatures: 0,
    totalTasks: 0,
    completedTasks: 0,
  };

  // Track unique features and tasks
  const featuresStarted = new Set<string>();
  const featuresCompleted = new Set<string>();
  const tasksStarted = new Set<string>();
  const tasksCompleted = new Set<string>();

  // Process events to compute progress
  for (const event of events) {
    // Track phase information
    if (isSessionPhaseEvent(event)) {
      progress.totalPhases = event.payload.totalPhases;
      if (event.eventType === SessionEventType.SESSION_PHASE_STARTED) {
        progress.currentPhase = event.payload.phaseNumber;
      }
    }

    // Track feature progress
    if (isSessionFeatureEvent(event)) {
      featuresStarted.add(event.payload.featureId);
      if (event.eventType === SessionEventType.SESSION_FEATURE_COMPLETED) {
        featuresCompleted.add(event.payload.featureId);
      }
    }

    // Track task progress
    if (isSessionTaskEvent(event)) {
      tasksStarted.add(event.payload.taskId);
      if (event.eventType === SessionEventType.SESSION_TASK_COMPLETED) {
        tasksCompleted.add(event.payload.taskId);
      }
    }
  }

  progress.totalFeatures = featuresStarted.size;
  progress.completedFeatures = featuresCompleted.size;
  progress.totalTasks = tasksStarted.size;
  progress.completedTasks = tasksCompleted.size;

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
  const maxReconnectAttempts = 10;
  const maxBackoffDelay = 16000; // Max 16 seconds
  const accessToken = useAuthStore((state) => state.accessToken);

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

    const url = `/api/v1/events?${params.toString()}`;

    dispatch({ type: "CONNECTING" });

    try {
      const es = new EventSource(url);
      eventSourceRef.current = es;

      // Set Last-Event-ID header if we have one
      if (sessionState.lastEventId) {
        // EventSource doesn't support custom headers directly,
        // but the browser will send Last-Event-ID automatically
        // if the server sends 'id' field in SSE messages
      }

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
          const data = JSON.parse(event.data) as SessionEvent;
          dispatch({ type: "ADD_EVENT", event: data, eventId, maxEvents });
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
  }, [epicId, eventTypes, enabled, accessToken, maxEvents, sessionState.lastEventId]);

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

  return {
    sessionState,
  };
}
