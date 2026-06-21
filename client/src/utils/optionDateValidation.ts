import {
  type TimeSlot,
  DEFAULT_TIME_SLOT,
  SLOT_LABELS,
  getTakenSlots,
  getBlockedSlotsForDate,
} from './timeSlot';

function formatDateLocal(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function validateSlotOnDate(dateStr: string, slot: TimeSlot): string | null {
  const blocked = getBlockedSlotsForDate(dateStr);
  if (blocked.includes(slot)) {
    if (new Date(`${dateStr}T12:00:00`).getDay() === 6) {
      return 'לא ניתן לשמור אופציה בשבת.';
    }
    return `משבצת ${SLOT_LABELS[slot]} אינה זמינה בתאריך זה.`;
  }
  return null;
}

export function validateOptionDateSelection(
  dateStr: string,
  dayData: { status?: string; bookings?: { timeOfDay?: string | null }[]; reason?: string | null } | undefined,
  slot: TimeSlot = DEFAULT_TIME_SLOT,
  excludeDates: string[] = []
): string | null {
  const todayStr = formatDateLocal(new Date());
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return 'יש לבחור תאריך תקין.';
  }
  if (dateStr < todayStr) return 'לא ניתן לבחור תאריך בעבר.';
  if (excludeDates.includes(dateStr)) return 'התאריך כבר נבחר באופציה.';

  const jsDay = new Date(`${dateStr}T12:00:00`).getDay();
  if (jsDay === 6) return 'לא ניתן לשמור אופציה בשבת.';

  const status = dayData?.status ?? 'AVAILABLE';
  if (status === 'BLOCKED' || status === 'FORBIDDEN') {
    return dayData?.reason ? `תאריך אסור: ${dayData.reason}` : 'התאריך חסום בלוח.';
  }

  const slotError = validateSlotOnDate(dateStr, slot);
  if (slotError) return slotError;

  const bookings = dayData?.bookings ?? [];
  const taken = getTakenSlots(bookings);
  if (taken.has(slot)) {
    return `משבצת ${SLOT_LABELS[slot]} תפוסה בתאריך זה.`;
  }

  return null;
}
