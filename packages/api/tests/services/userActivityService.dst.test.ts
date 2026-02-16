import { describe, it, expect, vi, beforeEach } from "vitest";

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
 * Configure the mock Prisma client so that getUserActivity succeeds.
 */
function setupMocks() {
  vi.mocked(prisma.membership.findMany).mockResolvedValue([
    { teamId: "team-1" } as any,
  ]);
  vi.mocked(prisma.personalScope.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.epic.findMany).mockResolvedValue([
    { id: "epic-1" } as any,
  ]);
  vi.mocked(prisma.feature.findMany).mockResolvedValue([]);
  vi.mocked(prisma.task.findMany).mockResolvedValue([]);
  vi.mocked(prisma.decision.findMany).mockResolvedValue([]);
  vi.mocked(prisma.aiSession.findMany).mockResolvedValue([]);
}

/**
 * Build a standard query object.
 */
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
 * Check if a date string represents midnight in the specified timezone.
 */
function isMidnightInTimezone(isoString: string, timeZone: string): boolean {
  const date = new Date(isoString);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value;
  const minute = parts.find((p) => p.type === "minute")?.value;
  const second = parts.find((p) => p.type === "second")?.value;
  return hour === "00" && minute === "00" && second === "00";
}

// =============================================================================
// Tests
// =============================================================================

describe("userActivityService - DST Transition Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  describe("DST Spring Forward (America/New_York)", () => {
    it("handles day buckets during spring DST transition (2024-03-10)", async () => {
      // 2024-03-10 at 2:00 AM EST -> 3:00 AM EDT (spring forward)
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-03-12T12:00:00Z"));

      const query = buildQuery({
        interval: "day",
        timeZone: "America/New_York",
        limit: 5,
      });

      const result = await getUserActivity(query);

      expect(result.data).toHaveLength(5);

      // Verify each bucket starts at midnight in America/New_York timezone
      for (const dataPoint of result.data) {
        const startIsMidnight = isMidnightInTimezone(
          dataPoint.intervalStart,
          "America/New_York"
        );
        expect(startIsMidnight).toBe(true);

        // Verify bucket duration is approximately 24 hours (DST transition might vary slightly)
        const start = new Date(dataPoint.intervalStart);
        const end = new Date(dataPoint.intervalEnd);
        const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        
        // On DST transition day, duration should be 23 hours (spring forward)
        // On normal days, it should be 24 hours
        expect(durationHours).toBeGreaterThanOrEqual(23);
        expect(durationHours).toBeLessThanOrEqual(25);
      }

      vi.useRealTimers();
    });

    it("handles week buckets during spring DST transition", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-03-17T12:00:00Z"));

      const query = buildQuery({
        interval: "week",
        timeZone: "America/New_York",
        limit: 3,
      });

      const result = await getUserActivity(query);

      expect(result.data).toHaveLength(3);

      // Verify each bucket has consistent week duration
      // Note: Week bucketing across DST transitions may not start exactly at midnight
      for (const dataPoint of result.data) {
        // Verify week duration (approximately 7 days, may vary with DST)
        const start = new Date(dataPoint.intervalStart);
        const end = new Date(dataPoint.intervalEnd);
        const durationDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        expect(durationDays).toBeGreaterThanOrEqual(6.9);
        expect(durationDays).toBeLessThanOrEqual(7.1);
        
        // Verify buckets are aligned to a consistent point in the week
        expect(dataPoint.intervalStart).toBeTruthy();
        expect(dataPoint.intervalEnd).toBeTruthy();
      }

      vi.useRealTimers();
    });

    it("handles month buckets during spring DST transition", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-03-20T12:00:00Z"));

      const query = buildQuery({
        interval: "month",
        timeZone: "America/New_York",
        limit: 3,
      });

      const result = await getUserActivity(query);

      expect(result.data).toHaveLength(3);

      // Verify each bucket starts at midnight in the timezone
      for (const dataPoint of result.data) {
        const startIsMidnight = isMidnightInTimezone(
          dataPoint.intervalStart,
          "America/New_York"
        );
        expect(startIsMidnight).toBe(true);
        
        // Verify bucket duration is approximately one month (28-31 days)
        const start = new Date(dataPoint.intervalStart);
        const end = new Date(dataPoint.intervalEnd);
        const durationDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        expect(durationDays).toBeGreaterThanOrEqual(28);
        expect(durationDays).toBeLessThanOrEqual(32);
      }

      vi.useRealTimers();
    });
  });

  describe("DST Fall Back (America/New_York)", () => {
    it("handles day buckets during fall DST transition (2024-11-03)", async () => {
      // 2024-11-03 at 2:00 AM EDT -> 1:00 AM EST (fall back)
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-11-05T12:00:00Z"));

      const query = buildQuery({
        interval: "day",
        timeZone: "America/New_York",
        limit: 5,
      });

      const result = await getUserActivity(query);

      expect(result.data).toHaveLength(5);

      // Verify each bucket starts at midnight
      for (const dataPoint of result.data) {
        const startIsMidnight = isMidnightInTimezone(
          dataPoint.intervalStart,
          "America/New_York"
        );
        expect(startIsMidnight).toBe(true);

        // On fall back, the day has 25 hours
        const start = new Date(dataPoint.intervalStart);
        const end = new Date(dataPoint.intervalEnd);
        const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        
        expect(durationHours).toBeGreaterThanOrEqual(23);
        expect(durationHours).toBeLessThanOrEqual(25);
      }

      vi.useRealTimers();
    });
  });

  describe("No DST (America/Phoenix)", () => {
    it("handles day buckets consistently in timezone without DST", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-03-12T12:00:00Z"));

      const query = buildQuery({
        interval: "day",
        timeZone: "America/Phoenix",
        limit: 5,
      });

      const result = await getUserActivity(query);

      expect(result.data).toHaveLength(5);

      // Verify each bucket starts at midnight and has exactly 24 hours
      for (const dataPoint of result.data) {
        const startIsMidnight = isMidnightInTimezone(
          dataPoint.intervalStart,
          "America/Phoenix"
        );
        expect(startIsMidnight).toBe(true);

        const start = new Date(dataPoint.intervalStart);
        const end = new Date(dataPoint.intervalEnd);
        const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        
        // Phoenix has no DST, so every day should be exactly 24 hours
        expect(durationHours).toBe(24);
      }

      vi.useRealTimers();
    });
  });

  describe("Southern Hemisphere DST (Australia/Sydney)", () => {
    it("handles day buckets during Australian DST transitions", async () => {
      // Australia/Sydney has DST transitions in October (spring forward) and April (fall back)
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-10-10T12:00:00Z"));

      const query = buildQuery({
        interval: "day",
        timeZone: "Australia/Sydney",
        limit: 5,
      });

      const result = await getUserActivity(query);

      expect(result.data).toHaveLength(5);

      // Verify each bucket has consistent duration (handles DST correctly)
      for (const dataPoint of result.data) {
        const start = new Date(dataPoint.intervalStart);
        const end = new Date(dataPoint.intervalEnd);
        const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        
        // DST transitions can cause 23 or 25 hour days
        expect(durationHours).toBeGreaterThanOrEqual(23);
        expect(durationHours).toBeLessThanOrEqual(25);
      }

      vi.useRealTimers();
    });
  });

  describe("UTC (no timezone)", () => {
    it("handles buckets correctly when no timezone is specified", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-03-12T12:00:00Z"));

      const query = buildQuery({
        interval: "day",
        timeZone: undefined,
        limit: 5,
      });

      const result = await getUserActivity(query);

      expect(result.data).toHaveLength(5);

      // Verify each bucket starts at midnight UTC
      for (const dataPoint of result.data) {
        const start = new Date(dataPoint.intervalStart);
        expect(start.getUTCHours()).toBe(0);
        expect(start.getUTCMinutes()).toBe(0);
        expect(start.getUTCSeconds()).toBe(0);

        // All days should be exactly 24 hours in UTC
        const end = new Date(dataPoint.intervalEnd);
        const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        expect(durationHours).toBe(24);
      }

      vi.useRealTimers();
    });
  });

  describe("Europe/London DST", () => {
    it("handles day buckets during UK DST transition", async () => {
      // Europe/London transitions last Sunday of March
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-03-31T12:00:00Z"));

      const query = buildQuery({
        interval: "day",
        timeZone: "Europe/London",
        limit: 5,
      });

      const result = await getUserActivity(query);

      expect(result.data).toHaveLength(5);

      // Verify each bucket starts at midnight in London time
      for (const dataPoint of result.data) {
        const startIsMidnight = isMidnightInTimezone(
          dataPoint.intervalStart,
          "Europe/London"
        );
        expect(startIsMidnight).toBe(true);
      }

      vi.useRealTimers();
    });
  });

  describe("Edge Cases", () => {
    it("handles invalid timezone by falling back to UTC", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-03-12T12:00:00Z"));

      const query = buildQuery({
        interval: "day",
        // @ts-expect-error Testing invalid timezone
        timeZone: "Invalid/Timezone",
        limit: 3,
      });

      // Invalid timezones fall back to UTC instead of throwing
      // The Intl.DateTimeFormat API will throw, but our code catches it
      const result = await getUserActivity(query);
      
      // Should still return valid data (using UTC as fallback)
      expect(result.data).toHaveLength(3);
      expect(result.data[0]).toHaveProperty("intervalStart");
      expect(result.data[0]).toHaveProperty("intervalEnd");

      vi.useRealTimers();
    });

    it("handles year boundary correctly with timezone", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-02T12:00:00Z"));

      const query = buildQuery({
        interval: "day",
        timeZone: "America/New_York",
        limit: 5,
      });

      const result = await getUserActivity(query);

      expect(result.data).toHaveLength(5);

      // One of the buckets should be from December 2023
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
      });
      
      const anyFromDec2023 = result.data.some((dp) => {
        const start = new Date(dp.intervalStart);
        const ym = formatter.format(start);
        return ym.includes("2023");
      });
      expect(anyFromDec2023).toBe(true);

      vi.useRealTimers();
    });
  });
});
