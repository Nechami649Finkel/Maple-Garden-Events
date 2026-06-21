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
    .refine((data) => data.allSelectedDates?.length || data.calendarDateId, {
      message: "חובה לבחור לפחות תאריך אחד לאירוע",
      path: ["allSelectedDates"],
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