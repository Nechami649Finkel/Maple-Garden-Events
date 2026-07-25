/**
 * Calendar-day date handling for Israel-local civil dates.
 *
 * Rule: YYYY-MM-DD is a calendar label, not a UTC instant.
 * Never use `new Date("YYYY-MM-DD")` (UTC midnight) or `toISOString().split("T")[0]`.
 */

export const CALENDAR_DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDateKey(value: string): boolean {
  return CALENDAR_DATE_KEY_RE.test(value.trim());
}

function formatDateParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Normalize any input to ISO calendar key YYYY-MM-DD in the local civil calendar. */
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

/**
 * Parse a calendar key to a Date anchored at local noon.
 * Noon avoids DST edge cases and keeps getDay() stable.
 */
export function parseCalendarDate(input: string | Date): Date {
  const key = toCalendarDateKey(input);
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/** Local start of civil day (00:00:00.000). */
export function localStartOfDay(input: string | Date): Date {
  const key = toCalendarDateKey(input);
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/** Local end of civil day (23:59:59.999). */
export function localEndOfDay(input: string | Date): Date {
  const key = toCalendarDateKey(input);
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

export function calendarDayBounds(input: string | Date): { start: Date; end: Date } {
  return {
    start: localStartOfDay(input),
    end: localEndOfDay(input),
  };
}

/** Canonical DateTime to store in Prisma EventDate.date. */
export function calendarDateForStorage(calendarKey: string): Date {
  return parseCalendarDate(calendarKey);
}

/** Prisma filter: match any EventDate row on the same civil day. */
export function prismaCalendarDayWhere(calendarKey: string) {
  const { start, end } = calendarDayBounds(calendarKey);
  return {
    date: {
      gte: start,
      lte: end,
    },
  };
}

/** Read a Date from DB back to YYYY-MM-DD — never use toISOString().split('T')[0]. */
export function calendarKeyFromDbDate(dbDate: Date): string {
  return toCalendarDateKey(dbDate);
}

/** Shift a civil calendar day by `deltaDays` (can be negative). */
export function addCalendarDays(input: string | Date, deltaDays: number): Date {
  const base = parseCalendarDate(input);
  base.setDate(base.getDate() + deltaDays);
  return base;
}
