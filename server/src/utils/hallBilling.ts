/**
 * Hall-only billing — amounts billable to Maple Garden (Easy Count).
 * External supplier upgrades and ACUM are stored separately and excluded from totalPrice.
 */

import { resolveEffectiveUpgrades } from './contractSections';
import { isHallOnlyBooking, HALL_ONLY_EVENT_TYPE } from '../validators/booking.validator';
import {
  buildUpgradesPricingFromSettings,
  EXTERNAL_UPGRADE_KEYS,
  HALL_UPGRADE_KEYS,
  KOSHER_PRICING,
} from './pricing';

/** סטייה מותרת בין חישוב לקוח לשרת (₪) — מכסה עיגולי מע"מ */
export const PRICE_TOLERANCE_ILS = 1;

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

export interface ServerPricingInput {
  eventType?: string;
  guestCount?: unknown;
  finalPricePortion?: unknown;
  hallRentalPrice?: unknown;
  kosherType?: string | null;
  vatType?: string | null;
  discountPercent?: unknown;
  discountAmount?: unknown;
  upgrades?: unknown;
  calculatedTotals?: CalculatedTotalsInput | null;
}

/**
 * חישוב מחיר מלא בצד השרת — מקור אמת: SystemSettings + שדות ההזמנה.
 * משקף את לוגיקת calculateTotals() ב-BookingForm.tsx.
 */
export function computeServerPriceBreakdown(
  data: ServerPricingInput,
  systemSettings: Record<string, unknown> | null | undefined,
  liveAdditionsTotal = 0,
): HallPriceBreakdown {
  const isHallOnly = data.eventType === HALL_ONLY_EVENT_TYPE;
  const isFoodRelevant = !isHallOnly;
  const vatRate = Number(systemSettings?.vatRate);
  const effectiveVatRate = Number.isFinite(vatRate) ? vatRate : 17;
  const vatType = data.vatType === 'not_included' ? 'not_included' : 'included';
  const upgradesPricing = buildUpgradesPricingFromSettings(systemSettings);
  const upgrades = resolveEffectiveUpgrades(data.upgrades);

  let mainBase = 0;
  if (isHallOnly) {
    mainBase = Number(data.hallRentalPrice) || 0;
  } else if (isFoodRelevant) {
    const portions = Number(data.guestCount) || 0;
    const portionPrice = Number(data.finalPricePortion) || 0;
    mainBase = portions * portionPrice;
  }

  let hallExtrasBase = 0;
  if (isFoodRelevant) {
    const portions = Number(data.guestCount) || 0;
    const kosherKey = data.kosherType || 'machpud';
    const kosherExtra = KOSHER_PRICING[kosherKey]?.extra ?? KOSHER_PRICING.machpud.extra;
    hallExtrasBase += portions * kosherExtra;
  }
  for (const key of HALL_UPGRADE_KEYS) {
    if (upgrades[key]) {
      hallExtrasBase += upgradesPricing[key] ?? 0;
    }
  }

  let externalExtrasBase = 0;
  for (const key of EXTERNAL_UPGRADE_KEYS) {
    if (key === 'baseDesign' && isHallOnly) continue;
    if (upgrades[key]) {
      externalExtrasBase += upgradesPricing[key] ?? 0;
    }
  }

  let discountVal = 0;
  if (data.discountPercent) {
    discountVal += mainBase * (Number(data.discountPercent) / 100);
  }
  if (data.discountAmount) {
    discountVal += Number(data.discountAmount);
  }

  const mainSubtotal = Math.max(0, mainBase - discountVal);
  const hallExtrasSubtotal = hallExtrasBase;
  const externalExtrasSubtotal = externalExtrasBase;

  const mainVat = vatType === 'not_included' ? mainSubtotal * (effectiveVatRate / 100) : 0;
  const hallExtrasVat = vatType === 'not_included' ? hallExtrasSubtotal * (effectiveVatRate / 100) : 0;

  const basePrice = mainSubtotal + mainVat;
  const extrasPrice = hallExtrasSubtotal + hallExtrasVat;
  const externalExtrasPrice = externalExtrasSubtotal
    + (vatType === 'not_included' ? externalExtrasSubtotal * (effectiveVatRate / 100) : 0);

  return {
    basePrice,
    extrasPrice,
    externalExtrasPrice,
    liveAdditionsTotal,
    totalPrice: basePrice + extrasPrice + liveAdditionsTotal,
  };
}

export interface PriceValidationResult {
  valid: boolean;
  message?: string;
  serverBreakdown: HallPriceBreakdown;
}

/**
 * משווה סכומים מהלקוח מול חישוב השרת.
 * דוחה בקשה אם הסטייה ב-totalPrice עולה על PRICE_TOLERANCE_ILS.
 */
export function validateClientPricing(
  data: ServerPricingInput,
  systemSettings: Record<string, unknown> | null | undefined,
  liveAdditionsTotal = 0,
): PriceValidationResult {
  const serverBreakdown = computeServerPriceBreakdown(data, systemSettings, liveAdditionsTotal);
  const clientTotals = data.calculatedTotals;

  // אם הלקוח לא שלח calculatedTotals — אין מה להשוות; השרת משתמש בחישוב שלו
  if (!clientTotals || clientTotals.baseTotal === undefined) {
    return { valid: true, serverBreakdown };
  }

  const clientBreakdown = extractHallPriceBreakdown(data, liveAdditionsTotal);
  const diff = Math.abs(clientBreakdown.totalPrice - serverBreakdown.totalPrice);

  if (diff > PRICE_TOLERANCE_ILS) {
    return {
      valid: false,
      message: `סכום ההזמנה (₪${clientBreakdown.totalPrice.toLocaleString('he-IL')}) אינו תואם לחישוב המערכת (₪${serverBreakdown.totalPrice.toLocaleString('he-IL')}).`,
      serverBreakdown,
    };
  }

  return { valid: true, serverBreakdown };
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
