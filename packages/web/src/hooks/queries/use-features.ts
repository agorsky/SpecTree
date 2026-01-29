import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  featuresApi,
  type FeatureFilters,
  type CreateFeatureInput,
  type UpdateFeatureInput,
} from '@/lib/api/features';

export const featureKeys = {
  all: ['features'] as const,
  lists: () => [...featureKeys.all, 'list'] as const,
  list: (filters: FeatureFilters) => [...featureKeys.lists(), filters] as const,
  details: () => [...featureKeys.all, 'detail'] as const,
  detail: (id: string) => [...featureKeys.details(), id] as const,
};

export function useFeatures(filters: FeatureFilters = {}) {
  return useInfiniteQuery({
    queryKey: featureKeys.list(filters),
    queryFn: ({ pageParam }) =>
      featuresApi.list({ ...filters, cursor: pageParam }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    initialPageParam: undefined as string | undefined,
  });
}

export function useFeature(id: string) {
  return useQuery({
    queryKey: featureKeys.detail(id),
    queryFn: () => featuresApi.get(id),
    enabled: !!id,
    select: (response) => response.data,
  });
}

export function useCreateFeature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateFeatureInput) => featuresApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: featureKeys.lists() });
    },
  });
}

export function useUpdateFeature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateFeatureInput) => featuresApi.update(input),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: featureKeys.lists() });
      queryClient.setQueryData(featureKeys.detail(response.data.id), response);
    },
  });
}

export function useDeleteFeature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => featuresApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: featureKeys.lists() });
    },
  });
}
