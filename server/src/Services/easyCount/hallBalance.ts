/**
 * C5 — חישוב יתרת חיוב לאולם (Easy Count)
 *
 * מונע חריגה מתקרת ההזמנה על ידי ספירת:
 * - סכומים ששולמו בפועל (booking.totalPaid)
 * - חשבוניות במצב pending/draft שטרם נקלטו ב-totalPaid אך כבר "שמורות" מול התקרה
 */

import prisma from '../../config/prisma';
import { getHallBillableAmount, type HallBillableBooking } from '../../utils/hallBilling';
import type { EasyCountInvoiceStatus } from './types';

/** סטטוסים שמייצגים כסף שכבר נגבה / אושר סופית */
export const FINALIZED_INVOICE_STATUSES: readonly EasyCountInvoiceStatus[] = ['paid'];

/**
 * סטטוסים "בתהליך" — נספרים מול התקרה כדי למנוע הפקת חשבוניות כפולות
 * (למשל: אשראי ממתין לאישור, צ'ק בליקוי, טיוטה שנשלחה ל-Easy Count)
 */
export const PENDING_INVOICE_STATUSES: readonly EasyCountInvoiceStatus[] = ['pending', 'draft'];

/** סטטוסים שלא נספרים מול התקרה */
export const EXCLUDED_INVOICE_STATUSES: readonly EasyCountInvoiceStatus[] = ['cancelled', 'failed'];

export type HallInvoiceAmountRow = {
  amount?: number | null;
  status?: string | null;
};

export interface HallBalanceBreakdown {
  /** סכום חיוב לאולם (תקרת ההזמנה) */
  hallAmount: number;
  /** סכום ששולם בפועל ורשום על ההזמנה */
  paidTotal: number;
  /** סכום מחושב מחשבוניות paid (לזיהוי פער מול webhook) */
  paidFromInvoices: number;
  /** סכום חשבוניות pending/draft שטרם נקלטו ב-totalPaid */
  pendingTotal: number;
  /** paidTotal + pendingTotal — הסכום ה"תפוס" מול התקרה */
  committedTotal: number;
  /** hallAmount - committedTotal (מינימום 0) */
  remaining: number;
  /** האם מותר להפיק חשבונית חדשה */
  canIssueInvoice: boolean;
}

function normalizeInvoiceStatus(status?: string | null): EasyCountInvoiceStatus {
  const raw = (status ?? 'pending').toLowerCase();
  if (raw === 'completed') return 'paid';
  if (FINALIZED_INVOICE_STATUSES.includes(raw as EasyCountInvoiceStatus)) return 'paid';
  if (PENDING_INVOICE_STATUSES.includes(raw as EasyCountInvoiceStatus)) {
    return raw as EasyCountInvoiceStatus;
  }
  if (EXCLUDED_INVOICE_STATUSES.includes(raw as EasyCountInvoiceStatus)) {
    return raw as EasyCountInvoiceStatus;
  }
  return 'pending';
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function sumInvoiceAmounts(
  invoices: HallInvoiceAmountRow[],
  statuses: readonly EasyCountInvoiceStatus[],
): number {
  const allowed = new Set(statuses);
  return roundMoney(
    invoices.reduce((sum, invoice) => {
      const status = normalizeInvoiceStatus(invoice.status);
      if (!allowed.has(status)) return sum;
      return sum + (Number(invoice.amount) || 0);
    }, 0),
  );
}

/**
 * פונקציה טהורה — מחשבת פירוט יתרה מול תקרת האולם.
 * committedTotal = paidTotal + pendingTotal
 */
export function computeHallBalanceBreakdown(
  booking: HallBillableBooking & { totalPaid?: number | null },
  invoices: HallInvoiceAmountRow[] = [],
): HallBalanceBreakdown {
  const hallAmount = roundMoney(getHallBillableAmount(booking));
  const paidFromInvoices = sumInvoiceAmounts(invoices, FINALIZED_INVOICE_STATUSES);
  const pendingTotal = sumInvoiceAmounts(invoices, PENDING_INVOICE_STATUSES);

  // totalPaid הוא מקור האמת לכסף שהתקבל (מקדמה ידנית + webhook מ-Easy Count)
  const bookingPaid = roundMoney(Number(booking.totalPaid) || 0);
  // אם webhook לא עודכן — לא מתעלמים מחשבוניות paid ב-DB
  const paidTotal = roundMoney(Math.max(bookingPaid, paidFromInvoices));

  const committedTotal = roundMoney(paidTotal + pendingTotal);
  const remaining = roundMoney(Math.max(0, hallAmount - committedTotal));
  const canIssueInvoice = hallAmount > 0 && remaining > 0.01;

  return {
    hallAmount,
    paidTotal,
    paidFromInvoices,
    pendingTotal,
    committedTotal,
    remaining,
    canIssueInvoice,
  };
}

/** תאימות לאחור — מחזיר רק את היתרה הנותרת */
export function computeRemainingHallBalance(
  booking: HallBillableBooking & { totalPaid?: number | null },
  invoices: HallInvoiceAmountRow[] = [],
): number {
  return computeHallBalanceBreakdown(booking, invoices).remaining;
}

/** טוען הזמנה + חשבוניות ומחשב יתרה — לשימוש ב-controller וב-createHallInvoice */
export async function loadHallBalanceForBooking(bookingId: string): Promise<{
  booking: NonNullable<Awaited<ReturnType<typeof prisma.booking.findUnique>>>;
  invoices: Awaited<ReturnType<typeof prisma.hallInvoice.findMany>>;
  balance: HallBalanceBreakdown;
}> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    const err: Error & { statusCode?: number } = new Error('ההזמנה לא נמצאה.');
    err.statusCode = 404;
    throw err;
  }

  const invoices = await prisma.hallInvoice.findMany({
    where: { bookingId },
    orderBy: { createdAt: 'desc' },
  });

  return {
    booking,
    invoices,
    balance: computeHallBalanceBreakdown(booking, invoices),
  };
}

/** בודק האם סכום חשבונית מבוקש חורג מהיתרה (כולל pending) */
export function assertInvoiceAmountWithinBalance(
  requestedAmount: number,
  balance: HallBalanceBreakdown,
): void {
  const amount = roundMoney(Number(requestedAmount));

  if (balance.remaining <= 0.01) {
    const err: Error & { statusCode?: number } = new Error(
      balance.pendingTotal > 0
        ? 'לא ניתן להפיק חשבונית נוספת — קיימות חשבוניות ממתינות לגבייה שמכסות את יתרת האולם.'
        : 'אין יתרה לחיוב מול האולם.',
    );
    err.statusCode = 400;
    throw err;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    const err: Error & { statusCode?: number } = new Error('סכום החשבונית חייב להיות גדול מ-0.');
    err.statusCode = 400;
    throw err;
  }

  if (amount > balance.remaining + 0.01) {
    const pendingNote =
      balance.pendingTotal > 0
        ? ` (כולל ₪${balance.pendingTotal.toLocaleString('he-IL')} ממתין לגבייה)`
        : '';
    const err: Error & { statusCode?: number } = new Error(
      `סכום החשבונית (₪${amount.toLocaleString('he-IL')}) גבוה מהיתרה לאולם (₪${balance.remaining.toLocaleString('he-IL')})${pendingNote}.`,
    );
    err.statusCode = 400;
    throw err;
  }

  if (balance.committedTotal + amount > balance.hallAmount + 0.01) {
    const err: Error & { statusCode?: number } = new Error(
      `הפקת חשבונית זו תחרוג מתקרת האולם (₪${balance.hallAmount.toLocaleString('he-IL')}). ` +
        `שולם: ₪${balance.paidTotal.toLocaleString('he-IL')}, ממתין: ₪${balance.pendingTotal.toLocaleString('he-IL')}.`,
    );
    err.statusCode = 409;
    throw err;
  }
}
