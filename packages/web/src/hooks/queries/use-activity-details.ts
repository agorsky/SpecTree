import { useQuery } from '@tanstack/react-query';
import {
  getActivityDetails,
  type ActivityDetailParams,
} from '@/lib/api/user-activity-details';
import type { ActivityInterval, ActivityScope } from '@/lib/api/user-activity';

export const activityDetailKeys = {
  all: ['activity-details'] as const,
  detail: (
    metricType: string,
    interval: ActivityInterval,
    page: number,
    scope: ActivityScope,
    timeZone: string,
    scopeId?: string
  ) =>
    [
      ...activityDetailKeys.all,
      metricType,
      interval,
      page,
      scope,
      timeZone,
      scopeId,
    ] as const,
};

export interface UseActivityDetailsParams {
  metricType: 'features' | 'tasks' | 'decisions' | 'sessions';
  interval: ActivityInterval;
  page: number;
  scope: ActivityScope;
  scopeId?: string;
  timeZone: string;
  enabled: boolean;
  limit?: number;
  cursor?: string;
}

export function useActivityDetails(params: UseActivityDetailsParams) {
  const {
    metricType,
    interval,
    page,
    scope,
    scopeId,
    timeZone,
    enabled,
    limit,
    cursor,
  } = params;

  return useQuery({
    queryKey: activityDetailKeys.detail(
      metricType,
      interval,
      page,
      scope,
      timeZone,
      scopeId
    ),
    queryFn: () => {
      const apiParams: ActivityDetailParams = {
        metricType,
        interval,
        page,
        scope,
        timeZone,
      };
      if (scopeId !== undefined) apiParams.scopeId = scopeId;
      if (limit !== undefined) apiParams.limit = limit;
      if (cursor !== undefined) apiParams.cursor = cursor;
      return getActivityDetails(apiParams);
    },
    enabled,
    staleTime: 30_000, // 30 seconds, matches dashboard
    refetchOnWindowFocus: false, // user explicitly opened the drill-down
  });
}
