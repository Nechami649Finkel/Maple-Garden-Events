/**
 * Hall-only billing totals — excludes external supplier payments from hallTotal / finalTotal.
 */

export interface BookingTotals {
  mainBase: number;
  hallExtrasBase: number;
  externalExtrasBase: number;
  discountVal: number;
  mainSubtotal: number;
  hallExtrasSubtotal: number;
  externalExtrasSubtotal: number;
  mainVat: number;
  hallExtrasVat: number;
  externalExtrasVat: number;
  baseTotal: number;
  hallExtrasTotal: number;
  externalExtrasTotal: number;
  /** baseTotal + hallExtrasTotal — billable to Maple Garden / Easy Count. */
  hallTotal: number;
  /** Same as hallTotal — sent to server as the hall billable amount. */
  finalTotal: number;
  extrasTotal: number;
  base: number;
  subtotal: number;
  vatAmount: number;
}

export function finalizeBookingTotals(
  partial: Omit<
    BookingTotals,
    'hallTotal' | 'finalTotal' | 'extrasTotal'
  >,
): BookingTotals {
  const hallTotal = partial.baseTotal + partial.hallExtrasTotal;
  return {
    ...partial,
    hallTotal,
    finalTotal: hallTotal,
    extrasTotal: partial.hallExtrasTotal,
  };
}
