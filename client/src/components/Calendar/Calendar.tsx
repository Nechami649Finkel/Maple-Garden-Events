import { useEffect, useState } from 'react';
import { useCalendarDatesQuery } from '../../hooks/queries';
import { useNavigate } from 'react-router-dom';
import './Calendar.css';
import { EventPopup } from '../EventPopup/EventPopup';
import {
  getSlotColor,
  SLOT_COLORS,
  TIME_SLOTS,
  getTakenSlots,
  getBookableSlotsForDate,
  hasOptionOnDay,
  normalizeTimeSlot,
  formatSlotLabel,
  type TimeSlot,
} from '../../utils/timeSlot';
import { isEventLive } from '../../utils/eventStart';
import { type CalendarBookingApi, type CalendarDayApi } from '../../utils/optionDateApi';
import { useTranslation } from '../../i18n/useTranslation';
import { DEFAULT_EVENT_TYPE, translateByValue, EVENT_TYPE_KEY_BY_VALUE } from '@shared/i18n/bookingLookups';
import liveStyles from '../LiveEvent/LiveEvent.module.css';

type DayData = CalendarDayApi & {
  dayOfWeek: number;
  isCurrentMonth: boolean;
  status: string;
  bookings: CalendarBookingApi[];
};

interface CalendarProps {
  onDateSelect: (day: DayData) => void;
}

const DOW_TO_COL: Record<number, number> = { 0:7, 1:6, 2:5, 3:4, 4:3, 5:2, 6:1 };
const COL_HEADER_INDEX_KEYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** DOM order top→bottom so flex-end stacks: evening on top, morning at bottom */
const CALENDAR_SLOT_STACK_ORDER: TimeSlot[] = ['evening', 'noon', 'morning'];

function sortBookingsForCalendarCell(bookings: CalendarBookingApi[]) {
  return [...bookings].sort((a, b) => {
    const slotA = normalizeTimeSlot(a.timeOfDay) ?? 'morning';
    const slotB = normalizeTimeSlot(b.timeOfDay) ?? 'morning';
    return CALENDAR_SLOT_STACK_ORDER.indexOf(slotA) - CALENDAR_SLOT_STACK_ORDER.indexOf(slotB);
  });
}

const formatDateLocal = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const Calendar = ({ onDateSelect }: CalendarProps) => {
  const { t, T } = useTranslation();
  const navigate = useNavigate();

  const getEventTitle = (booking: CalendarBookingApi) => {
  // 1. מנקים רווחים נסתרים מסוג האירוע כדי שהקוד יזהה אותו בוודאות
  const type = (booking.eventType || '').trim(); 

  // 2. פונקציית עזר בטוחה לחילוץ שם משפחה
  const getLastName = (fullName: string) => {
    if (!fullName) return '';
    return fullName.trim().split(' ').pop() || '';
  };

  const nameA = getLastName(booking.clientAFullName ?? '');
  const nameB = getLastName(booking.clientBFullName ?? '');

  // 3. חיבור חכם של השמות - רק אם יש באמת שני צדדים שונים
  const namesDisplay =
    nameA && nameB && nameA !== nameB
      ? `${nameA}-${nameB}`
      : nameA || nameB;

  // 4. תצוגה סופית על הלוח (בלי מקף מיותר בחתונות)
  if (type === 'חתונה' || type === 'אירוסין') {
    return `${translateByValue(t, EVENT_TYPE_KEY_BY_VALUE, type)} ${namesDisplay}`;
  }

  return t(T.CALENDAR.EVENT_LABEL_FAMILY, {
    type: translateByValue(t, EVENT_TYPE_KEY_BY_VALUE, type),
    namesDisplay,
  });
  };

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<(DayData & { col?: number; row?: number }) | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [selectedDateForAction, setSelectedDateForAction] = useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState(DEFAULT_EVENT_TYPE);
  const [, setLiveTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setLiveTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay  = new Date(year, month, 1);
  const startDate = new Date(year, month, 1 - firstDay.getDay());
  const lastDay = new Date(year, month + 1, 0);
  const endDate = new Date(year, month + 1, 0 + (6 - lastDay.getDay()));

  const startStr = formatDateLocal(startDate);
  const endStr   = formatDateLocal(endDate);

  const todayStr = formatDateLocal(new Date());

  const { data: datesData = [], isLoading: loading, isError } = useCalendarDatesQuery(startStr, endStr, eventTypeFilter);
  const datesList = Array.isArray(datesData) ? datesData : [];

  const buildGrid = () => {
    const serverMap = new Map<string, CalendarDayApi>(datesList.map((d) => [d.date, d]));
    const days: (DayData & { col: number; row: number })[] = [];
    const loop = new Date(startDate);
    let row = 1;
    while (loop <= endDate) {
      const key = formatDateLocal(loop);
      const srv = serverMap.get(key);
      const dow = loop.getDay();
      days.push({
        id: srv?.id ?? null, 
        date: key, 
        dayOfWeek: dow, 
        hebrewDate: srv?.hebrewDate ?? '',
        status: srv?.status ?? 'AVAILABLE',
        reason: srv?.reason ?? null, 
        candleTime: srv?.candleTime ?? null,
        lockedBy: srv?.lockedBy ?? null, 
        bookings: srv?.bookings ?? [],
        blockedSlots: srv?.blockedSlots ?? [],
        isCurrentMonth: loop.getMonth() === month,
        col: DOW_TO_COL[dow], row,
      });
      if (dow === 6) row++;
      loop.setDate(loop.getDate() + 1);
    }
    return days;
  };

  const grid = buildGrid();
  const weekRowCount = grid.length > 0 ? Math.max(...grid.map((d) => d.row)) : 5;

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevYear  = () => setCurrentDate(new Date(year - 1, month, 1));
  const nextYear  = () => setCurrentDate(new Date(year + 1, month, 1));

  const handleBookEvent = () => {
    setIsActionModalOpen(false);
    const dayObj = grid.find(d => d.date === selectedDateForAction);
    if (dayObj) onDateSelect(dayObj);
  };

  const handleOverrideOptionBook = (day: DayData) => {
    if (!day.id) {
      alert(t(T.CALENDAR.RELEASE_OPTION_ERROR));
      return;
    }
    const optionBooking = day.bookings?.find((b: { isOption?: boolean }) => b.isOption) || day.bookings?.[0];
    const clientName = optionBooking?.clientAFullName || t(T.UI.CLIENT_FALLBACK);
    const isShabbat = new Date(`${day.date}T12:00:00`).getDay() === 6;
    const bookable = getBookableSlotsForDate(day.date, day.bookings || []);
    const shabbatNote = isShabbat && bookable.length === 0
      ? `\n\n${t(T.CALENDAR.SHABBAT_EVENING_NOTE)}`
      : '';
    const confirmed = window.confirm(
      t(T.CALENDAR.RELEASE_OPTION_CONFIRM, { clientName, shabbatNote }),
    );
    if (!confirmed) return;

    const optionSlots = Array.from(getTakenSlots(day.bookings || []));
    navigate('/booking', {
      state: {
        date: day.date,
        hebrewDate: day.hebrewDate,
        blockedSlots: (day.blockedSlots || []) as TimeSlot[],
        takenSlots: optionSlots,
        overrideOptionDateId: day.id,
        overrideOptionSlots: optionSlots,
        overrideOptionClientName: clientName,
      },
    });
  };

  return (
    <div className="calendar-page-layout">
      <div className="calendar-container">
      
      <div className="calendar-toolbar">
        <span className="calendar-toolbar-label">{t(T.CALENDAR.AVAILABILITY_LABEL)}</span>
        <select className="calendar-toolbar-select" value={eventTypeFilter} onChange={(e) => setEventTypeFilter(e.target.value)}>
          <option value="חתונה">{t(T.CALENDAR.FILTER_WEDDING)}</option>
          <option value="אירוע אחר">{t(T.CALENDAR.FILTER_OTHER)}</option>
        </select>
        <div className="calendar-legend">
          {TIME_SLOTS.map((slot) => (
            <span key={slot} className="calendar-legend-item">
              <span className="calendar-legend-swatch" style={{ backgroundColor: SLOT_COLORS[slot] }} />
              {formatSlotLabel(t, slot)}
            </span>
          ))}
        </div>
      </div>

      <div className="calendar-header-nav">
        <div className="year-nav" style={{ direction: 'rtl' }}>
          <button className="nav-btn year-btn" onClick={nextYear} aria-label={t(T.CALENDAR.NEXT_YEAR)}>»</button>
          <span className="year-display">{year}</span>
          <button className="nav-btn year-btn" onClick={prevYear} aria-label={t(T.CALENDAR.PREV_YEAR)}>«</button>
        </div>

        <div className="calendar-nav" style={{ direction: 'rtl' }}>
          <button className="nav-btn" onClick={nextMonth} aria-label={t(T.CALENDAR.NEXT_MONTH)}>›</button>
          <div className="months-bar">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
              <div key={i} className={`month-tab ${i === month ? 'active' : ''}`} onClick={() => setCurrentDate(new Date(year, i, 1))}>{t(T.CALENDAR.MONTHS[i as keyof typeof T.CALENDAR.MONTHS])}</div>
            ))}
          </div>
          <button className="nav-btn" onClick={prevMonth} aria-label={t(T.CALENDAR.PREV_MONTH)}>‹</button>
        </div>
      </div>

      {loading ? <div className="calendar-loading">{t(T.UI.LOADING_DATA)}</div> : isError ? (
        <div className="calendar-loading">{t(T.CALENDAR.LOAD_ERROR)}</div>
      ) : (
        <div className="calendar-grid-wrapper">
          <div className="calendar-weekdays-bar">
            {COL_HEADER_INDEX_KEYS.map((idx) => (
              <div key={idx} className="week-day-label">{t(T.CALENDAR.COL_HEADERS[idx])}</div>
            ))}
          </div>
          <div
            className="calendar-grid calendar-grid-uniform"
            style={{ ['--calendar-week-rows' as string]: weekRowCount } as React.CSSProperties}
          >
            {grid.map(day => {
              const isToday = day.date === todayStr;
              const isPast = day.date < todayStr;
              
              const dayNum = new Date(day.date + 'T12:00:00').getDate();

              const bookingCount = day.bookings?.length ?? 0;
              const cls = [
                'calendar-cell',
                `status-${day.status.toLowerCase()}`,
                !day.isCurrentMonth ? 'out-of-month' : '',
                isToday ? 'is-today' : '',
                isPast && day.isCurrentMonth ? 'is-past' : '',
                isPast && day.isCurrentMonth && bookingCount > 0 ? 'is-past-has-events' : '',
              ].filter(Boolean).join(' ');
              const isHardBlocked = day.status === 'BLOCKED' && bookingCount === 0;
              const canViewPastEvents = isPast && bookingCount > 0;
              const isCellDisabled =
                !day.isCurrentMonth || day.status === 'FORBIDDEN' || isHardBlocked || (isPast && !canViewPastEvents);
              const ariaLabel = day.isCurrentMonth
                ? t(T.CALENDAR.CELL_ARIA, {
                    day: dayNum,
                    hebrewDate: day.hebrewDate || '',
                    count: bookingCount,
                    reason: day.reason || '',
                    viewHint: canViewPastEvents ? t(T.CALENDAR.VIEW_CHECK_IN) : '',
                  })
                : String(dayNum);

              return (
                <button
                  type="button"
                  key={day.date}
                  className={cls}
                  style={{ gridColumn: day.col, gridRow: day.row }}
                  aria-label={ariaLabel}
                  disabled={isCellDisabled}
                  onClick={() => {
                  if (!day.isCurrentMonth || day.status === 'FORBIDDEN' || isHardBlocked) return;
                  if (isPast) {
                    if (bookingCount > 0) setSelectedDay(day);
                    return;
                  }

                  if (day.bookings.length > 0) { setSelectedDay(day); return; }
                  setSelectedDateForAction(day.date); setIsActionModalOpen(true);
                }}>
                  <div className="cell-header-row">
                      <span className="gregorian-num">
                        {dayNum}
                        {isToday && <span className="today-badge">{t(T.CALENDAR.TODAY)}</span>}
                      </span>
                      {day.isCurrentMonth && day.candleTime && <span className="candle-time">{day.candleTime}</span>}
                      <span className="hebrew-text">{day.isCurrentMonth ? day.hebrewDate : ''}</span>
                  </div>
                  
                  <div className="cell-status-text">{day.isCurrentMonth ? (day.reason || '') : ''}</div>
                  <div className="cell-events-container">
                    {sortBookingsForCalendarCell(day.bookings ?? []).map((b, idx: number) => {
                      const baseColor = getSlotColor(b.timeOfDay);
                      const isOptionBooking = b.isOption === true;
                      const isLive =
                        !isOptionBooking
                        && day.status === 'BOOKED'
                        && isEventLive(day.date, b, b.eventForm);
                      
                      // העיצוב המתוקן שיוצר קונטרסט ברור:
                      const eventStyle = isOptionBooking
                        ? { 
                            backgroundColor: `${baseColor}18`,
                            border: `1.5px dashed ${baseColor}`,
                            color: baseColor,
                            fontWeight: '700'
                          }
                        : { 
                            backgroundColor: baseColor,
                            border: `1.5px solid ${baseColor}`,
                            color: '#FFFFFF',
                            fontWeight: '700',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
                          };

                      return (
                        <div 
                          key={idx} 
                          className="small-event-pill"
                          style={eventStyle}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDay(day);
                          }}
                        >
                          {isLive && <span className={liveStyles.liveBadge}>{t(T.CALENDAR.LIVE_BADGE)}</span>}
                          {getEventTitle(b)}
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {selectedDay && (
        <EventPopup
          day={selectedDay}
          onClose={() => setSelectedDay(null)}
          onAddEvent={() => {
            const dayToBook = selectedDay;
            setSelectedDay(null);
            onDateSelect(dayToBook);
          }}
          onAddOption={() => {
            const dayToOption = selectedDay;
            setSelectedDay(null);
            navigate('/option', {
              state: {
                selectedDates: [{ date: dayToOption.date, hebrewDate: dayToOption.hebrewDate || '' }],
                takenSlots: Array.from(getTakenSlots(dayToOption.bookings || [])),
                blockedSlots: (dayToOption.blockedSlots || []) as TimeSlot[],
              },
            });
          }}
          onOverrideOptionBook={
            hasOptionOnDay(selectedDay)
              ? () => handleOverrideOptionBook(selectedDay)
              : undefined
          }
        />
      )}

      {isActionModalOpen && (
        <div className="side-panel-overlay" onClick={() => setIsActionModalOpen(false)}>
          <div className="side-panel" onClick={e => e.stopPropagation()}>
            <div className="side-panel-header">
              <span>{t(T.CALENDAR.SELECTED_DATE, { date: selectedDateForAction?.split('-').reverse().join('-') ?? '' })}</span>
              <button className="side-panel-close" onClick={() => setIsActionModalOpen(false)}>✕</button>
            </div>
            <div className="side-panel-body">
              <button className="book-btn" onClick={handleBookEvent}>{t(T.CALENDAR.BOOK_EVENT)}</button>
              <button
                className="option-btn"
                onClick={() => {
                  if (!selectedDateForAction) return;
                  const dayData = datesList.find((d) => d.date === selectedDateForAction);
                  setIsActionModalOpen(false);
                  navigate('/option', {
                    state: {
                      selectedDates: [{
                        date: selectedDateForAction,
                        hebrewDate: dayData?.hebrewDate || '',
                      }],
                    },
                  });
                }}
              >
                {t(T.CALENDAR.OPEN_OPTION)}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};