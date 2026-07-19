import { apiFetch } from '../services/api';
import { API_URL } from '../config/api';
import { type TimeSlot, normalizeTimeSlot } from './timeSlot';
import {
  validateOptionDateSelection,
  formatValidationError,
  type ValidationError,
} from './optionDateValidation';
import { T, type TranslationKey, type TranslationParams } from '@shared/i18n';

export type OptionDateItem = { date: string; hebrewDate?: string };

type TranslateFn = (key: TranslationKey, params?: TranslationParams) => string;

export function getEventTypeFilter(eventType: string): string {
  return eventType === 'חתונה' || eventType === 'אירוסין' ? 'חתונה' : 'אירוע אחר';
}

export async function fetchCalendarDays(
  start: string,
  end: string,
  eventType: string,
): Promise<any[]> {
  const filter = getEventTypeFilter(eventType);
  const res = await apiFetch(
    `${API_URL}/calendar/dates?start=${start}&end=${end}&eventType=${filter}`,
  );
  if (!res.ok) throw new Error('fetch failed');
  return res.json();
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
    const data = await res.json();
    const day = data?.[0];
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
