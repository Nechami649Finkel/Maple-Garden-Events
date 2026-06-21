export const MIN_PORTIONS_PER_UNIT = 50;
export const MIN_PORTIONS_MIXED = 100;

export interface PortionBillingResult {
  menCount: number;
  womenCount: number;
  menBillablePortions: number;
  womenBillablePortions: number;
  totalBillablePortions: number;
  pricePerPortion: number;
  totalAmount: number;
  seatingType: 'separate' | 'mixed';
}

export function calculatePortionBilling(params: {
  finalGuestCount: number;
  seatingType: string;
  menPercent?: number;
  pricePerPortion: number;
}): PortionBillingResult | null {
  const total = params.finalGuestCount;
  if (!total || total <= 0 || !params.pricePerPortion) return null;

  const price = params.pricePerPortion;

  if (params.seatingType === 'mixed') {
    const billable = Math.max(total, MIN_PORTIONS_MIXED);
    return {
      menCount: 0,
      womenCount: 0,
      menBillablePortions: 0,
      womenBillablePortions: 0,
      totalBillablePortions: billable,
      pricePerPortion: price,
      totalAmount: billable * price,
      seatingType: 'mixed',
    };
  }

  const menPct = params.menPercent ?? 50;
  const menCount = Math.round((menPct / 100) * total);
  const womenCount = total - menCount;
  const menBillable = Math.max(menCount, MIN_PORTIONS_PER_UNIT);
  const womenBillable = Math.max(womenCount, MIN_PORTIONS_PER_UNIT);

  return {
    menCount,
    womenCount,
    menBillablePortions: menBillable,
    womenBillablePortions: womenBillable,
    totalBillablePortions: menBillable + womenBillable,
    pricePerPortion: price,
    totalAmount: (menBillable + womenBillable) * price,
    seatingType: 'separate',
  };
}

export function buildPortionMinimumClause(barPortionPrice: number): string {
  return `מינימום מנות לחיוב: באירוע עם ישיבה נפרדת (גברים ונשים), המזמין מתחייב לתשלום מינימום של ${MIN_PORTIONS_PER_UNIT} מנות בכל יחידה, גם אם כמות המוזמנים בפועל באותה יחידה נמוכה מכך. באירוע עם ישיבה מעורבת, המזמין מתחייב לתשלום מינימום של ${MIN_PORTIONS_MIXED} מנות. עלות למנה: ${barPortionPrice} ש"ח.`;
}
