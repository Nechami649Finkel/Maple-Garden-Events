import { describe, expect, it } from 'vitest';
import {
  MIN_PORTIONS_MIXED,
  MIN_PORTIONS_PER_UNIT,
  calculatePortionBilling,
} from './portionBilling';

describe('calculatePortionBilling', () => {
  it('returns null for invalid guest count or price', () => {
    expect(
      calculatePortionBilling({
        finalGuestCount: 0,
        seatingType: 'mixed',
        pricePerPortion: 250,
      }),
    ).toBeNull();
    expect(
      calculatePortionBilling({
        finalGuestCount: 200,
        seatingType: 'mixed',
        pricePerPortion: 0,
      }),
    ).toBeNull();
  });

  it('applies mixed seating minimum portions', () => {
    const result = calculatePortionBilling({
      finalGuestCount: 80,
      seatingType: 'mixed',
      pricePerPortion: 250,
    });
    expect(result).toMatchObject({
      seatingType: 'mixed',
      totalBillablePortions: MIN_PORTIONS_MIXED,
      totalAmount: MIN_PORTIONS_MIXED * 250,
    });
  });

  it('bills actual guests when above mixed minimum', () => {
    const result = calculatePortionBilling({
      finalGuestCount: 180,
      seatingType: 'mixed',
      pricePerPortion: 200,
    });
    expect(result?.totalBillablePortions).toBe(180);
    expect(result?.totalAmount).toBe(36_000);
  });

  it('applies per-side minima for separate seating', () => {
    const result = calculatePortionBilling({
      finalGuestCount: 60,
      seatingType: 'separate',
      menPercent: 50,
      pricePerPortion: 250,
    });
    expect(result).toMatchObject({
      seatingType: 'separate',
      menCount: 30,
      womenCount: 30,
      menBillablePortions: MIN_PORTIONS_PER_UNIT,
      womenBillablePortions: MIN_PORTIONS_PER_UNIT,
      totalBillablePortions: MIN_PORTIONS_PER_UNIT * 2,
      totalAmount: MIN_PORTIONS_PER_UNIT * 2 * 250,
    });
  });
});
