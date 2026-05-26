import { Request, Response } from 'express';
import { calendarService } from '../Services/calendar.service';

export const calendarController = {

  // שליפת כל התאריכים (כולל הסטטוס המחושב)
  async getAllDates(req: Request, res: Response) {
    try {
      const { start, end } = req.query;
      const dates = await calendarService.getAllCalendarDates(
        new Date(start as string),
        new Date(end as string)
      );
      res.json(dates);
    } catch (error) {
      res.status(500).json({ error: 'שגיאה בשליפת התאריכים' });
    }
  },async bookFinal(req: Request, res: Response) {
    try {
      const { dateId } = req.params;
      const bookingDetails = req.body; // פרטי הלקוח, מנות, וכו'
      const result = await calendarService.bookEventFinal(Number(dateId), bookingDetails);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'שגיאה בסגירת האירוע' });
    }
  },

  // נעילת תאריך לבדיקה
  async lockDate(req: Request, res: Response) {
    try {
      const { dateId } = req.params;
      const { employeeName } = req.body;
      const result = await calendarService.lockDateForChecking(Number(dateId), employeeName);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  // שחרור תאריך
  async releaseDate(req: Request, res: Response) {
    try {
      const { dateId } = req.params;
      const result = await calendarService.releaseDate(Number(dateId));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'שגיאה בשחרור התאריך' });
    }
  },

  // הפיכת תאריך לאופציה
  async createOption(req: Request, res: Response) {
    try {
      const { dateId } = req.params;
      const bookingDetails = req.body;
      const result = await calendarService.createOption(Number(dateId), bookingDetails);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'שגיאה ביצירת אופציה' });
    }
  }
};