import { api } from './client';
import type { Project, PaginatedResponse } from './types';

export interface ProjectFilters {
  teamId?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
}

export interface CreateProjectInput {
  name: string;
  description?: string | undefined;
  teamId: string;
  icon?: string | undefined;
  color?: string | undefined;
}

export interface UpdateProjectInput extends Partial<Omit<CreateProjectInput, 'teamId'>> {
  id: string;
}

export const projectsApi = {
  list: (filters: ProjectFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });
    const queryString = params.toString();
    return api.get<PaginatedResponse<Project>>(`/projects${queryString ? `?${queryString}` : ''}`);
  },

  get: (id: string) => api.get<{ data: Project }>(`/projects/${id}`),

  create: (input: CreateProjectInput) => api.post<{ data: Project }>('/projects', input),

  update: ({ id, ...input }: UpdateProjectInput) =>
    api.put<{ data: Project }>(`/projects/${id}`, input),

  delete: (id: string) => api.delete<void>(`/projects/${id}`),
};
