import { apiFetch } from '../services/api';
import { API_URL } from '../config/api';
import { type TimeSlot, normalizeTimeSlot } from './timeSlot';
import { validateOptionDateSelection } from './optionDateValidation';

export type OptionDateItem = { date: string; hebrewDate?: string };

export function normalizeOptionDate(d: string | OptionDateItem): OptionDateItem {
  if (typeof d === 'object' && d?.date) return d;
  return { date: String(d), hebrewDate: '' };
}

/** Day payload from GET /api/calendar/dates */
export type CalendarDayApi = {
  date: string;
  hebrewDate?: string;
  status?: string;
  reason?: string | null;
  bookings?: Array<{
    timeOfDay?: string | null;
    isOption?: boolean;
  }>;
  blockedSlots?: string[];
};

export function getEventTypeFilter(eventType: string): string {
  return eventType === 'חתונה' || eventType === 'אירוסין' ? 'חתונה' : 'אירוע אחר';
}

export async function fetchCalendarDays(
  start: string,
  end: string,
  eventType: string
): Promise<CalendarDayApi[]> {
  const filter = getEventTypeFilter(eventType);
  const res = await apiFetch(
    `${API_URL}/calendar/dates?start=${start}&end=${end}&eventType=${filter}`
  );
  if (!res.ok) throw new Error('fetch failed');
  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];
  return data as CalendarDayApi[];
}

function getHebrewDateLabel(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric', month: 'long' }).format(
      new Date(dateStr + 'T12:00:00')
    );
  } catch {
    return '';
  }
}

export async function resolveOptionDate(
  date: string,
  eventType: string,
  excludeDates: string[],
  timeSlot: TimeSlot | string | null | undefined
): Promise<{ ok: true; item: OptionDateItem } | { ok: false; error: string }> {
  const slot = normalizeTimeSlot(typeof timeSlot === 'string' ? timeSlot : null);
  if (!slot) {
    return { ok: false, error: 'יש לבחור זמן ביום (בוקר / צהריים / ערב) לפני הוספת תאריך.' };
  }

  const localError = validateOptionDateSelection(date, undefined, slot, excludeDates);
  if (localError) return { ok: false, error: localError };

  try {
    const filter = getEventTypeFilter(eventType);
    const res = await apiFetch(
      `${API_URL}/calendar/dates?start=${date}&end=${date}&eventType=${filter}`
    );
    if (!res.ok) {
      return { ok: false, error: 'לא ניתן לוודא את התאריך — נסי שוב.' };
    }
    const data: unknown = await res.json();
    const days = Array.isArray(data) ? (data as CalendarDayApi[]) : [];
    const day = days[0];
    const serverError = validateOptionDateSelection(date, day, slot, excludeDates);
    if (serverError) return { ok: false, error: serverError };
    return {
      ok: true,
      item: { date, hebrewDate: day?.hebrewDate || getHebrewDateLabel(date) },
    };
  } catch {
    return { ok: false, error: 'שגיאת חיבור — לא ניתן לאמת את התאריך.' };
  }
}

export async function verifyAllOptionDates(
  dates: OptionDateItem[],
  eventType: string,
  timeSlot: TimeSlot | string | null | undefined
): Promise<{ ok: true; dates: OptionDateItem[] } | { ok: false; error: string }> {
  const slot = normalizeTimeSlot(typeof timeSlot === 'string' ? timeSlot : null);
  if (!slot) {
    return { ok: false, error: 'יש לבחור זמן ביום (בוקר / צהריים / ערב).' };
  }

  const verified: OptionDateItem[] = [];
  for (const item of dates) {
    const exclude = dates.filter(d => d.date !== item.date).map(d => d.date);
    const result = await resolveOptionDate(item.date, eventType, exclude, slot);
    if (!result.ok) {
      return { ok: false, error: `${item.date.split('-').reverse().join('/')}: ${result.error}` };
    }
    verified.push(result.item);
  }
  return { ok: true, dates: verified };
}
