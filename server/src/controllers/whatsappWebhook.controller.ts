import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { logger } from '../utils/logger';
import { catchAsync } from '../middlewares/errorHandler';
import {
  formatPhoneForWhatsAppCloud,
  resolveManagerWhatsAppPhone,
  sendWhatsAppCloudText,
} from '../Services/whatsappCloud.service';

export type IncomingWhatsAppMessage = {
  from: string;
  messageId: string;
  timestamp: string;
  type: string;
  text?: string;
  raw: unknown;
};

/**
 * GET /api/webhooks/whatsapp
 * Meta webhook verification challenge.
 */
export const verifyWhatsAppWebhook = (req: Request, res: Response): void => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (mode === 'subscribe' && verifyToken && token === verifyToken && typeof challenge === 'string') {
    logger.info('WhatsApp webhook verified');
    res.status(200).send(challenge);
    return;
  }

  logger.warn('WhatsApp webhook verification failed', {
    mode,
    tokenMatch: Boolean(verifyToken && token === verifyToken),
  });
  res.sendStatus(403);
};

function extractIncomingMessages(payload: unknown): IncomingWhatsAppMessage[] {
  const messages: IncomingWhatsAppMessage[] = [];
  const body = payload as {
    object?: string;
    entry?: {
      changes?: {
        value?: {
          messages?: {
            from?: string;
            id?: string;
            timestamp?: string;
            type?: string;
            text?: { body?: string };
          }[];
        };
      }[];
    }[];
  };

  if (body?.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) {
    return messages;
  }

  for (const entry of body.entry) {
    for (const change of entry.changes || []) {
      for (const msg of change.value?.messages || []) {
        if (!msg.from || !msg.id) continue;
        messages.push({
          from: msg.from,
          messageId: msg.id,
          timestamp: msg.timestamp || '',
          type: msg.type || 'unknown',
          text: msg.text?.body,
          raw: msg,
        });
      }
    }
  }

  return messages;
}

function phoneMatchSuffix(e164Digits: string): string {
  const digits = e164Digits.replace(/\D/g, '');
  return digits.length > 9 ? digits.slice(-9) : digits;
}

async function findBookingForInboundPhone(fromE164: string) {
  const suffix = phoneMatchSuffix(fromE164);
  if (suffix.length < 9) return null;

  const candidates = await prisma.booking.findMany({
    where: {
      OR: [
        { clientAPhone: { contains: suffix } },
        { clientBPhone: { contains: suffix } },
      ],
      eventDate: { status: { in: ['BOOKED', 'OPTION'] } },
    },
    include: { eventDate: true },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });

  const normalizedFrom = formatPhoneForWhatsAppCloud(fromE164);
  for (const booking of candidates) {
    const phones = [booking.clientAPhone, booking.clientBPhone]
      .filter(Boolean)
      .flatMap((raw) => String(raw).split(/[|,;]/))
      .map((p) => formatPhoneForWhatsAppCloud(p.trim()))
      .filter(Boolean);
    if (phones.includes(normalizedFrom) || phones.some((p) => p.endsWith(suffix))) {
      return booking;
    }
  }

  return candidates[0] ?? null;
}

function buildManagerForwardText(params: {
  from: string;
  text?: string;
  booking: {
    id: string;
    eventCode: string;
    clientAFullName: string;
    eventDate?: { date?: Date | null; status?: string | null } | null;
  } | null;
}): string {
  const dateStr = params.booking?.eventDate?.date
    ? params.booking.eventDate.date.toLocaleDateString('he-IL')
    : '—';
  const lines = [
    '📩 הודעת WhatsApp נכנסת מלקוח',
    `מאת: ${params.from}`,
    params.booking
      ? `לקוח: ${params.booking.clientAFullName}\nקוד: ${params.booking.eventCode}\nסטטוס: ${params.booking.eventDate?.status || '—'}\nתאריך אירוע: ${dateStr}`
      : 'לא נמצאה הזמנה פעילה תואמת למספר',
    '',
    `תוכן: ${params.text?.trim() || '(ללא טקסט / מדיה)'}`,
  ];
  return lines.join('\n');
}

async function appendManagerCommentNote(
  bookingId: string,
  existing: string | null | undefined,
  note: string,
): Promise<void> {
  const stamp = new Date().toLocaleString('he-IL');
  const next = `${existing?.trim() ? `${existing.trim()}\n` : ''}[WhatsApp ${stamp}] ${note}`;
  await prisma.booking.update({
    where: { id: bookingId },
    data: { managerComments: next.slice(0, 8000) },
  });
}

/**
 * POST /api/webhooks/whatsapp
 * Incoming Meta webhook events: match booking, persist, forward to manager.
 */
export const handleWhatsAppWebhook = catchAsync(async (req: Request, res: Response) => {
  // Acknowledge immediately-safe: process after response if needed; keep sync for reliability in this app size.
  const incoming = extractIncomingMessages(req.body);

  for (const msg of incoming) {
    const from = formatPhoneForWhatsAppCloud(msg.from);
    const booking = await findBookingForInboundPhone(from);

    try {
      if (booking) {
        await prisma.whatsAppInboundMessage.create({
          data: {
            tenantId: booking.tenantId,
            bookingId: booking.id,
            fromPhone: from,
            waMessageId: msg.messageId,
            messageType: msg.type,
            text: msg.text ?? null,
            forwardedToManager: false,
          },
        });

        const note = msg.text?.trim() || `[${msg.type}]`;
        await appendManagerCommentNote(booking.id, booking.managerComments, note);
      } else {
        // Persist orphan inbound against first active tenant if possible
        const tenant = await prisma.tenant.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
        if (tenant) {
          await prisma.whatsAppInboundMessage.create({
            data: {
              tenantId: tenant.id,
              bookingId: null,
              fromPhone: from,
              waMessageId: msg.messageId,
              messageType: msg.type,
              text: msg.text ?? null,
              forwardedToManager: false,
            },
          });
        }
      }
    } catch (error: unknown) {
      // Unique waMessageId → duplicate webhook delivery; ignore
      const code = (error as { code?: string })?.code;
      if (code !== 'P2002') {
        logger.error('Failed to persist WhatsApp inbound message', { error, messageId: msg.messageId });
      }
    }

    const managerPhone = resolveManagerWhatsAppPhone();
    let forwarded = false;
    if (managerPhone) {
      const forward = await sendWhatsAppCloudText(
        managerPhone,
        buildManagerForwardText({ from, text: msg.text, booking }),
      );
      forwarded = forward.ok;
    }

    if (forwarded) {
      await prisma.whatsAppInboundMessage
        .updateMany({
          where: { waMessageId: msg.messageId },
          data: { forwardedToManager: true },
        })
        .catch(() => undefined);
    }

    logger.info('WhatsApp inbound message processed', {
      from,
      messageId: msg.messageId,
      type: msg.type,
      bookingId: booking?.id ?? null,
      forwardedToManager: forwarded,
    });
  }

  if (incoming.length === 0) {
    logger.debug('WhatsApp webhook event with no inbound messages', {
      object: (req.body as { object?: string })?.object,
    });
  }

  res.sendStatus(200);
});
