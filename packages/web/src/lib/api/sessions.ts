import { api } from './client';
import type { SessionEvent } from '@dispatcher/shared';

export type SessionStatus = 'active' | 'completed' | 'abandoned';

export interface Session {
  id: string;
  epicId: string;
  epicName?: string;
  externalId?: string | null;
  startedAt: string;
  endedAt?: string | null;
  status: SessionStatus;
  summary?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionFilters {
  epicId?: string;
  status?: SessionStatus;
  createdAt?: string;
  cursor?: string;
  limit?: number;
}

export interface ProgressState {
  /** Current phase number (1-indexed), null when no phase is active */
  currentPhase: number | null;
  /** Last completed phase number, null if no phase completed yet */
  lastCompletedPhase: number | null;
  /** Total number of phases */
  totalPhases: number | null;
  /** Overall progress percentage (0-100) */
  progressPercentage: number;
  /** Total features in the epic */
  totalFeatures: number;
  /** Completed features */
  completedFeatures: number;
  /** Total tasks across all features */
  totalTasks: number;
  /** Completed tasks */
  completedTasks: number;
}

export interface SessionEventsQuery {
  /** Fetch events after this timestamp (ISO 8601) */
  since?: string;
  /** Filter by specific session ID */
  sessionId?: string;
  /** Filter by event types */
  eventTypes?: string[];
  /** Max results to return (default 50, max 100) */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
}

export interface SessionEventsResponse {
  events: SessionEvent[];
  nextCursor?: string;
  totalCount: number;
  progress: ProgressState;
}

export const sessionsApi = {
  /**
   * List sessions with optional filtering.
   * Note: The backend API is per-epic, so epicId is required.
   */
  listByEpic: (epicId: string, filters: Omit<SessionFilters, 'epicId'> = {}) => {
    const limit = filters.limit || 20;
    return api.get<{ data: Session[] }>(`/sessions/${epicId}/history?limit=${limit}`);
  },

  /**
   * Get a specific session by ID
   */
  get: (id: string) => api.get<{ data: Session }>(`/sessions/by-id/${id}`),

  /**
   * Get the active session for an epic
   */
  getActive: (epicId: string) => 
    api.get<{ data: Session | null }>(`/sessions/${epicId}/active`),

  /**
   * Get the last completed session for an epic
   */
  getLast: (epicId: string) => 
    api.get<{ data: Session | null }>(`/sessions/${epicId}/last`),

  /**
   * Query session events for an epic with optional filtering.
   * Returns events with computed progress state.
   */
  getEvents: (epicId: string, query: SessionEventsQuery = {}) => {
    const params = new URLSearchParams();
    
    if (query.since) params.append('since', query.since);
    if (query.sessionId) params.append('sessionId', query.sessionId);
    if (query.eventTypes && query.eventTypes.length > 0) {
      query.eventTypes.forEach(type => params.append('eventTypes', type));
    }
    if (query.limit !== undefined) params.append('limit', query.limit.toString());
    if (query.cursor) params.append('cursor', query.cursor);
    
    const queryString = params.toString();
    const url = `/sessions/${epicId}/events${queryString ? `?${queryString}` : ''}`;
    
    return api.get<{ data: SessionEventsResponse }>(url);
  },
};
