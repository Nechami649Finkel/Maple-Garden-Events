import { getDayStaticStatus, EventStatus } from '../Services/calendar.service';
import {
  normalizeTimeSlot,
  getTakenSlots,
  validateSlotOnDate,
  parseDateLocal,
  type TimeSlot,
  SLOT_LABELS,
} from './timeSlot';

export function isDateForbiddenForBooking(date: Date, eventType: string): string | null {
  const { type, reason } = getDayStaticStatus(date, eventType || 'חתונה');
  if (type === EventStatus.FORBIDDEN) {
    return reason ? `תאריך אסור: ${reason}` : 'תאריך אסור לאירוע (חג/צום).';
  }
  if (type === EventStatus.BLOCKED) {
    return reason ? `תאריך חסום: ${reason}` : 'התאריך חסום בלוח.';
  }
  return null;
}

export function validateSlotAvailability(
  date: Date,
  slot: TimeSlot,
  bookings: { timeOfDay?: string | null }[],
  eventType: string,
  options?: { blockShabbatEntirely?: boolean }
): string | null {
  if (options?.blockShabbatEntirely && date.getDay() === 6) {
    return 'לא ניתן לשמור אופציה בשבת.';
  }

  const forbidden = isDateForbiddenForBooking(date, eventType);
  if (forbidden) return forbidden;

  const slotError = validateSlotOnDate(date, slot);
  if (slotError) return slotError;

  const taken = getTakenSlots(bookings);
  if (taken.has(slot)) {
    return `כבר קיים אירוע ב${SLOT_LABELS[slot]} בתאריך זה.`;
  }
  return null;
}

export function resolveBookingSlot(
  timeOfDay?: string | null,
  startTime?: string | null,
  endTime?: string | null,
  isOption?: boolean
): TimeSlot | null {
  return normalizeTimeSlot(timeOfDay, startTime, endTime) || (isOption ? 'evening' : null);
}
