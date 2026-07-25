/**
 * Unified EasyCount facade — single public entry for:
 * - Advance receipts (createDoc)
 * - Hall invoices (REST)
 * - Webhook payment sync → BookingPayment ledger
 * - Balance / remaining calculations
 * - Configuration / mode meta
 */

import { randomUUID } from 'crypto';
import prisma from '../../config/prisma';
import { postEasyCountInvoice } from './apiClient';
import {
  assertInvoiceAmountWithinBalance,
  computeHallBalanceBreakdown,
} from './hallBalance';
import { syncBookingPaymentMetadata } from '../paymentDeadlineService';
import type { EasyCountInvoiceRequest, EasyCountInvoiceResult } from './types';

export type { EasyCountInvoiceRequest, EasyCountInvoiceResult } from './types';
export type { EasyCountMode } from './config';
export type {
  EasyCountIssueResult,
  EasyCountReceiptInput,
  EasyCountBookingResult,
} from './advanceReceipt';

export {
  getEasyCountMeta,
  isEasyCountConfigured,
  isEasyCountMockMode,
  resolveEasyCountMode,
  getEasyCountWebhookSecret,
} from './config';

export {
  issueAdvanceReceipt,
  issueEasyCountReceiptForBooking,
  ensureAdvanceOnLedger,
  canIssueEasyCountReceipt,
  formatEasyCountUserMessage,
} from './advanceReceipt';

export { parseEasyCountWebhook } from './apiClient';
export {
  applyHallInvoicePayment,
  resolvePaymentStatus,
} from './syncPayment';
export {
  computeHallBalanceBreakdown,
  computeRemainingHallBalance,
  loadHallBalanceForBooking,
  assertInvoiceAmountWithinBalance,
  type HallBalanceBreakdown,
} from './hallBalance';
export { verifyEasyCountWebhookSignature } from './helpers';

type BookingForInvoice = {
  tenantId: string;
  id: string;
  eventCode: string;
  clientAFullName: string;
  clientAEmail?: string | null;
  clientAPhone: string;
  isOption?: boolean;
  basePrice?: number | null;
  extrasPrice?: number | null;
  liveAdditionsTotal?: number | null;
  totalPrice?: number | null;
  totalPaid?: number | null;
};

export function resolveHallInvoiceAmount(booking: BookingForInvoice): number {
  return computeHallBalanceBreakdown(booking, []).hallAmount;
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

  const existingInvoices = await prisma.hallInvoice.findMany({
    where: { bookingId: booking.id },
  });
  const balance = computeHallBalanceBreakdown(booking, existingInvoices);
  const requestedAmount = options?.amount ?? balance.remaining;
  const amount = Math.round(Number(requestedAmount) * 100) / 100;

  assertInvoiceAmountWithinBalance(amount, balance);

  const payload: EasyCountInvoiceRequest = {
    tenantId: booking.tenantId,
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
      tenantId: booking.tenantId,
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
  void syncBookingPaymentMetadata(booking.id);

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
