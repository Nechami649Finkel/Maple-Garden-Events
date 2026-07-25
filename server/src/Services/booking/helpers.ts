/**
 * Shared booking helpers used across lifecycle / options services.
 */

import prisma from '../../config/prisma';
import { localStartOfDay } from '../../utils/dateLocal';
import {
  normalizeTimeSlot,
  SLOT_LABELS,
  type TimeSlot,
} from '../../utils/timeSlot';
import { isHallOnlyBooking } from '../../validators/booking.validator';
import type { TxClient } from '../../utils/eventDateLock';

export function canEditBookingDate(eventDate: Date): boolean {
  const today = localStartOfDay(new Date());
  const eventDay = localStartOfDay(eventDate);
  return today < eventDay;
}

export function isPastCalendarDate(eventDate: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDay = new Date(eventDate);
  eventDay.setHours(0, 0, 0, 0);
  return eventDay < today;
}

export async function releaseOptionDateInTx(tx: TxClient, dateId: string) {
  await tx.booking.deleteMany({ where: { calendarDateId: dateId } });
  await tx.eventDate.update({
    where: { id: dateId },
    data: {
      status: 'AVAILABLE',
      optionExpiresAt: null,
      lockedBy: null,
      clientName: null,
      clientPhone: null,
      clientEmail: null,
    },
  });
}

export function hasOptionBookings(bookings: { isOption?: boolean }[]): boolean {
  return bookings.some((b) => b.isOption === true);
}

/** מסנכרן EventDate עם הזמנות אופציה — status ו-optionExpiresAt */
export async function syncEventDateWithOptionBookings(
  tx: TxClient | typeof prisma,
  eventDateId: string,
): Promise<void> {
  const eventDate = await tx.eventDate.findUnique({
    where: { id: eventDateId },
    include: { bookings: true },
  });
  if (!eventDate) return;

  const optionBookings = eventDate.bookings.filter((b) => b.isOption);
  const confirmedBookings = eventDate.bookings.filter((b) => !b.isOption);

  if (optionBookings.length === 0) return;

  const updatePayload: { status?: string; optionExpiresAt?: Date } = {};

  if (confirmedBookings.length === 0 && eventDate.status !== 'OPTION') {
    updatePayload.status = 'OPTION';
  }

  if (!eventDate.optionExpiresAt) {
    const hours = optionBookings[0].optionDurationHours ?? 48;
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + hours);
    updatePayload.optionExpiresAt = expiry;
  }

  if (Object.keys(updatePayload).length > 0) {
    await tx.eventDate.update({
      where: { id: eventDateId },
      data: updatePayload,
    });
  }
}

export async function syncDesyncedOptionDates(): Promise<void> {
  const desynced = await prisma.booking.findMany({
    where: {
      isOption: true,
      eventDate: {
        OR: [{ status: { not: 'OPTION' } }, { optionExpiresAt: null }],
      },
    },
    select: { calendarDateId: true },
    distinct: ['calendarDateId'],
  });

  for (const { calendarDateId } of desynced) {
    await syncEventDateWithOptionBookings(prisma, calendarDateId);
  }
}

export function slotConflictMessage(
  slot: TimeSlot,
  bookings: { isOption?: boolean; timeOfDay?: string | null }[],
): string {
  const optionHeld = bookings.some(
    (b) => b.isOption && normalizeTimeSlot(b.timeOfDay) === slot,
  );
  if (optionHeld) {
    return `משבצת ${SLOT_LABELS[slot]} תפוסה על ידי אופציה. לחצי "סגירת אירוע במקום האופציה" בלוח השנה.`;
  }
  return `כבר קיים אירוע ב${SLOT_LABELS[slot]} בתאריך זה.`;
}

export function validateHallRentalPriceInput(data: {
  eventType?: string;
  hallRentalPrice?: unknown;
}): string | null {
  if (!isHallOnlyBooking(data)) return null;
  const raw = data.hallRentalPrice;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return 'יש להזין מחיר השכרת אולם';
  }
  const price = Number(raw);
  if (!Number.isFinite(price)) return 'מחיר השכרת אולם חייב להיות מספר תקין';
  if (price <= 0) return 'מחיר השכרת אולם חייב להיות גדול מ-0';
  return null;
}
