import { SessionSummaryPane } from "./SessionSummaryPane";
import { SessionActivityStream } from "./SessionActivityStream";
import { useSessionProgress } from "@/hooks/useSessionProgress";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle } from "lucide-react";

/**
 * Props for SessionMonitor component
 */
export interface SessionMonitorProps {
  /** Epic ID to monitor */
  epicId: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SessionMonitor container component
 * 
 * Combines SessionSummaryPane and SessionActivityStream to provide
 * a complete view of real-time session progress for an epic.
 * 
 * Layout:
 * - Desktop: 30% summary pane | 70% activity stream (side-by-side)
 * - Mobile: Stacked vertically (summary on top, stream below)
 * 
 * Edge cases handled:
 * - Loading state while SSE initializes
 * - No active session message
 * - SSE connection errors with retry
 */
export function SessionMonitor({ epicId, className }: SessionMonitorProps) {
  const { sessionState } = useSessionProgress({
    epicId,
    enabled: true,
  });

  // Show loading state during initial connection
  if (sessionState.connectionStatus === "connecting" && sessionState.events.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full p-8", className)}>
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Connecting to session monitor...</p>
        </div>
      </div>
    );
  }

  // Show error state if connection failed after retries
  if (sessionState.connectionStatus === "error" && sessionState.error) {
    return (
      <div className={cn("flex items-center justify-center h-full p-8", className)}>
        <div className="flex flex-col items-center gap-3 text-destructive max-w-md">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm font-medium">Unable to connect to session monitor</p>
          <p className="text-xs text-muted-foreground text-center">
            {sessionState.error.message}
          </p>
          <p className="text-xs text-muted-foreground text-center">
            The server-sent events (SSE) endpoint may be unavailable. Try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  // Show "no active session" message if no events received
  if (sessionState.events.length === 0 && sessionState.connectionStatus === "connected") {
    return (
      <div className={cn("flex items-center justify-center h-full p-8", className)}>
        <div className="flex flex-col items-center gap-3 text-muted-foreground max-w-md text-center">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm font-medium">No active session</p>
          <p className="text-xs">
            Start an orchestrator run to see real-time progress monitoring here.
          </p>
        </div>
      </div>
    );
  }

  // Render the monitor with summary pane and activity stream
  return (
    <div
      className={cn(
        "flex flex-col md:flex-row gap-4 h-full p-4 overflow-hidden",
        className
      )}
    >
      {/* Summary Pane - 30% on desktop, full width on mobile */}
      <div className="w-full md:w-[30%] flex-shrink-0">
        <SessionSummaryPane sessionState={sessionState} />
      </div>

      {/* Activity Stream - 70% on desktop, full width on mobile */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <SessionActivityStream events={sessionState.events} />
      </div>
    </div>
  );
}
