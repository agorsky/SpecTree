import { api } from './client';
import { type GetDecisionsResponse } from './decisions';

export async function searchDecisions(query: string, epicId?: string): Promise<GetDecisionsResponse> {
  const params = new URLSearchParams();
  params.append('query', query);
  if (epicId) params.append('epicId', epicId);
  const queryString = params.toString();
  return api.get<GetDecisionsResponse>(`/decisions/search${queryString ? `?${queryString}` : ''}`);
}
