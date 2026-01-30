import { api } from './client';
import type { Epic, PaginatedResponse } from './types';

export interface EpicFilters {
  teamId?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
  includeArchived?: boolean | undefined;
}

export interface CreateEpicInput {
  name: string;
  description?: string | undefined;
  teamId: string;
  icon?: string | undefined;
  color?: string | undefined;
}

export interface UpdateEpicInput extends Partial<Omit<CreateEpicInput, 'teamId'>> {
  id: string;
}

export const epicsApi = {
  list: (filters: EpicFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });
    const queryString = params.toString();
    return api.get<PaginatedResponse<Epic>>(`/epics${queryString ? `?${queryString}` : ''}`);
  },

  get: (id: string) => api.get<{ data: Epic }>(`/epics/${id}`),

  create: (input: CreateEpicInput) => api.post<{ data: Epic }>('/epics', input),

  update: ({ id, ...input }: UpdateEpicInput) =>
    api.put<{ data: Epic }>(`/epics/${id}`, input),

  delete: (id: string) => api.delete<void>(`/epics/${id}`),

  archive: (id: string) => api.post<{ data: Epic }>(`/epics/${id}/archive`, {}),

  unarchive: (id: string) => api.post<{ data: Epic }>(`/epics/${id}/unarchive`, {}),
};
