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

export async function addBookingUpgrade(req: AuthRequest | Request): Promise<HttpResult> {

    const tenantId = (req as AuthRequest).user?.tenantId;
    if (!tenantId) return { status: 403, body: { error: 'Tenant context is missing.' } };
  const id = req.params.id as string;
  const upgradeKey = String(req.body.upgradeKey || '').trim();

  if (!UPGRADE_DISPLAY_ORDER.includes(upgradeKey as (typeof UPGRADE_DISPLAY_ORDER)[number])) {
    return { status: 400, body: { success: false, message: 'שדרוג לא תקין.' } };
  }

  const booking = await prisma.booking.findFirst({
    where: { id,
        tenantId
    },
    include: { eventDate: true, eventForm: true },
  });

  if (!booking) {
    return { status: 404, body: { success: false, message: 'ההזמנה לא נמצאה.' } };
  }

  if (!canEditBookingDate(booking.eventDate.date)) {
    return { status: 403, body: { success: false, message: 'לא ניתן לערוך ביום האירוע או לאחריו.' } };
  }

  const refreshed = await refreshBookingUpgradesAndContract(booking, booking.eventForm, upgradeKey);

  const updated = await prisma.booking.update({ where: { id },
    data: {
      upgrades: refreshed.upgrades,
      extrasPrice: refreshed.extrasPrice,
      externalExtrasPrice: refreshed.externalExtrasPrice,
      totalPrice: refreshed.totalPrice,
      paymentTermsText: refreshed.paymentTermsText,
      contractText: refreshed.contractText,
      updatedBy: 'מערכת',
    },
    include: { eventDate: true },
  });

  emitBookingUpdated(id);

  return { status: 200, body: {
    success: true,
    message: 'השדרוג נוסף לחוזה והמסמך עודכן.',
    data: updated,
  } };

}

export async function getContractTemplate(req: AuthRequest | Request): Promise<HttpResult> {

    const tenantId = (req as AuthRequest).user?.tenantId;
    if (!tenantId) return { status: 403, body: { error: 'Tenant context is missing.' } };
  const settings = await prisma.systemSettings.findFirst({ where: { id: 'global',
      tenantId
} });
  const paymentMeta = getPaymentTemplatesFromSettings(settings);
  const paymentTermsText = await resolveDefaultPaymentTermsText();
  const contractBaseText = await getContractText();
  const contractText = await resolveContractWithPaymentTerms({ paymentTermsText });

  return { status: 200, body: {
    success: true,
    data: {
      contractText,
      contractBaseText,
      paymentTermsText,
      paymentTemplateId: paymentMeta.defaultTemplateId,
      paymentTemplates: paymentMeta.templates,
      defaultPaymentTemplateId: paymentMeta.defaultTemplateId,
    },
  } };

}

export async function signAndSendContract(req: AuthRequest | Request): Promise<HttpResult> {

  const tenantId = (req as AuthRequest).user?.tenantId;
  const bookingId = req.params.id as string;
  const { clientSignature } = req.body;
  if (!clientSignature) { return { status: 400, body: { success: false, message: 'חתימה חסרה' } }; }

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, tenantId },
    include: { eventDate: true, eventForm: true },
  });
  if (!booking) return { status: 404, body: { success: false, message: 'ההזמנה לא נמצאה' } };

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      clientSignatureUrl: clientSignature,
      isContractSigned: true,
    },
    include: { eventDate: true, eventForm: true }
  });

  const systemSettings = await prisma.systemSettings.findFirst({ where: { id: 'global', tenantId } });
  const upgradesPricing = buildUpgradesPricingFromSettings(systemSettings);
  // Always pass the fresh signature explicitly so the emailed PDF includes it.
  const contractPdfBuffer = await generateContractPDF(
    buildBookingPdfData(updated, {
      upgradesPricing,
      clientSignatureUrl: clientSignature,
    }),
  );
  const clientEmail = updated.clientAEmail || updated.clientBEmail;

  let emailSent = false;
  let whatsappSent = false;
  const { sendPDFToClient, sendWhatsAppMessage } = await import('../emailService');
  const formattedDate = updated.eventDate?.date ? updated.eventDate.date.toISOString() : new Date().toISOString();
  if (clientEmail) {
    emailSent = await sendPDFToClient(clientEmail, updated.clientAFullName, formattedDate, contractPdfBuffer);
  }
  const phone = (updated.clientAPhone || updated.clientBPhone)?.split(' | ')[0]?.trim();
  if (phone) {
    whatsappSent = await sendWhatsAppMessage(phone, updated.clientAFullName, formattedDate);
  }

  return { status: 200, body: {
    success: true,
    message: emailSent
      ? 'החוזה נחתם ונשלח בהצלחה'
      : 'החוזה נחתם ונשמר. שליחת המייל נכשלה או שאין אימייל ללקוח.',
    emailSent,
    whatsappSent,
  } };

}

/** Generate inline contract PDF for GET /bookings/:id/contract-pdf */
export async function generateContractPdfForBooking(
  bookingId: string,
  tenantId?: string,
): Promise<HttpResult> {
  const booking = await prisma.booking.findFirst({
    where: tenantId ? { id: bookingId, tenantId } : { id: bookingId },
    include: { eventDate: true, eventForm: true },
  });

  if (!booking) {
    return { status: 404, body: { success: false, message: 'ההזמנה לא נמצאה.' } };
  }

  try {
    const systemSettings = await prisma.systemSettings.findFirst({
      where: tenantId ? { id: 'global', tenantId } : { id: 'global' },
    });
    const upgradesPricing = buildUpgradesPricingFromSettings(systemSettings);
    const pdfBuffer = await generateContractPDF(
      buildBookingPdfData(booking as never, { upgradesPricing }),
    );
    return {
      status: 200,
      body: null,
      buffer: pdfBuffer,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="contract_${booking.eventCode || booking.id}.pdf"`,
      },
    };
  } catch {
    return {
      status: 500,
      body: {
        success: false,
        message: 'שגיאה ביצירת קובץ החוזה. ודאי ש-Chrome מותקן או הגדר PUPPETEER_EXECUTABLE_PATH.',
      },
    };
  }
}
