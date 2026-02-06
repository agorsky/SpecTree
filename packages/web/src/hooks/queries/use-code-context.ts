import { useQuery } from '@tanstack/react-query';
import { featuresApi } from '@/lib/api/features';
import { tasksApi } from '@/lib/api/tasks';

export const codeContextKeys = {
  feature: (id: string) => ['feature', id, 'code-context'] as const,
  task: (id: string) => ['task', id, 'code-context'] as const,
};

export function useFeatureCodeContext(featureId: string) {
  return useQuery({
    queryKey: codeContextKeys.feature(featureId),
    queryFn: () => featuresApi.getCodeContext(featureId),
    enabled: !!featureId,
  });
}

export function useTaskCodeContext(taskId: string) {
  return useQuery({
    queryKey: codeContextKeys.task(taskId),
    queryFn: () => tasksApi.getCodeContext(taskId),
    enabled: !!taskId,
  });
}
