import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { API_URL } from '../../config/api';
import { useTranslation } from '../../i18n/useTranslation';
import { formatDate, formatCurrency } from '@shared/i18n/formatters';
import {
  EVENT_TYPE_KEY_BY_VALUE,
  translateByValue,
} from '@shared/i18n/bookingLookups';
import { formatTimeOfDayDisplay } from '../../utils/timeSlot';
import { T, type TranslationKey } from '@shared/i18n/keys';
import styles from './OptionActionModal.module.css';
import { type BookingApi } from '../../utils/bookingApi';

interface Props {
  option: BookingApi;
  onClose: () => void;
  onSuccess: () => void;
}

const CANCEL_REASON_VALUES = [
  'יקר מדי',
  'תאריך לא הסתדר',
  'סגרו באולם אחר',
  'ביטול האירוע לחלוטין',
  'חוסר הסכמה על תנאים',
  'אחר',
] as const;

const CANCEL_REASON_KEY_BY_VALUE: Record<string, TranslationKey> = {
  'יקר מדי': T.OPTIONS.REASON_TOO_EXPENSIVE,
  'תאריך לא הסתדר': T.OPTIONS.REASON_DATE,
  'סגרו באולם אחר': T.OPTIONS.REASON_OTHER_VENUE,
  'ביטול האירוע לחלוטין': T.OPTIONS.REASON_EVENT_CANCELLED,
  'חוסר הסכמה על תנאים': T.OPTIONS.REASON_TERMS,
  אחר: T.OPTIONS.REASON_OTHER,
};

const OptionActionModal = ({ option, onClose, onSuccess }: Props) => {
  const navigate = useNavigate();
  const { t, T, locale } = useTranslation();
  const [step, setStep] = useState<'choose' | 'cancelReason'>('choose');
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const money = (value?: number | null) => formatCurrency(Number(value ?? 0), locale);
  const formatEventType = (value: string) => translateByValue(t, EVENT_TYPE_KEY_BY_VALUE, value);

  const eventDateStr = option.eventDate?.date
    ? formatDate(option.eventDate.date, locale)
    : '';

  const handleConvertToBooking = () => {
    onClose();
    navigate(`/booking/close-option/${option.id}`);
  };

  const handleConfirmCancel = async () => {
    if (!cancelReason) {
      alert(t(T.OPTIONS.CANCEL_REASON_REQUIRED));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/bookings/release`, {
        method: 'POST',
        body: JSON.stringify({
          dateIds: [option.calendarDateId],
          cancelReason,
          clientName: option.clientAFullName,
        }),
      });
      const result = await res.json();
      if (result.success) {
        alert(t(T.OPTIONS.CANCEL_SUCCESS));
        onSuccess();
      } else {
        alert(result.message);
      }
    } catch {
      alert(t(T.COMMON.ERRORS.CONNECTION));
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalTitle =
    step === 'choose' ? t(T.OPTIONS.MODAL_TITLE) : t(T.OPTIONS.MODAL_ACTION_TITLE);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span>
            {modalTitle} - {option.clientAFullName}
          </span>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t(T.COMMON.ACTIONS.CLOSE)}
          >
            ×
          </button>
        </div>

        {step === 'choose' && (
          <div className={styles.body}>
            <div className={styles.infoBox}>
              <div className={styles.infoRow}>
                <label>{t(T.UI.LABEL_DATE)}</label>
                <span>{eventDateStr}</span>
              </div>
              <div className={styles.infoRow}>
                <label>{t(T.BOOKINGS.LABEL_EVENT_TYPE)}</label>
                <span>{formatEventType(option.eventType)}</span>
              </div>
              <div className={styles.infoRow}>
                <label>{t(T.BOOKINGS.TIME)}</label>
                <span>{formatTimeOfDayDisplay(t, option.timeOfDay)}</span>
              </div>
              <div className={styles.infoRow}>
                <label>{t(T.BOOKINGS.LABEL_GUESTS)}</label>
                <span>{option.guestCount}</span>
              </div>
              <div className={styles.infoRow}>
                <label>{t(T.BOOKINGS.LABEL_BASE_PAYMENT)}</label>
                <span>{money(option.basePrice ?? option.totalPrice)}</span>
              </div>
              {(option.extrasPrice ?? 0) > 0 && (
                <div className={styles.infoRow}>
                  <label>{t(T.BOOKINGS.LABEL_HALL_EXTRAS)}</label>
                  <span>{money(option.extrasPrice)}</span>
                </div>
              )}
              {(option.externalExtrasPrice ?? 0) > 0 && (
                <div className={styles.infoRow}>
                  <label>{t(T.BOOKINGS.LABEL_EXTERNAL_SUPPLIERS)}</label>
                  <span>{money(option.externalExtrasPrice)}</span>
                </div>
              )}
              <div className={styles.infoRow}>
                <label>{t(T.BOOKINGS.LABEL_HALL_TOTAL)}</label>
                <span style={{ fontWeight: 'bold' }}>{money(option.totalPrice)}</span>
              </div>
              <div className={styles.infoRow}>
                <label>{t(T.UI.LABEL_PHONE)}</label>
                <span>{option.clientAPhone}</span>
              </div>
            </div>
            <p className={styles.question}>{t(T.OPTIONS.MODAL_TITLE_ACTION)}</p>
            <div className={styles.actionButtons}>
              <button type="button" className={styles.finalizeBtn} onClick={handleConvertToBooking}>
                {t(T.OPTIONS.CONVERT_TO_BOOKING)}
              </button>
              <button
                type="button"
                className={styles.cancelOptionBtn}
                onClick={() => setStep('cancelReason')}
              >
                {t(T.OPTIONS.CANCEL_AND_RELEASE)}
              </button>
            </div>
          </div>
        )}

        {step === 'cancelReason' && (
          <div className={styles.body}>
            <p className={styles.question} style={{ color: '#dc2626' }}>
              {t(T.OPTIONS.CANCEL_WARNING)}
            </p>
            <div className={styles.inputGroup} style={{ marginTop: '10px' }}>
              <label className={styles.inputLabel}>{t(T.OPTIONS.CHOOSE_REASON)}</label>
              <select
                className={styles.input}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                <option value="">{t(T.OPTIONS.CHOOSE_REASON)}</option>
                {CANCEL_REASON_VALUES.map((reason) => (
                  <option key={reason} value={reason}>
                    {translateByValue(t, CANCEL_REASON_KEY_BY_VALUE, reason)}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.footer} style={{ marginTop: '20px', padding: '0', border: 'none' }}>
              <button type="button" className={styles.backBtn} onClick={() => setStep('choose')}>
                {t(T.COMMON.ACTIONS.BACK)}
              </button>
              <button
                type="button"
                className={styles.submitBtn}
                style={{ background: '#dc2626' }}
                disabled={isSubmitting || !cancelReason}
                onClick={handleConfirmCancel}
              >
                {isSubmitting ? t(T.OPTIONS.CANCELLING) : t(T.OPTIONS.CONFIRM_CANCEL)}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OptionActionModal;
