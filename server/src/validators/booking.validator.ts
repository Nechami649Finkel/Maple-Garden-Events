import { z } from 'zod';

export const HALL_ONLY_EVENT_TYPE = 'השכרת אולם בלי אוכל';

export function isHallOnlyBooking(data: { eventType?: string }): boolean {
  return data.eventType === HALL_ONLY_EVENT_TYPE;
}

/** Treat empty strings / null as undefined so optional numeric fields are not coerced to 0. */
const optionalNumber = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : val),
  z.coerce.number().optional()
);

export const createBookingSchema = z.object({
  body: z.object({
    isOption: z.boolean().optional(),
    createdBy: z.string().optional(),
    clientAFullName: z.string().optional(),
    clientAPhone: z.string().optional(),

    guestCount: optionalNumber,
    minimumGuestCount: optionalNumber,
    finalPricePortion: optionalNumber,
    hallRentalPrice: optionalNumber,
    servingStyle: z.string().optional(),
    
    clientAEmail: z.string().email("כתובת אימייל לא תקינה").optional().or(z.literal('')),
    clientBFullName: z.string().optional(),

    timeOfDay: z.string().optional(),
    eventType: z.string().optional(),

    allSelectedDates: z.array(z.any()).optional(),
    calendarDateId: z.string().optional(),
  })
    .superRefine((data, ctx) => {
      if (data.isOption) {
        const name = (data.clientAFullName || '').trim();
        if (name.length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "יש להזין שם פרטי ושם משפחה",
            path: ["clientAFullName"],
          });
        }
        const phone = (data.clientAPhone || '').trim();
        if (phone.length < 9) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "מספר טלפון לא תקין",
            path: ["clientAPhone"],
          });
        }
        if (!(data.createdBy || '').trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "יש לבחור נציג מהרשימה",
            path: ["createdBy"],
          });
        }
        return;
      }

      if (!(data.clientAFullName || '').trim() || (data.clientAFullName || '').trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "שם לקוח הוא חובה",
          path: ["clientAFullName"],
        });
      }
      const phone = (data.clientAPhone || '').trim();
      if (phone.length < 9) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "מספר טלפון לא תקין",
          path: ["clientAPhone"],
        });
      }
      if (!(data.timeOfDay || '').trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "חובה לבחור שעת אירוע",
          path: ["timeOfDay"],
        });
      }
      if (!(data.eventType || '').trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "חובה לבחור סוג אירוע",
          path: ["eventType"],
        });
      }

      if (!data.allSelectedDates?.length && !data.calendarDateId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "חובה לבחור לפחות תאריך אחד לאירוע",
          path: ["allSelectedDates"],
        });
      }

      if (isHallOnlyBooking(data)) {
        const price = Number(data.hallRentalPrice);
        if (!Number.isFinite(price) || price <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "יש להזין מחיר השכרת אולם",
            path: ["hallRentalPrice"],
          });
        }
        return;
      }

      const guestCount = Number(data.guestCount);
      if (!Number.isFinite(guestCount) || guestCount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "חובה להזין מספר אורחים",
          path: ["guestCount"],
        });
      }

      const portionPrice = Number(data.finalPricePortion);
      if (!Number.isFinite(portionPrice) || portionPrice <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "חובה להזין מחיר מנה",
          path: ["finalPricePortion"],
        });
      }
    }),
});

export const updateBookingSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      convertFromOption: z.boolean().optional(),
      clientAFullName: z.string().optional(),
      clientAIdNumber: z.string().optional(),
      clientAPhone: z.string().optional(),
      clientAPhone2: z.string().optional(),
      clientAEmail: z.string().email('כתובת אימייל לא תקינה').optional().or(z.literal('')),
      clientACity: z.string().optional(),
      clientAAddress: z.string().optional(),
      clientBFullName: z.string().optional(),
      clientBIdNumber: z.string().optional(),
      clientBPhone: z.string().optional(),
      clientBPhone2: z.string().optional(),
      clientBEmail: z.string().email('כתובת אימייל לא תקינה').optional().or(z.literal('')),
      clientBCity: z.string().optional(),
      clientBAddress: z.string().optional(),
      eventType: z.string().optional(),
      timeOfDay: z.string().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      guestCount: optionalNumber,
      minimumGuestCount: optionalNumber,
      finalPricePortion: optionalNumber,
      hallRentalPrice: optionalNumber,
      hasMusic: z.boolean().optional(),
      akumApprovalCode: z.string().nullable().optional(),
      managerComments: z.string().nullable().optional(),
      clientComments: z.string().nullable().optional(),
      createdBy: z.string().optional(),
      clientSignature: z.string().nullable().optional(),
      contractSigned: z.boolean().optional(),
      depositCheckUrl: z.string().nullable().optional(),
      depositCheckDetails: z.unknown().optional(),
      contractText: z.string().nullable().optional(),
      paymentTemplateId: z.string().nullable().optional(),
      paymentTermsText: z.string().nullable().optional(),
      advancePaid: optionalNumber,
      releaseDateIds: z.array(z.string().uuid()).optional(),
      optionDurationHours: optionalNumber,
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
      servingStyle: z.string().optional(),
      kosherType: z.string().optional(),
      upgrades: z.unknown().optional(),
      depositMethod: z.string().optional(),
      vatType: z.enum(['included', 'not_included']).optional(),
      overrideOptionDateId: z.string().uuid().optional(),
      isOption: z.boolean().optional(),
      allSelectedDates: z.array(z.unknown()).optional(),
      clientAFirstName: z.string().optional(),
      clientALastName: z.string().optional(),
    }),
});
