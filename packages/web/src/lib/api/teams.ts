import { api } from './client';
import type { Team, TeamMember, Status, PaginatedResponse } from './types';

export interface CreateTeamInput {
  name: string;
  key: string;
}

export interface UpdateTeamInput {
  id: string;
  name?: string;
}

export interface CreateStatusInput {
  name: string;
  category: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
  color: string;
  position?: number;
}

export interface UpdateStatusInput {
  name?: string;
  category?: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
  color?: string;
  position?: number;
}

export const teamsApi = {
  list: () => api.get<PaginatedResponse<Team>>('/teams'),

  get: (id: string) => api.get<{ data: Team }>(`/teams/${id}`),

  create: (input: CreateTeamInput) => api.post<{ data: Team }>('/teams', input),

  update: ({ id, ...input }: UpdateTeamInput) =>
    api.put<{ data: Team }>(`/teams/${id}`, input),

  delete: (id: string) => api.delete<undefined>(`/teams/${id}`),

  // Team members
  getMembers: (teamId: string) => api.get<{ data: TeamMember[] }>(`/teams/${teamId}/members`),

  addMember: (teamId: string, userId: string) =>
    api.post<undefined>(`/teams/${teamId}/members`, { userId }),

  removeMember: (teamId: string, userId: string) =>
    api.delete<undefined>(`/teams/${teamId}/members/${userId}`),

  // Team statuses
  getStatuses: (teamId: string) => api.get<{ data: Status[] }>(`/teams/${teamId}/statuses`),

  createStatus: (teamId: string, input: CreateStatusInput) =>
    api.post<{ data: Status }>(`/teams/${teamId}/statuses`, input),

  updateStatus: (teamId: string, statusId: string, input: UpdateStatusInput) =>
    api.put<{ data: Status }>(`/teams/${teamId}/statuses/${statusId}`, input),

  deleteStatus: (teamId: string, statusId: string) =>
    api.delete<undefined>(`/teams/${teamId}/statuses/${statusId}`),
};
