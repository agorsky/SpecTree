import { api } from './client';

export type ActivityInterval = 'day' | 'week' | 'month';

export interface UserActivityDataPoint {
  intervalStart: string;
  intervalEnd: string;
  featuresCreated: number;
  tasksCompleted: number;
  decisionsLogged: number;
  aiSessions: number;
  totalActivity: number;
}

export interface UserActivityResponse {
  data: UserActivityDataPoint[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface UserActivityParams {
  interval?: ActivityInterval;
  page?: number;
  limit?: number;
}

export const userActivityApi = {
  get: (params: UserActivityParams = {}) => {
    const searchParams = new URLSearchParams();
    if (params.interval) searchParams.append('interval', params.interval);
    if (params.page) searchParams.append('page', String(params.page));
    if (params.limit) searchParams.append('limit', String(params.limit));
    const qs = searchParams.toString();
    return api.get<UserActivityResponse>(`/user-activity${qs ? `?${qs}` : ''}`);
  },
};
