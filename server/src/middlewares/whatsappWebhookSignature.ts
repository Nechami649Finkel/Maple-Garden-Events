import { NextFunction, Request, Response } from 'express';
import { HmacVerificationError, verifyHmacSha256 } from '../utils/hmac';
import { logger } from '../utils/logger';
import { catchAsync } from './errorHandler';

/**
 * Meta WhatsApp Cloud API signature check (`X-Hub-Signature-256`).
 * Expects `express.raw({ type: 'application/json' })` so `req.body` is a Buffer.
 * When WHATSAPP_APP_SECRET is unset outside production, accepts the payload (dev only).
 */
export const whatsappWebhookSignatureMiddleware = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    (req as Request & { rawBody?: Buffer }).rawBody = rawBody;

    const secret = process.env.WHATSAPP_APP_SECRET?.trim();
    const signatureHeader = req.headers['x-hub-signature-256'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('WHATSAPP_APP_SECRET is required in production for webhook POSTs');
        res.status(503).json({ success: false, message: 'WhatsApp webhook not configured.' });
        return;
      }
      logger.warn('WHATSAPP_APP_SECRET unset — skipping Meta signature verification (dev only)');
    } else {
      try {
        verifyHmacSha256(rawBody, typeof signature === 'string' ? signature : undefined, secret);
      } catch (err) {
        if (err instanceof HmacVerificationError) {
          res.status(401).json({ success: false, message: 'WhatsApp webhook signature invalid.' });
          return;
        }
        throw err;
      }
    }

    try {
      req.body = rawBody.length ? JSON.parse(rawBody.toString('utf8')) : {};
    } catch {
      res.status(400).json({ success: false, message: 'Invalid WhatsApp webhook body.' });
      return;
    }

    next();
  },
);
