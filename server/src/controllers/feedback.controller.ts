import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { computeCombinedAverage } from '../utils/feedbackHelpers';
import { sendManagerFinancialAlertEmail } from '../utils/mailer';
import { paginationMeta, parsePagination } from '../utils/pagination';
import { logger } from '../utils/logger';

export const feedbackController = {
  async verifyToken(req: Request, res: Response) {
    try {
      const token = req.params.token as string;

      const feedback = await prisma.feedback.findUnique({
        where: { token },
      });

      if (!feedback) {
        return res.status(404).json({ success: false, message: 'הקישור אינו חוקי או שפג תוקפו.' });
      }

      if (feedback.isCompleted) {
        return res.status(400).json({ success: false, message: 'תודה! המשוב עבור אירוע זה כבר התקבל.' });
      }

      res.status(200).json({
        success: true,
        clientName: feedback.clientName,
        clientSide: feedback.clientSide,
      });
    } catch (error) {
      console.error('Error verifying feedback token:', error);
      res.status(500).json({ success: false, message: 'שגיאת שרת בבדיקת הקישור.' });
    }
  },

  async submitFeedback(req: Request, res: Response) {
    try {
      const token = req.params.token as string;
      const { foodRating, serviceRating, venueRating, comments } = req.body;

      const existingFeedback = await prisma.feedback.findUnique({
        where: { token },
        include: { booking: true },
      });

      if (!existingFeedback || existingFeedback.isCompleted) {
        return res.status(400).json({ success: false, message: 'לא ניתן לשמור את המשוב.' });
      }

      const scores = [foodRating, serviceRating, venueRating].filter((val) => typeof val === 'number');
      let averageScore: number | null = null;

      if (scores.length > 0) {
        averageScore = Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));
      }

      const updatedFeedback = await prisma.feedback.update({
        where: { token },
        data: {
          foodRating,
          serviceRating,
          venueRating,
          comments,
          averageScore,
          isCompleted: true,
        },
      });

      // סינכרון: ממוצע משולב לכל צדדי אותה הזמנה
      const siblingFeedbacks = await prisma.feedback.findMany({
        where: { bookingId: existingFeedback.bookingId },
      });
      const combinedAverage = computeCombinedAverage(
        siblingFeedbacks.map((fb) => (fb.id === updatedFeedback.id ? averageScore : fb.averageScore))
      );

      if (averageScore && averageScore <= 3) {
        console.warn(
          `[⚠️ התראת שירות] משוב נמוך (${averageScore}) מ-${updatedFeedback.clientName} | ממוצע משולב: ${combinedAverage ?? '—'}`
        );
        const managerEmail = process.env.MANAGER_EMAIL;
        if (managerEmail) {
          await sendManagerFinancialAlertEmail(
            managerEmail,
            'משוב נמוך מאירוע',
            updatedFeedback.clientName || 'לקוח',
            `צד ${updatedFeedback.clientSide}, ממוצע ${averageScore}. ממוצע משולב לאירוע: ${combinedAverage ?? 'טרם הושלם'}`
          );
        }
      }

      res.status(200).json({
        success: true,
        message: 'המשוב נשמר בהצלחה!',
        combinedAverage,
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      res.status(500).json({ success: false, message: 'שגיאת שרת בשמירת המשוב.' });
    }
  },

  /** רשימת משובים למנהל — מקובצת לפי הזמנה עם ממוצע משולב */
  async listAdmin(req: Request, res: Response) {
    try {
      const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);

      const grouped = await prisma.feedback.groupBy({
        by: ['bookingId'],
        _max: { createdAt: true },
        orderBy: { _max: { createdAt: 'desc' } },
      });

      const total = grouped.length;
      const pageGroups = grouped.slice(skip, skip + limit);
      const bookingIds = pageGroups.map((g) => g.bookingId);

      if (bookingIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: paginationMeta(page, limit, total),
        });
      }

      const feedbacks = await prisma.feedback.findMany({
        where: { bookingId: { in: bookingIds } },
        include: {
          booking: { include: { eventDate: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const byBooking = new Map<string, {
        bookingId: string;
        eventCode: string;
        eventType: string;
        eventDate: string | null;
        clientAFullName: string;
        clientBFullName: string | null;
        sides: Array<{
          id: string;
          clientSide: string;
          clientName: string | null;
          foodRating: number | null;
          serviceRating: number | null;
          venueRating: number | null;
          averageScore: number | null;
          comments: string | null;
          isCompleted: boolean;
          createdAt: string;
        }>;
        combinedAverage: number | null;
        allCompleted: boolean;
      }>();

      for (const fb of feedbacks) {
        if (!byBooking.has(fb.bookingId)) {
          byBooking.set(fb.bookingId, {
            bookingId: fb.bookingId,
            eventCode: fb.booking.eventCode,
            eventType: fb.booking.eventType,
            eventDate: fb.booking.eventDate?.date
              ? new Date(fb.booking.eventDate.date).toISOString().split('T')[0]
              : null,
            clientAFullName: fb.booking.clientAFullName,
            clientBFullName: fb.booking.clientBFullName,
            sides: [],
            combinedAverage: null,
            allCompleted: false,
          });
        }

        const group = byBooking.get(fb.bookingId)!;
        group.sides.push({
          id: fb.id,
          clientSide: fb.clientSide,
          clientName: fb.clientName,
          foodRating: fb.foodRating,
          serviceRating: fb.serviceRating,
          venueRating: fb.venueRating,
          averageScore: fb.averageScore,
          comments: fb.comments,
          isCompleted: fb.isCompleted,
          createdAt: fb.createdAt.toISOString(),
        });
      }

      const data = Array.from(byBooking.values()).map((group) => {
        group.combinedAverage = computeCombinedAverage(
          group.sides.filter((s) => s.isCompleted).map((s) => s.averageScore)
        );
        group.allCompleted = group.sides.length > 0 && group.sides.every((s) => s.isCompleted);
        return group;
      });

      data.sort((a, b) => (b.eventDate || '').localeCompare(a.eventDate || ''));

      res.status(200).json({
        success: true,
        data,
        pagination: paginationMeta(page, limit, total),
      });
    } catch (error) {
      logger.error('Error listing feedback', { error });
      res.status(500).json({ success: false, message: 'שגיאה בטעינת המשובים.' });
    }
  },
};
