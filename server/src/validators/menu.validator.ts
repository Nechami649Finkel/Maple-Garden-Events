import { z } from 'zod';

export const addDishSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1),
    description: z.string().optional(),
    price: z.coerce.number().finite().min(0),
    categoryId: z.string().uuid(),
  }),
});

export const updateDishSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      name: z.string().trim().min(1).optional(),
      description: z.string().optional(),
      price: z.coerce.number().finite().min(0).optional(),
    })
    .strict(),
});

export const deleteDishSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
