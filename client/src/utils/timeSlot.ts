import { T, type TranslationKey, type TranslationParams } from '@shared/i18n';
import { TIME_SLOT_KEYS, type BookingTimeSlot } from '@shared/i18n/bookingLookups';

export type TimeSlot = BookingTimeSlot;

export const TIME_SLOTS: TimeSlot[] = ['morning', 'noon', 'evening'];

export const DEFAULT_TIME_SLOT: TimeSlot = 'evening';

export const SLOT_DISPLAY_ORDER: TimeSlot[] = ['evening', 'morning', 'noon'];

export const SLOT_COLORS: Record<TimeSlot, string> = {
  morning: '#22C55E',
  noon: '#8B5CF6',
  evening: '#F97316',
};

export const SLOT_HOURS: Record<TimeSlot, { start: string; end: string }> = {
  morning: { start: '08:00', end: '12:00' },
  noon: { start: '12:00', end: '18:00' },
  evening: { start: '18:00', end: '00:00' },
};

export function getSlotHours(slot: TimeSlot): { start: string; end: string } {
  return SLOT_HOURS[slot];
}

export function getDefaultTimeSlot(available: TimeSlot[]): TimeSlot | '' {
  if (available.length === 0) return '';
  if (available.includes(DEFAULT_TIME_SLOT)) return DEFAULT_TIME_SLOT;
  for (const slot of SLOT_DISPLAY_ORDER) {
    if (available.includes(slot)) return slot;
  }
  return available[0];
}

export function sortSlotsForDisplay(slots: TimeSlot[]): TimeSlot[] {
  return [...slots].sort(
    (a, b) => SLOT_DISPLAY_ORDER.indexOf(a) - SLOT_DISPLAY_ORDER.indexOf(b),
  );
}

export function getSlotColor(timeOfDay?: string | null): string {
  const slot = normalizeTimeSlot(timeOfDay);
  return slot ? SLOT_COLORS[slot] : '#64748B';
}

const SLOT_ALIASES: Record<string, TimeSlot> = {
  morning: 'morning',
  noon: 'noon',
  evening: 'evening',
  בוקר: 'morning',
  צהריים: 'noon',
  ערב: 'evening',
};

export function normalizeTimeSlot(
  timeOfDay?: string | null,
  startTime?: string | null,
): TimeSlot | null {
  const raw = (timeOfDay || '').trim();
  if (!raw && !startTime) return null;

  const slotPart = raw.includes('|') ? raw.split('|')[0]?.trim() : raw;
  const lower = slotPart.toLowerCase();
  if (SLOT_ALIASES[lower]) return SLOT_ALIASES[lower];
  if (SLOT_ALIASES[slotPart]) return SLOT_ALIASES[slotPart];

  const timePart = raw.includes('|') ? raw.split('|')[1]?.trim() : raw;
  const hourSource = startTime || timePart?.split(' - ')[0]?.trim();
  if (hourSource) {
    const hour = parseInt(hourSource.split(':')[0], 10);
    if (!isNaN(hour)) {
      if (hour >= 8 && hour < 12) return 'morning';
      if (hour >= 12 && hour < 18) return 'noon';
      return 'evening';
    }
  }

  return null;
}

export function getTakenSlots(bookings: { timeOfDay?: string | null }[]): Set<TimeSlot> {
  const taken = new Set<TimeSlot>();
  for (const b of bookings) {
    const slot = normalizeTimeSlot(b.timeOfDay);
    if (slot) taken.add(slot);
  }
  return taken;
}

export function getAvailableSlots(bookings: { timeOfDay?: string | null }[]): TimeSlot[] {
  const taken = getTakenSlots(bookings);
  return TIME_SLOTS.filter((s) => !taken.has(s));
}

export function getBlockedSlotsForDate(dateStr: string): TimeSlot[] {
  const d = new Date(`${dateStr}T12:00:00`);
  if (d.getDay() === 5) return ['noon', 'evening'];
  if (d.getDay() === 6) return ['morning', 'noon'];
  return [];
}

export function getBookableSlotsForDate(
  dateStr: string,
  bookings: { timeOfDay?: string | null }[],
): TimeSlot[] {
  const taken = getTakenSlots(bookings);
  const blocked = new Set(getBlockedSlotsForDate(dateStr));
  return TIME_SLOTS.filter((s) => !taken.has(s) && !blocked.has(s));
}

export function canAddMoreEventsForDate(
  dateStr: string,
  bookings: { timeOfDay?: string | null }[],
): boolean {
  return getBookableSlotsForDate(dateStr, bookings).length > 0;
}

export function formatSlotLabel(
  translate: (key: TranslationKey, params?: TranslationParams) => string,
  slot: TimeSlot,
): string {
  return translate(TIME_SLOT_KEYS[slot]);
}

export function formatAvailableSlotsLabelForDate(
  translate: (key: TranslationKey, params?: TranslationParams) => string,
  dateStr: string,
  bookings: { timeOfDay?: string | null }[],
): string {
  return getBookableSlotsForDate(dateStr, bookings)
    .map((s) => translate(T.TIME.SLOT_AVAILABLE, { slot: formatSlotLabel(translate, s) }))
    .join(' · ');
}

export function hasOptionOnDay(day: {
  status?: string;
  bookings?: { isOption?: boolean }[];
}): boolean {
  if (day.status === 'OPTION') return true;
  return (day.bookings ?? []).some((b) => b.isOption === true);
}

export function canAddMoreEvents(bookings: { timeOfDay?: string | null }[]): boolean {
  return bookings.length < 3 && getAvailableSlots(bookings).length > 0;
}

export function formatAvailableSlotsLabel(
  translate: (key: TranslationKey, params?: TranslationParams) => string,
  bookings: { timeOfDay?: string | null }[],
): string {
  return getAvailableSlots(bookings)
    .map((s) => translate(T.TIME.SLOT_AVAILABLE, { slot: formatSlotLabel(translate, s) }))
    .join(' · ');
}

export function formatTimeOfDayDisplay(
  translate: (key: TranslationKey, params?: TranslationParams) => string,
  value: string | null | undefined,
): string {
  if (!value) return translate(T.TIME.NOT_SPECIFIED);
  const slot = normalizeTimeSlot(value);
  if (slot) {
    const hours = getSlotHours(slot);
    const extra = value.includes('|') ? value.split('|')[1]?.trim() : value.includes(' - ') ? value : '';
    const label = formatSlotLabel(translate, slot);
    if (extra && extra !== slot && extra.includes(' - ')) return `${label} (${extra})`;
    return `${label} (${hours.start} - ${hours.end})`;
  }
  return value;
}
