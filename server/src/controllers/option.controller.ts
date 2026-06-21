import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

export const createNewOption = async (req: Request, res: Response) => {
  const { openedBy, menuId, clientName, clientPhone, eventDate, portions, pricePerPortion } = req.body;

  try {
    const newOption = await prisma.booking.create({
      data: {
        clientAFullName: clientName,
        clientAPhone: clientPhone,
        eventType: 'OPTION', // סטטוס מיוחד
        status: 'OPTION',
        // שדות מותאמים אישית
        openedBy: openedBy, 
        menuId: menuId,
        guestCount: parseInt(portions),
        finalPricePortion: parseFloat(pricePerPortion),
        eventDate: {
          create: {
            date: new Date(eventDate),
          }
        }
      }
    });
    res.status(201).json({ success: true, data: newOption });
  } catch (error) {
    res.status(500).json({ success: false, message: 'שגיאה בשמירת האופציה' });
  }
};