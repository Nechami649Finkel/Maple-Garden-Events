import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './MiniCalendar.module.css';
import { type CalendarDayApi, getHebrewDateLabel } from '../../utils/optionDateApi';

interface MiniCalendarProps {
  days: CalendarDayApi[];
}

export function MiniCalendar({ days }: MiniCalendarProps) {
  const { t, T } = useTranslation();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const monthKeys = useMemo(
    () => [
      T.BOOKING.OPTION_DATES.MONTH_JAN,
      T.BOOKING.OPTION_DATES.MONTH_FEB,
      T.BOOKING.OPTION_DATES.MONTH_MAR,
      T.BOOKING.OPTION_DATES.MONTH_APR,
      T.BOOKING.OPTION_DATES.MONTH_MAY,
      T.BOOKING.OPTION_DATES.MONTH_JUN,
      T.BOOKING.OPTION_DATES.MONTH_JUL,
      T.BOOKING.OPTION_DATES.MONTH_AUG,
      T.BOOKING.OPTION_DATES.MONTH_SEP,
      T.BOOKING.OPTION_DATES.MONTH_OCT,
      T.BOOKING.OPTION_DATES.MONTH_NOV,
      T.BOOKING.OPTION_DATES.MONTH_DEC,
    ],
    [T],
  );

  const weekdayKeys = useMemo(
    () => [
      T.BOOKING.OPTION_DATES.WEEKDAY_SUN,
      T.BOOKING.OPTION_DATES.WEEKDAY_MON,
      T.BOOKING.OPTION_DATES.WEEKDAY_TUE,
      T.BOOKING.OPTION_DATES.WEEKDAY_WED,
      T.BOOKING.OPTION_DATES.WEEKDAY_THU,
      T.BOOKING.OPTION_DATES.WEEKDAY_FRI,
      T.BOOKING.OPTION_DATES.WEEKDAY_SAT,
    ],
    [T],
  );

  const dayMap = useMemo(() => {
    const map = new Map<string, CalendarDayApi>();
    for (const d of days) {
      if (d.date) map.set(d.date.slice(0, 10), d);
    }
    return map;
  }, [days]);

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay.getDay();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayStr = now.toISOString().slice(0, 10);
  const monthLabel = t(monthKeys[month]);

  return (
    <div className={styles.wrap}>
      <p className={styles.monthLabel}>
        {monthLabel} {year}
      </p>
      <div
        className={styles.grid}
        role="grid"
        aria-label={t(T.DASHBOARD.CALENDAR_MONTH_ARIA, { month: monthLabel, year })}
      >
        {weekdayKeys.map((key) => (
          <div key={key} className={styles.dayHeader} role="columnheader">
            {t(key)}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className={styles.emptyCell} />;
          }
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayData = dayMap.get(dateStr);
          const bookingCount = dayData?.bookings?.filter((b) => !b.isOption)?.length ?? 0;
          const isToday = dateStr === todayStr;
          const hebrewDate = dayData?.hebrewDate?.trim() || getHebrewDateLabel(dateStr);

          return (
            <Link
              key={dateStr}
              to="/calendar"
              className={`${styles.cell} ${isToday ? styles.today : ''} ${bookingCount > 0 ? styles.hasBookings : ''}`}
              aria-label={t(T.DASHBOARD.CALENDAR_DAY_ARIA, {
                day,
                month: monthLabel,
                count: bookingCount,
              })}
            >
              <span className={styles.cellHeader}>
                <span className={styles.dayNum}>{day}</span>
                {hebrewDate ? (
                  <span className={styles.hebrewDate} title={hebrewDate}>
                    {hebrewDate}
                  </span>
                ) : null}
              </span>
              {bookingCount > 0 && (
                <span className={styles.dot} aria-hidden="true" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
