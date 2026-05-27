import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Calendar.css';

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
const DAY_NAMES   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];

export const Calendar = ({ onDateSelect }: CalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [datesData, setDatesData]     = useState<any[]>([]);
  const [loading, setLoading]         = useState(false);

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const getRange = () => {
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // ראשון = 0

    const lastDay = new Date(year, month + 1, 0);
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay())); // שבת = 6

    return { startDate, endDate };
  };

  const { startDate, endDate } = getRange();
  const startStr = startDate.toISOString().split('T')[0];
  const endStr   = endDate.toISOString().split('T')[0];

  useEffect(() => {
    setLoading(true);
    axios.get('http://localhost:5000/api/calendar/dates', { params: { start: startStr, end: endStr } })
      .then(r => setDatesData(r.data))
      .catch(e => console.error('שגיאה:', e))
      .finally(() => setLoading(false));
  }, [startStr, endStr]);

  const buildGrid = (): DayData[] => {
    const serverMap = new Map(datesData.map((d: any) => [d.date, d]));
    const days: DayData[] = [];
    const loop = new Date(startDate);
    let rowIndex = 2; // שורה 1 = כותרות, ימים מתחילים משורה 2

    while (loop <= endDate) {
      const key = loop.toISOString().split('T')[0];
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
        row:            rowIndex,
      });
      // אחרי שבת (6) עוברים לשורה הבאה
      if (dow === 6) rowIndex++;
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
    <div className="calendar-container" style={{ direction: 'rtl' }}>

      {/* ניווט שנה + פס חודשים */}
      <div className="calendar-nav">
        <button className="nav-btn year-btn" onClick={nextYear}>»</button>
        <button className="nav-btn"          onClick={nextMonth}>›</button>

        <div className="months-bar">
          {MONTH_NAMES.map((name, i) => (
            <div
              key={name}
              className={`month-tab ${i === month ? 'active' : ''}`}
              onClick={() => setCurrentDate(new Date(year, i, 1))}
            >
              {name}
            </div>
          ))}
        </div>

        <button className="nav-btn"          onClick={prevMonth}>‹</button>
        <button className="nav-btn year-btn" onClick={prevYear}>«</button>
      </div>

      {/* שנה */}
      <div className="year-display">{year}</div>

      {/* כותרות + גריד בגריד אחד */}
      {loading ? (
        <div className="calendar-loading">טוען...</div>
      ) : (
        <div className="calendar-grid">
          {['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'].map(d => (
            <div key={d} className="week-day-label">{d}</div>
          ))}
          {grid.map(day => {
            const cls = [
              'calendar-cell',
              `status-${day.status.toLowerCase()}`,
              !day.isCurrentMonth ? 'out-of-month' : ''
            ].filter(Boolean).join(' ');

            const dayNum = new Date(day.date + 'T12:00:00').getDate();

            return (
              <div
                key={day.date}
                className={cls}
                onClick={() => {
                  if (!day.isCurrentMonth) return;
                  if (day.status === 'BLOCKED') return;
                  onDateSelect(day);
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
