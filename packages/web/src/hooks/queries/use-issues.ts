import { useQuery } from "@tanstack/react-query";
import { featuresApi, type FeatureFilters } from "@/lib/api/features";
import { tasksApi, type TaskFilters } from "@/lib/api/tasks";
import type { Feature, Task } from "@/lib/api/types";

export type IssueItem =
  | { type: "feature"; data: Feature }
  | { type: "task"; data: Task };

export interface UseIssuesOptions {
  epicId: string;
  includesTasks?: boolean;
}

export const issueKeys = {
  all: ["issues"] as const,
  list: (epicId: string) => [...issueKeys.all, "list", epicId] as const,
};

export function useIssues({ epicId, includesTasks = true }: UseIssuesOptions) {
  return useQuery({
    queryKey: issueKeys.list(epicId),
    queryFn: async (): Promise<IssueItem[]> => {
      // Fetch features for the epic
      const featureFilters: FeatureFilters = { epicId, limit: 100 };
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

      // Fetch tasks for the epic
      const taskFilters: TaskFilters = { epicId, limit: 100 };
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
    enabled: !!epicId,
  });
}
