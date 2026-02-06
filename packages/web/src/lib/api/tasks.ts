import { api } from './client';
import type { Task, PaginatedResponse, CodeContextResponse } from './types';

export interface TaskFilters {
  featureId?: string | undefined;
  epicId?: string | undefined;
  statusId?: string | undefined;
  assigneeId?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
}

export interface CreateTaskInput {
  title: string;
  description?: string | undefined;
  featureId: string;
  statusId?: string | undefined;
  assigneeId?: string | undefined;
  priority?: number | undefined;
}

export interface UpdateTaskInput extends Partial<Omit<CreateTaskInput, 'featureId'>> {
  id: string;
}

export const tasksApi = {
  list: (filters: TaskFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });
    const queryString = params.toString();
    return api.get<PaginatedResponse<Task>>(`/tasks${queryString ? `?${queryString}` : ''}`);
  },

  get: (id: string) => api.get<{ data: Task }>(`/tasks/${id}`),

  create: (input: CreateTaskInput) => api.post<{ data: Task }>('/tasks', input),

  update: ({ id, ...input }: UpdateTaskInput) =>
    api.put<{ data: Task }>(`/tasks/${id}`, input),

  delete: (id: string) => api.delete<void>(`/tasks/${id}`),

  getCodeContext: (taskId: string) =>
    api.get<CodeContextResponse>(`/tasks/${taskId}/code-context`),

  getAiContext: (taskId: string) =>
    api.get<import('./ai-types').AiContextResponse>(`/tasks/${taskId}/ai-context`),
};
