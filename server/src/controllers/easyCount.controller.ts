import { Request, Response } from 'express';
import { catchAsync } from '../middlewares/errorHandler';
import {
  applyHallInvoicePayment,
  createHallInvoice,
  isEasyCountConfigured,
  loadHallBalanceForBooking,
  parseEasyCountWebhook,
  verifyEasyCountWebhookSignature,
} from '../Services/easyCount';
import { emitBookingUpdated } from '../utils/realtime';

export const getEasyCountStatus = catchAsync(async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      configured: isEasyCountConfigured(),
      mockMode: process.env.EASY_COUNT_MOCK_MODE === 'true',
    },
  });
});

export const createBookingHallInvoice = catchAsync(async (req: Request, res: Response) => {
  const bookingId = String(req.params.id);

  const { booking, balance } = await loadHallBalanceForBooking(bookingId);

  const invoice = await createHallInvoice(booking, {
    amount: req.body?.amount,
    installmentLabel: req.body?.installmentLabel,
    description: req.body?.description,
  });

  res.status(201).json({
    success: true,
    data: {
      invoice,
      hallAmount: balance.hallAmount,
      remainingBefore: balance.remaining,
      remainingAfter: Math.max(0, Math.round((balance.remaining - invoice.amount) * 100) / 100),
      balance: {
        paidTotal: balance.paidTotal,
        pendingTotal: balance.pendingTotal,
        committedTotal: balance.committedTotal,
      },
    },
  });
});

export const getBookingHallInvoices = catchAsync(async (req: Request, res: Response) => {
  const bookingId = String(req.params.id);

  const { balance, invoices } = await loadHallBalanceForBooking(bookingId);

  res.json({
    success: true,
    data: {
      hallAmount: balance.hallAmount,
      remaining: balance.remaining,
      balance: {
        paidTotal: balance.paidTotal,
        pendingTotal: balance.pendingTotal,
        committedTotal: balance.committedTotal,
        canIssueInvoice: balance.canIssueInvoice,
      },
      invoices,
    },
  });
});

export const handleEasyCountWebhook = catchAsync(async (req: Request, res: Response) => {
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  const signature = req.headers['x-easycount-signature'] as string | undefined;

  if (!verifyEasyCountWebhookSignature(rawBody, signature)) {
    return res.status(401).json({ success: false, message: 'חתימת webhook לא תקינה.' });
  }

  const event = parseEasyCountWebhook(req.body);
  if (!event) {
    return res.status(400).json({ success: false, message: 'גוף webhook לא תקין.' });
  }

  const result = await applyHallInvoicePayment(event);
  emitBookingUpdated(result.bookingId);

  res.json({ success: true, data: result });
});
