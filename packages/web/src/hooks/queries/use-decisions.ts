import { useQuery } from '@tanstack/react-query';
import { getDecisions, type DecisionFilters, type GetDecisionsResponse } from '@/lib/api/decisions';

export const decisionKeys = {
  all: ['decisions'] as const,
  lists: () => [...decisionKeys.all, 'list'] as const,
  list: (filters: DecisionFilters) => [...decisionKeys.lists(), filters] as const,
};

export function useDecisions(filters: DecisionFilters = {}) {
  return useQuery<GetDecisionsResponse>({
    queryKey: decisionKeys.list(filters),
    queryFn: () => getDecisions(filters),
  });
}
