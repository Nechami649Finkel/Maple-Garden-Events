import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Calendar.css';

interface CalendarProps {
  onDateSelect: (date: any) => void;
}

export const Calendar = ({ onDateSelect }: CalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [datesData, setDatesData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0 - 11

  // פונקציה שמחשבת את הטווח המדויק שיוצג על המסך כולל ימי שוליים
  const getCalendarRange = () => {
    // היום הראשון של החודש
    const firstDay = new Date(currentYear, currentMonth, 1);
    // כמה ימי ריפוד צריך מתחילת השבוע (ראשון = 0)
    const startPadding = firstDay.getDay();
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startPadding);

    // היום האחרון של החודש
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    // כמה ימי ריפוד צריך לסוף השבוע
    const endPadding = 6 - lastDay.getDay();
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + endPadding);

    return {
      startStr: startDate.toISOString().split('T')[0],
      endStr: endDate.toISOString().split('T')[0],
      startDate,
      endDate
    };
  };

  const { startStr, endStr, startDate, endDate } = getCalendarRange();

  // משיכת הנתונים המלאים מהבקאנד לפי הטווח המחושב
  const fetchCalendarDates = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:5000/api/calendar/dates', {
        params: { start: startStr, end: endStr }
      });
      setDatesData(response.data);
    } catch (err) {
      console.error("שגיאה בתקשורת עם השרת:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarDates();
  }, [currentDate]);

  // בניית מערך הימים לתצוגה מקומית (מיזוג הבקאנד לתוך המבנה הוויזואלי)
  const buildGridDays = () => {
    const daysArray = [];
    let loopDate = new Date(startDate);

    while (loopDate <= endDate) {
      const dateKey = loopDate.toISOString().split('T')[0];
      const isCurrentMonth = loopDate.getMonth() === currentMonth;
      
      // חיפוש האם חזר עליו מידע מהבקאנד
      const serverMatch = datesData.find(d => d.date === dateKey);

      // לוגיקת שעון שבת/שישי מקומית זמנית לצורך תצוגה מדומה אם השרת ריק
      const dayOfWeek = loopDate.getDay();
      let mockTime = "";
      if (dayOfWeek === 5) {
        if (loopDate.getDate() === 2) mockTime = "17:42";
        if (loopDate.getDate() === 9) mockTime = "17:34";
        if (loopDate.getDate() === 16) mockTime = "17:25";
        if (loopDate.getDate() === 23) mockTime = "17:18";
        if (loopDate.getDate() === 30) mockTime = "16:11";
      }

      daysArray.push({
        date: dateKey,
        dayNumber: loopDate.getDate(),
        isCurrentMonth,
        status: serverMatch?.status || (dayOfWeek === 6 ? 'BLOCKED' : dayOfWeek === 5 ? 'FORBIDDEN' : 'AVAILABLE'),
        hebrewDate: serverMatch?.hebrewDate || '', 
        reason: serverMatch?.reason || (dayOfWeek === 6 ? 'שבת' : dayOfWeek === 5 ? 'יום שישי' : ''),
        candleTime: mockTime,
        serverInfo: serverMatch || null
      });

      loopDate.setDate(loopDate.getDate() + 1);
    }
    return daysArray;
  };

  const gridDays = buildGridDays();

  const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
  const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

  return (
    <div className="calendar-container" style={{ direction: 'rtl' }}>
      
      {/* סרגל החודשים העליון - בדיוק כמו ב-Eruit */}
      <div className="months-bar">
        {monthNames.map((name, index) => (
          <div 
            key={name} 
            className={`month-tab ${index === currentMonth ? 'active' : ''}`}
            onClick={() => setCurrentDate(new Date(currentYear, index, 1))}
          >
            {name}
          </div>
        ))}
      </div>

      {/* כותרות ימי השבוע */}
      <div className="week-days-grid">
        {dayNames.map(day => <div key={day} className="week-day-label">{day}</div>)}
      </div>

      {/* גריד ימי החודש */}
      <div className="calendar-grid">
        {gridDays.map((day) => {
          const classes = [
            'calendar-cell',
            `status-${day.status.toLowerCase()}`,
            !day.isCurrentMonth ? 'out-of-month' : ''
          ].join(' ');

          return (
            <div 
              key={day.date} 
              className={classes}
              onClick={() => day.isCurrentMonth && onDateSelect(day)}
            >
              {/* שורה עליונה בתא */}
              <div className="cell-header-row">
                {/* תאריך עברי קצר בצד ימין */}
                <span className="hebrew-text">
                  {day.isCurrentMonth && day.hebrewDate ? day.hebrewDate.split(' ')[0] + ' ' + (day.hebrewDate.split(' ')[1] || '') : ''}
                </span>

                {/* שעת הדלקת נרות במרכז */}
                {day.isCurrentMonth && day.candleTime && (
                  <span className="candle-time">{day.candleTime}</span>
                )}

                {/* מספר יום לועזי בצד שמאל */}
                <span className="gregorian-num">{day.dayNumber}</span>
              </div>

              {/* טקסט סטטוס/סיבה בתחתית */}
              <div className="cell-status-text">
                {day.isCurrentMonth ? day.reason : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};