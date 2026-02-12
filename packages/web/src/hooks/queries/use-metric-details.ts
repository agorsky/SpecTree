import { useInfiniteQuery } from '@tanstack/react-query';
import { getActivityDetails, type ActivityDetailParams } from '@/lib/api/user-activity-details';
import type { ActivityInterval, ActivityScope } from '@/lib/api/user-activity';

/**
 * Query key factory for metric details.
 * Follows project convention: [domain, 'list', ...filters]
 */
export const metricDetailKeys = {
  all: ['metric-details'] as const,
  lists: () => [...metricDetailKeys.all, 'list'] as const,
  list: (
    metricType: string,
    interval: ActivityInterval,
    page: number,
    scope: ActivityScope,
    timeZone: string,
    scopeId?: string
  ) =>
    [
      ...metricDetailKeys.lists(),
      metricType,
      interval,
      page,
      scope,
      timeZone,
      scopeId,
    ] as const,
};

/**
 * Parameters for useMetricDetails hook
 */
export interface UseMetricDetailsParams {
  /** Type of metric: features, tasks, decisions, or sessions */
  metricType: 'features' | 'tasks' | 'decisions' | 'sessions';
  
  /** Time interval for bucketing */
  interval: ActivityInterval;
  
  /** Page number for time buckets */
  page: number;
  
  /** Scope of data to retrieve */
  scope: ActivityScope;
  
  /** Optional scope ID for 'team' or 'user' scope */
  scopeId?: string;
  
  /** Time zone for date bucketing */
  timeZone: string;
  
  /** Whether to fetch data (false = lazy load, true = fetch immediately) */
  enabled: boolean;
  
  /** Number of items per page */
  limit?: number;
}

/**
 * Hook for fetching metric drill-down details with infinite scroll.
 * 
 * Features:
 * - Lazy loading: Only fetches when enabled=true (after card click)
 * - Cursor-based pagination via useInfiniteQuery
 * - Scope filtering: maps dashboard scope to API params
 * - Follows project query key conventions
 * 
 * @example
 * ```tsx
 * const { data, fetchNextPage, hasNextPage, isFetching } = useMetricDetails({
 *   metricType: 'features',
 *   interval: 'week',
 *   page: 0,
 *   scope: 'self',
 *   timeZone: 'America/New_York',
 *   enabled: isDialogOpen, // Lazy load on dialog open
 * });
 * ```
 */
export function useMetricDetails(params: UseMetricDetailsParams) {
  const {
    metricType,
    interval,
    page,
    scope,
    scopeId,
    timeZone,
    enabled,
    limit = 20,
  } = params;

  return useInfiniteQuery({
    queryKey: metricDetailKeys.list(
      metricType,
      interval,
      page,
      scope,
      timeZone,
      scopeId
    ),
    queryFn: ({ pageParam }) => {
      const apiParams: ActivityDetailParams = {
        metricType,
        interval,
        page,
        scope,
        timeZone,
        limit,
      };
      
      // Add scopeId if provided (required for 'team' and 'user' scopes)
      if (scopeId !== undefined) {
        apiParams.scopeId = scopeId;
      }
      
      // Add cursor for pagination
      if (pageParam !== undefined) {
        apiParams.cursor = pageParam;
      }
      
      return getActivityDetails(apiParams);
    },
    
    // Extract next cursor from response
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? lastPage.meta.cursor : undefined,
    
    // Start with no cursor
    initialPageParam: undefined as string | undefined,
    
    // Lazy load: only fetch when explicitly enabled (e.g., dialog opened)
    enabled,
    
    // Cache for 30 seconds (matches dashboard activity cache)
    staleTime: 30_000,
    
    // Don't refetch on window focus since this is drill-down data
    refetchOnWindowFocus: false,
  });
}
