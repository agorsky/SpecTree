/**
 * Session Reconciliation (ENG-71)
 *
 * After an orchestrator session completes, compares expected vs actual status
 * of all features and tasks in the epic. Reports discrepancies so that
 * missed completions or stuck items are surfaced.
 */

import type { DispatcherClient, Feature, Task } from "../spectree/api-client.js";

// =============================================================================
// Types
// =============================================================================

export interface ReconciliationDiscrepancy {
  type: "feature" | "task";
  identifier: string;
  id: string;
  expected: string;
  actual: string;
  message: string;
}

export interface ReconciliationResult {
  totalFeatures: number;
  totalTasks: number;
  discrepancies: ReconciliationDiscrepancy[];
  clean: boolean;
}

export interface ExpectedItemResult {
  identifier: string;
  success: boolean;
}

// =============================================================================
// Reconciliation
// =============================================================================

const DONE_STATUS_ID = "52e901cb-0e67-4136-8f03-ba62d7daa891";

/**
 * Reconcile session results against the actual SpecTree state.
 *
 * Lists all features and tasks for the given epic, compares against
 * the expected results from the orchestrator run, and returns any
 * discrepancies.
 *
 * @param client - SpecTree API client
 * @param epicId - The epic UUID
 * @param expectedResults - Array of expected item outcomes from the orchestrator
 * @returns Reconciliation result with discrepancies
 */
export async function reconcileSession(
  client: DispatcherClient,
  epicId: string,
  expectedResults: ExpectedItemResult[]
): Promise<ReconciliationResult> {
  const discrepancies: ReconciliationDiscrepancy[] = [];

  // Build lookup of expected results
  const expectedMap = new Map<string, boolean>();
  for (const r of expectedResults) {
    expectedMap.set(r.identifier, r.success);
  }

  // Fetch all features for this epic
  const featuresResponse = await client.listFeatures({ epicId, limit: 100 });
  const features = featuresResponse.data;

  // Fetch all tasks for this epic
  const tasksResponse = await client.listTasks({ epicId, limit: 200 });
  const tasks = tasksResponse.data;

  // Check features
  for (const feature of features) {
    const expected = expectedMap.get(feature.identifier);
    if (expected === true && feature.statusId !== DONE_STATUS_ID) {
      discrepancies.push({
        type: "feature",
        identifier: feature.identifier,
        id: feature.id,
        expected: "Done",
        actual: feature.status?.name ?? feature.statusId ?? "unknown",
        message: `Feature ${feature.identifier} expected Done but is ${feature.status?.name ?? "not Done"}`,
      });
    }
  }

  // Check tasks
  for (const task of tasks) {
    const expected = expectedMap.get(task.identifier);
    if (expected === true && task.statusId !== DONE_STATUS_ID) {
      discrepancies.push({
        type: "task",
        identifier: task.identifier,
        id: task.id,
        expected: "Done",
        actual: task.status?.name ?? task.statusId ?? "unknown",
        message: `Task ${task.identifier} expected Done but is ${task.status?.name ?? "not Done"}`,
      });
    }
  }

  return {
    totalFeatures: features.length,
    totalTasks: tasks.length,
    discrepancies,
    clean: discrepancies.length === 0,
  };
}
