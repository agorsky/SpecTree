/**
 * Query key factory for session events
 * 
 * Follows existing patterns for hierarchical query key structure.
 * Enables targeted cache invalidation and query management.
 */

export interface SessionEventsFilters {
  sessionId?: string | undefined;
  since?: string;
  eventTypes?: string[];
}

export const sessionEventKeys = {
  all: ['session-events'] as const,
  byEpic: (epicId: string) => [...sessionEventKeys.all, epicId] as const,
  events: (epicId: string, filters: SessionEventsFilters = {}) => 
    [...sessionEventKeys.byEpic(epicId), 'events', filters] as const,
};
