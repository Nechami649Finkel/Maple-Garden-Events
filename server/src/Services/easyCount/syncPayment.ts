import prisma from '../../config/prisma';
import { getHallBillableAmount } from '../../utils/hallBilling';
import { resolvePaymentStatus } from './helpers';
import { syncBookingPaymentMetadata } from '../paymentDeadlineService';
import type { EasyCountWebhookEvent } from './apiClient';

export async function applyHallInvoicePayment(event: EasyCountWebhookEvent): Promise<{
  bookingId: string;
  invoiceId: string;
  totalPaid: number;
  paymentStatus: string;
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
    return {
      bookingId: invoice.bookingId,
      invoiceId: invoice.id,
      totalPaid: Number(invoice.booking.totalPaid) || 0,
      paymentStatus: invoice.booking.paymentStatus,
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
      const previousPaid = Number(booking.totalPaid) || 0;
      const totalPaid = Math.round((previousPaid + paidAmount) * 100) / 100;
      const hallAmount = getHallBillableAmount(booking);
      const paymentStatus = resolvePaymentStatus(totalPaid, hallAmount);

      booking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          totalPaid,
          paidAmount: totalPaid,
          advancePaid: totalPaid > 0 ? totalPaid : booking.advancePaid,
          paymentStatus,
        },
      });
    }

    return {
      bookingId: updatedInvoice.bookingId,
      invoiceId: updatedInvoice.id,
      totalPaid: Number(booking.totalPaid) || 0,
      paymentStatus: booking.paymentStatus,
    };
  }).then(async (result) => {
    // עדכון paymentDeadline / depositPaid לאחר שינוי תשלום
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
