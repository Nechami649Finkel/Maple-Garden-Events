import { useMemo, useState } from 'react';
import { apiFetch } from '../../services/api';
import { API_URL } from '../../config/api';
import { useTranslation } from '../../i18n/useTranslation';
import { formatDate } from '@shared/i18n/formatters';
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

export function buildDefaultOptionInterestMessage(
  translate: (key: string, params?: Record<string, string | number>) => string,
  defaultKey: string,
  clientName: string,
  eventDateStr: string,
  locale: string,
): string {
  const dateDisplay = eventDateStr.includes('-')
    ? formatDate(eventDateStr, locale as 'he' | 'en')
    : formatDate(new Date(eventDateStr), locale as 'he' | 'en');
  return translate(defaultKey, { clientName, dateStr: dateDisplay });
}

const NotifyOptionModal = ({ booking, eventDateStr, onClose, onSuccess }: Props) => {
  const { t, T, locale } = useTranslation();

  const defaultMessage = useMemo(
    () =>
      buildDefaultOptionInterestMessage(
        t as (key: string, params?: Record<string, string | number>) => string,
        T.OPTIONS.INTEREST_MESSAGE_DEFAULT,
        booking.clientAFullName || t(T.COMMON.LABELS.UNKNOWN_CLIENT),
        eventDateStr,
        locale,
      ),
    [booking.clientAFullName, eventDateStr, t, T, locale],
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
    ? formatDate(eventDateStr, locale)
    : formatDate(new Date(eventDateStr), locale);

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
        alert(
          res.status === 404
            ? t(T.OPTIONS.NOTIFY_UNKNOWN_ACTION)
            : t(T.OPTIONS.NOTIFY_SERVER_STATUS, { status: String(res.status) }),
        );
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
          ? `${data.message || t(T.OPTIONS.NOTIFY_SEND_ERROR)}\n\n${data.skippedReasons.join('\n')}`
          : data.message || t(T.OPTIONS.NOTIFY_SEND_ERROR);
        alert(details);
      }
    } catch {
      alert(t(T.OPTIONS.NOTIFY_NETWORK_ERROR));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resultLines: string[] = [];
  if (result) {
    if (result.emailSent) resultLines.push(t(T.COMMON.LABELS.SENT_EMAIL));
    if (result.whatsappSent) resultLines.push(t(T.COMMON.LABELS.SENT_WHATSAPP));
    if (result.skippedReasons?.length) {
      resultLines.push(...result.skippedReasons);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span>{t(T.OPTIONS.NOTIFY_TITLE)}</span>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t(T.COMMON.ACTIONS.CLOSE)}
          >
            ×
          </button>
        </div>

        <div className={styles.body}>
          <p className={styles.infoRow}>
            <strong>{t(T.OPTIONS.NOTIFY_CLIENT)}:</strong>{' '}
            {booking.clientAFullName || t(T.UI.UNKNOWN)}
          </p>
          <p className={styles.infoRow}>
            <strong>{t(T.OPTIONS.NOTIFY_DATE)}:</strong> {dateDisplay}
          </p>
          {(booking.clientAEmail || booking.clientAPhone) && (
            <p className={styles.infoRow}>
              {booking.clientAEmail && (
                <span>
                  {t(T.OPTIONS.NOTIFY_EMAIL)}: {booking.clientAEmail}{' '}
                </span>
              )}
              {booking.clientAPhone && (
                <span>
                  | {t(T.OPTIONS.NOTIFY_PHONE)}: {booking.clientAPhone.split(' | ')[0]}
                </span>
              )}
            </p>
          )}

          <label className={styles.label} htmlFor="notify-option-message">
            {t(T.OPTIONS.NOTIFY_MESSAGE_LABEL)}
          </label>
          <textarea
            id="notify-option-message"
            className={styles.textarea}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isSubmitting || !!result}
          />
          <p className={styles.hint}>{t(T.OPTIONS.NOTIFY_HELP)}</p>

          {result && (
            <div
              className={`${styles.resultBox} ${result.skippedReasons?.length ? styles.resultBoxPartial : ''}`}
            >
              {resultLines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            {result ? t(T.COMMON.ACTIONS.CLOSE) : t(T.COMMON.ACTIONS.CANCEL)}
          </button>
          {!result && (
            <button
              type="button"
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={isSubmitting || !message.trim()}
            >
              {isSubmitting ? t(T.OPTIONS.NOTIFY_SENDING) : t(T.OPTIONS.NOTIFY_SEND)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotifyOptionModal;
