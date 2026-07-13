import { randomUUID } from 'crypto';
import prisma from '../../config/prisma';
import { getHallBillableAmount } from '../../utils/hallBilling';
import { postEasyCountInvoice } from './apiClient';
import { computeRemainingHallBalance } from './helpers';
import type { EasyCountInvoiceRequest, EasyCountInvoiceResult } from './types';

export type { EasyCountInvoiceRequest, EasyCountInvoiceResult } from './types';
export { parseEasyCountWebhook } from './apiClient';
export { applyHallInvoicePayment, computeRemainingHallBalance, resolvePaymentStatus } from './syncPayment';
export { verifyEasyCountWebhookSignature } from './helpers';

type BookingForInvoice = Parameters<typeof getHallBillableAmount>[0] & {
  id: string;
  eventCode: string;
  clientAFullName: string;
  clientAEmail?: string | null;
  clientAPhone: string;
  isOption?: boolean;
};

export function resolveHallInvoiceAmount(booking: BookingForInvoice): number {
  return getHallBillableAmount(booking);
}

export interface CreateHallInvoiceOptions {
  amount?: number;
  installmentLabel?: string;
  description?: string;
}

export interface StoredHallInvoice extends EasyCountInvoiceResult {
  id: string;
  bookingId: string;
  amount: number;
  installmentLabel?: string | null;
  description?: string | null;
  createdAt: Date;
}

export async function createHallInvoice(
  booking: BookingForInvoice,
  options?: CreateHallInvoiceOptions,
): Promise<StoredHallInvoice> {
  if (booking.isOption) {
    const err: Error & { statusCode?: number } = new Error(
      'לא ניתן להפיק חשבונית לאופציה — יש להמיר לאירוע סגור תחילה.',
    );
    err.statusCode = 400;
    throw err;
  }

  const hallAmount = resolveHallInvoiceAmount(booking);
  const remaining = computeRemainingHallBalance(booking);
  const requestedAmount = options?.amount ?? remaining;
  const amount = Math.round(Number(requestedAmount) * 100) / 100;

  if (!Number.isFinite(amount) || amount <= 0) {
    const err: Error & { statusCode?: number } = new Error(
      remaining <= 0
        ? 'אין יתרה לחיוב מול האולם.'
        : 'סכום החשבונית חייב להיות גדול מ-0.',
    );
    err.statusCode = 400;
    throw err;
  }

  if (amount > remaining + 0.01) {
    const err: Error & { statusCode?: number } = new Error(
      `סכום החשבונית (₪${amount}) גבוה מהיתרה לאולם (₪${remaining}).`,
    );
    err.statusCode = 400;
    throw err;
  }

  const payload: EasyCountInvoiceRequest = {
    bookingId: booking.id,
    eventCode: booking.eventCode,
    clientName: booking.clientAFullName,
    clientEmail: booking.clientAEmail,
    clientPhone: booking.clientAPhone,
    amount,
    description: options?.description ?? `חשבון אירוע ${booking.eventCode}`,
    installmentLabel: options?.installmentLabel,
  };

  const remote = await postEasyCountInvoice(payload);

  const stored = await prisma.hallInvoice.create({
    data: {
      id: randomUUID(),
      bookingId: booking.id,
      externalId: remote.externalId,
      amount,
      status: remote.status,
      paymentUrl: remote.paymentUrl ?? null,
      installmentLabel: options?.installmentLabel ?? null,
      description: payload.description,
    },
  });

  void hallAmount;

  return {
    id: stored.id,
    bookingId: stored.bookingId,
    externalId: stored.externalId,
    amount: stored.amount,
    status: stored.status as EasyCountInvoiceResult['status'],
    paymentUrl: stored.paymentUrl ?? undefined,
    installmentLabel: stored.installmentLabel,
    description: stored.description,
    createdAt: stored.createdAt,
  };
}

export async function listHallInvoices(bookingId: string) {
  return prisma.hallInvoice.findMany({
    where: { bookingId },
    orderBy: { createdAt: 'desc' },
  });
}

export function isEasyCountConfigured(): boolean {
  return Boolean(
    process.env.EASY_COUNT_MOCK_MODE === 'true'
    || (process.env.EASY_COUNT_API_URL?.trim() && process.env.EASY_COUNT_API_KEY?.trim()),
  );
}
