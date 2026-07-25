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

export async function createBooking(req: AuthRequest): Promise<HttpResult> {

    const tenantId = (req as AuthRequest).user?.tenantId;
    if (!tenantId) return { status: 403, body: { error: 'Tenant context is missing.' } };
  const data = req.body;
  const isManager = req.user?.role === 'manager'; 
  const currentUserName = req.user?.name || "נציג מערכת";
  let datesToProcess: any[] = [];
  
  if (data.allSelectedDates && data.allSelectedDates.length > 0) {
    datesToProcess = data.allSelectedDates;
  } else if (data.calendarDateId) {
    datesToProcess = [data.calendarDateId];
  }

  if (datesToProcess.length === 0) {
    return { status: 400, body: { success: false, message: 'לא נבחרו תאריכים לאירוע.' } };
  }

  const isOption = data.isOption === true || datesToProcess.length > 1;

  if (!isOption) {
    const hallPriceError = validateHallRentalPriceInput(data);
    if (hallPriceError) {
      return { status: 400, body: { success: false, message: hallPriceError } };
    }
  }
  const newStatus = isOption ? 'OPTION' : 'BOOKED';

  let expiryDate: Date | null = null;
  if (newStatus === 'OPTION') {
    const hoursToAdd = data.optionDurationHours ? Number(data.optionDurationHours) : 48;
    expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + hoursToAdd);
  }

  // חישוב מחירים — מקור אמת בשרת; דוחה מניפולציה מהלקוח
  const systemSettings = await prisma.systemSettings.findFirst({ where: { id: 'global',
      tenantId
} });
  const priceCheck = validateClientPricing(data, systemSettings, 0);
  if (!priceCheck.valid) {
    return { status: 400, body: { success: false, message: priceCheck.message } };
  }
  const prices = priceCheck.serverBreakdown;

  const clientAPhoneCombined = data.clientAPhone2 ? `${data.clientAPhone} | נוסף: ${data.clientAPhone2}` : data.clientAPhone;
  const clientAAddressCombined = data.clientACity ? `${data.clientACity}, ${data.clientAAddress}` : data.clientAAddress;
  const clientBPhoneCombined = data.clientBPhone2 ? `${data.clientBPhone} | נוסף: ${data.clientBPhone2}` : data.clientBPhone;
  const clientBAddressCombined = data.clientBCity ? `${data.clientBCity}, ${data.clientBAddress}` : data.clientBAddress;

  const menuNotes = parseNotesBundle(data.clientComments).menu;
  const hallOnly = isHallOnlyBooking(data);
  const upgradesPricing = buildUpgradesPricingFromSettings(systemSettings);
  const lineItemOptions = {
    upgrades: resolveEffectiveUpgrades(data.upgrades),
    kosherType: data.kosherType,
    guestCount: Number(data.guestCount) || 0,
    isHallOnly: hallOnly,
    isFoodRelevant: !hallOnly,
    upgradesPricing,
  };

  const resolvedContractText = data.contractText?.trim()
    || await resolveContractWithPaymentTerms({
      paymentTermsText: data.paymentTermsText,
      total: prices.totalPrice,
      eventDate: typeof datesToProcess[0] === 'object' ? datesToProcess[0]?.date : datesToProcess[0],
      menuNotes,
      lineItemOptions,
    });
  const paymentTermsText = data.paymentTermsText?.trim()
    || await resolveDefaultPaymentTermsText(
      prices.totalPrice,
      typeof datesToProcess[0] === 'object' ? datesToProcess[0]?.date : datesToProcess[0],
    );
  const overrideOptionDateId: string | undefined = data.overrideOptionDateId;

  if (!isOption && data.contractSigned && !data.clientSignature?.trim()) {
    return { status: 400, body: {
      success: false,
      message: 'לא ניתן לסמן חוזה כחתום ללא חתימת לקוח.',
    } };
  }

  const contractFields = syncContractFields(data.contractSigned, data.clientSignature);
  if (data.contractSigned && !contractFields.clientSignatureUrl) {
    return { status: 400, body: {
      success: false,
      message: 'לא ניתן לסמן חוזה כחתום ללא חתימת לקוח.',
    } };
  }

  if (contractFields.clientSignatureUrl) {
    logger.info('Booking create: storing client signature', {
      bytes: contractFields.clientSignatureUrl.length,
      isDataUrl: contractFields.clientSignatureUrl.startsWith('data:image/'),
    });
  }

  let createdBookings: any[] = [];
  let eventsToEmit: { dateId: string, status: string }[] = [];

  await withDbRetry(() =>
    prisma.$transaction(async (tx) => {
    createdBookings = [];
    eventsToEmit = [];

    for (const dateItem of datesToProcess) {
      const dateString = typeof dateItem === 'object' && dateItem !== null ? dateItem.date : dateItem;
      let calendarKey: string;
      try {
        calendarKey = toCalendarDateKey(String(dateString));
      } catch {
        const err: any = new Error('תאריך לא תקין.');
        err.statusCode = 400;
        throw err;
      }
      const possibleDate = parseDateLocal(calendarKey);

      if (isPastCalendarDate(possibleDate)) {
        const err: any = new Error('לא ניתן לקבוע אירוע או אופציה בתאריך שעבר.');
        err.statusCode = 400;
        throw err;
      }

      let eventDate = await tx.eventDate.findFirst({
        where: prismaCalendarDayWhere(calendarKey),
        include: { bookings: true },
      });

      const optionBookingsOnDate = hasOptionBookings(eventDate?.bookings ?? []);
      const isOverrideTarget =
        !isOption
        && !!overrideOptionDateId
        && eventDate?.id === overrideOptionDateId
        && (eventDate.status === 'OPTION' || optionBookingsOnDate);

      if (
        !isOption
        && overrideOptionDateId
        && eventDate?.id === overrideOptionDateId
        && !optionBookingsOnDate
        && eventDate.status !== 'OPTION'
      ) {
        const err: any = new Error('האופציה כבר שוחררה או הומרה — יש לרענן את הלוח שנה.');
        err.statusCode = 409;
        throw err;
      }

      if (isOverrideTarget && eventDate) {
        await releaseOptionDateInTx(tx, eventDate.id);
        eventDate = await tx.eventDate.findFirst({
          where: { id: eventDate.id,
              tenantId
        },
          include: { bookings: true },
        });
        if (!eventDate) {
          const err: any = new Error('תאריך האופציה לא נמצא.');
          err.statusCode = 404;
          throw err;
        }
      }

      const slot = normalizeTimeSlot(data.timeOfDay, data.startTime, data.endTime)
        || (isOption ? 'evening' as const : null);
      if (!slot) {
        const err: any = new Error('יש לבחור משבצת זמן: בוקר, צהריים או ערב.');
        err.statusCode = 400;
        throw err;
      }

      const slotError = validateSlotOnDate(parseDateLocal(calendarKey), slot);
      if (slotError) {
        const err: any = new Error(slotError);
        err.statusCode = 400;
        throw err;
      }

      if (!eventDate) {
        eventDate = await tx.eventDate.create({
          data: { date: calendarDateForStorage(calendarKey), status: newStatus, optionExpiresAt: expiryDate,
              tenantId
        },
          include: { bookings: true },
        });
      } else if (!isOverrideTarget) {
        const stillHasOptions = hasOptionBookings(eventDate.bookings ?? []);
        const updatePayload: Record<string, unknown> = {};
        if (newStatus === 'OPTION') {
          const hasConfirmed = (eventDate.bookings ?? []).some((b) => !b.isOption);
          if (!hasConfirmed) {
            updatePayload.status = newStatus;
          }
          updatePayload.optionExpiresAt = expiryDate;
        } else if (newStatus === 'BOOKED' && !stillHasOptions) {
          updatePayload.status = 'BOOKED';
          updatePayload.optionExpiresAt = null;
        }
        if (Object.keys(updatePayload).length > 0) {
          eventDate = await tx.eventDate.update({ where: { id: eventDate.id }, data: updatePayload, include: { bookings: true } });
        }
      }

      await lockEventDateRow(tx, eventDate.id);
      eventDate = await tx.eventDate.findFirst({
        where: { id: eventDate.id,
            tenantId
        },
        include: { bookings: true },
      });
      if (!eventDate) {
        const err: any = new Error('תאריך האירוע לא נמצא.');
        err.statusCode = 404;
        throw err;
      }

      assertSlotAvailableAfterLock(
        calendarKey,
        slot,
        eventDate.bookings || [],
        data.eventType || 'חתונה',
        {
          isOption,
          optionConflictMessage: slotConflictMessage(slot, eventDate.bookings || []),
        },
      );

      if (newStatus === 'BOOKED' && eventDate.status !== 'BOOKED') {
        eventDate = await tx.eventDate.update({ where: { id: eventDate.id }, data: { status: 'BOOKED', optionExpiresAt: null }, include: { bookings: true } });
      }

      const timeString = formatStoredTimeOfDay(slot, data.startTime, data.endTime);
      const eventCode = await allocateEventCode(newStatus === 'OPTION' ? 'OPT' : 'EVT', tx);

      let newBooking;
      try {
        newBooking = await tx.booking.create({
        data: {
          clientAFullName: data.clientAFullName,
          clientAIdNumber: data.clientAIdNumber || '',
          clientAPhone: clientAPhoneCombined,
          clientAEmail: data.clientAEmail || null,
          clientAAddress: clientAAddressCombined,
          clientBFullName: data.clientBFullName || null,
          clientBIdNumber: data.clientBIdNumber || null,
          clientBPhone: clientBPhoneCombined || null,
          clientBEmail: data.clientBEmail || null,
          clientBAddress: clientBAddressCombined || null,
          
          eventDate: { connect: { id: eventDate.id } },
          
          eventType: data.eventType,
          timeOfDay: timeString,
          timeSlot: slot,
          guestCount: Number(data.guestCount) || 0,
          minimumGuestCount: Number(data.minimumGuestCount) || Number(data.guestCount) || 0,
          finalPricePortion: Number(data.finalPricePortion) || 0,
          basePrice: prices.basePrice,
          extrasPrice: prices.extrasPrice,
          externalExtrasPrice: prices.externalExtrasPrice,
          liveAdditionsTotal: prices.liveAdditionsTotal,
          totalPrice: prices.totalPrice,
          hallRentalPrice: data.hallRentalPrice ? Number(data.hallRentalPrice) : null, // 🔥 התיקון: שמירת מחיר אולם
          hasMusic: data.hasMusic !== undefined ? data.hasMusic : true,
          akumApprovalCode: data.akumApprovalCode || null,
          advancePaid: (() => {
            if (newStatus === 'OPTION') return 0;
            const paid = Number(data.advancePaid) || 0;
            return paid > 0 ? paid : 0;
          })(),
          paidAmount: (() => {
            if (newStatus === 'OPTION') return 0;
            const paid = Number(data.advancePaid) || 0;
            return paid > 0 ? paid : 0;
          })(),
          totalPaid: (() => {
            if (newStatus === 'OPTION') return 0;
            const paid = Number(data.advancePaid) || 0;
            return paid > 0 ? paid : 0;
          })(),
          paymentStatus: (() => {
            if (newStatus === 'OPTION') return 'pending';
            const paid = Number(data.advancePaid) || 0;
            return paid > 0 ? 'PARTIAL' : 'pending';
          })(),
          depositMethod: data.depositMethod || null,
          vatType: data.vatType === 'not_included' ? 'not_included' : 'included',
          securityCheckStatus: 'PENDING',
          isContractSigned: contractFields.isContractSigned,
          clientSignatureUrl: contractFields.clientSignatureUrl,
          isOption: newStatus === 'OPTION',
          managerComments: data.managerComments || null,
          clientComments: data.clientComments || null,
          createdBy: data.createdBy || (isManager ? "מנהל מערכת" : "נציג מכירות"),
          eventCode,
          depositCheckUrl: data.depositCheckUrl || null,
          depositCheckDetails: data.depositCheckDetails || null,
          contractText: resolvedContractText,
          paymentTemplateId: data.paymentTemplateId || null,
          paymentTermsText: paymentTermsText || null,
          upgrades: lineItemOptions.upgrades,
          kosherType: data.kosherType || null,
          tenant: { connect: { id: tenantId } }
        }
      });
      } catch (createErr) {
        if (isSlotUniqueViolation(createErr)) {
          throw slotUniqueConflictError(slot);
        }
        throw createErr;
      }
      createdBookings.push(newBooking);

      if (newStatus === 'OPTION') {
        await syncEventDateWithOptionBookings(tx, eventDate.id);
      }
      
      eventsToEmit.push({ dateId: eventDate.id, status: newStatus });
    }
  }, neonTransactionOptions));

  if (createdBookings.length === 0) {
    return { status: 400, body: {
      success: false,
      message: 'לא ניתן לשמור — אף תאריך לא עבר את הבדיקות.',
    } };
  }

  eventsToEmit.forEach(ev => emitDateUpdated(ev));
  if (createdBookings.length > 0) {
    emitBookingUpdated(createdBookings[0].id);
    if (!isOption) {
      syncBookingPaymentMetadata(createdBookings[0].id).catch((err: unknown) => {
        logger.error(`Background payment sync failed for booking ${createdBookings[0].id}`, { error: err });
      });
    }
  }

  if (data.contractSigned && data.clientSignature && createdBookings.length > 0) {
    try {
      const savedBooking = createdBookings[0];
      const firstDateItem = datesToProcess[0];
      const firstDateString = typeof firstDateItem === 'object' && firstDateItem !== null ? firstDateItem.date : firstDateItem;

      const contractPdfBuffer = await generateContractPDF(
        buildBookingPdfData(
          { ...savedBooking, eventDate: { date: parseCalendarDate(toCalendarDateKey(String(firstDateString))) } },
          {
            isOption: newStatus === 'OPTION',
            clientSignatureUrl: data.clientSignature,
            eventForm: {},
          },
        ),
      );
      const clientEmail = savedBooking.clientAEmail || savedBooking.clientBEmail;
      
      if (clientEmail) {
        await sendPDFToClient(
          clientEmail, 
          savedBooking.clientAFullName, 
          parseCalendarDate(toCalendarDateKey(String(firstDateString))).toString(), 
          contractPdfBuffer
        );
      }
      if (newStatus === 'BOOKED') {
        await notifyContractClosedViaWhatsApp(
          {
            ...savedBooking,
            eventDate: { date: parseCalendarDate(toCalendarDateKey(String(firstDateString))) },
          },
          contractPdfBuffer,
        );
      }
    } catch (pdfError) {
      logger.error("שגיאה בהפקת או שליחת החוזה הראשוני למייל:", pdfError);
    }
  }

  let easycountResult: EasyCountBookingResult | null = null;
  for (const savedBooking of createdBookings) {
    if (!savedBooking.isOption && savedBooking.advancePaid > 0) {
      try {
        easycountResult = await issueEasyCountReceiptForBooking(savedBooking.id);
      } catch (easycountError) {
        logger.error('שגיאה בהפקת קבלת EZCount:', easycountError);
      }
      await ensureAdvanceOnLedger(savedBooking.id).catch((ledgerError: unknown) => {
        logger.error('שגיאה ברישום מקדמה ליומן תשלומים:', ledgerError);
      });
    }
  }

  let responseData: typeof createdBookings = createdBookings;
  if (createdBookings.length > 0 && easycountResult) {
    const refreshed = await prisma.booking.findFirst({
      where: { id: createdBookings[0].id,
          tenantId
    },
      include: { eventDate: true },
    });
    if (refreshed) responseData = [refreshed];
  }

  return { status: 201, body: {
    success: true,
    message: newStatus === 'OPTION' ? 'האופציות נשמרו והצעת המחיר נשלחה במייל!' : 'האירוע נשמר והחוזה נשלח!',
    data: responseData,
    easycount: easycountResult,
  } };

}

export async function updateBooking(req: AuthRequest): Promise<HttpResult> {

    const tenantId = (req as AuthRequest).user?.tenantId;
    if (!tenantId) return { status: 403, body: { error: 'Tenant context is missing.' } };
  const id = req.params.id as string;
  const data = req.body;

  const booking = await prisma.booking.findFirst({
    where: { id,
        tenantId
    },
    include: { eventDate: true },
  });

  if (!booking || !booking.eventDate) {
    return { status: 404, body: { success: false, message: 'ההזמנה לא נמצאה.' } };
  }

  if (!canEditBookingDate(booking.eventDate.date)) {
    return { status: 403, body: { success: false, message: 'לא ניתן לערוך ביום האירוע או לאחריו.' } };
  }

  if (data.expectedUpdatedAt) {
    const expected = new Date(data.expectedUpdatedAt as string);
    if (!Number.isNaN(expected.getTime()) && booking.updatedAt.getTime() !== expected.getTime()) {
      return { status: 409, body: {
        success: false,
        conflict: true,
        message: 'ההזמנה עודכנה על ידי משתמש אחר. רענני את העמוד ונסי שוב.',
        currentUpdatedAt: booking.updatedAt.toISOString(),
        updatedBy: booking.updatedBy,
      } };
    }
  }

  if (!booking.isOption && !data.convertFromOption) {
    const hallPriceError = validateHallRentalPriceInput({
      eventType: data.eventType ?? booking.eventType,
      hallRentalPrice: data.hallRentalPrice ?? (booking as { hallRentalPrice?: number | null }).hallRentalPrice,
    });
    if (hallPriceError) {
      return { status: 400, body: { success: false, message: hallPriceError } };
    }
  }

  if (data.convertFromOption && !booking.isOption) {
    return { status: 400, body: { success: false, message: 'ההזמנה כבר אינה אופציה.' } };
  }

  if (data.convertFromOption) {
    const hallPriceError = validateHallRentalPriceInput({
      eventType: data.eventType ?? booking.eventType,
      hallRentalPrice: data.hallRentalPrice ?? (booking as { hallRentalPrice?: number | null }).hallRentalPrice,
    });
    if (hallPriceError) {
      return { status: 400, body: { success: false, message: hallPriceError } };
    }
  }

  const clientAPhoneCombined = data.clientAPhone2
    ? `${data.clientAPhone} | נוסף: ${data.clientAPhone2}`
    : data.clientAPhone;
  const clientAAddressCombined = data.clientACity
    ? `${data.clientACity}, ${data.clientAAddress}`
    : data.clientAAddress;
  const clientBPhoneCombined = data.clientBPhone2
    ? `${data.clientBPhone} | נוסף: ${data.clientBPhone2}`
    : data.clientBPhone;
  const clientBAddressCombined = data.clientBCity
    ? `${data.clientBCity}, ${data.clientBAddress}`
    : data.clientBAddress;

  const slot = normalizeTimeSlot(data.timeOfDay, data.startTime, data.endTime);
  if (slot) {
    const slotError = validateSlotOnDate(parseDateLocal(booking.eventDate.date), slot);
    if (slotError) {
      return { status: 400, body: { success: false, message: slotError } };
    }
  }

  const timeString = slot
    ? formatStoredTimeOfDay(slot, data.startTime, data.endTime)
    : (data.startTime && data.endTime
      ? `${data.startTime} - ${data.endTime}`
      : booking.timeOfDay);

  const liveTotal = Number(booking.liveAdditionsTotal) || 0;

  const pricingPayload = {
    eventType: data.eventType ?? booking.eventType,
    guestCount: data.guestCount ?? booking.guestCount,
    minimumGuestCount:
      data.minimumGuestCount ?? booking.minimumGuestCount ?? data.guestCount ?? booking.guestCount,
    finalPricePortion: data.finalPricePortion ?? booking.finalPricePortion,
    hallRentalPrice: data.hallRentalPrice ?? (booking as { hallRentalPrice?: number | null }).hallRentalPrice,
    kosherType: data.kosherType !== undefined ? data.kosherType : (booking as { kosherType?: string | null }).kosherType,
    vatType: data.vatType !== undefined ? data.vatType : (booking as { vatType?: string | null }).vatType,
    discountPercent: data.discountPercent,
    discountAmount: data.discountAmount,
    upgrades: data.upgrades ?? booking.upgrades,
    calculatedTotals: data.calculatedTotals,
  };

  const systemSettings = await prisma.systemSettings.findFirst({ where: { id: 'global',
      tenantId
} });
  const priceCheck = validateClientPricing(pricingPayload, systemSettings, liveTotal);
  if (!priceCheck.valid) {
    return { status: 400, body: { success: false, message: priceCheck.message } };
  }
  const prices = priceCheck.serverBreakdown;
  const isConverting = data.convertFromOption === true;
  const incomingSignature =
    typeof data.clientSignature === 'string' ? data.clientSignature.trim() : '';
  const finalSignature = incomingSignature || booking.clientSignatureUrl || null;
  let convertedEventCode: string | null = null;

  if (data.contractSigned && !finalSignature) {
    return { status: 400, body: {
      success: false,
      message: 'לא ניתן לסמן חוזה כחתום ללא חתימת לקוח.',
    } };
  }

  // Preserve an existing signature when the client sends null/empty without
  // explicitly unsigning (common on edit when the pad is closed/unmounted).
  let contractFields: ReturnType<typeof syncContractFields>;
  if (data.clientSignature !== undefined) {
    if (incomingSignature) {
      contractFields = syncContractFields(data.contractSigned, incomingSignature);
    } else if (data.contractSigned === false) {
      contractFields = syncContractFields(false, null);
    } else {
      contractFields = syncContractFields(
        data.contractSigned ?? booking.isContractSigned,
        booking.clientSignatureUrl,
      );
    }
  } else if (isConverting) {
    contractFields = syncContractFields(data.contractSigned ?? true, finalSignature);
  } else {
    contractFields = syncContractFields(booking.isContractSigned, booking.clientSignatureUrl);
  }

  if (isConverting) {
    convertedEventCode = convertOptionCodeToEventCode(booking.eventCode);
    if (!convertedEventCode) {
      convertedEventCode = await allocateEventCode('EVT');
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await lockEventDateRow(tx, booking.eventDate.id);

    if (slot) {
      const calendarKey = calendarKeyFromDbDate(booking.eventDate.date);
      const freshDate = await tx.eventDate.findFirst({
        where: { id: booking.eventDate.id,
            tenantId
        },
        include: { bookings: true },
      });
      const siblingBookings = (freshDate?.bookings ?? []).filter((b) => b.id !== id);
      assertSlotAvailableAfterLock(
        calendarKey,
        slot,
        siblingBookings,
        String(data.eventType ?? booking.eventType),
        { optionConflictMessage: slotConflictMessage(slot, siblingBookings) },
      );
    }

    const updateData: Record<string, unknown> = {
      clientAFullName: data.clientAFullName,
      clientAIdNumber: data.clientAIdNumber,
      clientAPhone: clientAPhoneCombined,
      clientAEmail: data.clientAEmail || null,
      clientAAddress: clientAAddressCombined || null,
      clientBFullName: data.clientBFullName || null,
      clientBIdNumber: data.clientBIdNumber || null,
      clientBPhone: clientBPhoneCombined || null,
      clientBEmail: data.clientBEmail || null,
      clientBAddress: clientBAddressCombined || null,
      eventType: data.eventType,
      timeOfDay: timeString,
      ...(slot ? { timeSlot: slot } : {}),
      guestCount: Number(data.guestCount) || 0,
      minimumGuestCount: Number(data.minimumGuestCount) || Number(data.guestCount) || 0,
      finalPricePortion: Number(data.finalPricePortion) || 0,
      basePrice: prices.basePrice,
      extrasPrice: prices.extrasPrice,
      externalExtrasPrice: prices.externalExtrasPrice,
      liveAdditionsTotal: prices.liveAdditionsTotal,
      totalPrice: prices.totalPrice,
      hallRentalPrice: data.hallRentalPrice !== undefined ? Number(data.hallRentalPrice) : (booking as any).hallRentalPrice,
      hasMusic: data.hasMusic !== undefined ? data.hasMusic : booking.hasMusic,
      akumApprovalCode: data.akumApprovalCode || null,
      managerComments: data.managerComments || null,
      clientComments: data.clientComments || null,
      createdBy: data.createdBy || booking.createdBy,
      isContractSigned: contractFields.isContractSigned,
      clientSignatureUrl: contractFields.clientSignatureUrl,
      depositCheckUrl: data.depositCheckUrl !== undefined ? data.depositCheckUrl || null : (booking as { depositCheckUrl?: string | null }).depositCheckUrl,
      depositCheckDetails: data.depositCheckDetails !== undefined ? data.depositCheckDetails || null : (booking as { depositCheckDetails?: unknown }).depositCheckDetails,
      contractText: data.contractText !== undefined
        ? (data.contractText?.trim() || null)
        : (booking as { contractText?: string | null }).contractText,
      paymentTemplateId: data.paymentTemplateId !== undefined
        ? (data.paymentTemplateId || null)
        : (booking as { paymentTemplateId?: string | null }).paymentTemplateId,
      paymentTermsText: data.paymentTermsText !== undefined
        ? (data.paymentTermsText?.trim() || null)
        : (booking as { paymentTermsText?: string | null }).paymentTermsText,
      upgrades: data.upgrades !== undefined && typeof data.upgrades === 'object' && data.upgrades !== null
        ? (data.upgrades as Record<string, boolean>)
        : (booking as { upgrades?: unknown }).upgrades ?? undefined,
      kosherType: data.kosherType !== undefined
        ? (data.kosherType || null)
        : (booking as { kosherType?: string | null }).kosherType,
      depositMethod: data.depositMethod !== undefined
        ? (data.depositMethod || null)
        : (booking as { depositMethod?: string | null }).depositMethod,
      vatType: data.vatType !== undefined
        ? (data.vatType === 'not_included' ? 'not_included' : 'included')
        : (booking as { vatType?: string | null }).vatType || 'included',
      updatedBy: req.user?.email || 'מערכת',
    };

    if (isConverting) {
      updateData.isOption = false;
      updateData.eventCode = convertedEventCode;
      updateData.clientSignatureUrl = contractFields.clientSignatureUrl;
      if (data.advancePaid !== undefined) {
        const paid = Number(data.advancePaid) || 0;
        updateData.advancePaid = paid;
        updateData.paidAmount = paid;
        updateData.totalPaid = paid;
        updateData.paymentStatus = paid > 0 ? 'PARTIAL' : 'pending';
      }
    } else if (!booking.isOption && data.advancePaid !== undefined) {
      const paid = Number(data.advancePaid) || 0;
      updateData.advancePaid = paid;
      updateData.paidAmount = paid;
      updateData.totalPaid = paid;
      updateData.paymentStatus = paid > 0 ? 'PARTIAL' : 'pending';
    }

    let updatedBooking;
    try {
      updatedBooking = await tx.booking.update({ where: { id },
      data: updateData,
      include: { eventDate: true },
    });
    } catch (updateErr) {
      if (slot && isSlotUniqueViolation(updateErr)) {
        throw slotUniqueConflictError(slot);
      }
      throw updateErr;
    }

    if (isConverting) {
      const remainingOptions = await tx.booking.count({
        where: { calendarDateId: booking.eventDate.id, isOption: true, id: { not: id },
            tenantId
        },
      });

      if (remainingOptions === 0) {
        await tx.eventDate.update({ where: { id: booking.eventDate.id }, data: { status: 'BOOKED', optionExpiresAt: null },
        });
      } else {
        await syncEventDateWithOptionBookings(tx, booking.eventDate.id);
      }

      const releaseDateIds: string[] = Array.isArray(data.releaseDateIds) ? data.releaseDateIds : [];
      if (releaseDateIds.length > 0) {
        await releaseOwnedOptionDates(tx, booking, releaseDateIds);
      }
    } else if (booking.isOption) {
      await syncEventDateWithOptionBookings(tx, booking.eventDate.id);

      if (data.optionDurationHours) {
        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + Number(data.optionDurationHours));
        await tx.eventDate.update({ where: { id: booking.eventDate.id },
          data: { optionExpiresAt: expiryDate },
        });
      }

      if (Array.isArray(data.allSelectedDates) && slot) {
        const optionExpiresAt = data.optionDurationHours
          ? (() => {
              const expiry = new Date();
              expiry.setHours(expiry.getHours() + Number(data.optionDurationHours));
              return expiry;
            })()
          : booking.eventDate.optionExpiresAt;

        const { updatedBy: _updatedBy, ...sharedFields } = updateData;
        await syncOptionDatesOnEdit(
          tx,
          { ...booking, eventDate: booking.eventDate },
          data,
          slot,
          timeString,
          sharedFields,
          prices,
          optionExpiresAt,
        );
      }
    }
    
    return updatedBooking;
  });

  if (isConverting) {
    emitDateUpdated({ dateId: booking.eventDate.id, status: 'BOOKED' });
    const releaseDateIds: string[] = Array.isArray(data.releaseDateIds) ? data.releaseDateIds : [];
    releaseDateIds.forEach((dateId: string) => {
      emitDateUpdated({ dateId, status: 'AVAILABLE' });
    });

    if (finalSignature && data.contractSigned) {
      try {
        const contractPdfBuffer = await generateContractPDF(
          buildBookingPdfData(
            { ...updated, eventDate: booking.eventDate },
            {
              isOption: false,
              clientSignatureUrl: finalSignature,
              contractText: updated.contractText,
              eventForm: {},
            },
          ),
        );
        const clientEmail = updated.clientAEmail || updated.clientBEmail;
        if (clientEmail) {
          await sendPDFToClient(
            clientEmail,
            updated.clientAFullName,
            booking.eventDate.date.toString(),
            contractPdfBuffer,
          );
        }
        await notifyContractClosedViaWhatsApp(
          { ...updated, eventDate: booking.eventDate },
          contractPdfBuffer,
        );
      } catch (pdfError) {
        logger.error('שגיאה בהפקת או שליחת חוזה ה-PDF:', pdfError);
      }
    }

    let easycountResult: EasyCountBookingResult | null = null;
    if (updated.advancePaid > 0) {
      try {
        easycountResult = await issueEasyCountReceiptForBooking(updated.id);
      } catch (easycountError) {
        logger.error('שגיאה בהפקת קבלת EZCount:', easycountError);
      }
      await ensureAdvanceOnLedger(updated.id).catch((ledgerError: unknown) => {
        logger.error('שגיאה ברישום מקדמה ליומן תשלומים:', ledgerError);
      });
    }

    const refreshed = await prisma.booking.findFirst({
      where: { id: updated.id,
          tenantId
    }, include: { eventDate: true } });

    return { status: 200, body: {
      success: true,
      message: 'האירוע נסגר ונשמר בהצלחה!',
      data: refreshed ?? updated,
      easycount: easycountResult,
    } };
  }

  emitDateUpdated({ dateId: booking.eventDate.id, status: booking.eventDate.status });
  emitBookingUpdated(id);

  let easycountResult: EasyCountBookingResult | null = null;
  if (!booking.isOption && updated.advancePaid > 0) {
    try {
      easycountResult = await issueEasyCountReceiptForBooking(updated.id);
    } catch (easycountError) {
      logger.error('שגיאה בהפקת קבלת EZCount:', easycountError);
    }
    await ensureAdvanceOnLedger(updated.id).catch((ledgerError: unknown) => {
      logger.error('שגיאה ברישום מקדמה ליומן תשלומים:', ledgerError);
    });
  }

  const responseBooking = easycountResult
    ? await prisma.booking.findFirst({ where: { id,
        tenantId
    }, include: { eventDate: true } })
    : updated;

  await invalidateCache('calendar');

  return { status: 200, body: {
    success: true,
    message: 'ההזמנה עודכנה בהצלחה.',
    data: responseBooking ?? updated,
    easycount: easycountResult,
  } };

}

export async function finalizeBooking(req: AuthRequest | Request): Promise<HttpResult> {

    const tenantId = (req as AuthRequest).user?.tenantId;
    if (!tenantId) return { status: 403, body: { error: 'Tenant context is missing.' } };
  const { bookingId, advancePaid, akumApprovalCode, hasMusic, clientSignature, tables } = req.body;

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId,
        tenantId
    }, include: { eventDate: true, eventForm: true }
  });

  if (!booking || !booking.eventDate) return { status: 404, body: { success: false, message: 'ההזמנה לא נמצאה.' } };

  let eventCode = convertOptionCodeToEventCode(booking.eventCode);
  if (!eventCode) {
    eventCode = await allocateEventCode('EVT');
  }

  const finalSignature = clientSignature || booking.clientSignatureUrl;
  const contractFields = syncContractFields(true, finalSignature);

  if (!contractFields.clientSignatureUrl) {
    return { status: 400, body: {
      success: false,
      message: 'לא ניתן לסגור הזמנה ללא חתימת לקוח.',
    } };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedBooking = await tx.booking.update({ where: { id: bookingId },
      data: {
        hasMusic,
        akumApprovalCode,
        advancePaid: Number(advancePaid),
        paidAmount: Number(advancePaid),
        paymentStatus: 'PARTIAL',
        isOption: false,
        eventCode,
        isContractSigned: contractFields.isContractSigned,
        clientSignatureUrl: contractFields.clientSignatureUrl,
      }
    });

    await tx.eventDate.update({ where: { id: booking.eventDate.id }, data: { status: 'BOOKED', optionExpiresAt: null }
    });

    if (tables && Array.isArray(tables)) {
      await tx.eventForm.upsert({
        where: { bookingId },
        update: {
          tables: {
            deleteMany: {},
            create: tables.map((table: any) => ({
              tenantId,
              tableNumber: table.id,
              positionX: table.x,
              positionY: table.y,
            }))
          }
        },
        create: {
          tenantId,
          bookingId,
          tables: {
            create: tables.map((table: any) => ({
              tenantId,
              tableNumber: table.id,
              positionX: table.x,
              positionY: table.y,
            }))
          }
        }
      });
    }

    return tx.booking.findFirst({
      where: { id: bookingId }
    });
  });

  if (finalSignature && updated) {
    try {
      const contractPdfBuffer = await generateContractPDF(
        buildBookingPdfData(
          { ...updated, eventDate: booking.eventDate, eventForm: booking.eventForm },
          { clientSignatureUrl: finalSignature },
        ),
      );
      
      const clientEmail = updated.clientAEmail || updated.clientBEmail;
      if (clientEmail) {
        await sendPDFToClient(
          clientEmail, 
          updated.clientAFullName, 
          booking.eventDate.date.toString(), 
          contractPdfBuffer
        );
      }
      await notifyContractClosedViaWhatsApp(
        { ...updated, eventDate: booking.eventDate },
        contractPdfBuffer,
      );
    } catch (pdfError) {
      logger.error("שגיאה בהפקת או שליחת חוזה ה-PDF:", pdfError);
    }
  }

  let easycountResult: EasyCountBookingResult | null = null;
  if (Number(advancePaid) > 0) {
    try {
      easycountResult = await issueEasyCountReceiptForBooking(bookingId);
    } catch (easycountError) {
      logger.error('שגיאה בהפקת קבלת EZCount:', easycountError);
    }
    await ensureAdvanceOnLedger(bookingId).catch((ledgerError: unknown) => {
      logger.error('שגיאה ברישום מקדמה ליומן תשלומים:', ledgerError);
    });
  }

  const refreshed = await prisma.booking.findFirst({
    where: { id: bookingId,
        tenantId
    }, include: { eventDate: true, eventForm: true } });

  emitDateUpdated({ dateId: booking.eventDate.id, status: 'BOOKED' });
  emitBookingUpdated(bookingId);
  return { status: 200, body: {
    success: true,
    message: 'האירוע נסגר והחוזה נחתם בהצלחה!',
    data: refreshed ?? updated,
    easycount: easycountResult,
  } };

}

export async function addEventAddition(req: AuthRequest | Request): Promise<HttpResult> {

    const tenantId = (req as AuthRequest).user?.tenantId;
    if (!tenantId) return { status: 403, body: { error: 'Tenant context is missing.' } };
  try {
    const bookingId = req.params.id as string; 
    const { description, cost, staffName, signature, agreedToTerms } = req.body;

    if (!agreedToTerms) {
      return { status: 400, body: { error: 'חובה להסכים לתנאי התשלום' } };
    }

    const newAddition = await prisma.$transaction(async (tx) => {
      const addition = await tx.eventAddition.create({
        data: {
          bookingId,
          description,
          cost: Number(cost),
          staffName,
          signature,
          agreedToTerms,
            tenantId
        }
      });

      const currentBookingList = await tx.$queryRaw<any[]>`
        SELECT "liveAdditionsTotal", "basePrice", "extrasPrice" 
        FROM "Booking" 
        WHERE id = ${bookingId} 
        FOR UPDATE
      `;
      const currentBooking = currentBookingList[0];
      if (currentBooking) {
        const additionCost = Number(cost) || 0;
        const currentLive = Number(currentBooking.liveAdditionsTotal) || 0;
        const newLiveTotal = currentLive + additionCost;
        const basePrice = Number(currentBooking.basePrice) || 0;
        const extrasPrice = Number(currentBooking.extrasPrice) || 0;

        await tx.booking.update({ where: { id: bookingId }, data: {
            liveAdditionsTotal: newLiveTotal,
            totalPrice: basePrice + extrasPrice + newLiveTotal,
          },
        });
      }
      
      return addition;
    });

    emitBookingUpdated(bookingId);
    return { status: 201, body: { message: 'התוספת נשמרה בהצלחה!', addition: newAddition } };
  } catch (error) {
    logger.error('Error adding event addition:', error);
    return { status: 500, body: { error: 'שגיאת שרת פנימית בעת שמירת התוספת' } };
  }

}
