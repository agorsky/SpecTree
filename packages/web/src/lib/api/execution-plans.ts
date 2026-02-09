import { api } from './client';
import type { ExecutionPlan } from './types';

export const executionPlansApi = {
  get: (epicId: string) => 
    api.get<{ data: ExecutionPlan }>(`/execution-plans?epicId=${epicId}`),
};
