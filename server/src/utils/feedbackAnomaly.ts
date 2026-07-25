/**
 * Side-to-side feedback anomaly detection.
 * Categories: food, service, venue (hall/cleanliness).
 */

export type FeedbackScoreFields = {
  foodRating: number | null;
  serviceRating: number | null;
  venueRating: number | null;
};

const CATEGORIES = [
  { key: 'foodRating' as const, labelHe: 'אוכל', labelEn: 'Food' },
  { key: 'serviceRating' as const, labelHe: 'שירות', labelEn: 'Service' },
  { key: 'venueRating' as const, labelHe: 'אולם/ניקיון', labelEn: 'Venue/Cleanliness' },
];

export const FEEDBACK_SCORE_GAP_THRESHOLD = 2;
export const FEEDBACK_CRITICAL_SCORE_BELOW = 3;

export type FeedbackDiscrepancyResult = {
  hasAnomaly: boolean;
  hasScoreGap: boolean;
  hasCriticalLow: boolean;
  reasons: string[];
};

/**
 * Compare Side A vs Side B after both tokens are completed.
 * Flags: category gap >= 2, or any score < 3 on either side.
 */
export function detectFeedbackDiscrepancy(
  sideA: FeedbackScoreFields,
  sideB: FeedbackScoreFields,
): FeedbackDiscrepancyResult {
  const reasons: string[] = [];
  let hasScoreGap = false;
  let hasCriticalLow = false;

  for (const cat of CATEGORIES) {
    const a = sideA[cat.key];
    const b = sideB[cat.key];

    if (typeof a === 'number' && a < FEEDBACK_CRITICAL_SCORE_BELOW) {
      hasCriticalLow = true;
      reasons.push(`${cat.labelHe} צד א׳: ${a}`);
    }
    if (typeof b === 'number' && b < FEEDBACK_CRITICAL_SCORE_BELOW) {
      hasCriticalLow = true;
      reasons.push(`${cat.labelHe} צד ב׳: ${b}`);
    }
    if (
      typeof a === 'number'
      && typeof b === 'number'
      && Math.abs(a - b) >= FEEDBACK_SCORE_GAP_THRESHOLD
    ) {
      hasScoreGap = true;
      reasons.push(`פער ב${cat.labelHe}: ${a} מול ${b}`);
    }
  }

  return {
    hasAnomaly: hasScoreGap || hasCriticalLow,
    hasScoreGap,
    hasCriticalLow,
    reasons,
  };
}

export function getFeedbackDashboardUrl(bookingId: string): string {
  const base = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${base}/feedback-manager?bookingId=${encodeURIComponent(bookingId)}`;
}
