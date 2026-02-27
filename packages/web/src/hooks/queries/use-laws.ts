import { useQuery } from '@tanstack/react-query';
import { lawsApi } from '@/lib/api/laws';

export const lawKeys = {
  all: ['laws'] as const,
  lists: () => [...lawKeys.all, 'list'] as const,
  list: () => [...lawKeys.lists()] as const,
};

export function useLaws() {
  return useQuery({
    queryKey: lawKeys.list(),
    queryFn: () => lawsApi.list(),
    select: (response) => response.data,
  });
}
