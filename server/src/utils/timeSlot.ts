export type TimeSlot = 'morning' | 'noon' | 'evening';

export const TIME_SLOTS: TimeSlot[] = ['morning', 'noon', 'evening'];

export const SLOT_LABELS: Record<TimeSlot, string> = {
  morning: 'בוקר',
  noon: 'צהריים',
  evening: 'ערב',
};

/** שעות ברירת מחדל לכל משבצת: בוקר 08:00–12:00, צהריים 12:00–18:00, ערב 18:00–00:00 */
export const SLOT_HOURS: Record<TimeSlot, { start: string; end: string }> = {
  morning: { start: '08:00', end: '12:00' },
  noon: { start: '12:00', end: '18:00' },
  evening: { start: '18:00', end: '00:00' },
};

export function getSlotHours(slot: TimeSlot): { start: string; end: string } {
  return SLOT_HOURS[slot];
}

const SLOT_ALIASES: Record<string, TimeSlot> = {
  morning: 'morning',
  noon: 'noon',
  evening: 'evening',
  בוקר: 'morning',
  צהריים: 'noon',
  ערב: 'evening',
};

/** מזהה משבצת זמן מתוך ערך שמור ב-DB */
export function normalizeTimeSlot(
  timeOfDay?: string | null,
  startTime?: string | null,
  endTime?: string | null
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

/** משבצות שלא ניתן לקבוע בהן אירוע בתאריך (למשל שבת: בוקר וצהריים). */
export function getBlockedSlotsForDate(date: Date): TimeSlot[] {
  if (date.getDay() === 6) return ['morning', 'noon'];
  return [];
}

export function parseDateLocal(dateInput: string | Date): Date {
  if (dateInput instanceof Date) {
    return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate(), 12, 0, 0);
  }
  return new Date(`${dateInput}T12:00:00`);
}

export function getBookableSlotsForDate(date: Date, bookings: { timeOfDay?: string | null }[]): TimeSlot[] {
  const taken = getTakenSlots(bookings);
  const blocked = new Set(getBlockedSlotsForDate(date));
  return TIME_SLOTS.filter((s) => !taken.has(s) && !blocked.has(s));
}

export function isDateFullyBooked(date: Date, bookings: { timeOfDay?: string | null }[]): boolean {
  return getBookableSlotsForDate(date, bookings).length === 0;
}

export function validateSlotOnDate(date: Date, slot: TimeSlot): string | null {
  const blocked = getBlockedSlotsForDate(date);
  if (blocked.includes(slot)) {
    if (date.getDay() === 6) {
      return 'ביום זה ניתן לקבוע אירוע בערב בלבד.';
    }
    return `משבצת ${SLOT_LABELS[slot]} אינה זמינה בתאריך זה.`;
  }
  return null;
}

export function formatStoredTimeOfDay(slot: TimeSlot, startTime?: string, endTime?: string): string {
  const defaults = getSlotHours(slot);
  const start = startTime?.trim() || defaults.start;
  const end = endTime?.trim() || defaults.end;
  return `${slot}|${start} - ${end}`;
}
