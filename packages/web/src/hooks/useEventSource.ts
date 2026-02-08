import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";

export interface SSEEvent {
  type: string;
  data: unknown;
  timestamp: string;
}

export interface UseEventSourceOptions {
  url: string;
  epicId?: string;
  enabled?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
  onEvent?: (event: SSEEvent) => void;
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface UseEventSourceResult {
  status: ConnectionStatus;
  lastEvent: SSEEvent | null;
  error: Error | null;
}

export function useEventSource({
  url,
  epicId,
  enabled = true,
  onOpen,
  onClose,
  onError,
  onEvent,
}: UseEventSourceOptions): UseEventSourceResult {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const backoffRef = useRef<number>(1000); // Start with 1 second
  const accessToken = useAuthStore((state) => state.accessToken);

  // Use refs for callbacks to avoid re-triggering useEffect on callback changes
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  const onEventRef = useRef(onEvent);

  // Update refs when callbacks change
  useEffect(() => {
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;
    onErrorRef.current = onError;
    onEventRef.current = onEvent;
  }, [onOpen, onClose, onError, onEvent]);

  const connect = () => {
    // Don't connect if disabled or no token
    if (!enabled || !accessToken) {
      setStatus("disconnected");
      return;
    }

    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Build URL with query params
    const params = new URLSearchParams();
    params.append("token", accessToken);
    if (epicId) {
      params.append("epicId", epicId);
    }
    const fullUrl = `${url}?${params.toString()}`;

    setStatus("connecting");
    setError(null);

    try {
      const es = new EventSource(fullUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        setStatus("connected");
        // Reset backoff on successful connection
        backoffRef.current = 1000;
        onOpenRef.current?.();
      };

      es.onmessage = (event) => {
        try {
          // EventSource.data is string, but TypeScript types it as any
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const rawData: string = event.data;
          const data = JSON.parse(rawData) as unknown;
          const sseEvent: SSEEvent = {
            type: event.type,
            data,
            timestamp: new Date().toISOString(),
          };
          setLastEvent(sseEvent);
          onEventRef.current?.(sseEvent);
        } catch (err) {
          console.error("Failed to parse SSE message:", err);
        }
      };

      es.onerror = () => {
        const connectionError = new Error("EventSource connection failed");
        setStatus("disconnected");
        setError(connectionError);
        onErrorRef.current?.(connectionError);
        es.close();

        // Schedule reconnection with exponential backoff
        scheduleReconnect();
      };
    } catch (err) {
      const connectionError =
        err instanceof Error ? err : new Error("Failed to create EventSource");
      setStatus("disconnected");
      setError(connectionError);
      onErrorRef.current?.(connectionError);
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    reconnectTimerRef.current = setTimeout(() => {
      connect();
      // Exponential backoff: double the delay, max 30 seconds
      backoffRef.current = Math.min(backoffRef.current * 2, 30000);
    }, backoffRef.current);
  };

  useEffect(() => {
    connect();

    // Cleanup on unmount or when dependencies change
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      onCloseRef.current?.();
    };
  }, [url, epicId, enabled, accessToken]);

  return {
    status,
    lastEvent,
    error,
  };
}
