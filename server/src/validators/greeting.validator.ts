import { z } from 'zod';

export const sendGreetingSchema = z.object({
  body: z.object({
    subject: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(5000),
    scheduledDate: z.string().optional(),
    scheduledTime: z.string().optional(),
  }),
});
