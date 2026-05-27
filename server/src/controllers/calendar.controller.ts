import { Request, Response } from 'express';
import { calendarService } from '../Services/calendar.service';

export const calendarController = {

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
      const result = await calendarService.bookEventFinal(dateId, bookingDetails);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'שגיאה בסגירת האירוע' });
    }
  }
};
