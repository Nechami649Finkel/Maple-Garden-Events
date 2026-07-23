import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { catchAsync } from '../middlewares/errorHandler';

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

/**
 * POST /api/webhooks/whatsapp
 * Incoming Meta webhook events. Always acknowledge quickly with 200.
 */
export const handleWhatsAppWebhook = catchAsync(async (req: Request, res: Response) => {
  const incoming = extractIncomingMessages(req.body);

  for (const msg of incoming) {
    logger.info('WhatsApp inbound message', {
      from: msg.from,
      messageId: msg.messageId,
      type: msg.type,
      textPreview: msg.text?.slice(0, 120),
    });
    // Hook point for future auto-replies / routing — keep webhook fast.
  }

  if (incoming.length === 0) {
    logger.debug('WhatsApp webhook event with no inbound messages', {
      object: (req.body as { object?: string })?.object,
    });
  }

  res.sendStatus(200);
});
