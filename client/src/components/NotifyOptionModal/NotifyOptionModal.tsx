import { useMemo, useState } from 'react';
import { apiFetch } from '../../services/api';
import { API_URL } from '../../config/api';
import { buildDefaultOptionInterestMessage } from '../../utils/notifyOptionMessage';
import styles from './NotifyOptionModal.module.css';

interface Props {
  booking: {
    id: string;
    clientAFullName?: string;
    clientAEmail?: string;
    clientAPhone?: string;
  };
  eventDateStr: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const NotifyOptionModal = ({ booking, eventDateStr, onClose, onSuccess }: Props) => {
  const defaultMessage = useMemo(
    () => buildDefaultOptionInterestMessage(booking.clientAFullName || 'לקוח/ה', eventDateStr),
    [booking.clientAFullName, eventDateStr],
  );

  const [message, setMessage] = useState(defaultMessage);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    emailSent: boolean;
    whatsappSent: boolean;
    whatsappSimulated?: boolean;
    skippedReasons?: string[];
  } | null>(null);

  const dateDisplay = eventDateStr.includes('-')
    ? eventDateStr.split('-').reverse().join('/')
    : new Date(eventDateStr).toLocaleDateString('he-IL');

  const handleSend = async () => {
    if (!booking.id || isSubmitting) return;
    setIsSubmitting(true);
    setResult(null);

    try {
      const res = await apiFetch(`${API_URL}/bookings/notify-option-interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, message }),
      });

      let data: {
        success?: boolean;
        message?: string;
        emailSent?: boolean;
        whatsappSent?: boolean;
        whatsappSimulated?: boolean;
        skippedReasons?: string[];
      };
      try {
        data = await res.json();
      } catch {
        alert(res.status === 404
          ? 'השרת לא מכיר את הפעולה — נסי להפעיל מחדש את השרת (npm run dev בתיקיית server).'
          : `שגיאת תקשורת עם השרת (קוד ${res.status}).`);
        return;
      }

      if (data.success) {
        setResult({
          emailSent: !!data.emailSent,
          whatsappSent: !!data.whatsappSent,
          whatsappSimulated: data.whatsappSimulated,
          skippedReasons: data.skippedReasons,
        });
        onSuccess?.();
      } else {
        const details = data.skippedReasons?.length
          ? `${data.message || 'שגיאה בשליחת ההודעה.'}\n\n${data.skippedReasons.join('\n')}`
          : (data.message || 'שגיאה בשליחת ההודעה.');
        alert(details);
      }
    } catch {
      alert('שגיאת תקשורת עם השרת.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resultLines: string[] = [];
  if (result) {
    if (result.emailSent) resultLines.push('נשלח במייל ✓');
    if (result.whatsappSent) resultLines.push('נשלח בוואטסאפ ✓');
    if (result.skippedReasons?.length) {
      resultLines.push(...result.skippedReasons);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span>הקפצת הודעה ללקוח</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="סגירה">
            ×
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.infoRow}>
            <strong>לקוח:</strong> {booking.clientAFullName || 'לא ידוע'}
          </p>
          <p className={styles.infoRow}>
            <strong>תאריך:</strong> {dateDisplay}
          </p>
          {(booking.clientAEmail || booking.clientAPhone) && (
            <p className={styles.infoRow}>
              {booking.clientAEmail && <span>מייל: {booking.clientAEmail} </span>}
              {booking.clientAPhone && <span>| טלפון: {booking.clientAPhone.split(' | ')[0]}</span>}
            </p>
          )}

          <label className={styles.label} htmlFor="notify-option-message">
            תוכן ההודעה (ניתן לערוך)
          </label>
          <textarea
            id="notify-option-message"
            className={styles.textarea}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isSubmitting || !!result}
          />
          <p className={styles.hint}>
            ההודעה תישלח במייל. אם מוגדר Green API ולמספר יש וואטסאפ — תישלח גם שם.
          </p>

          {result && (
            <div className={`${styles.resultBox} ${result.skippedReasons?.length ? styles.resultBoxPartial : ''}`}>
              {resultLines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            {result ? 'סגור' : 'ביטול'}
          </button>
          {!result && (
            <button
              type="button"
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={isSubmitting || !message.trim()}
            >
              {isSubmitting ? 'שולח...' : 'שלח הודעה'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotifyOptionModal;
