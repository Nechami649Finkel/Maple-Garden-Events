import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { canEditBooking } from '../../utils/bookingEdit';
import {
  canAddMoreEventsForDate,
  formatAvailableSlotsLabelForDate,
  formatTimeOfDayDisplay,
  getSlotColor,
} from '../../utils/timeSlot';
import { parseNotes, parseNotesBundle } from '../../utils/notesStorage';
import { printContract, openContractPdf } from '../../utils/contractPrint';
import { NotesList } from '../NotesList/NotesList';
import './EventPopup.css';

interface EventPopupProps {
  day: any;
  onClose: () => void;
  onAddEvent?: () => void;
}

export const EventPopup = ({ day, onClose, onAddEvent }: EventPopupProps) => {
  const navigate = useNavigate();
  const bookings = day.bookings || [];
  const isOptionDay = day.status === 'OPTION';
  const dateDisplay = day.date.split('-').reverse().join('/');
  const hebrewDate = day.hebrewDate || '';
  const todayStr = new Date().toISOString().split('T')[0];
  const isPast = day.date < todayStr;
  const availableSlotsLabel = formatAvailableSlotsLabelForDate(day.date, bookings);
  const showAddEvent =
    !isPast
    && day.status !== 'BLOCKED'
    && day.status !== 'FORBIDDEN'
    && canAddMoreEventsForDate(day.date, bookings)
    && !!onAddEvent;

  const handleEdit = (bookingId: string) => {
    onClose();
    navigate(`/booking/edit/${bookingId}`);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return createPortal(
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="popup-header">
          <div className="popup-header-text">
            <h2>פרטי אירועים</h2>
            <p className="popup-header-date">
              {dateDisplay}
              {hebrewDate && <span> · {hebrewDate}</span>}
            </p>
          </div>
        </div>

        <div className="popup-body">
          {bookings.length === 0 ? (
            <p className="no-events-msg">אין אירועים בתאריך זה.</p>
          ) : (
            bookings.map((booking: any, index: number) => {
              const isWedding = booking.eventType === 'חתונה';
              const missingItems: string[] = [];

              if (!booking.paidAmount || booking.paidAmount === 0) missingItems.push('מקדמה טרם שולמה');
              if (!booking.isContractSigned) missingItems.push('חוזה טרם נחתם');
              if (!booking.clientAIdNumber) missingItems.push("חסרה ת.ז של צד א'");
              if (isWedding && !booking.clientBIdNumber) missingItems.push("חסרה ת.ז של צד ב'");
              if (!booking.guestCount || booking.guestCount === 0) missingItems.push('לא הוזנה כמות מוזמנים');

              const editable = canEditBooking(day.date);
              const clientNotes = parseNotesBundle(booking.clientComments);

              return (
                <div
                  key={booking.id || index}
                  className="event-card"
                  style={{ borderRightColor: getSlotColor(booking.timeOfDay) }}
                >
                  <div className="event-card-top">
                    <div className="event-card-title-row">
                      <h3>
                        {booking.eventCode && <span className="event-code-badge">#{booking.eventCode} · </span>}
                        {booking.eventType} — {formatTimeOfDayDisplay(booking.timeOfDay)}
                      </h3>
                      <span className={`status-badge ${isOptionDay ? 'option' : 'booked'}`}>
                        {isOptionDay ? 'אופציה' : 'הזמנה סגורה'}
                      </span>
                    </div>
                    <div className="event-actions">
                      <button
                        type="button"
                        className="edit-btn"
                        disabled={!editable || !booking.id}
                        title={editable ? 'עריכת פרטי ההזמנה' : 'לא ניתן לערוך ביום האירוע או לאחריו'}
                        onClick={() => booking.id && handleEdit(booking.id)}
                      >
                        עריכת פרטים
                      </button>
                      {booking.isContractSigned && booking.id && (
                        <>
                          <button
                            type="button"
                            className="edit-btn"
                            onClick={() => openContractPdf(booking.id)}
                          >
                            צפייה בחוזה
                          </button>
                          <button
                            type="button"
                            className="edit-btn"
                            onClick={async () => {
                              try {
                                await printContract(booking.id);
                              } catch {
                                alert('לא הצלחנו להדפיס את החוזה.');
                              }
                            }}
                          >
                            הדפסת חוזה
                          </button>
                        </>
                      )}
                      {!editable && (
                        <span className="edit-blocked-msg">לא ניתן לערוך ביום האירוע או לאחריו</span>
                      )}
                    </div>
                  </div>

                  <div className="event-card-grid">
                    <div className="info-group">
                      <h4>צד א'</h4>
                      <p><strong>שם:</strong> {booking.clientAFullName}</p>
                      <p><strong>טלפון:</strong> {booking.clientAPhone || 'לא הוזן'}</p>
                      <p><strong>ת.ז:</strong> {booking.clientAIdNumber || 'לא הוזן'}</p>
                      <p><strong>אימייל:</strong> {booking.clientAEmail || 'לא הוזן'}</p>
                    </div>

                    {isWedding && (
                      <div className="info-group">
                        <h4>צד ב'</h4>
                        <p><strong>שם:</strong> {booking.clientBFullName || 'לא הוזן'}</p>
                        <p><strong>טלפון:</strong> {booking.clientBPhone || 'לא הוזן'}</p>
                        <p><strong>ת.ז:</strong> {booking.clientBIdNumber || 'לא הוזן'}</p>
                        <p><strong>אימייל:</strong> {booking.clientBEmail || 'לא הוזן'}</p>
                      </div>
                    )}

                    <div className="info-group">
                      <h4>פרטי העסקה</h4>
                      <p><strong>מוזמנים:</strong> {booking.guestCount || 'לא ידוע'}</p>
                      <p><strong>מחיר למנה:</strong> ₪{booking.finalPricePortion || 0}</p>
                      <p><strong>סה"כ:</strong> ₪{booking.totalPrice || 0}</p>
                      <p><strong>שולם:</strong> ₪{booking.paidAmount || 0}</p>
                      <p><strong>נציג:</strong> {booking.createdBy || 'לא ידוע'}</p>
                    </div>

                    <div className={`info-group ${missingItems.length > 0 ? 'alerts-group' : 'all-good-group'}`}>
                      <h4>{missingItems.length > 0 ? 'סטטוס חוסרים' : 'סטטוס עסקה'}</h4>
                      {missingItems.length > 0 ? (
                        <ul className="missing-list">
                          {missingItems.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                      ) : (
                        <p className="all-good">העסקה מושלמת — לא חסר כלום.</p>
                      )}
                      {parseNotes(booking.managerComments).length > 0 && (
                        <div className="comments-box">
                          <strong>הערות מנהל:</strong>
                          <NotesList notes={parseNotes(booking.managerComments)} />
                        </div>
                      )}
                      {clientNotes.menu.length > 0 && (
                        <div className="comments-box">
                          <strong>הערות לתפריט:</strong>
                          <NotesList notes={clientNotes.menu} />
                        </div>
                      )}
                      {clientNotes.internal.length > 0 && (
                        <div className="comments-box">
                          <strong>הערות פנימיות:</strong>
                          <NotesList notes={clientNotes.internal} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="popup-footer">
          {showAddEvent && (
            <button
              type="button"
              className="popup-add-btn"
              onClick={() => { onClose(); onAddEvent?.(); }}
            >
              + אירוע נוסף ({availableSlotsLabel})
            </button>
          )}
          <button type="button" className="popup-close-btn" onClick={handleClose}>
            סגור
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
