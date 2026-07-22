/**
 * Strict allow-list for floor_staff check-in responses — fail-closed PII / pricing strip.
 */

export type FloorStaffSafePortions = {
  ordered: number | null;
  entertainer: number | null;
  reserve: number | null;
};

export type FloorStaffSafeData = {
  id: string;
  eventCode: string;
  eventType: string;
  guestCount: number;
  familiesLabel: string | null;
  portions: FloorStaffSafePortions;
  tables: unknown;
};

const EMPTY: FloorStaffSafeData = {
  id: '',
  eventCode: '',
  eventType: '',
  guestCount: 0,
  familiesLabel: null,
  portions: { ordered: null, entertainer: null, reserve: null },
  tables: null,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : null;
}

/**
 * Returns ONLY allow-listed fields for floor_staff.
 * Never spreads the source object — new fields cannot leak accidentally.
 */
export function sanitizeFloorStaffData(
  booking: unknown,
  checkIn?: unknown,
): FloorStaffSafeData {
  const b = asRecord(booking);
  const c = asRecord(checkIn);

  if (!b) return { ...EMPTY, portions: { ...EMPTY.portions } };

  return {
    id: asString(b.id),
    eventCode: asString(b.eventCode),
    eventType: asString(b.eventType),
    guestCount: asNumber(b.guestCount, 0),
    familiesLabel: asNullableString(c?.familiesLabel ?? b.familiesLabel),
    portions: {
      ordered: asNullableNumber(c?.orderedPortions),
      entertainer: asNullableNumber(c?.entertainerPortions),
      reserve: asNullableNumber(c?.reservePortions),
    },
    tables: c?.reserveTables ?? null,
  };
}
