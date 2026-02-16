import { useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sessionsApi, type ProgressState } from '@/lib/api/sessions';
import { sessionEventKeys } from './queries/session-event-keys';
import type { SessionEvent } from '@spectree/shared';

// Re-export ProgressState for backward compatibility
export type { ProgressState };
export type ServerProgressState = ProgressState;

/**
 * Options for useSessionEvents hook
 */
export interface UseSessionEventsOptions {
  /** Epic ID to monitor */
  epicId: string;
  /** Optional filter for specific session */
  sessionId?: string;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
  /** Polling interval in milliseconds (default: 4000) */
  refetchInterval?: number;
  /** Maximum number of events to keep in memory (default: 200) */
  maxEvents?: number;
}

/**
 * State returned by useSessionEvents hook
 */
export interface UseSessionEventsState {
  /** All accumulated events (newest first) */
  events: SessionEvent[];
  /** Derived progress state from backend */
  progress: ProgressState;
  /** Whether the initial fetch is loading */
  isLoading: boolean;
  /** Whether a fetch is in progress (includes polling) */
  isFetching: boolean;
  /** Any fetch error */
  error: Error | null;
  /** Timestamp of last successful fetch */
  lastFetchTime: string | null;
  /** Refetch manually (resets to full history) */
  refetch: () => void;
}

/**
 * React Query hook for polling session events
 * 
 * Polls the REST endpoint at configurable intervals (default 4s).
 * Accumulates events using the `since` parameter for incremental fetching.
 * On initial load or tab return, fetches complete history.
 * Deduplicates events by session+timestamp+type.
 * 
 * @example
 * ```tsx
 * const { events, progress, isLoading } = useSessionEvents({
 *   epicId: "epic-123",
 *   refetchInterval: 5000,
 * });
 * 
 * console.log(progress.progressPercentage);
 * console.log(events.length);
 * ```
 */
export function useSessionEvents({
  epicId,
  sessionId,
  enabled = true,
  refetchInterval = 4000,
  maxEvents = 200,
}: UseSessionEventsOptions): UseSessionEventsState {
  // Track accumulated events and received IDs for deduplication
  const accumulatedEventsRef = useRef<SessionEvent[]>([]);
  const receivedEventIdsRef = useRef<Set<string>>(new Set());
  const lastTimestampRef = useRef<string | null>(null);
  const lastFetchTimeRef = useRef<string | null>(null);
  
  // Track if we've done initial load
  const hasInitialLoadRef = useRef(false);

  // Build query options dynamically
  const buildQueryOptions = useCallback(() => {
    const options: {
      since?: string;
      sessionId?: string;
      limit?: number;
    } = {
      limit: hasInitialLoadRef.current ? 50 : maxEvents, // Full history on first load, then incremental
    };
    
    if (sessionId) {
      options.sessionId = sessionId;
    }
    
    // Use `since` for incremental fetching after initial load
    if (hasInitialLoadRef.current && lastTimestampRef.current) {
      options.since = lastTimestampRef.current;
    }
    
    return options;
  }, [sessionId, maxEvents]);

  // Query session events with React Query
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch: queryRefetch,
  } = useQuery({
    queryKey: sessionEventKeys.events(epicId, { sessionId }),
    queryFn: () => sessionsApi.getEvents(epicId, buildQueryOptions()),
    enabled: enabled && !!epicId,
    refetchInterval: enabled ? refetchInterval : false,
    refetchOnWindowFocus: true, // Immediate refetch when tab becomes visible
    refetchOnReconnect: true,
    staleTime: 0, // Always consider data stale to ensure polling works
    select: (response) => response.data,
  });

  // Process new events when data changes
  useEffect(() => {
    if (!data) return;

    const newEvents = data.events;
    const fetchTime = new Date().toISOString();
    lastFetchTimeRef.current = fetchTime;
    
    // On initial load or when returning to tab (no prior events), replace all events
    if (!hasInitialLoadRef.current || accumulatedEventsRef.current.length === 0) {
      accumulatedEventsRef.current = newEvents;
      receivedEventIdsRef.current = new Set(
        newEvents.map(e => `${e.sessionId}:${e.timestamp}:${e.eventType}`)
      );
      hasInitialLoadRef.current = true;
      
      // Update last timestamp to most recent event
      if (newEvents.length > 0) {
        lastTimestampRef.current = newEvents[0]!.timestamp;
      }
      
      return;
    }

    // Incremental update: deduplicate and prepend new events
    const dedupedNewEvents: SessionEvent[] = [];
    
    for (const event of newEvents) {
      const eventId = `${event.sessionId}:${event.timestamp}:${event.eventType}`;
      
      if (!receivedEventIdsRef.current.has(eventId)) {
        dedupedNewEvents.push(event);
        receivedEventIdsRef.current.add(eventId);
      }
    }

    // Prepend new events (they're already newest-first from API)
    if (dedupedNewEvents.length > 0) {
      accumulatedEventsRef.current = [
        ...dedupedNewEvents,
        ...accumulatedEventsRef.current,
      ];
      
      // Trim to maxEvents (circular buffer)
      if (accumulatedEventsRef.current.length > maxEvents) {
        accumulatedEventsRef.current = accumulatedEventsRef.current.slice(0, maxEvents);
      }
      
      // Update last timestamp to most recent event
      lastTimestampRef.current = dedupedNewEvents[0]!.timestamp;
    }
  }, [data, maxEvents]);

  // Manual refetch that resets to full history
  const refetch = useCallback(() => {
    hasInitialLoadRef.current = false;
    lastTimestampRef.current = null;
    accumulatedEventsRef.current = [];
    receivedEventIdsRef.current.clear();
    queryRefetch();
  }, [queryRefetch]);

  return {
    events: accumulatedEventsRef.current,
    progress: data?.progress ?? {
      currentPhase: null,
      lastCompletedPhase: null,
      totalPhases: null,
      progressPercentage: 0,
      totalFeatures: 0,
      completedFeatures: 0,
      totalTasks: 0,
      completedTasks: 0,
    },
    isLoading,
    isFetching,
    error: error as Error | null,
    lastFetchTime: lastFetchTimeRef.current,
    refetch,
  };
}
