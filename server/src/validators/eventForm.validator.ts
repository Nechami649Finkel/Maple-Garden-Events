import { z } from 'zod';

const optionalNumber = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : val),
  z.coerce.number().optional(),
);

const optionalBoolean = z.preprocess(
  (val) => (val === null || val === undefined ? undefined : val),
  z.boolean().optional(),
);

const tableSchema = z.object({
  id: z.coerce.number(),
  x: z.coerce.number(),
  y: z.coerce.number(),
  section: z.string().nullable().optional(),
  isHonor: z.boolean().optional(),
  width: z.coerce.number().nullable().optional(),
  height: z.coerce.number().nullable().optional(),
});

const eventFormFieldsSchema = z
  .object({
    eventTime: z.string().nullable().optional(),
    receptionType: z.string().nullable().optional(),
    finalGuestCount: optionalNumber,
    seatingType: z.string().nullable().optional(),
    menPercent: optionalNumber,
    womenPercent: optionalNumber,
    honorTableCount: optionalNumber,
    tableclothId: z.string().nullable().optional(),
    napkinId: z.string().nullable().optional(),
    centerpiece: z.string().nullable().optional(),
    bridgeChair: z.string().nullable().optional(),
    hasLighting: optionalBoolean,
    hasSoundSystem: optionalBoolean,
    hasScreens: optionalBoolean,
    hasFireworks: optionalBoolean,
    entertainersBar: optionalNumber,
    entertainersSitting: optionalNumber,
    entertainersMen: optionalNumber,
    entertainersWomen: optionalNumber,
    depositCheckUrl: z.string().nullable().optional(),
    depositCheckStatus: optionalBoolean,
    depositCheckDetails: z.unknown().optional(),
    akumCode: z.string().nullable().optional(),
    kashrut: z.string().nullable().optional(),
    guestPortionCount: optionalNumber,
    pricePerPortion: optionalNumber,
    kashrutSurcharge: optionalNumber,
    designPrice: optionalNumber,
    extrasJson: z.string().nullable().optional(),
    totalPrice: optionalNumber,
    contractSigned: optionalBoolean,
    contractSentAt: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    menuSelections: z.unknown().optional(),
    tableLayoutImageUrl: z.string().nullable().optional(),
    tables: z.array(tableSchema).optional(),
    menCount: optionalNumber,
    womenCount: optionalNumber,
    akumPaid: optionalBoolean,
  });

export const upsertEventFormSchema = z.object({
  params: z.object({ bookingId: z.string().uuid() }),
  body: eventFormFieldsSchema,
});

export const saveEventFormTablesSchema = z.object({
  params: z.object({ bookingId: z.string().uuid() }),
  body: z.object({
    tables: z.array(tableSchema),
    tableLayoutImageUrl: z.string().optional(),
  }),
});

export const bookingIdParamSchema = z.object({
  params: z.object({ bookingId: z.string().uuid() }),
});
