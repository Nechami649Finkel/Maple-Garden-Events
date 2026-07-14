/**
 * שירות מעקב מועדי תשלום + תזכורות אוטומטיות (C5/C6)
 *
 * משלב:
 * - hallBalance.ts — יתרה אמיתית (paid + pending invoices)
 * - paymentTerms.ts — לוח תשלומים מתבנית החוזה
 * - WhatsApp / Email — התראות למנהל וללקוח
 */

import prisma from '../config/prisma';
import { logger } from '../utils/logger';
import {
  computeHallBalanceBreakdown,
  type HallBalanceBreakdown,
} from './easyCount/hallBalance';
import {
  computePaymentObligation,
  findPaymentTemplate,
  getPaymentTemplatesFromSettings,
  type PaymentTermsTemplate,
} from '../utils/paymentTerms';
import {
  sendManagerFinancialAlert,
  sendPaymentOverdueReminderWhatsApp,
} from '../utils/whatsapp';
import {
  sendManagerFinancialAlertEmail,
  sendPaymentOverdueReminderEmail,
} from '../utils/mailer';

/** תוצאות סריקה יומית — ללוגים וניטור */
export interface PaymentDeadlineRunResult {
  scanned: number;
  overdue: number;
  remindersSent: number;
  managerAlertsSent: number;
  skippedAlreadyReminded: number;
  skippedSettled: number;
  errors: number;
}

export interface OverdueBookingContext {
  bookingId: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  eventCode: string;
  eventDate: Date;
  balance: HallBalanceBreakdown;
  obligation: ReturnType<typeof computePaymentObligation>;
  missedDeadline: Date;
}

/** תחילת יום מקומי — ל-idempotency של תזכורת יומית */
export function startOfLocalDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatMoney(amount: number): string {
  return Math.round(amount).toLocaleString('he-IL');
}

function formatHebrewDate(date: Date): string {
  return date.toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function resolveManagerContacts(): { phone: string; email: string } {
  return {
    phone: process.env.MANAGER_ALERT_PHONE?.trim() || '0501234567',
    email: process.env.MANAGER_ALERT_EMAIL?.trim() || 'maple.events.il@gmail.com',
  };
}

function extractPrimaryPhone(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  return raw.split(' | ')[0].trim() || null;
}

function resolveTemplateForBooking(
  templates: PaymentTermsTemplate[],
  defaultTemplateId: string,
  paymentTemplateId?: string | null,
): PaymentTermsTemplate {
  return (
    findPaymentTemplate(templates, paymentTemplateId)
    ?? findPaymentTemplate(templates, defaultTemplateId)
    ?? templates[0]
  );
}

/** מעדכן paymentDeadline, depositPaid — נקרא אחרי יצירה/עדכון/תשלום */
export async function syncBookingPaymentMetadata(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { eventDate: true, hallInvoices: true },
  });
  if (!booking || booking.isOption || !booking.eventDate) return;

  const settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
  const { templates, defaultTemplateId } = getPaymentTemplatesFromSettings(settings);
  const template = resolveTemplateForBooking(
    templates,
    defaultTemplateId,
    booking.paymentTemplateId,
  );

  const balance = computeHallBalanceBreakdown(booking, booking.hallInvoices);
  const obligation = computePaymentObligation(
    template,
    balance.hallAmount,
    booking.eventDate.date,
    balance.committedTotal,
  );

  const missedDeadline = obligation.overdueInstallments.length > 0
    ? obligation.overdueInstallments[obligation.overdueInstallments.length - 1].dueDate
    : null;

  const paymentDeadline = missedDeadline ?? obligation.nextDueDate;

  const depositPaid =
    (Number(booking.advancePaid) || 0) > 0
    || (Number(booking.totalPaid) || 0) > 0
    || balance.paidTotal > 0;

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      paymentDeadline,
      depositPaid,
    },
  });
}

/** תבנית הודעה למנהל — איחור תשלום */
export function buildManagerOverdueAlert(ctx: OverdueBookingContext): {
  alertType: string;
  details: string;
} {
  const { balance, obligation, missedDeadline } = ctx;
  const pendingNote =
    balance.pendingTotal > 0
      ? ` (₪${formatMoney(balance.pendingTotal)} ממתין לגבייה ב-Easy Count)`
      : '';

  return {
    alertType: 'איחור בתשלום',
    details:
      `התרעה: הלקוח ${ctx.clientName} (אירוע ${ctx.eventCode}) עבר את מועד התשלום ` +
      `(${formatHebrewDate(missedDeadline)}). ` +
      `נדרש עד כה: ₪${formatMoney(obligation.requiredByNow)}, ` +
      `שולם/בתהליך: ₪${formatMoney(balance.committedTotal)}${pendingNote}, ` +
      `יתרה פתוחה: ₪${formatMoney(balance.remaining)}. ` +
      `תאריך אירוע: ${formatHebrewDate(ctx.eventDate)}.`,
  };
}

/** תבנית הודעה מנומסת ללקוח */
export function buildClientOverdueReminder(ctx: OverdueBookingContext): string {
  return (
    `רצינו להזכיר בנימוס כי לפי תנאי ההזמנה שלכם, מועד התשלום ` +
    `(${formatHebrewDate(ctx.missedDeadline)}) חלף.\n\n` +
    `יתרה לתשלום לאולם: ₪${formatMoney(ctx.balance.remaining)}.\n` +
    `אירוע: ${ctx.eventCode} · ${formatHebrewDate(ctx.eventDate)}.\n\n` +
    `נשמח אם תוכלו להסדיר את התשלום בהקדם, או ליצור קשר עם צוות מייפל ` +
    `לתיאום תשלום / חשבונית.\n\n` +
    `תודה רבה על שיתוף הפעולה 🍁`
  );
}

/**
 * מנסה "לתפוס" את סlot התזכורת היומית — מונע race / כפילויות בין workers.
 * מחזיר true רק אם עוד לא נשלחה תזכורת היום.
 */
async function claimDailyReminderSlot(bookingId: string): Promise<boolean> {
  const todayStart = startOfLocalDay();
  const result = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      OR: [
        { lastPaymentReminderSent: null },
        { lastPaymentReminderSent: { lt: todayStart } },
      ],
    },
    data: { lastPaymentReminderSent: new Date() },
  });
  return result.count > 0;
}

/** מעריך האם הזמנה בודדת באיחור תשלום (ללא שליחה) */
export function evaluateBookingPaymentStatus(
  booking: {
    isOption: boolean;
    paymentTemplateId?: string | null;
    eventDate: { date: Date } | null;
    hallInvoices: { amount?: number | null; status?: string | null }[];
    totalPaid?: number | null;
    basePrice?: number | null;
    extrasPrice?: number | null;
    liveAdditionsTotal?: number | null;
    totalPrice?: number | null;
  },
  template: PaymentTermsTemplate,
  asOf: Date = new Date(),
): { isOverdue: boolean; balance: HallBalanceBreakdown; obligation: ReturnType<typeof computePaymentObligation> } | null {
  if (booking.isOption || !booking.eventDate) return null;

  const balance = computeHallBalanceBreakdown(booking, booking.hallInvoices);
  if (balance.remaining <= 0.01) return null;

  const obligation = computePaymentObligation(
    template,
    balance.hallAmount,
    booking.eventDate.date,
    balance.committedTotal,
    asOf,
  );

  if (!obligation.isOverdue) return null;

  return { isOverdue: true, balance, obligation };
}

/**
 * סריקה יומית: הזמנות BOOKED עם איחור תשלום ויתרה > 0 (כולל pending).
 * שולח תזכורת ללקוח + התראה למנהל, פעם אחת ביום לכל הזמנה.
 */
export async function checkOverduePayments(): Promise<PaymentDeadlineRunResult> {
  const result: PaymentDeadlineRunResult = {
    scanned: 0,
    overdue: 0,
    remindersSent: 0,
    managerAlertsSent: 0,
    skippedAlreadyReminded: 0,
    skippedSettled: 0,
    errors: 0,
  };

  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const { phone: managerPhone, email: managerEmail } = resolveManagerContacts();

  const settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
  const { templates, defaultTemplateId } = getPaymentTemplatesFromSettings(settings);

  const bookings = await prisma.booking.findMany({
    where: {
      isOption: false,
      eventDate: { status: 'BOOKED' },
    },
    include: {
      eventDate: true,
      hallInvoices: true,
    },
  });

  result.scanned = bookings.length;

  for (const booking of bookings) {
    try {
      if (!booking.eventDate) continue;

      const template = resolveTemplateForBooking(
        templates,
        defaultTemplateId,
        booking.paymentTemplateId,
      );

      const evaluation = evaluateBookingPaymentStatus(booking, template, now);
      if (!evaluation) {
        if (computeHallBalanceBreakdown(booking, booking.hallInvoices).remaining <= 0.01) {
          result.skippedSettled++;
        }
        continue;
      }

      result.overdue++;

      const missedDeadline =
        evaluation.obligation.overdueInstallments[
          evaluation.obligation.overdueInstallments.length - 1
        ]?.dueDate;
      if (!missedDeadline) continue;

      // idempotency — דילוג אם כבר נשלחה תזכורת היום
      if (booking.lastPaymentReminderSent && booking.lastPaymentReminderSent >= todayStart) {
        result.skippedAlreadyReminded++;
        continue;
      }

      const ctx: OverdueBookingContext = {
        bookingId: booking.id,
        clientName: booking.clientAFullName,
        clientPhone: extractPrimaryPhone(booking.clientAPhone),
        clientEmail: booking.clientAEmail,
        eventCode: booking.eventCode,
        eventDate: booking.eventDate.date,
        balance: evaluation.balance,
        obligation: evaluation.obligation,
        missedDeadline,
      };

      // תפיסה אטומית לפני שליחה — מונע כפילות תחת race
      const claimed = await claimDailyReminderSlot(booking.id);
      if (!claimed) {
        result.skippedAlreadyReminded++;
        continue;
      }

      const clientMessage = buildClientOverdueReminder(ctx);
      const managerAlert = buildManagerOverdueAlert(ctx);

      let clientNotified = false;
      if (ctx.clientPhone) {
        await sendPaymentOverdueReminderWhatsApp(ctx.clientPhone, ctx.clientName, clientMessage);
        clientNotified = true;
      }
      if (ctx.clientEmail) {
        await sendPaymentOverdueReminderEmail(
          ctx.clientEmail,
          ctx.clientName,
          clientMessage,
          ctx.balance.remaining,
          ctx.missedDeadline,
        );
        clientNotified = true;
      }

      await sendManagerFinancialAlert(
        managerPhone,
        managerAlert.alertType,
        ctx.clientName,
        managerAlert.details,
      );
      await sendManagerFinancialAlertEmail(
        managerEmail,
        managerAlert.alertType,
        ctx.clientName,
        managerAlert.details,
      );

      if (clientNotified) result.remindersSent++;
      result.managerAlertsSent++;

      await syncBookingPaymentMetadata(booking.id);

      logger.info('[PAYMENT_DEADLINE] תזכורת נשלחה', {
        bookingId: booking.id,
        eventCode: booking.eventCode,
        remaining: evaluation.balance.remaining,
        pending: evaluation.balance.pendingTotal,
      });
    } catch (error) {
      result.errors++;
      logger.error('[PAYMENT_DEADLINE] שגיאה בעיבוד הזמנה', {
        bookingId: booking.id,
        error,
      });
    }
  }

  return result;
}
