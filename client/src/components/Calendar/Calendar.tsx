import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Calendar.css';
import { EventPopup } from '../EventPopup/EventPopup';

interface DayData {
  id: string | null;
  date: string;
  dayOfWeek: number;
  hebrewDate: string;
  status: string;
  reason: string | null;
  candleTime: string | null;
  lockedBy: string | null;
  booking: any | null;
  isCurrentMonth: boolean;
}

interface CalendarProps {
  onDateSelect: (day: DayData) => void;
}

const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

// גריד LTR: עמודה 1=שבת(שמאל), עמודה 7=ראשון(ימין)
const DOW_TO_COL: Record<number, number> = { 0:7, 1:6, 2:5, 3:4, 4:3, 5:2, 6:1 };
const COL_HEADERS = ['שבת','שישי','חמישי','רביעי','שלישי','שני','ראשון'];

// פונקציית העזר שמצילה אותנו מבאג חצות ומחזירה תאריך מקומי בפורמט YYYY-MM-DD
const formatDateLocal = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const Calendar = ({ onDateSelect }: CalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [datesData, setDatesData]     = useState<any[]>([]);
  const [loading, setLoading]         = useState(false);
  const [selectedDay, setSelectedDay]  = useState<any>(null);

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // startDate = תמיד ראשון (dow=0) שלפני תחילת החודש
  const firstDay  = new Date(year, month, 1);
  const startDate = new Date(year, month, 1 - firstDay.getDay());

  // endDate = תמיד שבת (dow=6) שאחרי סוף החודש
  const lastDay = new Date(year, month + 1, 0);
  const endDate = new Date(year, month + 1, 0 + (6 - lastDay.getDay()));

  const startStr = formatDateLocal(startDate);
  const endStr   = formatDateLocal(endDate);

  useEffect(() => {
    setLoading(true);
    axios.get('http://localhost:5000/api/calendar/dates', { params: { start: startStr, end: endStr } })
      .then(r => setDatesData(r.data))
      .catch(e => console.error('שגיאה:', e))
      .finally(() => setLoading(false));
  }, [startStr, endStr]);

  const buildGrid = () => {
    const serverMap = new Map(datesData.map((d: any) => [d.date, d]));
    const days: (DayData & { col: number; row: number })[] = [];
    const loop = new Date(startDate);
    let row = 2; // שורה 1 = כותרות

    while (loop <= endDate) {
      const key = formatDateLocal(loop);
      const srv = serverMap.get(key);
      const dow = loop.getDay();

      days.push({
        id:             srv?.id         ?? null,
        date:           key,
        dayOfWeek:      dow,
        hebrewDate:     srv?.hebrewDate ?? '',
        status:         srv?.status     ?? 'AVAILABLE',
        reason:         srv?.reason     ?? null,
        candleTime:     srv?.candleTime ?? null,
        lockedBy:       srv?.lockedBy   ?? null,
        booking:        srv?.booking    ?? null,
        isCurrentMonth: loop.getMonth() === month,
        col:            DOW_TO_COL[dow],
        row,
      });

      // שבת = עמודה 1 = אחרון בשורה → שורה חדשה
      if (dow === 6) row++;
      loop.setDate(loop.getDate() + 1);
    }
    return days;
  };

  const grid = buildGrid();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevYear  = () => setCurrentDate(new Date(year - 1, month, 1));
  const nextYear  = () => setCurrentDate(new Date(year + 1, month, 1));

  return (
    <div className="calendar-container">
      <div className="calendar-nav" style={{ direction: 'rtl' }}>
        <button className="nav-btn year-btn" onClick={nextYear}>»</button>
        <button className="nav-btn"          onClick={nextMonth}>›</button>
        <div className="months-bar">
          {MONTH_NAMES.map((name, i) => (
            <div key={name} className={`month-tab ${i === month ? 'active' : ''}`}
              onClick={() => setCurrentDate(new Date(year, i, 1))}>
              {name}
            </div>
          ))}
        </div>
        <button className="nav-btn"          onClick={prevMonth}>‹</button>
        <button className="nav-btn year-btn" onClick={prevYear}>«</button>
      </div>

      <div className="year-display">{year}</div>

      {loading ? (
        <div className="calendar-loading">טוען...</div>
      ) : (
        <div className="calendar-grid">
          {/* כותרות שורה 1: שבת(col1) ... ראשון(col7) */}
          {COL_HEADERS.map((d, i) => (
            <div key={d} className="week-day-label"
              style={{ gridColumn: i + 1, gridRow: 1 }}>
              {d}
            </div>
          ))}

          {/* ימים - כל יום בעמודה ושורה מדויקים */}
          {grid.map(day => {
            const cls = [
              'calendar-cell',
              `status-${day.status.toLowerCase()}`,
              !day.isCurrentMonth ? 'out-of-month' : ''
            ].filter(Boolean).join(' ');

            const dayNum = new Date(day.date + 'T12:00:00').getDate();
            const isPast = new Date(day.date + 'T12:00:00') < new Date(new Date().toDateString());

            return (
              <div key={day.date} className={cls}
                style={{ gridColumn: day.col, gridRow: day.row, opacity: isPast && day.isCurrentMonth ? 0.5 : 1 }}
                onClick={() => {
                  if (!day.isCurrentMonth) return;
                  if (day.status === 'BLOCKED') return;
                  if (isPast) return;
                  if (day.booking) {
                    setSelectedDay(day);
                  } else {
                    onDateSelect(day);
                  }
                }}
              >
                <div className="cell-header-row">
                  <span className="gregorian-num">{dayNum}</span>
                  {day.isCurrentMonth && day.candleTime && (
                    <span className="candle-time">{day.candleTime}</span>
                  )}
                  <span className="hebrew-text">
                    {day.isCurrentMonth ? day.hebrewDate : ''}
                  </span>
                </div>
                <div className="cell-status-text">
                  {day.isCurrentMonth ? (day.reason || '') : ''}
                </div>

                {/* פרטי אירוע בתא */}
                {day.isCurrentMonth && day.booking && (
                  <div className={`cell-event ${day.status === 'BOOKED' ? 'event-booked' : 'event-option'}`}>
                    <div className="event-name">{day.booking.clientAFullName}</div>
                    <div className="event-details">{day.booking.eventType}</div>
                    <div className="event-details">נסגר ע"י: {day.booking.createdBy}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedDay && (
        <EventPopup day={selectedDay} onClose={() => setSelectedDay(null)} />
      )}
    </div>
  );
};