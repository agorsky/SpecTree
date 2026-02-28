import { useQuery } from '@tanstack/react-query';
import { sessionsApi, type Session } from '@/lib/api/sessions';

export const crewSessionKeys = {
  all: ['crew-sessions'] as const,
  byEpic: (epicId: string) => [...crewSessionKeys.all, epicId] as const,
};

/**
 * Polls active sessions for a given epic at a 4-second interval.
 */
export function useCrewSessions(epicId: string) {
  return useQuery({
    queryKey: crewSessionKeys.byEpic(epicId),
    queryFn: async () => {
      const response = await sessionsApi.listByEpic(epicId, { limit: 50 });
      return response.data;
    },
    enabled: !!epicId,
    refetchInterval: 4000,
  });
}

/**
 * Fetch all epics and their active sessions to show across all epics.
 */
export function useAllActiveSessions(epicIds: string[]) {
  return useQuery({
    queryKey: [...crewSessionKeys.all, 'active', epicIds],
    queryFn: async () => {
      const results = await Promise.all(
        epicIds.map(async (epicId) => {
          try {
            const response = await sessionsApi.getActive(epicId);
            if (response.data) {
              return response.data;
            }
            return null;
          } catch {
            return null;
          }
        })
      );
      return results.filter((s): s is Session => s !== null);
    },
    enabled: epicIds.length > 0,
    refetchInterval: 4000,
  });
}
