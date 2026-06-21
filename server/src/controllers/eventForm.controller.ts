import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { generateEventFormPDF } from '../utils/pdfGenerator';
import { sendPDFToClient, sendWhatsAppMessage } from '../Services/emailService';

function mapTableCreate(table: {
  id: number;
  x: number;
  y: number;
  section?: string | null;
  isHonor?: boolean;
  width?: number | null;
  height?: number | null;
}) {
  return {
    tableNumber: table.id,
    positionX: table.x,
    positionY: table.y,
    section: table.section ?? null,
    isHonor: table.isHonor ?? false,
    width: table.width ?? null,
    height: table.height ?? null,
  };
}

export const eventFormController = {

  async searchBookings(req: Request, res: Response) {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const bookings = await prisma.booking.findMany({
        where: {
          status: 'BOOKED',
          OR: [
            { clientAFullName: { contains: q, mode: 'insensitive' } },
            { clientAIdNumber: { contains: q } },
            { clientBFullName: { contains: q, mode: 'insensitive' } },
            { clientBIdNumber: { contains: q } },
          ]
        },
        include: { eventDate: true, eventForm: true }
      });
      res.json({ success: true, data: bookings });
    } catch (e) {
      res.status(500).json({ error: 'שגיאה בחיפוש' });
    }
  },

  async upsertForm(req: Request, res: Response) {
    try {
      const bookingId = typeof req.params.bookingId === 'string' ? req.params.bookingId : '';
      const { id, createdAt, updatedAt, booking: _booking, bookingId: _bid, tables, ...formData } = req.body;

      const form = await prisma.eventForm.upsert({
        where: { bookingId },
        update: { 
          ...formData,
          tables: tables ? {
            deleteMany: {},
            create: tables.map(mapTableCreate)
          } : undefined
        },
        create: { 
          bookingId, 
          ...formData,
          tables: tables ? {
            create: tables.map(mapTableCreate)
          } : undefined
        }
      });

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { eventDate: true }
      });

      if (booking) {
        try {
          const pdfData = {
            eventCode: booking.eventCode,
            clientAFullName: booking.clientAFullName,
            clientAIdNumber: booking.clientAIdNumber,
            clientBFullName: booking.clientBFullName || undefined,
            clientBIdNumber: booking.clientBIdNumber || undefined,
            eventDate: booking.eventDate.date.toString(),
            guestCount: booking.guestCount,
            eventType: booking.eventType,
            timeOfDay: booking.timeOfDay || undefined,
            clientSignatureUrl: booking.clientSignatureUrl,
            contractText: booking.contractText,
            eventForm: form,
          };

          const pdfBuffer = await generateEventFormPDF(pdfData);

          // בניית רשימת נמענים למייל ולוואטסאפ לפי סוג אירוע
          const emails: string[] = [];
          const phones: string[] = [];

          // תמיד מוסיפים את צד א' (הצד המרכזי) אם קיים לו מידע
          if (booking.clientAEmail) emails.push(booking.clientAEmail);
          if (booking.clientAPhone) phones.push(booking.clientAPhone);

          // מוסיפים את צד ב' רק אם סוג האירוע הוא חתונה
          if (booking.eventType === 'חתונה') {
            if (booking.clientBEmail) emails.push(booking.clientBEmail);
            if (booking.clientBPhone) phones.push(booking.clientBPhone);
          }

          // שליחת מייל לכל מי שברשימה
          for (const email of emails) {
            await sendPDFToClient(email, booking.clientAFullName, booking.eventDate.date.toString(), pdfBuffer);
          }

          // שליחת וואטסאפ לכל מי שברשימה
          for (const phone of phones) {
            await sendWhatsAppMessage(phone, booking.clientAFullName, booking.eventDate.date.toString());
          }
        } catch (emailError) {
          console.warn('Failed to send communications:', emailError);
        }
      }

      res.json({ success: true, data: form });
    } catch (e) {
      console.error('Form upsert error:', e);
      res.status(500).json({ error: 'שגיאה בשמירת הטופס' });
    }
  },

  async getForm(req: Request, res: Response) {
    try {
      const bookingId = typeof req.params.bookingId === 'string' ? req.params.bookingId : '';
      const form = await prisma.eventForm.findUnique({
        where: { bookingId },
        include: { 
          booking: { include: { eventDate: true } },
          tables: true 
        }
      });
      res.json(form);
    } catch (e) {
      res.status(500).json({ error: 'שגיאה בשליפת הטופס' });
    }
  },

  async saveTables(req: Request, res: Response) {
    try {
      const bookingId = typeof req.params.bookingId === 'string' ? req.params.bookingId : '';
      const { tables } = req.body;

      if (!Array.isArray(tables)) {
        return res.status(400).json({ error: 'נדרש מערך tables' });
      }

      const form = await prisma.eventForm.upsert({
        where: { bookingId },
        update: {
          tables: {
            deleteMany: {},
            create: tables.map(mapTableCreate),
          },
        },
        create: {
          bookingId,
          tables: {
            create: tables.map(mapTableCreate),
          },
        },
        include: { tables: true },
      });

      res.json({ success: true, data: form });
    } catch (e) {
      console.error('Save tables error:', e);
      res.status(500).json({ error: 'שגיאה בשמירת סידור שולחנות' });
    }
  },

  async getAllForms(req: Request, res: Response) {
    try {
      const forms = await prisma.eventForm.findMany({
        include: { booking: { include: { eventDate: true } } },
        orderBy: { createdAt: 'desc' }
      });
      res.json(forms);
    } catch (e) {
      res.status(500).json({ error: 'שגיאה בשליפת הטפסים' });
    }
  },

  async generatePDF(req: Request, res: Response) {
    try {
      const bookingId = typeof req.params.bookingId === 'string' ? req.params.bookingId : '';
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { 
          eventDate: true,
          eventForm: { include: { tables: true } }
        }
      });

      if (!booking || !booking.eventForm) {
        return res.status(404).json({ error: 'הזמנה או טופס לא נמצאו' });
      }

      const pdfData = {
        eventCode: booking.eventCode,
        clientAFullName: booking.clientAFullName,
        clientAIdNumber: booking.clientAIdNumber,
        clientBFullName: booking.clientBFullName || undefined,
        clientBIdNumber: booking.clientBIdNumber || undefined,
        eventDate: booking.eventDate.date.toString(),
        guestCount: booking.guestCount,
        eventType: booking.eventType,
        timeOfDay: booking.timeOfDay || undefined,
        clientSignatureUrl: booking.clientSignatureUrl,
        contractText: booking.contractText,
        eventForm: booking.eventForm,
      };

      const pdfBuffer = await generateEventFormPDF(pdfData);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="event-form-${booking.clientAFullName}.pdf"`);
      res.send(pdfBuffer);
    } catch (e) {
      console.error('PDF generation error:', e);
      res.status(500).json({ error: 'שגיאה בהפקת PDF' });
    }
  },

  // הפונקציה החדשה לשליחת המייל אוטומטית בלחיצת כפתור
  async sendEmail(req: Request, res: Response) {
    try {
      const bookingId = typeof req.params.bookingId === 'string' ? req.params.bookingId : '';
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { 
          eventDate: true,
          eventForm: { include: { tables: true } }
        }
      });

      if (!booking || !booking.eventForm) {
        return res.status(404).json({ error: 'הזמנה או טופס לא נמצאו' });
      }

      // 1. הכנת הנתונים ליצירת ה-PDF
      const pdfData = {
        eventCode: booking.eventCode,
        clientAFullName: booking.clientAFullName,
        clientAIdNumber: booking.clientAIdNumber,
        clientBFullName: booking.clientBFullName || undefined,
        clientBIdNumber: booking.clientBIdNumber || undefined,
        eventDate: booking.eventDate.date.toString(),
        guestCount: booking.guestCount,
        eventType: booking.eventType,
        timeOfDay: booking.timeOfDay || undefined,
        clientSignatureUrl: booking.clientSignatureUrl,
        contractText: booking.contractText,
        eventForm: booking.eventForm,
      };

      const pdfBuffer = await generateEventFormPDF(pdfData);

      // 2. בדיקה למי לשלוח (לפי חתונה או אירוע אחר)
      const emails: string[] = [];
      if (booking.clientAEmail) emails.push(booking.clientAEmail);
      
      if (booking.eventType === 'חתונה' && booking.clientBEmail) {
        emails.push(booking.clientBEmail);
      }

      if (emails.length === 0) {
        return res.status(400).json({ error: 'לא מוגדרות כתובות אימייל ללקוחות אלו' });
      }

      // 3. שליחת המייל עם ה-PDF המצורף
      for (const email of emails) {
        await sendPDFToClient(email, booking.clientAFullName, booking.eventDate.date.toString(), pdfBuffer);
      }

      res.json({ success: true, message: 'המייל נשלח בהצלחה' });
    } catch (e) {
      console.error('Send email error:', e);
      res.status(500).json({ error: 'שגיאה בשליחת המייל' });
    }
  }
};