/**
 * נעילת שורת EventDate (FOR UPDATE) ואימות משבצת זמן לאחר הנעילה —
 * מונע TOCTOU / double-booking תחת עומס מקביל.
 */

import prisma from '../config/prisma';
import { validateSlotAvailability } from './bookingDateValidation';
import {
  getBookableSlotsForDate,
  getTakenSlots,
  normalizeTimeSlot,
  parseDateLocal,
  validateSlotOnDate,
  SLOT_LABELS,
  type TimeSlot,
} from './timeSlot';

export type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export class HttpError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

/** נעילה פessimistic ברמת שורת EventDate — חוסמת בקשות מקבילות עד commit/rollback */
export async function lockEventDateRow(tx: TxClient, eventDateId: string): Promise<void> {
  await tx.$executeRaw`SELECT id FROM "EventDate" WHERE id = ${eventDateId} FOR UPDATE`;
}

type BookingRow = {
  isOption?: boolean;
  timeOfDay?: string | null;
  timeSlot?: string | null;
};

export function slotTakenMessage(
  slot: TimeSlot,
  bookings: BookingRow[],
): string {
  const optionHeld = bookings.some(
    (b) => b.isOption && normalizeTimeSlot(b.timeOfDay) === slot,
  );
  if (optionHeld) {
    return `משבצת ${SLOT_LABELS[slot]} תפוסה על ידי אופציה.`;
  }
  return `כבר קיים אירוע ב${SLOT_LABELS[slot]} בתאריך זה.`;
}

/**
 * מאמת זמינות משבצת **אחרי** FOR UPDATE.
 * אם המשבצת נתפסה על ידי transaction מקביל — זורק 409 Conflict.
 */
export function assertSlotAvailableAfterLock(
  calendarKey: string,
  slot: TimeSlot,
  bookings: BookingRow[],
  eventType: string,
  options?: { isOption?: boolean; optionConflictMessage?: string },
): void {
  const slotError = validateSlotOnDate(parseDateLocal(calendarKey), slot);
  if (slotError) {
    throw new HttpError(slotError, 400);
  }

  const availabilityError = validateSlotAvailability(
    parseDateLocal(calendarKey),
    slot,
    bookings,
    eventType,
    options?.isOption ? { blockShabbatEntirely: true } : undefined,
  );
  if (availabilityError) {
    const taken = getTakenSlots(bookings);
    throw new HttpError(availabilityError, taken.has(slot) ? 409 : 400);
  }

  const bookableSlots = getBookableSlotsForDate(parseDateLocal(calendarKey), bookings);
  if (!bookableSlots.includes(slot)) {
    const taken = getTakenSlots(bookings);
    const message = taken.has(slot)
      ? (options?.optionConflictMessage ?? slotTakenMessage(slot, bookings))
      : (validateSlotOnDate(parseDateLocal(calendarKey), slot) || 'התאריך מלא — אין משבצות זמן פנויות.');
    throw new HttpError(message, taken.has(slot) ? 409 : 400);
  }
}

/** שליפת EventDate + bookings לאחר נעילה */
export async function getLockedEventDateWithBookings(tx: TxClient, eventDateId: string) {
  await lockEventDateRow(tx, eventDateId);
  return tx.eventDate.findUnique({
    where: { id: eventDateId },
    include: { bookings: true },
  });
}
