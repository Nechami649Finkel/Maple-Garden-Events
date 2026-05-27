import { Request, Response } from 'express';
import prisma from '../config/prisma';

// פונקציה ליצירת הזמנה חדשה (נקראת כשהטופס נשלח)
export const createBooking = async (req: Request, res: Response) => {
  try {
    const data = req.body; // הנתונים מהטופס

    // --- בדיקה: האם המשתמש הנוכחי הוא מנהל? ---
    const isManager = data.userRole === 'manager'; 


    // חישוב אוטומטי של המחיר הכולל
    const calculatedTotalPrice = data.guestCount * data.finalPricePortion;

    // מציאת או יצירת EventDate לפי התאריך
    const eventDate = await prisma.eventDate.upsert({
      where:  { date: new Date(data.calendarDateId) },
      update: { status: 'BOOKED' },
      create: { date: new Date(data.calendarDateId), status: 'BOOKED' }
    });

    // שמירת ההזמנה במסד הנתונים
    const newBooking = await prisma.booking.create({
      data: {
        clientAFullName:   data.clientAFullName,
        clientAIdNumber:   data.clientAIdNumber,
        clientAPhone:      data.clientAPhone,
        clientAEmail:      data.clientAEmail    || null,
        clientAAddress:    data.clientAAddress  || null,
        clientBFullName:   data.clientBFullName || null,
        clientBIdNumber:   data.clientBIdNumber || null,
        clientBPhone:      data.clientBPhone    || null,
        clientBEmail:      data.clientBEmail    || null,
        clientBAddress:    data.clientBAddress  || null,
        calendarDateId:    eventDate.id,
        eventType:         data.eventType,
        guestCount:        Number(data.guestCount),
        finalPricePortion: Number(data.finalPricePortion),
        totalPrice:        calculatedTotalPrice,
        managerComments:   data.managerComments || null,
        clientComments:    data.clientComments  || null,
        createdBy:         data.createdBy || 'נציג מכירות',
        updatedBy:         null
      }
    });

    res.status(201).json({
      success: true,
      message: isManager 
        ? 'ההזמנה אושרה ונשמרה (אישור מנהל הופעל בהצלחה!)' 
        : 'ההזמנה נוצרה ונשמרה בהצלחה במסד הנתונים!',
      data: newBooking
    });

  } catch (error) {
    console.error("Error creating booking:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'קרתה שגיאה בשרת בעת יצירת ההזמנה.' 
    });
  }
};

// פונקציה לשליפת כל ההזמנות (כדי להציג ברשימה למנהל)
export const getAllBookings = async (req: Request, res: Response) => {
  try {
    // בקשה מ-Prisma להביא את כל השורות מטבלת Booking
    const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: 'desc' } // יביא לנו את החדשים ביותר קודם
    });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ 
      success: false, 
      message: 'קרתה שגיאה בשרת בעת שליפת ההזמנות.' 
    });
  }
};