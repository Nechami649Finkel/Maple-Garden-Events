import { NextFunction, Request, Response } from 'express';
import { HmacVerificationError, verifyHmacSha256 } from '../utils/hmac';
import { catchAsync } from './errorHandler';

export type WebhookHmacOptions = {
  secretEnv: string;
  signatureHeader: string;
};

/**
 * Expects `express.raw({ type: 'application/json' })` upstream so `req.body` is a Buffer.
 * On success: `req.rawBody` is set and `req.body` becomes the parsed JSON object.
 */
export function createWebhookHmacMiddleware(options: WebhookHmacOptions) {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    (req as any).rawBody = rawBody;

    const headerName = options.signatureHeader.toLowerCase();
    const signatureHeader = req.headers[headerName];
    const signature = Array.isArray(signatureHeader)
      ? signatureHeader[0]
      : signatureHeader;

    try {
      verifyHmacSha256(
        rawBody,
        typeof signature === 'string' ? signature : undefined,
        process.env[options.secretEnv],
      );
    } catch (err) {
      if (err instanceof HmacVerificationError) {
        res.status(401).json({ success: false, message: 'חתימת webhook לא תקינה.' });
        return;
      }
      // Missing secret in production (and other unexpected errors) → propagate
      throw err;
    }

    try {
      req.body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      res.status(400).json({ success: false, message: 'גוף webhook לא תקין.' });
      return;
    }

    next();
  });
}

export const webhookHmacMiddleware = createWebhookHmacMiddleware({
  secretEnv: 'EASY_COUNT_WEBHOOK_SECRET',
  signatureHeader: 'x-easycount-signature',
});

/** @deprecated Use webhookHmacMiddleware */
export const easyCountWebhookHmac = webhookHmacMiddleware;
