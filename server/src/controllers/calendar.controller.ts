import { Request, Response } from 'express';
import { calendarService } from '../Services/calendar.service';

export const calendarController = {

  async getAllDates(req: Request, res: Response) {
    try {
      // הוספנו כאן את ה-eventType שמגיע מה-Frontend
      const { start, end, eventType } = req.query;
      const parseLocalDate = (s: string) => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
      
      const dates = await calendarService.getAllCalendarDates(
        parseLocalDate(start as string),
        parseLocalDate(end as string),
        eventType as string // מעבירים את סוג האירוע לשירות
      );
      res.json(dates);
    } catch (error) {
      // הוספנו את ההדפסה הזו כדי לראות את השגיאה האמיתית בטרמינל!
      console.error('❌ שגיאה מפורטת ב-getAllDates:', error);
      res.status(500).json({ error: 'שגיאה בשליפת התאריכים' });
    }
  },

  async lockDate(req: Request, res: Response) {
    try {
      const dateStr = req.params.dateStr as string;
      const { employeeName } = req.body;
      const result = await calendarService.lockDateForChecking(dateStr, employeeName);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async releaseDate(req: Request, res: Response) {
    try {
      const dateStr = req.params.dateStr as string;
      const result = await calendarService.releaseDate(dateStr);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'שגיאה בשחרור התאריך' });
    }
  },

  async createOption(req: Request, res: Response) {
    try {
      const dateId = req.params.dateId as string;
      const bookingDetails = req.body;
      const result = await calendarService.createOption(dateId, bookingDetails);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'שגיאה ביצירת אופציה' });
    }
  },

  async bookFinal(req: Request, res: Response) {
    try {
      const dateId = req.params.dateId as string;
      const bookingDetails = req.body;
      
      // כאן ה-Service בודק התנגשויות לפי ה-timeOfDay שמועבר ב-bookingDetails
      const result = await calendarService.bookEventFinal(dateId, bookingDetails);
      res.json(result);
    } catch (error: any) {
      // אם יש התנגשות, ה-Service יזרוק שגיאה והיא תחזור ללקוח כאן
      res.status(400).json({ error: error.message });
    }
  }
};