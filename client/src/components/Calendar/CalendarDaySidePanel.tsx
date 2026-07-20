import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { formatDate } from '@shared/i18n/formatters';
import {
  canAddMoreEventsForDate,
  formatAvailableSlotsLabelForDate,
} from '../../utils/timeSlot';
import { todayCalendarKey } from '../../utils/dateLocal';
import styles from './CalendarDaySidePanel.module.css';

export interface CalendarSidePanelDay {
  date: string;
  hebrewDate?: string;
  status?: string;
  reason?: string | null;
  bookings?: any[];
}

interface CalendarDaySidePanelProps {
  day: CalendarSidePanelDay;
  onClose: () => void;
  onBookEvent: () => void;
  onOpenOption: () => void;
  onViewEvents?: () => void;
}

export function CalendarDaySidePanel({
  day,
  onClose,
  onBookEvent,
  onOpenOption,
  onViewEvents,
}: CalendarDaySidePanelProps) {
  const { t, tp, T, TP, locale } = useTranslation();
  const bookings = day.bookings ?? [];
  const bookingCount = bookings.length;
  const isPast = day.date < todayCalendarKey();
  const canAdd =
    !isPast
    && day.status !== 'FORBIDDEN'
    && canAddMoreEventsForDate(day.date, bookings);
  const availableSlotsLabel = formatAvailableSlotsLabelForDate(t, day.date, bookings);
  const dateDisplay = formatDate(day.date, locale);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t(T.CALENDAR.SELECTED_DATE, { date: dateDisplay })}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h2 className={styles.title}>{dateDisplay}</h2>
            {day.hebrewDate && <p className={styles.subtitle}>{day.hebrewDate}</p>}
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t(T.COMMON.ACTIONS.CLOSE)}
          >
            ✕
          </button>
        </header>

        <div className={styles.body}>
          {day.reason && (
            <p className={styles.reason}>{day.reason}</p>
          )}

          {bookingCount > 0 && (
            <div className={styles.summary}>
              <span className={styles.summaryLabel}>
                {tp(TP.PLURALS.BOOKING_COUNT, bookingCount)}
              </span>
              {onViewEvents && (
                <button type="button" className={styles.secondaryBtn} onClick={onViewEvents}>
                  {t(T.CALENDAR.EVENT_DETAILS_TITLE)}
                </button>
              )}
            </div>
          )}

          {canAdd && availableSlotsLabel && (
            <p className={styles.slots}>{availableSlotsLabel}</p>
          )}

          <div className={styles.actions}>
            {canAdd && (
              <>
                <button type="button" className={styles.primaryBtn} onClick={onBookEvent}>
                  {t(T.CALENDAR.BOOK_EVENT)}
                </button>
                <button type="button" className={styles.optionBtn} onClick={onOpenOption}>
                  {t(T.CALENDAR.OPEN_OPTION)}
                </button>
              </>
            )}

            {!canAdd && bookingCount === 0 && !isPast && (
              <p className={styles.emptyHint}>{t(T.CALENDAR.NO_EVENTS)}</p>
            )}

            {isPast && bookingCount === 0 && (
              <p className={styles.emptyHint}>{t(T.BOOKINGS.DATE_PASSED)}</p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
