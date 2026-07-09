import {
  type TimeSlot,
  SLOT_LABELS,
  getTakenSlots,
  getBlockedSlotsForDate,
  getBookableSlotsForDate,
  normalizeTimeSlot,
} from './timeSlot';

type OptionDayBooking = {
  timeOfDay?: string | null;
  isOption?: boolean;
};

function formatDateLocal(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function validateSlotOnDate(dateStr: string, slot: TimeSlot): string | null {
  const blocked = getBlockedSlotsForDate(dateStr);
  if (blocked.includes(slot)) {
    const jsDay = new Date(`${dateStr}T12:00:00`).getDay();
    if (jsDay === 5) {
      return 'ביום שישי ניתן לשמור אופציה בבוקר בלבד.';
    }
    if (jsDay === 6) {
      return 'לא ניתן לשמור אופציה בשבת.';
    }
    return `משבצת ${SLOT_LABELS[slot]} אינה זמינה בתאריך זה.`;
  }
  return null;
}

function slotConflictMessage(slot: TimeSlot, bookings: OptionDayBooking[]): string {
  const optionHeld = bookings.some(
    (b) => b.isOption && normalizeTimeSlot(b.timeOfDay) === slot,
  );
  if (optionHeld) {
    return `משבצת ${SLOT_LABELS[slot]} תפוסה על ידי אופציה. לחצי "סגירת אירוע במקום האופציה" בלוח השנה.`;
  }
  return `משבצת ${SLOT_LABELS[slot]} תפוסה בתאריך זה (אירוע מאושר).`;
}

export function validateOptionDateSelection(
  dateStr: string,
  dayData: { status?: string; bookings?: OptionDayBooking[]; reason?: string | null } | undefined,
  slot: TimeSlot,
  excludeDates: string[] = [],
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

  if (dayData) {
    const bookings = dayData.bookings ?? [];
    const bookable = getBookableSlotsForDate(dateStr, bookings);
    if (bookable.length === 0) {
      return 'התאריך מלא — אין משבצות זמן פנויות.';
    }
    if (!bookable.includes(slot)) {
      const taken = getTakenSlots(bookings);
      if (taken.has(slot)) {
        return slotConflictMessage(slot, bookings);
      }
      return `משבצת ${SLOT_LABELS[slot]} אינה זמינה בתאריך זה.`;
    }
  }

  return null;
}
