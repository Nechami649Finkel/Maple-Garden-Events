import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { sendBumpEmail } from '../utils/mailer';
import { sendBumpWhatsApp } from '../utils/whatsapp';
import { catchAsync } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth';
import { generateEventFormPDF } from '../utils/pdfGenerator';
import { getContractText } from '../utils/getContractText';
import { sendPDFToClient } from '../Services/emailService';
import { io } from '../server';
import {
  formatStoredTimeOfDay,
  SLOT_LABELS,
  parseDateLocal,
  isDateFullyBooked,
  type TimeSlot,
} from '../utils/timeSlot';
import {
  validateSlotAvailability,
  resolveBookingSlot,
} from '../utils/bookingDateValidation';
import {
  allocateEventCode,
  convertOptionCodeToEventCode,
  peekNextEventCodes,
  type EventCodePrefix,
} from '../utils/eventCode';
import { isHallOnlyBooking, HALL_ONLY_EVENT_TYPE } from '../validators/booking.validator';
import { neonTransactionOptions, withDbRetry } from '../utils/dbRetry';
import { paginationMeta, parsePagination } from '../utils/pagination';

function canEditBookingDate(eventDate: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDay = new Date(eventDate);
  eventDay.setHours(0, 0, 0, 0);
  return today < eventDay;
}

function validateHallRentalPriceInput(data: { eventType?: string; hallRentalPrice?: unknown }): string | null {
  if (!isHallOnlyBooking(data)) return null;
  const raw = data.hallRentalPrice;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return 'יש להזין מחיר השכרת אולם';
  }
  const price = Number(raw);
  if (!Number.isFinite(price)) return 'מחיר השכרת אולם חייב להיות מספר תקין';
  if (price <= 0) return 'מחיר השכרת אולם חייב להיות גדול מ-0';
  return null;
}

export const createBooking = catchAsync(async (req: AuthRequest, res: Response) => {
  const data = req.body;
  const isManager = req.user?.role === 'manager'; 
  const currentUserName = req.user?.name || "נציג מערכת";
  let datesToProcess: any[] = [];
  
  if (data.allSelectedDates && data.allSelectedDates.length > 0) {
    datesToProcess = data.allSelectedDates;
  } else if (data.calendarDateId) {
    datesToProcess = [data.calendarDateId];
  }

  if (datesToProcess.length === 0) {
    return res.status(400).json({ success: false, message: 'לא נבחרו תאריכים לאירוע.' });
  }

  const hallPriceError = validateHallRentalPriceInput(data);
  if (hallPriceError) {
    return res.status(400).json({ success: false, message: hallPriceError });
  }

  const isOption = data.isOption === true || datesToProcess.length > 1;
  const newStatus = isOption ? 'OPTION' : 'BOOKED';

  let expiryDate: Date | null = null;
  if (newStatus === 'OPTION') {
    const hoursToAdd = data.optionDurationHours ? Number(data.optionDurationHours) : 48;
    expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + hoursToAdd);
  }

  // 🔥 התיקון שלנו: חישוב חכם של המחיר הכולל (כולל השכרת אולם והנתונים שמגיעים מצד הלקוח)
  let calculatedTotalPrice = 0;
  if (isHallOnlyBooking(data)) {
    calculatedTotalPrice = Number(data.hallRentalPrice) || 0;
  } else {
    calculatedTotalPrice = (Number(data.guestCount) || 0) * (Number(data.finalPricePortion) || 0);
  }
  // לקיחת המחיר הסופי המדויק מצד הלקוח (כולל מע"מ, שדרוגים והנחות)
  if (data.calculatedTotals && data.calculatedTotals.finalTotal !== undefined) {
    calculatedTotalPrice = data.calculatedTotals.finalTotal;
  }

  const clientAPhoneCombined = data.clientAPhone2 ? `${data.clientAPhone} | נוסף: ${data.clientAPhone2}` : data.clientAPhone;
  const clientAAddressCombined = data.clientACity ? `${data.clientACity}, ${data.clientAAddress}` : data.clientAAddress;
  const clientBPhoneCombined = data.clientBPhone2 ? `${data.clientBPhone} | נוסף: ${data.clientBPhone2}` : data.clientBPhone;
  const clientBAddressCombined = data.clientBCity ? `${data.clientBCity}, ${data.clientBAddress}` : data.clientBAddress;

  const resolvedContractText = data.contractText?.trim() || await getContractText();

  let createdBookings: any[] = [];
  let eventsToEmit: { dateId: string, status: string }[] = [];

  await withDbRetry(() =>
    prisma.$transaction(async (tx) => {
    createdBookings = [];
    eventsToEmit = [];

    for (const dateItem of datesToProcess) {
      const dateString = typeof dateItem === 'object' && dateItem !== null ? dateItem.date : dateItem;
      const possibleDate = new Date(dateString);
      
      if (isNaN(possibleDate.getTime())) continue;

      let eventDate = await tx.eventDate.findFirst({
        where: { date: possibleDate },
        include: { bookings: true },
      });

      if (!eventDate) {
        eventDate = await tx.eventDate.create({
          data: { date: possibleDate, status: newStatus, optionExpiresAt: expiryDate },
          include: { bookings: true },
        });
      } else {
        await tx.$executeRaw`SELECT id FROM "EventDate" WHERE id = ${eventDate.id} FOR UPDATE`;
        const updatePayload: Record<string, unknown> = {};
        if (newStatus === 'BOOKED') {
          updatePayload.status = 'BOOKED';
          updatePayload.optionExpiresAt = null;
        } else if (eventDate.status !== 'BOOKED') {
          updatePayload.status = newStatus;
          updatePayload.optionExpiresAt = expiryDate;
        }
        if (Object.keys(updatePayload).length > 0) {
          eventDate = await tx.eventDate.update({
            where: { id: eventDate.id },
            data: updatePayload,
            include: { bookings: true },
          });
        } else {
          eventDate = await tx.eventDate.findUniqueOrThrow({
            where: { id: eventDate.id },
            include: { bookings: true },
          });
        }
      }

      if (newStatus === 'BOOKED' && eventDate) {
        await tx.booking.deleteMany({
          where: { calendarDateId: eventDate.id, isOption: true },
        });
        eventDate = await tx.eventDate.findUniqueOrThrow({
          where: { id: eventDate.id },
          include: { bookings: true },
        });
      }

      const existingBookings = eventDate.bookings || [];
      if (isDateFullyBooked(possibleDate, existingBookings)) {
        const err: any = new Error('התאריך מלא — אין משבצות זמן פנויות.');
        err.statusCode = 400;
        throw err;
      }

      const slot = resolveBookingSlot(
        data.timeOfDay,
        data.startTime,
        data.endTime,
        newStatus === 'OPTION'
      );
      if (!slot) {
        const err: any = new Error('יש לבחור משבצת זמן: בוקר, צהריים או ערב.');
        err.statusCode = 400;
        throw err;
      }

      const slotAvailabilityError = validateSlotAvailability(
        parseDateLocal(possibleDate),
        slot,
        existingBookings,
        data.eventType || 'חתונה',
        { blockShabbatEntirely: newStatus === 'OPTION' }
      );
      if (slotAvailabilityError) {
        const err: any = new Error(slotAvailabilityError);
        err.statusCode = 400;
        throw err;
      }

      const timeString = formatStoredTimeOfDay(slot, data.startTime, data.endTime);
      const eventCode = await allocateEventCode(newStatus === 'OPTION' ? 'OPT' : 'EVT');

      let newBooking;
      try {
        newBooking = await tx.booking.create({
        data: {
          clientAFullName: data.clientAFullName,
          clientAIdNumber: data.clientAIdNumber,
          clientAPhone: clientAPhoneCombined,
          clientAEmail: data.clientAEmail || null,
          clientAAddress: clientAAddressCombined,
          clientBFullName: data.clientBFullName || null,
          clientBIdNumber: data.clientBIdNumber || null,
          clientBPhone: clientBPhoneCombined || null,
          clientBEmail: data.clientBEmail || null,
          clientBAddress: clientBAddressCombined || null,
          
          eventDate: { 
            connect: { id: eventDate.id } 
          },
          
          eventType: data.eventType || 'לא צוין',
          timeOfDay: timeString,
          timeSlot: slot,
          guestCount: Number(data.guestCount) || 0,
          finalPricePortion: Number(data.finalPricePortion) || 0,
          totalPrice: calculatedTotalPrice || 0,
          hallRentalPrice: data.hallRentalPrice ? Number(data.hallRentalPrice) : null, // 🔥 התיקון: שמירת מחיר אולם
          hasMusic: data.hasMusic !== undefined ? data.hasMusic : true,
          akumApprovalCode: data.akumApprovalCode || null,
          advancePaid: 0,
          totalPaid: 0,
          securityCheckStatus: 'PENDING',
          isContractSigned: !!(data.contractSigned && data.clientSignature),
          clientSignatureUrl: data.clientSignature || null,
          isOption: newStatus === 'OPTION',
          managerComments: data.managerComments || null,
          clientComments: data.clientComments || null,
          createdBy: data.createdBy || 'לא צוין',
          eventCode,
          depositCheckUrl: data.depositCheckUrl || null,
          depositCheckDetails: data.depositCheckDetails || null,
          contractText: resolvedContractText,
        }
      });
      } catch (createErr: any) {
        if (createErr?.code === 'P2002') {
          const err: any = new Error(`כבר קיים אירוע ב${SLOT_LABELS[slot as TimeSlot]} בתאריך זה.`);
          err.statusCode = 409;
          throw err;
        }
        throw createErr;
      }
      createdBookings.push(newBooking);
      
      eventsToEmit.push({ dateId: eventDate.id, status: newStatus });
    }
  }, neonTransactionOptions));

  eventsToEmit.forEach(ev => io.emit('date-updated', ev));

  if (data.contractSigned && data.clientSignature && createdBookings.length > 0) {
    try {
      const savedBooking = createdBookings[0];
      const firstDateItem = datesToProcess[0];
      const firstDateString = typeof firstDateItem === 'object' && firstDateItem !== null ? firstDateItem.date : firstDateItem;

      const pdfData = {
        eventCode: savedBooking.eventCode,
        isOption: newStatus === 'OPTION',
        clientAFullName: savedBooking.clientAFullName,
        clientAIdNumber: savedBooking.clientAIdNumber,
        clientAPhone: savedBooking.clientAPhone || undefined,
        clientAEmail: savedBooking.clientAEmail || undefined,
        clientBFullName: savedBooking.clientBFullName || undefined,
        clientBIdNumber: savedBooking.clientBIdNumber || undefined,
        clientBPhone: savedBooking.clientBPhone || undefined,
        clientBEmail: savedBooking.clientBEmail || undefined,
        eventDate: new Date(firstDateString).toString(),
        guestCount: savedBooking.guestCount,
        eventType: savedBooking.eventType,
        timeOfDay: savedBooking.timeOfDay || undefined,
        clientSignatureUrl: data.clientSignature,
        contractText: savedBooking.contractText,
        eventForm: {} 
      };

      const contractPdfBuffer = await generateEventFormPDF(pdfData);
      const clientEmail = savedBooking.clientAEmail || savedBooking.clientBEmail;
      
      if (clientEmail) {
        await sendPDFToClient(
          clientEmail, 
          savedBooking.clientAFullName, 
          new Date(firstDateString).toString(), 
          contractPdfBuffer
        );
      }
    } catch (pdfError) {
      console.error("שגיאה בהפקת או שליחת החוזה הראשוני למייל:", pdfError);
    }
  }

  res.status(201).json({
    success: true,
    message: newStatus === 'OPTION' ? 'האופציות נשמרו והצעת המחיר נשלחה במייל!' : 'האירוע נשמר והחוזה נשלח!',
    data: createdBookings
  });
});

export const getBookingById = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { eventDate: true },
  });

  if (!booking) {
    return res.status(404).json({ success: false, message: 'ההזמנה לא נמצאה.' });
  }

  res.status(200).json({ success: true, data: booking });
});

export const updateBooking = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const data = req.body;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { eventDate: true },
  });

  if (!booking || !booking.eventDate) {
    return res.status(404).json({ success: false, message: 'ההזמנה לא נמצאה.' });
  }

  if (!canEditBookingDate(booking.eventDate.date)) {
    return res.status(403).json({ success: false, message: 'לא ניתן לערוך ביום האירוע או לאחריו.' });
  }

  const hallPriceError = validateHallRentalPriceInput({
    eventType: data.eventType ?? booking.eventType,
    hallRentalPrice: data.hallRentalPrice ?? (booking as { hallRentalPrice?: number | null }).hallRentalPrice,
  });
  if (hallPriceError) {
    return res.status(400).json({ success: false, message: hallPriceError });
  }

  const clientAPhoneCombined = data.clientAPhone2
    ? `${data.clientAPhone} | נוסף: ${data.clientAPhone2}`
    : data.clientAPhone;
  const clientAAddressCombined = data.clientACity
    ? `${data.clientACity}, ${data.clientAAddress}`
    : data.clientAAddress;
  const clientBPhoneCombined = data.clientBPhone2
    ? `${data.clientBPhone} | נוסף: ${data.clientBPhone2}`
    : data.clientBPhone;
  const clientBAddressCombined = data.clientBCity
    ? `${data.clientBCity}, ${data.clientBAddress}`
    : data.clientBAddress;

  const slot = resolveBookingSlot(data.timeOfDay, data.startTime, data.endTime, booking.isOption);
  if (slot) {
    const siblings = await prisma.booking.findMany({
      where: { calendarDateId: booking.eventDate.id, id: { not: id } },
    });
    const slotAvailabilityError = validateSlotAvailability(
      parseDateLocal(booking.eventDate.date),
      slot,
      siblings,
      data.eventType ?? booking.eventType,
      { blockShabbatEntirely: booking.isOption }
    );
    if (slotAvailabilityError) {
      return res.status(400).json({ success: false, message: slotAvailabilityError });
    }
  }

  const timeString = slot
    ? formatStoredTimeOfDay(slot, data.startTime, data.endTime)
    : (data.startTime && data.endTime
      ? `${data.startTime} - ${data.endTime}`
      : booking.timeOfDay);

  // 🔥 התיקון: חישוב מחיר כולל גם בזמן עריכה
  let calculatedTotalPrice = booking.totalPrice;
  if (isHallOnlyBooking(data)) {
    calculatedTotalPrice = Number(data.hallRentalPrice) || 0;
  } else {
    calculatedTotalPrice = (Number(data.guestCount) || 0) * (Number(data.finalPricePortion) || 0);
  }
  if (data.calculatedTotals && data.calculatedTotals.finalTotal !== undefined) {
    calculatedTotalPrice = data.calculatedTotals.finalTotal;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedBooking = await tx.booking.update({
      where: { id },
      data: {
        clientAFullName: data.clientAFullName,
        clientAIdNumber: data.clientAIdNumber,
        clientAPhone: clientAPhoneCombined,
        clientAEmail: data.clientAEmail || null,
        clientAAddress: clientAAddressCombined || null,
        clientBFullName: data.clientBFullName || null,
        clientBIdNumber: data.clientBIdNumber || null,
        clientBPhone: clientBPhoneCombined || null,
        clientBEmail: data.clientBEmail || null,
        clientBAddress: clientBAddressCombined || null,
        eventType: data.eventType,
        timeOfDay: timeString,
        ...(slot ? { timeSlot: slot } : {}),
        guestCount: Number(data.guestCount) || 0,
        finalPricePortion: Number(data.finalPricePortion) || 0,
        totalPrice: calculatedTotalPrice,
        hallRentalPrice: data.hallRentalPrice !== undefined ? Number(data.hallRentalPrice) : (booking as any).hallRentalPrice, // 🔥 התיקון
        hasMusic: data.hasMusic !== undefined ? data.hasMusic : booking.hasMusic,
        akumApprovalCode: data.akumApprovalCode || null,
        managerComments: data.managerComments || null,
        clientComments: data.clientComments || null,
        createdBy: data.createdBy || booking.createdBy,
        isContractSigned: data.clientSignature !== undefined
          ? !!(data.contractSigned && data.clientSignature)
          : booking.isContractSigned,
        clientSignatureUrl: data.clientSignature !== undefined ? data.clientSignature : booking.clientSignatureUrl,
        depositCheckUrl: data.depositCheckUrl !== undefined ? data.depositCheckUrl || null : (booking as { depositCheckUrl?: string | null }).depositCheckUrl,
        depositCheckDetails: data.depositCheckDetails !== undefined ? data.depositCheckDetails || null : (booking as { depositCheckDetails?: unknown }).depositCheckDetails,
        contractText: data.contractText !== undefined ? (data.contractText?.trim() || null) : (booking as { contractText?: string | null }).contractText,
        updatedBy: 'מערכת',
      },
      include: { eventDate: true },
    });

    if (booking.eventDate.status === 'OPTION' && data.optionDurationHours) {
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + Number(data.optionDurationHours));
      await tx.eventDate.update({
        where: { id: booking.eventDate.id },
        data: { optionExpiresAt: expiryDate },
      });
    }
    
    return updatedBooking;
  });

  io.emit('date-updated', { dateId: booking.eventDate.id, status: booking.eventDate.status });
  res.status(200).json({ success: true, message: 'ההזמנה עודכנה בהצלחה.', data: updated });
});

export const getNextEventCode = catchAsync(async (req: Request, res: Response) => {
  const prefix: EventCodePrefix = req.query.prefix === 'EVT' ? 'EVT' : 'OPT';
  const count = Math.min(Math.max(Number(req.query.count) || 1, 1), 10);
  const codes = await peekNextEventCodes(prefix, count);

  res.status(200).json({
    success: true,
    data: {
      code: codes[0],
      codes,
    },
  });
});

export const getCancellationStats = catchAsync(async (req: Request, res: Response) => {
  const { month, year } = req.query; 

  let dateFilter = {};

  if (month && year) {
    const startDate = new Date(Number(year), Number(month) - 1, 1);
    const endDate = new Date(Number(year), Number(month), 1);
    dateFilter = {
      createdAt: {
        gte: startDate, 
        lt: endDate,    
      }
    };
  } 
  else if (year) {
    const startDate = new Date(Number(year), 0, 1); 
    const endDate = new Date(Number(year) + 1, 0, 1); 
    dateFilter = {
      createdAt: {
        gte: startDate,
        lt: endDate,
      }
    };
  }

  const stats = await prisma.cancellationLog.groupBy({
    by: ['reason'],
    where: dateFilter, 
    _count: {
      reason: true,
    },
    orderBy: {
      _count: {
        reason: 'desc',
      },
    },
  });

  const formattedStats = stats.map(stat => ({
    reason: stat.reason,
    count: stat._count.reason,
  }));

  res.status(200).json({ success: true, data: formattedStats });
});

export const addEventAddition = async (req: Request, res: Response) => {
  try {
    const bookingId = req.params.id as string; 
    const { description, cost, staffName, signature, agreedToTerms } = req.body;

    if (!agreedToTerms) {
      return res.status(400).json({ error: 'חובה להסכים לתנאי התשלום' });
    }

    const newAddition = await prisma.$transaction(async (tx) => {
      const addition = await tx.eventAddition.create({
        data: {
          bookingId,
          description,
          cost: Number(cost),
          staffName,
          signature,
          agreedToTerms
        }
      });

      const currentBooking = await tx.booking.findUnique({ where: { id: bookingId } });
      if (currentBooking) {
        const currentTotal = Number(currentBooking.totalPrice) || 0;
        const additionCost = Number(cost) || 0;
        
        await tx.booking.update({
          where: { id: bookingId },
          data: { totalPrice: currentTotal + additionCost }
        });
      }
      
      return addition;
    });

    res.status(201).json({ message: 'התוספת נשמרה בהצלחה!', addition: newAddition });
  } catch (error) {
    console.error('Error adding event addition:', error);
    res.status(500).json({ error: 'שגיאת שרת פנימית בעת שמירת התוספת' });
  }
};

export const finalizeBooking = catchAsync(async (req: Request, res: Response) => {
  const { bookingId, advancePaid, akumApprovalCode, hasMusic, clientSignature, tables } = req.body;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { eventDate: true, eventForm: true }
  });

  if (!booking || !booking.eventDate) return res.status(404).json({ success: false, message: 'ההזמנה לא נמצאה.' });

  let eventCode = convertOptionCodeToEventCode(booking.eventCode);
  if (!eventCode) {
    eventCode = await allocateEventCode('EVT');
  }

  const finalSignature = clientSignature || booking.clientSignatureUrl;

  const updated = await prisma.$transaction(async (tx) => {
    const updatedBooking = await tx.booking.update({
      where: { id: bookingId },
      data: {
        hasMusic,
        akumApprovalCode,
        advancePaid: Number(advancePaid),
        paidAmount: Number(advancePaid),
        paymentStatus: 'PARTIAL',
        isOption: false,
        eventCode,
        isContractSigned: !!finalSignature,
        clientSignatureUrl: finalSignature 
      }
    });

    await tx.eventDate.update({
      where: { id: booking.eventDate.id },
      data: { status: 'BOOKED', optionExpiresAt: null }
    });

    if (tables && Array.isArray(tables)) {
      await tx.eventForm.upsert({
        where: { bookingId },
        update: {
          tables: {
            deleteMany: {},
            create: tables.map((table: any) => ({
              tableNumber: table.id,
              positionX: table.x,
              positionY: table.y,
            }))
          }
        },
        create: {
          bookingId,
          tables: {
            create: tables.map((table: any) => ({
              tableNumber: table.id,
              positionX: table.x,
              positionY: table.y,
            }))
          }
        }
      });
    }

    return updatedBooking;
  });

  if (finalSignature) {
    try {
      const pdfData = {
        eventCode: updated.eventCode,
        isOption: false,
        clientAFullName: updated.clientAFullName,
        clientAIdNumber: updated.clientAIdNumber,
        clientAPhone: updated.clientAPhone || undefined,
        clientAEmail: updated.clientAEmail || undefined,
        clientBFullName: updated.clientBFullName || undefined,
        clientBIdNumber: updated.clientBIdNumber || undefined,
        clientBPhone: updated.clientBPhone || undefined,
        clientBEmail: updated.clientBEmail || undefined,
        eventDate: booking.eventDate.date.toString(),
        guestCount: updated.guestCount,
        eventType: updated.eventType,
        timeOfDay: updated.timeOfDay || undefined,
        clientSignatureUrl: finalSignature,
        contractText: updated.contractText,
        eventForm: booking.eventForm || {} 
      };

      const contractPdfBuffer = await generateEventFormPDF(pdfData);
      
      const clientEmail = updated.clientAEmail || updated.clientBEmail;
      if (clientEmail) {
        await sendPDFToClient(
          clientEmail, 
          updated.clientAFullName, 
          booking.eventDate.date.toString(), 
          contractPdfBuffer
        );
      }
    } catch (pdfError) {
      console.error("שגיאה בהפקת או שליחת חוזה ה-PDF:", pdfError);
    }
  }

  io.emit('date-updated', { dateId: booking.eventDate.id, status: 'BOOKED' });
  res.status(200).json({ success: true, message: 'האירוע נסגר והחוזה נחתם בהצלחה!', data: updated });
});

export const getContractTemplate = catchAsync(async (_req: Request, res: Response) => {
  const contractText = await getContractText();
  res.status(200).json({ success: true, data: { contractText } });
});

export const getAllBookings = catchAsync(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const where: Record<string, unknown> = {};
  if (status) {
    where.eventDate = { status };
  }
  if (search) {
    where.OR = [
      { clientAFullName: { contains: search, mode: 'insensitive' } },
      { clientAIdNumber: { contains: search } },
      { clientBFullName: { contains: search, mode: 'insensitive' } },
      { clientBIdNumber: { contains: search } },
    ];
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { eventDate: true, eventForm: true, additions: true },
    }),
    prisma.booking.count({ where }),
  ]);

  res.status(200).json({
    success: true,
    count: bookings.length,
    data: bookings,
    pagination: paginationMeta(page, limit, total),
  });
});

export const releaseOptions = catchAsync(async (req: Request, res: Response) => {
  const { dateIds, cancelReason, clientName } = req.body; 
  
  if (!dateIds || dateIds.length === 0) return res.status(400).json({ success: false, message: 'לא נבחרו תאריכים לשחרור.' });

  await prisma.$transaction(async (tx) => {
    await tx.eventDate.updateMany({
      where: { id: { in: dateIds } },
      data: { status: 'AVAILABLE', optionExpiresAt: null, clientName: null, clientPhone: null, clientEmail: null }
    });

    await tx.booking.deleteMany({ 
      where: { eventDate: { id: { in: dateIds } } } 
    });
    
    if (cancelReason) {
      await tx.cancellationLog.create({
        data: {
          reason: cancelReason,
          clientName: clientName || 'לא צוין',
        }
      });
    }
  });

  res.status(200).json({ success: true, message: 'התאריכים שוחררו והסטטיסטיקה נשמרה בהצלחה.' });
});

export const bumpOption = catchAsync(async (req: Request, res: Response) => {
  const { dateId } = req.body;
  const eventDate = await prisma.eventDate.findUnique({
    where: { id: dateId },
    include: { bookings: true } 
  });

  if (!eventDate || eventDate.status !== 'OPTION') return res.status(400).json({ success: false, message: 'התאריך אינו מוגדר כאופציה.' });

  const newDeadline = new Date();
  newDeadline.setHours(newDeadline.getHours() + 3);
  await prisma.eventDate.update({ where: { id: dateId }, data: { optionExpiresAt: newDeadline } });

  for (const booking of eventDate.bookings) {
      if (booking.clientAEmail) await sendBumpEmail(booking.clientAEmail, booking.clientAFullName, eventDate.date.toString(), newDeadline);
      if (booking.clientAPhone) {
          await sendBumpWhatsApp(booking.clientAPhone.split(' | ')[0].trim(), booking.clientAFullName, eventDate.date.toString(), newDeadline);
      }
  }

  res.status(200).json({ success: true, message: 'הדד-ליין קוצר.', newDeadline });
});