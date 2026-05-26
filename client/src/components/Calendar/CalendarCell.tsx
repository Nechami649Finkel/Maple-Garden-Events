import React from 'react';
import { EventStatus } from '../../types/eventStatus';
interface CalendarCellProps {
  dateData: {
    id: number;
    date: Date;
    status: EventStatus; // הסטטוס מה-DB (AVAILABLE, CHECKING וכו')
    statusInfo: { type: string; reason?: string }; // המידע מהמנוע העברי
    hebrewDate: string;
  };
  onStatusChange: (dateId: number) => void;
}

export const CalendarCell: React.FC<CalendarCellProps> = ({ dateData, onStatusChange }) => {
  
  // לוגיקה שמחליטה מה יהיה הצבע (ה-Class) של התא
  const getCellClass = () => {
    const { status, statusInfo } = dateData;

    // 1. אם היום חסום ע"י לוח השנה העברי (שבת/חג/בין הזמנים)
    // העדיפות היא ל-BLOCKED או FORBIDDEN
    if (statusInfo.type === 'BLOCKED' || statusInfo.type === 'FORBIDDEN') {
      return `cell ${statusInfo.type}`;
    }

    // 2. אם היום פנוי בלוח העברי, נציג את הסטטוס של האירוע (CHECKING, OPTION, BOOKED)
    return `cell ${status}`;
  };

  return (
    <div 
      className={getCellClass()} 
      onClick={() => onStatusChange(dateData.id)}
      style={{ cursor: 'pointer', position: 'relative' }}
      title={dateData.statusInfo.reason || ''} 
    >
      <div className="hebrew-date" style={{ fontWeight: 'bold' }}>
        {dateData.hebrewDate}
      </div>
      
      <div className="status-label" style={{ fontSize: '0.8em', marginTop: '5px' }}>
        {dateData.status}
      </div>
      
      {/* תצוגת סיבה למקרה של יום חסום */}
      {dateData.statusInfo.reason && (
        <div className="reason-tooltip" style={{ fontSize: '0.7em', color: '#555' }}>
          ({dateData.statusInfo.reason})
        </div>
      )}
    </div>
  );
};