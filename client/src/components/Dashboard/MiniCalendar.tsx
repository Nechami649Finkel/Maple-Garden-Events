import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import styles from './MiniCalendar.module.css';
import { type CalendarDayApi } from '../../utils/optionDateApi';

const HEBREW_DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

interface MiniCalendarProps {
  days: CalendarDayApi[];
}

export function MiniCalendar({ days }: MiniCalendarProps) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

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

  return (
    <div className={styles.wrap}>
      <p className={styles.monthLabel}>
        {HEBREW_MONTHS[month]} {year}
      </p>
      <div className={styles.grid} role="grid" aria-label={`לוח שנה ${HEBREW_MONTHS[month]} ${year}`}>
        {HEBREW_DAYS.map((d) => (
          <div key={d} className={styles.dayHeader} role="columnheader">
            {d}
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

          return (
            <Link
              key={dateStr}
              to="/calendar"
              className={`${styles.cell} ${isToday ? styles.today : ''} ${bookingCount > 0 ? styles.hasBookings : ''}`}
              aria-label={`${day} ${HEBREW_MONTHS[month]}, ${bookingCount} אירועים`}
            >
              <span className={styles.dayNum}>{day}</span>
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
