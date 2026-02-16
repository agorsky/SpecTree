import { SessionSummaryPane } from "./SessionSummaryPane";
import { SessionActivityStream } from "./SessionActivityStream";
import { useSessionEvents } from "@/hooks/useSessionEvents";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
 * - Loading state while data initializes
 * - No active session message
 * - API errors with retry
 */
export function SessionMonitor({ epicId, className }: SessionMonitorProps) {
  const { events, progress, isLoading, error, refetch } = useSessionEvents({
    epicId,
    enabled: true,
    refetchInterval: 2000,
  });

  // Show loading state during initial fetch
  if (isLoading && events.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full p-8", className)}>
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading session data...</p>
        </div>
      </div>
    );
  }

  // Show error state only if no events have been received yet
  if (error && events.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full p-8", className)}>
        <div className="flex flex-col items-center gap-3 text-destructive max-w-md">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm font-medium">Unable to load session data</p>
          <p className="text-xs text-muted-foreground text-center">
            {error.message}
          </p>
          <Button variant="outline" size="sm" onClick={refetch} className="mt-2">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Show "no active session" message if no events received
  if (events.length === 0 && !isLoading) {
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
        <SessionSummaryPane progress={progress} events={events} />
      </div>

      {/* Activity Stream - 70% on desktop, full width on mobile */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <SessionActivityStream events={events} />
      </div>
    </div>
  );
}
