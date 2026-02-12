import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { SessionProgressState } from "@/hooks/useSessionProgress";
import { SessionEventType } from "@spectree/shared";

/**
 * Props for SessionSummaryPane component
 */
export interface SessionSummaryPaneProps {
  /** Session state from useSessionProgress hook */
  sessionState: SessionProgressState;
  /** Optional additional className for styling */
  className?: string;
}

/**
 * Format duration in seconds to HH:MM:SS string
 */
function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return [hrs, mins, secs]
    .map(v => v.toString().padStart(2, '0'))
    .join(':');
}

/**
 * Format relative time from a timestamp
 */
function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const eventTime = new Date(timestamp).getTime();
  const diffMs = now - eventTime;
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 5) return "just now";
  if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
  
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

/**
 * Get connection status display properties
 */
function getConnectionStatusDisplay(status: string): {
  dotColor: string;
  text: string;
} {
  switch (status) {
    case 'connected':
      return { dotColor: 'bg-green-500', text: 'Connected' };
    case 'connecting':
      return { dotColor: 'bg-yellow-500', text: 'Connecting...' };
    case 'error':
      return { dotColor: 'bg-red-500', text: 'Error' };
    case 'disconnected':
    default:
      return { dotColor: 'bg-gray-400', text: 'Disconnected' };
  }
}

/**
 * SessionSummaryPane - Real-time session progress monitoring component
 * 
 * Displays epic progress, current phase, feature/task counts, and session health indicators.
 * Updates in real-time as session events arrive via SSE.
 */
export function SessionSummaryPane({
  sessionState,
  className,
}: SessionSummaryPaneProps) {
  const [sessionDuration, setSessionDuration] = useState<number>(0);
  const [relativeTime, setRelativeTime] = useState<string>('-');
  const [isStale, setIsStale] = useState<boolean>(false);

  // Calculate session duration based on SESSION_STARTED timestamp
  useEffect(() => {
    // Find the SESSION_STARTED event (skip progress logged events)
    const sessionStartEvent = sessionState.events.find(
      (event) => "eventType" in event && event.eventType === SessionEventType.SESSION_STARTED
    );

    if (!sessionStartEvent) {
      setSessionDuration(0);
      return;
    }

    const startTime = new Date(sessionStartEvent.timestamp).getTime();

    // Update duration every second
    const intervalId = setInterval(() => {
      const now = Date.now();
      const durationMs = now - startTime;
      const durationSeconds = Math.floor(durationMs / 1000);
      setSessionDuration(durationSeconds);
    }, 1000);

    // Initial calculation
    const now = Date.now();
    const durationMs = now - startTime;
    const durationSeconds = Math.floor(durationMs / 1000);
    setSessionDuration(durationSeconds);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [sessionState.events]);

  // Update relative time for last event
  useEffect(() => {
    if (!sessionState.lastEventTimestamp) {
      setRelativeTime('-');
      setIsStale(false);
      return;
    }

    // Update relative time every second
    const updateRelativeTime = () => {
      const timestamp = sessionState.lastEventTimestamp;
      if (!timestamp) return;
      
      const formatted = formatRelativeTime(timestamp);
      setRelativeTime(formatted);

      // Check if event is stale (>30 seconds old)
      const now = Date.now();
      const eventTime = new Date(timestamp).getTime();
      const diffSeconds = Math.floor((now - eventTime) / 1000);
      setIsStale(diffSeconds > 30);
    };

    updateRelativeTime();
    const intervalId = setInterval(updateRelativeTime, 1000);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [sessionState.lastEventTimestamp]);

  const statusDisplay = getConnectionStatusDisplay(sessionState.connectionStatus);

  return (
    <div
      className={cn(
        "flex flex-col space-y-6 w-full max-w-sm p-6 bg-card border border-border rounded-lg shadow-sm",
        className
      )}
    >
      {/* Section 1: Progress Bar */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          Epic Progress
        </h3>
        <div className="space-y-1">
          {/* Progress bar with smooth transitions */}
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500 ease-in-out"
              style={{ width: `${sessionState.progress.progressPercentage}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {sessionState.progress.progressPercentage}% complete
          </p>
        </div>
      </div>

      {/* Section 2: Current Phase */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          Current Phase
        </h3>
        <div className="text-lg font-semibold">
          {sessionState.progress.currentPhase !== null ? (
            <>
              Phase {sessionState.progress.currentPhase}
              {sessionState.progress.totalPhases !== null && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  of {sessionState.progress.totalPhases}
                </span>
              )}
            </>
          ) : sessionState.progress.lastCompletedPhase !== null ? (
            <>
              <span className="text-muted-foreground">Phase {sessionState.progress.lastCompletedPhase} completed</span>
              {sessionState.progress.totalPhases !== null && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  of {sessionState.progress.totalPhases}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">No active phase</span>
          )}
        </div>
      </div>

      {/* Section 3: Feature/Task Counts */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          Completion Status
        </h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Features:</span>
            <span className="font-medium">
              {sessionState.progress.completedFeatures}/{sessionState.progress.totalFeatures}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Tasks:</span>
            <span className="font-medium">
              {sessionState.progress.completedTasks}/{sessionState.progress.totalTasks}
            </span>
          </div>
        </div>
      </div>

      {/* Section 4: Health Indicators */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          Connection Status
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", statusDisplay.dotColor)} />
            <span className="text-sm">{statusDisplay.text}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Last event: {relativeTime}</span>
            {isStale && (
              <svg 
                className="w-4 h-4 text-yellow-500" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                />
              </svg>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            Duration: {formatDuration(sessionDuration)}
          </div>
        </div>
      </div>
    </div>
  );
}
