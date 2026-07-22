import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { allocateEventCode } from '../utils/eventCode';

/** @deprecated Prefer POST /api/bookings with isOption: true */
export const createNewOption = async (req: Request, res: Response) => {
  const tenantId = (req as any).user?.tenantId;
  if (!tenantId) return res.status(403).json({ error: 'Tenant context is missing.' });
  
  const { openedBy, clientName, clientPhone, eventDate, portions, pricePerPortion } = req.body;

  try {
    const eventCode = await allocateEventCode('OPT');
    const newOption = await prisma.booking.create({
      data: {
        tenant: { connect: { id: tenantId } },
        clientAFullName: clientName || 'לא צוין',
        clientAIdNumber: '',
        clientAPhone: clientPhone || '',
        eventType: 'חתונה',
        timeOfDay: 'evening',
        guestCount: parseInt(portions, 10) || 0,
        finalPricePortion: parseFloat(pricePerPortion) || 0,
        totalPrice: 0,
        basePrice: 0,
        eventCode,
        createdBy: openedBy || 'לא צוין',
        isOption: true,
        eventDate: {
          create: {
            tenant: { connect: { id: tenantId } },
            date: new Date(eventDate),
            status: 'OPTION',
          },
        },
      },
    });
    res.status(201).json({ success: true, data: newOption });
  } catch (error) {
    res.status(500).json({ success: false, message: 'שגיאה בשמירת האופציה' });
  }
};
