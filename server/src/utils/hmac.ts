import crypto from 'crypto';

export class HmacVerificationError extends Error {
  readonly statusCode = 401;

  constructor(message = 'Invalid webhook signature') {
    super(message);
    this.name = 'HmacVerificationError';
  }
}

/**
 * Fail-closed HMAC-SHA256 verify against raw request bytes.
 * Accepts optional `sha256=` prefix on the provided header value.
 * Throws a hard Error in production when the signing secret is missing.
 */
export function verifyHmacSha256(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string | undefined,
): void {
  const key = secret?.trim();
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('EASYCOUNT_WEBHOOK_SECRET is required in production');
    }
    throw new HmacVerificationError('Webhook signing secret is not configured');
  }

  if (!signatureHeader?.trim()) {
    throw new HmacVerificationError('Missing webhook signature');
  }

  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
    throw new HmacVerificationError('Missing webhook raw body');
  }

  const expected = crypto.createHmac('sha256', key).update(rawBody).digest();
  const providedHex = signatureHeader.replace(/^sha256=/i, '').trim();

  let provided: Buffer;
  try {
    provided = Buffer.from(providedHex, 'hex');
  } catch {
    throw new HmacVerificationError('Malformed webhook signature');
  }

  if (provided.length !== expected.length) {
    throw new HmacVerificationError('Invalid webhook signature');
  }

  if (!crypto.timingSafeEqual(expected, provided)) {
    throw new HmacVerificationError('Invalid webhook signature');
  }
}
