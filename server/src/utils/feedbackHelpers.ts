import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/prisma';
import { getEventEndDateTime } from './eventStart';
import { mailFailureMessage, sendFeedbackRequestEmail } from './mailer';
import { toLocalDateKey } from './timeSlot';
import { sendFeedbackRequestWhatsApp } from './whatsapp';
import { logger } from './logger';
import { emitFeedbackUpdated } from './realtime';

/** Event types that receive feedback requests for both client sides. */
export const DUAL_SIDE_EVENT_TYPES = new Set(['חתונה', 'אירוסין']);

export function isDualSideEvent(eventType?: string | null): boolean {
  return DUAL_SIDE_EVENT_TYPES.has((eventType || '').trim());
}

export function hasContact(info: { phone?: string | null; email?: string | null }): boolean {
  return !!(info.phone?.trim() || info.email?.trim());
}

export function primaryPhone(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  return raw.split(' | ')[0]?.trim() || null;
}

export function computeCombinedAverage(scores: (number | null | undefined)[]): number | null {
  const valid = scores.filter((s): s is number => typeof s === 'number' && !Number.isNaN(s));
  if (valid.length === 0) return null;
  return Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2));
}

export type FeedbackSideInput = {
  side: 'A' | 'B';
  name: string;
  phone?: string | null;
  email?: string | null;
};

export function buildFeedbackSides(booking: {
  eventType: string;
  clientAFullName: string;
  clientAPhone: string;
  clientAEmail?: string | null;
  clientBFullName?: string | null;
  clientBPhone?: string | null;
  clientBEmail?: string | null;
}): FeedbackSideInput[] {
  const sides: FeedbackSideInput[] = [];

  if (hasContact({ phone: booking.clientAPhone, email: booking.clientAEmail })) {
    sides.push({
      side: 'A',
      name: booking.clientAFullName,
      phone: booking.clientAPhone,
      email: booking.clientAEmail,
    });
  }

  if (
    isDualSideEvent(booking.eventType) &&
    booking.clientBFullName?.trim() &&
    hasContact({ phone: booking.clientBPhone, email: booking.clientBEmail })
  ) {
    sides.push({
      side: 'B',
      name: booking.clientBFullName,
      phone: booking.clientBPhone,
      email: booking.clientBEmail,
    });
  }

  return sides;
}

export function isLocalClientUrl(url?: string): boolean {
  const value = (url ?? process.env.CLIENT_URL ?? 'http://localhost:5173').toLowerCase();
  return value.includes('localhost') || value.includes('127.0.0.1') || value.includes('0.0.0.0');
}

export function getClientFeedbackUrl(token: string): string {
  const baseUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  if (isLocalClientUrl(baseUrl)) {
    logger.warn(
      'CLIENT_URL is local — feedback links in emails will not work for external customers. Set CLIENT_URL to a public URL.',
    );
  }
  return `${baseUrl}/feedback/${token}`;
}

export type SideDeliveryResult = {
  clientSide: string;
  clientName: string | null;
  token: string;
  link: string;
  emailSent: boolean;
  whatsappSent: boolean;
  skippedReasons: string[];
};

export async function sendFeedbackLinkForRecord(
  feedback: { id?: string; token: string; clientSide: string; clientName: string | null; isCompleted: boolean },
  contact: { phone?: string | null; email?: string | null },
): Promise<SideDeliveryResult> {
  const skippedReasons: string[] = [];
  let emailSent = false;
  let whatsappSent = false;
  const link = getClientFeedbackUrl(feedback.token);

  if (feedback.isCompleted) {
    return {
      clientSide: feedback.clientSide,
      clientName: feedback.clientName,
      token: feedback.token,
      link,
      emailSent: false,
      whatsappSent: false,
      skippedReasons: ['המשוב כבר מולא — לא נשלח שוב'],
    };
  }

  const email = contact.email?.trim() || null;
  const phone = primaryPhone(contact.phone);

  if (email) {
    const emailResult = await sendFeedbackRequestEmail(email, feedback.clientName, link);
    if (emailResult.ok && !emailResult.simulated) {
      emailSent = true;
    } else if (!emailResult.ok && emailResult.reason) {
      skippedReasons.push(mailFailureMessage(emailResult.reason));
    } else {
      skippedReasons.push('מייל: לא מוגדר בשרת (לא נשלח בפועל)');
    }
  } else {
    skippedReasons.push('לא הוזן אימייל ללקוח');
  }

  if (phone) {
    const waResult = await sendFeedbackRequestWhatsApp(phone, feedback.clientName, link);
    if (waResult.sent) {
      whatsappSent = true;
    } else if (waResult.hasWhatsApp === false) {
      skippedReasons.push('למספר הטלפון אין וואטסאפ');
    } else if (waResult.simulated) {
      skippedReasons.push('וואטסאפ: לא מוגדר (לא נשלח בפועל)');
    } else {
      skippedReasons.push('שליחת הוואטסאפ נכשלה');
    }
  } else {
    skippedReasons.push('לא הוזן טלפון ללקוח');
  }

  if (emailSent || whatsappSent) {
    await prisma.feedback.update({
      where: { token: feedback.token },
      data: {
        lastNotifiedAt: new Date(),
        lastEmailSent: emailSent,
        lastWhatsappSent: whatsappSent,
      },
    });
  }

  return {
    clientSide: feedback.clientSide,
    clientName: feedback.clientName,
    token: feedback.token,
    link,
    emailSent,
    whatsappSent,
    skippedReasons: [...new Set(skippedReasons)],
  };
}

export async function ensureFeedbackRecordsForBooking(booking: {
  id: string;
  eventType: string;
  clientAFullName: string;
  clientAPhone: string;
  clientAEmail?: string | null;
  clientBFullName?: string | null;
  clientBPhone?: string | null;
  clientBEmail?: string | null;
}) {
  const existing = await prisma.feedback.findMany({ where: { bookingId: booking.id } });
  if (existing.length > 0) return existing;

  const sides = buildFeedbackSides(booking);
  if (sides.length === 0) return [];

  await prisma.feedback.createMany({
    data: sides.map((side) => ({
      tenantId: (booking as any).tenantId,
      bookingId: booking.id,
      clientSide: side.side,
      clientName: side.name,
      token: uuidv4(),
    })),
  });

  return prisma.feedback.findMany({ where: { bookingId: booking.id } });
}

export function contactForSide(
  booking: {
    clientAPhone: string;
    clientAEmail?: string | null;
    clientBPhone?: string | null;
    clientBEmail?: string | null;
  },
  clientSide: string,
): { phone?: string | null; email?: string | null } {
  if (clientSide === 'B') {
    return { phone: booking.clientBPhone, email: booking.clientBEmail };
  }
  return { phone: booking.clientAPhone, email: booking.clientAEmail };
}

export function hasEventEnded(
  booking: { timeOfDay?: string | null },
  eventDate: Date,
  eventForm?: { eventTime?: string | null } | null,
  now: Date = new Date(),
): boolean {
  const eventDateStr = toLocalDateKey(eventDate);
  const endAt = getEventEndDateTime(eventDateStr, booking, eventForm);
  return now >= endAt;
}

/** שולח משוב אוטומטית לכל אירוע BOOKED שהסתיים וטרם נוצר לו feedback */
export async function processEndedEventsFeedback(now: Date = new Date()) {
  const candidates = await prisma.booking.findMany({
    where: {
      isOption: false,
      eventDate: { status: 'BOOKED' },
      feedbacks: { none: {} },
    },
    include: {
      eventDate: true,
      eventForm: { select: { eventTime: true } },
    },
  });

  let eventsProcessed = 0;
  let linksSent = 0;

  for (const booking of candidates) {
    if (!booking.eventDate) continue;
    if (!hasEventEnded(booking, booking.eventDate.date, booking.eventForm, now)) continue;

    eventsProcessed++;
    const records = await ensureFeedbackRecordsForBooking(booking);
    for (const record of records) {
      const contact = contactForSide(booking, record.clientSide);
      const result = await sendFeedbackLinkForRecord(record, contact);
      if (result.emailSent || result.whatsappSent) {
        linksSent++;
        logger.info(`✅ נשלח משוב אוטומטי ל-${record.clientName} (צד ${record.clientSide})`);
      } else {
        logger.warn(`⚠️ משוב לא נשלח ל-${record.clientName}: ${result.skippedReasons.join('; ')}`);
      }
    }
    if (records.length > 0) {
      emitFeedbackUpdated({ bookingId: booking.id });
    }
  }

  return { eventsProcessed, linksSent, checked: candidates.length };
}
