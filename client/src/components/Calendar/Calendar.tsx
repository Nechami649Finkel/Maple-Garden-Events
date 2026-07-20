import { useEffect, useState } from 'react';
import { useCalendarDatesQuery } from '../../hooks/queries';
import { useNavigate } from 'react-router-dom';
import './Calendar.css';
import { EventPopup } from '../EventPopup/EventPopup';
import {
  getSlotColor,
  getTakenSlots,
  getBookableSlotsForDate,
  hasOptionOnDay,
  normalizeTimeSlot,
  type TimeSlot,
} from '../../utils/timeSlot';
import { CalendarLegendBar } from './CalendarLegendBar';
import { CalendarDaySidePanel } from './CalendarDaySidePanel';
import { OptionFormModal } from './OptionFormModal';
import { isEventLive } from '../../utils/eventStart';
import { useTranslation } from '../../i18n/useTranslation';
import { DEFAULT_EVENT_TYPE, translateByValue, EVENT_TYPE_KEY_BY_VALUE } from '@shared/i18n/bookingLookups';
import liveStyles from '../LiveEvent/LiveEvent.module.css';
interface DayData {
  id: string | null;
  date: string;
  dayOfWeek: number;
  hebrewDate: string;
  status: string;
  reason: string | null;
  candleTime: string | null;
  lockedBy: string | null;
  bookings: any[];
  blockedSlots?: string[];
  isCurrentMonth: boolean;
}

interface CalendarProps {
  onDateSelect: (day: DayData) => void;
}

const DOW_TO_COL: Record<number, number> = { 0:7, 1:6, 2:5, 3:4, 4:3, 5:2, 6:1 };
const COL_HEADER_INDEX_KEYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** DOM order top→bottom so flex-end stacks: evening on top, morning at bottom */
const CALENDAR_SLOT_STACK_ORDER: TimeSlot[] = ['evening', 'noon', 'morning'];

function sortBookingsForCalendarCell(bookings: any[]) {
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

  const getEventTitle = (booking: any) => {
  // 1. מנקים רווחים נסתרים מסוג האירוע כדי שהקוד יזהה אותו בוודאות
  const type = (booking.eventType || '').trim(); 

  // 2. פונקציית עזר בטוחה לחילוץ שם משפחה
  const getLastName = (fullName: string) => {
    if (!fullName) return '';
    return fullName.trim().split(' ').pop() || '';
  };

  const nameA = getLastName(booking.clientAFullName);
  const nameB = getLastName(booking.clientBFullName);

  // 3. חיבור חכם של השמות - רק אם יש באמת שני צדדים שונים
  let namesDisplay = '';
  if (nameA && nameB && nameA !== nameB) {
    namesDisplay = `${nameA}-${nameB}`;
  } else {
    // אם הוזן רק צד אחד במערכת, נציג רק אותו
    namesDisplay = nameA || nameB; 
  }

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
  const [sidePanelDay, setSidePanelDay] = useState<DayData | null>(null);
  const [eventPopupDay, setEventPopupDay] = useState<DayData | null>(null);
  const [optionModalDay, setOptionModalDay] = useState<DayData | null>(null);
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
    const serverMap = new Map<string, any>(datesList.map((d: any) => [d.date, d]));
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

  const handleBookEventFromPanel = () => {
    if (!sidePanelDay) return;
    const dayToBook = sidePanelDay;
    setSidePanelDay(null);
    onDateSelect(dayToBook);
  };

  const handleOpenOptionFromPanel = () => {
    if (!sidePanelDay) return;
    setOptionModalDay(sidePanelDay);
  };

  const openDayPanel = (day: DayData) => {
    setSidePanelDay(day);
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
      
      <div className="calendar-top-card">
        <div className="calendar-control-bar">
          <div className="calendar-availability-group">
            <span className="calendar-toolbar-label">{t(T.CALENDAR.AVAILABILITY_LABEL)}</span>
            <select
              className="calendar-toolbar-select"
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
            >
              <option value="חתונה">{t(T.CALENDAR.FILTER_WEDDING)}</option>
              <option value="אירוע אחר">{t(T.CALENDAR.FILTER_OTHER)}</option>
            </select>
          </div>

          <div className="calendar-inline-nav">
            <div className="inline-date-nav">
              <button
                type="button"
                className="inline-nav-btn"
                onClick={prevMonth}
                aria-label={t(T.CALENDAR.PREV_MONTH)}
              >
                ‹
              </button>
              <span className="inline-date-label">
                {t(T.CALENDAR.MONTHS[month as keyof typeof T.CALENDAR.MONTHS])}
              </span>
              <button
                type="button"
                className="inline-nav-btn"
                onClick={nextMonth}
                aria-label={t(T.CALENDAR.NEXT_MONTH)}
              >
                ›
              </button>
              <button
                type="button"
                className="inline-nav-btn"
                onClick={prevYear}
                aria-label={t(T.CALENDAR.PREV_YEAR)}
              >
                ‹
              </button>
              <span className="inline-date-label">{year}</span>
              <button
                type="button"
                className="inline-nav-btn"
                onClick={nextYear}
                aria-label={t(T.CALENDAR.NEXT_YEAR)}
              >
                ›
              </button>
            </div>
          </div>

          <CalendarLegendBar showWeddingRestrictions={eventTypeFilter === DEFAULT_EVENT_TYPE} />
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
              const isWeddingFilter = eventTypeFilter === DEFAULT_EVENT_TYPE;
              const hasRestrictionMarker =
                isWeddingFilter
                && day.isCurrentMonth
                && (day.status === 'FORBIDDEN' || day.status === 'PROBLEMATIC');
              const cls = [
                'calendar-cell',
                `status-${day.status.toLowerCase()}`,
                hasRestrictionMarker ? 'has-restriction-marker' : '',
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
                  if (isPast && bookingCount === 0) return;
                  openDayPanel(day);
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
                    {sortBookingsForCalendarCell(day.bookings).map((b: any, idx: number) => {
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
                            openDayPanel(day);
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
      {sidePanelDay && (
        <CalendarDaySidePanel
          day={sidePanelDay}
          onClose={() => setSidePanelDay(null)}
          onBookEvent={handleBookEventFromPanel}
          onOpenOption={handleOpenOptionFromPanel}
          onViewEvents={
            (sidePanelDay.bookings?.length ?? 0) > 0
              ? () => {
                  setEventPopupDay(sidePanelDay);
                  setSidePanelDay(null);
                }
              : undefined
          }
        />
      )}

      {eventPopupDay && (
        <EventPopup
          day={eventPopupDay}
          onClose={() => setEventPopupDay(null)}
          onAddEvent={() => {
            const dayToBook = eventPopupDay;
            setEventPopupDay(null);
            onDateSelect(dayToBook);
          }}
          onAddOption={() => {
            setOptionModalDay(eventPopupDay);
            setEventPopupDay(null);
          }}
          onOverrideOptionBook={
            hasOptionOnDay(eventPopupDay)
              ? () => handleOverrideOptionBook(eventPopupDay)
              : undefined
          }
        />
      )}

      {optionModalDay && (
        <OptionFormModal
          date={optionModalDay.date}
          hebrewDate={optionModalDay.hebrewDate || ''}
          onClose={() => setOptionModalDay(null)}
        />
      )}
      </div>
    </div>
  );
};