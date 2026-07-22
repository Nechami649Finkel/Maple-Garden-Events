import { z } from 'zod';

const optionalFloat = z.coerce.number().finite().optional();

export const updateSettingsSchema = z.object({
  body: z
    .object({
      vatRate: optionalFloat,
      defaultAdvance: optionalFloat,
      optionDurationHours: z.coerce.number().int().min(1).max(720).optional(),
      basePricePerPortion: optionalFloat,
      kashrutSurcharge: optionalFloat,
      staffPortionPrice: optionalFloat,
      designBasePrice: optionalFloat,
      centerpiecePrice: optionalFloat,
      bridgeChairPrice: optionalFloat,
      lightingPrice: optionalFloat,
      soundSystemPrice: optionalFloat,
      screensPrice: optionalFloat,
      fireworksPrice: optionalFloat,
      akumFee: optionalFloat,
      extraSecurityPrice: optionalFloat,
      receptionPrice: optionalFloat,
      separateReceptionPrice: optionalFloat,
      barPortionPrice: optionalFloat,
      contractText: z.string().nullable().optional(),
      paymentTemplates: z.array(z.object({
        id: z.string().trim().min(1),
        name: z.string().trim().min(1),
        bodyTemplate: z.string().trim().min(1),
        installments: z.array(z.object({
          percent: z.coerce.number().finite().min(0).max(100),
          dueType: z.enum(['WEEK_BEFORE_EVENT', 'HOURS_24_AFTER_EVENT']),
        })).min(1),
      })).optional(),
      defaultPaymentTemplateId: z.string().trim().min(1).optional(),
      hiddenPriceFields: z.array(z.string().trim().min(1)).optional(),
    })
    .strict(),
});

export const addExtraSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1),
    category: z.string().trim().min(1),
    price: z.coerce.number().finite().min(0),
  }),
});

export const updateExtraSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      name: z.string().trim().min(1).optional(),
      category: z.string().trim().min(1).optional(),
      price: z.coerce.number().finite().min(0).optional(),
      isActive: z.boolean().optional(),
    })
    .strict(),
});

export const addStaffSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1),
  }),
});

export const deleteExtraSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const deleteStaffSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
