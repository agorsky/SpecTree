import { useQuery } from '@tanstack/react-query';
import {
  userActivityApi,
  type ActivityInterval,
} from '@/lib/api/user-activity';

export const userActivityKeys = {
  all: ['user-activity'] as const,
  list: (interval: ActivityInterval, page: number) =>
    [...userActivityKeys.all, interval, page] as const,
};

export function useUserActivity(
  interval: ActivityInterval = 'week',
  page: number = 1,
  limit: number = 30
) {
  return useQuery({
    queryKey: userActivityKeys.list(interval, page),
    queryFn: () => userActivityApi.get({ interval, page, limit }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}
