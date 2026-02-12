import { api } from './client';

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
};
