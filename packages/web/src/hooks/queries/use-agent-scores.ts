import { useQuery } from '@tanstack/react-query';
import { agentScoresApi } from '@/lib/api/agent-scores';

export const agentScoreKeys = {
  all: ['agent-scores'] as const,
  lists: () => [...agentScoreKeys.all, 'list'] as const,
  list: () => [...agentScoreKeys.lists()] as const,
  details: () => [...agentScoreKeys.all, 'detail'] as const,
  detail: (agentName: string) => [...agentScoreKeys.details(), agentName] as const,
};

export function useAgentScores() {
  return useQuery({
    queryKey: agentScoreKeys.list(),
    queryFn: () => agentScoresApi.list(),
    select: (response) => response.data,
  });
}

export function useAgentScore(agentName: string) {
  return useQuery({
    queryKey: agentScoreKeys.detail(agentName),
    queryFn: () => agentScoresApi.get(agentName),
    enabled: !!agentName,
    select: (response) => response.data,
  });
}
