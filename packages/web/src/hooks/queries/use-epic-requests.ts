import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  epicRequestsApi,
  type EpicRequestFilters,
  type CreateEpicRequestInput,
  type CreatePersonalEpicRequestInput,
  type UpdateEpicRequestInput,
  type AddReactionInput,
  type CreateCommentInput,
  type UpdateCommentInput,
  type CommentFilters,
  type TransferEpicRequestInput,
} from '@/lib/api/epic-requests';

/**
 * Query key factory for Epic Requests
 */
export const epicRequestKeys = {
  all: ['epicRequests'] as const,
  lists: () => [...epicRequestKeys.all, 'list'] as const,
  list: (filters: EpicRequestFilters) => [...epicRequestKeys.lists(), filters] as const,
  personal: () => [...epicRequestKeys.all, 'personal'] as const,
  personalList: (filters: EpicRequestFilters) => [...epicRequestKeys.personal(), filters] as const,
  details: () => [...epicRequestKeys.all, 'detail'] as const,
  detail: (id: string) => [...epicRequestKeys.details(), id] as const,
  comments: (id: string) => [...epicRequestKeys.detail(id), 'comments'] as const,
  commentsList: (id: string, filters: CommentFilters) => 
    [...epicRequestKeys.comments(id), filters] as const,
};

/**
 * Hook for listing epic requests with infinite scroll
 */
export function useEpicRequests(filters: EpicRequestFilters = {}) {
  return useInfiniteQuery({
    queryKey: epicRequestKeys.list(filters),
    queryFn: ({ pageParam }) => {
      const queryFilters = { ...filters };
      if (pageParam) {
        queryFilters.cursor = pageParam;
      }
      return epicRequestsApi.list(queryFilters);
    },
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? lastPage.meta.cursor : undefined,
    initialPageParam: undefined as string | undefined,
  });
}

/**
 * Hook for fetching a single epic request
 */
export function useEpicRequest(id: string) {
  return useQuery({
    queryKey: epicRequestKeys.detail(id),
    queryFn: () => epicRequestsApi.get(id),
    enabled: !!id,
    select: (response) => response.data,
  });
}

/**
 * Hook for creating a new epic request
 */
export function useCreateEpicRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateEpicRequestInput) => epicRequestsApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: epicRequestKeys.lists() });
    },
  });
}

/**
 * Hook for updating an epic request
 */
export function useUpdateEpicRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateEpicRequestInput }) =>
      epicRequestsApi.update(id, input),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: epicRequestKeys.lists() });
      queryClient.setQueryData(epicRequestKeys.detail(response.data.id), response);
    },
  });
}

/**
 * Hook for deleting an epic request
 */
export function useDeleteEpicRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => epicRequestsApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: epicRequestKeys.lists() });
    },
  });
}

/**
 * Hook for approving an epic request (admin only)
 */
export function useApproveEpicRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => epicRequestsApi.approve(id),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: epicRequestKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: epicRequestKeys.detail(response.data.id) });
    },
  });
}

/**
 * Hook for rejecting an epic request (admin only)
 */
export function useRejectEpicRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => epicRequestsApi.reject(id),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: epicRequestKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: epicRequestKeys.detail(response.data.id) });
    },
  });
}

/**
 * Hook for reacting to an epic request
 */
export function useReactToEpicRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AddReactionInput }) =>
      epicRequestsApi.react(id, input),
    onSuccess: (_data, variables) => {
      // Invalidate lists to update reaction counts
      void queryClient.invalidateQueries({ queryKey: epicRequestKeys.lists() });
      // Invalidate the specific detail to update reaction counts
      void queryClient.invalidateQueries({ queryKey: epicRequestKeys.detail(variables.id) });
    },
  });
}

/**
 * Hook for removing a reaction from an epic request
 */
export function useRemoveReactionFromEpicRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => epicRequestsApi.removeReaction(id),
    onSuccess: (_data, id) => {
      // Invalidate lists to update reaction counts
      void queryClient.invalidateQueries({ queryKey: epicRequestKeys.lists() });
      // Invalidate the specific detail to update reaction counts
      void queryClient.invalidateQueries({ queryKey: epicRequestKeys.detail(id) });
    },
  });
}

/**
 * Hook for listing comments on an epic request
 */
export function useEpicRequestComments(id: string, filters: CommentFilters = {}) {
  return useInfiniteQuery({
    queryKey: epicRequestKeys.commentsList(id, filters),
    queryFn: ({ pageParam }) => {
      const queryFilters = { ...filters };
      if (pageParam) {
        queryFilters.cursor = pageParam;
      }
      return epicRequestsApi.listComments(id, queryFilters);
    },
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? lastPage.meta.cursor : undefined,
    initialPageParam: undefined as string | undefined,
    enabled: !!id,
  });
}

/**
 * Hook for creating a comment on an epic request
 */
export function useCreateEpicRequestComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateCommentInput }) =>
      epicRequestsApi.createComment(id, input),
    onSuccess: (_data, variables) => {
      // Invalidate comments list for this request
      void queryClient.invalidateQueries({ queryKey: epicRequestKeys.comments(variables.id) });
    },
  });
}

/**
 * Hook for updating a comment
 */
export function useUpdateEpicRequestComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      epicRequestId,
      commentId,
      input,
    }: {
      epicRequestId: string;
      commentId: string;
      input: UpdateCommentInput;
    }) => epicRequestsApi.updateComment(epicRequestId, commentId, input),
    onSuccess: (_data, variables) => {
      // Invalidate comments list for this request
      void queryClient.invalidateQueries({
        queryKey: epicRequestKeys.comments(variables.epicRequestId),
      });
    },
  });
}

/**
 * Hook for deleting a comment
 */
export function useDeleteEpicRequestComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      epicRequestId,
      commentId,
    }: {
      epicRequestId: string;
      commentId: string;
    }) => epicRequestsApi.deleteComment(epicRequestId, commentId),
    onSuccess: (_data, variables) => {
      // Invalidate comments list for this request
      void queryClient.invalidateQueries({
        queryKey: epicRequestKeys.comments(variables.epicRequestId),
      });
    },
  });
}

/**
 * Hook for creating a personal epic request (auto-approved)
 */
export function useCreatePersonalEpicRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePersonalEpicRequestInput) =>
      epicRequestsApi.createPersonal(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: epicRequestKeys.all });
    },
  });
}

/**
 * Hook for listing personal epic requests with infinite scroll
 */
export function usePersonalEpicRequests(filters: EpicRequestFilters = {}) {
  return useInfiniteQuery({
    queryKey: epicRequestKeys.personalList(filters),
    queryFn: ({ pageParam }) => {
      const queryFilters = { ...filters };
      if (pageParam) {
        queryFilters.cursor = pageParam;
      }
      return epicRequestsApi.listPersonal(queryFilters);
    },
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? lastPage.meta.cursor : undefined,
    initialPageParam: undefined as string | undefined,
  });
}

/**
 * Hook for transferring an epic request between personal and team scope
 */
export function useTransferEpicRequestScope() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TransferEpicRequestInput }) =>
      epicRequestsApi.transfer(id, input),
    onSuccess: (_data, variables) => {
      // Invalidate all lists (request may move between personal and team)
      void queryClient.invalidateQueries({ queryKey: epicRequestKeys.all });
      // Invalidate the specific detail
      void queryClient.invalidateQueries({ queryKey: epicRequestKeys.detail(variables.id) });
    },
  });
}
