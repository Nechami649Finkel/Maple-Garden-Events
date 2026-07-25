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

export async function reissueEasyCountReceipt(req: AuthRequest | Request): Promise<HttpResult> {

    const tenantId = (req as AuthRequest).user?.tenantId;
    if (!tenantId) return { status: 403, body: { error: 'Tenant context is missing.' } };
  const id = req.params.id as string;
  const force = req.body?.force === true;

  const booking = await prisma.booking.findFirst({ where: { id,
      tenantId
} });
  if (!booking) {
    return { status: 404, body: { success: false, message: 'ההזמנה לא נמצאה.' } };
  }
  if (booking.isOption) {
    return { status: 400, body: { success: false, message: 'לא ניתן להפיק קבלה לאופציה.' } };
  }
  if (booking.advancePaid <= 0) {
    return { status: 400, body: { success: false, message: 'יש להזין מקדמה לפני הפקת קבלה.' } };
  }

  const result = await issueEasyCountReceiptForBooking(id, { force });
  if (!result) {
    return { status: 400, body: {
      success: false,
      message: 'לא ניתן להפיק קבלה — בדקי שהמערכת מוגדרת ושטרם הופקה קבלה.',
    } };
  }

  const refreshed = await prisma.booking.findFirst({
    where: { id,
        tenantId
    },
    include: { eventDate: true },
  });

  return { status: result.issued ? 200 : 502, body: {
    success: result.issued,
    message: result.message,
    data: refreshed,
    easycount: result,
  } };

}

export async function getBookingPayments(req: AuthRequest | Request): Promise<HttpResult> {

  const tenantId = (req as { user?: { tenantId?: string } }).user?.tenantId;
  if (!tenantId) return { status: 403, body: { error: 'Tenant context is missing.' } };

  const id = String(req.params.id);
  const booking = await prisma.booking.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!booking) {
    return { status: 404, body: { success: false, message: 'ההזמנה לא נמצאה.' } };
  }

  const snapshot = await getBookingFinancialSnapshot(id);
  return { status: 200, body: {
    success: true,
    data: {
      totalCost: snapshot.totalCost,
      totalPaid: snapshot.totalPaid,
      remainingBalance: snapshot.remainingBalance,
      payments: snapshot.payments,
    },
  } };

}

export async function createBookingPayment(req: AuthRequest | Request): Promise<HttpResult> {

  const tenantId = (req as { user?: { tenantId?: string } }).user?.tenantId;
  if (!tenantId) return { status: 403, body: { error: 'Tenant context is missing.' } };

  const id = String(req.params.id);
  const booking = await prisma.booking.findFirst({
    where: { id, tenantId },
  });
  if (!booking) {
    return { status: 404, body: { success: false, message: 'ההזמנה לא נמצאה.' } };
  }
  if (booking.isOption) {
    return { status: 400, body: { success: false, message: 'לא ניתן לרשום תשלום לאופציה.' } };
  }

  const paidAtRaw = req.body?.paidAt;
  const paidAt = paidAtRaw ? new Date(paidAtRaw) : new Date();
  if (Number.isNaN(paidAt.getTime())) {
    return { status: 400, body: { success: false, message: 'תאריך תשלום לא תקין.' } };
  }

  const result = await recordPayment({
    bookingId: id,
    tenantId,
    amount: Number(req.body?.amount),
    paidAt,
    paymentMethod: String(req.body?.paymentMethod || 'other'),
    easycountTransactionId: req.body?.easycountTransactionId ?? null,
    source: 'MANUAL',
    notes: req.body?.notes ?? null,
  });

  emitBookingUpdated(id);

  const snapshot = await getBookingFinancialSnapshot(id);
  return { status: 201, body: {
    success: true,
    data: {
      payment: result.payment,
      totalCost: snapshot.totalCost,
      totalPaid: snapshot.totalPaid,
      remainingBalance: snapshot.remainingBalance,
      paymentStatus: result.paymentStatus,
    },
  } };

}
