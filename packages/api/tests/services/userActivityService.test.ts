import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the db module before any imports that use it
vi.mock("../../src/lib/db.js", () => ({
  prisma: {
    membership: {
      findMany: vi.fn(),
    },
    personalScope: {
      findFirst: vi.fn(),
    },
    epic: {
      findMany: vi.fn(),
    },
    feature: {
      findMany: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
    },
    decision: {
      findMany: vi.fn(),
    },
    aiSession: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "../../src/lib/db.js";
import {
  getUserActivity,
  type UserActivityQuery,
} from "../../src/services/userActivityService.js";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Create a Date for the given UTC year/month/day at the given UTC hour.
 * Updated to use UTC to match the service's UTC-based date calculations.
 */
function localDate(
  year: number,
  month: number, // 0-indexed (0 = January)
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0
): Date {
  return new Date(Date.UTC(year, month, day, hour, minute, second, ms));
}

/**
 * Midnight (00:00:00.000) UTC time for a given date.
 */
function localMidnight(year: number, month: number, day: number): Date {
  return localDate(year, month, day, 0, 0, 0, 0);
}

/** Build a standard query object with sensible defaults. */
function buildQuery(overrides?: Partial<UserActivityQuery>): UserActivityQuery {
  return {
    userId: "user-1",
    interval: "day",
    page: 1,
    limit: 7,
    scope: "self",
    ...overrides,
  };
}

/**
 * Configure the mock Prisma client so that the "access check" part of
 * getUserActivity succeeds (finds one team membership, one epic).
 */
function setupAccessMocks(opts?: {
  teamIds?: string[];
  epicIds?: string[];
  personalScopeId?: string | null;
}): string[] {
  const teamIds = opts?.teamIds ?? ["team-1"];
  const epicIds = opts?.epicIds ?? ["epic-1"];
  const personalScopeId = opts?.personalScopeId ?? null;

  vi.mocked(prisma.membership.findMany).mockResolvedValue(
    teamIds.map((teamId) => ({ teamId })) as any
  );

  if (personalScopeId) {
    vi.mocked(prisma.personalScope.findFirst).mockResolvedValue({
      id: personalScopeId,
    } as any);
  } else {
    vi.mocked(prisma.personalScope.findFirst).mockResolvedValue(null);
  }

  vi.mocked(prisma.epic.findMany).mockResolvedValue(
    epicIds.map((id) => ({ id })) as any
  );

  return epicIds;
}

/**
 * Configure all four "record" queries to return empty arrays.
 */
function setupEmptyRecords(): void {
  vi.mocked(prisma.feature.findMany).mockResolvedValue([]);
  vi.mocked(prisma.task.findMany).mockResolvedValue([]);
  vi.mocked(prisma.decision.findMany).mockResolvedValue([]);
  vi.mocked(prisma.aiSession.findMany).mockResolvedValue([]);
}

// =============================================================================
// Tests
// =============================================================================

describe("userActivityService", () => {
  // The frozen time is 2026-01-14 at noon LOCAL time.
  // The service uses local-time Date methods (setHours, getDay, etc.) so
  // we must reason about buckets in local time throughout.
  const FROZEN_TIME = localDate(2026, 0, 14, 12, 0, 0, 0);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // 1. Response shape & basic contract
  // ===========================================================================

  describe("response shape", () => {
    it("should return the correct structure with data, page, limit, total, hasMore", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      const result = await getUserActivity(buildQuery());

      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("page");
      expect(result).toHaveProperty("limit");
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("hasMore");
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("should return the correct page and limit in the response", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      const result = await getUserActivity(buildQuery({ page: 2, limit: 5 }));

      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
    });

    it("should return data points with all required fields", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      const result = await getUserActivity(buildQuery({ limit: 1 }));

      expect(result.data).toHaveLength(1);
      const dp = result.data[0];
      expect(dp).toHaveProperty("intervalStart");
      expect(dp).toHaveProperty("intervalEnd");
      expect(dp).toHaveProperty("featuresCreated");
      expect(dp).toHaveProperty("tasksCompleted");
      expect(dp).toHaveProperty("decisionsLogged");
      expect(dp).toHaveProperty("aiSessions");
      expect(dp).toHaveProperty("totalActivity");
    });
  });

  // ===========================================================================
  // 2. Access / Scope resolution
  // ===========================================================================

  describe("access resolution", () => {
    it("should query memberships for the given userId", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      await getUserActivity(buildQuery({ userId: "user-42" }));

      expect(prisma.membership.findMany).toHaveBeenCalledWith({
        where: { userId: "user-42" },
        select: { teamId: true },
      });
    });

    it("should query personal scope for the given userId", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      await getUserActivity(buildQuery({ userId: "user-42" }));

      expect(prisma.personalScope.findFirst).toHaveBeenCalledWith({
        where: { userId: "user-42" },
        select: { id: true },
      });
    });

    it("should include personalScopeId in epic lookup when present", async () => {
      setupAccessMocks({ personalScopeId: "ps-1" });
      setupEmptyRecords();

      await getUserActivity(buildQuery());

      expect(prisma.epic.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ teamId: { in: ["team-1"] } }, { personalScopeId: "ps-1" }],
        },
        select: { id: true },
      });
    });

    it("should not include personalScopeId in OR when no personal scope exists", async () => {
      setupAccessMocks({ personalScopeId: null });
      setupEmptyRecords();

      await getUserActivity(buildQuery());

      expect(prisma.epic.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ teamId: { in: ["team-1"] } }],
        },
        select: { id: true },
      });
    });

    it("should return empty data when user has no team memberships and no personal scope", async () => {
      vi.mocked(prisma.membership.findMany).mockResolvedValue([]);
      vi.mocked(prisma.personalScope.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.epic.findMany).mockResolvedValue([]);

      const result = await getUserActivity(buildQuery());

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it("should return empty data when no epics match the user's teams", async () => {
      vi.mocked(prisma.membership.findMany).mockResolvedValue([
        { teamId: "team-1" },
      ] as any);
      vi.mocked(prisma.personalScope.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.epic.findMany).mockResolvedValue([]);

      const result = await getUserActivity(buildQuery());

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ===========================================================================
  // 3. Date bucketing -- "day" interval
  // ===========================================================================

  describe("day interval bucketing", () => {
    // Frozen local time: 2026-01-14 12:00:00
    // getIntervalStart for "day" => 2026-01-14 00:00:00 local

    it("should produce the correct number of buckets (limit)", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      const result = await getUserActivity(
        buildQuery({ interval: "day", limit: 5, page: 1 })
      );

      expect(result.data).toHaveLength(5);
    });

    it("should have the current day as the first bucket", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      const result = await getUserActivity(
        buildQuery({ interval: "day", limit: 3, page: 1 })
      );

      // First bucket start should be today at midnight local
      const first = result.data[0];
      const start = new Date(first.intervalStart);
      expect(start.getUTCFullYear()).toBe(2026);
      expect(start.getUTCMonth()).toBe(0); // January
      expect(start.getUTCDate()).toBe(14);
      expect(start.getUTCHours()).toBe(0);
      expect(start.getUTCMinutes()).toBe(0);
    });

    it("should have each bucket span exactly one day", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      const result = await getUserActivity(
        buildQuery({ interval: "day", limit: 5, page: 1 })
      );

      for (const dp of result.data) {
        const start = new Date(dp.intervalStart);
        const end = new Date(dp.intervalEnd);
        const diffMs = end.getTime() - start.getTime();
        expect(diffMs).toBe(24 * 60 * 60 * 1000);
      }
    });

    it("should go backwards in time (most recent first)", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      const result = await getUserActivity(
        buildQuery({ interval: "day", limit: 3, page: 1 })
      );

      const starts = result.data.map(
        (d) => new Date(d.intervalStart).getTime()
      );
      for (let i = 1; i < starts.length; i++) {
        expect(starts[i]).toBeLessThan(starts[i - 1]);
      }
    });
  });

  // ===========================================================================
  // 4. Date bucketing -- "week" interval
  // ===========================================================================

  describe("week interval bucketing", () => {
    // Frozen local time: 2026-01-14 (Wednesday)
    // getIntervalStart for "week" => Sunday of current week = Jan 11

    it("should start the first bucket on Sunday of the current week", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      const result = await getUserActivity(
        buildQuery({ interval: "week", limit: 1, page: 1 })
      );

      const start = new Date(result.data[0].intervalStart);
      expect(start.getUTCDay()).toBe(0); // Sunday
      expect(start.getUTCDate()).toBe(11);
    });

    it("should have each bucket span exactly 7 days", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      const result = await getUserActivity(
        buildQuery({ interval: "week", limit: 4, page: 1 })
      );

      for (const dp of result.data) {
        const start = new Date(dp.intervalStart);
        const end = new Date(dp.intervalEnd);
        const diffMs = end.getTime() - start.getTime();
        expect(diffMs).toBe(7 * 24 * 60 * 60 * 1000);
      }
    });
  });

  // ===========================================================================
  // 5. Date bucketing -- "month" interval
  // ===========================================================================

  describe("month interval bucketing", () => {
    // Frozen local time: 2026-01-14
    // getIntervalStart for "month" => 2026-01-01 00:00 local

    it("should start the first bucket on the 1st of the current month", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      const result = await getUserActivity(
        buildQuery({ interval: "month", limit: 1, page: 1 })
      );

      const start = new Date(result.data[0].intervalStart);
      expect(start.getUTCDate()).toBe(1);
      expect(start.getUTCMonth()).toBe(0); // January
    });

    it("should produce month-length buckets that move backwards", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      const result = await getUserActivity(
        buildQuery({ interval: "month", limit: 3, page: 1 })
      );

      // First bucket: Jan 2026
      const first = result.data[0];
      expect(new Date(first.intervalStart).getUTCMonth()).toBe(0);
      expect(new Date(first.intervalEnd).getUTCMonth()).toBe(1); // Feb 1

      // Second bucket: Dec 2025
      const second = result.data[1];
      expect(new Date(second.intervalStart).getUTCMonth()).toBe(11);
      expect(new Date(second.intervalStart).getUTCFullYear()).toBe(2025);

      // Third bucket: Nov 2025
      const third = result.data[2];
      expect(new Date(third.intervalStart).getUTCMonth()).toBe(10);
      expect(new Date(third.intervalStart).getUTCFullYear()).toBe(2025);
    });
  });

  // ===========================================================================
  // 6. Aggregation -- counts land in correct buckets
  // ===========================================================================

  describe("aggregation", () => {
    // Frozen local time: 2026-01-14 12:00:00
    // With "day" interval and limit 3 we get buckets (all local time):
    //   bucket 0: Jan 14 00:00 -> Jan 15 00:00  (today)
    //   bucket 1: Jan 13 00:00 -> Jan 14 00:00  (yesterday)
    //   bucket 2: Jan 12 00:00 -> Jan 13 00:00  (two days ago)

    it("should count features created in the correct day bucket", async () => {
      setupAccessMocks();

      // Feature created on Jan 14 at 10:00 local -> falls in bucket 0 (today)
      vi.mocked(prisma.feature.findMany).mockResolvedValue([
        { createdAt: localDate(2026, 0, 14, 10, 0, 0) },
      ] as any);
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      vi.mocked(prisma.decision.findMany).mockResolvedValue([]);
      vi.mocked(prisma.aiSession.findMany).mockResolvedValue([]);

      const result = await getUserActivity(
        buildQuery({ interval: "day", limit: 3, page: 1 })
      );

      expect(result.data[0].featuresCreated).toBe(1);
      expect(result.data[1].featuresCreated).toBe(0);
      expect(result.data[2].featuresCreated).toBe(0);
    });

    it("should count tasks completed in the correct day bucket", async () => {
      setupAccessMocks();

      // Task completed on Jan 13 at 15:00 local -> falls in bucket 1 (yesterday)
      vi.mocked(prisma.feature.findMany).mockResolvedValue([]);
      vi.mocked(prisma.task.findMany).mockResolvedValue([
        { completedAt: localDate(2026, 0, 13, 15, 0, 0) },
      ] as any);
      vi.mocked(prisma.decision.findMany).mockResolvedValue([]);
      vi.mocked(prisma.aiSession.findMany).mockResolvedValue([]);

      const result = await getUserActivity(
        buildQuery({ interval: "day", limit: 3, page: 1 })
      );

      expect(result.data[0].tasksCompleted).toBe(0);
      expect(result.data[1].tasksCompleted).toBe(1);
      expect(result.data[2].tasksCompleted).toBe(0);
    });

    it("should count decisions logged in the correct day bucket", async () => {
      setupAccessMocks();

      vi.mocked(prisma.feature.findMany).mockResolvedValue([]);
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      // Decision on Jan 12 at 10:00 local -> bucket 2
      vi.mocked(prisma.decision.findMany).mockResolvedValue([
        { createdAt: localDate(2026, 0, 12, 10, 0, 0) },
      ] as any);
      vi.mocked(prisma.aiSession.findMany).mockResolvedValue([]);

      const result = await getUserActivity(
        buildQuery({ interval: "day", limit: 3, page: 1 })
      );

      expect(result.data[0].decisionsLogged).toBe(0);
      expect(result.data[1].decisionsLogged).toBe(0);
      expect(result.data[2].decisionsLogged).toBe(1);
    });

    it("should count AI sessions in the correct day bucket", async () => {
      setupAccessMocks();

      vi.mocked(prisma.feature.findMany).mockResolvedValue([]);
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      vi.mocked(prisma.decision.findMany).mockResolvedValue([]);
      // AI session on Jan 14 at 09:00 local -> bucket 0
      vi.mocked(prisma.aiSession.findMany).mockResolvedValue([
        { startedAt: localDate(2026, 0, 14, 9, 0, 0) },
      ] as any);

      const result = await getUserActivity(
        buildQuery({ interval: "day", limit: 3, page: 1 })
      );

      expect(result.data[0].aiSessions).toBe(1);
      expect(result.data[1].aiSessions).toBe(0);
      expect(result.data[2].aiSessions).toBe(0);
    });

    it("should compute totalActivity as the sum of all four counts", async () => {
      setupAccessMocks();

      // All four types on the same local day (Jan 14)
      vi.mocked(prisma.feature.findMany).mockResolvedValue([
        { createdAt: localDate(2026, 0, 14, 2, 0, 0) },
        { createdAt: localDate(2026, 0, 14, 3, 0, 0) },
      ] as any);
      vi.mocked(prisma.task.findMany).mockResolvedValue([
        { completedAt: localDate(2026, 0, 14, 4, 0, 0) },
      ] as any);
      vi.mocked(prisma.decision.findMany).mockResolvedValue([
        { createdAt: localDate(2026, 0, 14, 5, 0, 0) },
        { createdAt: localDate(2026, 0, 14, 6, 0, 0) },
        { createdAt: localDate(2026, 0, 14, 7, 0, 0) },
      ] as any);
      vi.mocked(prisma.aiSession.findMany).mockResolvedValue([
        { startedAt: localDate(2026, 0, 14, 8, 0, 0) },
      ] as any);

      const result = await getUserActivity(
        buildQuery({ interval: "day", limit: 1, page: 1 })
      );

      const dp = result.data[0];
      expect(dp.featuresCreated).toBe(2);
      expect(dp.tasksCompleted).toBe(1);
      expect(dp.decisionsLogged).toBe(3);
      expect(dp.aiSessions).toBe(1);
      expect(dp.totalActivity).toBe(2 + 1 + 3 + 1);
    });

    it("should distribute multiple records across different buckets correctly", async () => {
      setupAccessMocks();

      vi.mocked(prisma.feature.findMany).mockResolvedValue([
        { createdAt: localDate(2026, 0, 14, 10, 0, 0) }, // bucket 0 (today)
        { createdAt: localDate(2026, 0, 13, 10, 0, 0) }, // bucket 1 (yesterday)
        { createdAt: localDate(2026, 0, 12, 10, 0, 0) }, // bucket 2
      ] as any);
      vi.mocked(prisma.task.findMany).mockResolvedValue([
        { completedAt: localDate(2026, 0, 14, 11, 0, 0) }, // bucket 0
        { completedAt: localDate(2026, 0, 14, 14, 0, 0) }, // bucket 0
      ] as any);
      vi.mocked(prisma.decision.findMany).mockResolvedValue([]);
      vi.mocked(prisma.aiSession.findMany).mockResolvedValue([]);

      const result = await getUserActivity(
        buildQuery({ interval: "day", limit: 3, page: 1 })
      );

      // Bucket 0 (Jan 14): 1 feature, 2 tasks
      expect(result.data[0].featuresCreated).toBe(1);
      expect(result.data[0].tasksCompleted).toBe(2);
      expect(result.data[0].totalActivity).toBe(3);

      // Bucket 1 (Jan 13): 1 feature
      expect(result.data[1].featuresCreated).toBe(1);
      expect(result.data[1].tasksCompleted).toBe(0);
      expect(result.data[1].totalActivity).toBe(1);

      // Bucket 2 (Jan 12): 1 feature
      expect(result.data[2].featuresCreated).toBe(1);
      expect(result.data[2].totalActivity).toBe(1);
    });

    it("should work with week interval aggregation", async () => {
      setupAccessMocks();

      // Current week (Sun Jan 11 - Sat Jan 17): record on Jan 14 (Wednesday)
      // Previous week (Sun Jan 4 - Sat Jan 10): record on Jan 8 (Thursday)
      vi.mocked(prisma.feature.findMany).mockResolvedValue([
        { createdAt: localDate(2026, 0, 14, 10, 0, 0) }, // current week
        { createdAt: localDate(2026, 0, 8, 10, 0, 0) }, // previous week
      ] as any);
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      vi.mocked(prisma.decision.findMany).mockResolvedValue([]);
      vi.mocked(prisma.aiSession.findMany).mockResolvedValue([]);

      const result = await getUserActivity(
        buildQuery({ interval: "week", limit: 2, page: 1 })
      );

      expect(result.data[0].featuresCreated).toBe(1); // current week
      expect(result.data[1].featuresCreated).toBe(1); // previous week
    });

    it("should work with month interval aggregation", async () => {
      setupAccessMocks();

      // Current month (Jan 2026): record on Jan 14
      // Previous month (Dec 2025): record on Dec 20
      vi.mocked(prisma.feature.findMany).mockResolvedValue([
        { createdAt: localDate(2026, 0, 14, 10, 0, 0) }, // Jan 2026
        { createdAt: localDate(2025, 11, 20, 10, 0, 0) }, // Dec 2025
      ] as any);
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      vi.mocked(prisma.decision.findMany).mockResolvedValue([]);
      vi.mocked(prisma.aiSession.findMany).mockResolvedValue([]);

      const result = await getUserActivity(
        buildQuery({ interval: "month", limit: 2, page: 1 })
      );

      expect(result.data[0].featuresCreated).toBe(1); // Jan
      expect(result.data[1].featuresCreated).toBe(1); // Dec
    });
  });

  // ===========================================================================
  // 7. Empty data
  // ===========================================================================

  describe("empty data", () => {
    it("should return all-zero data points when there are no records", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      const result = await getUserActivity(
        buildQuery({ interval: "day", limit: 3 })
      );

      expect(result.data).toHaveLength(3);
      for (const dp of result.data) {
        expect(dp.featuresCreated).toBe(0);
        expect(dp.tasksCompleted).toBe(0);
        expect(dp.decisionsLogged).toBe(0);
        expect(dp.aiSessions).toBe(0);
        expect(dp.totalActivity).toBe(0);
      }
    });

    it("should still produce valid ISO date strings for empty buckets", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      const result = await getUserActivity(buildQuery({ limit: 2 }));

      for (const dp of result.data) {
        expect(() => new Date(dp.intervalStart)).not.toThrow();
        expect(() => new Date(dp.intervalEnd)).not.toThrow();
        expect(new Date(dp.intervalStart).toISOString()).toBe(dp.intervalStart);
        expect(new Date(dp.intervalEnd).toISOString()).toBe(dp.intervalEnd);
      }
    });
  });

  // ===========================================================================
  // 8. Pagination
  // ===========================================================================

  describe("pagination", () => {
    it("should offset buckets when page > 1", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      const page1 = await getUserActivity(
        buildQuery({ interval: "day", page: 1, limit: 3 })
      );
      const page2 = await getUserActivity(
        buildQuery({ interval: "day", page: 2, limit: 3 })
      );

      // Page 2's first bucket should start right before page 1's last bucket
      const page1LastStart = new Date(page1.data[2].intervalStart);
      const page2FirstStart = new Date(page2.data[0].intervalStart);

      const oneDayMs = 24 * 60 * 60 * 1000;
      expect(page1LastStart.getTime() - page2FirstStart.getTime()).toBe(
        oneDayMs
      );
    });

    it("should not overlap buckets between pages", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      const page1 = await getUserActivity(
        buildQuery({ interval: "day", page: 1, limit: 2 })
      );
      const page2 = await getUserActivity(
        buildQuery({ interval: "day", page: 2, limit: 2 })
      );

      const page1Earliest = new Date(
        page1.data[page1.data.length - 1].intervalStart
      );
      const page2Latest = new Date(page2.data[0].intervalEnd);

      expect(page1Earliest.getTime()).toBeGreaterThanOrEqual(
        page2Latest.getTime()
      );
    });

    it("should report hasMore=true when more pages are available (day)", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      // total for day = 365, page=1 limit=7 => 1*7=7 < 365 => hasMore true
      const result = await getUserActivity(
        buildQuery({ interval: "day", page: 1, limit: 7 })
      );

      expect(result.hasMore).toBe(true);
    });

    it("should report hasMore=false when on the last page (day)", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      // total for day = 365, page=365 limit=1 => 365 >= 365 => false
      const result = await getUserActivity(
        buildQuery({ interval: "day", page: 365, limit: 1 })
      );

      expect(result.hasMore).toBe(false);
    });

    it("should report correct total for each interval type", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      const dayResult = await getUserActivity(buildQuery({ interval: "day" }));
      expect(dayResult.total).toBe(365);

      const weekResult = await getUserActivity(
        buildQuery({ interval: "week" })
      );
      expect(weekResult.total).toBe(52);

      const monthResult = await getUserActivity(
        buildQuery({ interval: "month" })
      );
      expect(monthResult.total).toBe(12);
    });

    it("should handle hasMore for week interval correctly", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      // total for week = 52, page=1 limit=10 => 10 < 52 => true
      const result = await getUserActivity(
        buildQuery({ interval: "week", page: 1, limit: 10 })
      );
      expect(result.hasMore).toBe(true);

      // page=6 limit=10 => 60 >= 52 => false
      const result2 = await getUserActivity(
        buildQuery({ interval: "week", page: 6, limit: 10 })
      );
      expect(result2.hasMore).toBe(false);
    });

    it("should handle hasMore for month interval correctly", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      // total for month = 12, page=1 limit=6 => 6 < 12 => true
      const result = await getUserActivity(
        buildQuery({ interval: "month", page: 1, limit: 6 })
      );
      expect(result.hasMore).toBe(true);

      // page=2 limit=6 => 12 >= 12 => false
      const result2 = await getUserActivity(
        buildQuery({ interval: "month", page: 2, limit: 6 })
      );
      expect(result2.hasMore).toBe(false);
    });
  });

  // ===========================================================================
  // 9. Edge cases -- boundary records
  // ===========================================================================

  describe("bucket boundary edge cases", () => {
    // Frozen local time: 2026-01-14 12:00:00
    // Day bucket 0: Jan 14 00:00:00 local (inclusive) to Jan 15 00:00:00 local (exclusive)
    // Day bucket 1: Jan 13 00:00:00 local (inclusive) to Jan 14 00:00:00 local (exclusive)

    it("should include a record exactly at the bucket start (inclusive)", async () => {
      setupAccessMocks();

      // Exactly midnight local on Jan 14 -> bucket 0
      vi.mocked(prisma.feature.findMany).mockResolvedValue([
        { createdAt: localMidnight(2026, 0, 14) },
      ] as any);
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      vi.mocked(prisma.decision.findMany).mockResolvedValue([]);
      vi.mocked(prisma.aiSession.findMany).mockResolvedValue([]);

      const result = await getUserActivity(
        buildQuery({ interval: "day", limit: 2, page: 1 })
      );

      expect(result.data[0].featuresCreated).toBe(1);
      expect(result.data[1].featuresCreated).toBe(0);
    });

    it("should exclude a record exactly at the bucket end (exclusive upper bound)", async () => {
      setupAccessMocks();

      // Midnight local on Jan 15 is the END of bucket 0 (exclusive)
      // It belongs to Jan 15's bucket, not Jan 14's bucket
      vi.mocked(prisma.feature.findMany).mockResolvedValue([
        { createdAt: localMidnight(2026, 0, 15) },
      ] as any);
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      vi.mocked(prisma.decision.findMany).mockResolvedValue([]);
      vi.mocked(prisma.aiSession.findMany).mockResolvedValue([]);

      const result = await getUserActivity(
        buildQuery({ interval: "day", limit: 2, page: 1 })
      );

      // Neither bucket 0 (Jan 14) nor bucket 1 (Jan 13) should contain it
      expect(result.data[0].featuresCreated).toBe(0);
      expect(result.data[1].featuresCreated).toBe(0);
    });

    it("should put a record at 23:59:59.999 local in the correct bucket", async () => {
      setupAccessMocks();

      // 23:59:59.999 local on Jan 13 -> bucket 1 (Jan 13 00:00 -> Jan 14 00:00)
      vi.mocked(prisma.feature.findMany).mockResolvedValue([
        { createdAt: localDate(2026, 0, 13, 23, 59, 59, 999) },
      ] as any);
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      vi.mocked(prisma.decision.findMany).mockResolvedValue([]);
      vi.mocked(prisma.aiSession.findMany).mockResolvedValue([]);

      const result = await getUserActivity(
        buildQuery({ interval: "day", limit: 2, page: 1 })
      );

      expect(result.data[0].featuresCreated).toBe(0); // bucket 0 = Jan 14
      expect(result.data[1].featuresCreated).toBe(1); // bucket 1 = Jan 13
    });

    it("should handle records with null date fields gracefully", async () => {
      setupAccessMocks();

      // Tasks with null completedAt should not be counted
      vi.mocked(prisma.feature.findMany).mockResolvedValue([]);
      vi.mocked(prisma.task.findMany).mockResolvedValue([
        { completedAt: null },
      ] as any);
      vi.mocked(prisma.decision.findMany).mockResolvedValue([]);
      vi.mocked(prisma.aiSession.findMany).mockResolvedValue([]);

      const result = await getUserActivity(
        buildQuery({ interval: "day", limit: 1, page: 1 })
      );

      expect(result.data[0].tasksCompleted).toBe(0);
    });

    it("should handle ISO date strings (as opposed to Date objects) in records", async () => {
      setupAccessMocks();

      // The countInRange function handles both Date objects and strings
      const dateInBucket0 = localDate(2026, 0, 14, 10, 0, 0);
      vi.mocked(prisma.feature.findMany).mockResolvedValue([
        { createdAt: dateInBucket0.toISOString() },
      ] as any);
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      vi.mocked(prisma.decision.findMany).mockResolvedValue([]);
      vi.mocked(prisma.aiSession.findMany).mockResolvedValue([]);

      const result = await getUserActivity(
        buildQuery({ interval: "day", limit: 1, page: 1 })
      );

      expect(result.data[0].featuresCreated).toBe(1);
    });

    it("should not double-count a record at the boundary between two buckets", async () => {
      setupAccessMocks();

      // Midnight on Jan 14 local is the start of bucket 0 AND the end of bucket 1
      // It should only appear in bucket 0 (>= start, < end)
      vi.mocked(prisma.feature.findMany).mockResolvedValue([
        { createdAt: localMidnight(2026, 0, 14) },
      ] as any);
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      vi.mocked(prisma.decision.findMany).mockResolvedValue([]);
      vi.mocked(prisma.aiSession.findMany).mockResolvedValue([]);

      const result = await getUserActivity(
        buildQuery({ interval: "day", limit: 3, page: 1 })
      );

      // Total across all buckets should be exactly 1
      const total = result.data.reduce(
        (sum, dp) => sum + dp.featuresCreated,
        0
      );
      expect(total).toBe(1);
      expect(result.data[0].featuresCreated).toBe(1); // bucket 0 = Jan 14
      expect(result.data[1].featuresCreated).toBe(0); // bucket 1 = Jan 13
      expect(result.data[2].featuresCreated).toBe(0); // bucket 2 = Jan 12
    });
  });

  // ===========================================================================
  // 10. Query construction -- verify correct Prisma calls
  // ===========================================================================

  describe("Prisma query construction", () => {
    it("should query features by epicId, date range, and createdBy for 'self' scope", async () => {
      setupAccessMocks({ epicIds: ["epic-1", "epic-2"] });
      setupEmptyRecords();

      await getUserActivity(
        buildQuery({ userId: "user-1", interval: "day", limit: 2, page: 1, scope: "self" })
      );

      expect(prisma.feature.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            epicId: { in: ["epic-1", "epic-2"] },
            createdAt: {
              gte: expect.any(Date),
              lt: expect.any(Date),
            },
            createdBy: "user-1",
          }),
          select: { createdAt: true, createdBy: true },
        })
      );
    });

    it("should query tasks by feature.epicId, completedAt range, and attribution fallback for 'self' scope", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      await getUserActivity(buildQuery({ userId: "user-1", scope: "self" }));

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            feature: { epicId: { in: ["epic-1"] } },
            completedAt: {
              gte: expect.any(Date),
              lt: expect.any(Date),
            },
            OR: [
              { implementedBy: "user-1" },
              { implementedBy: null, createdBy: "user-1" },
            ],
          }),
          select: { completedAt: true, implementedBy: true },
        })
      );
    });

    it("should query decisions by epicId and date range (no user filter)", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      await getUserActivity(buildQuery({ userId: "user-1" }));

      expect(prisma.decision.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            epicId: { in: ["epic-1"] },
            createdAt: {
              gte: expect.any(Date),
              lt: expect.any(Date),
            },
          }),
          select: { createdAt: true },
        })
      );

      const callArgs = vi.mocked(prisma.decision.findMany).mock.calls[0][0];
      expect((callArgs as any).where).not.toHaveProperty("madeBy");
    });

    it("should query aiSessions by epicId and startedAt range (no user filter)", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      await getUserActivity(buildQuery({ userId: "user-1" }));

      expect(prisma.aiSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            epicId: { in: ["epic-1"] },
            startedAt: {
              gte: expect.any(Date),
              lt: expect.any(Date),
            },
          }),
          select: { startedAt: true, epicId: true },
        })
      );

      // AI sessions should NOT filter by userId
      const callArgs = vi.mocked(prisma.aiSession.findMany).mock.calls[0][0];
      expect((callArgs as any).where).not.toHaveProperty("userId");
    });

    it("should NOT filter by user for 'all' scope", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      await getUserActivity(buildQuery({ userId: "user-1", scope: "all" }));

      // Features should NOT have createdBy filter
      const featureCall = vi.mocked(prisma.feature.findMany).mock.calls[0][0];
      expect((featureCall as any).where).not.toHaveProperty("createdBy");

      // Tasks should NOT have implementedBy filter
      const taskCall = vi.mocked(prisma.task.findMany).mock.calls[0][0];
      expect((taskCall as any).where).not.toHaveProperty("implementedBy");
    });

    it("should query a date range spanning all requested buckets", async () => {
      setupAccessMocks();
      setupEmptyRecords();

      // 5-day window, page 1
      await getUserActivity(
        buildQuery({ interval: "day", limit: 5, page: 1 })
      );

      const featureCall = vi.mocked(prisma.feature.findMany).mock.calls[0][0];
      const gte = (featureCall as any).where.createdAt.gte as Date;
      const lt = (featureCall as any).where.createdAt.lt as Date;

      // gte should be Jan 10 00:00 UTC, lt should be Jan 15 00:00 UTC
      expect(gte.getUTCDate()).toBe(10);
      expect(lt.getUTCDate()).toBe(15);
    });

    it("should not call record queries when there are no epics", async () => {
      vi.mocked(prisma.membership.findMany).mockResolvedValue([
        { teamId: "team-1" },
      ] as any);
      vi.mocked(prisma.personalScope.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.epic.findMany).mockResolvedValue([]);

      await getUserActivity(buildQuery());

      expect(prisma.feature.findMany).not.toHaveBeenCalled();
      expect(prisma.task.findMany).not.toHaveBeenCalled();
      expect(prisma.decision.findMany).not.toHaveBeenCalled();
      expect(prisma.aiSession.findMany).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // 11. Multiple teams / epics
  // ===========================================================================

  describe("multiple teams and epics", () => {
    it("should aggregate activity across multiple epics", async () => {
      setupAccessMocks({
        teamIds: ["team-1", "team-2"],
        epicIds: ["epic-1", "epic-2", "epic-3"],
      });

      vi.mocked(prisma.feature.findMany).mockResolvedValue([
        { createdAt: localDate(2026, 0, 14, 3, 0, 0) },
        { createdAt: localDate(2026, 0, 14, 4, 0, 0) },
      ] as any);
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      vi.mocked(prisma.decision.findMany).mockResolvedValue([]);
      vi.mocked(prisma.aiSession.findMany).mockResolvedValue([]);

      const result = await getUserActivity(
        buildQuery({ interval: "day", limit: 1, page: 1 })
      );

      expect(result.data[0].featuresCreated).toBe(2);
    });

    it("should pass all epic IDs to every query", async () => {
      setupAccessMocks({
        teamIds: ["team-1", "team-2"],
        epicIds: ["epic-a", "epic-b"],
      });
      setupEmptyRecords();

      await getUserActivity(buildQuery());

      const featureWhere = vi.mocked(prisma.feature.findMany).mock
        .calls[0][0] as any;
      expect(featureWhere.where.epicId.in).toEqual(["epic-a", "epic-b"]);

      const decisionWhere = vi.mocked(prisma.decision.findMany).mock
        .calls[0][0] as any;
      expect(decisionWhere.where.epicId.in).toEqual(["epic-a", "epic-b"]);

      const sessionWhere = vi.mocked(prisma.aiSession.findMany).mock
        .calls[0][0] as any;
      expect(sessionWhere.where.epicId.in).toEqual(["epic-a", "epic-b"]);
    });
  });

  // ===========================================================================
  // 12. Personal scope inclusion
  // ===========================================================================

  describe("personal scope", () => {
    it("should include personal scope epics alongside team epics", async () => {
      setupAccessMocks({
        teamIds: ["team-1"],
        epicIds: ["epic-team", "epic-personal"],
        personalScopeId: "ps-abc",
      });
      setupEmptyRecords();

      await getUserActivity(buildQuery());

      expect(prisma.epic.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { teamId: { in: ["team-1"] } },
            { personalScopeId: "ps-abc" },
          ],
        },
        select: { id: true },
      });
    });
  });

  // ===========================================================================
  // 13. Large-scale aggregation (many records across buckets)
  // ===========================================================================

  describe("large-scale aggregation", () => {
    it("should correctly aggregate many records distributed across multiple day buckets", async () => {
      setupAccessMocks();

      // Create features spread across 7 local days (Jan 8 through Jan 14)
      // Day 14 gets 7 features, day 13 gets 6, ..., day 8 gets 1
      const features = [];
      for (let day = 14; day >= 8; day--) {
        const count = day - 7;
        for (let i = 0; i < count; i++) {
          features.push({
            createdAt: localDate(2026, 0, day, i + 1, 0, 0),
          });
        }
      }

      vi.mocked(prisma.feature.findMany).mockResolvedValue(features as any);
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);
      vi.mocked(prisma.decision.findMany).mockResolvedValue([]);
      vi.mocked(prisma.aiSession.findMany).mockResolvedValue([]);

      const result = await getUserActivity(
        buildQuery({ interval: "day", limit: 7, page: 1 })
      );

      expect(result.data[0].featuresCreated).toBe(7); // Day 14
      expect(result.data[1].featuresCreated).toBe(6); // Day 13
      expect(result.data[2].featuresCreated).toBe(5); // Day 12
      expect(result.data[3].featuresCreated).toBe(4); // Day 11
      expect(result.data[4].featuresCreated).toBe(3); // Day 10
      expect(result.data[5].featuresCreated).toBe(2); // Day 9
      expect(result.data[6].featuresCreated).toBe(1); // Day 8
    });

    it("should aggregate all four activity types in the same bucket", async () => {
      setupAccessMocks();

      // Many records of all types, all on Jan 14 local
      vi.mocked(prisma.feature.findMany).mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({
          createdAt: localDate(2026, 0, 14, i + 1, 0, 0),
        })) as any
      );
      vi.mocked(prisma.task.findMany).mockResolvedValue(
        Array.from({ length: 3 }, (_, i) => ({
          completedAt: localDate(2026, 0, 14, i + 6, 0, 0),
        })) as any
      );
      vi.mocked(prisma.decision.findMany).mockResolvedValue(
        Array.from({ length: 4 }, (_, i) => ({
          createdAt: localDate(2026, 0, 14, i + 9, 0, 0),
        })) as any
      );
      vi.mocked(prisma.aiSession.findMany).mockResolvedValue(
        Array.from({ length: 2 }, (_, i) => ({
          startedAt: localDate(2026, 0, 14, i + 13, 0, 0),
        })) as any
      );

      const result = await getUserActivity(
        buildQuery({ interval: "day", limit: 1, page: 1 })
      );

      const dp = result.data[0];
      expect(dp.featuresCreated).toBe(5);
      expect(dp.tasksCompleted).toBe(3);
      expect(dp.decisionsLogged).toBe(4);
      expect(dp.aiSessions).toBe(2);
      expect(dp.totalActivity).toBe(14);
    });
  });
});
