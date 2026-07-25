/**
 * Post-event financial summary for the manager (WhatsApp Cloud API).
 * Runs the morning after the event date; idempotent via financialSummarySentAt.
 */

import prisma from '../config/prisma';
import { logger } from '../utils/logger';
import { toCalendarDateKey, parseCalendarDate, addCalendarDays } from '../utils/dateLocal';
import { sendManagerFinancialAlert } from '../utils/whatsapp';
import { sendManagerFinancialAlertEmail } from '../utils/mailer';
import { getBrandConfig } from '../vendor/shared/brand/index';
import { DEFAULT_LOCALE, getServerTranslation, T } from '../i18n/getServerTranslation';
import { getBookingFinancialSnapshot } from './bookingPayment.service';

function formatMoney(amount: number): string {
  return `₪${amount.toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;
}

const PAYMENT_METHOD_LABELS: Record<string, { he: string; en: string }> = {
  cash: { he: 'מזומן', en: 'Cash' },
  credit_card: { he: 'אשראי', en: 'Credit card' },
  check: { he: 'צ׳ק', en: 'Check' },
  bank_transfer: { he: 'העברה בנקאית', en: 'Bank transfer' },
  easycount: { he: 'EasyCount', en: 'EasyCount' },
  other: { he: 'אחר', en: 'Other' },
};

function formatPaymentMethod(method: string, locale: string): string {
  const entry = PAYMENT_METHOD_LABELS[method];
  if (!entry) return method;
  return locale === 'en' ? entry.en : entry.he;
}

export function buildEventFinancialSummaryText(params: {
  eventCode: string;
  eventDateLabel: string;
  totalCost: number;
  payments: Array<{ amount: number; paidAt: Date; paymentMethod: string; easycountTransactionId?: string | null }>;
  remainingBalance: number;
  locale?: string;
}): string {
  const locale = (params.locale as 'he' | 'en') || DEFAULT_LOCALE;
  const { t } = getServerTranslation(locale);
  const paymentLines = params.payments.length === 0
    ? t(T.SERVER.CRON.FINANCIAL_SUMMARY.NO_PAYMENTS)
    : params.payments.map((payment, index) => {
      const dateLabel = payment.paidAt.toLocaleDateString(locale === 'en' ? 'en-IL' : 'he-IL');
      const method = formatPaymentMethod(payment.paymentMethod, locale);
      const easycount = payment.easycountTransactionId
        ? t(T.SERVER.CRON.FINANCIAL_SUMMARY.PAYMENT_EASYCOUNT, {
          id: payment.easycountTransactionId,
        })
        : '';
      return t(T.SERVER.CRON.FINANCIAL_SUMMARY.PAYMENT_LINE, {
        index: String(index + 1),
        amount: formatMoney(payment.amount),
        date: dateLabel,
        method,
        easycount,
      });
    }).join('\n');

  return [
    t(T.SERVER.CRON.FINANCIAL_SUMMARY.HEADER, {
      eventCode: params.eventCode,
      eventDate: params.eventDateLabel,
    }),
    t(T.SERVER.CRON.FINANCIAL_SUMMARY.TOTAL_COST, { amount: formatMoney(params.totalCost) }),
    t(T.SERVER.CRON.FINANCIAL_SUMMARY.PAYMENTS_HEADER),
    paymentLines,
    t(T.SERVER.CRON.FINANCIAL_SUMMARY.REMAINING, {
      amount: formatMoney(params.remainingBalance),
    }),
  ].join('\n');
}

/**
 * Find closed bookings whose event date was yesterday (morning-after window)
 * and that have not yet received a financial summary alert.
 */
export async function processPreviousDayFinancialSummaries(now = new Date()): Promise<{
  checked: number;
  sent: number;
  date: string;
}> {
  const brand = getBrandConfig();
  const managerPhone = process.env.MANAGER_PHONE || '0501234567';
  const managerEmail = process.env.MANAGER_EMAIL || brand.messaging.managerAlertEmail;
  const { t } = getServerTranslation(DEFAULT_LOCALE);

  const yesterdayKey = toCalendarDateKey(addCalendarDays(now, -1));
  const yesterdayStart = parseCalendarDate(yesterdayKey);
  const yesterdayEnd = new Date(yesterdayStart);
  yesterdayEnd.setHours(23, 59, 59, 999);

  const bookings = await prisma.booking.findMany({
    where: {
      isOption: false,
      financialSummarySentAt: null,
      eventDate: {
        status: 'BOOKED',
        date: {
          gte: yesterdayStart,
          lte: yesterdayEnd,
        },
      },
    },
    select: { id: true, clientAFullName: true, eventCode: true },
  });

  let sent = 0;
  for (const row of bookings) {
    try {
      const snapshot = await getBookingFinancialSnapshot(row.id);
      const eventDateLabel = snapshot.booking.eventDate?.date
        ? snapshot.booking.eventDate.date.toLocaleDateString('he-IL')
        : yesterdayKey;

      const details = buildEventFinancialSummaryText({
        eventCode: snapshot.booking.eventCode,
        eventDateLabel,
        totalCost: snapshot.totalCost,
        payments: snapshot.payments,
        remainingBalance: snapshot.remainingBalance,
      });

      const alertType = t(T.SERVER.CRON.ALERTS.EVENT_FINANCIAL_SUMMARY);

      await sendManagerFinancialAlert(
        managerPhone,
        alertType,
        row.clientAFullName,
        details,
      );
      await sendManagerFinancialAlertEmail(
        managerEmail,
        alertType,
        row.clientAFullName,
        details,
      );

      await prisma.booking.update({
        where: { id: row.id },
        data: { financialSummarySentAt: new Date() },
      });
      sent += 1;
      logger.info('[FINANCIAL_SUMMARY] sent manager alert', {
        bookingId: row.id,
        eventCode: row.eventCode,
      });
    } catch (error) {
      logger.error('[FINANCIAL_SUMMARY] failed for booking', {
        bookingId: row.id,
        error,
      });
    }
  }

  return { checked: bookings.length, sent, date: yesterdayKey };
}
