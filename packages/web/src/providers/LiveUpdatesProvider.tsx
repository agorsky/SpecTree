import { type PropsWithChildren, createContext, useContext } from "react";
import { useLiveUpdates } from "@/hooks/useLiveUpdates";
import { useAuthStore } from "@/stores/auth-store";
import type { ConnectionStatus } from "@/hooks/useEventSource";

interface LiveUpdatesContextValue {
  status: ConnectionStatus;
}

const LiveUpdatesContext = createContext<LiveUpdatesContextValue | null>(null);

/**
 * Hook to access live updates status from anywhere in the app
 */
export function useLiveUpdatesStatus(): ConnectionStatus {
  const context = useContext(LiveUpdatesContext);
  if (!context) {
    // Default to disconnected if not within provider
    return "disconnected";
  }
  return context.status;
}

/**
 * LiveUpdatesProvider mounts the live updates hook at app level
 * to enable real-time React Query cache invalidation from SSE events
 */
export function LiveUpdatesProvider({ children }: PropsWithChildren) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Connect to SSE for live updates when authenticated
  // Global updates with no epic filter
  const { status } = useLiveUpdates({
    url: "/api/v1/events",
    enabled: isAuthenticated,
  });

  return (
    <LiveUpdatesContext.Provider value={{ status }}>
      {children}
    </LiveUpdatesContext.Provider>
  );
}
