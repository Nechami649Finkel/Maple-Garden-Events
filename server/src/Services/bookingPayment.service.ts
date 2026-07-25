/**
 * Booking payment ledger — single source of truth for individual payments.
 * Booking.totalPaid / advancePaid / paymentStatus are derived aggregates.
 */

import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { getHallBillableAmount } from '../utils/hallBilling';
import { resolvePaymentStatus } from './easyCount/helpers';
import { syncBookingPaymentMetadata } from './paymentDeadlineService';
import { createServerError, T } from '../i18n/getServerTranslation';

export type PaymentSource = 'ADVANCE' | 'EASYCOUNT_INVOICE' | 'MANUAL';

export type RecordPaymentInput = {
  bookingId: string;
  tenantId: string;
  amount: number;
  paidAt?: Date;
  paymentMethod: string;
  easycountTransactionId?: string | null;
  hallInvoiceId?: string | null;
  source?: PaymentSource;
  notes?: string | null;
};

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function mapDepositMethodToPaymentMethod(depositMethod?: string | null): string {
  if (!depositMethod) return 'other';
  if (depositMethod === 'credit_card') return 'credit_card';
  if (depositMethod === 'check_upload' || depositMethod === 'check_capture') return 'check';
  if (depositMethod === 'cash') return 'cash';
  if (depositMethod === 'bank_transfer') return 'bank_transfer';
  if (depositMethod === 'easycount') return 'easycount';
  return depositMethod;
}

async function sumLedgerPayments(tx: TxClient | typeof prisma, bookingId: string): Promise<number> {
  const aggregate = await tx.bookingPayment.aggregate({
    where: { bookingId },
    _sum: { amount: true },
  });
  return roundMoney(Number(aggregate._sum.amount) || 0);
}

async function applyPaidAggregates(
  tx: TxClient,
  bookingId: string,
  totalPaid: number,
): Promise<{ totalPaid: number; paymentStatus: string }> {
  const booking = await tx.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw createServerError(T.SERVER.HALL_BALANCE.BOOKING_NOT_FOUND, 404);
  }

  const hallAmount = getHallBillableAmount(booking);
  const paymentStatus = resolvePaymentStatus(totalPaid, hallAmount);

  // Prefer the ADVANCE ledger row; otherwise keep prior advancePaid (or mirror totalPaid).
  const existingAdvance = await tx.bookingPayment.findFirst({
    where: { bookingId, source: 'ADVANCE' },
    orderBy: { paidAt: 'asc' },
  });
  const nextAdvancePaid = existingAdvance
    ? roundMoney(Number(existingAdvance.amount) || 0)
    : roundMoney(Number(booking.advancePaid) || (totalPaid > 0 ? totalPaid : 0));

  await tx.booking.update({
    where: { id: bookingId },
    data: {
      totalPaid,
      paidAmount: totalPaid,
      advancePaid: nextAdvancePaid,
      paymentStatus,
    },
  });

  return { totalPaid, paymentStatus };
}

/**
 * Seed a synthetic ADVANCE ledger row when historical aggregates exist
 * but the ledger is empty — prevents webhook sync from wiping prior advances.
 */
export async function ensureLegacyAdvanceSeeded(
  tx: TxClient,
  booking: {
    id: string;
    tenantId: string;
    advancePaid?: number | null;
    totalPaid?: number | null;
    depositMethod?: string | null;
    easycountDocId?: string | null;
  },
): Promise<void> {
  const existingCount = await tx.bookingPayment.count({ where: { bookingId: booking.id } });
  if (existingCount > 0) return;

  const seedAmount = roundMoney(
    Math.max(Number(booking.advancePaid) || 0, Number(booking.totalPaid) || 0),
  );
  if (seedAmount <= 0) return;

  await tx.bookingPayment.create({
    data: {
      id: randomUUID(),
      tenantId: booking.tenantId,
      bookingId: booking.id,
      amount: seedAmount,
      paidAt: new Date(),
      paymentMethod: mapDepositMethodToPaymentMethod(booking.depositMethod),
      easycountTransactionId: booking.easycountDocId || null,
      source: 'ADVANCE',
      notes: 'Seeded from legacy advancePaid/totalPaid',
    },
  });
}

export async function recordPayment(
  input: RecordPaymentInput,
  options?: { skipMetadataSync?: boolean },
): Promise<{
  payment: Awaited<ReturnType<typeof prisma.bookingPayment.create>>;
  totalPaid: number;
  paymentStatus: string;
  created: boolean;
}> {
  const amount = roundMoney(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw createServerError(T.SERVER.HALL_BALANCE.AMOUNT_POSITIVE, 400);
  }

  const easycountId = input.easycountTransactionId?.trim() || null;

  if (easycountId) {
    const existing = await prisma.bookingPayment.findUnique({
      where: { easycountTransactionId: easycountId },
    });
    if (existing) {
      const totalPaid = await sumLedgerPayments(prisma, input.bookingId);
      const booking = await prisma.booking.findUnique({ where: { id: input.bookingId } });
      return {
        payment: existing,
        totalPaid,
        paymentStatus: booking?.paymentStatus ?? 'pending',
        created: false,
      };
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: input.bookingId } });
    if (!booking) {
      throw createServerError(T.SERVER.HALL_BALANCE.BOOKING_NOT_FOUND, 404);
    }

    await ensureLegacyAdvanceSeeded(tx, booking);

    const payment = await tx.bookingPayment.create({
      data: {
        id: randomUUID(),
        tenantId: input.tenantId || booking.tenantId,
        bookingId: input.bookingId,
        amount,
        paidAt: input.paidAt ?? new Date(),
        paymentMethod: input.paymentMethod || 'other',
        easycountTransactionId: easycountId,
        hallInvoiceId: input.hallInvoiceId ?? null,
        source: input.source ?? 'MANUAL',
        notes: input.notes ?? null,
      },
    });

    const totalPaid = await sumLedgerPayments(tx, input.bookingId);
    const aggregates = await applyPaidAggregates(tx, input.bookingId, totalPaid);
    return { payment, ...aggregates, created: true };
  });

  if (!options?.skipMetadataSync) {
    await syncBookingPaymentMetadata(input.bookingId).catch(() => undefined);
  }

  return result;
}

/** Record (or upsert by EasyCount doc id) an advance payment on the ledger. */
export async function recordAdvancePayment(params: {
  bookingId: string;
  tenantId: string;
  amount: number;
  depositMethod?: string | null;
  easycountDocId?: string | null;
  paidAt?: Date;
}): Promise<void> {
  const amount = roundMoney(Number(params.amount));
  if (amount <= 0) return;

  const easycountId = params.easycountDocId?.trim() || null;

  await prisma.$transaction(async (tx) => {
    if (easycountId) {
      const byDoc = await tx.bookingPayment.findUnique({
        where: { easycountTransactionId: easycountId },
      });
      if (byDoc) return;
    }

    const existingAdvance = await tx.bookingPayment.findFirst({
      where: { bookingId: params.bookingId, source: 'ADVANCE' },
      orderBy: { paidAt: 'asc' },
    });

    if (existingAdvance) {
      const data: Prisma.BookingPaymentUpdateInput = {
        amount,
        paymentMethod: mapDepositMethodToPaymentMethod(params.depositMethod),
        paidAt: params.paidAt ?? existingAdvance.paidAt,
      };
      if (easycountId && !existingAdvance.easycountTransactionId) {
        data.easycountTransactionId = easycountId;
      }
      await tx.bookingPayment.update({ where: { id: existingAdvance.id }, data });
    } else {
      await tx.bookingPayment.create({
        data: {
          id: randomUUID(),
          tenantId: params.tenantId,
          bookingId: params.bookingId,
          amount,
          paidAt: params.paidAt ?? new Date(),
          paymentMethod: mapDepositMethodToPaymentMethod(params.depositMethod),
          easycountTransactionId: easycountId,
          source: 'ADVANCE',
        },
      });
    }

    const totalPaid = await sumLedgerPayments(tx, params.bookingId);
    await applyPaidAggregates(tx, params.bookingId, totalPaid);
  });

  await syncBookingPaymentMetadata(params.bookingId).catch(() => undefined);
}

export async function listBookingPayments(bookingId: string) {
  return prisma.bookingPayment.findMany({
    where: { bookingId },
    orderBy: { paidAt: 'asc' },
  });
}

export async function getBookingFinancialSnapshot(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      payments: { orderBy: { paidAt: 'asc' } },
      hallInvoices: true,
      eventDate: true,
    },
  });
  if (!booking) {
    throw createServerError(T.SERVER.HALL_BALANCE.BOOKING_NOT_FOUND, 404);
  }

  const totalCost = roundMoney(getHallBillableAmount(booking));
  const totalPaid = roundMoney(
    booking.payments.length > 0
      ? booking.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      : Number(booking.totalPaid) || 0,
  );
  const remainingBalance = roundMoney(Math.max(0, totalCost - totalPaid));

  return {
    booking,
    payments: booking.payments,
    totalCost,
    totalPaid,
    remainingBalance,
  };
}
