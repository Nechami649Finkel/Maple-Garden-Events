import { z } from 'zod';

const dateStrParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'תאריך חייב להיות בפורמט YYYY-MM-DD');

export const lockDateSchema = z.object({
  params: z.object({ dateStr: dateStrParam }),
  body: z.object({
    employeeName: z.string().trim().min(1),
  }),
});

export const releaseDateSchema = z.object({
  params: z.object({ dateStr: dateStrParam }),
});

export const dateIdParamSchema = z.object({
  params: z.object({ dateId: z.string().uuid() }),
});

export const saveOptionHoldSchema = z.object({
  body: z.object({
    dates: z.array(z.string().min(1)).min(1),
    clientName: z.string().trim().min(1),
    clientPhone: z.string().trim().min(9),
    clientEmail: z.string().email().optional().or(z.literal('')),
  }),
});

const optionalNumber = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : val),
  z.coerce.number().optional(),
);

export const calendarBookingDetailsSchema = z.object({
  params: z.object({ dateId: z.string().uuid() }),
  body: z
    .object({
      clientAFullName: z.string().trim().min(1),
      clientAIdNumber: z.string().optional(),
      clientAPhone: z.string().trim().min(9),
      clientAEmail: z.string().email().optional().or(z.literal('')),
      clientAAddress: z.string().optional(),
      clientBFullName: z.string().optional(),
      clientBIdNumber: z.string().optional(),
      clientBPhone: z.string().optional(),
      clientBEmail: z.string().email().optional().or(z.literal('')),
      clientBAddress: z.string().optional(),
      eventType: z.string().trim().min(1),
      timeOfDay: z.string().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      guestCount: z.coerce.number().int().min(0),
      minimumGuestCount: optionalNumber,
      finalPricePortion: z.coerce.number().min(0),
      totalPrice: z.coerce.number().min(0),
      basePrice: optionalNumber,
      extrasPrice: optionalNumber,
      externalExtrasPrice: optionalNumber,
      hallRentalPrice: optionalNumber,
      hasMusic: z.boolean().optional(),
      akumApprovalCode: z.string().optional(),
      managerComments: z.string().optional(),
      clientComments: z.string().optional(),
      createdBy: z.string().trim().min(1),
      clientSignature: z.string().optional(),
      contractSigned: z.boolean().optional(),
      depositCheckUrl: z.string().optional(),
      depositCheckDetails: z.unknown().optional(),
      contractText: z.string().optional(),
      calculatedTotals: z
        .object({
          baseTotal: optionalNumber,
          hallExtrasTotal: optionalNumber,
          externalExtrasTotal: optionalNumber,
          extrasTotal: optionalNumber,
          hallTotal: optionalNumber,
          finalTotal: optionalNumber,
        })
        .optional(),
    })
    .strict(),
});
