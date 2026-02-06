import { prisma } from "../lib/db.js";
import type { ExecutionPlan, TaskPhase, TaskPhaseItem } from "../types/execution-plan.js";

/**
 * Returns an execution plan for the given epic, including task phases, parallel groups, and dependencies.
 */
export async function getExecutionPlan(epicId: string): Promise<ExecutionPlan> {
  // Fetch features and tasks for the epic
  const features = await prisma.feature.findMany({
    where: { epicId },
    include: {
      tasks: true,
    },
    orderBy: [{ executionOrder: "asc" }, { sortOrder: "asc" }],
  });

  // Flatten all tasks with feature context
  const allTasks: TaskPhaseItem[] = [];
  for (const feature of features) {
    for (const task of feature.tasks) {
      allTasks.push({
        id: task.id,
        title: task.title,
        featureId: feature.id,
        featureTitle: feature.title,
        executionOrder: task.executionOrder ?? 0,
        canParallelize: task.canParallelize ?? false,
        parallelGroup: task.parallelGroup ?? null,
        dependencies: task.dependencies ? JSON.parse(task.dependencies) : [],
      });
    }
  }

  // Group tasks into phases based on executionOrder, parallelGroup, and dependencies
  // (Simple version: group by executionOrder, then by parallelGroup)
  const phases: TaskPhase[] = [];
  const grouped: { [key: string]: TaskPhaseItem[] } = {};
  for (const task of allTasks) {
    const key = `${task.executionOrder || 0}|${task.parallelGroup || "_"}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(task);
  }
  for (const key of Object.keys(grouped).sort()) {
    const items = grouped[key];
    if (!items) continue;
    phases.push({
      phaseKey: key,
      items,
    });
  }

  return { epicId, phases };
}
