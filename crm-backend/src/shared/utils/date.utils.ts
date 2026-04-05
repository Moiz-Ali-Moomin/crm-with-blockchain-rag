/**
 * Date Utilities
 *
 * Pure date/time helpers with no external dependencies.
 * No NestJS imports — safe to use in workers, scripts, and tests.
 *
 * Used by:
 *  - TasksService: due date calculations for automation-created tasks
 *  - ReportsService: date range generation for analytics queries
 *  - Any module that needs relative date arithmetic
 */

/** Adds a number of days to a date and returns a new Date (does not mutate). */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Adds a number of hours to a date and returns a new Date. */
export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/** Adds a number of minutes to a date and returns a new Date. */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Returns a Date that is `days` days from now.
 * Convenience wrapper for automation action executor.
 *
 * @example
 * const due = daysFromNow(7); // 7 days from now
 */
export function daysFromNow(days: number): Date {
  return addDays(new Date(), days);
}

/** Returns the start of a day (00:00:00.000) in UTC. */
export function startOfDayUtc(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Returns the end of a day (23:59:59.999) in UTC. */
export function endOfDayUtc(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/** Returns a [startDate, endDate] tuple for the past N days (inclusive). */
export function lastNDays(n: number): [Date, Date] {
  const end = endOfDayUtc(new Date());
  const start = startOfDayUtc(addDays(new Date(), -(n - 1)));
  return [start, end];
}

/** Returns true if the given date is in the past. */
export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}

/** Returns true if the given date is today (in UTC). */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getUTCFullYear() === today.getUTCFullYear() &&
    date.getUTCMonth() === today.getUTCMonth() &&
    date.getUTCDate() === today.getUTCDate()
  );
}

/** Formats a duration in milliseconds to a human-readable string (e.g. "2h 15m"). */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

/** Returns the ISO week number (1–53) for a given date. */
export function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
