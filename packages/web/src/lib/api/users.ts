import { api } from './client';
import type { User } from './types';

interface UsersResponse {
  data: User[];
  total: number;
  page: number;
  limit: number;
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
};
