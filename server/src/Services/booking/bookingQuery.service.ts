import { Request } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../config/prisma';
import { mailFailureMessage, sendBumpEmail, sendOptionInterestEmail } from '../../utils/mailer';
import { sendBumpWhatsApp, sendOptionInterestWhatsApp } from '../../utils/whatsapp';
import { invalidateCache } from '../../middlewares/cacheMiddleware';
import { AuthRequest } from '../../middlewares/auth';
import { buildBookingPdfData, generateContractPDF } from '../../utils/pdfGenerator';
import { getContractText, resolveContractWithPaymentTerms, resolveDefaultPaymentTermsText } from '../../utils/getContractText';
import { resolveEffectiveUpgrades } from '../../utils/contractSections';
import { refreshBookingUpgradesAndContract } from '../../utils/bookingUpgradesSync';
import { UPGRADE_DISPLAY_ORDER } from '../../utils/pricing';
import { buildUpgradesPricingFromSettings } from '../../utils/pricing';
import { parseNotesBundle } from '../../utils/notesStorage';
import { getPaymentTemplatesFromSettings } from '../../utils/paymentTerms';
import { syncBookingPaymentMetadata } from '../paymentDeadlineService';
import { sendPDFToClient } from '../emailService';
import { notifyContractClosedViaWhatsApp } from '../whatsappDealNotify.service';
import {
  emitBookingUpdated,
  emitDateUpdated,
  emitDateUpdatedMany,
} from '../../utils/realtime';
import {
  toCalendarDateKey,
  calendarDateForStorage,
  prismaCalendarDayWhere,
  localStartOfDay,
  parseCalendarDate,
  calendarKeyFromDbDate,
} from '../../utils/dateLocal';
import { logger } from '../../utils/logger';
import {
  normalizeTimeSlot,
  formatStoredTimeOfDay,
  SLOT_LABELS,
  validateSlotOnDate,
  parseDateLocal,
  type TimeSlot,
} from '../../utils/timeSlot';
import { syncOptionDatesOnEdit } from '../../utils/optionDateSync';
import { validateClientPricing } from '../../utils/hallBilling';
import { paginationMeta, parsePagination } from '../../utils/pagination';
import {
  allocateEventCode,
  convertOptionCodeToEventCode,
  peekNextEventCodes,
  type EventCodePrefix,
} from '../../utils/eventCode';
import { isHallOnlyBooking, HALL_ONLY_EVENT_TYPE } from '../../validators/booking.validator';
import { neonTransactionOptions, withDbRetry } from '../../utils/dbRetry';
import { isSlotUniqueViolation, slotUniqueConflictError } from '../../utils/bookingSlotGuard';
import {
  assertSlotAvailableAfterLock,
  lockEventDateRow,
  type TxClient,
} from '../../utils/eventDateLock';
import { releaseOwnedOptionDates } from '../../utils/optionRelease';
import {
  ensureAdvanceOnLedger,
  issueEasyCountReceiptForBooking,
  type EasyCountBookingResult,
} from '../easyCount';
import { syncContractFields } from '../../utils/contractFields';
import {
  recordPayment,
  getBookingFinancialSnapshot,
} from '../bookingPayment.service';


import type { HttpResult } from './httpResult';
import {
  canEditBookingDate,
  isPastCalendarDate,
  releaseOptionDateInTx,
  hasOptionBookings,
  syncEventDateWithOptionBookings,
  syncDesyncedOptionDates,
  slotConflictMessage,
  validateHallRentalPriceInput,
} from './helpers';

export async function getBookingById(req: AuthRequest | Request): Promise<HttpResult> {

    const tenantId = (req as AuthRequest).user?.tenantId;
    if (!tenantId) return { status: 403, body: { error: 'Tenant context is missing.' } };
  const id = req.params.id as string;
  const booking = await prisma.booking.findFirst({
    where: { id,
        tenantId
    },
    include: { eventDate: true },
  });

  if (!booking) {
    return { status: 404, body: { success: false, message: 'ההזמנה לא נמצאה.' } };
  }

  return { status: 200, body: { success: true, data: booking } };

}

export async function getNextEventCode(req: AuthRequest | Request): Promise<HttpResult> {

  const prefix: EventCodePrefix = req.query.prefix === 'EVT' ? 'EVT' : 'OPT';
  const count = Math.min(Math.max(Number(req.query.count) || 1, 1), 10);
  const codes = await peekNextEventCodes(prefix, count);

  return { status: 200, body: {
    success: true,
    data: {
      code: codes[0],
      codes,
    },
  } };

}

export async function getCancellationStats(req: AuthRequest | Request): Promise<HttpResult> {

    const tenantId = (req as AuthRequest).user?.tenantId;
    if (!tenantId) return { status: 403, body: { error: 'Tenant context is missing.' } };
  const { month, year } = req.query; 

  let dateFilter = {};

  if (month && year) {
    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 1);
    dateFilter = {
      createdAt: {
        gte: startDate, 
        lt: endDate,    
      }
    };
  } 
  else if (year) {
    const startDate = new Date(Number(year), 0, 1); 
    const endDate = new Date(Number(year) + 1, 0, 1); 
    dateFilter = {
      createdAt: {
        gte: startDate,
        lt: endDate,
      }
    };
  }

  const stats = await prisma.cancellationLog.groupBy({
    by: ['reason'],
    where: dateFilter, 
    _count: {
      reason: true,
    },
    orderBy: {
      _count: {
        reason: 'desc',
      },
    },
  });

  const formattedStats = stats.map(stat => ({
    reason: stat.reason,
    count: stat._count.reason,
  }));

  return { status: 200, body: { success: true, data: formattedStats } };

}

export async function getAllBookings(req: AuthRequest | Request): Promise<HttpResult> {

    const tenantId = (req as AuthRequest).user?.tenantId;
    if (!tenantId) return { status: 403, body: { error: 'Tenant context is missing.' } };
  const { page, limit, skip: pageSkip } = parsePagination(req.query as Record<string, unknown>);
  const cursor = req.query.cursor as string | undefined;
  const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;
  let search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  
  if (search.length > 100) {
    search = search.substring(0, 100);
  }

  if (status === 'OPTION') {
    await syncDesyncedOptionDates();
  }

  const where: Prisma.BookingWhereInput = {};

  if (status === 'BOOKED') {
    where.isOption = false;
  } else if (status === 'OPTION') {
    where.isOption = true;
  }

  if (search) {
    where.OR = [
      { clientAFullName: { contains: search, mode: 'insensitive' } },
      { clientAIdNumber: { contains: search } },
      { clientBFullName: { contains: search, mode: 'insensitive' } },
      { clientBIdNumber: { contains: search } },
      { eventCode: { contains: search, mode: 'insensitive' } },
    ];
  }

  const findManyArgs: Prisma.BookingFindManyArgs = {
    where,
    take: cursor ? limit + 1 : limit, 
    skip: cursor ? 1 : pageSkip,
    orderBy: cursor ? { id: 'desc' } : { eventDate: { date: 'desc' } }, 
    include: { eventDate: true, eventForm: true, additions: true },
  };

  if (cursor) {
    findManyArgs.cursor = { id: cursor };
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany(findManyArgs),
    cursor ? Promise.resolve(0) : prisma.booking.count({ where }),
  ]);

  let nextCursor: string | undefined = undefined;
  if (cursor && bookings.length > limit) {
    const nextItem = bookings.pop();
    nextCursor = nextItem?.id;
  }

  return { status: 200, body: {
    success: true,
    data: bookings,
    pagination: cursor ? {
      nextCursor,
      hasMore: !!nextCursor,
      limit,
    } : paginationMeta(page, limit, total),
  } };

}
