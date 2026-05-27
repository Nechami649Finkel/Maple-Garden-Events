const hebcal = require('hebcal');
import prisma from "../config/prisma";
import { io } from "../server";

export enum EventStatus {
  AVAILABLE = 'AVAILABLE',
  CHECKING  = 'CHECKING',
  OPTION    = 'OPTION',
  BOOKED    = 'BOOKED',
  BLOCKED   = 'BLOCKED',
  FORBIDDEN = 'FORBIDDEN'
}

// קואורדינטות מרכז הארץ (תל אביב)
const LAT = 32.0853;
const LNG = 34.7818;

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
  const month = HEBREW_MONTHS[hDate.getMonth()] || hDate.getMonthName('he');
  return `${HEBREW_NUMERALS[day] || day} ב${month}`;
}

function getCandleTime(jsDate: Date): string | null {
  if (jsDate.getDay() !== 5) return null;
  try {
    const hDate = new hebcal.HDate(jsDate);
    hDate.setLocation(LAT, LNG);
    const cl: Date = hDate.candleLighting();
    if (!cl) return null;
    return `${cl.getHours()}:${String(cl.getMinutes()).padStart(2, '0')}`;
  } catch {
    return null;
  }
}

function getDayStaticStatus(jsDate: Date): { type: EventStatus; reason?: string } {
  const jsDay = jsDate.getDay();
  const hDate = new hebcal.HDate(jsDate);
  const holidays: any[] = hDate.holidays(true) || [];

  // שבת
  if (jsDay === 6) return { type: EventStatus.BLOCKED, reason: 'שבת' };

  // יום טוב (LIGHT_CANDLES_TZEIS = נרות בצאת = יום טוב עצמו, YOM_TOV_ENDS = יום טוב שנגמר)
  const isYomTov = holidays.some((e: any) => e.LIGHT_CANDLES_TZEIS || e.YOM_TOV_ENDS);
  if (isYomTov) {
    const name = holidays[0]?.desc[2] || holidays[0]?.desc[0] || 'יום טוב';
    return { type: EventStatus.BLOCKED, reason: name };
  }

  // ערב חג / צום (LIGHT_CANDLES = מדליקים נרות = ערב חג)
  if (jsDay === 5) return { type: EventStatus.FORBIDDEN, reason: 'יום שישי' };

  const isErev = holidays.some((e: any) => e.LIGHT_CANDLES);
  if (isErev) {
    const name = holidays[0]?.desc[2] || holidays[0]?.desc[0] || 'ערב חג';
    return { type: EventStatus.FORBIDDEN, reason: name };
  }

  // צומות - לפי שם
  const isFast = holidays.some((e: any) => {
    const desc: string = e.desc[0] || '';
    return desc.includes('Fast') || desc.includes('Tzom') || desc.includes('Tisha') || desc.includes('Asara');
  });
  if (isFast) {
    const name = holidays[0]?.desc[2] || holidays[0]?.desc[0] || 'יום צום';
    return { type: EventStatus.FORBIDDEN, reason: name };
  }

  // בין המצרים (י"ז תמוז = חודש 4 יום 17, עד ט' באב = חודש 5 יום 9)
  const hMonth = hDate.getMonth();
  const hDay   = hDate.getDate();
  if ((hMonth === 4 && hDay >= 17) || (hMonth === 5 && hDay <= 9)) {
    return { type: EventStatus.FORBIDDEN, reason: 'בין המצרים' };
  }

  return { type: EventStatus.AVAILABLE };
}

export const calendarService = {

  async getAllCalendarDates(startDate: Date, endDate: Date) {
    const dbDates = await prisma.eventDate.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      include: { booking: true }
    });

    const dbMap = new Map(dbDates.map(d => [
      new Date(d.date).toISOString().split('T')[0], d
    ]));

    const result = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateKey  = current.toISOString().split('T')[0];
      const hDate    = new hebcal.HDate(new Date(current));
      const staticSt = getDayStaticStatus(new Date(current));
      const dbRecord = dbMap.get(dateKey);

      let finalStatus = staticSt.type;
      if (finalStatus === EventStatus.AVAILABLE && dbRecord) {
        finalStatus = dbRecord.status as EventStatus;
      }

      result.push({
        id:         dbRecord?.id   || null,
        date:       dateKey,
        dayOfWeek:  current.getDay(),
        hebrewDate: formatHebrewDate(hDate),
        status:     finalStatus,
        reason:     staticSt.reason || null,
        candleTime: getCandleTime(new Date(current)),
        lockedBy:   dbRecord?.lockedBy || null,
        booking:    dbRecord?.booking  || null
      });

      current.setDate(current.getDate() + 1);
    }

    return result;
  },

  async lockDateForChecking(dateStr: string, employeeName: string) {
    const targetDate = new Date(dateStr);
    const st = getDayStaticStatus(targetDate);
    if (st.type !== EventStatus.AVAILABLE) {
      throw new Error(`לא ניתן לנעול יום זה: ${st.reason}`);
    }
    const updated = await prisma.eventDate.upsert({
      where:  { date: targetDate },
      update: { status: EventStatus.CHECKING, lockedBy: employeeName },
      create: { date: targetDate, status: EventStatus.CHECKING, lockedBy: employeeName }
    });
    io.emit('date-updated', { date: dateStr, status: EventStatus.CHECKING, lockedBy: employeeName, id: updated.id });
    return updated;
  },

  async releaseDate(dateStr: string) {
    const targetDate = new Date(dateStr);
    const updated = await prisma.eventDate.update({
      where: { date: targetDate },
      data:  { status: EventStatus.AVAILABLE, lockedBy: null }
    });
    io.emit('date-updated', { date: dateStr, status: EventStatus.AVAILABLE, lockedBy: null, id: updated.id });
    return updated;
  },

  async createOption(dateId: string, bookingDetails: any) {
    const updated = await prisma.eventDate.update({
      where: { id: dateId },
      data:  { status: EventStatus.OPTION }
    });
    io.emit('date-updated', { id: dateId, status: EventStatus.OPTION });
    return updated;
  },

  async bookEventFinal(dateId: string, bookingDetails: any) {
    const booking = await prisma.booking.create({
      data: { ...bookingDetails, calendarDateId: dateId }
    });
    await prisma.eventDate.update({
      where: { id: dateId },
      data:  { status: EventStatus.BOOKED }
    });
    io.emit('date-updated', { id: dateId, status: EventStatus.BOOKED });
    return booking;
  }
};
