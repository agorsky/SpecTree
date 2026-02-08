import { useQuery } from '@tanstack/react-query';
import { featuresApi } from '@/lib/api/features';
import { tasksApi } from '@/lib/api/tasks';
import type { CodeContextResponse } from '@/lib/api/types';

export const codeContextKeys = {
  feature: (id: string) => ['feature', id, 'code-context'] as const,
  task: (id: string) => ['task', id, 'code-context'] as const,
};

// API returns { codeContext: { files, functions, branch, commits, pr } }
// Component expects { relatedFiles, relatedFunctions, gitBranch, gitCommits, gitPrNumber, gitPrUrl }
function mapCodeContext(raw: Record<string, unknown>): CodeContextResponse {
  const ctx = (raw.codeContext ?? raw) as Record<string, unknown>;
  const pr = ctx.pr as { number: number; url: string } | null | undefined;
  return {
    relatedFiles: (ctx.files as string[]) ?? [],
    relatedFunctions: (ctx.functions as string[]) ?? [],
    gitBranch: (ctx.branch as string | null) ?? null,
    gitCommits: (ctx.commits as string[]) ?? [],
    gitPrNumber: pr?.number ?? null,
    gitPrUrl: pr?.url ?? null,
  };
}

export function useFeatureCodeContext(featureId: string) {
  return useQuery({
    queryKey: codeContextKeys.feature(featureId),
    queryFn: async () => {
      const response = await featuresApi.getCodeContext(featureId);
      return mapCodeContext(response.data as unknown as Record<string, unknown>);
    },
    enabled: !!featureId,
  });
}

export function useTaskCodeContext(taskId: string) {
  return useQuery({
    queryKey: codeContextKeys.task(taskId),
    queryFn: async () => {
      const response = await tasksApi.getCodeContext(taskId);
      return mapCodeContext(response.data as unknown as Record<string, unknown>);
    },
    enabled: !!taskId,
  });
}
