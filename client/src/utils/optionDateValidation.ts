import { T, type TranslationKey, type TranslationParams } from '@shared/i18n';
import {
  type TimeSlot,
  getBlockedSlotsForDate,
  getBookableSlotsForDate,
  getTakenSlots,
  normalizeTimeSlot,
  formatSlotLabel,
} from './timeSlot';

type OptionDayBooking = {
  timeOfDay?: string | null;
  isOption?: boolean;
};

export type ValidationError = {
  key: TranslationKey;
  params?: TranslationParams;
};

function formatDateLocal(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function validateSlotOnDate(dateStr: string, slot: TimeSlot): ValidationError | null {
  const blocked = getBlockedSlotsForDate(dateStr);
  if (blocked.includes(slot)) {
    const jsDay = new Date(`${dateStr}T12:00:00`).getDay();
    if (jsDay === 5) return { key: T.VALIDATION.FRIDAY_MORNING_ONLY };
    if (jsDay === 6) return { key: T.VALIDATION.NO_OPTION_SHABBAT };
    return {
      key: T.VALIDATION.SLOT_UNAVAILABLE,
      params: { slot: slot },
    };
  }
  return null;
}

function slotConflictMessage(slot: TimeSlot, bookings: OptionDayBooking[]): ValidationError {
  const optionHeld = bookings.some(
    (b) => b.isOption && normalizeTimeSlot(b.timeOfDay) === slot,
  );
  if (optionHeld) {
    return {
      key: T.VALIDATION.SLOT_OPTION_HELD,
      params: { slot },
    };
  }
  return {
    key: T.VALIDATION.SLOT_BOOKED,
    params: { slot },
  };
}

export function formatValidationError(
  translate: (key: TranslationKey, params?: TranslationParams) => string,
  error: ValidationError,
): string {
  const params = error.params?.slot
    ? { ...error.params, slot: formatSlotLabel(translate, error.params.slot as TimeSlot) }
    : error.params;
  return translate(error.key, params);
}

export function validateOptionDateSelection(
  dateStr: string,
  dayData: { status?: string; bookings?: OptionDayBooking[]; reason?: string | null } | undefined,
  slot: TimeSlot,
  excludeDates: string[] = [],
): ValidationError | null {
  const todayStr = formatDateLocal(new Date());
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { key: T.VALIDATION.INVALID_DATE };
  }
  if (dateStr < todayStr) return { key: T.VALIDATION.PAST_DATE };
  if (excludeDates.includes(dateStr)) return { key: T.VALIDATION.DATE_ALREADY_SELECTED };

  const jsDay = new Date(`${dateStr}T12:00:00`).getDay();
  if (jsDay === 6) return { key: T.VALIDATION.NO_OPTION_SHABBAT };

  const status = dayData?.status ?? 'AVAILABLE';
  if (status === 'BLOCKED' || status === 'FORBIDDEN') {
    return dayData?.reason
      ? { key: T.VALIDATION.FORBIDDEN_DATE, params: { reason: dayData.reason } }
      : { key: T.VALIDATION.DATE_BLOCKED };
  }

  const slotError = validateSlotOnDate(dateStr, slot);
  if (slotError) return slotError;

  if (dayData) {
    const bookings = dayData.bookings ?? [];
    const bookable = getBookableSlotsForDate(dateStr, bookings);
    if (bookable.length === 0) {
      return { key: T.VALIDATION.DATE_FULL };
    }
    if (!bookable.includes(slot)) {
      const taken = getTakenSlots(bookings);
      if (taken.has(slot)) {
        return slotConflictMessage(slot, bookings);
      }
      return { key: T.VALIDATION.SLOT_UNAVAILABLE, params: { slot } };
    }
  }

  return null;
}
