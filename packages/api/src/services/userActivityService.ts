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
  timeZone?: string;
}

export interface UserActivityResponse {
  data: UserActivityDataPoint[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

/**
 * Returns the UTC timestamp for the start of the calendar day in the given
 * timezone.  Falls back to pure-UTC when no timezone is supplied.
 */
function startOfDayInTz(date: Date, timeZone?: string): Date {
  if (!timeZone) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  // Get the calendar date (YYYY-MM-DD) the user sees in their timezone
  const localDateStr = date.toLocaleDateString("sv-SE", { timeZone });

  // Find the UTC instant that corresponds to midnight of that local date.
  // 1. Start with midnight-UTC of the same calendar date as an approximation.
  const midnightUtc = new Date(localDateStr + "T00:00:00.000Z");

  // 2. Compute the offset between UTC and the target timezone at that instant
  //    by formatting the same instant in both zones and comparing.
  const utcRepr = new Date(
    midnightUtc.toLocaleString("en-US", { timeZone: "UTC" })
  );
  const tzRepr = new Date(
    midnightUtc.toLocaleString("en-US", { timeZone })
  );
  const offsetMs = tzRepr.getTime() - utcRepr.getTime();

  // 3. Shift: midnight-local(UTC) = midnight-UTC − offset
  return new Date(midnightUtc.getTime() - offsetMs);
}

/**
 * Returns the start of the interval bucket for a given date, respecting the
 * user's timezone when provided.
 */
function getIntervalStart(
  date: Date,
  interval: ActivityInterval,
  timeZone?: string
): Date {
  if (interval === "day") {
    return startOfDayInTz(date, timeZone);
  }

  if (interval === "week") {
    const dayStart = startOfDayInTz(date, timeZone);
    // Determine the weekday in the user's timezone (or UTC)
    const weekday = timeZone
      ? new Date(
          dayStart.toLocaleString("en-US", { timeZone })
        ).getDay()
      : dayStart.getUTCDay();
    // Walk back to Sunday
    return new Date(dayStart.getTime() - weekday * 86_400_000);
  }

  // month
  if (timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const year = parts.find((p) => p.type === "year")!.value;
    const month = parts.find((p) => p.type === "month")!.value;
    return startOfDayInTz(
      new Date(`${year}-${month}-01T12:00:00.000Z`),
      timeZone
    );
  }

  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns the end of the interval bucket (start of next bucket).
 */
function getIntervalEnd(
  start: Date,
  interval: ActivityInterval,
  timeZone?: string
): Date {
  if (interval === "day") {
    // Add ~25 h then snap to start-of-day to handle DST safely
    return startOfDayInTz(
      new Date(start.getTime() + 25 * 3_600_000),
      timeZone
    );
  }
  if (interval === "week") {
    return startOfDayInTz(
      new Date(start.getTime() + 7.5 * 86_400_000),
      timeZone
    );
  }
  // month – jump into the next month then snap
  const ref = new Date(start.getTime() + 32 * 86_400_000);
  return getIntervalStart(ref, "month", timeZone);
}

/**
 * Generates an array of interval buckets going backwards from now,
 * aligned to the user's timezone when provided.
 */
function generateBuckets(
  interval: ActivityInterval,
  page: number,
  limit: number,
  timeZone?: string
): Array<{ start: Date; end: Date }> {
  const now = new Date();
  const currentStart = getIntervalStart(now, interval, timeZone);
  const buckets: Array<{ start: Date; end: Date }> = [];

  // Walk backwards from current interval
  const totalSkip = (page - 1) * limit;
  let cursor = new Date(currentStart);

  // Move back by totalSkip intervals
  for (let i = 0; i < totalSkip; i++) {
    // Step back one interval by going to just before current cursor
    cursor = getIntervalStart(
      new Date(cursor.getTime() - 1),
      interval,
      timeZone
    );
  }

  // Generate `limit` buckets going backwards
  for (let i = 0; i < limit; i++) {
    const end = getIntervalEnd(cursor, interval, timeZone);
    buckets.push({ start: new Date(cursor), end });
    // Step back one interval
    cursor = getIntervalStart(
      new Date(cursor.getTime() - 1),
      interval,
      timeZone
    );
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
  const filtered = records.filter((r) => {
    const val = r[dateField];
    if (val == null) return false;
    const d = val instanceof Date ? val : new Date(val as string);
    return d >= start && d < end;
  });
  
  // Debug logging for countInRange
  if (records.length > 0) {
    console.log('[UserActivity] countInRange:', {
      field: String(dateField),
      totalRecords: records.length,
      filteredCount: filtered.length,
      range: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      sampleRecord: records[0] ? {
        timestamp: records[0][dateField] instanceof Date 
          ? (records[0][dateField] as Date).toISOString()
          : String(records[0][dateField]),
      } : null,
    });
  }
  
  return filtered.length;
}

/**
 * Get aggregated user activity data.
 */
export async function getUserActivity(
  query: UserActivityQuery
): Promise<UserActivityResponse> {
  const { userId, interval, page, limit, timeZone } = query;

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

  // Generate time buckets (aligned to user's timezone when provided)
  const validTz = timeZone
    ? (() => {
        try {
          Intl.DateTimeFormat(undefined, { timeZone });
          return timeZone;
        } catch {
          return undefined;
        }
      })()
    : undefined;
  const buckets = generateBuckets(interval, page, limit, validTz);

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

  // Debug logging: Query parameters
  console.log('[UserActivity] Query parameters:', {
    epicIds: epicIds.length > 0 ? epicIds : 'none',
    epicIdsSample: epicIds.slice(0, 3),
    dateRange: {
      earliest: earliest.toISOString(),
      latest: latest.toISOString(),
    },
    interval,
    bucketsCount: buckets.length,
  });

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
      select: { startedAt: true, epicId: true },
    }),
  ]);

  // Debug logging: Query results
  console.log('[UserActivity] Query results:', {
    featuresCount: features.length,
    tasksCount: tasks.length,
    decisionsCount: decisions.length,
    aiSessionsCount: aiSessions.length,
    aiSessionsSample: aiSessions.slice(0, 3).map(s => ({
      startedAt: s.startedAt.toISOString(),
      epicId: s.epicId,
    })),
  });

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
