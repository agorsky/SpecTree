import { api } from './client';
import type { ActivityInterval, ActivityScope } from './user-activity';

export interface ActivityDetailParams {
  metricType: 'features' | 'tasks' | 'decisions' | 'sessions';
  interval: ActivityInterval;
  page: number;
  scope: ActivityScope;
  scopeId?: string;
  timeZone: string;
  limit?: number;
  cursor?: string;
}

export interface FeatureDetail {
  id: string;
  identifier: string;
  title: string;
  epicName: string;
  statusName: string;
  statusColor?: string;
  assigneeName?: string;
  createdAt: string;
}

export interface TaskDetail {
  id: string;
  identifier: string;
  title: string;
  featureIdentifier: string;
  featureTitle: string;
  statusName: string;
  completedAt: string;
}

export interface DecisionDetail {
  id: string;
  question: string;
  decision: string;
  rationale?: string;
  category: string;
  impact: string;
  madeBy: string;
  epicName: string;
  featureIdentifier?: string;
  createdAt: string;
}

export interface SessionDetail {
  id: string;
  epicId: string;
  epicName: string;
  startedAt: string;
  endedAt?: string;
  status: string;
  summary?: string;
}

export type ActivityDetailItem =
  | FeatureDetail
  | TaskDetail
  | DecisionDetail
  | SessionDetail;

export interface ActivityDetailsResponse {
  data: ActivityDetailItem[];
  meta: {
    cursor?: string;
    hasMore: boolean;
  };
}

export function getActivityDetails(
  params: ActivityDetailParams
): Promise<ActivityDetailsResponse> {
  const searchParams = new URLSearchParams();
  searchParams.append('metricType', params.metricType);
  searchParams.append('interval', params.interval);
  searchParams.append('page', String(params.page));
  searchParams.append('timeZone', params.timeZone);
  searchParams.append('scope', params.scope);
  if (params.scopeId) searchParams.append('scopeId', params.scopeId);
  if (params.limit) searchParams.append('limit', String(params.limit));
  if (params.cursor) searchParams.append('cursor', params.cursor);

  const qs = searchParams.toString();
  return api.get<ActivityDetailsResponse>(
    `/user-activity/details${qs ? `?${qs}` : ''}`
  );
}
