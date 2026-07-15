import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { isFloorStaffRole } from '../config/rbac';
import { canEditCheckIn } from '../utils/eventStart';
import { calendarKeyFromDbDate } from '../utils/dateLocal';
import { ForbiddenError, NotFoundError } from '../utils/httpErrors';

export type CheckInBooking = Prisma.BookingGetPayload<{
  include: { eventForm: true; eventDate: true };
}>;

export type ReserveTableRow = { number: number; value: string };

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

function getLastName(fullName?: string | null): string {
  if (!fullName?.trim()) return '';
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] || '';
}

function buildFamiliesLabel(booking: {
  clientAFullName: string;
  clientBFullName?: string | null;
  eventType?: string | null;
}): string {
  const nameA = getLastName(booking.clientAFullName);
  const nameB = getLastName(booking.clientBFullName);
  if (booking.eventType === 'חתונה' && nameB) {
    return `משפחת ${nameA} ומשפחת ${nameB}`;
  }
  if (nameB) return `${booking.clientAFullName} ו${booking.clientBFullName}`;
  return nameA ? `משפחת ${nameA}` : booking.clientAFullName;
}

function calcReservePortions(guestCount: number): number {
  if (!Number.isFinite(guestCount) || guestCount <= 0) return 0;
  return Math.ceil(guestCount * 0.1);
}

/** Portions for entertainers — sum of schema fields (bar / sitting). */
function calcEntertainerPortions(eventForm: {
  entertainersBar?: number | null;
  entertainersSitting?: number | null;
  entertainersMen?: number | null;
  entertainersWomen?: number | null;
} | null | undefined): number {
  if (!eventForm) return 0;
  const byType =
    (eventForm.entertainersBar || 0) + (eventForm.entertainersSitting || 0);
  if (byType > 0) return byType;
  // Fallback when only gender split was filled
  return (eventForm.entertainersMen || 0) + (eventForm.entertainersWomen || 0);
}

function defaultReserveTables(): ReserveTableRow[] {
  return [1, 2, 3, 4, 5].map((n) => ({ number: n, value: '' }));
}

export function buildDefaultCheckIn(
  booking: {
    guestCount: number;
    clientAFullName: string;
    clientBFullName?: string | null;
    eventType?: string | null;
    clientComments?: string | null;
  },
  eventForm: {
    entertainersBar?: number | null;
    entertainersSitting?: number | null;
    entertainersMen?: number | null;
    entertainersWomen?: number | null;
    notes?: string | null;
  } | null | undefined,
) {
  const specialParts: string[] = [];
  if (eventForm?.notes?.trim()) specialParts.push(eventForm.notes.trim());
  if (booking.clientComments?.trim()) specialParts.push(booking.clientComments.trim());

  return {
    familiesLabel: buildFamiliesLabel(booking),
    orderedPortions: booking.guestCount,
    entertainerPortions: calcEntertainerPortions(eventForm),
    reservePortions: calcReservePortions(booking.guestCount),
    hallReceivedConfirmed: false,
    reserveTables: defaultReserveTables(),
    specialAdditions: specialParts.join('\n') || null,
    customerSignature: null,
  };
}

/**
 * Floor staff only: must be live-event day window for this booking.
 * Fail-closed — throws ForbiddenError / NotFoundError before any check-in write.
 */
export async function validateFloorStaffAccess(
  user: { role?: string } | null | undefined,
  bookingId: string,
): Promise<CheckInBooking> {
  if (!isFloorStaffRole(user?.role)) {
    throw new ForbiddenError('גישה לטופס קבלה מוגבלת לצוות קבלה בלבד בפעולה זו');
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { eventForm: true, eventDate: true },
  });

  if (!booking) {
    throw new NotFoundError('הזמנה לא נמצאה');
  }

  const eventDateStr = booking.eventDate?.date
    ? calendarKeyFromDbDate(booking.eventDate.date)
    : '';

  if (!eventDateStr || !canEditCheckIn(eventDateStr, booking, booking.eventForm)) {
    throw new ForbiddenError(
      'צוות קבלה יכול לגשת לטופס הקבלה רק ביום האירוע ובמהלכו',
    );
  }

  return booking;
}

/**
 * Race-safe get-or-create: findUnique → create → on P2002 re-findUnique.
 * Pass `preloadedBooking` when the gate already loaded the booking (avoids extra query).
 */
export async function getOrCreateCheckIn(
  bookingId: string,
  preloadedBooking?: CheckInBooking | null,
) {
  const booking =
    preloadedBooking
    ?? await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { eventForm: true, eventDate: true },
    });

  if (!booking) {
    throw new NotFoundError('הזמנה לא נמצאה');
  }

  const existing = await prisma.eventCheckIn.findUnique({
    where: { bookingId },
  });
  if (existing) {
    return { booking, checkIn: existing };
  }

  const defaults = buildDefaultCheckIn(booking, booking.eventForm);

  try {
    const checkIn = await prisma.eventCheckIn.create({
      data: {
        bookingId,
        ...defaults,
        reserveTables: toPrismaJson(defaults.reserveTables),
      },
    });
    return { booking, checkIn };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError
      && err.code === 'P2002'
    ) {
      const raced = await prisma.eventCheckIn.findUnique({ where: { bookingId } });
      if (raced) return { booking, checkIn: raced };
    }
    throw err;
  }
}
