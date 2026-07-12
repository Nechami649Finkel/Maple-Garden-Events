import { Prisma } from '@prisma/client';
import {
  toCalendarDateKey,
  calendarDateForStorage,
  prismaCalendarDayWhere,
  calendarKeyFromDbDate,
  parseCalendarDate,
} from './dateLocal';
import {
  normalizeTimeSlot,
  formatStoredTimeOfDay,
  getTakenSlots,
  getBookableSlotsForDate,
  parseDateLocal,
  validateSlotOnDate,
  SLOT_LABELS,
  type TimeSlot,
} from './timeSlot';
import { validateSlotAvailability } from './bookingDateValidation';
import { allocateEventCode } from './eventCode';
import { isSlotUniqueViolation, slotUniqueConflictError } from './bookingSlotGuard';
import prisma from '../config/prisma';

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

type BookingWithDate = {
  id: string;
  calendarDateId: string;
  clientAFullName: string;
  clientAPhone: string;
  createdBy: string;
  createdAt: Date;
  eventType: string;
  eventDate: { id: string; date: Date } | null;
};

function slotConflictMessage(
  slot: TimeSlot,
  bookings: { isOption?: boolean; timeOfDay?: string | null }[],
): string {
  const optionHeld = bookings.some(
    (b) => b.isOption && normalizeTimeSlot(b.timeOfDay) === slot,
  );
  if (optionHeld) {
    return `משבצת ${SLOT_LABELS[slot]} תפוסה על ידי אופציה.`;
  }
  return `משבצת ${SLOT_LABELS[slot]} תפוסה בתאריך זה.`;
}

async function findRelatedOptionBookings(tx: TxClient, booking: BookingWithDate) {
  const createdAtStart = new Date(booking.createdAt.getTime() - 120_000);
  const createdAtEnd = new Date(booking.createdAt.getTime() + 120_000);
  return tx.booking.findMany({
    where: {
      clientAFullName: booking.clientAFullName,
      clientAPhone: booking.clientAPhone,
      createdBy: booking.createdBy,
      isOption: true,
      createdAt: { gte: createdAtStart, lte: createdAtEnd },
    },
    include: { eventDate: true },
    orderBy: { eventDate: { date: 'asc' } },
  });
}

export async function syncOptionDatesOnEdit(
  tx: TxClient,
  anchor: BookingWithDate,
  data: Record<string, unknown>,
  slot: TimeSlot,
  timeString: string,
  sharedFields: Record<string, unknown>,
  prices: {
    basePrice: number;
    extrasPrice: number;
    externalExtrasPrice: number;
    liveAdditionsTotal: number;
    totalPrice: number;
  },
  optionExpiresAt: Date | null,
): Promise<void> {
  if (!Array.isArray(data.allSelectedDates) || data.allSelectedDates.length === 0) return;

  const requestedKeys = [
    ...new Set(
      data.allSelectedDates.map((item) =>
        toCalendarDateKey(String(typeof item === 'object' && item !== null && 'date' in item ? (item as { date: string }).date : item)),
      ),
    ),
  ];

  if (requestedKeys.length === 0) {
    const err: any = new Error('חייב להישאר לפחות תאריך אחד באופציה.');
    err.statusCode = 400;
    throw err;
  }

  if (requestedKeys.length > 3) {
    const err: any = new Error('ניתן לשמור עד 3 תאריכים לאופציה.');
    err.statusCode = 400;
    throw err;
  }

  const related = await findRelatedOptionBookings(tx, anchor);
  const existingByKey = new Map<string, (typeof related)[0]>();
  for (const row of related) {
    if (row.eventDate?.date) {
      existingByKey.set(calendarKeyFromDbDate(row.eventDate.date), row);
    }
  }

  for (const row of related) {
    const key = row.eventDate?.date ? calendarKeyFromDbDate(row.eventDate.date) : '';
    if (!key || requestedKeys.includes(key)) continue;

    await tx.booking.delete({ where: { id: row.id } });
    const remaining = await tx.booking.count({ where: { calendarDateId: row.calendarDateId } });
    if (remaining === 0) {
      await tx.eventDate.update({
        where: { id: row.calendarDateId },
        data: {
          status: 'AVAILABLE',
          optionExpiresAt: null,
          clientName: null,
          clientPhone: null,
          clientEmail: null,
        },
      });
    }
  }

  for (const row of related) {
    const key = row.eventDate?.date ? calendarKeyFromDbDate(row.eventDate.date) : '';
    if (key && requestedKeys.includes(key) && row.id !== anchor.id) {
      await tx.booking.update({
        where: { id: row.id },
        data: sharedFields,
      });
    }
  }

  for (const calendarKey of requestedKeys) {
    if (existingByKey.has(calendarKey)) continue;

    let eventDate = await tx.eventDate.findFirst({
      where: prismaCalendarDayWhere(calendarKey),
      include: { bookings: true },
    });

    const existingBookings = eventDate?.bookings ?? [];
    const availabilityError = validateSlotAvailability(
      parseDateLocal(calendarKey),
      slot,
      existingBookings,
      String(data.eventType || anchor.eventType),
      { blockShabbatEntirely: true },
    );
    if (availabilityError) {
      const err: any = new Error(`${calendarKey}: ${availabilityError}`);
      err.statusCode = 400;
      throw err;
    }

    const bookableSlots = getBookableSlotsForDate(parseDateLocal(calendarKey), existingBookings);
    if (!bookableSlots.includes(slot)) {
      const taken = getTakenSlots(existingBookings);
      const message = taken.has(slot)
        ? slotConflictMessage(slot, existingBookings)
        : validateSlotOnDate(parseDateLocal(calendarKey), slot) || 'התאריך מלא.';
      const err: any = new Error(`${calendarKey}: ${message}`);
      err.statusCode = 400;
      throw err;
    }

    if (!eventDate) {
      eventDate = await tx.eventDate.create({
        data: {
          date: calendarDateForStorage(calendarKey),
          status: 'OPTION',
          optionExpiresAt: optionExpiresAt,
        },
        include: { bookings: true },
      });
    } else {
      await tx.eventDate.update({
        where: { id: eventDate.id },
        data: {
          status: eventDate.bookings.some((b) => !b.isOption) ? eventDate.status : 'OPTION',
          optionExpiresAt: optionExpiresAt,
        },
      });
    }

    await tx.$executeRaw`SELECT id FROM "EventDate" WHERE id = ${eventDate.id} FOR UPDATE`;

    const eventCode = await allocateEventCode('OPT', tx);
    try {
      await tx.booking.create({
        data: {
          clientAFullName: String(sharedFields.clientAFullName ?? anchor.clientAFullName),
          clientAIdNumber: String(sharedFields.clientAIdNumber ?? ''),
          clientAPhone: String(sharedFields.clientAPhone ?? anchor.clientAPhone),
          clientAEmail: (sharedFields.clientAEmail as string | null) ?? null,
          clientAAddress: (sharedFields.clientAAddress as string | null) ?? null,
          clientBFullName: (sharedFields.clientBFullName as string | null) ?? null,
          clientBIdNumber: (sharedFields.clientBIdNumber as string | null) ?? null,
          clientBPhone: (sharedFields.clientBPhone as string | null) ?? null,
          clientBEmail: (sharedFields.clientBEmail as string | null) ?? null,
          clientBAddress: (sharedFields.clientBAddress as string | null) ?? null,
          eventType: String(sharedFields.eventType ?? anchor.eventType),
          guestCount: Number(sharedFields.guestCount) || 0,
          minimumGuestCount: Number(sharedFields.minimumGuestCount) || Number(sharedFields.guestCount) || 0,
          finalPricePortion: Number(sharedFields.finalPricePortion) || 0,
          hallRentalPrice: sharedFields.hallRentalPrice !== undefined ? Number(sharedFields.hallRentalPrice) : null,
          hasMusic: sharedFields.hasMusic !== undefined ? Boolean(sharedFields.hasMusic) : true,
          akumApprovalCode: (sharedFields.akumApprovalCode as string | null) ?? null,
          managerComments: (sharedFields.managerComments as string | null) ?? null,
          clientComments: (sharedFields.clientComments as string | null) ?? null,
          createdBy: String(sharedFields.createdBy ?? anchor.createdBy),
          isContractSigned: Boolean(sharedFields.isContractSigned),
          clientSignatureUrl: (sharedFields.clientSignatureUrl as string | null) ?? null,
          depositCheckUrl: (sharedFields.depositCheckUrl as string | null) ?? null,
          depositCheckDetails:
            sharedFields.depositCheckDetails == null
              ? Prisma.JsonNull
              : (sharedFields.depositCheckDetails as Prisma.InputJsonValue),
          contractText: (sharedFields.contractText as string | null) ?? null,
          paymentTemplateId: (sharedFields.paymentTemplateId as string | null) ?? null,
          paymentTermsText: (sharedFields.paymentTermsText as string | null) ?? null,
          advancePaid: 0,
          totalPaid: 0,
          securityCheckStatus: 'PENDING',
          eventDate: { connect: { id: eventDate.id } },
          timeOfDay: timeString,
          timeSlot: slot,
          isOption: true,
          eventCode,
          basePrice: prices.basePrice,
          extrasPrice: prices.extrasPrice,
          externalExtrasPrice: prices.externalExtrasPrice,
          liveAdditionsTotal: prices.liveAdditionsTotal,
          totalPrice: prices.totalPrice,
        },
      });
    } catch (createErr) {
      if (isSlotUniqueViolation(createErr)) {
        throw slotUniqueConflictError(slot);
      }
      throw createErr;
    }
  }
}
