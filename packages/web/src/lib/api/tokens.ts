import { api } from './client';

// =============================================================================
// Types
// =============================================================================

export interface ApiToken {
  id: string;
  name: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CreateTokenInput {
  name: string;
  scopes?: string[];
  expiresAt?: string;
}

export interface CreateTokenResponse {
  id: string;
  name: string;
  token: string; // Plaintext - only returned once at creation
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

// =============================================================================
// API Functions
// =============================================================================

export const tokensApi = {
  /**
   * List all API tokens for the current user.
   * Returns metadata only - token values are never exposed.
   */
  list: () =>
    api.get<{ data: ApiToken[] }>('/tokens').then((res) => res.data),

  /**
   * Create a new API token.
   * The plaintext token is only returned in this response - save it immediately!
   */
  create: (input: CreateTokenInput) =>
    api.post<{ data: CreateTokenResponse; message: string }>('/tokens', input).then((res) => res.data),

  /**
   * Get a single token by ID.
   * Returns metadata only - token value is never exposed.
   */
  get: (id: string) =>
    api.get<{ data: ApiToken }>(`/tokens/${id}`).then((res) => res.data),

  /**
   * Revoke (delete) an API token.
   * The token is immediately invalidated.
   */
  revoke: (id: string) =>
    api.delete<undefined>(`/tokens/${id}`),
};
