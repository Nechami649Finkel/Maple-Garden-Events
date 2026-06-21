import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import prisma from '../config/prisma';
import * as cron from 'node-cron';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'fake-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'fake-password',
  },
});

const sendWhatsApp = async (phone: string, name: string, message: string) => {
  const formatted = `שלום *${name}*,\n\n${message}\n\n*צוות מייפל - גן אירועים*\nטלפון: 03-6777772`;
  // await axios.post('https://api.green-api.com/...', { phone, message: formatted });
  console.log(`[WHATSAPP] ל-${phone} (${name}):\n${formatted}\n`);
};

const sendEmail = async (email: string, name: string, subject: string, message: string, attachment?: Express.Multer.File) => {
  const mailOptions = {
    from: '"גן אירועים מייפל" <maple.events.il@gmail.com>',
    to: email,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #1e293b; padding: 20px; text-align: center;">
          <h2 style="color: #fff; margin: 0;">גן אירועים מייפל 🍁</h2>
        </div>
        <div style="padding: 25px;">
          <p style="font-size: 1.05rem;">שלום <strong>${name}</strong>,</p>
          <div style="font-size: 1rem; line-height: 1.7; white-space: pre-line;">${message}</div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #64748b; font-size: 0.85rem;">בברכה,<br/><strong>צוות מייפל - גן אירועים</strong></p>
        </div>
      </div>
    `,
    attachments: attachment ? [{ filename: attachment.originalname, content: attachment.buffer }] : [],
  };
  // await transporter.sendMail(mailOptions);
  console.log(`[EMAIL] ל-${email} (${name}) | נושא: ${subject}`);
};

export const sendGreeting = async (req: Request, res: Response) => {
  try {
    const { subject, message, scheduledDate, scheduledTime } = req.body;
    const file: Express.Multer.File | undefined = (req as any).file;

    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'נושא ותוכן הברכה הם שדות חובה.' });
    }

    // שליפת כל הלקוחות
    const bookings = await prisma.booking.findMany({
      select: {
        clientAFullName: true, clientAEmail: true, clientAPhone: true,
        clientBFullName: true, clientBEmail: true, clientBPhone: true,
      }
    });

    // בניית רשימה ייחודית של לקוחות (שם + מייל + טלפון ראשי)
    const clientMap = new Map<string, { name: string; email: string | null; phone: string | null }>();

    for (const b of bookings) {
      // צד א'
      const phoneA = b.clientAPhone?.split(' | ')[0].trim() || null;
      if (!clientMap.has(b.clientAFullName)) {
        clientMap.set(b.clientAFullName, { name: b.clientAFullName, email: b.clientAEmail || null, phone: phoneA });
      }
      // צד ב'
      if (b.clientBFullName) {
        const phoneB = b.clientBPhone?.split(' | ')[0].trim() || null;
        if (!clientMap.has(b.clientBFullName)) {
          clientMap.set(b.clientBFullName, { name: b.clientBFullName, email: b.clientBEmail || null, phone: phoneB });
        }
      }
    }

    const clients = Array.from(clientMap.values());

    const doSend = async () => {
      let emailCount = 0;
      let whatsappCount = 0;

      for (const client of clients) {
        if (client.email) {
          await sendEmail(client.email, client.name, subject, message, file);
          emailCount++;
        }
        if (client.phone) {
          await sendWhatsApp(client.phone, client.name, message);
          whatsappCount++;
        }
      }

      console.log(`[GREETING DONE] מיילים: ${emailCount}, וואטסאפ: ${whatsappCount}`);
      return { emailCount, whatsappCount };
    };

    // תזמון
    if (scheduledDate && scheduledTime) {
      const [year, month, day] = scheduledDate.split('-');
      const [hour, minute] = scheduledTime.split(':');
      const cronExpr = `${minute} ${hour} ${day} ${month} *`;

      cron.schedule(cronExpr, async () => {
        console.log(`[CRON] מריץ שליחת ברכה מתוזמנת...`);
        await doSend();
      }, { timezone: 'Asia/Jerusalem' });

      return res.json({
        success: true,
        message: `הברכה תישלח ב-${day}/${month}/${year} בשעה ${hour}:${minute} ל-${clients.length} לקוחות (מייל + וואטסאפ).`
      });
    }

    // שליחה מיידית
    const { emailCount, whatsappCount } = await doSend();
    res.json({
      success: true,
      message: `הברכה נשלחה! מיילים: ${emailCount}, הודעות וואטסאפ: ${whatsappCount}.`
    });

  } catch (error) {
    console.error('שגיאה בשליחת ברכה:', error);
    res.status(500).json({ success: false, message: 'שגיאה בשרת.' });
  }
};
