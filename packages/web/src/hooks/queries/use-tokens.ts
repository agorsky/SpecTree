import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tokensApi } from '@/lib/api/tokens';
import type { CreateTokenInput } from '@/lib/api/tokens';

// =============================================================================
// Query Keys
// =============================================================================

export const tokenKeys = {
  all: ['tokens'] as const,
  lists: () => [...tokenKeys.all, 'list'] as const,
  list: () => [...tokenKeys.lists()] as const,
  details: () => [...tokenKeys.all, 'detail'] as const,
  detail: (id: string) => [...tokenKeys.details(), id] as const,
};

// =============================================================================
// Query Hooks
// =============================================================================

/**
 * Fetches the list of API tokens for the current user.
 * Returns metadata only - token values are never exposed.
 */
export function useTokens() {
  return useQuery({
    queryKey: tokenKeys.list(),
    queryFn: tokensApi.list,
  });
}

/**
 * Fetches a single API token by ID.
 */
export function useToken(id: string) {
  return useQuery({
    queryKey: tokenKeys.detail(id),
    queryFn: () => tokensApi.get(id),
    enabled: !!id,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Creates a new API token.
 * Returns the created token with plaintext value (only shown once).
 */
export function useCreateToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTokenInput) => tokensApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tokenKeys.lists() });
    },
  });
}

/**
 * Revokes (deletes) an API token.
 * The token is immediately invalidated.
 */
export function useRevokeToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tokensApi.revoke(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tokenKeys.lists() });
    },
  });
}
