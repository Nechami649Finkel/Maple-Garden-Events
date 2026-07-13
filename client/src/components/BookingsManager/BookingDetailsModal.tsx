import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { calendarKeyFromDbDate } from '../../utils/dateLocal';
import { formatTimeOfDayDisplay } from '../../utils/timeSlot';
import { parseNotes, parseNotesBundle } from '../../utils/notesStorage';
import { openContractPdf, printContract } from '../../utils/contractPrint';
import {
  canForceReissueEasyCountReceipt,
  canRetryEasyCountReceipt,
  formatEasyCountStatusLabel,
} from '../../utils/easycount';
import { apiFetch } from '../../services/api';
import { API_URL } from '../../config/api';
import { canEditBooking } from '../../utils/bookingEdit';
import { NotesList } from '../NotesList/NotesList';
import HallInvoicesPanel from './HallInvoicesPanel';
import styles from './BookingsManager.module.css';

interface BookingDetailsModalProps {
  booking: any;
  onClose: () => void;
  onBookingUpdated?: (booking: any) => void;
}

const BookingDetailsModal = ({ booking, onClose, onBookingUpdated }: BookingDetailsModalProps) => {
  const navigate = useNavigate();
  const [issuingReceipt, setIssuingReceipt] = useState(false);

  const eventDateStr = booking.eventDate?.date
    ? calendarKeyFromDbDate(new Date(booking.eventDate.date))
    : '';
  const dateDisplay = booking.eventDate?.date
    ? new Date(booking.eventDate.date).toLocaleDateString('he-IL')
    : '';
  const editable = eventDateStr ? canEditBooking(eventDateStr) : false;
  const isWedding = booking.eventType === 'חתונה';
  const isHallOnly = booking.eventType === 'השכרת אולם בלי אוכל';
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
      alert(json.message || (json.success ? 'קבלה הופקה בהצלחה' : 'שגיאה בהפקת קבלה'));
      if (json.success && json.data && onBookingUpdated) {
        onBookingUpdated(json.data);
      }
    } catch {
      alert('שגיאת תקשורת עם השרת');
    } finally {
      setIssuingReceipt(false);
    }
  };

  return (
    <div className={styles.popupOverlay} onClick={onClose}>
      <div className={`${styles.popupBox} ${styles.detailsBox}`} onClick={e => e.stopPropagation()}>
        <div className={styles.popupHeader}>
          <span>
            פרטי הזמנה
            {booking.eventCode && ` #${booking.eventCode}`}
            {dateDisplay && ` · ${dateDisplay}`}
          </span>
          <button type="button" className={styles.popupClose} onClick={onClose}>✕</button>
        </div>

        <div className={styles.popupBody}>
          <section className={styles.detailsSection}>
            <h3 className={styles.sectionTitle}>פרטי האירוע</h3>
            <div className={styles.popupRow}><label>קוד אירוע:</label><span>{booking.eventCode || '—'}</span></div>
            <div className={styles.popupRow}><label>תאריך:</label><span>{dateDisplay || '—'}</span></div>
            <div className={styles.popupRow}><label>סוג אירוע:</label><span>{booking.eventType || '—'}</span></div>
            <div className={styles.popupRow}><label>מועד:</label><span>{formatTimeOfDayDisplay(booking.timeOfDay)}</span></div>
            {booking.leadSource && (
              <div className={styles.popupRow}><label>מקור ליד:</label><span>{booking.leadSource}</span></div>
            )}
          </section>

          <section className={styles.detailsSection}>
            <h3 className={styles.sectionTitle}>צד א'</h3>
            <div className={styles.popupRow}><label>שם:</label><span>{booking.clientAFullName || '—'}</span></div>
            <div className={styles.popupRow}><label>ת.ז:</label><span>{booking.clientAIdNumber || '—'}</span></div>
            <div className={styles.popupRow}><label>טלפון:</label><span>{booking.clientAPhone || '—'}</span></div>
            <div className={styles.popupRow}><label>אימייל:</label><span>{booking.clientAEmail || '—'}</span></div>
            <div className={styles.popupRow}><label>כתובת:</label><span>{booking.clientAAddress || '—'}</span></div>
          </section>

          {(isWedding || booking.clientBFullName) && (
            <section className={styles.detailsSection}>
              <h3 className={styles.sectionTitle}>צד ב'</h3>
              <div className={styles.popupRow}><label>שם:</label><span>{booking.clientBFullName || '—'}</span></div>
              <div className={styles.popupRow}><label>ת.ז:</label><span>{booking.clientBIdNumber || '—'}</span></div>
              <div className={styles.popupRow}><label>טלפון:</label><span>{booking.clientBPhone || '—'}</span></div>
              <div className={styles.popupRow}><label>אימייל:</label><span>{booking.clientBEmail || '—'}</span></div>
              <div className={styles.popupRow}><label>כתובת:</label><span>{booking.clientBAddress || '—'}</span></div>
            </section>
          )}

          <section className={styles.detailsSection}>
            <h3 className={styles.sectionTitle}>פרטי עסקה</h3>
            {isHallOnly ? (
              <div className={styles.popupRow}>
                <label>מחיר השכרה:</label>
                <span>₪{booking.hallRentalPrice?.toLocaleString() || 0}</span>
              </div>
            ) : (
              <>
                <div className={styles.popupRow}><label>מוזמנים:</label><span>{booking.guestCount ?? '—'}</span></div>
                <div className={styles.popupRow}><label>מחיר מנה:</label><span>₪{booking.finalPricePortion ?? 0}</span></div>
              </>
            )}
            <div className={styles.popupRow}>
              <label>תשלום בסיסי:</label>
              <span>₪{(booking.basePrice ?? booking.totalPrice)?.toLocaleString() ?? 0}</span>
            </div>
            {(booking.extrasPrice ?? 0) > 0 && (
              <div className={styles.popupRow}>
                <label>תוספות לאולם:</label>
                <span>₪{booking.extrasPrice?.toLocaleString() ?? 0}</span>
              </div>
            )}
            {(booking.externalExtrasPrice ?? 0) > 0 && (
              <div className={styles.popupRow}>
                <label>ספקים חיצוניים (לידיעה):</label>
                <span>₪{booking.externalExtrasPrice?.toLocaleString() ?? 0}</span>
              </div>
            )}
            {(booking.liveAdditionsTotal ?? 0) > 0 && (
              <div className={styles.popupRow}>
                <label>תוספות בזמן האירוע:</label>
                <span>₪{booking.liveAdditionsTotal?.toLocaleString() ?? 0}</span>
              </div>
            )}
            <div className={styles.popupRow}>
              <label>סה&quot;כ חשבון לאולם:</label>
              <span className={styles.totalPrice}>₪{booking.totalPrice?.toLocaleString() ?? 0}</span>
            </div>
            <div className={styles.popupRow}><label>שולם:</label><span>₪{booking.paidAmount?.toLocaleString() ?? 0}</span></div>
            {booking.advancePaid > 0 && (
              <div className={styles.popupRow}><label>מקדמה:</label><span>₪{booking.advancePaid?.toLocaleString()}</span></div>
            )}
            {booking.totalPaid > 0 && (
              <div className={styles.popupRow}><label>סה"כ שולם:</label><span>₪{booking.totalPaid?.toLocaleString()}</span></div>
            )}
            <div className={styles.popupRow}><label>סטטוס תשלום:</label><span>{booking.paymentStatus || '—'}</span></div>
            {booking.depositMethod && (
              <div className={styles.popupRow}>
                <label>אמצעי תשלום מקדמה:</label>
                <span>
                  {booking.depositMethod === 'credit_card'
                    ? 'אשראי / מזומן'
                    : booking.depositMethod === 'check_capture'
                      ? "צ'ק (צילום)"
                      : booking.depositMethod === 'check_upload'
                        ? "צ'ק (העלאה)"
                        : booking.depositMethod}
                </span>
              </div>
            )}
            {(booking.advancePaid ?? 0) > 0 && (
              <div className={styles.popupRow}>
                <label>EZCount:</label>
                <span>{formatEasyCountStatusLabel(booking.easycountStatus)}</span>
              </div>
            )}
            {booking.easycountDocId && (
              <div className={styles.popupRow}>
                <label>מזהה קבלה:</label>
                <span>{booking.easycountDocId}</span>
              </div>
            )}
            {booking.easycountError && (
              <div className={styles.popupRow}>
                <label>שגיאת EZCount:</label>
                <span style={{ color: '#b91c1c' }}>{booking.easycountError}</span>
              </div>
            )}
            {booking.easycountDocUrl && (
              <div className={styles.popupRow}>
                <label>קישור קבלה:</label>
                <span>
                  <a href={booking.easycountDocUrl} target="_blank" rel="noreferrer">פתיחת PDF</a>
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
                    {issuingReceipt ? 'מפיקה קבלה...' : 'הפק/י קבלה מחדש'}
                  </button>
                )}
                {showForceReissue && (
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    disabled={issuingReceipt}
                    onClick={() => {
                      if (window.confirm('להפיק קבלה חדשה? פעולה זו מתאימה למעבר מסימולציה ל-EZCount אמיתי.')) {
                        handleIssueReceipt(true);
                      }
                    }}
                  >
                    הפקה מחדש (Force)
                  </button>
                )}
              </div>
            )}

            <HallInvoicesPanel bookingId={booking.id} isOption={booking.isOption} />

            <div className={styles.popupRow}><label>מוזיקה:</label><span>{booking.hasMusic ? 'כן' : 'לא'}</span></div>
            {booking.akumApprovalCode && (
              <div className={styles.popupRow}><label>קוד ע.ח:</label><span>{booking.akumApprovalCode}</span></div>
            )}
            <div className={styles.popupRow}><label>חוזה נחתם:</label><span>{booking.isContractSigned ? 'כן' : 'לא'}</span></div>
            <div className={styles.popupRow}><label>בדיקת אבטחה:</label><span>{booking.securityCheckStatus || '—'}</span></div>
            <div className={styles.popupRow}><label>נציג:</label><span>{booking.createdBy || '—'}</span></div>
            {booking.updatedBy && (
              <div className={styles.popupRow}><label>עודכן ע"י:</label><span>{booking.updatedBy}</span></div>
            )}
            {booking.createdAt && (
              <div className={styles.popupRow}>
                <label>נוצר:</label>
                <span>{new Date(booking.createdAt).toLocaleString('he-IL')}</span>
              </div>
            )}
          </section>

          {(managerNotes.length > 0 || clientNotes.menu.length > 0 || clientNotes.internal.length > 0) && (
            <section className={styles.detailsSection}>
              <h3 className={styles.sectionTitle}>הערות</h3>
              {managerNotes.length > 0 && (
                <div className={styles.notesBlock}>
                  <strong>הערות מנהל:</strong>
                  <NotesList notes={managerNotes} />
                </div>
              )}
              {clientNotes.menu.length > 0 && (
                <div className={styles.notesBlock}>
                  <strong>הערות לתפריט:</strong>
                  <NotesList notes={clientNotes.menu} />
                </div>
              )}
              {clientNotes.internal.length > 0 && (
                <div className={styles.notesBlock}>
                  <strong>הערות פנימיות:</strong>
                  <NotesList notes={clientNotes.internal} />
                </div>
              )}
            </section>
          )}

          {booking.additions?.length > 0 && (
            <section className={styles.detailsSection}>
              <h3 className={styles.sectionTitle}>תוספות במהלך האירוע</h3>
              {booking.additions.map((add: any) => (
                <div key={add.id} className={styles.additionItem}>
                  <div className={styles.additionMeta}>
                    🕒 {new Date(add.createdAt).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                  <div><strong>פירוט:</strong> <span>{add.description}</span></div>
                  <div><strong>עלות:</strong> ₪{add.cost} (אחראי: {add.staffName})</div>
                  {add.signature && (
                    <div className={styles.signatureBlock}>
                      <span>חתימת לקוח:</span>
                      <img src={add.signature} alt="חתימת לקוח" className={styles.signatureImg} />
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
              title={editable ? 'עריכת פרטי ההזמנה' : 'לא ניתן לערוך ביום האירוע או לאחריו'}
              onClick={handleEdit}
            >
              עריכת פרטי ההזמנה
            </button>

            {booking.id && (
              <>
                <button type="button" className={styles.btnSecondary} onClick={() => void openContractPdf(booking.id)}>
                  צפייה בחוזה
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
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
              <p className={styles.editBlockedMsg}>
                החוזה מסומן כחתום, אך תמונת החתימה חסרה. יש לחתום מחדש בעריכת ההזמנה.
              </p>
            )}

            {!editable && (
              <p className={styles.editBlockedMsg}>לא ניתן לערוך ביום האירוע או לאחריו</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingDetailsModal;
