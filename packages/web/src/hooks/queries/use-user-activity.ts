import { useQuery } from '@tanstack/react-query';
import {
  userActivityApi,
  resolveTimeZone,
  type ActivityInterval,
  type ActivityScope,
} from '@/lib/api/user-activity';
import { useCurrentUser } from '@/hooks/queries/use-current-user';

export const userActivityKeys = {
  all: ['user-activity'] as const,
  list: (
    interval: ActivityInterval,
    page: number,
    timeZone: string,
    scope?: ActivityScope,
    scopeId?: string
  ) =>
    [...userActivityKeys.all, interval, page, timeZone, scope, scopeId] as const,
};

export function useUserActivity(
  interval: ActivityInterval = 'week',
  page: number = 1,
  limit: number = 30,
  scope?: ActivityScope,
  scopeId?: string
) {
  const { data: currentUser } = useCurrentUser();
  const userTimeZone = currentUser?.data.timeZone;
  const timeZone = resolveTimeZone(userTimeZone);

  return useQuery({
    queryKey: userActivityKeys.list(interval, page, timeZone, scope, scopeId),
    queryFn: () => {
      const params: { interval: ActivityInterval; page: number; limit: number; timeZone: string; scope?: ActivityScope; scopeId?: string } = {
        interval,
        page,
        limit,
        timeZone,
      };
      if (scope !== undefined) params.scope = scope;
      if (scopeId !== undefined) params.scopeId = scopeId;
      return userActivityApi.get(params);
    },
    enabled: !((scope === 'team' || scope === 'user') && !scopeId),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}
