import { api } from './client';
import type { Feature, PaginatedResponse } from './types';

export interface FeatureFilters {
  epicId?: string | undefined;
  statusId?: string | undefined;
  assigneeId?: string | undefined;
  assignee?: string | undefined;
  status?: string | undefined;
  statusCategory?: string | undefined;
  query?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
}

export interface CreateFeatureInput {
  title: string;
  description?: string | undefined;
  epicId: string;
  statusId?: string | undefined;
  assigneeId?: string | undefined;
  priority?: number | undefined;
}

export interface UpdateFeatureInput extends Partial<Omit<CreateFeatureInput, 'epicId'>> {
  id: string;
}

export const featuresApi = {
  list: (filters: FeatureFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });
    const queryString = params.toString();
    return api.get<PaginatedResponse<Feature>>(`/features${queryString ? `?${queryString}` : ''}`);
  },

  get: (id: string) => api.get<{ data: Feature }>(`/features/${id}`),

  create: (input: CreateFeatureInput) => api.post<{ data: Feature }>('/features', input),

  update: ({ id, ...input }: UpdateFeatureInput) =>
    api.put<{ data: Feature }>(`/features/${id}`, input),

  delete: (id: string) => api.delete<void>(`/features/${id}`),
};
