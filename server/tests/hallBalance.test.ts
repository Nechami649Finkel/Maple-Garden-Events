import {
  assertInvoiceAmountWithinBalance,
  computeHallBalanceBreakdown,
  computeRemainingHallBalance,
} from '../src/Services/easyCount/hallBalance';
import { DEFAULT_LOCALE, resolveServerMessage } from '../src/i18n/getServerTranslation';

function expectHallBalanceError(amount: number, balance: ReturnType<typeof computeHallBalanceBreakdown>, pattern: RegExp) {
  try {
    assertInvoiceAmountWithinBalance(amount, balance);
    throw new Error('Expected assertInvoiceAmountWithinBalance to throw');
  } catch (error) {
    const message = resolveServerMessage(DEFAULT_LOCALE, (error as Error).message, (error as { i18nParams?: Record<string, string> }).i18nParams);
    expect(message).toMatch(pattern);
  }
}

describe('C5 — חישוב יתרת אולם (pending + paid)', () => {
  const baseBooking = {
    basePrice: 10000,
    extrasPrice: 2000,
    liveAdditionsTotal: 500,
    totalPrice: 12500,
    totalPaid: 3000,
  };

  it('מחשב remaining ללא חשבוניות — רק totalPaid', () => {
    const balance = computeHallBalanceBreakdown(baseBooking, []);
    expect(balance.hallAmount).toBe(12500);
    expect(balance.paidTotal).toBe(3000);
    expect(balance.pendingTotal).toBe(0);
    expect(balance.committedTotal).toBe(3000);
    expect(balance.remaining).toBe(9500);
    expect(balance.canIssueInvoice).toBe(true);
  });

  it('מפחית pending invoices מיתרה זמינה', () => {
    const balance = computeHallBalanceBreakdown(baseBooking, [
      { amount: 4000, status: 'pending' },
      { amount: 2000, status: 'draft' },
    ]);
    expect(balance.pendingTotal).toBe(6000);
    expect(balance.committedTotal).toBe(9000);
    expect(balance.remaining).toBe(3500);
  });

  it('לא סופר cancelled/failed מול התקרה', () => {
    const balance = computeHallBalanceBreakdown(baseBooking, [
      { amount: 5000, status: 'cancelled' },
      { amount: 3000, status: 'failed' },
      { amount: 1000, status: 'pending' },
    ]);
    expect(balance.pendingTotal).toBe(1000);
    expect(balance.remaining).toBe(8500);
  });

  it('כש-paid+pending מכסים את התקרה — remaining=0 וחסימת הפקה', () => {
    const balance = computeHallBalanceBreakdown(baseBooking, [
      { amount: 7000, status: 'pending' },
    ]);
    expect(balance.committedTotal).toBe(10000);
    expect(balance.remaining).toBe(2500);
    expect(balance.canIssueInvoice).toBe(true);

    const full = computeHallBalanceBreakdown(
      { ...baseBooking, totalPaid: 5000 },
      [{ amount: 7500, status: 'pending' }],
    );
    expect(full.committedTotal).toBe(12500);
    expect(full.remaining).toBe(0);
    expect(full.canIssueInvoice).toBe(false);
  });

  it('מטפל ב-null/undefined/NaN בבטחה', () => {
    const balance = computeHallBalanceBreakdown(
      { totalPrice: null, totalPaid: undefined },
      [{ amount: null, status: 'pending' }, { amount: NaN, status: 'paid' }],
    );
    expect(balance.hallAmount).toBe(0);
    expect(balance.paidTotal).toBe(0);
    expect(balance.pendingTotal).toBe(0);
    expect(balance.remaining).toBe(0);
    expect(computeRemainingHallBalance({ totalPrice: null })).toBe(0);
  });

  it('משתמש ב-max(totalPaid, paidInvoices) כש-webhook לא עודכן', () => {
    const balance = computeHallBalanceBreakdown(
      { ...baseBooking, totalPaid: 1000 },
      [{ amount: 5000, status: 'paid' }],
    );
    expect(balance.paidTotal).toBe(5000);
    expect(balance.remaining).toBe(7500);
  });

  it('assertInvoiceAmountWithinBalance חוסם חריגה כשיש pending', () => {
    const balance = computeHallBalanceBreakdown(baseBooking, [
      { amount: 9000, status: 'pending' },
    ]);

    expectHallBalanceError(2000, balance, /גבוה מהיתרה/);
    expect(() => assertInvoiceAmountWithinBalance(500, balance)).not.toThrow();
  });

  it('assertInvoiceAmountWithinBalance — הודעה ייעודית כש-pending מכסה את היתרה', () => {
    const balance = computeHallBalanceBreakdown(
      { ...baseBooking, totalPaid: 12500 },
      [{ amount: 1000, status: 'pending' }],
    );

    expectHallBalanceError(100, balance, /ממתינות לגבייה/);
  });
});
