/**
 * React Query Hook for Changelog
 * 
 * Provides hooks for fetching changelog data with automatic caching and revalidation.
 */

import { useQuery } from '@tanstack/react-query';
import { getFeatureChangelog, getTaskChangelog, type GetChangelogOptions } from '@/lib/api/changelog';

// ============================================================================
// Query Keys
// ============================================================================

export const changelogKeys = {
  all: ['changelog'] as const,
  feature: (featureId: string) => [...changelogKeys.all, 'feature', featureId] as const,
  task: (taskId: string) => [...changelogKeys.all, 'task', taskId] as const,
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch changelog for a feature
 * @param featureId - Feature ID or identifier (e.g., 'ENG-123')
 * @param options - Optional filters and pagination
 */
export function useFeatureChangelog(featureId: string, options: GetChangelogOptions = {}) {
  return useQuery({
    queryKey: [...changelogKeys.feature(featureId), options],
    queryFn: () => getFeatureChangelog(featureId, options),
    enabled: !!featureId,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch changelog for a task
 * @param taskId - Task ID or identifier (e.g., 'ENG-123-1')
 * @param options - Optional filters and pagination
 */
export function useTaskChangelog(taskId: string, options: GetChangelogOptions = {}) {
  return useQuery({
    queryKey: [...changelogKeys.task(taskId), options],
    queryFn: () => getTaskChangelog(taskId, options),
    enabled: !!taskId,
    staleTime: 30000, // 30 seconds
  });
}
