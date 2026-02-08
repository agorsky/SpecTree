/**
 * Changelog API Client
 * 
 * Provides types and API client functions for retrieving entity change history.
 */

import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export interface ChangeLogEntry {
  id: string;
  entityType: 'epic' | 'feature' | 'task';
  entityId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  changedAt: string;
  epicId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeLogResponse {
  data: ChangeLogEntry[];
  meta: {
    cursor: string | null;
    hasMore: boolean;
  };
}

export interface GetChangelogOptions {
  cursor?: string;
  limit?: number;
  field?: string;
  changedBy?: string;
}

// ============================================================================
// API Client Functions
// ============================================================================

/**
 * Get changelog for a feature
 * @param featureId - Feature ID or identifier (e.g., 'ENG-123')
 * @param options - Optional filters and pagination
 */
export async function getFeatureChangelog(
  featureId: string,
  options: GetChangelogOptions = {}
): Promise<ChangeLogResponse> {
  const params = new URLSearchParams();
  
  if (options.cursor) params.append('cursor', options.cursor);
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.field) params.append('field', options.field);
  if (options.changedBy) params.append('changedBy', options.changedBy);
  
  const queryString = params.toString();
  const url = `/features/${featureId}/changelog${queryString ? `?${queryString}` : ''}`;
  
  const response = await api.get<ChangeLogResponse>(url);
  return response;
}

/**
 * Get changelog for a task
 * @param taskId - Task ID or identifier (e.g., 'ENG-123-1')
 * @param options - Optional filters and pagination
 */
export async function getTaskChangelog(
  taskId: string,
  options: GetChangelogOptions = {}
): Promise<ChangeLogResponse> {
  const params = new URLSearchParams();
  
  if (options.cursor) params.append('cursor', options.cursor);
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.field) params.append('field', options.field);
  if (options.changedBy) params.append('changedBy', options.changedBy);
  
  const queryString = params.toString();
  const url = `/tasks/${taskId}/changelog${queryString ? `?${queryString}` : ''}`;
  
  const response = await api.get<ChangeLogResponse>(url);
  return response;
}
