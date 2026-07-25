import { z } from 'zod';
import { T } from '../i18n/getServerTranslation';

export const releaseOptionsSchema = z.object({
  body: z.object({
    dateIds: z.array(z.string().uuid()).min(1),
    cancelReason: z.string().trim().optional(),
    clientName: z.string().trim().optional(),
  }),
});

export const bumpOptionSchema = z.object({
  body: z.object({
    dateId: z.string().uuid().optional(),
    bookingId: z.string().uuid().optional(),
  }).refine((d) => Boolean(d.dateId || d.bookingId), {
    message: T.SERVER.VALIDATION.DATE_OR_BOOKING_ID_REQUIRED,
  }),
});

export const notifyOptionInterestSchema = z.object({
  body: z.object({
    bookingId: z.string().uuid(),
    message: z.string().trim().min(1).max(2000),
  }),
});

export const addEventAdditionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    description: z.string().trim().min(1),
    cost: z.coerce.number().finite().min(0),
    staffName: z.string().trim().min(1),
    signature: z.string().min(1),
    agreedToTerms: z.literal(true),
  }),
});

export const addBookingUpgradeSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    upgradeKey: z.string().trim().min(1),
  }),
});

export const finalizeBookingSchema = z.object({
  body: z.object({
    bookingId: z.string().uuid(),
    advancePaid: z.coerce.number().finite().min(0),
    akumApprovalCode: z.string().optional(),
    hasMusic: z.boolean().optional(),
    clientSignature: z.string().optional(),
    tables: z.array(z.unknown()).optional(),
  }),
});

export const reissueEasyCountSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    force: z.boolean().optional(),
  }).optional(),
});

export const listBookingPaymentsSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const createBookingPaymentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    amount: z.coerce.number().finite().positive(),
    paidAt: z.union([z.string(), z.date()]).optional(),
    paymentMethod: z.enum([
      'cash',
      'credit_card',
      'check',
      'bank_transfer',
      'easycount',
      'other',
    ]),
    easycountTransactionId: z.string().max(200).optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
  }),
});
