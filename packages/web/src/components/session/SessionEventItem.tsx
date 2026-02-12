import { SessionEvent, SessionEventType } from "@spectree/shared";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Check, Play, AlertCircle, Activity, MessageSquare } from "lucide-react";
import type { ActivityEvent } from "@/hooks/useSessionProgress";
import { isProgressLoggedEvent } from "@/hooks/useSessionProgress";

export interface SessionEventItemProps {
  event: ActivityEvent;
}

/**
 * Format timestamp as relative time or HH:MM:SS
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  
  // If less than 60 seconds ago, show relative time
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }
  
  // If less than 60 minutes ago, show relative time
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  
  // Otherwise show HH:MM:SS
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Get icon component based on event type
 */
function getEventIcon(eventType: SessionEventType) {
  switch (eventType) {
    case SessionEventType.SESSION_FEATURE_COMPLETED:
    case SessionEventType.SESSION_TASK_COMPLETED:
    case SessionEventType.SESSION_PHASE_COMPLETED:
      return Check;
    case SessionEventType.SESSION_FEATURE_STARTED:
    case SessionEventType.SESSION_TASK_STARTED:
    case SessionEventType.SESSION_PHASE_STARTED:
      return Play;
    case SessionEventType.SESSION_ERROR:
      return AlertCircle;
    default:
      return Activity;
  }
}

/**
 * Get badge variant based on event type
 */
function getEventBadgeVariant(
  eventType: SessionEventType
): "default" | "secondary" | "destructive" | "outline" {
  switch (eventType) {
    case SessionEventType.SESSION_FEATURE_COMPLETED:
    case SessionEventType.SESSION_TASK_COMPLETED:
      return "default"; // Green in most themes
    case SessionEventType.SESSION_FEATURE_STARTED:
    case SessionEventType.SESSION_TASK_STARTED:
    case SessionEventType.SESSION_PHASE_STARTED:
      return "secondary"; // Blue
    case SessionEventType.SESSION_ERROR:
      return "destructive"; // Red
    default:
      return "outline"; // Gray
  }
}

/**
 * Get icon color classes based on event type
 */
function getIconColorClass(eventType: SessionEventType): string {
  switch (eventType) {
    case SessionEventType.SESSION_FEATURE_COMPLETED:
    case SessionEventType.SESSION_TASK_COMPLETED:
      return "text-green-500";
    case SessionEventType.SESSION_FEATURE_STARTED:
    case SessionEventType.SESSION_TASK_STARTED:
    case SessionEventType.SESSION_PHASE_STARTED:
      return "text-blue-500";
    case SessionEventType.SESSION_ERROR:
      return "text-red-500";
    default:
      return "text-gray-500";
  }
}

/**
 * Get human-readable event type label
 */
function getEventTypeLabel(eventType: SessionEventType): string {
  switch (eventType) {
    case SessionEventType.SESSION_STARTED:
      return "Session Started";
    case SessionEventType.SESSION_ENDED:
      return "Session Ended";
    case SessionEventType.SESSION_PHASE_STARTED:
      return "Phase Started";
    case SessionEventType.SESSION_PHASE_COMPLETED:
      return "Phase Completed";
    case SessionEventType.SESSION_FEATURE_STARTED:
      return "Feature Started";
    case SessionEventType.SESSION_FEATURE_COMPLETED:
      return "Feature Completed";
    case SessionEventType.SESSION_TASK_STARTED:
      return "Task Started";
    case SessionEventType.SESSION_TASK_COMPLETED:
      return "Task Completed";
    case SessionEventType.SESSION_ERROR:
      return "Error";
    default:
      return eventType;
  }
}

/**
 * Extract event description from payload
 */
function getEventDescription(event: SessionEvent): string {
  switch (event.eventType) {
    case SessionEventType.SESSION_STARTED:
    case SessionEventType.SESSION_ENDED:
      return event.payload.status || "";
    case SessionEventType.SESSION_PHASE_STARTED:
    case SessionEventType.SESSION_PHASE_COMPLETED:
      return `Phase ${event.payload.phaseNumber} of ${event.payload.totalPhases} (${event.payload.featureCount} features)`;
    case SessionEventType.SESSION_FEATURE_STARTED:
    case SessionEventType.SESSION_FEATURE_COMPLETED: {
      const duration = event.payload.durationMs
        ? ` (${formatDuration(event.payload.durationMs)})`
        : "";
      return `${event.payload.identifier}: ${event.payload.title}${duration}`;
    }
    case SessionEventType.SESSION_TASK_STARTED:
    case SessionEventType.SESSION_TASK_COMPLETED: {
      const duration = event.payload.durationMs
        ? ` (${formatDuration(event.payload.durationMs)})`
        : "";
      return `${event.payload.identifier}: ${event.payload.title}${duration}`;
    }
    case SessionEventType.SESSION_ERROR:
      return event.payload.errorMessage;
    default:
      return "";
  }
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

export function SessionEventItem({ event }: SessionEventItemProps) {
  // Render progress logged events with compact styling
  if (isProgressLoggedEvent(event)) {
    const timestamp = formatTimestamp(event.timestamp);
    const percentText = event.percentComplete != null ? ` (${event.percentComplete}%)` : "";
    return (
      <div className="flex items-start gap-2 px-3 py-1.5 rounded-md border-l-2 border-l-purple-400/50 bg-purple-50/50 dark:bg-purple-950/10">
        <div className="flex-shrink-0 mt-0.5 text-purple-500">
          <MessageSquare className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-foreground/80 break-words">
              {event.message}{percentText}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono ml-auto flex-shrink-0">
              {timestamp}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Render standard session events
  const timestamp = formatTimestamp(event.timestamp);
  const badgeVariant = getEventBadgeVariant(event.eventType);
  const eventLabel = getEventTypeLabel(event.eventType);
  const description = getEventDescription(event);
  const IconComponent = getEventIcon(event.eventType);
  const iconColorClass = getIconColorClass(event.eventType);

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-md border-l-4 transition-colors",
        {
          "border-l-green-500 bg-green-50 dark:bg-green-950/20":
            event.eventType === SessionEventType.SESSION_FEATURE_COMPLETED ||
            event.eventType === SessionEventType.SESSION_TASK_COMPLETED,
          "border-l-blue-500 bg-blue-50 dark:bg-blue-950/20":
            event.eventType === SessionEventType.SESSION_FEATURE_STARTED ||
            event.eventType === SessionEventType.SESSION_TASK_STARTED ||
            event.eventType === SessionEventType.SESSION_PHASE_STARTED,
          "border-l-red-500 bg-red-50 dark:bg-red-950/20":
            event.eventType === SessionEventType.SESSION_ERROR,
          "border-l-gray-400 bg-gray-50 dark:bg-gray-950/20":
            event.eventType === SessionEventType.SESSION_STARTED ||
            event.eventType === SessionEventType.SESSION_ENDED ||
            event.eventType === SessionEventType.SESSION_PHASE_COMPLETED,
        }
      )}
    >
      {/* Icon */}
      <div className={cn("flex-shrink-0 mt-0.5", iconColorClass)}>
        <IconComponent className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Badge variant={badgeVariant} className="text-xs">
            {eventLabel}
          </Badge>
          <span className="text-xs text-muted-foreground font-mono">
            {timestamp}
          </span>
        </div>
        {description && (
          <div className="text-sm text-foreground break-words">{description}</div>
        )}
      </div>
    </div>
  );
}
