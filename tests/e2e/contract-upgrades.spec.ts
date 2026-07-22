import { test, expect } from '@playwright/test';
import {
  buildAvailableLineItems,
  buildSelectedLineItems,
} from '../../shared/contract/lineItems';

test.describe('contract line items', () => {
  test('moving upgrade from available to selected', () => {
    const upgrades = {
      baseDesign: true,
      amplification: false,
      lighting: false,
      screens: false,
      reception: false,
      separateReception: false,
      extraSecurity: false,
      fireworks: false,
    };

    const options = {
      upgrades,
      kosherType: 'machpud',
      guestCount: 120,
      isHallOnly: false,
      isFoodRelevant: true,
    };

    const availableBefore = buildAvailableLineItems(options);
    expect(availableBefore.some((item) => item.key === 'lighting')).toBe(true);

    const afterAdd = buildSelectedLineItems({
      ...options,
      upgrades: { ...upgrades, lighting: true },
    });
    expect(afterAdd.some((item) => item.label.includes('תאורה'))).toBe(true);

    const availableAfter = buildAvailableLineItems({
      ...options,
      upgrades: { ...upgrades, lighting: true },
    });
    expect(availableAfter.some((item) => item.key === 'lighting')).toBe(false);
  });
});
