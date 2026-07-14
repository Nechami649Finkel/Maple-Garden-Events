import { Response } from 'express';
import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';
import { isFloorStaffRole } from '../config/rbac';
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

const BOOKING_SENSITIVE_KEYS = [
  'clientAIdNumber',
  'clientAPhone',
  'clientAEmail',
  'clientAAddress',
  'clientBIdNumber',
  'clientBPhone',
  'clientBEmail',
  'clientBAddress',
  'finalPricePortion',
  'totalPrice',
  'basePrice',
  'extrasPrice',
  'externalExtrasPrice',
  'liveAdditionsTotal',
  'hallRentalPrice',
  'paidAmount',
  'paymentStatus',
  'advancePaid',
  'totalPaid',
  'depositPaid',
  'depositMethod',
  'depositCheckUrl',
  'depositCheckDetails',
  'clientSignatureUrl',
  'securityCheckUrl',
  'securityCheckStatus',
  'contractText',
  'paymentTermsText',
  'paymentDeadline',
  'paymentTemplateId',
  'lastPaymentReminderSent',
  'easycountDocId',
  'easycountDocUrl',
  'easycountStatus',
  'easycountError',
  'managerComments',
  'akumApprovalCode',
] as const;

const EVENT_FORM_SENSITIVE_KEYS = [
  'depositCheckUrl',
  'depositCheckDetails',
  'pricePerPortion',
  'kashrutSurcharge',
  'designPrice',
  'extrasJson',
  'totalPrice',
  'akumCode',
  'akumPaid',
] as const;

function omitKeys<T extends Record<string, unknown>>(
  source: T,
  keys: readonly string[],
): Record<string, unknown> {
  const omitted = new Set(keys);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!omitted.has(key)) result[key] = value;
  }
  return result;
}

/** Strip PII, pricing, and signature fields for floor_staff responses. */
function sanitizeCheckInPayloadForFloorStaff(payload: {
  checkIn: Record<string, unknown>;
  booking: Record<string, unknown>;
  eventForm: Record<string, unknown> | null;
}) {
  const { customerSignature: _signature, ...safeCheckIn } = payload.checkIn;
  const bookingWithoutNested = { ...payload.booking };
  delete bookingWithoutNested.eventForm;
  delete bookingWithoutNested.eventCheckIn;

  return {
    checkIn: safeCheckIn,
    booking: omitKeys(bookingWithoutNested, BOOKING_SENSITIVE_KEYS),
    eventForm: payload.eventForm
      ? omitKeys(payload.eventForm, EVENT_FORM_SENSITIVE_KEYS)
      : null,
  };
}

function assertFloorStaffSameDayAccess(
  booking: {
    timeOfDay?: string | null;
    eventForm?: { eventTime?: string | null } | null;
    eventDate?: { date: Date } | null;
  },
): { ok: true } | { ok: false; status: number; error: string } {
  const eventDateStr = booking.eventDate?.date
    ? calendarKeyFromDbDate(booking.eventDate.date)
    : '';
  if (
    !eventDateStr
    || !canEditCheckIn(eventDateStr, booking, booking.eventForm)
  ) {
    return {
      ok: false,
      status: 403,
      error: 'צוות קבלה יכול לגשת לטופס הקבלה רק ביום האירוע ובמהלכו',
    };
  }
  return { ok: true };
}

export const checkInController = {
  async getCheckIn(req: AuthRequest, res: Response) {
    try {
      const bookingId = paramId(req.params.bookingId);
      const result = await getOrCreateCheckIn(bookingId);
      if (!result) {
        return res.status(404).json({ error: 'הזמנה לא נמצאה' });
      }

      const role = req.user?.role;
      if (isFloorStaffRole(role)) {
        const access = assertFloorStaffSameDayAccess(result.booking);
        if (!access.ok) {
          return res.status(access.status).json({ error: access.error });
        }
      }

      const payload = {
        checkIn: result.checkIn as unknown as Record<string, unknown>,
        booking: result.booking as unknown as Record<string, unknown>,
        eventForm: (result.booking.eventForm as unknown as Record<string, unknown> | null) ?? null,
      };

      res.json({
        success: true,
        data: isFloorStaffRole(role)
          ? sanitizeCheckInPayloadForFloorStaff(payload)
          : {
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

  async updateCheckIn(req: AuthRequest, res: Response) {
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

      if (isFloorStaffRole(req.user?.role)) {
        const { customerSignature: _sig, ...safeCheckIn } = checkIn as unknown as Record<string, unknown>;
        return res.json({ success: true, data: safeCheckIn });
      }

      res.json({ success: true, data: checkIn });
    } catch (e) {
      console.error('updateCheckIn error:', e);
      res.status(500).json({ error: 'שגיאה בשמירת טופס הקבלה' });
    }
  },
};
