import { api } from "./client";

export interface AgentScore {
  id: string;
  agentName: string;
  agentTitle: string;
  totalScore: number;
  bustsReceived: number;
  bustsIssued: number;
  cleanCycles: number;
  falseBusts?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentScoresResponse {
  data: AgentScore[];
}

export interface AgentScoreResponse {
  data: AgentScore;
}

export const agentScoresApi = {
  list: () => api.get<AgentScoresResponse>("/agent-scores"),

  get: (agentName: string) =>
    api.get<AgentScoreResponse>(`/agent-scores/${encodeURIComponent(agentName)}`),
};
