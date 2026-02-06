import { api } from './client';

export type Decision = {
  id: string;
  epicId: string;
  featureId: string | null;
  taskId: string | null;
  question: string;
  decision: string;
  rationale: string;
  alternatives: string[] | null;
  category: 'architecture' | 'library' | 'approach' | 'scope' | 'design' | 'tradeoff' | 'deferral';
  impact: 'low' | 'medium' | 'high';
  madeBy: string;
  createdAt: string;
};

export interface DecisionFilters {
  epicId?: string;
  featureId?: string;
  taskId?: string;
  category?: Decision['category'];
  impact?: Decision['impact'];
}

export interface GetDecisionsResponse {
  decisions: Decision[];
  count: number;
}

export async function getDecisions(filters: DecisionFilters = {}): Promise<GetDecisionsResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  });
  const queryString = params.toString();
  return api.get<GetDecisionsResponse>(`/decisions${queryString ? `?${queryString}` : ''}`);
}
