import crypto from 'crypto';
import { HmacVerificationError, verifyHmacSha256 } from '../../utils/hmac';
import { getEasyCountWebhookSecret } from './config';

export {
  computeHallBalanceBreakdown,
  computeRemainingHallBalance,
  loadHallBalanceForBooking,
  assertInvoiceAmountWithinBalance,
  type HallBalanceBreakdown,
} from './hallBalance';

export function resolvePaymentStatus(totalPaid: number, hallAmount: number): string {
  if (hallAmount <= 0) return totalPaid > 0 ? 'PARTIAL' : 'pending';
  if (totalPaid >= hallAmount - 0.01) return 'paid';
  if (totalPaid > 0) return 'PARTIAL';
  return 'pending';
}

/** @returns true when HMAC matches; false when secret/signature invalid (fail-closed). */
export function verifyEasyCountWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
): boolean {
  const buffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  try {
    verifyHmacSha256(
      buffer,
      signatureHeader,
      getEasyCountWebhookSecret(),
    );
    return true;
  } catch (err) {
    if (err instanceof HmacVerificationError) return false;
    return false;
  }
}

export function generateMockExternalId(): string {
  return `MOCK-EC-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}
