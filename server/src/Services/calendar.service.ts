// @ts-ignore
import hebcal from 'hebcal';
import prisma from "../config/prisma";
import { io } from "../server";
import { normalizeTimeSlot, getTakenSlots, SLOT_LABELS, formatStoredTimeOfDay, getBlockedSlotsForDate, isDateFullyBooked, validateSlotOnDate, parseDateLocal } from '../utils/timeSlot';
import { validateSlotAvailability, resolveBookingSlot } from '../utils/bookingDateValidation';
import { allocateEventCode } from '../utils/eventCode';

export enum EventStatus {
  AVAILABLE = 'AVAILABLE',
  CHECKING  = 'CHECKING',
  OPTION    = 'OPTION',
  BOOKED    = 'BOOKED',
  BLOCKED   = 'BLOCKED',      // חסום לגמרי (אדום - כמו שבת)
  FORBIDDEN = 'FORBIDDEN',    // אסור לאירוע (ורוד - חגים/צומות קשים)
  PROBLEMATIC = 'PROBLEMATIC' // תאריך דפוק/אפשרי חלקית (כתום)
}

function toLocalDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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
    if (eventType === 'חתונה') {
      return { type: EventStatus.PROBLEMATIC, reason: 'יום שישי ' };
    } else {
      return { type: EventStatus.AVAILABLE, reason: 'יום שישי (בוקר בלבד)' };
    }
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

export const calendarService = {
  // שליפה של כל האירועים ביום (עד 3)
  async getAllCalendarDates(startDate: Date, endDate: Date, eventType: string = 'חתונה') {
    const datesInRange = await prisma.eventDate.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      include: { bookings: true }
    });
    
    const result = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateKey = toLocalDateKey(current);
      const hDate = new hebcal.HDate(toNoon(current));
      const staticSt = getDayStaticStatus(current, eventType);
      const blockedSlots = getBlockedSlotsForDate(current);
      
      const record = datesInRange.find((d: any) => toLocalDateKey(new Date(d.date)) === dateKey);
      const bookings = record?.bookings || [];

      const dbStatus = record?.status;
      const hasBookingStatus = dbStatus === EventStatus.OPTION || dbStatus === EventStatus.BOOKED;
      const fullyBooked = isDateFullyBooked(current, bookings);

      result.push({
        id: record?.id || null,
        date: dateKey,
        dayOfWeek: current.getDay(),
        hebrewDate: formatHebrewDate(hDate),
        status: fullyBooked
          ? EventStatus.BLOCKED
          : hasBookingStatus
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
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "EventDate" WHERE id = ${dateId} FOR UPDATE`;

      const eventDateRecord = await tx.eventDate.findUnique({ where: { id: dateId } });
      if (!eventDateRecord) {
        const error = new Error('תאריך האירוע לא נמצא.');
        (error as any).statusCode = 404;
        throw error;
      }

      const existing = await tx.booking.findMany({
        where: { eventDate: { id: dateId } },
      });

      if (isDateFullyBooked(parseDateLocal(eventDateRecord.date), existing)) {
        const error = new Error('התאריך מלא — אין משבצות זמן פנויות.');
        (error as any).statusCode = 400;
        throw error;
      }

      const slot = resolveBookingSlot(
        bookingDetails.timeOfDay,
        bookingDetails.startTime,
        bookingDetails.endTime,
        false
      );

      if (!slot) {
        const error = new Error('יש לבחור משבצת זמן: בוקר, צהריים או ערב.');
        (error as any).statusCode = 400;
        throw error;
      }

      const slotAvailabilityError = validateSlotAvailability(
        parseDateLocal(eventDateRecord.date),
        slot,
        existing,
        bookingDetails.eventType || 'חתונה'
      );
      if (slotAvailabilityError) {
        const error = new Error(slotAvailabilityError);
        (error as any).statusCode = 400;
        throw error;
      }

      const storedTime = formatStoredTimeOfDay(slot, bookingDetails.startTime, bookingDetails.endTime);
      const eventCode = await allocateEventCode('EVT');

      try {
        const booking = await tx.booking.create({
          data: {
            ...bookingDetails,
            timeOfDay: storedTime,
            timeSlot: slot,
            eventDate: { connect: { id: dateId } },
            eventCode,
          },
        });

        io.emit('date-updated', { dateId, status: 'BOOKED' });
        return booking;
      } catch (createErr: any) {
        if (createErr?.code === 'P2002') {
          const error = new Error(`כבר קיים אירוע ב${SLOT_LABELS[slot]} בתאריך זה!`);
          (error as any).statusCode = 409;
          throw error;
        }
        throw createErr;
      }
    });
  },

  async lockDateForChecking(dateStr: string, employeeName: string) { /* ... */ },
  async releaseDate(dateStr: string) { /* ... */ },
  async createOption(dateId: string, bookingDetails: any) { /* ... */ },
  async saveOptionHold(dates: string[], clientName: string, clientPhone: string, clientEmail: string) { /* ... */ }
};