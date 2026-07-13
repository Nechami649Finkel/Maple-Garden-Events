import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';
import { canEditCheckIn } from '../utils/eventStart';
import { emitBookingUpdated, emitCheckInUpdated } from '../utils/realtime';
import { calendarKeyFromDbDate } from '../utils/dateLocal';

export interface ReserveTableRow {
  number: number;
  value: string;
}

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

function calcEntertainerPortions(eventForm: {
  entertainersTotal?: number | null;
  entertainersBar?: number | null;
  entertainersSitting?: number | null;
} | null | undefined): number {
  if (!eventForm) return 0;
  if (eventForm.entertainersTotal && eventForm.entertainersTotal > 0) {
    return eventForm.entertainersTotal;
  }
  return (eventForm.entertainersBar || 0) + (eventForm.entertainersSitting || 0);
}

function defaultReserveTables(): ReserveTableRow[] {
  return [1, 2, 3, 4, 5].map((n) => ({ number: n, value: '' }));
}

function buildDefaultCheckIn(booking: {
  guestCount: number;
  clientAFullName: string;
  clientBFullName?: string | null;
  eventType?: string | null;
  clientComments?: string | null;
}, eventForm: {
  entertainersTotal?: number | null;
  entertainersBar?: number | null;
  entertainersSitting?: number | null;
  notes?: string | null;
} | null | undefined) {
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

async function getOrCreateCheckIn(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { eventForm: true, eventCheckIn: true, eventDate: true },
  });

  if (!booking) return null;

  if (booking.eventCheckIn) {
    return { booking, checkIn: booking.eventCheckIn };
  }

  const defaults = buildDefaultCheckIn(booking, booking.eventForm);
  const checkIn = await prisma.eventCheckIn.create({
    data: {
      bookingId,
      ...defaults,
      reserveTables: toPrismaJson(defaults.reserveTables),
    },
  });

  return { booking, checkIn };
}

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export const checkInController = {
  async getCheckIn(req: Request, res: Response) {
    try {
      const bookingId = paramId(req.params.bookingId);
      const result = await getOrCreateCheckIn(bookingId);
      if (!result) {
        return res.status(404).json({ error: 'הזמנה לא נמצאה' });
      }

      res.json({
        success: true,
        data: {
          checkIn: result.checkIn,
          booking: result.booking,
          eventForm: result.booking.eventForm,
        },
      });
    } catch (e) {
      console.error('getCheckIn error:', e);
      res.status(500).json({ error: 'שגיאה בטעינת טופס הקבלה' });
    }
  },

  async updateCheckIn(req: Request, res: Response) {
    try {
      const bookingId = paramId(req.params.bookingId);
      const existing = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { eventCheckIn: true, eventForm: true, eventDate: true },
      });

      if (!existing) {
        return res.status(404).json({ error: 'הזמנה לא נמצאה' });
      }

      const eventDateStr = existing.eventDate?.date
        ? calendarKeyFromDbDate(existing.eventDate.date)
        : '';
      if (
        !eventDateStr
        || !canEditCheckIn(eventDateStr, existing, existing.eventForm)
      ) {
        return res.status(403).json({
          error: 'ניתן לערוך את טופס קבלת האולם רק במהלך האירוע',
        });
      }

      const body = req.body || {};
      const data: Record<string, unknown> = {};

      if (body.familiesLabel !== undefined) data.familiesLabel = body.familiesLabel;
      if (body.orderedPortions !== undefined) data.orderedPortions = Number(body.orderedPortions);
      if (body.entertainerPortions !== undefined) data.entertainerPortions = Number(body.entertainerPortions);
      if (body.reservePortions !== undefined) data.reservePortions = Number(body.reservePortions);
      if (body.hallReceivedConfirmed !== undefined) data.hallReceivedConfirmed = Boolean(body.hallReceivedConfirmed);
      if (body.reserveTables !== undefined) {
        data.reserveTables = toPrismaJson(body.reserveTables);
      }
      if (body.specialAdditions !== undefined) data.specialAdditions = body.specialAdditions;
      if (body.customerSignature !== undefined) data.customerSignature = body.customerSignature;

      const signature =
        data.customerSignature !== undefined
          ? data.customerSignature
          : existing.eventCheckIn?.customerSignature;
      if (typeof signature !== 'string' || !signature.trim()) {
        return res.status(400).json({ error: 'חובה לחתום לפני שמירת הטופס' });
      }

      let checkIn;
      if (existing.eventCheckIn) {
        checkIn = await prisma.eventCheckIn.update({
          where: { bookingId },
          data,
        });
      } else {
        const defaults = buildDefaultCheckIn(existing, existing.eventForm);
        checkIn = await prisma.eventCheckIn.create({
          data: {
            bookingId,
            ...defaults,
            ...data,
            reserveTables: toPrismaJson(data.reserveTables ?? defaults.reserveTables),
          },
        });
      }

      emitBookingUpdated(bookingId);
      emitCheckInUpdated(bookingId);
      res.json({ success: true, data: checkIn });
    } catch (e) {
      console.error('updateCheckIn error:', e);
      res.status(500).json({ error: 'שגיאה בשמירת טופס הקבלה' });
    }
  },
};
