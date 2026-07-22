import { apiFetch } from '../services/api';
import { API_URL } from '../config/api';
import { type EventFormTime } from './eventStart';
import { type TimeSlot, normalizeTimeSlot } from './timeSlot';
import {
  validateOptionDateSelection,
  formatValidationError,
  type ValidationError,
} from './optionDateValidation';
import { T, type TranslationKey, type TranslationParams } from '@shared/i18n';

export type OptionDateItem = { date: string; hebrewDate?: string };

export function normalizeOptionDate(d: string | OptionDateItem): OptionDateItem {
  if (typeof d === 'object' && d?.date) return d;
  return { date: String(d), hebrewDate: '' };
}

/** Booking summary embedded in calendar day cells */
export type CalendarBookingApi = {
  id?: string;
  timeOfDay?: string | null;
  isOption?: boolean;
  clientAFullName?: string;
  clientBFullName?: string;
  eventType?: string;
  eventForm?: EventFormTime | null;
  eventCode?: string;
  paidAmount?: number;
  isContractSigned?: boolean;
  clientAIdNumber?: string;
  clientBIdNumber?: string;
  clientAPhone?: string;
  clientBPhone?: string;
  clientAEmail?: string;
  clientBEmail?: string;
  guestCount?: number | null;
  finalPricePortion?: number;
  basePrice?: number;
  totalPrice?: number;
  extrasPrice?: number;
  externalExtrasPrice?: number;
  liveAdditionsTotal?: number;
  createdBy?: string;
  clientComments?: string | null;
  managerComments?: string | null;
  clientSignatureUrl?: string | null;
};

/** Day payload from GET /api/calendar/dates */
export type CalendarDayApi = {
  id?: string | null;
  date: string;
  hebrewDate?: string;
  status?: string;
  reason?: string | null;
  candleTime?: string | null;
  lockedBy?: string | null;
  bookings?: CalendarBookingApi[];
  blockedSlots?: string[];
};

type TranslateFn = (key: TranslationKey, params?: TranslationParams) => string;

export function getEventTypeFilter(eventType: string): string {
  return eventType === 'חתונה' || eventType === 'אירוסין' ? 'חתונה' : 'אירוע אחר';
}

export async function fetchCalendarDays(
  start: string,
  end: string,
  eventType: string,
): Promise<CalendarDayApi[]> {
  const filter = getEventTypeFilter(eventType);
  const res = await apiFetch(
    `${API_URL}/calendar/dates?start=${start}&end=${end}&eventType=${filter}`,
  );
  if (!res.ok) throw new Error('fetch failed');
  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];
  return data as CalendarDayApi[];
}

function getHebrewDateLabel(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric', month: 'long' }).format(
      new Date(`${dateStr}T12:00:00`),
    );
  } catch {
    return '';
  }
}

function toErrorMessage(t: TranslateFn, error: ValidationError): string {
  return formatValidationError(t, error);
}

export async function resolveOptionDate(
  date: string,
  eventType: string,
  excludeDates: string[],
  timeSlot: TimeSlot | string | null | undefined,
  t: TranslateFn,
): Promise<{ ok: true; item: OptionDateItem } | { ok: false; error: string }> {
  const slot = normalizeTimeSlot(typeof timeSlot === 'string' ? timeSlot : null);
  if (!slot) {
    return { ok: false, error: t(T.VALIDATION.SELECT_SLOT) };
  }

  const localError = validateOptionDateSelection(date, undefined, slot, excludeDates);
  if (localError) return { ok: false, error: toErrorMessage(t, localError) };

  try {
    const filter = getEventTypeFilter(eventType);
    const res = await apiFetch(
      `${API_URL}/calendar/dates?start=${date}&end=${date}&eventType=${filter}`,
    );
    if (!res.ok) {
      return { ok: false, error: t(T.VALIDATION.VERIFY_FAILED) };
    }
    const data: unknown = await res.json();
    const days = Array.isArray(data) ? (data as CalendarDayApi[]) : [];
    const day = days[0];
    const serverError = validateOptionDateSelection(date, day, slot, excludeDates);
    if (serverError) return { ok: false, error: toErrorMessage(t, serverError) };
    return {
      ok: true,
      item: { date, hebrewDate: day?.hebrewDate || getHebrewDateLabel(date) },
    };
  } catch {
    return { ok: false, error: t(T.VALIDATION.VERIFY_CONNECTION) };
  }
}

export async function verifyAllOptionDates(
  dates: OptionDateItem[],
  eventType: string,
  timeSlot: TimeSlot | string | null | undefined,
  t: TranslateFn,
): Promise<{ ok: true; dates: OptionDateItem[] } | { ok: false; error: string }> {
  const slot = normalizeTimeSlot(typeof timeSlot === 'string' ? timeSlot : null);
  if (!slot) {
    return { ok: false, error: t(T.VALIDATION.SELECT_SLOT_SHORT) };
  }

  const verified: OptionDateItem[] = [];
  for (const item of dates) {
    const exclude = dates.filter((d) => d.date !== item.date).map((d) => d.date);
    const result = await resolveOptionDate(item.date, eventType, exclude, slot, t);
    if (!result.ok) {
      return {
        ok: false,
        error: t(T.VALIDATION.DATE_ERROR_PREFIX, {
          date: item.date.split('-').reverse().join('/'),
          error: result.error,
        }),
      };
    }
    verified.push(result.item);
  }
  return { ok: true, dates: verified };
}
