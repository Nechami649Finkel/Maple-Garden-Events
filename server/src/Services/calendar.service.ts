import prisma from "../config/prisma"; // נכון! בלי סוגריים מסולסלים
// טעינת הספריה החדשה שהתקנו
const { HDate, HebrewCalendar } = require('hebcal');
import { io } from "../server"; // וודאי שזה מייבא את ה-io מהשרת שלך

export enum EventStatus {
  AVAILABLE = 'AVAILABLE', // פנוי
  CHECKING = 'CHECKING',   // בבדיקה (העובד נעל את זה)
  OPTION = 'OPTION',       // לקוח לקח אופציה
  BOOKED = 'BOOKED' ,
  BLOCKED = 'BLOCKED'     ,//שבת ויום טוב
  FORBIDDEN = 'FORBIDDEN'  // לקוח סגר אירוע סופית
}

export const calendarService = {

  // --- 1. מנוע החוקים ---
  getDayStatus(date: Date): { type: EventStatus, reason?: string } {
    const hDate = new HDate(date);
    const jsDay = date.getDay();
    const events = HebrewCalendar.getHolidaysOnDate(hDate, false) || [];

    if (hDate.getDay() === 6 || events.some((e: any) => e.getDesc().includes('Yom Tov'))) {
      return { type: EventStatus.BLOCKED, reason: 'שבת או יום טוב' };
    }

    if (jsDay === 5) return { type: EventStatus.FORBIDDEN, reason: 'יום שישי' };
    if (events.some((e: any) => e.getDesc().includes('Erev') || e.getDesc().includes('Fast'))) {
      return { type: EventStatus.FORBIDDEN, reason: 'ערב חג או צום' };
    }
    if (hDate.getMonth() === 5 && hDate.getDate() >= 17 && hDate.getDate() <= 23) {
      return { type: EventStatus.FORBIDDEN, reason: 'בין הזמנים' };
    }

    for (let i = 0; i < 7; i++) {
     const nextDay = new HDate(hDate.abs() + i);
      const nextDayEvents = HebrewCalendar.getHolidaysOnDate(nextDay, false) || [];
      if (nextDayEvents.some((e: any) => e.getDesc().includes('Yom Tov'))) {
        return { type: EventStatus.FORBIDDEN, reason: 'שבוע שבע ברכות בעייתי' };
      }
    }

    return { type: EventStatus.AVAILABLE };
  },

  // --- 2. שליפת נתונים ---
  async getAllCalendarDates(startDate: Date, endDate: Date) {
    const dates = await prisma.eventDate.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      include: { booking: true }
    });

    return dates.map((d: any) => ({
      ...d,
      hebrewDate: new HDate(d.date).render('he'),
      statusInfo: this.getDayStatus(d.date)
    }));
  },

  // --- 3. ניהול (עם עדכון בזמן אמת!) ---
  async lockDateForChecking(dateId: number, employeeName: string) {
    const existing = await prisma.eventDate.findUnique({ where: { id: dateId } });
    if (!existing) throw new Error("תאריך לא נמצא");
    
    const status = this.getDayStatus(existing.date);
    if (status.type === EventStatus.BLOCKED) throw new Error("לא ניתן לנעול יום שבת או חג");
    if (existing.status !== EventStatus.AVAILABLE) throw new Error("התאריך אינו זמין");

    const updated = await prisma.eventDate.update({
      where: { id: dateId },
      data: { status: EventStatus.CHECKING, lockedBy: employeeName }
    });

    // שידור לכולם: התאריך ננעל
    io.emit("date-updated", { dateId, status: EventStatus.CHECKING, lockedBy: employeeName });
    
    return updated;
  },

  async releaseDate(dateId: number) {
    const updated = await prisma.eventDate.update({
      where: { id: dateId },
      data: { status: EventStatus.AVAILABLE, lockedBy: null }
    });

    // שידור לכולם: התאריך שוחרר
    io.emit("date-updated", { dateId, status: EventStatus.AVAILABLE, lockedBy: null });
    
    return updated;
  },

  async createOption(dateId: number, bookingDetails: any) {
    const updated = await prisma.eventDate.update({
      where: { id: dateId },
      data: { status: EventStatus.OPTION }
    });

    io.emit("date-updated", { dateId, status: EventStatus.OPTION });
    return updated;
  },
  // הוספה ל-calendarService
  async bookEventFinal(dateId: number, bookingDetails: any) {
    const updated = await prisma.eventDate.update({
      where: { id: dateId },
      data: { 
        status: EventStatus.BOOKED,
        booking: { create: bookingDetails } // כאן את יוצרת את ההזמנה ב-DB
      }
    });

    // עדכון בזמן אמת לכל העובדים
    io.emit("date-updated", { dateId, status: EventStatus.BOOKED });
    return updated;
  }
};