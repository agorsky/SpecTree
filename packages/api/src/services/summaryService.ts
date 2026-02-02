/**
 * Summary Service
 *
 * Provides aggregated progress information for epics, users, and blocked items.
 * Designed to give AI sessions instant orientation at session start.
 */

import { prisma } from "../lib/db.js";
import { NotFoundError } from "../errors/index.js";
import type {
  ProgressSummary,
  BlockedItem,
  ActionableItem,
  RecentlyCompletedItem,
  LastSessionSummary,
  MyWorkResponse,
  MyWorkItem,
  BlockedSummaryResponse,
  BlockedSummaryItem,
} from "../schemas/summary.js";

/**
 * UUID v4 regex pattern for validation
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parse JSON string to array, returning empty array on failure
 */
function parseJsonArray<T>(json: string | null): T[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Get comprehensive progress summary for an epic.
 * Provides counts, metrics, actionable items, and session context.
 */
export async function getProgressSummary(epicIdOrName: string): Promise<ProgressSummary> {
  // Resolve epic by ID or name
  const isUuid = UUID_REGEX.test(epicIdOrName);
  const epic = await prisma.epic.findFirst({
    where: isUuid
      ? { id: epicIdOrName }
      : { name: epicIdOrName },
    include: {
      features: {
        include: {
          status: true,
          tasks: {
            include: {
              status: true,
            },
          },
        },
      },
    },
  });

  if (!epic) {
    throw new NotFoundError(`Epic '${epicIdOrName}' not found`);
  }

  // Calculate counts
  let completedFeatures = 0;
  let inProgressFeatures = 0;
  let blockedFeatures = 0;
  let totalTasks = 0;
  let completedTasks = 0;
  let inProgressTasks = 0;
  let blockedTasks = 0;

  const blockedItems: BlockedItem[] = [];
  const recentlyCompleted: RecentlyCompletedItem[] = [];

  for (const feature of epic.features) {
    // Feature status categorization
    const featureCategory = feature.status?.category;
    if (featureCategory === "completed") {
      completedFeatures++;
      if (feature.completedAt) {
        recentlyCompleted.push({
          id: feature.id,
          type: "feature",
          identifier: feature.identifier,
          title: feature.title,
          completedAt: feature.completedAt.toISOString(),
        });
      }
    } else if (featureCategory === "started") {
      inProgressFeatures++;
    }

    // Check if feature is blocked
    if (feature.blockerReason) {
      blockedFeatures++;
      blockedItems.push({
        id: feature.id,
        type: "feature",
        identifier: feature.identifier,
        title: feature.title,
        blockerReason: feature.blockerReason,
      });
    }

    // Process tasks
    for (const task of feature.tasks) {
      totalTasks++;
      const taskCategory = task.status?.category;
      
      if (taskCategory === "completed") {
        completedTasks++;
        if (task.completedAt) {
          recentlyCompleted.push({
            id: task.id,
            type: "task",
            identifier: task.identifier,
            title: task.title,
            completedAt: task.completedAt.toISOString(),
          });
        }
      } else if (taskCategory === "started") {
        inProgressTasks++;
      }

      // Check if task is blocked
      if (task.blockerReason) {
        blockedTasks++;
        blockedItems.push({
          id: task.id,
          type: "task",
          identifier: task.identifier,
          title: task.title,
          blockerReason: task.blockerReason,
        });
      }
    }
  }

  // Sort recently completed by date (most recent first), limit to 10
  recentlyCompleted.sort((a, b) => 
    new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );
  const recentlyCompletedLimited = recentlyCompleted.slice(0, 10);

  // Calculate overall progress
  const totalItems = epic.features.length + totalTasks;
  const completedItems = completedFeatures + completedTasks;
  const overallProgress = totalItems > 0 
    ? Math.round((completedItems / totalItems) * 100) 
    : 0;

  // Calculate estimated remaining
  const remainingFeatures = epic.features.length - completedFeatures;
  const remainingTasks = totalTasks - completedTasks;
  const estimatedRemaining = formatEstimatedRemaining(remainingFeatures, remainingTasks);

  // Get actionable items (not blocked, not completed, ordered by execution order)
  const nextActionable: ActionableItem[] = [];

  for (const feature of epic.features) {
    const featureCategory = feature.status?.category;
    // Skip completed features and blocked features
    if (featureCategory === "completed" || feature.blockerReason) continue;

    // Add feature if it's actionable (has no unresolved dependencies)
    const dependencies = parseJsonArray<string>(feature.dependencies);
    const hasUnresolvedDeps = await hasUnresolvedDependencies(dependencies, epic.features);
    
    if (!hasUnresolvedDeps) {
      nextActionable.push({
        id: feature.id,
        type: "feature",
        identifier: feature.identifier,
        title: feature.title,
        executionOrder: feature.executionOrder,
        complexity: feature.estimatedComplexity as ActionableItem["complexity"],
      });
    }

    // Check tasks within feature
    for (const task of feature.tasks) {
      const taskCategory = task.status?.category;
      if (taskCategory === "completed" || task.blockerReason) continue;

      const taskDeps = parseJsonArray<string>(task.dependencies);
      const taskHasUnresolvedDeps = await hasUnresolvedTaskDependencies(taskDeps, feature.tasks);
      
      if (!taskHasUnresolvedDeps) {
        nextActionable.push({
          id: task.id,
          type: "task",
          identifier: task.identifier,
          title: task.title,
          executionOrder: task.executionOrder,
          complexity: task.estimatedComplexity as ActionableItem["complexity"],
        });
      }
    }
  }

  // Sort actionable items by execution order (null last), limit to 10
  nextActionable.sort((a, b) => {
    if (a.executionOrder === null && b.executionOrder === null) return 0;
    if (a.executionOrder === null) return 1;
    if (b.executionOrder === null) return -1;
    return a.executionOrder - b.executionOrder;
  });
  const nextActionableLimited = nextActionable.slice(0, 10);

  // Get last session context
  const lastSessionData = await prisma.aiSession.findFirst({
    where: {
      epicId: epic.id,
      status: { in: ["completed", "abandoned"] },
    },
    orderBy: { endedAt: "desc" },
  });

  let lastSession: LastSessionSummary | null = null;
  if (lastSessionData?.endedAt && lastSessionData.summary) {
    lastSession = {
      endedAt: lastSessionData.endedAt.toISOString(),
      summary: lastSessionData.summary,
      nextSteps: parseJsonArray<string>(lastSessionData.nextSteps),
    };
  }

  return {
    epic: {
      id: epic.id,
      name: epic.name,
      description: epic.description,
    },
    totalFeatures: epic.features.length,
    completedFeatures,
    inProgressFeatures,
    blockedFeatures,
    totalTasks,
    completedTasks,
    inProgressTasks,
    blockedTasks,
    overallProgress,
    estimatedRemaining,
    blockedItems,
    nextActionable: nextActionableLimited,
    recentlyCompleted: recentlyCompletedLimited,
    lastSession,
  };
}

/**
 * Get work items assigned to a specific user.
 * Prioritized by status and execution order.
 */
export async function getMyWork(userId: string): Promise<MyWorkResponse> {
  // Get features assigned to user
  const features = await prisma.feature.findMany({
    where: {
      assigneeId: userId,
      status: {
        category: { notIn: ["completed", "canceled"] },
      },
    },
    include: {
      status: true,
      epic: {
        select: { id: true, name: true },
      },
    },
    orderBy: [
      { executionOrder: "asc" },
      { createdAt: "desc" },
    ],
  });

  // Get tasks assigned to user
  const tasks = await prisma.task.findMany({
    where: {
      assigneeId: userId,
      status: {
        category: { notIn: ["completed", "canceled"] },
      },
    },
    include: {
      status: true,
      feature: {
        select: {
          epic: {
            select: { id: true, name: true },
          },
        },
      },
    },
    orderBy: [
      { executionOrder: "asc" },
      { createdAt: "desc" },
    ],
  });

  const items: MyWorkItem[] = [];
  let inProgress = 0;
  let blocked = 0;

  // Add features
  for (const feature of features) {
    const statusCategory = feature.status?.category ?? null;
    if (statusCategory === "started") inProgress++;
    if (feature.blockerReason) blocked++;

    items.push({
      id: feature.id,
      type: "feature",
      identifier: feature.identifier,
      title: feature.title,
      epicId: feature.epic.id,
      epicName: feature.epic.name,
      status: feature.status?.name ?? null,
      statusCategory,
      executionOrder: feature.executionOrder,
      complexity: feature.estimatedComplexity as MyWorkItem["complexity"],
      percentComplete: feature.percentComplete,
    });
  }

  // Add tasks
  for (const task of tasks) {
    const statusCategory = task.status?.category ?? null;
    if (statusCategory === "started") inProgress++;
    if (task.blockerReason) blocked++;

    items.push({
      id: task.id,
      type: "task",
      identifier: task.identifier,
      title: task.title,
      epicId: task.feature.epic.id,
      epicName: task.feature.epic.name,
      status: task.status?.name ?? null,
      statusCategory,
      executionOrder: task.executionOrder,
      complexity: task.estimatedComplexity as MyWorkItem["complexity"],
      percentComplete: task.percentComplete,
    });
  }

  // Sort items: in-progress first, then by execution order
  items.sort((a, b) => {
    // In-progress items first
    const aInProgress = a.statusCategory === "started" ? 0 : 1;
    const bInProgress = b.statusCategory === "started" ? 0 : 1;
    if (aInProgress !== bInProgress) return aInProgress - bInProgress;

    // Then by execution order
    if (a.executionOrder === null && b.executionOrder === null) return 0;
    if (a.executionOrder === null) return 1;
    if (b.executionOrder === null) return -1;
    return a.executionOrder - b.executionOrder;
  });

  return {
    items,
    inProgress,
    blocked,
    total: items.length,
  };
}

/**
 * Get all blocked items across all epics.
 * Grouped by epic for easy navigation.
 */
export async function getBlockedSummary(userId?: string): Promise<BlockedSummaryResponse> {
  // Build scope filter for accessible epics
  let epicFilter: { teamId?: { in: string[] }; personalScopeId?: string } | undefined;
  
  // If userId provided, filter to accessible epics
  if (userId) {
    const memberships = await prisma.membership.findMany({
      where: { userId },
      select: { teamId: true },
    });
    const teamIds = memberships.map(m => m.teamId);
    
    const personalScope = await prisma.personalScope.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (teamIds.length > 0 || personalScope) {
      epicFilter = {};
      if (teamIds.length > 0) {
        epicFilter.teamId = { in: teamIds };
      }
      if (personalScope) {
        epicFilter.personalScopeId = personalScope.id;
      }
    }
  }

  // Get blocked features
  const blockedFeatures = await prisma.feature.findMany({
    where: {
      blockerReason: { not: null },
      ...(epicFilter ? { epic: epicFilter } : {}),
    },
    include: {
      status: true,
      epic: {
        select: { id: true, name: true },
      },
    },
  });

  // Get blocked tasks  
  const blockedTasks = await prisma.task.findMany({
    where: {
      blockerReason: { not: null },
      ...(epicFilter ? { feature: { epic: epicFilter } } : {}),
    },
    include: {
      status: true,
      feature: {
        select: {
          epic: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  const items: BlockedSummaryItem[] = [];
  const epicCounts = new Map<string, { id: string; name: string; count: number }>();

  // Process blocked features
  for (const feature of blockedFeatures) {
    if (!feature.blockerReason) continue;
    
    items.push({
      id: feature.id,
      type: "feature",
      identifier: feature.identifier,
      title: feature.title,
      epicId: feature.epic.id,
      epicName: feature.epic.name,
      blockerReason: feature.blockerReason,
      blockedSince: feature.updatedAt?.toISOString() ?? null,
    });

    // Count by epic
    const epicKey = feature.epic.id;
    const existing = epicCounts.get(epicKey);
    if (existing) {
      existing.count++;
    } else {
      epicCounts.set(epicKey, { id: feature.epic.id, name: feature.epic.name, count: 1 });
    }
  }

  // Process blocked tasks
  for (const task of blockedTasks) {
    if (!task.blockerReason) continue;
    
    items.push({
      id: task.id,
      type: "task",
      identifier: task.identifier,
      title: task.title,
      epicId: task.feature.epic.id,
      epicName: task.feature.epic.name,
      blockerReason: task.blockerReason,
      blockedSince: task.updatedAt?.toISOString() ?? null,
    });

    // Count by epic
    const epicKey = task.feature.epic.id;
    const existing = epicCounts.get(epicKey);
    if (existing) {
      existing.count++;
    } else {
      epicCounts.set(epicKey, { id: task.feature.epic.id, name: task.feature.epic.name, count: 1 });
    }
  }

  // Convert epic counts to array
  const byEpic = Array.from(epicCounts.values()).map(e => ({
    epicId: e.id,
    epicName: e.name,
    count: e.count,
  }));

  // Sort byEpic by count descending
  byEpic.sort((a, b) => b.count - a.count);

  return {
    items,
    totalBlocked: items.length,
    byEpic,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format the estimated remaining work string
 */
function formatEstimatedRemaining(features: number, tasks: number): string {
  const parts: string[] = [];
  if (features > 0) {
    parts.push(`${features} feature${features === 1 ? "" : "s"}`);
  }
  if (tasks > 0) {
    parts.push(`~${tasks} task${tasks === 1 ? "" : "s"}`);
  }
  return parts.length > 0 ? parts.join(", ") : "None";
}

/**
 * Check if any dependencies are unresolved (not completed)
 */
async function hasUnresolvedDependencies(
  dependencies: string[],
  features: Array<{ id: string; status: { category: string } | null }>
): Promise<boolean> {
  if (dependencies.length === 0) return false;

  for (const depId of dependencies) {
    const dep = features.find(f => f.id === depId);
    if (dep && dep.status?.category !== "completed") {
      return true;
    }
  }
  return false;
}

/**
 * Check if any task dependencies are unresolved
 */
async function hasUnresolvedTaskDependencies(
  dependencies: string[],
  tasks: Array<{ id: string; status: { category: string } | null }>
): Promise<boolean> {
  if (dependencies.length === 0) return false;

  for (const depId of dependencies) {
    const dep = tasks.find(t => t.id === depId);
    if (dep && dep.status?.category !== "completed") {
      return true;
    }
  }
  return false;
}
