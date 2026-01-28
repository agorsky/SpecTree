import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  teamsApi,
  type CreateTeamInput,
  type UpdateTeamInput,
  type CreateStatusInput,
  type UpdateStatusInput,
} from '@/lib/api/teams';

export const teamKeys = {
  all: ['teams'] as const,
  lists: () => [...teamKeys.all, 'list'] as const,
  details: () => [...teamKeys.all, 'detail'] as const,
  detail: (id: string) => [...teamKeys.details(), id] as const,
  members: (id: string) => [...teamKeys.detail(id), 'members'] as const,
  statuses: (id: string) => [...teamKeys.detail(id), 'statuses'] as const,
};

export function useTeams() {
  return useQuery({
    queryKey: teamKeys.lists(),
    queryFn: () => teamsApi.list(),
  });
}

export function useTeam(id: string) {
  return useQuery({
    queryKey: teamKeys.detail(id),
    queryFn: () => teamsApi.get(id),
    enabled: !!id,
    select: (response) => response.data,
  });
}

export function useTeamMembers(teamId: string) {
  return useQuery({
    queryKey: teamKeys.members(teamId),
    queryFn: () => teamsApi.getMembers(teamId),
    enabled: !!teamId,
    select: (response) => response.data,
  });
}

export function useTeamStatuses(teamId: string) {
  return useQuery({
    queryKey: teamKeys.statuses(teamId),
    queryFn: () => teamsApi.getStatuses(teamId),
    enabled: !!teamId,
    select: (response) => response.data,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTeamInput) => teamsApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamKeys.lists() });
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTeamInput) => teamsApi.update(input),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: teamKeys.lists() });
      queryClient.setQueryData(teamKeys.detail(response.data.id), response);
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => teamsApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamKeys.lists() });
    },
  });
}

export function useAddTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      teamsApi.addMember(teamId, userId),
    onSuccess: (_, { teamId }) => {
      void queryClient.invalidateQueries({ queryKey: teamKeys.members(teamId) });
    },
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      teamsApi.removeMember(teamId, userId),
    onSuccess: (_, { teamId }) => {
      void queryClient.invalidateQueries({ queryKey: teamKeys.members(teamId) });
    },
  });
}

export function useCreateTeamStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, ...input }: CreateStatusInput & { teamId: string }) =>
      teamsApi.createStatus(teamId, input),
    onSuccess: (_, { teamId }) => {
      void queryClient.invalidateQueries({ queryKey: teamKeys.statuses(teamId) });
    },
  });
}

export function useUpdateTeamStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      teamId,
      statusId,
      ...input
    }: UpdateStatusInput & { teamId: string; statusId: string }) =>
      teamsApi.updateStatus(teamId, statusId, input),
    onSuccess: (_, { teamId }) => {
      void queryClient.invalidateQueries({ queryKey: teamKeys.statuses(teamId) });
    },
  });
}

export function useDeleteTeamStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, statusId }: { teamId: string; statusId: string }) =>
      teamsApi.deleteStatus(teamId, statusId),
    onSuccess: (_, { teamId }) => {
      void queryClient.invalidateQueries({ queryKey: teamKeys.statuses(teamId) });
    },
  });
}
