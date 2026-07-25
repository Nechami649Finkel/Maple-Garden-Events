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

export async function getRelatedOptionBookings(req: AuthRequest | Request): Promise<HttpResult> {

    const tenantId = (req as AuthRequest).user?.tenantId;
    if (!tenantId) return { status: 403, body: { error: 'Tenant context is missing.' } };
  const id = req.params.id as string;
  const booking = await prisma.booking.findFirst({
    where: { id,
        tenantId
    },
    include: { eventDate: true },
  });

  if (!booking || !booking.isOption || !booking.eventDate) {
    return { status: 404, body: { success: false, message: 'אופציה לא נמצאה.' } };
  }

  await syncEventDateWithOptionBookings(prisma, booking.eventDate.id);

  const createdAtStart = new Date(booking.createdAt.getTime() - 120_000);
  const createdAtEnd = new Date(booking.createdAt.getTime() + 120_000);

  const related = await prisma.booking.findMany({
    where: {
      clientAFullName: booking.clientAFullName,
      clientAPhone: booking.clientAPhone,
      createdBy: booking.createdBy,
      isOption: true,
      createdAt: { gte: createdAtStart, lte: createdAtEnd },
        tenantId
    },
    include: { eventDate: true },
    orderBy: { eventDate: { date: 'asc' } },
  });

  return { status: 200, body: { success: true, data: related } };

}

export async function releaseOptions(req: AuthRequest | Request): Promise<HttpResult> {

    const tenantId = (req as AuthRequest).user?.tenantId;
    if (!tenantId) return { status: 403, body: { error: 'Tenant context is missing.' } };
  const { dateIds, cancelReason, clientName } = req.body; 
  
  if (!dateIds || dateIds.length === 0) return { status: 400, body: { success: false, message: 'לא נבחרו תאריכים לשחרור.' } };

  await prisma.$transaction(async (tx) => {
    await tx.eventDate.updateMany({ where: { id: { in: dateIds } }, data: { status: 'AVAILABLE', optionExpiresAt: null, clientName: null, clientPhone: null, clientEmail: null }
    });

    await tx.booking.deleteMany({ 
      where: { eventDate: { id: { in: dateIds } },
          tenantId
    } 
    });
    
    if (cancelReason) {
      await tx.cancellationLog.create({
        data: {
          reason: cancelReason,
          clientName: clientName || 'לא צוין',
            tenantId
        }
      });
    }
  });

  emitDateUpdatedMany(dateIds.map((dateId: string) => ({ dateId, status: 'AVAILABLE' })));
  emitBookingUpdated();
  
  await invalidateCache('calendar');

  return { status: 200, body: { success: true, message: 'התאריכים שוחררו והסטטיסטיקה נשמרה בהצלחה.' } };

}

export async function bumpOption(req: AuthRequest | Request): Promise<HttpResult> {

    const tenantId = (req as AuthRequest).user?.tenantId;
    if (!tenantId) return { status: 403, body: { error: 'Tenant context is missing.' } };
  let { dateId, bookingId } = req.body as { dateId?: string; bookingId?: string };
  let targetBookingId = bookingId;

  if (bookingId) {
    const sourceBooking = await prisma.booking.findFirst({
      where: { id: bookingId,
          tenantId
    }, include: { eventDate: true } });
    if (!sourceBooking?.isOption || !sourceBooking.eventDate) {
      return { status: 400, body: { success: false, message: 'ההזמנה אינה אופציה פעילה.' } };
    }
    dateId = sourceBooking.calendarDateId;
  }

  if (!dateId) {
    return { status: 400, body: { success: false, message: 'חסר מזהה תאריך.' } };
  }

  const eventDate = await prisma.eventDate.findFirst({
    where: { id: dateId,
        tenantId
    },
    include: { bookings: true } });

  if (!eventDate) {
    return { status: 400, body: { success: false, message: 'התאריך לא נמצא.' } };
  }

  const optionBookings = eventDate.bookings.filter((b) => b.isOption);
  if (optionBookings.length === 0) {
    return { status: 400, body: { success: false, message: 'התאריך אינו מוגדר כאופציה.' } };
  }

  const targets = targetBookingId
    ? optionBookings.filter((b) => b.id === targetBookingId)
    : optionBookings;

  if (targets.length === 0) {
    return { status: 400, body: { success: false, message: 'ההזמנה אינה אופציה פעילה.' } };
  }

  await syncEventDateWithOptionBookings(prisma, dateId);

  const newDeadline = new Date();
  newDeadline.setHours(newDeadline.getHours() + 3);
  await prisma.eventDate.update({ where: { id: dateId }, data: { optionExpiresAt: newDeadline } });

  const skippedReasons: string[] = [];
  let emailSent = false;
  let whatsappSent = false;
  let whatsappSimulated = false;
  const eventDateStr = eventDate.date.toString();

  for (const booking of targets) {
    if (booking.clientAEmail) {
      const emailResult = await sendBumpEmail(
        booking.clientAEmail,
        booking.clientAFullName,
        eventDateStr,
        newDeadline,
      );
      if (emailResult.ok && !emailResult.simulated) {
        emailSent = true;
      } else if (!emailResult.ok) {
        skippedReasons.push(mailFailureMessage(emailResult.reason));
      } else if (emailResult.simulated) {
        skippedReasons.push('מייל: לא מוגדר בשרת (לא נשלח בפועל)');
      }
    } else {
      skippedReasons.push('לא הוזן אימייל ללקוח');
    }

    if (booking.clientAPhone) {
      const phone = booking.clientAPhone.split(' | ')[0].trim();
      const waResult = await sendBumpWhatsApp(
        phone,
        booking.clientAFullName,
        eventDateStr,
        newDeadline,
      );
      if (waResult.sent) whatsappSent = true;
      if (waResult.simulated) whatsappSimulated = true;

      if (waResult.hasWhatsApp === false) {
        skippedReasons.push('למספר הטלפון אין וואטסאפ');
      } else if (waResult.simulated) {
        skippedReasons.push('וואטסאפ: לא מוגדר (לא נשלח בפועל)');
      } else if (!waResult.sent) {
        skippedReasons.push('שליחת הוואטסאפ נכשלה');
      }
    } else {
      skippedReasons.push('לא הוזן טלפון ללקוח');
    }
  }

  emitDateUpdated({ dateId, status: 'OPTION' });
  emitBookingUpdated();

  await invalidateCache('calendar');

  return { status: 200, body: {
    success: true,
    message: 'הדד-ליין עודכן ל-3 שעות מעכשיו.',
    newDeadline,
    emailSent,
    whatsappSent,
    whatsappSimulated,
    skippedReasons: [...new Set(skippedReasons)],
  } };

}

export async function notifyOptionInterest(req: AuthRequest | Request): Promise<HttpResult> {

    const tenantId = (req as AuthRequest).user?.tenantId;
    if (!tenantId) return { status: 403, body: { error: 'Tenant context is missing.' } };
  const { bookingId, message } = req.body as { bookingId?: string; message?: string };

  if (!bookingId) {
    return { status: 400, body: { success: false, message: 'חסר מזהה הזמנה.' } };
  }

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId,
        tenantId
    },
    include: { eventDate: true },
  });

  if (!booking || !booking.isOption) {
    return { status: 400, body: { success: false, message: 'ההזמנה אינה אופציה פעילה.' } };
  }

  if (!booking.eventDate) {
    return { status: 400, body: { success: false, message: 'לא נמצא תאריך מקושר להזמנה.' } };
  }

  await syncEventDateWithOptionBookings(prisma, booking.eventDate.id);

  const eventDateStr = booking.eventDate.date.toString();
  const skippedReasons: string[] = [];
  let emailSent = false;
  let whatsappSent = false;
  let whatsappSimulated = false;

  if (booking.clientAEmail) {
    const emailResult = await sendOptionInterestEmail(
      booking.clientAEmail,
      booking.clientAFullName,
      eventDateStr,
      message,
    );
    emailSent = emailResult.ok && !emailResult.simulated;
    if (!emailResult.ok) {
      skippedReasons.push(mailFailureMessage(emailResult.reason));
    } else if (emailResult.simulated) {
      skippedReasons.push('מייל: לא מוגדר בשרת (לא נשלח בפועל)');
    }
  } else {
    skippedReasons.push('לא הוזן אימייל ללקוח');
  }

  if (booking.clientAPhone) {
    const phone = booking.clientAPhone.split(' | ')[0].trim();
    const waResult = await sendOptionInterestWhatsApp(
      phone,
      booking.clientAFullName,
      eventDateStr,
      message,
    );
    whatsappSent = waResult.sent;
    whatsappSimulated = waResult.simulated;

    if (waResult.hasWhatsApp === false) {
      skippedReasons.push('למספר הטלפון אין וואטסאפ');
    } else if (waResult.simulated) {
      skippedReasons.push('וואטסאפ: לא מוגדר (לא נשלח בפועל)');
    } else if (!waResult.sent) {
      skippedReasons.push('שליחת הוואטסאפ נכשלה');
    }
  } else {
    skippedReasons.push('לא הוזן טלפון ללקוח');
  }

  if (!emailSent && !whatsappSent) {
    const hasContact = !!(booking.clientAEmail || booking.clientAPhone);
    return { status: 400, body: {
      success: false,
      message: hasContact
        ? 'שליחת ההודעה נכשלה — ראי פירוט למטה.'
        : 'לא ניתן לשלוח — חסרים פרטי קשר ללקוח.',
      skippedReasons,
    } };
  }

  return { status: 200, body: {
    success: true,
    message: 'ההודעה נשלחה בהצלחה.',
    emailSent,
    whatsappSent,
    whatsappSimulated,
    skippedReasons,
  } };

}
