import { useQuery } from '@tanstack/react-query';
import { executionPlansApi } from '@/lib/api/execution-plans';

export const executionPlanKeys = {
  all: () => ['execution-plans'] as const,
  detail: (epicId: string) => [...executionPlanKeys.all(), epicId] as const,
};

export function useExecutionPlan(epicId: string) {
  return useQuery({
    queryKey: executionPlanKeys.detail(epicId),
    queryFn: () => executionPlansApi.get(epicId),
    enabled: !!epicId,
    select: (response) => response.data,
  });
}
