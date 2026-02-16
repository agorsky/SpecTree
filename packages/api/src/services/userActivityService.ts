/**
 * User Activity Service
 *
 * Aggregates user activity across Features, Tasks, Decisions, and AiSessions
 * into time-bucketed data points for dashboard consumption.
 */

import { prisma } from "../lib/db.js";
import { NotFoundError } from "../errors/index.js";

export type ActivityInterval = "day" | "week" | "month";
export type ActivityScope = "self" | "all" | "team" | "user";

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
  scope: ActivityScope;
  scopeId?: string;
}

export interface UserActivityResponse {
  data: UserActivityDataPoint[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

/**
 * Calculates the timezone offset in milliseconds for a given date and timezone.
 * 
 * This uses Intl.DateTimeFormat to get the UTC offset at a specific instant,
 * which properly handles DST transitions. The approach:
 * 1. Format the date in the target timezone to get local components
 * 2. Construct a UTC date from those components
 * 3. Calculate the difference between the original UTC timestamp and the constructed one
 * 
 * @param date - The date to calculate the offset for
 * @param timeZone - IANA timezone string (e.g., 'America/New_York')
 * @returns Offset in milliseconds (positive for ahead of UTC, negative for behind)
 */
function getTimezoneOffsetMs(date: Date, timeZone: string): number {
  // Get the date components as they appear in the target timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10);
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);
  const hour = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  const second = parseInt(parts.find((p) => p.type === "second")!.value, 10);
  
  // Construct a UTC date from these local components
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  
  // The offset is the difference between the original UTC time and the local time interpreted as UTC
  return date.getTime() - localAsUtc;
}

/**
 * Returns the UTC timestamp for the start of the calendar day in the given
 * timezone. Falls back to pure-UTC when no timezone is supplied.
 * 
 * This correctly handles DST transitions by:
 * 1. Getting the calendar date string in the target timezone
 * 2. Constructing a UTC date representing midnight of that calendar date
 * 3. Applying the timezone offset to get the actual UTC instant
 * 
 * @param date - Reference date
 * @param timeZone - Optional IANA timezone string
 * @returns UTC Date object representing midnight in the target timezone
 */
function startOfDayInTz(date: Date, timeZone?: string): Date {
  if (!timeZone) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  // Get the calendar date (YYYY-MM-DD) the user sees in their timezone
  const localDateStr = date.toLocaleDateString("sv-SE", { timeZone });

  // Create a UTC date representing midnight of that calendar date
  // Use 12:00 UTC to avoid DST ambiguity, then we'll find true midnight
  const approxMidnight = new Date(localDateStr + "T12:00:00.000Z");
  
  // Get the year, month, day components in the target timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(approxMidnight);
  const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10);
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);
  
  // Construct midnight in the local timezone as a UTC timestamp
  // We need to find the UTC instant that corresponds to midnight local time
  const midnightLocalAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  
  // Get the offset at midnight local time
  const testDate = new Date(midnightLocalAsUtc);
  const offset = getTimezoneOffsetMs(testDate, timeZone);
  
  // Apply the offset to get the true UTC instant of midnight in the target timezone
  return new Date(midnightLocalAsUtc + offset);
}

/**
 * Returns the start of the interval bucket for a given date, respecting the
 * user's timezone when provided.
 * 
 * For day intervals: Returns midnight in the target timezone
 * For week intervals: Returns midnight on Sunday of the week (in target timezone)
 * For month intervals: Returns midnight on the 1st of the month (in target timezone)
 * 
 * All calculations use proper Date arithmetic and timezone offset calculations
 * to correctly handle DST transitions.
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
    
    // Get the weekday by examining the date in the target timezone
    let weekday: number;
    if (timeZone) {
      // Format the date to get the day-of-week in the target timezone
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "short", // This gives us Sun, Mon, etc.
      });
      const dayName = formatter.format(dayStart);
      const dayMap: { [key: string]: number } = {
        Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
      };
      weekday = dayMap[dayName] ?? 0;
    } else {
      weekday = dayStart.getUTCDay();
    }
    
    // Walk back to Sunday (weekday 0)
    return new Date(dayStart.getTime() - weekday * 86_400_000);
  }

  // month interval
  if (timeZone) {
    // Get the year and month in the target timezone
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(date);
    const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
    const month = parseInt(parts.find((p) => p.type === "month")!.value, 10);
    
    // Create a date representing the 1st of that month in UTC
    const firstOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    
    // Get midnight of that date in the target timezone
    return startOfDayInTz(firstOfMonth, timeZone);
  }

  // No timezone: use pure UTC
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
  
  return filtered.length;
}

/**
 * Get epic IDs based on the specified scope.
 * 
 * @param scope - The scope type: 'self', 'all', 'team', or 'user'
 * @param userId - The requesting user's ID (for 'self' scope)
 * @param scopeId - The team/user ID (for 'team'/'user' scopes)
 * @returns Array of epic IDs accessible in the specified scope
 */
async function getEpicsByScope(
  scope: ActivityScope,
  userId: string,
  scopeId?: string
): Promise<string[]> {
  if (scope === "self") {
    // Use existing team membership resolution logic (zero change)
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

    return epicIds;
  }

  if (scope === "all") {
    // Return all epic IDs in the database
    const epicIds = (
      await prisma.epic.findMany({ select: { id: true } })
    ).map((e) => e.id);

    return epicIds;
  }

  if (scope === "team") {
    // Return epics where teamId matches scopeId
    if (!scopeId) {
      return [];
    }

    // Validate team existence
    const team = await prisma.team.findUnique({
      where: { id: scopeId },
      select: { id: true },
    });

    if (!team) {
      throw new NotFoundError(`Team with ID '${scopeId}' not found`);
    }

    const epicIds = (
      await prisma.epic.findMany({
        where: { teamId: scopeId },
        select: { id: true },
      })
    ).map((e) => e.id);

    return epicIds;
  }

  if (scope === "user") {
    // Return epics accessible to specified user via team memberships
    if (!scopeId) {
      return [];
    }

    // Validate user existence
    const user = await prisma.user.findUnique({
      where: { id: scopeId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundError(`User with ID '${scopeId}' not found`);
    }

    const memberships = await prisma.membership.findMany({
      where: { userId: scopeId },
      select: { teamId: true },
    });
    const teamIds = memberships.map((m) => m.teamId);

    // Also include personal scope epics for the target user
    const personalScope = await prisma.personalScope.findFirst({
      where: { userId: scopeId },
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

    return epicIds;
  }

  return [];
}

/**
 * Get aggregated user activity data.
 */
export async function getUserActivity(
  query: UserActivityQuery
): Promise<UserActivityResponse> {
  const { userId, interval, page, limit, timeZone, scope, scopeId } = query;

  // Get epic IDs based on scope
  const epicIds = await getEpicsByScope(scope, userId, scopeId);

  // Determine the target user ID for attribution filtering
  // For 'self' scope, use the requesting userId
  // For 'user' scope, use the scopeId (target user)
  // For 'all' and 'team' scopes, don't filter by user attribution
  const targetUserId = scope === "self" ? userId : scope === "user" ? scopeId : undefined;

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

  // Fetch all relevant records in the date range (parallel queries)
  // For features: filter by createdBy (who created the feature)
  // For tasks: primarily filter by implementedBy (who completed the task), with
  // fallback to createdBy when legacy records are missing implementedBy.
  const [features, tasks, decisions, aiSessions] = await Promise.all([
    prisma.feature.findMany({
      where: {
        epicId: { in: epicIds },
        createdAt: { gte: earliest, lt: latest },
        ...(targetUserId ? { createdBy: targetUserId } : {}),
      },
      select: { createdAt: true, createdBy: true },
    }),
    prisma.task.findMany({
      where: {
        feature: { epicId: { in: epicIds } },
        completedAt: { gte: earliest, lt: latest },
        ...(targetUserId
          ? {
              OR: [
                { implementedBy: targetUserId },
                { implementedBy: null, createdBy: targetUserId },
              ],
            }
          : {}),
      },
      select: { completedAt: true, implementedBy: true },
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

// ─── Activity Details (drill-down) ───────────────────────────────────────────

export type MetricType = "features" | "tasks" | "decisions" | "sessions";

export interface ActivityDetailsQuery {
  userId: string;
  metricType: MetricType;
  interval: ActivityInterval;
  page: number;
  scope: ActivityScope;
  scopeId?: string;
  timeZone?: string;
  limit?: number;
  cursor?: string;
}

export interface ActivityDetailsResponse {
  data: unknown[];
  meta: { cursor?: string; hasMore: boolean };
}

/**
 * Returns detailed item records for a specific metric type within the
 * computed time range (same bucketing logic as the aggregate endpoint).
 */
export async function getActivityDetails(
  query: ActivityDetailsQuery
): Promise<ActivityDetailsResponse> {
  const {
    userId,
    metricType,
    interval,
    page,
    scope,
    scopeId,
    timeZone,
    limit = 50,
    cursor,
  } = query;

  const epicIds = await getEpicsByScope(scope, userId, scopeId);
  if (epicIds.length === 0) {
    return { data: [], meta: { hasMore: false } };
  }

  // Compute the visible time window (same as aggregate)
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

  // Page in the dashboard is 1-indexed; we need the visible buckets
  const dashPage = Math.max(page, 1);
  const buckets = generateBuckets(interval, dashPage, 30, validTz);
  if (buckets.length === 0) {
    return { data: [], meta: { hasMore: false } };
  }

  const earliest = buckets[buckets.length - 1]!.start;
  const latest = buckets[0]!.end;

  const take = Math.min(Math.max(limit, 1), 100);

  // Determine the target user ID for attribution filtering
  const targetUserId = scope === "self" ? userId : scope === "user" ? scopeId : undefined;

  switch (metricType) {
    case "features": {
      const items = await prisma.feature.findMany({
        where: {
          epicId: { in: epicIds },
          createdAt: { gte: earliest, lt: latest },
          ...(targetUserId ? { createdBy: targetUserId } : {}),
          ...(cursor ? { id: { lt: cursor } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: take + 1,
        select: {
          id: true,
          identifier: true,
          title: true,
          createdAt: true,
          assignee: { select: { name: true } },
          status: { select: { name: true, color: true } },
          epic: { select: { name: true } },
        },
      });

      const hasMore = items.length > take;
      const page_items = hasMore ? items.slice(0, take) : items;
      return {
        data: page_items.map((f) => ({
          id: f.id,
          identifier: f.identifier,
          title: f.title,
          epicName: f.epic.name,
          statusName: f.status?.name ?? "No status",
          statusColor: f.status?.color ?? undefined,
          assigneeName: f.assignee?.name ?? undefined,
          createdAt: f.createdAt.toISOString(),
        })),
        meta: {
          ...(page_items.length > 0 && { cursor: page_items[page_items.length - 1]!.id }),
          hasMore,
        },
      };
    }

    case "tasks": {
      const items = await prisma.task.findMany({
        where: {
          feature: { epicId: { in: epicIds } },
          completedAt: { gte: earliest, lt: latest },
          ...(targetUserId
            ? {
                OR: [
                  { implementedBy: targetUserId },
                  { implementedBy: null, createdBy: targetUserId },
                ],
              }
            : {}),
          ...(cursor ? { id: { lt: cursor } } : {}),
        },
        orderBy: { completedAt: "desc" },
        take: take + 1,
        select: {
          id: true,
          identifier: true,
          title: true,
          completedAt: true,
          status: { select: { name: true } },
          feature: { select: { identifier: true, title: true } },
        },
      });

      const hasMore = items.length > take;
      const page_items = hasMore ? items.slice(0, take) : items;
      return {
        data: page_items.map((t) => ({
          id: t.id,
          identifier: t.identifier,
          title: t.title,
          featureIdentifier: t.feature.identifier,
          featureTitle: t.feature.title,
          statusName: t.status?.name ?? "No status",
          completedAt: t.completedAt?.toISOString() ?? null,
        })),
        meta: {
          ...(page_items.length > 0 && { cursor: page_items[page_items.length - 1]!.id }),
          hasMore,
        },
      };
    }

    case "decisions": {
      const items = await prisma.decision.findMany({
        where: {
          epicId: { in: epicIds },
          createdAt: { gte: earliest, lt: latest },
          ...(cursor ? { id: { lt: cursor } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: take + 1,
        select: {
          id: true,
          question: true,
          decision: true,
          rationale: true,
          category: true,
          impact: true,
          madeBy: true,
          createdAt: true,
          epic: { select: { id: true, name: true } },
          feature: { select: { identifier: true } },
        },
      });

      const hasMore = items.length > take;
      const page_items = hasMore ? items.slice(0, take) : items;
      return {
        data: page_items.map((d) => ({
          id: d.id,
          question: d.question,
          decision: d.decision,
          rationale: d.rationale ?? undefined,
          category: d.category ?? "uncategorized",
          impact: d.impact ?? "medium",
          madeBy: d.madeBy,
          epicName: d.epic.name,
          epicId: d.epic.id,
          featureIdentifier: d.feature?.identifier ?? undefined,
          createdAt: d.createdAt.toISOString(),
        })),
        meta: {
          ...(page_items.length > 0 && { cursor: page_items[page_items.length - 1]!.id }),
          hasMore,
        },
      };
    }

    case "sessions": {
      const items = await prisma.aiSession.findMany({
        where: {
          epicId: { in: epicIds },
          startedAt: { gte: earliest, lt: latest },
          ...(cursor ? { id: { lt: cursor } } : {}),
        },
        orderBy: { startedAt: "desc" },
        take: take + 1,
        select: {
          id: true,
          epicId: true,
          startedAt: true,
          endedAt: true,
          status: true,
          summary: true,
          epic: { select: { name: true } },
        },
      });

      const hasMore = items.length > take;
      const page_items = hasMore ? items.slice(0, take) : items;
      return {
        data: page_items.map((s) => ({
          id: s.id,
          epicId: s.epicId,
          epicName: s.epic.name,
          startedAt: s.startedAt.toISOString(),
          endedAt: s.endedAt?.toISOString() ?? undefined,
          status: s.status,
          summary: s.summary ?? undefined,
        })),
        meta: {
          ...(page_items.length > 0 && { cursor: page_items[page_items.length - 1]!.id }),
          hasMore,
        },
      };
    }
  }
}
