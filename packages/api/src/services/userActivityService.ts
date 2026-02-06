/**
 * User Activity Service
 *
 * Aggregates user activity across Features, Tasks, Decisions, and AiSessions
 * into time-bucketed data points for dashboard consumption.
 */

import { prisma } from "../lib/db.js";

export type ActivityInterval = "day" | "week" | "month";

export interface UserActivityDataPoint {
  intervalStart: string;
  intervalEnd: string;
  featuresCreated: number;
  tasksCompleted: number;
  decisionsLogged: number;
  aiSessions: number;
  totalActivity: number;
}

export interface UserActivityQuery {
  userId: string;
  interval: ActivityInterval;
  page: number;
  limit: number;
}

export interface UserActivityResponse {
  data: UserActivityDataPoint[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

/**
 * Returns the start of the interval bucket for a given date.
 */
function getIntervalStart(date: Date, interval: ActivityInterval): Date {
  const d = new Date(date);
  if (interval === "day") {
    d.setHours(0, 0, 0, 0);
  } else if (interval === "week") {
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
  } else {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

/**
 * Returns the end of the interval bucket (start of next bucket).
 */
function getIntervalEnd(start: Date, interval: ActivityInterval): Date {
  const d = new Date(start);
  if (interval === "day") {
    d.setDate(d.getDate() + 1);
  } else if (interval === "week") {
    d.setDate(d.getDate() + 7);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

/**
 * Generates an array of interval buckets going backwards from now.
 */
function generateBuckets(
  interval: ActivityInterval,
  page: number,
  limit: number
): Array<{ start: Date; end: Date }> {
  const now = new Date();
  const currentStart = getIntervalStart(now, interval);
  const buckets: Array<{ start: Date; end: Date }> = [];

  // Walk backwards from current interval
  const totalSkip = (page - 1) * limit;
  const startBucket = new Date(currentStart);

  // Move back by totalSkip intervals
  for (let i = 0; i < totalSkip; i++) {
    if (interval === "day") {
      startBucket.setDate(startBucket.getDate() - 1);
    } else if (interval === "week") {
      startBucket.setDate(startBucket.getDate() - 7);
    } else {
      startBucket.setMonth(startBucket.getMonth() - 1);
    }
  }

  // Generate `limit` buckets going backwards
  const cursor = new Date(startBucket);
  for (let i = 0; i < limit; i++) {
    const end = getIntervalEnd(cursor, interval);
    buckets.push({ start: new Date(cursor), end });
    if (interval === "day") {
      cursor.setDate(cursor.getDate() - 1);
    } else if (interval === "week") {
      cursor.setDate(cursor.getDate() - 7);
    } else {
      cursor.setMonth(cursor.getMonth() - 1);
    }
  }

  return buckets;
}

/**
 * Count records in a date range for a given timestamp field.
 */
function countInRange<T extends { [key: string]: unknown }>(
  records: T[],
  dateField: keyof T,
  start: Date,
  end: Date
): number {
  return records.filter((r) => {
    const val = r[dateField];
    if (val == null) return false;
    const d = val instanceof Date ? val : new Date(val as string);
    return d >= start && d < end;
  }).length;
}

/**
 * Get aggregated user activity data.
 */
export async function getUserActivity(
  query: UserActivityQuery
): Promise<UserActivityResponse> {
  const { userId, interval, page, limit } = query;

  // Find epics accessible to this user (via team memberships)
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { teamId: true },
  });
  const teamIds = memberships.map((m) => m.teamId);

  // Also include personal scope epics
  const personalScope = await prisma.personalScope.findFirst({
    where: { userId },
    select: { id: true },
  });

  const epicWhere = {
    OR: [
      { teamId: { in: teamIds } },
      ...(personalScope ? [{ personalScopeId: personalScope.id }] : []),
    ],
  };

  const epicIds = (
    await prisma.epic.findMany({ where: epicWhere, select: { id: true } })
  ).map((e) => e.id);

  // Generate time buckets
  const buckets = generateBuckets(interval, page, limit);

  if (buckets.length === 0 || epicIds.length === 0) {
    return { data: [], page, limit, total: 0, hasMore: false };
  }

  // Determine overall date range for efficient querying
  const firstBucket = buckets[buckets.length - 1];
  const lastBucket = buckets[0];
  if (!firstBucket || !lastBucket) {
    return { data: [], page, limit, total: 0, hasMore: false };
  }
  const earliest = firstBucket.start;
  const latest = lastBucket.end;

  // Fetch all relevant records in the date range (parallel queries)
  const [features, tasks, decisions, aiSessions] = await Promise.all([
    prisma.feature.findMany({
      where: {
        epicId: { in: epicIds },
        createdAt: { gte: earliest, lt: latest },
      },
      select: { createdAt: true },
    }),
    prisma.task.findMany({
      where: {
        feature: { epicId: { in: epicIds } },
        completedAt: { gte: earliest, lt: latest },
      },
      select: { completedAt: true },
    }),
    prisma.decision.findMany({
      where: {
        epicId: { in: epicIds },
        createdAt: { gte: earliest, lt: latest },
      },
      select: { createdAt: true },
    }),
    prisma.aiSession.findMany({
      where: {
        epicId: { in: epicIds },
        startedAt: { gte: earliest, lt: latest },
      },
      select: { startedAt: true },
    }),
  ]);

  // Aggregate into buckets
  const data: UserActivityDataPoint[] = buckets.map(({ start, end }) => {
    const fc = countInRange(features, "createdAt", start, end);
    const tc = countInRange(tasks, "completedAt", start, end);
    const dl = countInRange(decisions, "createdAt", start, end);
    const as_ = countInRange(aiSessions, "startedAt", start, end);

    return {
      intervalStart: start.toISOString(),
      intervalEnd: end.toISOString(),
      featuresCreated: fc,
      tasksCompleted: tc,
      decisionsLogged: dl,
      aiSessions: as_,
      totalActivity: fc + tc + dl + as_,
    };
  });

  // Estimate total available intervals (go back 1 year max)
  const maxIntervals =
    interval === "day" ? 365 : interval === "week" ? 52 : 12;
  const total = maxIntervals;

  return {
    data,
    page,
    limit,
    total,
    hasMore: page * limit < total,
  };
}
