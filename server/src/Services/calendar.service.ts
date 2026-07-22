// @ts-ignore
import hebcal from 'hebcal';
import prisma from "../config/prisma";
import { emitDateUpdated } from "../utils/realtime";
import {
  normalizeTimeSlot,
  formatStoredTimeOfDay,
  getBlockedSlotsForDate,
  parseDateLocal,
  toLocalDateKey,
  isDateFullyBooked,
} from '../utils/timeSlot';
import { resolveBookingSlot } from '../utils/bookingDateValidation';
import { allocateEventCode } from '../utils/eventCode';
import { extractHallPriceBreakdown } from '../utils/hallBilling';
import {
  toCalendarDateKey,
  calendarDateForStorage,
  prismaCalendarDayWhere,
  parseCalendarDate,
} from '../utils/dateLocal';
import {
  assertSlotAvailableAfterLock,
  HttpError,
  lockEventDateRow,
} from '../utils/eventDateLock';
import { isSlotUniqueViolation, slotUniqueConflictError } from '../utils/bookingSlotGuard';

export enum EventStatus {
  AVAILABLE = 'AVAILABLE',
  CHECKING  = 'CHECKING',
  OPTION    = 'OPTION',
  BOOKED    = 'BOOKED',
  BLOCKED   = 'BLOCKED',      // חסום לגמרי (אדום - כמו שבת)
  FORBIDDEN = 'FORBIDDEN',    // אסור לאירוע (ורוד - חגים/צומות קשים)
  PROBLEMATIC = 'PROBLEMATIC' // תאריך דפוק/אפשרי חלקית (כתום)
}

const HEBREW_NUMERALS: Record<number, string> = {
  1:'א',2:'ב',3:'ג',4:'ד',5:'ה',6:'ו',7:'ז',8:'ח',9:'ט',10:'י',
  11:'יא',12:'יב',13:'יג',14:'יד',15:'טו',16:'טז',17:'יז',18:'יח',19:'יט',20:'כ',
  21:'כא',22:'כב',23:'כג',24:'כד',25:'כה',26:'כו',27:'כז',28:'כח',29:'כט',30:'ל'
};

const HEBREW_MONTHS: Record<number, string> = {
  1:'ניסן',2:'אייר',3:'סיון',4:'תמוז',5:'אב',6:'אלול',
  7:'תשרי',8:'חשון',9:'כסלו',10:'טבת',11:'שבט',12:'אדר',13:'אדר ב'
};

function formatHebrewDate(hDate: any): string {
  const day   = hDate.getDate();
  let month = HEBREW_MONTHS[hDate.getMonth()] || hDate.getMonthName('he');
  
  // בונוס תצוגה: אם אנחנו בשנה מעוברת והחודש הוא 12, זה אדר א'
  if (hDate.isLeapYear() && hDate.getMonth() === 12) {
    month = "אדר א'";
  }

  return `${HEBREW_NUMERALS[day] || day} ב${month}`;
}

function toNoon(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
}

export function getDayStaticStatus(jsDate: Date, eventType: string = 'חתונה'): { type: EventStatus; reason?: string } {
  const jsDay = jsDate.getDay();
  const noon = toNoon(jsDate);
  const hDate = new hebcal.HDate(noon);
  const hMonth: number = hDate.getMonth();
  const hDay: number = hDate.getDate();

  // ==========================================
  // 1. שבתות וימי שישי (רלוונטי לכולם)
  // ==========================================
  if (jsDay === 6) {
    return { type: EventStatus.PROBLEMATIC, reason: 'שבת' };
  }
  if (jsDay === 5) {
    const reason = 'יום שישי (בוקר בלבד)';
    if (eventType === 'חתונה') {
      return { type: EventStatus.PROBLEMATIC, reason };
    }
    return { type: EventStatus.AVAILABLE, reason };
  }

  const holidays: any[] = hDate.holidays(true) || [];
  const yomTovEvent = holidays.find((e: any) => (e.LIGHT_CANDLES_TZEIS || e.YOM_TOV_ENDS) && !e.CHUL_ONLY);
  const descHe = (e: any): string => e.desc[2] || e.desc[0] || '';
  
  // ==========================================
  // 2. חגים וצומות שאסורים לכל סוגי האירועים!
  // ==========================================

  // --- ניסן (1) - פסח ---
  if (hMonth === 1) {
    if (hDay === 14) return { type: EventStatus.FORBIDDEN, reason: 'חג הפסח' }; 
    if (hDay === 15) return { type: EventStatus.FORBIDDEN, reason: 'פסח' };
    if (hDay >= 16 && hDay <= 20) return { type: EventStatus.FORBIDDEN, reason: 'חול המועד פסח' };
    if (hDay === 21) return { type: EventStatus.FORBIDDEN, reason: 'שביעי של פסח' };
  }

  // --- סיוון (3) - שבועות ---
  if (hMonth === 3) {
    if (hDay >= 3 && hDay <= 5) return { type: EventStatus.FORBIDDEN, reason: 'ימי הגבלה / ערב חג' };
    if (hDay === 6) return { type: EventStatus.FORBIDDEN, reason: 'שבועות' };
  }

  // --- תמוז (4) - שבעה עשר בתמוז ---
  if (hMonth === 4 && hDay === 17) return { type: EventStatus.FORBIDDEN, reason: 'י"ז בתמוז' };

  // --- אב (5) - תשעה באב ---
  if (hMonth === 5 && hDay === 9) return { type: EventStatus.FORBIDDEN, reason: 'תשעה באב' }; 

  // --- תשרי (7) - חגי תשרי ---
  if (hMonth === 7) {
    if (hDay === 1 || hDay === 2) return { type: EventStatus.FORBIDDEN, reason: 'ראש השנה' };
    if (hDay === 9) return { type: EventStatus.FORBIDDEN, reason: 'ערב יום כיפור' };
    if (hDay === 10) return { type: EventStatus.FORBIDDEN, reason: 'יום כיפור' };
    if (hDay === 13 || hDay === 14) return { type: EventStatus.FORBIDDEN, reason: 'ערב חג סוכות' };
    if (hDay === 15) return { type: EventStatus.FORBIDDEN, reason: 'חג סוכות' };
    if (hDay >= 16 && hDay <= 21) return { type: EventStatus.FORBIDDEN, reason: 'חול המועד סוכות' };
    if (hDay === 22) return { type: EventStatus.FORBIDDEN, reason: 'שמיני עצרת' };
  }

  // --- התיקון המקצועי לשנה מעוברת! (פורים רק באדר רגיל או אדר ב') ---
  const isLeapYear = hDate.isLeapYear();
  const isPurimMonth = (!isLeapYear && hMonth === 12) || (isLeapYear && hMonth === 13);
  
  if (isPurimMonth) {
    const isTaAnitEsther = holidays.some((e:any) => e.desc[0] === "Ta'anit Esther" || e.desc[0] === "Ta'anit Ester");
    if (isTaAnitEsther || hDay === 13) return { type: EventStatus.FORBIDDEN, reason: 'תענית אסתר' };
    if (hDay === 14) return { type: EventStatus.FORBIDDEN, reason: 'פורים' };
    if (hDay === 15) return { type: EventStatus.FORBIDDEN, reason: 'שושן פורים' };
  }

  if (yomTovEvent && hMonth !== 1) return { type: EventStatus.FORBIDDEN, reason: descHe(yomTovEvent) };


  // ==========================================
  // 3. אירועים שאינם חתונה - פתוח כמעט לגמרי!
  // ==========================================
  if (eventType !== 'חתונה') {
    if (hMonth === 6 && hDay === 29) return { type: EventStatus.PROBLEMATIC, reason: 'ערב ראש השנה' };
    if (hMonth === 7 && hDay >= 3 && hDay <= 8) return { type: EventStatus.PROBLEMATIC, reason: 'עשרת ימי תשובה' };
    if (hMonth === 7 && (hDay === 11 || hDay === 12)) return { type: EventStatus.AVAILABLE, reason: 'ערב סוכות' }; 
    if (hMonth === 10 && hDay === 10) return { type: EventStatus.PROBLEMATIC, reason: 'עשרה בטבת' };
    return { type: EventStatus.AVAILABLE };
  }


  // ==========================================
  // 4. חוקים מיוחדים לחופות וחתונות בלבד
  // ==========================================

  if (hMonth === 1) {
    if (hDay >= 7 && hDay <= 10) return { type: EventStatus.PROBLEMATIC, reason: 'תאריך דפוק' };
    if (hDay >= 11 && hDay <= 13) return { type: EventStatus.FORBIDDEN, reason: 'ערב פסח' };
    if (hDay >= 22) return { type: EventStatus.FORBIDDEN, reason: 'ספירת העומר ' };
  }

  if (hMonth === 2) {
    if (hDay === 18) {
       return { type: EventStatus.AVAILABLE, reason: 'ל"ג בעומר' };
    } else if (hDay >= 19) {
       return { type: EventStatus.PROBLEMATIC,  }; 
    } else {
       return { type: EventStatus.FORBIDDEN, reason: 'ספירת העומר ' };
    }
  }

  if (hMonth === 3 && hDay <= 2) return { type: EventStatus.PROBLEMATIC, reason: 'תחילת סיוון ' };

  if (hMonth === 4) {
    if (hDay === 16) return { type: EventStatus.PROBLEMATIC, reason: 'ערב י"ז בתמוז' };
    if (hDay >= 18) return { type: EventStatus.FORBIDDEN, reason: 'שלושת השבועות ' };
  }

  if (hMonth === 5) {
    if (hDay <= 8) return { type: EventStatus.FORBIDDEN, reason: 'תשעת הימים ' };
    if (hDay >= 10 && hDay <= 30) return { type: EventStatus.PROBLEMATIC, reason: 'בין הזמנים' };
  }

  if (hMonth === 6) {
    if (hDay === 29) return { type: EventStatus.PROBLEMATIC, reason: 'ערב ראש השנה' };
  }

  if (hMonth === 7) {
    if (hDay >= 3 && hDay <= 8) return { type: EventStatus.PROBLEMATIC, reason: 'עשרת ימי תשובה' };
    if (hDay === 11 || hDay === 12) return { type: EventStatus.PROBLEMATIC, reason: 'ערב סוכות' }; 
  }

  if (hMonth === 10 && hDay === 10) return { type: EventStatus.PROBLEMATIC, reason: 'עשרה בטבת' };
  
  return { type: EventStatus.AVAILABLE };
}

const CHECKING_HOLD_MINUTES = 30;
const DEFAULT_OPTION_HOURS = 48;

function checkingExpiry(): Date {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + CHECKING_HOLD_MINUTES);
  return expiry;
}

function defaultOptionExpiry(hours = DEFAULT_OPTION_HOURS): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hours);
  return expiry;
}

function mapHttpError(error: unknown): never {
  if (error instanceof HttpError) {
    const err = new Error(error.message);
    (err as any).statusCode = error.statusCode;
    throw err;
  }
  throw error;
}

export const calendarService = {
  // שליפה של כל האירועים ביום (עד 3)
  async getAllCalendarDates(startDate: Date, endDate: Date, eventType: string = 'חתונה') {
    const datesInRange = await prisma.eventDate.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      include: { bookings: { include: { eventForm: true, eventCheckIn: true } } }
    });
    
    const result = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateKey = toLocalDateKey(current);
      const hDate = new hebcal.HDate(toNoon(current));
      const staticSt = getDayStaticStatus(current, eventType);
      const blockedSlots = getBlockedSlotsForDate(current);
      
      const recordsForDay = datesInRange.filter((d: any) => toLocalDateKey(new Date(d.date)) === dateKey);
      const record =
        recordsForDay.find((d: any) => d.status === EventStatus.BOOKED) ||
        recordsForDay.find((d: any) => d.status === EventStatus.OPTION) ||
        recordsForDay.find((d: any) => (d.bookings?.length ?? 0) > 0) ||
        recordsForDay[0];
      const bookings = recordsForDay.flatMap((d: any) => d.bookings || []);

      const dbStatus = recordsForDay.some((d: any) => d.status === EventStatus.BOOKED)
        ? EventStatus.BOOKED
        : recordsForDay.some((d: any) => d.status === EventStatus.OPTION)
          ? EventStatus.OPTION
          : record?.status;
      const hasBookingStatus = dbStatus === EventStatus.OPTION || dbStatus === EventStatus.BOOKED;

      result.push({
        id: record?.id || null,
        date: dateKey,
        dayOfWeek: current.getDay(),
        hebrewDate: formatHebrewDate(hDate),
        status: hasBookingStatus
          ? dbStatus
          : staticSt.type,
        reason: staticSt.reason || null,
        blockedSlots,
        bookings: bookings 
      });
      current.setDate(current.getDate() + 1);
    }
    return result;
  },

  // סגירה סופית עם מניעת התנגשויות זמן
  async bookEventFinal(dateId: string, bookingDetails: any) {
    const booking = await prisma.$transaction(async (tx) => {
      await lockEventDateRow(tx, dateId);

      const eventDateRecord = await tx.eventDate.findUnique({
        where: { id: dateId },
        include: { bookings: true },
      });
      if (!eventDateRecord) {
        throw new HttpError('תאריך האירוע לא נמצא.', 404);
      }

      const calendarKey = toLocalDateKey(new Date(eventDateRecord.date));
      const existing = eventDateRecord.bookings;

      if (isDateFullyBooked(parseDateLocal(eventDateRecord.date), existing)) {
        throw new HttpError('התאריך מלא — אין משבצות זמן פנויות.', 400);
      }

      const slot = resolveBookingSlot(
        bookingDetails.timeOfDay,
        bookingDetails.startTime,
        bookingDetails.endTime,
        false,
      );

      if (!slot) {
        throw new HttpError('יש לבחור משבצת זמן: בוקר, צהריים או ערב.', 400);
      }

      assertSlotAvailableAfterLock(
        calendarKey,
        slot,
        existing,
        bookingDetails.eventType || 'חתונה',
      );

      const storedTime = formatStoredTimeOfDay(slot, bookingDetails.startTime, bookingDetails.endTime);
      const eventCode = await allocateEventCode('EVT', tx);
      const totals = bookingDetails.calculatedTotals;
      const priceBreakdown = extractHallPriceBreakdown(bookingDetails, 0);
      const basePrice = Number(totals?.baseTotal ?? priceBreakdown.basePrice) || 0;
      const extrasPrice = Number(totals?.hallExtrasTotal ?? totals?.extrasTotal ?? priceBreakdown.extrasPrice) || 0;
      const externalExtrasPrice = Number(totals?.externalExtrasTotal ?? priceBreakdown.externalExtrasPrice) || 0;
      const totalPrice = priceBreakdown.totalPrice;

      try {
        const created = await tx.booking.create({
          data: {
            tenant: { connect: { id: String((bookingDetails as any).tenantId) } },
            clientAFullName: bookingDetails.clientAFullName,
            clientAIdNumber: bookingDetails.clientAIdNumber || '',
            clientAPhone: bookingDetails.clientAPhone,
            clientAEmail: bookingDetails.clientAEmail || null,
            clientAAddress: bookingDetails.clientAAddress || null,
            clientBFullName: bookingDetails.clientBFullName || null,
            clientBIdNumber: bookingDetails.clientBIdNumber || null,
            clientBPhone: bookingDetails.clientBPhone || null,
            clientBEmail: bookingDetails.clientBEmail || null,
            clientBAddress: bookingDetails.clientBAddress || null,
            eventType: bookingDetails.eventType,
            timeOfDay: storedTime,
            timeSlot: slot,
            guestCount: Number(bookingDetails.guestCount) || 0,
            minimumGuestCount: Number(bookingDetails.minimumGuestCount) || Number(bookingDetails.guestCount) || 0,
            finalPricePortion: Number(bookingDetails.finalPricePortion) || 0,
            basePrice,
            extrasPrice,
            externalExtrasPrice,
            liveAdditionsTotal: 0,
            totalPrice,
            hallRentalPrice: bookingDetails.hallRentalPrice != null ? Number(bookingDetails.hallRentalPrice) : null,
            hasMusic: bookingDetails.hasMusic !== undefined ? bookingDetails.hasMusic : true,
            akumApprovalCode: bookingDetails.akumApprovalCode || null,
            managerComments: bookingDetails.managerComments || null,
            clientComments: bookingDetails.clientComments || null,
            createdBy: bookingDetails.createdBy,
            advancePaid: 0,
            totalPaid: 0,
            securityCheckStatus: 'PENDING',
            isContractSigned: !!(bookingDetails.contractSigned && bookingDetails.clientSignature),
            clientSignatureUrl: bookingDetails.clientSignature || null,
            depositCheckUrl: bookingDetails.depositCheckUrl || null,
            depositCheckDetails: bookingDetails.depositCheckDetails || null,
            contractText: bookingDetails.contractText?.trim() || null,
            isOption: false,
            eventDate: { connect: { id: dateId } },
            eventCode,
          },
        });

        await tx.eventDate.update({
          where: { id: dateId },
          data: {
            status: EventStatus.BOOKED,
            optionExpiresAt: null,
            lockedBy: null,
            clientName: null,
            clientPhone: null,
            clientEmail: null,
          },
        });

        return created;
      } catch (createErr: unknown) {
        if (isSlotUniqueViolation(createErr)) {
          throw slotUniqueConflictError(slot);
        }
        throw createErr;
      }
    });

    emitDateUpdated({ dateId, status: 'BOOKED' });
    return booking;
  },

  /** נעילת תאריך זמנית בזמן בדיקה/מילוי טופס (30 דקות) */
  async lockDateForChecking(dateStr: string, employeeName: string, tenantId: string) {
    try {
      const calendarKey = toCalendarDateKey(dateStr);

      return await prisma.$transaction(async (tx) => {
        let eventDate = await tx.eventDate.findFirst({
          where: prismaCalendarDayWhere(calendarKey),
          include: { bookings: true },
        });

        if (eventDate) {
          await lockEventDateRow(tx, eventDate.id);
          eventDate = await tx.eventDate.findUnique({
            where: { id: eventDate.id },
            include: { bookings: true },
          });
        }

        if (eventDate) {
          const hasConfirmed = eventDate!.bookings.some((b) => !b.isOption);
          if (hasConfirmed || eventDate!.status === EventStatus.BOOKED) {
            throw new HttpError('לא ניתן לנעול תאריך שכבר מוזמן.', 409);
          }

          if (
            eventDate!.status === EventStatus.CHECKING
            && eventDate!.lockedBy
            && eventDate!.lockedBy !== employeeName
            && eventDate!.optionExpiresAt
            && eventDate!.optionExpiresAt > new Date()
          ) {
            throw new HttpError(`התאריך נבדק על ידי ${eventDate!.lockedBy}.`, 409);
          }
        }

        const expiry = checkingExpiry();

        if (!eventDate) {
          eventDate = await tx.eventDate.create({
            data: {
              tenant: { connect: { id: tenantId } },
              date: new Date(calendarKey),
              status: EventStatus.CHECKING,
              lockedBy: employeeName,
              optionExpiresAt: expiry,
            },
            include: { bookings: true },
          });
        } else {
          eventDate = await tx.eventDate.update({
            where: { id: eventDate.id },
            data: {
              status: EventStatus.CHECKING,
              lockedBy: employeeName,
              optionExpiresAt: expiry,
            },
            include: { bookings: true },
          });
        }

        emitDateUpdated({ dateId: eventDate.id, status: EventStatus.CHECKING });
        return eventDate;
      });
    } catch (error) {
      mapHttpError(error);
    }
  },

  /** שחרור נעילת CHECKING */
  async releaseDate(dateStr: string) {
    try {
      const calendarKey = toCalendarDateKey(dateStr);

      return await prisma.$transaction(async (tx) => {
        const eventDate = await tx.eventDate.findFirst({
          where: prismaCalendarDayWhere(calendarKey),
          include: { bookings: true },
        });

        if (!eventDate) {
          throw new HttpError('תאריך לא נמצא.', 404);
        }

        await lockEventDateRow(tx, eventDate.id);

        const hasBookings = eventDate.bookings.length > 0;
        const nextStatus = hasBookings
          ? (eventDate.bookings.some((b) => !b.isOption) ? EventStatus.BOOKED : EventStatus.OPTION)
          : EventStatus.AVAILABLE;

        const updated = await tx.eventDate.update({
          where: { id: eventDate.id },
          data: {
            status: nextStatus,
            lockedBy: null,
            optionExpiresAt: hasBookings ? eventDate.optionExpiresAt : null,
          },
        });

        emitDateUpdated({ dateId: updated.id, status: nextStatus });
        return updated;
      });
    } catch (error) {
      mapHttpError(error);
    }
  },

  /** יצירת אופציה מלאה על תאריך בודד */
  async createOption(dateId: string, bookingDetails: any) {
    try {
      const optionHours = Number(bookingDetails.optionDurationHours) || DEFAULT_OPTION_HOURS;
      const expiry = defaultOptionExpiry(optionHours);

      const booking = await prisma.$transaction(async (tx) => {
        await lockEventDateRow(tx, dateId);

        const eventDateRecord = await tx.eventDate.findUnique({
          where: { id: dateId },
          include: { bookings: true },
        });
        if (!eventDateRecord) {
          throw new HttpError('תאריך האירוע לא נמצא.', 404);
        }

        const calendarKey = toLocalDateKey(new Date(eventDateRecord.date));
        const slot = resolveBookingSlot(
          bookingDetails.timeOfDay,
          bookingDetails.startTime,
          bookingDetails.endTime,
          true,
        ) || 'evening';

        assertSlotAvailableAfterLock(
          calendarKey,
          slot,
          eventDateRecord.bookings,
          bookingDetails.eventType || 'חתונה',
          { isOption: true },
        );

        const storedTime = formatStoredTimeOfDay(slot, bookingDetails.startTime, bookingDetails.endTime);
        const eventCode = await allocateEventCode('OPT', tx);
        const priceBreakdown = extractHallPriceBreakdown(bookingDetails, 0);

        let created;
        try {
          created = await tx.booking.create({
            data: {
              tenant: { connect: { id: String((bookingDetails as any).tenantId) } },
              clientAFullName: bookingDetails.clientAFullName || '',
              clientAIdNumber: bookingDetails.clientAIdNumber || '',
              clientAPhone: bookingDetails.clientAPhone || '',
              clientAEmail: bookingDetails.clientAEmail || null,
              clientAAddress: bookingDetails.clientAAddress || null,
              clientBFullName: bookingDetails.clientBFullName || null,
              clientBIdNumber: bookingDetails.clientBIdNumber || null,
              clientBPhone: bookingDetails.clientBPhone || null,
              clientBEmail: bookingDetails.clientBEmail || null,
              clientBAddress: bookingDetails.clientBAddress || null,
              eventType: bookingDetails.eventType,
              timeOfDay: storedTime,
              timeSlot: slot,
              guestCount: Number(bookingDetails.guestCount) || 0,
              minimumGuestCount: Number(bookingDetails.minimumGuestCount) || Number(bookingDetails.guestCount) || 0,
              finalPricePortion: Number(bookingDetails.finalPricePortion) || 0,
              basePrice: priceBreakdown.basePrice,
              extrasPrice: priceBreakdown.extrasPrice,
              externalExtrasPrice: priceBreakdown.externalExtrasPrice,
              liveAdditionsTotal: 0,
              totalPrice: priceBreakdown.totalPrice,
              hallRentalPrice: bookingDetails.hallRentalPrice != null ? Number(bookingDetails.hallRentalPrice) : null,
              hasMusic: bookingDetails.hasMusic !== undefined ? bookingDetails.hasMusic : true,
              createdBy: bookingDetails.createdBy,
              isOption: true,
              optionDurationHours: optionHours,
              eventDate: { connect: { id: dateId } },
              eventCode,
            },
          });
        } catch (createErr: unknown) {
          if (isSlotUniqueViolation(createErr)) {
            throw slotUniqueConflictError(slot);
          }
          throw createErr;
        }

        await tx.eventDate.update({
          where: { id: dateId },
          data: {
            status: EventStatus.OPTION,
            optionExpiresAt: expiry,
            lockedBy: null,
            clientName: bookingDetails.clientAFullName,
            clientPhone: bookingDetails.clientAPhone,
            clientEmail: bookingDetails.clientAEmail || null,
          },
        });

        return created;
      });

      emitDateUpdated({ dateId, status: 'OPTION' });
      return booking;
    } catch (error) {
      mapHttpError(error);
    }
  },

  /** שמירת hold רך לכמה תאריכי אופציה (לפני מילוי טופס מלא) */
  async saveOptionHold(
    tenantId: string,
    dates: string[],
    clientName: string,
    clientPhone: string,
    clientEmail: string,
  ) {
    if (dates.length === 0) {
      throw new HttpError('חובה לבחור לפחות תאריך אחד.', 400);
    }
    if (dates.length > 3) {
      throw new HttpError('ניתן לשמור עד 3 תאריכים לאופציה.', 400);
    }

    const uniqueKeys = [...new Set(dates.map((d) => toCalendarDateKey(d)))];
    const expiry = defaultOptionExpiry();

    try {
      const results = await prisma.$transaction(async (tx) => {
        const saved: unknown[] = [];

        for (const calendarKey of uniqueKeys) {
          let eventDate = await tx.eventDate.findFirst({
            where: prismaCalendarDayWhere(calendarKey),
            include: { bookings: true },
          });

          if (eventDate) {
            await lockEventDateRow(tx, eventDate.id);
            eventDate = await tx.eventDate.findUnique({
              where: { id: eventDate.id },
              include: { bookings: true },
            });
          }

          if (eventDate?.bookings.some((b) => !b.isOption)) {
            throw new HttpError(`${calendarKey}: התאריך כבר מוזמן.`, 409);
          }

          if (!eventDate) {
            eventDate = await tx.eventDate.create({
              data: {
                tenant: { connect: { id: tenantId } },
                date: calendarDateForStorage(calendarKey),
                status: EventStatus.OPTION,
                optionExpiresAt: expiry,
                clientName,
                clientPhone,
                clientEmail: clientEmail || null,
              },
              include: { bookings: true },
            });
          } else {
            eventDate = await tx.eventDate.update({
              where: { id: eventDate.id },
              data: {
                status: EventStatus.OPTION,
                optionExpiresAt: expiry,
                clientName,
                clientPhone,
                clientEmail: clientEmail || null,
                lockedBy: null,
              },
              include: { bookings: true },
            });
          }

          saved.push(eventDate);
          emitDateUpdated({ dateId: eventDate.id, status: EventStatus.OPTION });
        }

        return saved;
      });

      return results;
    } catch (error) {
      mapHttpError(error);
    }
  },
};