import crypto from 'crypto';
import { getHallBillableAmount } from '../../utils/hallBilling';

export function resolvePaymentStatus(totalPaid: number, hallAmount: number): string {
  if (hallAmount <= 0) return totalPaid > 0 ? 'PARTIAL' : 'pending';
  if (totalPaid >= hallAmount - 0.01) return 'paid';
  if (totalPaid > 0) return 'PARTIAL';
  return 'pending';
}

export function computeRemainingHallBalance(booking: {
  basePrice?: number | null;
  extrasPrice?: number | null;
  liveAdditionsTotal?: number | null;
  totalPrice?: number | null;
  totalPaid?: number | null;
}): number {
  const hallAmount = getHallBillableAmount(booking);
  const paid = Number(booking.totalPaid) || 0;
  return Math.max(0, Math.round((hallAmount - paid) * 100) / 100);
}

export function verifyEasyCountWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
): boolean {
  const secret = process.env.EASY_COUNT_WEBHOOK_SECRET?.trim();
  if (!secret) return true;

  if (!signatureHeader?.trim()) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const provided = signatureHeader.replace(/^sha256=/i, '').trim();
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(provided, 'hex'),
    );
  } catch {
    return false;
  }
}

export function generateMockExternalId(): string {
  return `MOCK-EC-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}
