import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { todayCalendarKey } from '../../utils/dateLocal';
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
import { useTranslation } from '../../i18n/useTranslation';
import { formatDate, formatCurrency } from '@shared/i18n/formatters';
import {
  DEFAULT_EVENT_TYPE,
  EVENT_TYPE_KEY_BY_VALUE,
  translateByValue,
} from '@shared/i18n/bookingLookups';
import liveEventStyles from '../LiveEvent/LiveEvent.module.css';
import './EventPopup.css';

interface EventPopupProps {
  day: any;
  onClose: () => void;
  onAddEvent?: () => void;
  onAddOption?: () => void;
  onOverrideOptionBook?: () => void;
}

export const EventPopup = ({
  day,
  onClose,
  onAddEvent,
  onAddOption,
  onOverrideOptionBook,
}: EventPopupProps) => {
  const navigate = useNavigate();
  const { t, T, locale } = useTranslation();
  const [checkInState, setCheckInState] = useState<{ bookingId: string; readOnly: boolean } | null>(null);
  const [notifyBooking, setNotifyBooking] = useState<any | null>(null);
  const [, setTick] = useState(0);
  const bookings = day.bookings || [];
  const isOptionDay = hasOptionOnDay(day);
  const dateDisplay = formatDate(day.date, locale);
  const hebrewDate = day.hebrewDate || '';
  const todayStr = todayCalendarKey();
  const isPast = day.date < todayStr;
  const availableSlotsLabel = formatAvailableSlotsLabelForDate(t, day.date, bookings);
  const hasFreeSlots =
    !isPast && day.status !== 'FORBIDDEN' && canAddMoreEventsForDate(day.date, bookings);
  const showAddEvent = hasFreeSlots && !!onAddEvent;
  const showAddOption = hasFreeSlots && !!onAddOption;
  const showOverrideOption = isOptionDay && !!onOverrideOptionBook && !hasFreeSlots && !isPast;

  const formatEventType = (value: string) => translateByValue(t, EVENT_TYPE_KEY_BY_VALUE, value);
  const money = (value?: number | null) => formatCurrency(Number(value ?? 0), locale);
  const notEntered = t(T.UI.NOT_ENTERED);
  const unknown = t(T.UI.UNKNOWN);

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
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((tick) => tick + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const buildMissingItems = (booking: any, isWedding: boolean) => {
    const items: string[] = [];
    if (!booking.paidAmount || booking.paidAmount === 0) items.push(t(T.BOOKINGS.MISSING_ADVANCE));
    if (!booking.isContractSigned) items.push(t(T.BOOKINGS.MISSING_CONTRACT));
    if (!booking.clientAIdNumber) items.push(t(T.BOOKINGS.MISSING_ID_A));
    if (isWedding && !booking.clientBIdNumber) items.push(t(T.BOOKINGS.MISSING_ID_B));
    if (!booking.guestCount || booking.guestCount === 0) items.push(t(T.BOOKINGS.MISSING_GUESTS));
    return items;
  };

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
              aria-label={t(T.COMMON.ACTIONS.CLOSE)}
            >
              ✕
            </button>
            <div className="popup-header-text">
              <h2>{t(T.CALENDAR.EVENT_DETAILS_TITLE)}</h2>
              <p className="popup-header-date">
                {dateDisplay}
                {hebrewDate && <span> · {hebrewDate}</span>}
              </p>
            </div>
          </div>

          <div className="popup-body">
            {bookings.length === 0 ? (
              <p className="no-events-msg">{t(T.CALENDAR.NO_EVENTS)}</p>
            ) : (
              bookings.map((booking: any, index: number) => {
                const isWedding = booking.eventType === DEFAULT_EVENT_TYPE;
                const missingItems = buildMissingItems(booking, isWedding);
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
                          {booking.eventCode && (
                            <span className="event-code-badge">#{booking.eventCode} · </span>
                          )}
                          {formatEventType(booking.eventType)} —{' '}
                          {formatTimeOfDayDisplay(t, booking.timeOfDay)}
                        </h3>
                        <span className={`status-badge ${isOptionBooking ? 'option' : 'booked'}`}>
                          {isOptionBooking ? t(T.STATUS.OPTION) : t(T.BOOKINGS.CONFIRMED_BADGE)}
                        </span>
                      </div>
                      <div className="event-actions">
                        {isOptionBooking && booking.id && !isPast && (
                          <button
                            type="button"
                            className="edit-btn notify-option-btn"
                            onClick={() => setNotifyBooking(booking)}
                          >
                            {t(T.CALENDAR.NOTIFY)}
                          </button>
                        )}
                        {isOptionBooking && booking.id && !isPast && (
                          <button
                            type="button"
                            className="edit-btn finalize-option-btn"
                            onClick={() => handleCloseOption(booking.id)}
                          >
                            {t(T.CALENDAR.CLOSE_OPTION)}
                          </button>
                        )}
                        <button
                          type="button"
                          className="edit-btn"
                          disabled={!editable || !booking.id}
                          title={editable ? t(T.BOOKINGS.EDIT_TITLE) : t(T.BOOKINGS.EDIT_BLOCKED)}
                          onClick={() => booking.id && handleEdit(booking.id)}
                        >
                          {t(T.CALENDAR.EDIT)}
                        </button>
                        {booking.id && (
                          <>
                            <button
                              type="button"
                              className="edit-btn"
                              onClick={() => void openContractPdf(booking.id, t)}
                            >
                              {t(T.CALENDAR.VIEW_CONTRACT)}
                            </button>
                            <button
                              type="button"
                              className="edit-btn"
                              onClick={async () => {
                                try {
                                  await printContract(booking.id, t);
                                } catch (e) {
                                  alert(
                                    e instanceof Error
                                      ? e.message
                                      : t(T.BOOKINGS.CONTRACT_PRINT_FAILED),
                                  );
                                }
                              }}
                            >
                              {t(T.CALENDAR.PRINT)}
                            </button>
                          </>
                        )}
                        {booking.isContractSigned && !booking.clientSignatureUrl && (
                          <span className="contract-missing-msg">
                            {t(T.BOOKINGS.CONTRACT_SIGNED_NO_IMAGE)}
                          </span>
                        )}
                        {showCheckIn && booking.id && (
                          <button
                            type="button"
                            className={liveEventStyles.checkInBtn}
                            onClick={() =>
                              setCheckInState({
                                bookingId: booking.id,
                                readOnly: !checkInEditable,
                              })
                            }
                          >
                            {checkInEditable ? t(T.CALENDAR.CHECK_IN) : t(T.CALENDAR.VIEW_CHECK_IN)}
                          </button>
                        )}
                        {isOptionBooking && isPast && (
                          <span className="edit-blocked-msg">{t(T.BOOKINGS.DATE_PASSED)}</span>
                        )}
                        {!editable && !isOptionBooking && (
                          <span className="edit-blocked-msg">{t(T.BOOKINGS.EDIT_BLOCKED)}</span>
                        )}
                      </div>
                    </div>

                    <div className="event-card-grid">
                      <div className="info-group">
                        <h4>{t(T.BOOKINGS.SIDE_A)}</h4>
                        <p>
                          <strong>{t(T.UI.LABEL_NAME)}</strong> {booking.clientAFullName}
                        </p>
                        <p>
                          <strong>{t(T.UI.LABEL_PHONE)}</strong>{' '}
                          {booking.clientAPhone || notEntered}
                        </p>
                        <p>
                          <strong>{t(T.BOOKINGS.LABEL_ID)}</strong>{' '}
                          {booking.clientAIdNumber || notEntered}
                        </p>
                        <p>
                          <strong>{t(T.UI.LABEL_EMAIL)}</strong>{' '}
                          {booking.clientAEmail || notEntered}
                        </p>
                      </div>

                      {isWedding && (
                        <div className="info-group">
                          <h4>{t(T.BOOKINGS.SIDE_B)}</h4>
                          <p>
                            <strong>{t(T.UI.LABEL_NAME)}</strong>{' '}
                            {booking.clientBFullName || notEntered}
                          </p>
                          <p>
                            <strong>{t(T.UI.LABEL_PHONE)}</strong>{' '}
                            {booking.clientBPhone || notEntered}
                          </p>
                          <p>
                            <strong>{t(T.BOOKINGS.LABEL_ID)}</strong>{' '}
                            {booking.clientBIdNumber || notEntered}
                          </p>
                          <p>
                            <strong>{t(T.UI.LABEL_EMAIL)}</strong>{' '}
                            {booking.clientBEmail || notEntered}
                          </p>
                        </div>
                      )}

                      <div className="info-group">
                        <h4>{t(T.BOOKINGS.DEAL_DETAILS)}</h4>
                        <p>
                          <strong>{t(T.BOOKINGS.LABEL_GUESTS)}</strong>{' '}
                          {booking.guestCount || unknown}
                        </p>
                        <p>
                          <strong>{t(T.BOOKINGS.LABEL_PORTION_PRICE)}</strong>{' '}
                          {money(booking.finalPricePortion)}
                        </p>
                        <p>
                          <strong>{t(T.BOOKINGS.LABEL_BASE_PAYMENT)}</strong>{' '}
                          {money(booking.basePrice ?? booking.totalPrice)}
                        </p>
                        {(booking.extrasPrice ?? 0) > 0 && (
                          <p>
                            <strong>{t(T.BOOKINGS.LABEL_HALL_EXTRAS)}</strong>{' '}
                            {money(booking.extrasPrice)}
                          </p>
                        )}
                        {(booking.externalExtrasPrice ?? 0) > 0 && (
                          <p>
                            <strong>{t(T.BOOKINGS.LABEL_EXTERNAL_SUPPLIERS)}</strong>{' '}
                            {money(booking.externalExtrasPrice)}
                          </p>
                        )}
                        {(booking.liveAdditionsTotal ?? 0) > 0 && (
                          <p>
                            <strong>{t(T.BOOKINGS.LABEL_LIVE_ADDITIONS)}</strong>{' '}
                            {money(booking.liveAdditionsTotal)}
                          </p>
                        )}
                        <p>
                          <strong>{t(T.BOOKINGS.LABEL_HALL_TOTAL)}</strong>{' '}
                          {money(booking.totalPrice)}
                        </p>
                        <p>
                          <strong>{t(T.BOOKINGS.LABEL_PAID)}</strong> {money(booking.paidAmount)}
                        </p>
                        <p>
                          <strong>{t(T.BOOKINGS.LABEL_REP)}</strong>{' '}
                          {booking.createdBy || unknown}
                        </p>
                      </div>

                      <div
                        className={`info-group ${missingItems.length > 0 ? 'alerts-group' : 'all-good-group'}`}
                      >
                        <h4>
                          {missingItems.length > 0
                            ? t(T.BOOKINGS.MISSING_STATUS)
                            : t(T.BOOKINGS.DEAL_STATUS)}
                        </h4>
                        {missingItems.length > 0 ? (
                          <ul className="missing-list">
                            {missingItems.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="all-good">{t(T.BOOKINGS.DEAL_COMPLETE)}</p>
                        )}
                        {parseNotes(booking.managerComments).length > 0 && (
                          <div className="comments-box">
                            <strong>{t(T.BOOKINGS.MANAGER_NOTES)}</strong>
                            <NotesList notes={parseNotes(booking.managerComments)} />
                          </div>
                        )}
                        {clientNotes.menu.length > 0 && (
                          <div className="comments-box">
                            <strong>{t(T.BOOKINGS.MENU_NOTES)}</strong>
                            <NotesList notes={clientNotes.menu} />
                          </div>
                        )}
                        {clientNotes.internal.length > 0 && (
                          <div className="comments-box">
                            <strong>{t(T.BOOKINGS.INTERNAL_NOTES)}</strong>
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
                onClick={() => {
                  onClose();
                  onOverrideOptionBook?.();
                }}
              >
                {t(T.CALENDAR.OVERRIDE_OPTION)}
              </button>
            )}
            {showAddEvent && (
              <button
                type="button"
                className="popup-add-btn"
                onClick={() => {
                  onClose();
                  onAddEvent?.();
                }}
              >
                + {t(T.CALENDAR.ADD_EVENT)} ({availableSlotsLabel})
              </button>
            )}
            {showAddOption && (
              <button
                type="button"
                className="popup-option-btn"
                onClick={() => {
                  onClose();
                  onAddOption?.();
                }}
              >
                + {t(T.CALENDAR.ADD_OPTION)} ({availableSlotsLabel})
              </button>
            )}
            <button type="button" className="popup-close-btn" onClick={handleClose}>
              {t(T.COMMON.ACTIONS.CLOSE)}
            </button>
          </div>
        </div>
      </div>
      {checkInState && (
        <EventCheckInModal
          bookingId={checkInState.bookingId}
          dateDisplay={dateDisplay}
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
