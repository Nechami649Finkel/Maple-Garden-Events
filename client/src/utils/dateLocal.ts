/**
 * Client-side calendar-day helpers (browser local timezone).
 * Mirrors server/src/utils/dateLocal.ts — keep logic aligned.
 */

export const CALENDAR_DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDateKey(value: string): boolean {
  return CALENDAR_DATE_KEY_RE.test(value.trim());
}

function formatDateParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function toCalendarDateKey(input: string | Date): string {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (isCalendarDateKey(trimmed)) return trimmed;

    const isoPrefix = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoPrefix) return isoPrefix[1];

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid date input: ${input}`);
    }
    return formatDateParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }

  return formatDateParts(input.getFullYear(), input.getMonth() + 1, input.getDate());
}

export function parseCalendarDate(input: string | Date): Date {
  const key = toCalendarDateKey(input);
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function localStartOfDay(input: string | Date): Date {
  const key = toCalendarDateKey(input);
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function localEndOfDay(input: string | Date): Date {
  const key = toCalendarDateKey(input);
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

export function calendarKeyFromDbDate(dbDate: Date): string {
  return toCalendarDateKey(dbDate);
}

/** Today's calendar key in local timezone — safe at 23:59. */
export function todayCalendarKey(now: Date = new Date()): string {
  return toCalendarDateKey(now);
}
