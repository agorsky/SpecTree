import { isSessionFeatureEvent, isSessionTaskEvent, isSessionTaskProgressEvent, isSessionPhaseEvent, isSessionLifecycleEvent, isSessionErrorEvent, SessionEvent } from "@dispatcher/shared";
import { SessionEventItem } from "./SessionEventItem";
import { cn } from "@/lib/utils";
import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, X } from "lucide-react";
import { List, ListImperativeAPI } from "react-window";

export interface SessionActivityStreamProps {
  /** Array of session events to display */
  events: SessionEvent[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * Event filter categories
 */
type EventFilterCategory = "all" | "lifecycle" | "phases" | "features" | "tasks" | "errors";

/**
 * Threshold for using virtualization (events count)
 */
const VIRTUALIZATION_THRESHOLD = 100;

/**
 * Estimated height of each event item in pixels
 */
const EVENT_ITEM_HEIGHT = 80;

/**
 * Filter events by category
 */
function filterEventsByCategory(events: SessionEvent[], category: EventFilterCategory): SessionEvent[] {
  if (category === "all") return events;

  return events.filter((event) => {
    switch (category) {
      case "lifecycle":
        return isSessionLifecycleEvent(event);
      case "phases":
        return isSessionPhaseEvent(event);
      case "features":
        return isSessionFeatureEvent(event);
      case "tasks":
        return isSessionTaskEvent(event) || isSessionTaskProgressEvent(event);
      case "errors":
        return isSessionErrorEvent(event);
      default:
        return true;
    }
  });
}

/**
 * Filter events by search query
 */
function filterEventsBySearch(events: SessionEvent[], query: string): SessionEvent[] {
  if (!query.trim()) return events;

  const lowerQuery = query.toLowerCase();

  return events.filter((event) => {
    // Search in feature/task titles
    if (isSessionFeatureEvent(event) || isSessionTaskEvent(event)) {
      const title = event.payload.title?.toLowerCase() || "";
      const identifier = event.payload.identifier?.toLowerCase() || "";
      return title.includes(lowerQuery) || identifier.includes(lowerQuery);
    }

    // Search in error messages
    if (isSessionErrorEvent(event)) {
      const errorMessage = event.payload.errorMessage?.toLowerCase() || "";
      return errorMessage.includes(lowerQuery);
    }

    // Search in phase info
    if (isSessionPhaseEvent(event)) {
      const phaseText = `phase ${event.payload.phaseNumber}`.toLowerCase();
      return phaseText.includes(lowerQuery);
    }

    return false;
  });
}

/**
 * SessionActivityStream Component
 * 
 * Displays a scrollable list of session events in chronological order.
 * Events are sorted with newest at the bottom for a natural activity stream feel.
 * Features auto-scroll to latest events with manual pause/resume, filtering, and search.
 * 
 * @example
 * ```tsx
 * <SessionActivityStream events={sessionState.events} />
 * ```
 */
export function SessionActivityStream({
  events,
  className,
}: SessionActivityStreamProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const virtualListRef = useRef<ListImperativeAPI>(null);
  const lastEventRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollPaused, setIsAutoScrollPaused] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const isUserScrollingRef = useRef(false);

  // Filter and search state
  const [filterCategory, setFilterCategory] = useState<EventFilterCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Apply filters
  const filteredEvents = useMemo(() => {
    let result = events;
    
    // Apply category filter
    result = filterEventsByCategory(result, filterCategory);
    
    // Apply search filter
    result = filterEventsBySearch(result, searchQuery);
    
    return result;
  }, [events, filterCategory, searchQuery]);

  // Sort events by timestamp (oldest first, newest at bottom)
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }, [filteredEvents]);

  // Check if any filters are active
  const hasActiveFilters = filterCategory !== "all" || searchQuery.trim() !== "";

  // Determine if we should use virtualization
  const useVirtualization = sortedEvents.length > VIRTUALIZATION_THRESHOLD;

  /**
   * Clear all filters
   */
  const clearFilters = () => {
    setFilterCategory("all");
    setSearchQuery("");
  };

  /**
   * Check if user has scrolled away from bottom (for non-virtualized list)
   * Threshold: within 50px of bottom is considered "at bottom"
   */
  const checkScrollPosition = useCallback(() => {
    if (useVirtualization) return; // Handled separately for virtualized list

    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isAtBottom = distanceFromBottom < 50;

    if (!isAtBottom && !isUserScrollingRef.current) {
      // User has scrolled up
      isUserScrollingRef.current = true;
      setIsAutoScrollPaused(true);
      setShowJumpToLatest(true);
    } else if (isAtBottom && isUserScrollingRef.current) {
      // User has scrolled back to bottom
      isUserScrollingRef.current = false;
      setIsAutoScrollPaused(false);
      setShowJumpToLatest(false);
    }
  }, [useVirtualization]);

  /**
   * Auto-scroll to bottom when new events arrive (if not paused)
   */
  useEffect(() => {
    if (isUserScrollingRef.current) {
      // Don't auto-scroll if user has manually scrolled up
      return;
    }

    if (useVirtualization) {
      // For virtualized list, scroll to last item
      if (virtualListRef.current && sortedEvents.length > 0) {
        virtualListRef.current.scrollToRow({
          index: sortedEvents.length - 1,
          align: "end",
          behavior: "smooth",
        });
      }
    } else {
      // For non-virtualized list, scroll to the last event element
      if (lastEventRef.current) {
        lastEventRef.current.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      }
    }
  }, [sortedEvents.length, useVirtualization]);

  /**
   * Handle scroll event to detect manual scrolling
   */
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener("scroll", checkScrollPosition);
    return () => {
      container.removeEventListener("scroll", checkScrollPosition);
    };
  }, [checkScrollPosition]);

  /**
   * Jump to latest event and resume auto-scroll
   */
  const handleJumpToLatest = () => {
    isUserScrollingRef.current = false;
    setIsAutoScrollPaused(false);
    setShowJumpToLatest(false);

    if (useVirtualization) {
      // For virtualized list, scroll to last item
      if (virtualListRef.current && sortedEvents.length > 0) {
        virtualListRef.current.scrollToRow({
          index: sortedEvents.length - 1,
          align: "end",
          behavior: "smooth",
        });
      }
    } else {
      // For non-virtualized list, scroll to the last event element
      if (lastEventRef.current) {
        lastEventRef.current.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      }
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col w-full lg:w-[70%] mx-auto",
        className
      )}
    >
      {/* Header with filters */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Session Activity</h2>
          <div className="flex items-center gap-4">
            {isAutoScrollPaused && (
              <span className="text-xs text-muted-foreground">
                Auto-scroll paused
              </span>
            )}
            <div className="text-sm text-muted-foreground">
              {hasActiveFilters && (
                <span className="mr-2">
                  Showing {sortedEvents.length} of {events.length}
                </span>
              )}
              {!hasActiveFilters && (
                <span>{sortedEvents.length} {sortedEvents.length === 1 ? "event" : "events"}</span>
              )}
            </div>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Category filter */}
          <Select
            value={filterCategory}
            onValueChange={(value) => setFilterCategory(value as EventFilterCategory)}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="lifecycle">Lifecycle</SelectItem>
              <SelectItem value="phases">Phases</SelectItem>
              <SelectItem value="features">Features</SelectItem>
              <SelectItem value="tasks">Tasks</SelectItem>
              <SelectItem value="errors">Errors</SelectItem>
            </SelectContent>
          </Select>

          {/* Search input */}
          <div className="flex-1 relative">
            <Input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-8"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <Button
              onClick={clearFilters}
              variant="outline"
              size="sm"
              className="whitespace-nowrap"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Scrollable container */}
      <div className="relative">
        {sortedEvents.length === 0 ? (
          // Empty state
          <div className="border rounded-lg p-4 bg-background">
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
              <div className="text-muted-foreground text-sm">
                No events yet. Events will appear here as the session progresses.
              </div>
            </div>
          </div>
        ) : useVirtualization ? (
          // Virtualized list for large event counts
          <div className="border rounded-lg bg-background">
            <List
              listRef={virtualListRef}
              rowCount={sortedEvents.length}
              rowHeight={EVENT_ITEM_HEIGHT}
              defaultHeight={600}
              rowComponent={({ index, style }) => {
                const event = sortedEvents[index];
                if (!event) return null;
                return (
                  <div style={style} className="px-4 py-1">
                    <SessionEventItem event={event} />
                  </div>
                );
              }}
              rowProps={{} as Record<string, never>}
            />
          </div>
        ) : (
          // Non-virtualized list for small event counts
          <div
            ref={scrollContainerRef}
            className="overflow-y-auto max-h-[600px] border rounded-lg p-4 bg-background"
          >
            <div className="space-y-2">
              {sortedEvents.map((event, index) => {
                const key = `${event.epicId}-${event.sessionId}-${event.timestamp}-${index}`;
                return (
                <div
                  key={key}
                  ref={index === sortedEvents.length - 1 ? lastEventRef : undefined}
                >
                  <SessionEventItem event={event} />
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Jump to Latest button */}
        {showJumpToLatest && (
          <div className="absolute bottom-4 right-4">
            <Button
              onClick={handleJumpToLatest}
              size="sm"
              className="shadow-lg"
            >
              <ArrowDown className="mr-2 h-4 w-4" />
              Jump to Latest
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
