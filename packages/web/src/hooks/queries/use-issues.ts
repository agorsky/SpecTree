import { useQuery } from "@tanstack/react-query";
import { featuresApi, type FeatureFilters } from "@/lib/api/features";
import { tasksApi, type TaskFilters } from "@/lib/api/tasks";
import type { Feature, Task } from "@/lib/api/types";

export type IssueItem =
  | { type: "feature"; data: Feature }
  | { type: "task"; data: Task };

export interface UseIssuesOptions {
  projectId: string;
  includesTasks?: boolean;
}

export const issueKeys = {
  all: ["issues"] as const,
  list: (projectId: string) => [...issueKeys.all, "list", projectId] as const,
};

export function useIssues({ projectId, includesTasks = true }: UseIssuesOptions) {
  return useQuery({
    queryKey: issueKeys.list(projectId),
    queryFn: async (): Promise<IssueItem[]> => {
      // Fetch features for the project
      const featureFilters: FeatureFilters = { projectId, limit: 100 };
      const featuresResponse = await featuresApi.list(featureFilters);
      const features = featuresResponse.data;

      // Convert features to issue items
      const featureItems: IssueItem[] = features.map((f) => ({
        type: "feature" as const,
        data: f,
      }));

      if (!includesTasks) {
        return featureItems;
      }

      // Fetch tasks for the project
      const taskFilters: TaskFilters = { projectId, limit: 100 };
      const tasksResponse = await tasksApi.list(taskFilters);
      const tasks = tasksResponse.data;

      // Convert tasks to issue items with explicit typing
      interface TaskIssueItem {
        type: "task";
        data: Task;
      }
      const taskItems: TaskIssueItem[] = tasks.map((t) => ({
        type: "task" as const,
        data: t,
      }));

      // Interleave: features first, then their tasks
      const result: IssueItem[] = [];
      const tasksByFeature = new Map<string, TaskIssueItem[]>();

      // Group tasks by feature
      for (const taskItem of taskItems) {
        const featureId = taskItem.data.featureId;
        const existing = tasksByFeature.get(featureId);
        if (existing) {
          existing.push(taskItem);
        } else {
          tasksByFeature.set(featureId, [taskItem]);
        }
      }

      // Build interleaved list: feature followed by its tasks
      for (const featureItem of featureItems) {
        result.push(featureItem);
        const featureTasks = tasksByFeature.get(featureItem.data.id);
        if (featureTasks) {
          result.push(...featureTasks);
        }
      }

      return result;
    },
    enabled: !!projectId,
  });
}
