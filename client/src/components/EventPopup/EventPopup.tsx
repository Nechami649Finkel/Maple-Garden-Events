import React from 'react';
import './EventPopup.css';

interface EventPopupProps {
  day: any;
  onClose: () => void;
}

export const EventPopup = ({ day, onClose }: EventPopupProps) => {
  const b = day.booking;
  if (!b) return null;

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-box" onClick={e => e.stopPropagation()}>
        <div className="popup-header">
          <span>פרטי אירוע - {day.hebrewDate} | {new Date(day.date + 'T12:00:00').toLocaleDateString('he-IL')}</span>
          <button className="popup-close" onClick={onClose}>✕</button>
        </div>

        <div className="popup-body">
          <div className="popup-row">
            <label>סוג אירוע:</label>
            <span>{b.eventType}</span>
          </div>
          <div className="popup-row">
            <label>צד א':</label>
            <span>{b.clientAFullName} | {b.clientAPhone}</span>
          </div>
          {b.clientBFullName && (
            <div className="popup-row">
              <label>צד ב':</label>
              <span>{b.clientBFullName} | {b.clientBPhone}</span>
            </div>
          )}
          <div className="popup-row">
            <label>מוזמנים:</label>
            <span>{b.guestCount}</span>
          </div>
          <div className="popup-row">
            <label>מחיר מנה:</label>
            <span>₪{b.finalPricePortion}</span>
          </div>
          <div className="popup-row">
            <label>סה"כ:</label>
            <span>₪{b.totalPrice?.toLocaleString()}</span>
          </div>
          <div className="popup-row">
            <label>שולם:</label>
            <span>₪{b.paidAmount?.toLocaleString()}</span>
          </div>
          <div className="popup-row">
            <label>נסגר ע"י:</label>
            <span>{b.createdBy}</span>
          </div>
          {b.managerComments && (
            <div className="popup-row">
              <label>הערות:</label>
              <span>{b.managerComments}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
