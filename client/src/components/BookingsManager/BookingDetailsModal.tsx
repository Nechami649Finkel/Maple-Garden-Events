import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { calendarKeyFromDbDate } from '../../utils/dateLocal';
import { formatTimeOfDayDisplay } from '../../utils/timeSlot';
import { parseNotes, parseNotesBundle } from '../../utils/notesStorage';
import { openContractPdf, printContract } from '../../utils/contractPrint';
import {
  canForceReissueEasyCountReceipt,
  canRetryEasyCountReceipt,
  formatEasyCountStatusLabel,
  formatDepositMethodLabel,
} from '../../utils/easycount';
import { apiFetch } from '../../services/api';
import { API_URL } from '../../config/api';
import { canEditBooking } from '../../utils/bookingEdit';
import { NotesList } from '../NotesList/NotesList';
import HallInvoicesPanel from './HallInvoicesPanel';
import { useTranslation } from '../../i18n/useTranslation';
import { formatDate, formatDateTime, formatCurrency } from '@shared/i18n/formatters';
import {
  DEFAULT_EVENT_TYPE,
  EVENT_TYPE_KEY_BY_VALUE,
  HALL_ONLY_EVENT_TYPE,
  translateByValue,
} from '@shared/i18n/bookingLookups';
import styles from './BookingsManager.module.css';
import { type BookingApi, type EventAdditionApi } from '../../utils/bookingApi';

interface BookingDetailsModalProps {
  booking: BookingApi;
  onClose: () => void;
  onBookingUpdated?: (booking: BookingApi) => void;
}

const BookingDetailsModal = ({ booking, onClose, onBookingUpdated }: BookingDetailsModalProps) => {
  const navigate = useNavigate();
  const { t, T, locale } = useTranslation();
  const [issuingReceipt, setIssuingReceipt] = useState(false);

  const dash = t(T.COMMON.LABELS.EM_DASH);
  const formatEventType = (value: string) => translateByValue(t, EVENT_TYPE_KEY_BY_VALUE, value);
  const money = (value?: number | null) =>
    formatCurrency(Number(value ?? 0), locale);

  const eventDateStr = booking.eventDate?.date
    ? calendarKeyFromDbDate(new Date(booking.eventDate.date))
    : '';
  const dateDisplay = booking.eventDate?.date
    ? formatDate(booking.eventDate.date, locale)
    : '';
  const editable = eventDateStr ? canEditBooking(eventDateStr) : false;
  const isWedding = booking.eventType === DEFAULT_EVENT_TYPE;
  const isHallOnly = booking.eventType === HALL_ONLY_EVENT_TYPE;
  const clientNotes = parseNotesBundle(booking.clientComments);
  const managerNotes = parseNotes(booking.managerComments);
  const showRetry = canRetryEasyCountReceipt(booking);
  const showForceReissue = canForceReissueEasyCountReceipt(booking);

  const handleEdit = () => {
    onClose();
    navigate(`/booking/edit/${booking.id}`);
  };

  const handleIssueReceipt = async (force = false) => {
    setIssuingReceipt(true);
    try {
      const res = await apiFetch(`${API_URL}/bookings/${booking.id}/easycount-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const json = await res.json();
      alert(
        json.message ||
          (json.success ? t(T.BOOKINGS.RECEIPT_SUCCESS) : t(T.BOOKINGS.RECEIPT_ERROR)),
      );
      if (json.success && json.data && onBookingUpdated) {
        onBookingUpdated(json.data as BookingApi);
      }
    } catch {
      alert(t(T.COMMON.ERRORS.CONNECTION));
    } finally {
      setIssuingReceipt(false);
    }
  };

  const titleParts = [
    t(T.BOOKINGS.DETAILS_TITLE),
    booking.eventCode ? `#${booking.eventCode}` : '',
    dateDisplay || '',
  ].filter(Boolean);

  return (
    <div className={styles.popupOverlay} onClick={onClose}>
      <div className={`${styles.popupBox} ${styles.detailsBox}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.popupHeader}>
          <span>{titleParts.join(' · ')}</span>
          <button
            type="button"
            className={styles.popupClose}
            onClick={onClose}
            aria-label={t(T.COMMON.ACTIONS.CLOSE)}
          >
            ✕
          </button>
        </div>

        <div className={styles.popupBody}>
          <section className={styles.detailsSection}>
            <h3 className={styles.sectionTitle}>{t(T.BOOKINGS.EVENT_DETAILS)}</h3>
            <div className={styles.popupRow}>
              <label>{t(T.BOOKINGS.LABEL_EVENT_CODE)}</label>
              <span>{booking.eventCode || dash}</span>
            </div>
            <div className={styles.popupRow}>
              <label>{t(T.UI.LABEL_DATE)}</label>
              <span>{dateDisplay || dash}</span>
            </div>
            <div className={styles.popupRow}>
              <label>{t(T.BOOKINGS.LABEL_EVENT_TYPE)}</label>
              <span>{booking.eventType ? formatEventType(booking.eventType) : dash}</span>
            </div>
            <div className={styles.popupRow}>
              <label>{t(T.BOOKINGS.LABEL_TIME_SLOT)}</label>
              <span>{formatTimeOfDayDisplay(t, booking.timeOfDay)}</span>
            </div>
            {booking.leadSource && (
              <div className={styles.popupRow}>
                <label>{t(T.BOOKINGS.LABEL_LEAD_SOURCE)}</label>
                <span>{booking.leadSource}</span>
              </div>
            )}
          </section>

          <section className={styles.detailsSection}>
            <h3 className={styles.sectionTitle}>{t(T.BOOKINGS.SIDE_A)}</h3>
            <div className={styles.popupRow}>
              <label>{t(T.UI.LABEL_NAME)}</label>
              <span>{booking.clientAFullName || dash}</span>
            </div>
            <div className={styles.popupRow}>
              <label>{t(T.BOOKINGS.LABEL_ID)}</label>
              <span>{booking.clientAIdNumber || dash}</span>
            </div>
            <div className={styles.popupRow}>
              <label>{t(T.UI.LABEL_PHONE)}</label>
              <span>{booking.clientAPhone || dash}</span>
            </div>
            <div className={styles.popupRow}>
              <label>{t(T.UI.LABEL_EMAIL)}</label>
              <span>{booking.clientAEmail || dash}</span>
            </div>
            <div className={styles.popupRow}>
              <label>{t(T.UI.LABEL_ADDRESS)}</label>
              <span>{booking.clientAAddress || dash}</span>
            </div>
          </section>

          {(isWedding || booking.clientBFullName) && (
            <section className={styles.detailsSection}>
              <h3 className={styles.sectionTitle}>{t(T.BOOKINGS.SIDE_B)}</h3>
              <div className={styles.popupRow}>
                <label>{t(T.UI.LABEL_NAME)}</label>
                <span>{booking.clientBFullName || dash}</span>
              </div>
              <div className={styles.popupRow}>
                <label>{t(T.BOOKINGS.LABEL_ID)}</label>
                <span>{booking.clientBIdNumber || dash}</span>
              </div>
              <div className={styles.popupRow}>
                <label>{t(T.UI.LABEL_PHONE)}</label>
                <span>{booking.clientBPhone || dash}</span>
              </div>
              <div className={styles.popupRow}>
                <label>{t(T.UI.LABEL_EMAIL)}</label>
                <span>{booking.clientBEmail || dash}</span>
              </div>
              <div className={styles.popupRow}>
                <label>{t(T.UI.LABEL_ADDRESS)}</label>
                <span>{booking.clientBAddress || dash}</span>
              </div>
            </section>
          )}

          <section className={styles.detailsSection}>
            <h3 className={styles.sectionTitle}>{t(T.BOOKINGS.DEAL_DETAILS)}</h3>
            {isHallOnly ? (
              <div className={styles.popupRow}>
                <label>{t(T.BOOKINGS.LABEL_HALL_RENTAL)}</label>
                <span>{money(booking.hallRentalPrice)}</span>
              </div>
            ) : (
              <>
                <div className={styles.popupRow}>
                  <label>{t(T.BOOKINGS.LABEL_GUESTS)}</label>
                  <span>{booking.guestCount ?? dash}</span>
                </div>
                <div className={styles.popupRow}>
                  <label>{t(T.BOOKINGS.LABEL_PORTION_PRICE)}</label>
                  <span>{money(booking.finalPricePortion)}</span>
                </div>
              </>
            )}
            <div className={styles.popupRow}>
              <label>{t(T.BOOKINGS.LABEL_BASE_PAYMENT)}</label>
              <span>{money(booking.basePrice ?? booking.totalPrice)}</span>
            </div>
            {(booking.extrasPrice ?? 0) > 0 && (
              <div className={styles.popupRow}>
                <label>{t(T.BOOKINGS.LABEL_HALL_EXTRAS)}</label>
                <span>{money(booking.extrasPrice)}</span>
              </div>
            )}
            {(booking.externalExtrasPrice ?? 0) > 0 && (
              <div className={styles.popupRow}>
                <label>{t(T.BOOKINGS.LABEL_EXTERNAL_SUPPLIERS)}</label>
                <span>{money(booking.externalExtrasPrice)}</span>
              </div>
            )}
            {(booking.liveAdditionsTotal ?? 0) > 0 && (
              <div className={styles.popupRow}>
                <label>{t(T.BOOKINGS.LABEL_LIVE_ADDITIONS)}</label>
                <span>{money(booking.liveAdditionsTotal)}</span>
              </div>
            )}
            <div className={styles.popupRow}>
              <label>{t(T.BOOKINGS.LABEL_HALL_TOTAL)}</label>
              <span className={styles.totalPrice}>{money(booking.totalPrice)}</span>
            </div>
            <div className={styles.popupRow}>
              <label>{t(T.BOOKINGS.LABEL_PAID)}</label>
              <span>{money(booking.paidAmount)}</span>
            </div>
            {(booking.advancePaid ?? 0) > 0 && (
              <div className={styles.popupRow}>
                <label>{t(T.BOOKINGS.LABEL_ADVANCE)}</label>
                <span>{money(booking.advancePaid)}</span>
              </div>
            )}
            {(booking.totalPaid ?? 0) > 0 && (
              <div className={styles.popupRow}>
                <label>{t(T.BOOKINGS.LABEL_TOTAL_PAID)}</label>
                <span>{money(booking.totalPaid)}</span>
              </div>
            )}
            <div className={styles.popupRow}>
              <label>{t(T.BOOKINGS.LABEL_PAYMENT_STATUS)}</label>
              <span>{booking.paymentStatus || dash}</span>
            </div>
            {booking.depositMethod && (
              <div className={styles.popupRow}>
                <label>{t(T.BOOKINGS.LABEL_ADVANCE_METHOD)}</label>
                <span>{formatDepositMethodLabel(t, booking.depositMethod)}</span>
              </div>
            )}
            {(booking.advancePaid ?? 0) > 0 && (
              <div className={styles.popupRow}>
                <label>{t(T.BOOKINGS.EZCOUNT)}</label>
                <span>{formatEasyCountStatusLabel(t, booking.easycountStatus)}</span>
              </div>
            )}
            {booking.easycountDocId && (
              <div className={styles.popupRow}>
                <label>{t(T.BOOKINGS.LABEL_RECEIPT_ID)}</label>
                <span>{booking.easycountDocId}</span>
              </div>
            )}
            {booking.easycountError && (
              <div className={styles.popupRow}>
                <label>{t(T.BOOKINGS.LABEL_EZCOUNT_ERROR)}</label>
                <span style={{ color: '#b91c1c' }}>{booking.easycountError}</span>
              </div>
            )}
            {booking.easycountDocUrl && (
              <div className={styles.popupRow}>
                <label>{t(T.BOOKINGS.LABEL_RECEIPT_LINK)}</label>
                <span>
                  <a href={booking.easycountDocUrl} target="_blank" rel="noreferrer">
                    {t(T.BOOKINGS.OPEN_PDF)}
                  </a>
                </span>
              </div>
            )}
            {(showRetry || showForceReissue) && (
              <div className={styles.popupRow} style={{ marginTop: '8px', gap: '8px', flexWrap: 'wrap' }}>
                {showRetry && (
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    disabled={issuingReceipt}
                    onClick={() => handleIssueReceipt(false)}
                  >
                    {issuingReceipt ? t(T.BOOKINGS.ISSUING_RECEIPT) : t(T.BOOKINGS.REISSUE_RECEIPT)}
                  </button>
                )}
                {showForceReissue && (
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    disabled={issuingReceipt}
                    onClick={() => {
                      if (window.confirm(t(T.BOOKINGS.FORCE_CONFIRM))) {
                        handleIssueReceipt(true);
                      }
                    }}
                  >
                    {t(T.BOOKINGS.FORCE_REISSUE)}
                  </button>
                )}
              </div>
            )}

            <HallInvoicesPanel bookingId={booking.id} isOption={booking.isOption} />

            <div className={styles.popupRow}>
              <label>{t(T.BOOKINGS.LABEL_MUSIC)}</label>
              <span>{booking.hasMusic ? t(T.COMMON.LABELS.YES) : t(T.COMMON.LABELS.NO)}</span>
            </div>
            {booking.akumApprovalCode && (
              <div className={styles.popupRow}>
                <label>{t(T.BOOKINGS.LABEL_AKUM_CODE)}</label>
                <span>{booking.akumApprovalCode}</span>
              </div>
            )}
            <div className={styles.popupRow}>
              <label>{t(T.BOOKINGS.LABEL_CONTRACT_SIGNED)}</label>
              <span>
                {booking.isContractSigned ? t(T.COMMON.LABELS.YES) : t(T.COMMON.LABELS.NO)}
              </span>
            </div>
            <div className={styles.popupRow}>
              <label>{t(T.BOOKINGS.LABEL_SECURITY_CHECK)}</label>
              <span>{booking.securityCheckStatus || dash}</span>
            </div>
            <div className={styles.popupRow}>
              <label>{t(T.BOOKINGS.LABEL_REP)}</label>
              <span>{booking.createdBy || dash}</span>
            </div>
            {booking.updatedBy && (
              <div className={styles.popupRow}>
                <label>{t(T.BOOKINGS.LABEL_UPDATED_BY)}</label>
                <span>{booking.updatedBy}</span>
              </div>
            )}
            {booking.createdAt && (
              <div className={styles.popupRow}>
                <label>{t(T.BOOKINGS.LABEL_CREATED)}</label>
                <span>{formatDateTime(booking.createdAt, locale)}</span>
              </div>
            )}
          </section>

          {(managerNotes.length > 0 || clientNotes.menu.length > 0 || clientNotes.internal.length > 0) && (
            <section className={styles.detailsSection}>
              <h3 className={styles.sectionTitle}>{t(T.BOOKINGS.NOTES)}</h3>
              {managerNotes.length > 0 && (
                <div className={styles.notesBlock}>
                  <strong>{t(T.BOOKINGS.MANAGER_NOTES)}</strong>
                  <NotesList notes={managerNotes} />
                </div>
              )}
              {clientNotes.menu.length > 0 && (
                <div className={styles.notesBlock}>
                  <strong>{t(T.BOOKINGS.MENU_NOTES)}</strong>
                  <NotesList notes={clientNotes.menu} />
                </div>
              )}
              {clientNotes.internal.length > 0 && (
                <div className={styles.notesBlock}>
                  <strong>{t(T.BOOKINGS.INTERNAL_NOTES)}</strong>
                  <NotesList notes={clientNotes.internal} />
                </div>
              )}
            </section>
          )}

          {booking.additions && booking.additions.length > 0 && (
            <section className={styles.detailsSection}>
              <h3 className={styles.sectionTitle}>{t(T.BOOKINGS.LIVE_ADDITIONS_SECTION)}</h3>
              {booking.additions.map((add: EventAdditionApi) => (
                <div key={add.id} className={styles.additionItem}>
                  <div className={styles.additionMeta}>
                    🕒 {formatDateTime(add.createdAt, locale, { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                  <div>
                    <strong>{t(T.BOOKINGS.ADDITION_DETAILS)}</strong>{' '}
                    <span>{add.description}</span>
                  </div>
                  <div>
                    <strong>{t(T.BOOKINGS.ADDITION_COST)}</strong> {money(add.cost)} (
                    {t(T.BOOKINGS.STAFF)}: {add.staffName})
                  </div>
                  {add.signature && (
                    <div className={styles.signatureBlock}>
                      <span>{t(T.BOOKINGS.CLIENT_SIGNATURE)}</span>
                      <img
                        src={add.signature}
                        alt={t(T.BOOKINGS.SIGNATURE_ALT)}
                        className={styles.signatureImg}
                      />
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          <div className={styles.detailsActions}>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={!editable}
              title={editable ? t(T.BOOKINGS.EDIT_TITLE) : t(T.BOOKINGS.EDIT_BLOCKED)}
              onClick={handleEdit}
            >
              {t(T.BOOKINGS.EDIT_BOOKING)}
            </button>

            {booking.id && (
              <>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => void openContractPdf(booking.id, t)}
                >
                  {t(T.BOOKINGS.VIEW_CONTRACT)}
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={async () => {
                    try {
                      await printContract(booking.id, t);
                    } catch (e) {
                      alert(
                        e instanceof Error ? e.message : t(T.BOOKINGS.CONTRACT_PRINT_FAILED),
                      );
                    }
                  }}
                >
                  {t(T.BOOKINGS.PRINT_CONTRACT)}
                </button>
              </>
            )}

            {booking.isContractSigned && !booking.clientSignatureUrl && (
              <p className={styles.editBlockedMsg}>{t(T.BOOKINGS.CONTRACT_SIGNED_NO_IMAGE)}</p>
            )}

            {!editable && (
              <p className={styles.editBlockedMsg}>{t(T.BOOKINGS.EDIT_BLOCKED)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingDetailsModal;
