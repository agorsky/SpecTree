import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useEventSource, type SSEEvent } from "./useEventSource";
import { epicKeys } from "./queries/use-epics";
import { featureKeys } from "./queries/use-features";
import { taskKeys } from "./queries/use-tasks";
import { useToast } from "./useToast";

interface EntityEventData {
  entityType?: string;
  entityId?: string;
  epicId?: string;
  featureId?: string;
  taskId?: string;
  [key: string]: unknown;
}

/**
 * Maps SSE events to React Query cache invalidation query keys
 */
function getQueryKeysToInvalidate(event: SSEEvent): Array<readonly unknown[]> {
  const queryKeys: Array<readonly unknown[]> = [];
  const data = event.data as EntityEventData;

  if (!data || typeof data !== "object") {
    return queryKeys;
  }

  const { entityType, entityId, epicId, featureId, taskId } = data;

  switch (event.type) {
    case "entity.created":
      if (entityType === "epic") {
        // Invalidate all epic lists
        queryKeys.push(epicKeys.lists());
      } else if (entityType === "feature") {
        // Invalidate all feature lists
        queryKeys.push(featureKeys.lists());
        // If we know the epic, invalidate that epic's detail to update feature count
        if (epicId) {
          queryKeys.push(epicKeys.detail(epicId));
        }
      } else if (entityType === "task") {
        // Invalidate all task lists
        queryKeys.push(taskKeys.lists());
        // Invalidate parent feature to update task count
        if (featureId) {
          queryKeys.push(featureKeys.detail(featureId));
        }
      }
      break;

    case "entity.updated":
      if (entityType === "epic" && entityId) {
        // Invalidate specific epic and all lists
        queryKeys.push(epicKeys.detail(entityId));
        queryKeys.push(epicKeys.lists());
      } else if (entityType === "feature" && entityId) {
        // Invalidate specific feature and all lists
        queryKeys.push(featureKeys.detail(entityId));
        queryKeys.push(featureKeys.lists());
        // Also invalidate parent epic
        if (epicId) {
          queryKeys.push(epicKeys.detail(epicId));
        }
      } else if (entityType === "task" && taskId) {
        // Invalidate specific task and all lists
        queryKeys.push(taskKeys.detail(taskId));
        queryKeys.push(taskKeys.lists());
        // Invalidate parent feature
        if (featureId) {
          queryKeys.push(featureKeys.detail(featureId));
        }
      }
      break;

    case "entity.deleted":
      if (entityType === "epic" && entityId) {
        // Invalidate specific epic and all lists
        queryKeys.push(epicKeys.detail(entityId));
        queryKeys.push(epicKeys.lists());
        // Also invalidate all features and tasks under this epic
        queryKeys.push(featureKeys.lists());
        queryKeys.push(taskKeys.lists());
      } else if (entityType === "feature" && entityId) {
        // Invalidate specific feature and all lists
        queryKeys.push(featureKeys.detail(entityId));
        queryKeys.push(featureKeys.lists());
        // Invalidate all tasks under this feature
        queryKeys.push(taskKeys.lists());
        // Invalidate parent epic
        if (epicId) {
          queryKeys.push(epicKeys.detail(epicId));
        }
      } else if (entityType === "task" && taskId) {
        // Invalidate specific task and all lists
        queryKeys.push(taskKeys.detail(taskId));
        queryKeys.push(taskKeys.lists());
        // Invalidate parent feature
        if (featureId) {
          queryKeys.push(featureKeys.detail(featureId));
        }
      }
      break;

    default:
      // For unknown event types, invalidate all lists as a safe fallback
      queryKeys.push(epicKeys.lists());
      queryKeys.push(featureKeys.lists());
      queryKeys.push(taskKeys.lists());
  }

  return queryKeys;
}

export interface UseLiveUpdatesOptions {
  url: string;
  epicId?: string;
  enabled?: boolean;
  pollingInterval?: number; // milliseconds, default 30000 (30s)
}

/**
 * Hook that bridges SSE events to React Query cache invalidation
 * Falls back to polling when SSE connection is disconnected
 */
export function useLiveUpdates({
  url,
  epicId,
  enabled = true,
  pollingInterval = 30000,
}: UseLiveUpdatesOptions) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const invalidationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingInvalidationsRef = useRef<Set<string>>(new Set());

  /**
   * Format event message for toast notification
   */
  const formatEventMessage = useCallback((event: SSEEvent): string => {
    const { type, data } = event;
    const eventData = data as EntityEventData;

    // Extract entity type from data
    const entityType = eventData.entityType || "item";
    const entity = entityType.charAt(0).toUpperCase() + entityType.slice(1);

    // Extract action from event type (e.g., "entity.updated" -> "updated")
    const action = type.split(".")[1] || "changed";

    return `${entity} ${action}`;
  }, []);

  /**
   * Debounced invalidation - batches multiple invalidations within 100ms window
   */
  const scheduleInvalidation = useCallback(
    (queryKeys: Array<readonly unknown[]>) => {
      // Add query keys to pending set (using JSON.stringify for deduplication)
      queryKeys.forEach((key) => {
        pendingInvalidationsRef.current.add(JSON.stringify(key));
      });

      // Clear existing timer if any
      if (invalidationTimerRef.current) {
        clearTimeout(invalidationTimerRef.current);
      }

      // Schedule batch invalidation after 100ms
      invalidationTimerRef.current = setTimeout(() => {
        const keysToInvalidate = Array.from(pendingInvalidationsRef.current).map(
          (key) => JSON.parse(key) as unknown[]
        );

        keysToInvalidate.forEach((queryKey) => {
          queryClient.invalidateQueries({ queryKey });
        });

        // Clear pending set
        pendingInvalidationsRef.current.clear();
      }, 100);
    },
    [queryClient]
  );

  /**
   * Handle SSE events by invalidating relevant query keys
   * Wrapped in try-catch to prevent single event errors from breaking the connection
   */
  const handleEvent = useCallback(
    (event: SSEEvent) => {
      try {
        // Show toast notification for entity change events
        if (event.type.startsWith("entity.")) {
          const message = formatEventMessage(event);
          toast(message, 3000);
        }

        const queryKeys = getQueryKeysToInvalidate(event);
        if (queryKeys.length > 0) {
          scheduleInvalidation(queryKeys);
        }
      } catch (error) {
        console.error("[LiveUpdates] Error processing event:", error, event);
        // Don't throw - let SSE connection continue despite single event errors
      }
    },
    [scheduleInvalidation, toast, formatEventMessage]
  );

  /**
   * Polling fallback - invalidate all lists when disconnected
   */
  const startPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
    }

    pollingTimerRef.current = setInterval(() => {
      // When polling, invalidate all lists to ensure fresh data
      queryClient.invalidateQueries({ queryKey: epicKeys.lists() });
      queryClient.invalidateQueries({ queryKey: featureKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    }, pollingInterval);
  }, [queryClient, pollingInterval]);

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  // Connect to SSE
  const { status } = useEventSource({
    url,
    ...(epicId && { epicId }),
    enabled,
    onEvent: handleEvent,
  });

  // Manage polling based on connection status
  useEffect(() => {
    if (status === "disconnected") {
      // Start polling when disconnected
      console.log("[LiveUpdates] SSE disconnected, falling back to polling");
      startPolling();
    } else if (status === "connected") {
      // Stop polling when connected
      console.log("[LiveUpdates] SSE connected, stopping polling");
      stopPolling();
    }

    // Cleanup on unmount
    return () => {
      stopPolling();
      if (invalidationTimerRef.current) {
        clearTimeout(invalidationTimerRef.current);
      }
    };
  }, [status, startPolling, stopPolling]);

  return { status };
}
