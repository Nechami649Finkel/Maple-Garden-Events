import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { logger } from '../utils/logger';
import {
  cancelScheduledGreeting,
  fetchGreetingClients,
  formatResultMessage,
  isFutureSchedule,
  listScheduledGreetings,
  parseScheduledAt,
  scheduleGreeting,
  sendToAllClients,
} from '../Services/greetingService';

export const getScheduledGreetings = async (_req: AuthRequest, res: Response) => {
  try {
    const items = await listScheduledGreetings();
    res.json({ success: true, items });
  } catch (error) {
    logger.error('שגיאה בטעינת ברכות מתוזמנות:', error);
    res.status(500).json({ success: false, message: 'שגיאה בשרת.' });
  }
};

export const cancelScheduledGreetingHandler = async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await cancelScheduledGreeting(id);
    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.reason });
    }
    res.json({ success: true, message: 'הברכה המתוזמנת בוטלה.' });
  } catch (error) {
    logger.error('שגיאה בביטול ברכה מתוזמנת:', error);
    res.status(500).json({ success: false, message: 'שגיאה בשרת.' });
  }
};

export const sendGreeting = async (req: AuthRequest, res: Response) => {
  try {
    const { subject, message, scheduledDate, scheduledTime } = req.body;
    const file: Express.Multer.File | undefined = (req as AuthRequest & { file?: Express.Multer.File }).file;

    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'נושא ותוכן הברכה הם שדות חובה.' });
    }

    const clients = await fetchGreetingClients();
    if (clients.length === 0) {
      return res.status(400).json({ success: false, message: 'לא נמצאו לקוחות במערכת.' });
    }

    const hasSchedule = Boolean(scheduledDate && scheduledTime);
    const hasPartialSchedule = Boolean(scheduledDate || scheduledTime);

    if (hasPartialSchedule && !hasSchedule) {
      return res.status(400).json({
        success: false,
        message: 'יש למלא גם תאריך וגם שעה לתזמון, או להשאיר את שניהם ריקים לשליחה מיידית.',
      });
    }

    if (hasSchedule) {
      let scheduledAt: Date;
      try {
        scheduledAt = parseScheduledAt(scheduledDate, scheduledTime);
      } catch {
        return res.status(400).json({ success: false, message: 'תאריך או שעה לא תקינים.' });
      }

      if (!isFutureSchedule(scheduledAt)) {
        return res.status(400).json({
          success: false,
          message: 'יש לבחור תאריך ושעה עתידיים לתזמון הברכה.',
        });
      }

      const { tenantId } = req.user!;
      const createdBy = typeof req.user?.email === 'string' ? req.user.email : undefined;
      await scheduleGreeting({
        tenantId,
        subject,
        message,
        scheduledAt,
        file,
        createdBy,
      });

      const [year, month, day] = scheduledDate.split('-');
      const [hour, minute] = scheduledTime.split(':');

      return res.json({
        success: true,
        message: `הברכה מתוזמנת ל-${day}/${month}/${year} בשעה ${hour}:${minute} ל-${clients.length} לקוחות. השליחה תתבצע אוטומטית גם אם השרת יופעל מחדש.`,
      });
    }

    const stats = await sendToAllClients(clients, subject, message, file
      ? { filename: file.originalname, buffer: file.buffer }
      : undefined);
    const resultMessage = formatResultMessage(stats, clients.length);

    if (stats.emailSent === 0 && stats.whatsappSent === 0) {
      return res.status(400).json({
        success: false,
        message: resultMessage,
        emailSent: stats.emailSent,
        whatsappSent: stats.whatsappSent,
        skippedReasons: stats.skippedReasons,
      });
    }

    res.json({
      success: true,
      message: resultMessage,
      emailSent: stats.emailSent,
      whatsappSent: stats.whatsappSent,
      skippedReasons: stats.skippedReasons,
    });
  } catch (error) {
    logger.error('שגיאה בשליחת ברכה:', error);
    res.status(500).json({ success: false, message: 'שגיאה בשרת.' });
  }
};
