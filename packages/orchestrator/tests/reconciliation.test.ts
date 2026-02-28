/**
 * Unit tests for Session Reconciliation (ENG-71)
 */

import { describe, it, expect, vi } from "vitest";
import {
  reconcileSession,
  type ExpectedItemResult,
} from "../src/orchestrator/reconciliation.js";
import type { DispatcherClient } from "../src/spectree/api-client.js";

const DONE_STATUS_ID = "52e901cb-0e67-4136-8f03-ba62d7daa891";
const IN_PROGRESS_STATUS_ID = "ee4633f8-c846-4961-a6a0-9b2e116e09c4";

function createMockClient(features: any[], tasks: any[]): DispatcherClient {
  return {
    listFeatures: vi.fn().mockResolvedValue({
      data: features,
      meta: { cursor: null, hasMore: false },
    }),
    listTasks: vi.fn().mockResolvedValue({
      data: tasks,
      meta: { cursor: null, hasMore: false },
    }),
  } as unknown as DispatcherClient;
}

describe("reconcileSession", () => {
  it("should report clean when all expected items are Done", async () => {
    const client = createMockClient(
      [{ id: "f1", identifier: "ENG-1", statusId: DONE_STATUS_ID, status: { name: "Done" } }],
      [{ id: "t1", identifier: "ENG-1-1", statusId: DONE_STATUS_ID, status: { name: "Done" } }]
    );

    const expected: ExpectedItemResult[] = [
      { identifier: "ENG-1", success: true },
      { identifier: "ENG-1-1", success: true },
    ];

    const result = await reconcileSession(client, "epic-1", expected);

    expect(result.clean).toBe(true);
    expect(result.discrepancies).toHaveLength(0);
    expect(result.totalFeatures).toBe(1);
    expect(result.totalTasks).toBe(1);
  });

  it("should report discrepancy when feature expected Done but is not", async () => {
    const client = createMockClient(
      [{ id: "f1", identifier: "ENG-1", statusId: IN_PROGRESS_STATUS_ID, status: { name: "In Progress" } }],
      []
    );

    const expected: ExpectedItemResult[] = [
      { identifier: "ENG-1", success: true },
    ];

    const result = await reconcileSession(client, "epic-1", expected);

    expect(result.clean).toBe(false);
    expect(result.discrepancies).toHaveLength(1);
    expect(result.discrepancies[0]!.type).toBe("feature");
    expect(result.discrepancies[0]!.identifier).toBe("ENG-1");
    expect(result.discrepancies[0]!.expected).toBe("Done");
    expect(result.discrepancies[0]!.actual).toBe("In Progress");
  });

  it("should report discrepancy when task expected Done but is not", async () => {
    const client = createMockClient(
      [],
      [{ id: "t1", identifier: "ENG-1-1", statusId: IN_PROGRESS_STATUS_ID, status: { name: "In Progress" } }]
    );

    const expected: ExpectedItemResult[] = [
      { identifier: "ENG-1-1", success: true },
    ];

    const result = await reconcileSession(client, "epic-1", expected);

    expect(result.clean).toBe(false);
    expect(result.discrepancies).toHaveLength(1);
    expect(result.discrepancies[0]!.type).toBe("task");
  });

  it("should not report discrepancy for failed items that are not Done", async () => {
    const client = createMockClient(
      [{ id: "f1", identifier: "ENG-1", statusId: IN_PROGRESS_STATUS_ID, status: { name: "In Progress" } }],
      []
    );

    const expected: ExpectedItemResult[] = [
      { identifier: "ENG-1", success: false },
    ];

    const result = await reconcileSession(client, "epic-1", expected);

    expect(result.clean).toBe(true);
    expect(result.discrepancies).toHaveLength(0);
  });

  it("should not report discrepancy for items not in expected results", async () => {
    const client = createMockClient(
      [{ id: "f1", identifier: "ENG-1", statusId: IN_PROGRESS_STATUS_ID, status: { name: "In Progress" } }],
      []
    );

    const result = await reconcileSession(client, "epic-1", []);

    expect(result.clean).toBe(true);
    expect(result.discrepancies).toHaveLength(0);
  });
});
