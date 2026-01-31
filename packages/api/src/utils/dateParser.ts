/**
 * Date parsing utility for API date filter parameters.
 * Supports ISO-8601 date strings and duration format.
 */

import { ValidationError } from "../errors/index.js";

/**
 * ISO-8601 duration regex pattern.
 * Supports negative durations for "last N days/weeks/months".
 * Format: -P{n}D (days), -P{n}W (weeks), -P{n}M (months)
 */
const DURATION_PATTERN = /^-P(\d+)([DWM])$/;

/**
 * ISO-8601 date pattern (YYYY-MM-DD).
 */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * ISO-8601 datetime pattern (includes time and optional timezone).
 */
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/**
 * Parses a date string that can be either:
 * - An ISO-8601 date/datetime string (e.g., "2024-01-01" or "2024-01-01T00:00:00Z")
 * - An ISO-8601 duration format (e.g., "-P7D" for last 7 days)
 *
 * @param input - The date string to parse
 * @returns A Date object representing the parsed date
 * @throws ValidationError if the format is invalid
 *
 * @example
 * parseDate("2024-01-01")      // Returns Date for Jan 1, 2024
 * parseDate("-P7D")            // Returns Date for 7 days ago
 * parseDate("-P2W")            // Returns Date for 2 weeks ago
 * parseDate("-P1M")            // Returns Date for 1 month ago
 */
export function parseDate(input: string): Date {
  // Check for duration format first
  const durationMatch = DURATION_PATTERN.exec(input);
  if (durationMatch?.[1] && durationMatch[2]) {
    return parseDuration(durationMatch[1], durationMatch[2]);
  }

  // Check for ISO date format (YYYY-MM-DD)
  if (ISO_DATE_PATTERN.test(input)) {
    const date = new Date(input + "T00:00:00.000Z");
    if (isValidDate(date)) {
      return date;
    }
    throw new ValidationError(
      `Invalid date value: '${input}'. Expected a valid ISO-8601 date.`
    );
  }

  // Check for ISO datetime format
  if (ISO_DATETIME_PATTERN.test(input)) {
    const date = new Date(input);
    if (isValidDate(date)) {
      return date;
    }
    throw new ValidationError(
      `Invalid datetime value: '${input}'. Expected a valid ISO-8601 datetime.`
    );
  }

  throw new ValidationError(
    `Invalid date format: '${input}'. Expected ISO-8601 date (YYYY-MM-DD), datetime, or duration (-P{n}D, -P{n}W, -P{n}M).`
  );
}

/**
 * Parses a duration string and returns a Date relative to now.
 *
 * @param value - The numeric value of the duration
 * @param unit - The unit: D (days), W (weeks), M (months)
 * @returns A Date object representing the calculated date
 */
function parseDuration(value: string, unit: string): Date {
  const amount = parseInt(value, 10);
  const now = new Date();

  switch (unit) {
    case "D": {
      // Days
      const date = new Date(now);
      date.setDate(date.getDate() - amount);
      return date;
    }
    case "W": {
      // Weeks
      const date = new Date(now);
      date.setDate(date.getDate() - amount * 7);
      return date;
    }
    case "M": {
      // Months
      const date = new Date(now);
      date.setMonth(date.getMonth() - amount);
      return date;
    }
    default:
      throw new ValidationError(
        `Invalid duration unit: '${unit}'. Expected D (days), W (weeks), or M (months).`
      );
  }
}

/**
 * Checks if a Date object is valid (not NaN).
 */
function isValidDate(date: Date): boolean {
  return !isNaN(date.getTime());
}

/**
 * Parses date filter parameters and returns Prisma-compatible filter conditions.
 *
 * @param createdAt - Filter for createdAt on or after this date
 * @param createdBefore - Filter for createdAt before this date
 * @param updatedAt - Filter for updatedAt on or after this date
 * @param updatedBefore - Filter for updatedAt before this date
 * @returns Object with createdAt and updatedAt conditions for Prisma
 */
export function buildDateFilters(options: {
  createdAt?: string;
  createdBefore?: string;
  updatedAt?: string;
  updatedBefore?: string;
}): {
  createdAt?: { gte?: Date; lt?: Date };
  updatedAt?: { gte?: Date; lt?: Date };
} {
  const filters: {
    createdAt?: { gte?: Date; lt?: Date };
    updatedAt?: { gte?: Date; lt?: Date };
  } = {};

  // Build createdAt filter
  if (options.createdAt !== undefined || options.createdBefore !== undefined) {
    filters.createdAt = {};
    if (options.createdAt !== undefined) {
      filters.createdAt.gte = parseDate(options.createdAt);
    }
    if (options.createdBefore !== undefined) {
      filters.createdAt.lt = parseDate(options.createdBefore);
    }
  }

  // Build updatedAt filter
  if (options.updatedAt !== undefined || options.updatedBefore !== undefined) {
    filters.updatedAt = {};
    if (options.updatedAt !== undefined) {
      filters.updatedAt.gte = parseDate(options.updatedAt);
    }
    if (options.updatedBefore !== undefined) {
      filters.updatedAt.lt = parseDate(options.updatedBefore);
    }
  }

  return filters;
}
