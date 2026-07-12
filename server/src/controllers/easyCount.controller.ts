import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { catchAsync } from '../middlewares/errorHandler';
import {
  applyHallInvoicePayment,
  computeRemainingHallBalance,
  createHallInvoice,
  isEasyCountConfigured,
  listHallInvoices,
  parseEasyCountWebhook,
  verifyEasyCountWebhookSignature,
} from '../Services/easyCount';
import { getHallBillableAmount } from '../utils/hallBilling';
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

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    return res.status(404).json({ success: false, message: 'ההזמנה לא נמצאה.' });
  }

  const hallAmount = getHallBillableAmount(booking);
  const remaining = computeRemainingHallBalance(booking);

  const invoice = await createHallInvoice(booking, {
    amount: req.body?.amount,
    installmentLabel: req.body?.installmentLabel,
    description: req.body?.description,
  });

  res.status(201).json({
    success: true,
    data: {
      invoice,
      hallAmount,
      remainingBefore: remaining,
      remainingAfter: Math.max(0, Math.round((remaining - invoice.amount) * 100) / 100),
    },
  });
});

export const getBookingHallInvoices = catchAsync(async (req: Request, res: Response) => {
  const bookingId = String(req.params.id);

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    return res.status(404).json({ success: false, message: 'ההזמנה לא נמצאה.' });
  }

  const invoices = await listHallInvoices(bookingId);

  res.json({
    success: true,
    data: {
      hallAmount: getHallBillableAmount(booking),
      remaining: computeRemainingHallBalance(booking),
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
