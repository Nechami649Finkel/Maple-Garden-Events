import prisma from '../config/prisma';
import { sendPDFToClient, sendWhatsAppMessage } from '../Services/emailService';
import { buildBookingPdfData, generateEventProductionPDF } from './pdfGenerator';

export const EVENT_FORM_EMAIL_COOLDOWN_MS = 60 * 1000;

export type SendEventFormEmailResult =
  | { sent: true }
  | { sent: false; skipped: true; retryAfterSeconds: number }
  | { sent: false; skipped: false; error: string };

export async function sendEventFormEmailIfAllowed(
  bookingId: string,
): Promise<SendEventFormEmailResult> {
  const cutoff = new Date(Date.now() - EVENT_FORM_EMAIL_COOLDOWN_MS);

  const claimed = await prisma.eventForm.updateMany({
    where: {
      bookingId,
      OR: [{ contractSentAt: null }, { contractSentAt: { lt: cutoff } }],
    },
    data: { contractSentAt: new Date() },
  });

  if (claimed.count === 0) {
    const form = await prisma.eventForm.findUnique({
      where: { bookingId },
      select: { contractSentAt: true },
    });
    const retryAfterMs = form?.contractSentAt
      ? EVENT_FORM_EMAIL_COOLDOWN_MS - (Date.now() - form.contractSentAt.getTime())
      : EVENT_FORM_EMAIL_COOLDOWN_MS;
    return {
      sent: false,
      skipped: true,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        eventDate: true,
        eventForm: { include: { tables: true } },
      },
    });

    if (!booking?.eventForm) {
      await prisma.eventForm.update({ where: { bookingId }, data: { contractSentAt: null } });
      return { sent: false, skipped: false, error: 'הזמנה או טופס לא נמצאו' };
    }

    const emails: string[] = [];
    const phones: string[] = [];

    if (booking.clientAEmail) emails.push(booking.clientAEmail);
    if (booking.clientAPhone) phones.push(booking.clientAPhone);

    if (booking.eventType === 'חתונה') {
      if (booking.clientBEmail) emails.push(booking.clientBEmail);
      if (booking.clientBPhone) phones.push(booking.clientBPhone);
    }

    if (emails.length === 0) {
      await prisma.eventForm.update({ where: { bookingId }, data: { contractSentAt: null } });
      return { sent: false, skipped: false, error: 'לא מוגדרות כתובות אימייל ללקוחות אלו' };
    }

    const pdfBuffer = await generateEventProductionPDF(buildBookingPdfData(booking));

    for (const email of emails) {
      await sendPDFToClient(
        email,
        booking.clientAFullName,
        booking.eventDate.date.toString(),
        pdfBuffer,
      );
    }

    for (const phone of phones) {
      await sendWhatsAppMessage(
        phone,
        booking.clientAFullName,
        booking.eventDate.date.toString(),
      );
    }

    return { sent: true };
  } catch (e) {
    await prisma.eventForm.update({ where: { bookingId }, data: { contractSentAt: null } }).catch(() => {});
    throw e;
  }
}
