import { api } from './client';

/**
 * Epic Request status values
 */
export type EpicRequestStatus = 'pending' | 'approved' | 'rejected' | 'converted';

/**
 * Reaction type values
 */
export type ReactionType = 'like' | 'fire' | 'dislike';

/**
 * Structured description for Epic Requests
 */
export interface EpicRequestStructuredDesc {
  problemStatement: string;
  proposedSolution: string;
  impactAssessment: string;
  targetAudience?: string;
  successMetrics?: string;
  alternatives?: string;
  dependencies?: string;
  estimatedEffort?: string;
}

/**
 * Epic Request entity
 */
export interface EpicRequest {
  id: string;
  title: string;
  description?: string;
  structuredDesc?: EpicRequestStructuredDesc;
  status: EpicRequestStatus;
  requestedById: string;
  requestedBy?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Epic Request with aggregated reaction counts
 */
export interface EpicRequestWithReactionCounts extends EpicRequest {
  reactionCounts: {
    reactionType: string;
    count: number;
  }[];
  userReaction?: string | null;
}

/**
 * Comment entity
 */
export interface EpicRequestComment {
  id: string;
  content: string;
  epicRequestId: string;
  authorId: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Paginated response structure
 */
export interface PaginatedEpicRequestsResponse {
  data: EpicRequestWithReactionCounts[];
  meta: {
    cursor: string | null;
    hasMore: boolean;
  };
}

/**
 * Paginated comments response structure
 */
export interface PaginatedCommentsResponse {
  data: EpicRequestComment[];
  meta: {
    cursor: string | null;
    hasMore: boolean;
  };
}

/**
 * Filters for listing epic requests
 */
export interface EpicRequestFilters {
  cursor?: string;
  limit?: number;
  status?: EpicRequestStatus;
  requestedById?: string;
}

/**
 * Filters for listing comments
 */
export interface CommentFilters {
  cursor?: string;
  limit?: number;
}

/**
 * Input for creating a new epic request
 */
export interface CreateEpicRequestInput {
  title: string;
  description?: string;
  structuredDesc?: EpicRequestStructuredDesc;
}

/**
 * Input for updating an epic request
 */
export interface UpdateEpicRequestInput {
  title?: string;
  description?: string;
  structuredDesc?: EpicRequestStructuredDesc;
  status?: EpicRequestStatus;
}

/**
 * Input for adding a reaction
 */
export interface AddReactionInput {
  reactionType: ReactionType;
}

/**
 * Input for creating a comment
 */
export interface CreateCommentInput {
  content: string;
}

/**
 * Input for updating a comment
 */
export interface UpdateCommentInput {
  content: string;
}

/**
 * API client for Epic Requests
 */
export const epicRequestsApi = {
  /**
   * List epic requests with cursor-based pagination
   */
  list: (filters: EpicRequestFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });
    const queryString = params.toString();
    return api.get<PaginatedEpicRequestsResponse>(
      `/epic-requests${queryString ? `?${queryString}` : ''}`
    );
  },

  /**
   * Get a single epic request by ID
   */
  get: (id: string) =>
    api.get<{ data: EpicRequestWithReactionCounts }>(`/epic-requests/${id}`),

  /**
   * Create a new epic request
   */
  create: (input: CreateEpicRequestInput) =>
    api.post<{ data: EpicRequest }>('/epic-requests', input),

  /**
   * Update an existing epic request
   */
  update: (id: string, input: UpdateEpicRequestInput) =>
    api.put<{ data: EpicRequest }>(`/epic-requests/${id}`, input),

  /**
   * Delete an epic request
   */
  delete: (id: string) => api.delete(`/epic-requests/${id}`),

  /**
   * Approve an epic request (admin only)
   */
  approve: (id: string) =>
    api.post<{ data: EpicRequest }>(`/epic-requests/${id}/approve`, {}),

  /**
   * Reject an epic request (admin only)
   */
  reject: (id: string) =>
    api.post<{ data: EpicRequest }>(`/epic-requests/${id}/reject`, {}),

  /**
   * Add or update a reaction on an epic request
   */
  react: (id: string, input: AddReactionInput) =>
    api.post<{ message: string; data: { reactionType: string } }>(
      `/epic-requests/${id}/reactions`,
      input
    ),

  /**
   * Remove user's reaction from an epic request
   */
  removeReaction: (id: string) =>
    api.delete(`/epic-requests/${id}/reactions`),

  /**
   * List comments for an epic request
   */
  listComments: (id: string, filters: CommentFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });
    const queryString = params.toString();
    return api.get<PaginatedCommentsResponse>(
      `/epic-requests/${id}/comments${queryString ? `?${queryString}` : ''}`
    );
  },

  /**
   * Create a comment on an epic request
   */
  createComment: (id: string, input: CreateCommentInput) =>
    api.post<{ data: EpicRequestComment }>(
      `/epic-requests/${id}/comments`,
      input
    ),

  /**
   * Update a comment
   */
  updateComment: (
    epicRequestId: string,
    commentId: string,
    input: UpdateCommentInput
  ) =>
    api.put<{ data: EpicRequestComment }>(
      `/epic-requests/${epicRequestId}/comments/${commentId}`,
      input
    ),

  /**
   * Delete a comment
   */
  deleteComment: (epicRequestId: string, commentId: string) =>
    api.delete(`/epic-requests/${epicRequestId}/comments/${commentId}`),
};
