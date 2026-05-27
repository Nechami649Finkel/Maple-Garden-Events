// server/src/Services/calendar.service.ts
const { HDate, HebrewCalendar } = require('hebcal');
import prisma from "../config/prisma";
import { io } from "../server";

export enum EventStatus {
  AVAILABLE = 'AVAILABLE',
  CHECKING = 'CHECKING',
  OPTION = 'OPTION',
  BOOKED = 'BOOKED',
  BLOCKED = 'BLOCKED',      // שבת ויום טוב (חסום הרמטית)
  FORBIDDEN = 'FORBIDDEN'   // ימי תעניות, ערבי חגים או ימים בעייתיים באולם
}

export const calendarService = {

  // 1. מנוע החוקים הסטטיים (הלוח העברי/לועזי הקבוע)
  getDayStaticStatus(date: Date): { type: EventStatus; reason?: string } {
    const hDate = new HDate(date);
    const jsDay = date.getDay(); // 0 = ראשון, 5 = שישי, 6 = שבת
    const events = HebrewCalendar.getHolidaysOnDate(hDate, false) || [];

    // א. חסימת שבתות וימים טובים
    if (jsDay === 6 || events.some((e: any) => e.getDesc().includes('Yom Tov'))) {
      return { type: EventStatus.BLOCKED, reason: 'שבת או יום טוב' };
    }

    // ב. חסימת ימי שישי וערבי חגים / צומות
    if (jsDay === 5) return { type: EventStatus.FORBIDDEN, reason: 'יום שישי' };
    if (events.some((e: any) => e.getDesc().includes('Erev') || e.getDesc().includes('Fast'))) {
      return { type: EventStatus.FORBIDDEN, reason: 'ערב חג או צום' };
    }

    // ג. בין הזמנים (דוגמה לפי חודש אב - חודש 5 ב-Hebcal תלוי בספירה, מומלץ לבדוק לפי שמות חודשים עבריים)
    if (hDate.getMonth() === 5 && hDate.getDate() >= 17 && hDate.getDate() <= 23) {
      return { type: EventStatus.FORBIDDEN, reason: 'בין הזמנים' };
    }

    return { type: EventStatus.AVAILABLE };
  },

  // 2. שליפת כל התאריכים בטווח משולב עם ה-DB (יוצר לוח שנה "לנצח")
  async getAllCalendarDates(startDate: Date, endDate: Date) {
    // א. שליפת כל הרשומות הקיימות ב-DB לטווח הזה (אירועים, אופציות, בדיקות)
    const dbDates = await prisma.eventDate.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      include: { booking: true }
    });

    // יצירת מפה לשליפה מהירה לפי תאריך מיושר (YYYY-MM-DD)
    const dbMap = new Map(dbDates.map(d => [new Date(d.date).toISOString().split('T')[0], d]));

    const result = [];
    let current = new Date(startDate);

    // ב. לולאה שרצה יום אחרי יום ומחוללת את הלוח באופן דינמי
    while (current <= endDate) {
      const dateKey = current.toISOString().split('T')[0];
      const hDate = new HDate(current);
      const staticStatus = this.getDayStaticStatus(current);
      
      const dbRecord = dbMap.get(dateKey);

      // קביעת הסטטוס הסופי: אם יש חסימה קבועה (שבת) - היא קובעת. אחרת, מה שיש ב-DB.
      let finalStatus = staticStatus.type;
      if (finalStatus === EventStatus.AVAILABLE && dbRecord) {
        finalStatus = dbRecord.status as EventStatus;
      }

      result.push({
        id: dbRecord?.id || null, // יכול להיות null אם היום פנוי לחלוטין ואין שורה ב-DB
        date: dateKey,
        dayOfWeek: current.getDay(),
        hebrewDate: hDate.render('he'),
        status: finalStatus,
        reason: staticStatus.reason || null,
        lockedBy: dbRecord?.lockedBy || null,
        booking: dbRecord?.booking || null
      });

      current.setDate(current.getDate() + 1);
    }

    return result;
  },

  // 3. עדכון נעילת תאריך לבדיקה (יוצר שורה ב-DB במידת הצורך)
  async lockDateForChecking(dateStr: string, employeeName: string) {
    const targetDate = new Date(dateStr);
    const staticStatus = this.getDayStaticStatus(targetDate);
    if (staticStatus.type === EventStatus.BLOCKED || staticStatus.type === EventStatus.FORBIDDEN) {
      throw new Error(`לא ניתן לנעול יום זה: ${staticStatus.reason}`);
    }

    // מציאת הרשומה או יצירתה (Upsert)
    const updated = await prisma.eventDate.upsert({
      where: { date: targetDate },
      update: { status: EventStatus.CHECKING, lockedBy: employeeName },
      create: { date: targetDate, status: EventStatus.CHECKING, lockedBy: employeeName }
    });

    // תיקון השידור: משדרים אובייקט שמכיל את ה-date כדי שהפרונטאנד יזהה לפי תאריך!
    io.emit("date-updated", { date: dateStr, status: EventStatus.CHECKING, lockedBy: employeeName, id: updated.id });
    return updated;
  },

  async releaseDate(dateStr: string) {
    const targetDate = new Date(dateStr);
    const updated = await prisma.eventDate.update({
      where: { date: targetDate },
      data: { status: EventStatus.AVAILABLE, lockedBy: null }
    });

    io.emit("date-updated", { date: dateStr, status: EventStatus.AVAILABLE, lockedBy: null, id: updated.id });
    return updated;
  }
};