import { z } from 'zod';

const optionalNumber = z.coerce.number().finite().positive().optional();

export const createHallInvoiceSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      amount: optionalNumber,
      installmentLabel: z.string().max(120).optional(),
      description: z.string().max(500).optional(),
    })
    .default({}),
});
