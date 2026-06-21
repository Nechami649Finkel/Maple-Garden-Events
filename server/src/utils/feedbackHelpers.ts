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
