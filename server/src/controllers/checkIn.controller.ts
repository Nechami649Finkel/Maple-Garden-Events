import { Response } from 'express';
import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';
import { isFloorStaffRole } from '../config/rbac';
import { canEditCheckIn } from '../utils/eventStart';
import { emitBookingUpdated, emitCheckInUpdated } from '../utils/realtime';
import { calendarKeyFromDbDate } from '../utils/dateLocal';
import { ForbiddenError, NotFoundError } from '../utils/httpErrors';
import {
  buildDefaultCheckIn,
  getOrCreateCheckIn,
  validateFloorStaffAccess,
} from '../Services/checkInService';

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
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

function mapDomainError(res: Response, err: unknown, fallbackMessage: string): boolean {
  if (err instanceof ForbiddenError) {
    res.status(403).json({ error: err.message });
    return true;
  }
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
    return true;
  }
  return false;
}

export const checkInController = {
  async getCheckIn(req: AuthRequest, res: Response) {
    try {
      const bookingId = paramId(req.params.bookingId);
      const role = req.user?.role;

      let preloadedBooking = null;
      if (isFloorStaffRole(role)) {
        // Gate BEFORE any check-in write
        preloadedBooking = await validateFloorStaffAccess(req.user, bookingId);
      }

      const result = await getOrCreateCheckIn(bookingId, preloadedBooking);

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
      if (mapDomainError(res, e, 'שגיאה בטעינת טופס הקבלה')) return;
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
        throw new NotFoundError('הזמנה לא נמצאה');
      }

      const eventDateStr = existing.eventDate?.date
        ? calendarKeyFromDbDate(existing.eventDate.date)
        : '';
      if (
        !eventDateStr
        || !canEditCheckIn(eventDateStr, existing, existing.eventForm)
      ) {
        throw new ForbiddenError('ניתן לערוך את טופס קבלת האולם רק במהלך האירוע');
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
        try {
          checkIn = await prisma.eventCheckIn.create({
            data: {
              bookingId,
              ...defaults,
              ...data,
              reserveTables: toPrismaJson(data.reserveTables ?? defaults.reserveTables),
            },
          });
        } catch (err) {
          if (
            err instanceof Prisma.PrismaClientKnownRequestError
            && err.code === 'P2002'
          ) {
            checkIn = await prisma.eventCheckIn.update({
              where: { bookingId },
              data,
            });
          } else {
            throw err;
          }
        }
      }

      emitBookingUpdated(bookingId);
      emitCheckInUpdated(bookingId);

      if (isFloorStaffRole(req.user?.role)) {
        const { customerSignature: _sig, ...safeCheckIn } = checkIn as unknown as Record<string, unknown>;
        return res.json({ success: true, data: safeCheckIn });
      }

      res.json({ success: true, data: checkIn });
    } catch (e) {
      if (mapDomainError(res, e, 'שגיאה בשמירת טופס הקבלה')) return;
      console.error('updateCheckIn error:', e);
      res.status(500).json({ error: 'שגיאה בשמירת טופס הקבלה' });
    }
  },
};
