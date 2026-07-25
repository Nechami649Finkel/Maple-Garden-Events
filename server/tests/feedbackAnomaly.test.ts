import { describe, expect, it } from '@jest/globals';
import {
  detectFeedbackDiscrepancy,
  FEEDBACK_CRITICAL_SCORE_BELOW,
  FEEDBACK_SCORE_GAP_THRESHOLD,
} from '../src/utils/feedbackAnomaly';

describe('detectFeedbackDiscrepancy', () => {
  it('flags a category gap of 2 or more', () => {
    const result = detectFeedbackDiscrepancy(
      { foodRating: 5, serviceRating: 4, venueRating: 4 },
      { foodRating: 3, serviceRating: 4, venueRating: 4 },
    );
    expect(FEEDBACK_SCORE_GAP_THRESHOLD).toBe(2);
    expect(result.hasScoreGap).toBe(true);
    expect(result.hasAnomaly).toBe(true);
  });

  it('flags any critical low score below 3', () => {
    const result = detectFeedbackDiscrepancy(
      { foodRating: 4, serviceRating: 4, venueRating: 4 },
      { foodRating: 4, serviceRating: 2, venueRating: 4 },
    );
    expect(FEEDBACK_CRITICAL_SCORE_BELOW).toBe(3);
    expect(result.hasCriticalLow).toBe(true);
    expect(result.hasAnomaly).toBe(true);
  });

  it('returns no anomaly when sides are aligned and healthy', () => {
    const result = detectFeedbackDiscrepancy(
      { foodRating: 5, serviceRating: 4, venueRating: 5 },
      { foodRating: 4, serviceRating: 4, venueRating: 5 },
    );
    expect(result.hasAnomaly).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });
});
