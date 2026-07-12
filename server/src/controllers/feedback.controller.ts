import { Request, Response } from 'express';
import prisma from '../config/prisma';
import {
  buildFeedbackSides,
  computeCombinedAverage,
  contactForSide,
  ensureFeedbackRecordsForBooking,
  getClientFeedbackUrl,
  hasEventEnded,
  isLocalClientUrl,
  sendFeedbackLinkForRecord,
} from '../utils/feedbackHelpers';
import { sendManagerFinancialAlertEmail } from '../utils/mailer';
import { paginationMeta, parsePagination } from '../utils/pagination';
import { logger } from '../utils/logger';
import { calendarKeyFromDbDate } from '../utils/dateLocal';
import { emitFeedbackUpdated } from '../utils/realtime';

type AdminSide = {
  id: string | null;
  token: string | null;
  link: string | null;
  clientSide: string;
  clientName: string | null;
  foodRating: number | null;
  serviceRating: number | null;
  venueRating: number | null;
  averageScore: number | null;
  comments: string | null;
  isCompleted: boolean;
  createdAt: string | null;
  lastNotifiedAt: string | null;
  lastEmailSent: boolean;
  lastWhatsappSent: boolean;
};

type AdminGroup = {
  bookingId: string;
  eventCode: string;
  eventType: string;
  eventDate: string | null;
  clientAFullName: string;
  clientBFullName: string | null;
  sides: AdminSide[];
  combinedAverage: number | null;
  allCompleted: boolean;
  feedbackStatus: 'not_sent' | 'pending' | 'completed';
};

const MONTH_LABELS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

function avgNumbers(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
  if (valid.length === 0) return null;
  return Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2));
}

function buildEventDateRange(year: number, month: number | null): { gte: Date; lt: Date } {
  if (month) {
    return { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) };
  }
  return { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) };
}

type StatsPeriod = {
  allYears: boolean;
  year: number | null;
  month: number | null;
};

function parseStatsPeriod(query: Record<string, unknown>): StatsPeriod {
  const yearParam = query.year;
  const month = query.month ? Number(query.month) : null;

  if (yearParam === 'all') {
    return { allYears: true, year: null, month };
  }

  return {
    allYears: false,
    year: yearParam ? Number(yearParam) : new Date().getFullYear(),
    month,
  };
}

function eventDateFilter(period: StatsPeriod): { gte: Date; lt: Date } | undefined {
  if (period.allYears) return undefined;
  return buildEventDateRange(period.year!, period.month);
}

function eventMonthMatches(date: Date, month: number | null): boolean {
  if (!month) return true;
  return new Date(date).getMonth() + 1 === month;
}

async function getAvailableFeedbackYears(): Promise<number[]> {
  const feedbacks = await prisma.feedback.findMany({
    where: {
      isCompleted: true,
      booking: { isOption: false, eventDate: { status: 'BOOKED' } },
    },
    select: { booking: { select: { eventDate: { select: { date: true } } } } },
  });

  const years = new Set<number>();
  for (const fb of feedbacks) {
    if (fb.booking.eventDate?.date) {
      years.add(new Date(fb.booking.eventDate.date).getFullYear());
    }
  }
  return [...years].sort((a, b) => b - a);
}

function buildAdminGroup(
  booking: {
    id: string;
    eventCode: string;
    eventType: string;
    clientAFullName: string;
    clientBFullName: string | null;
    clientAPhone: string;
    clientAEmail?: string | null;
    clientBPhone?: string | null;
    clientBEmail?: string | null;
    eventDate: { date: Date } | null;
  },
  feedbacks: Array<{
    id: string;
    token: string;
    clientSide: string;
    clientName: string | null;
    foodRating: number | null;
    serviceRating: number | null;
    venueRating: number | null;
    averageScore: number | null;
    comments: string | null;
    isCompleted: boolean;
    createdAt: Date;
    lastNotifiedAt?: Date | null;
    lastEmailSent?: boolean;
    lastWhatsappSent?: boolean;
  }>,
): AdminGroup {
  let sides: AdminSide[];

  if (feedbacks.length > 0) {
    sides = feedbacks.map((fb) => ({
      id: fb.id,
      token: fb.token,
      link: getClientFeedbackUrl(fb.token),
      clientSide: fb.clientSide,
      clientName: fb.clientName,
      foodRating: fb.foodRating,
      serviceRating: fb.serviceRating,
      venueRating: fb.venueRating,
      averageScore: fb.averageScore,
      comments: fb.comments,
      isCompleted: fb.isCompleted,
      createdAt: fb.createdAt.toISOString(),
      lastNotifiedAt: fb.lastNotifiedAt?.toISOString() ?? null,
      lastEmailSent: fb.lastEmailSent ?? false,
      lastWhatsappSent: fb.lastWhatsappSent ?? false,
    }));
  } else {
    sides = buildFeedbackSides(booking).map((side) => ({
      id: null,
      token: null,
      link: null,
      clientSide: side.side,
      clientName: side.name,
      foodRating: null,
      serviceRating: null,
      venueRating: null,
      averageScore: null,
      comments: null,
      isCompleted: false,
      createdAt: null,
      lastNotifiedAt: null,
      lastEmailSent: false,
      lastWhatsappSent: false,
    }));
  }

  const completedSides = sides.filter((s) => s.isCompleted);
  const combinedAverage = computeCombinedAverage(completedSides.map((s) => s.averageScore));
  const allCompleted = sides.length > 0 && sides.every((s) => s.isCompleted);

  let feedbackStatus: AdminGroup['feedbackStatus'] = 'not_sent';
  if (feedbacks.length > 0) {
    feedbackStatus = allCompleted ? 'completed' : 'pending';
  }

  return {
    bookingId: booking.id,
    eventCode: booking.eventCode,
    eventType: booking.eventType,
    eventDate: booking.eventDate?.date
      ? calendarKeyFromDbDate(new Date(booking.eventDate.date))
      : null,
    clientAFullName: booking.clientAFullName,
    clientBFullName: booking.clientBFullName,
    sides,
    combinedAverage,
    allCompleted,
    feedbackStatus,
  };
}

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

      const siblingFeedbacks = await prisma.feedback.findMany({
        where: { bookingId: existingFeedback.bookingId },
      });
      const combinedAverage = computeCombinedAverage(
        siblingFeedbacks.map((fb) => (fb.id === updatedFeedback.id ? averageScore : fb.averageScore)),
      );

      if (averageScore && averageScore <= 3) {
        console.warn(
          `[⚠️ התראת שירות] משוב נמוך (${averageScore}) מ-${updatedFeedback.clientName} | ממוצע משולב: ${combinedAverage ?? '—'}`,
        );
        const managerEmail = process.env.MANAGER_EMAIL;
        if (managerEmail) {
          await sendManagerFinancialAlertEmail(
            managerEmail,
            'משוב נמוך מאירוע',
            updatedFeedback.clientName || 'לקוח',
            `צד ${updatedFeedback.clientSide}, ממוצע ${averageScore}. ממוצע משולב לאירוע: ${combinedAverage ?? 'טרם הושלם'}`,
          );
        }
      }

      emitFeedbackUpdated({ bookingId: existingFeedback.bookingId });

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

  /** יצירת משובים ו/או שליחת קישורים ידנית */
  async sendAdmin(req: Request, res: Response) {
    try {
      const { bookingId, clientSide, sendNotifications = true } = req.body as {
        bookingId: string;
        clientSide?: 'A' | 'B';
        sendNotifications?: boolean;
      };

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { eventDate: true },
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'ההזמנה לא נמצאה.' });
      }

      if (booking.isOption) {
        return res.status(400).json({ success: false, message: 'לא ניתן לשלוח משוב לאופציה — רק לאירוע סגור.' });
      }

      if (booking.eventDate?.status !== 'BOOKED') {
        return res.status(400).json({ success: false, message: 'האירוע אינו בסטטוס סגור (BOOKED).' });
      }

      const records = await ensureFeedbackRecordsForBooking(booking);
      if (records.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'לא נמצאו פרטי קשר (מייל/טלפון) לשליחת משוב.',
        });
      }

      let targets = records;
      if (clientSide) {
        targets = records.filter((r) => r.clientSide === clientSide);
      } else {
        targets = records.filter((r) => !r.isCompleted);
      }

      if (targets.length === 0) {
        return res.status(400).json({
          success: false,
          message: clientSide ? 'לא נמצא צד מתאים לשליחה.' : 'כל המשובים כבר מולאו.',
        });
      }

      const results = [];
      for (const record of targets) {
        const contact = contactForSide(booking, record.clientSide);
        if (sendNotifications) {
          results.push(await sendFeedbackLinkForRecord(record, contact));
        } else {
          results.push({
            clientSide: record.clientSide,
            clientName: record.clientName,
            token: record.token,
            link: getClientFeedbackUrl(record.token),
            emailSent: false,
            whatsappSent: false,
            skippedReasons: [],
          });
        }
      }

      const anySent = results.some((r) => r.emailSent || r.whatsappSent);
      const allSkipped = sendNotifications && results.every((r) => !r.emailSent && !r.whatsappSent);
      const localhostLinkWarning = isLocalClientUrl()
        ? 'הקישור במייל מצביע ל-localhost — לקוחות חיצוניים לא יוכלו לפתוח אותו. הגדר CLIENT_URL לכתובת ציבורית (ראה .env).'
        : null;

      emitFeedbackUpdated({ bookingId });

      res.status(200).json({
        success: true,
        message: sendNotifications
          ? (anySent
            ? 'קישורי המשוב נשלחו.'
            : 'לא נשלח — ראה פירוט בשדות skippedReasons.')
          : 'קישורי המשוב נוצרו.',
        results,
        emailSent: results.some((r) => r.emailSent),
        whatsappSent: results.some((r) => r.whatsappSent),
        skippedReasons: [
          ...new Set([
            ...results.flatMap((r) => r.skippedReasons),
            ...(localhostLinkWarning ? [localhostLinkWarning] : []),
          ]),
        ],
        ...(allSkipped && !anySent ? { warning: true } : {}),
        ...(localhostLinkWarning ? { warning: true } : {}),
      });
    } catch (error) {
      logger.error('Error sending feedback admin', { error });
      res.status(500).json({ success: false, message: 'שגיאה בשליחת משוב.' });
    }
  },

  /** רשימת משובים למנהל — כולל אירועים שהסתיימו ללא משוב */
  async listAdmin(req: Request, res: Response) {
    try {
      const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
      const now = new Date();

      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);

      const candidates = await prisma.booking.findMany({
        where: {
          isOption: false,
          eventDate: {
            status: 'BOOKED',
            date: { lte: endOfToday },
          },
        },
        include: {
          eventDate: true,
          eventForm: { select: { eventTime: true } },
          feedbacks: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { eventDate: { date: 'desc' } },
      });

      const finishedBookings = candidates.filter(
        (booking) => booking.eventDate && hasEventEnded(booking, booking.eventDate.date, booking.eventForm, now),
      );

      const data = finishedBookings.map((booking) => buildAdminGroup(booking, booking.feedbacks));
      const total = data.length;
      const pageData = data.slice(skip, skip + limit);

      res.status(200).json({
        success: true,
        data: pageData,
        pagination: paginationMeta(page, limit, total),
      });
    } catch (error) {
      logger.error('Error listing feedback', { error });
      res.status(500).json({ success: false, message: 'שגיאה בטעינת המשובים.' });
    }
  },

  /** סטטיסטיקות וחישובים על משובי לקוחות */
  async statsAdmin(req: Request, res: Response) {
    try {
      const period = parseStatsPeriod(req.query as Record<string, unknown>);
      const dateRange = eventDateFilter(period);
      const now = new Date();
      const availableYears = await getAvailableFeedbackYears();

      const completedFeedbacksRaw = await prisma.feedback.findMany({
        where: {
          isCompleted: true,
          booking: {
            isOption: false,
            eventDate: {
              status: 'BOOKED',
              ...(dateRange ? { date: dateRange } : {}),
            },
          },
        },
        include: {
          booking: {
            include: { eventDate: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      const completedFeedbacks = period.allYears && period.month
        ? completedFeedbacksRaw.filter(
            (f) => f.booking.eventDate && eventMonthMatches(f.booking.eventDate.date, period.month),
          )
        : completedFeedbacksRaw;

      const averages = {
        combined: avgNumbers(completedFeedbacks.map((f) => f.averageScore)),
        food: avgNumbers(completedFeedbacks.map((f) => f.foodRating)),
        service: avgNumbers(completedFeedbacks.map((f) => f.serviceRating)),
        venue: avgNumbers(completedFeedbacks.map((f) => f.venueRating)),
      };

      const lowScore = completedFeedbacks.filter(
        (f) => f.averageScore != null && f.averageScore <= 3,
      ).length;
      const excellent = completedFeedbacks.filter(
        (f) => f.averageScore != null && f.averageScore >= 4.5,
      ).length;

      const byTypeMap = new Map<string, number[]>();
      for (const fb of completedFeedbacks) {
        const eventType = fb.booking.eventType;
        if (!byTypeMap.has(eventType)) byTypeMap.set(eventType, []);
        if (fb.averageScore != null) byTypeMap.get(eventType)!.push(fb.averageScore);
      }
      const byEventType = [...byTypeMap.entries()]
        .map(([eventType, scores]) => ({
          eventType,
          average: avgNumbers(scores),
          count: scores.length,
        }))
        .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));

      let byMonth: { month: number; label: string; average: number | null; count: number }[] = [];
      let byYear: { year: number; average: number | null; count: number }[] = [];

      if (!period.month && period.allYears) {
        const byYearMap = new Map<number, number[]>();
        for (const fb of completedFeedbacks) {
          if (fb.averageScore == null || !fb.booking.eventDate) continue;
          const y = new Date(fb.booking.eventDate.date).getFullYear();
          if (!byYearMap.has(y)) byYearMap.set(y, []);
          byYearMap.get(y)!.push(fb.averageScore);
        }
        byYear = [...byYearMap.entries()]
          .sort(([a], [b]) => a - b)
          .map(([y, scores]) => ({
            year: y,
            average: avgNumbers(scores),
            count: scores.length,
          }));
      } else if (!period.month && period.year != null) {
        const byMonthMap = new Map<number, number[]>();
        for (const fb of completedFeedbacks) {
          if (fb.averageScore == null || !fb.booking.eventDate) continue;
          const m = new Date(fb.booking.eventDate.date).getMonth() + 1;
          if (!byMonthMap.has(m)) byMonthMap.set(m, []);
          byMonthMap.get(m)!.push(fb.averageScore);
        }
        byMonth = [...byMonthMap.entries()]
          .sort(([a], [b]) => a - b)
          .map(([m, scores]) => ({
            month: m,
            label: MONTH_LABELS[m - 1],
            average: avgNumbers(scores),
            count: scores.length,
          }));
      }

      const categoryComparison = [
        { category: 'אוכל', average: averages.food },
        { category: 'שירות', average: averages.service },
        { category: 'אולם', average: averages.venue },
      ].filter((c) => c.average != null);

      const candidatesRaw = await prisma.booking.findMany({
        where: {
          isOption: false,
          eventDate: {
            status: 'BOOKED',
            ...(dateRange ? { date: dateRange } : {}),
          },
        },
        include: {
          eventDate: true,
          eventForm: { select: { eventTime: true } },
          feedbacks: true,
        },
      });

      const candidates = period.allYears && period.month
        ? candidatesRaw.filter(
            (b) => b.eventDate && eventMonthMatches(b.eventDate.date, period.month),
          )
        : candidatesRaw;

      const finishedBookings = candidates.filter(
        (b) => b.eventDate && hasEventEnded(b, b.eventDate.date, b.eventForm, now),
      );

      let expectedSides = 0;
      let pendingFeedbacks = 0;
      let notSentEvents = 0;

      for (const booking of finishedBookings) {
        const sides = buildFeedbackSides(booking);
        expectedSides += sides.length;
        if (sides.length === 0) continue;

        const hasAnySent = booking.feedbacks.some((f) => f.lastNotifiedAt);

        if (booking.feedbacks.length === 0 || !hasAnySent) {
          notSentEvents++;
        }

        for (const side of sides) {
          const fb = booking.feedbacks.find((f) => f.clientSide === side.side);
          if (fb && !fb.isCompleted && fb.lastNotifiedAt) pendingFeedbacks++;
        }
      }

      const responseRate =
        expectedSides > 0
          ? Number(((completedFeedbacks.length / expectedSides) * 100).toFixed(1))
          : null;

      const recentLow = completedFeedbacks
        .filter((f) => f.averageScore != null && f.averageScore <= 3)
        .sort((a, b) => (a.averageScore ?? 0) - (b.averageScore ?? 0))
        .slice(0, 5)
        .map((f) => ({
          eventCode: f.booking.eventCode,
          eventDate: f.booking.eventDate?.date
            ? calendarKeyFromDbDate(new Date(f.booking.eventDate.date))
            : null,
          eventType: f.booking.eventType,
          clients: [f.booking.clientAFullName, f.booking.clientBFullName].filter(Boolean).join(' · '),
          clientSide: f.clientSide,
          score: f.averageScore!,
          comment: f.comments,
        }));

      const recentComments = completedFeedbacks
        .filter((f) => f.comments?.trim())
        .slice(0, 5)
        .map((f) => ({
          eventCode: f.booking.eventCode,
          eventDate: f.booking.eventDate?.date
            ? calendarKeyFromDbDate(new Date(f.booking.eventDate.date))
            : null,
          comment: f.comments!.trim(),
          score: f.averageScore,
        }));

      res.status(200).json({
        success: true,
        data: {
          period: {
            year: period.allYears ? null : period.year,
            month: period.month,
            allYears: period.allYears,
          },
          availableYears,
          averages,
          counts: {
            completedFeedbacks: completedFeedbacks.length,
            totalEventsFinished: finishedBookings.length,
            pendingFeedbacks,
            notSentEvents,
            lowScore,
            excellent,
            expectedSides,
          },
          responseRate,
          byEventType,
          byMonth,
          byYear,
          categoryComparison,
          recentLow,
          recentComments,
        },
      });
    } catch (error) {
      logger.error('Error loading feedback stats', { error });
      res.status(500).json({ success: false, message: 'שגיאה בטעינת סטטיסטיקות משוב.' });
    }
  },
};
