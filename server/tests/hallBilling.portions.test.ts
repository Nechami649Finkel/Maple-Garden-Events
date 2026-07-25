import {
  computeServerPriceBreakdown,
  resolveBillablePortions,
} from '../src/utils/hallBilling';
import { buildEventFinancialSummaryText } from '../src/Services/eventFinancialSummary.service';

describe('Dynamic event total — billable portions', () => {
  const settings = {
    vatRate: 17,
    designBasePrice: 0,
    centerpiecePrice: 0,
    bridgeChairPrice: 0,
    lightingPrice: 0,
    soundSystemPrice: 0,
    screensPrice: 0,
    fireworksPrice: 0,
    extraSecurityPrice: 0,
    receptionPrice: 0,
    separateReceptionPrice: 0,
    barPortionPrice: 0,
  };

  it('resolveBillablePortions uses max(actual, minimum)', () => {
    expect(resolveBillablePortions(250, 300)).toBe(300);
    expect(resolveBillablePortions(400, 300)).toBe(400);
    expect(resolveBillablePortions(0, 300)).toBe(300);
    expect(resolveBillablePortions(undefined, undefined)).toBe(0);
  });

  it('computeServerPriceBreakdown bills max portions × price − discount + upgrades', () => {
    const breakdown = computeServerPriceBreakdown(
      {
        eventType: 'חתונה',
        guestCount: 250,
        minimumGuestCount: 300,
        finalPricePortion: 200,
        discountAmount: 1000,
        kosherType: 'rubin',
        vatType: 'included',
        upgrades: { extraSecurity: true },
      },
      { ...settings, extraSecurityPrice: 650 },
      0,
    );

    // main: 300 * 200 = 60000 − 1000 discount = 59000
    // kosher extras (rubin): 300 * 10 = 3000
    // hall upgrade extraSecurity: 650
    expect(breakdown.basePrice).toBe(59000);
    expect(breakdown.extrasPrice).toBe(3000 + 650);
    expect(breakdown.totalPrice).toBe(59000 + 3000 + 650);
  });

  it('buildEventFinancialSummaryText includes total, payments, remaining', () => {
    const text = buildEventFinancialSummaryText({
      eventCode: 'MG-100',
      eventDateLabel: '01/01/2026',
      totalCost: 10000,
      payments: [
        {
          amount: 5000,
          paidAt: new Date('2026-01-01T12:00:00'),
          paymentMethod: 'credit_card',
          easycountTransactionId: 'DOC-1',
        },
      ],
      remainingBalance: 5000,
      locale: 'he',
    });

    expect(text).toContain('MG-100');
    expect(text).toContain('₪10,000');
    expect(text).toContain('₪5,000');
    expect(text).toContain('DOC-1');
    expect(text).toContain('יתרה לתשלום');
  });
});
