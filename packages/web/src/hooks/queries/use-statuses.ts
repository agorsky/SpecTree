import { useQuery } from '@tanstack/react-query';
import { statusesApi } from '@/lib/api/statuses';

export const statusKeys = {
  all: ['statuses'] as const,
  lists: () => [...statusKeys.all, 'list'] as const,
  list: (teamId?: string) => [...statusKeys.lists(), teamId] as const,
  details: () => [...statusKeys.all, 'detail'] as const,
  detail: (id: string) => [...statusKeys.details(), id] as const,
};

export function useStatuses(teamId?: string) {
  return useQuery({
    queryKey: statusKeys.list(teamId),
    queryFn: () => statusesApi.list(teamId),
    select: (response) => response.data,
  });
}

export function useStatus(id: string) {
  return useQuery({
    queryKey: statusKeys.detail(id),
    queryFn: () => statusesApi.get(id),
    enabled: !!id,
    select: (response) => response.data,
  });
}
