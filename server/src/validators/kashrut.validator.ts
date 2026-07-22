import { z } from 'zod';

export const updateKashrutSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      imageUrl: z.string().optional(),
      validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    })
    .strict(),
});
