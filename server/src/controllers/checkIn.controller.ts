import { Response } from 'express';
import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';
import { isFloorStaffRole } from '../config/rbac';
import { canEditCheckIn } from '../utils/eventStart';
import { emitBookingUpdated, emitCheckInUpdated } from '../utils/realtime';
import { calendarKeyFromDbDate } from '../utils/dateLocal';
import { ForbiddenError, NotFoundError } from '../utils/httpErrors';
import { sanitizeFloorStaffData } from '../utils/sanitizeFloorStaffData';
import {
  buildDefaultCheckIn,
  getOrCreateCheckIn,
  validateFloorStaffAccess,
} from '../Services/checkInService';
import { logger } from '../utils/logger';

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function mapDomainError(res: Response, err: unknown): boolean {
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
        preloadedBooking = await validateFloorStaffAccess(req.user, bookingId);
      }

      const result = await getOrCreateCheckIn(bookingId, preloadedBooking);

      if (isFloorStaffRole(role)) {
        return res.json({
          success: true,
          data: sanitizeFloorStaffData(result.booking, result.checkIn),
        });
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
      if (mapDomainError(res, e)) return;
      logger.error('getCheckIn error', { error: e });
      res.status(500).json({ error: 'שגיאה בטעינת טופס הקבלה' });
    }
  },

  async updateCheckIn(req: AuthRequest, res: Response) {
    try {
      const bookingId = paramId(req.params.bookingId);
      const existing = await prisma.booking.findFirst({
        where: { id: bookingId,
            tenantId: tenantId
        },
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
        checkIn = await prisma.eventCheckIn.updateMany({
          where: { bookingId,
              tenantId: tenantId
        },
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
                tenantId: tenantId
            },
          });
        } catch (err) {
          if (
            err instanceof Prisma.PrismaClientKnownRequestError
            && err.code === 'P2002'
          ) {
            checkIn = await prisma.eventCheckIn.updateMany({
              where: { bookingId,
                  tenantId: tenantId
            },
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
        return res.json({
          success: true,
          data: sanitizeFloorStaffData(existing, checkIn),
        });
      }

      res.json({ success: true, data: checkIn });
    } catch (e) {
      if (mapDomainError(res, e)) return;
      logger.error('updateCheckIn error', { error: e });
      res.status(500).json({ error: 'שגיאה בשמירת טופס הקבלה' });
    }
  },
};
