import { api } from './client';
import type { Status } from './types';

export const statusesApi = {
  list: (teamId?: string) => {
    const params = teamId ? `?teamId=${teamId}` : '';
    return api.get<{ data: Status[] }>(`/statuses${params}`);
  },

  get: (id: string) => api.get<{ data: Status }>(`/statuses/${id}`),
};
