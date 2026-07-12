/**
 * Hall-only billing — amounts billable to Maple Garden (Easy Count).
 * External supplier upgrades and ACUM are stored separately and excluded from totalPrice.
 */

import { isHallOnlyBooking } from '../validators/booking.validator';

export interface CalculatedTotalsInput {
  baseTotal?: number;
  hallExtrasTotal?: number;
  extrasTotal?: number;
  externalExtrasTotal?: number;
  /** Preferred: base + hall extras only (excludes external). */
  hallTotal?: number;
  /** Legacy client field — may include external on older payloads. */
  finalTotal?: number;
}

export interface HallPriceBreakdown {
  basePrice: number;
  extrasPrice: number;
  externalExtrasPrice: number;
  liveAdditionsTotal: number;
  /** basePrice + extrasPrice + liveAdditionsTotal — billable to the hall. */
  totalPrice: number;
}

export interface HallBillableBooking {
  basePrice?: number | null;
  extrasPrice?: number | null;
  liveAdditionsTotal?: number | null;
  totalPrice?: number | null;
}

function isHallOnlyEventType(eventType?: string): boolean {
  return isHallOnlyBooking({ eventType });
}

export function extractHallPriceBreakdown(
  data: {
    eventType?: string;
    calculatedTotals?: CalculatedTotalsInput | null;
    guestCount?: unknown;
    finalPricePortion?: unknown;
    hallRentalPrice?: unknown;
  },
  liveAdditionsTotal = 0,
): HallPriceBreakdown {
  const totals = data.calculatedTotals;

  if (totals?.baseTotal !== undefined) {
    const basePrice = Number(totals.baseTotal) || 0;
    const extrasPrice = Number(totals.hallExtrasTotal ?? totals.extrasTotal) || 0;
    const externalExtrasPrice = Number(totals.externalExtrasTotal) || 0;
    const hallTotal =
      totals.hallTotal !== undefined
        ? Number(totals.hallTotal) || 0
        : basePrice + extrasPrice;

    return {
      basePrice,
      extrasPrice,
      externalExtrasPrice,
      liveAdditionsTotal,
      totalPrice: hallTotal + liveAdditionsTotal,
    };
  }

  if (totals?.finalTotal !== undefined) {
    const externalExtrasPrice = Number(totals.externalExtrasTotal) || 0;
    const hallTotal = Math.max(0, Number(totals.finalTotal) - externalExtrasPrice);
    return {
      basePrice: hallTotal,
      extrasPrice: 0,
      externalExtrasPrice,
      liveAdditionsTotal,
      totalPrice: hallTotal + liveAdditionsTotal,
    };
  }

  let fallback = 0;
  if (isHallOnlyEventType(data.eventType)) {
    fallback = Number(data.hallRentalPrice) || 0;
  } else {
    fallback = (Number(data.guestCount) || 0) * (Number(data.finalPricePortion) || 0);
  }

  return {
    basePrice: fallback,
    extrasPrice: 0,
    externalExtrasPrice: 0,
    liveAdditionsTotal,
    totalPrice: fallback + liveAdditionsTotal,
  };
}

/** Amount to pass to Easy Count / payment collection for the hall. */
export function getHallBillableAmount(booking: HallBillableBooking): number {
  const base = Number(booking.basePrice) || 0;
  const extras = Number(booking.extrasPrice) || 0;
  const live = Number(booking.liveAdditionsTotal) || 0;
  const computed = base + extras + live;
  if (computed > 0) return computed;
  return Number(booking.totalPrice) || 0;
}
