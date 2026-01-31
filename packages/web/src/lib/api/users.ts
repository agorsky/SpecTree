import { api } from './client';
import type { User } from './types';

interface UsersResponse {
  data: User[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  avatarUrl?: string;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  password?: string;
  avatarUrl?: string;
  isActive?: boolean;
}

export const usersApi = {
  list: (params?: { page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append('page', String(params.page));
    if (params?.limit !== undefined) queryParams.append('limit', String(params.limit));
    const queryString = queryParams.toString();
    return api.get<UsersResponse>(`/users${queryString ? `?${queryString}` : ''}`);
  },

  get: (id: string) => api.get<{ data: User }>(`/users/${id}`),

  me: () => api.get<{ data: User }>('/users/me'),

  create: (data: CreateUserInput) => api.post<{ data: User }>('/users', data),

  update: (id: string, data: UpdateUserInput) =>
    api.put<{ data: User }>(`/users/${id}`, data),

  delete: (id: string) => api.delete<{ success: boolean }>(`/users/${id}`),
};
