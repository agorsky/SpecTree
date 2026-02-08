import { useQuery } from '@tanstack/react-query';
import { featuresApi } from '@/lib/api/features';
import { tasksApi } from '@/lib/api/tasks';

export const aiContextKeys = {
  feature: (id: string) => ['feature', id, 'ai-context'] as const,
  task: (id: string) => ['task', id, 'ai-context'] as const,
};

export function useFeatureAiContext(featureId: string) {
  return useQuery({
    queryKey: aiContextKeys.feature(featureId),
    queryFn: async () => {
      const response = await featuresApi.getAiContext(featureId);
      return response.data;
    },
    enabled: !!featureId,
  });
}

export function useTaskAiContext(taskId: string) {
  return useQuery({
    queryKey: aiContextKeys.task(taskId),
    queryFn: async () => {
      const response = await tasksApi.getAiContext(taskId);
      return response.data;
    },
    enabled: !!taskId,
  });
}
