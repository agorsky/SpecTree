import { useQuery } from '@tanstack/react-query';
import {
  userActivityApi,
  resolveTimeZone,
  type ActivityInterval,
} from '@/lib/api/user-activity';
import { useAuthStore } from '@/stores/auth-store';

export const userActivityKeys = {
  all: ['user-activity'] as const,
  list: (interval: ActivityInterval, page: number, timeZone: string) =>
    [...userActivityKeys.all, interval, page, timeZone] as const,
};

export function useUserActivity(
  interval: ActivityInterval = 'week',
  page: number = 1,
  limit: number = 30
) {
  const userTimeZone = useAuthStore((s) => s.user?.timeZone);
  const timeZone = resolveTimeZone(userTimeZone);

  return useQuery({
    queryKey: userActivityKeys.list(interval, page, timeZone),
    queryFn: () => userActivityApi.get({ interval, page, limit, timeZone }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}
