import { useQuery } from '@tanstack/react-query';
import { casesApi, type CaseFilters } from '@/lib/api/cases';

export const caseKeys = {
  all: ['cases'] as const,
  lists: () => [...caseKeys.all, 'list'] as const,
  list: (filters: CaseFilters) => [...caseKeys.lists(), filters] as const,
  details: () => [...caseKeys.all, 'detail'] as const,
  detail: (id: string) => [...caseKeys.details(), id] as const,
};

export function useCases(filters: CaseFilters = {}) {
  return useQuery({
    queryKey: caseKeys.list(filters),
    queryFn: () => casesApi.list(filters),
    select: (response) => response.data,
  });
}

export function useCase(id: string) {
  return useQuery({
    queryKey: caseKeys.detail(id),
    queryFn: () => casesApi.get(id),
    enabled: !!id,
    select: (response) => response.data,
  });
}
