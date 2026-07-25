import prisma from '../../config/prisma';
import { getHallBillableAmount } from '../../utils/hallBilling';
import { resolvePaymentStatus } from './helpers';
import { syncBookingPaymentMetadata } from '../paymentDeadlineService';
import {
  ensureLegacyAdvanceSeeded,
} from '../bookingPayment.service';
import { randomUUID } from 'crypto';
import type { EasyCountWebhookEvent } from './apiClient';

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export async function applyHallInvoicePayment(event: EasyCountWebhookEvent): Promise<{
  bookingId: string;
  invoiceId: string;
  totalPaid: number;
  paymentStatus: string;
  remainingBalance: number;
}> {
  const invoice = await prisma.hallInvoice.findUnique({
    where: { externalId: event.externalId },
    include: { booking: true },
  });

  if (!invoice) {
    const err: Error & { statusCode?: number } = new Error('חשבונית לא נמצאה.');
    err.statusCode = 404;
    throw err;
  }

  if (invoice.status === 'paid' && event.status === 'paid') {
    const totalPaid = Number(invoice.booking.totalPaid) || 0;
    const hallAmount = getHallBillableAmount(invoice.booking);
    return {
      bookingId: invoice.bookingId,
      invoiceId: invoice.id,
      totalPaid,
      paymentStatus: invoice.booking.paymentStatus,
      remainingBalance: roundMoney(Math.max(0, hallAmount - totalPaid)),
    };
  }

  return prisma.$transaction(async (tx) => {
    const paidAmount = event.status === 'paid'
      ? (Number.isFinite(event.amountPaid) && event.amountPaid! > 0
          ? event.amountPaid!
          : invoice.amount)
      : 0;

    const updatedInvoice = await tx.hallInvoice.update({
      where: { id: invoice.id },
      data: {
        status: event.status,
        paidAt: event.status === 'paid'
          ? (event.paidAt ? new Date(event.paidAt) : new Date())
          : invoice.paidAt,
        webhookPayload: event.raw as object,
      },
    });

    let booking = invoice.booking;
    if (event.status === 'paid' && paidAmount > 0) {
      await ensureLegacyAdvanceSeeded(tx, booking);

      const existingLedger = await tx.bookingPayment.findUnique({
        where: { easycountTransactionId: invoice.externalId },
      });

      if (!existingLedger) {
        await tx.bookingPayment.create({
          data: {
            id: randomUUID(),
            tenantId: booking.tenantId,
            bookingId: booking.id,
            amount: roundMoney(paidAmount),
            paidAt: event.paidAt ? new Date(event.paidAt) : new Date(),
            paymentMethod: 'easycount',
            easycountTransactionId: invoice.externalId,
            hallInvoiceId: invoice.id,
            source: 'EASYCOUNT_INVOICE',
          },
        });
      }

      const aggregate = await tx.bookingPayment.aggregate({
        where: { bookingId: booking.id },
        _sum: { amount: true },
      });
      const totalPaid = roundMoney(Number(aggregate._sum.amount) || 0);
      const hallAmount = getHallBillableAmount(booking);
      const paymentStatus = resolvePaymentStatus(totalPaid, hallAmount);

      const advanceRow = await tx.bookingPayment.findFirst({
        where: { bookingId: booking.id, source: 'ADVANCE' },
        orderBy: { paidAt: 'asc' },
      });
      const advancePaid = advanceRow
        ? roundMoney(Number(advanceRow.amount) || 0)
        : (totalPaid > 0 ? totalPaid : booking.advancePaid);

      booking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          totalPaid,
          paidAmount: totalPaid,
          advancePaid,
          paymentStatus,
        },
      });
    }

    const totalPaid = Number(booking.totalPaid) || 0;
    const hallAmount = getHallBillableAmount(booking);

    return {
      bookingId: updatedInvoice.bookingId,
      invoiceId: updatedInvoice.id,
      totalPaid,
      paymentStatus: booking.paymentStatus,
      remainingBalance: roundMoney(Math.max(0, hallAmount - totalPaid)),
    };
  }).then(async (result) => {
    await syncBookingPaymentMetadata(result.bookingId).catch(() => undefined);
    return result;
  });
}

export { resolvePaymentStatus } from './helpers';
export {
  computeHallBalanceBreakdown,
  computeRemainingHallBalance,
  loadHallBalanceForBooking,
  type HallBalanceBreakdown,
} from './hallBalance';
