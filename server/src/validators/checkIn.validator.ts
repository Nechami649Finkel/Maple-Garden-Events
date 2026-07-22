import { z } from 'zod';

const reserveTableRowSchema = z.object({
  number: z.coerce.number().int(),
  value: z.string(),
});

export const bookingIdParamSchema = z.object({
  params: z.object({ bookingId: z.string().uuid() }),
});

export const updateCheckInSchema = z.object({
  params: z.object({ bookingId: z.string().uuid() }),
  body: z
    .object({
      familiesLabel: z.string().optional(),
      orderedPortions: z.coerce.number().int().min(0).optional(),
      entertainerPortions: z.coerce.number().int().min(0).optional(),
      reservePortions: z.coerce.number().int().min(0).optional(),
      hallReceivedConfirmed: z.boolean().optional(),
      reserveTables: z.array(reserveTableRowSchema).optional(),
      specialAdditions: z.string().nullable().optional(),
      customerSignature: z.string().min(1),
    })
    .strict(),
});
