import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { canEditBooking } from '../../utils/bookingEdit';
import { canEditCheckIn, canViewCheckIn } from '../../utils/eventStart';
import {
  canAddMoreEventsForDate,
  formatAvailableSlotsLabelForDate,
  formatTimeOfDayDisplay,
  getSlotColor,
  hasOptionOnDay,
} from '../../utils/timeSlot';
import { parseNotes, parseNotesBundle } from '../../utils/notesStorage';
import { printContract, openContractPdf } from '../../utils/contractPrint';
import { NotesList } from '../NotesList/NotesList';
import EventCheckInModal from '../LiveEvent/EventCheckInModal';
import NotifyOptionModal from '../NotifyOptionModal/NotifyOptionModal';
import liveEventStyles from '../LiveEvent/LiveEvent.module.css';
import './EventPopup.css';

interface EventPopupProps {
  day: any;
  onClose: () => void;
  onAddEvent?: () => void;
  onAddOption?: () => void;
  onOverrideOptionBook?: () => void;
}

export const EventPopup = ({ day, onClose, onAddEvent, onAddOption, onOverrideOptionBook }: EventPopupProps) => {
  const navigate = useNavigate();
  const [checkInState, setCheckInState] = useState<{ bookingId: string; readOnly: boolean } | null>(null);
  const [notifyBooking, setNotifyBooking] = useState<any | null>(null);
  const [, setTick] = useState(0);
  const bookings = day.bookings || [];
  const isOptionDay = hasOptionOnDay(day);
  const dateDisplay = day.date.split('-').reverse().join('/');
  const hebrewDate = day.hebrewDate || '';
  const todayStr = new Date().toISOString().split('T')[0];
  const isPast = day.date < todayStr;
  const availableSlotsLabel = formatAvailableSlotsLabelForDate(day.date, bookings);
  const hasFreeSlots =
    !isPast
    && day.status !== 'FORBIDDEN'
    && canAddMoreEventsForDate(day.date, bookings);
  const showAddEvent = hasFreeSlots && !!onAddEvent;
  const showAddOption = hasFreeSlots && !!onAddOption;
  const showOverrideOption = isOptionDay && !!onOverrideOptionBook && !hasFreeSlots && !isPast;

  const handleEdit = (bookingId: string) => {
    onClose();
    navigate(`/booking/edit/${bookingId}`);
  };

  const handleCloseOption = (bookingId: string) => {
    onClose();
    navigate(`/booking/close-option/${bookingId}`);
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

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const dateDisplayHe = day.date.split('-').reverse().join('/');

  return createPortal(
    <>
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="popup-header">
          <button
            type="button"
            className="popup-header-close"
            onClick={handleClose}
            aria-label="סגירה"
          >
            ✕
          </button>
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
              const isOptionBooking = booking.isOption === true;
              const isBooked = !isOptionBooking;
              const showCheckIn = isBooked && canViewCheckIn(day.date, booking, booking.eventForm);
              const checkInEditable = showCheckIn && canEditCheckIn(day.date, booking, booking.eventForm);

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
                      <span className={`status-badge ${isOptionBooking ? 'option' : 'booked'}`}>
                        {isOptionBooking ? 'אופציה' : 'הזמנה סגורה'}
                      </span>
                    </div>
                    <div className="event-actions">
                      {isOptionBooking && booking.id && !isPast && (
                        <button
                          type="button"
                          className="edit-btn notify-option-btn"
                          onClick={() => setNotifyBooking(booking)}
                        >
                          הקפץ הודעה ללקוח
                        </button>
                      )}
                      {isOptionBooking && booking.id && !isPast && (
                        <button
                          type="button"
                          className="edit-btn finalize-option-btn"
                          onClick={() => handleCloseOption(booking.id)}
                        >
                          סגור כהזמנה
                        </button>
                      )}
                      <button
                        type="button"
                        className="edit-btn"
                        disabled={!editable || !booking.id}
                        title={editable ? 'עריכת פרטי ההזמנה' : 'לא ניתן לערוך ביום האירוע או לאחריו'}
                        onClick={() => booking.id && handleEdit(booking.id)}
                      >
                        עריכת פרטים
                      </button>
                      {booking.id && (
                        <>
                          <button
                            type="button"
                            className="edit-btn"
                            onClick={() => void openContractPdf(booking.id)}
                          >
                            צפייה בחוזה
                          </button>
                          <button
                            type="button"
                            className="edit-btn"
                            onClick={async () => {
                              try {
                                await printContract(booking.id);
                              } catch (e) {
                                alert(e instanceof Error ? e.message : 'לא הצלחנו להדפיס את החוזה.');
                              }
                            }}
                          >
                            הדפסת חוזה
                          </button>
                        </>
                      )}
                      {booking.isContractSigned && !booking.clientSignatureUrl && (
                        <span className="contract-missing-msg">
                          החוזה מסומן כחתום, אך תמונת החתימה חסרה. יש לחתום מחדש בעריכת ההזמנה.
                        </span>
                      )}
                      {showCheckIn && booking.id && (
                        <button
                          type="button"
                          className={liveEventStyles.checkInBtn}
                          onClick={() => setCheckInState({
                            bookingId: booking.id,
                            readOnly: !checkInEditable,
                          })}
                        >
                          טופס קבלת אולם
                        </button>
                      )}
                      {isOptionBooking && isPast && (
                        <span className="edit-blocked-msg">תאריך זה עבר — לא ניתן לסגור כהזמנה</span>
                      )}
                      {!editable && !isOptionBooking && (
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
                      <p><strong>תשלום בסיסי:</strong> ₪{booking.basePrice ?? booking.totalPrice ?? 0}</p>
                      {(booking.extrasPrice ?? 0) > 0 && (
                        <p><strong>תוספות לאולם:</strong> ₪{booking.extrasPrice}</p>
                      )}
                      {(booking.externalExtrasPrice ?? 0) > 0 && (
                        <p><strong>ספקים חיצוניים:</strong> ₪{booking.externalExtrasPrice}</p>
                      )}
                      {(booking.liveAdditionsTotal ?? 0) > 0 && (
                        <p><strong>תוספות בזמן האירוע:</strong> ₪{booking.liveAdditionsTotal}</p>
                      )}
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
          {showOverrideOption && (
            <button
              type="button"
              className="popup-override-btn"
              onClick={() => { onClose(); onOverrideOptionBook?.(); }}
            >
              סגירת אירוע במקום האופציה
            </button>
          )}
          {showAddEvent && (
            <button
              type="button"
              className="popup-add-btn"
              onClick={() => { onClose(); onAddEvent?.(); }}
            >
              + אירוע נוסף ({availableSlotsLabel})
            </button>
          )}
          {showAddOption && (
            <button
              type="button"
              className="popup-option-btn"
              onClick={() => { onClose(); onAddOption?.(); }}
            >
              + אופציה ({availableSlotsLabel})
            </button>
          )}
          <button type="button" className="popup-close-btn" onClick={handleClose}>
            סגור
          </button>
        </div>
      </div>
    </div>
    {checkInState && (
      <EventCheckInModal
        bookingId={checkInState.bookingId}
        dateDisplay={dateDisplayHe}
        readOnly={checkInState.readOnly}
        onClose={() => setCheckInState(null)}
      />
    )}
    {notifyBooking && (
      <NotifyOptionModal
        booking={notifyBooking}
        eventDateStr={day.date}
        onClose={() => setNotifyBooking(null)}
      />
    )}
    </>,
    document.body,
  );
};
