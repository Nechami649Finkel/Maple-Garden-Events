import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import EventCheckInBoard, {
  type CheckInFormData,
  type ReserveTableRow,
} from './EventCheckInBoard';
import { API_URL } from '../../config/api';
import { useTranslation } from '../../i18n/useTranslation';
import { secureFetch } from '../../services/api';
import { useCheckInQuery } from '../../hooks/queries';
import {
  enqueueCheckIn,
  getPendingCheckInCount,
} from '../../utils/offlineCheckInQueue';
import styles from './LiveEvent.module.css';

interface EventCheckInModalProps {
  bookingId: string;
  dateDisplay: string;
  readOnly?: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

function normalizeReserveTables(raw: unknown): ReserveTableRow[] {
  const arr = Array.isArray(raw) ? raw : [];
  const byNumber = new Map<number, ReserveTableRow>();

  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const number = Number(row.number);
    if (!number) continue;
    byNumber.set(number, {
      number,
      value: String(row.value ?? (row.confirmed ? '✓' : '')),
    });
  }

  return [1, 2, 3, 4, 5].map((n) => byNumber.get(n) ?? { number: n, value: '' });
}

function splitSpecialAdditions(text: string): { line1: string; line2: string } {
  const parts = text.split('\n');
  return { line1: parts[0] ?? '', line2: parts[1] ?? '' };
}

function toFormData(checkIn: Record<string, unknown>): CheckInFormData {
  const special = splitSpecialAdditions(String(checkIn.specialAdditions || ''));
  return {
    familiesLabel: String(checkIn.familiesLabel || ''),
    orderedPortions:
      checkIn.orderedPortions != null ? Number(checkIn.orderedPortions) : '',
    entertainerPortions:
      checkIn.entertainerPortions != null ? Number(checkIn.entertainerPortions) : '',
    reservePortions:
      checkIn.reservePortions != null ? Number(checkIn.reservePortions) : '',
    reserveTables: normalizeReserveTables(checkIn.reserveTables),
    specialAdditionLine1: special.line1,
    specialAdditionLine2: special.line2,
    customerSignature: (checkIn.customerSignature as string | null) || null,
  };
}

const EventCheckInModal: React.FC<EventCheckInModalProps> = ({
  bookingId,
  dateDisplay,
  readOnly = false,
  onClose,
  onSaved,
}) => {
  const queryClient = useQueryClient();
  const { t, T } = useTranslation();
  const { data, isLoading, error: queryError } = useCheckInQuery(bookingId);
  const [pendingQueueCount, setPendingQueueCount] = useState(getPendingCheckInCount());

  const formData = useMemo(() => {
    if (!data?.checkIn) return null;
    return toFormData(data.checkIn);
  }, [data]);

  const error =
    queryError instanceof Error
      ? queryError.message
      : queryError
        ? t(T.LIVE_EVENT.FORM_LOAD_ERROR)
        : '';

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const refreshPending = () => setPendingQueueCount(getPendingCheckInCount());
    window.addEventListener('online', refreshPending);
    return () => window.removeEventListener('online', refreshPending);
  }, []);

  const handleSave = async (form: CheckInFormData) => {
    const specialAdditions = [form.specialAdditionLine1, form.specialAdditionLine2]
      .filter(Boolean)
      .join('\n');

    const payload = {
      familiesLabel: form.familiesLabel,
      orderedPortions: form.orderedPortions === '' ? null : form.orderedPortions,
      entertainerPortions: form.entertainerPortions === '' ? null : form.entertainerPortions,
      reservePortions: form.reservePortions === '' ? null : form.reservePortions,
      reserveTables: form.reserveTables,
      specialAdditions,
      customerSignature: form.customerSignature,
    };

    try {
      const response = await secureFetch(`${API_URL}/check-in/${bookingId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await response.json();
      if (response.ok && res.success) {
        await queryClient.invalidateQueries({ queryKey: ['check-in', bookingId] });
        alert(t(T.LIVE_EVENT.FORM_SAVED));
        onSaved?.();
        onClose();
        return;
      }
      alert(res.error || t(T.UI.SAVE_ERROR));
    } catch {
      enqueueCheckIn(bookingId, payload);
      setPendingQueueCount(getPendingCheckInCount());
      alert(t(T.LIVE_EVENT.OFFLINE_SAVED));
      onSaved?.();
      onClose();
    }
  };

  return createPortal(
    <div className={styles.checkInModalOverlay} onClick={onClose}>
      <div className={styles.checkInModalBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.checkInModalHeader}>
          <h2>
            {t(T.LIVE_EVENT.FORM_TITLE, {
              readOnly: readOnly ? t(T.LIVE_EVENT.READ_ONLY_SUFFIX) : '',
            })}
          </h2>
          {pendingQueueCount > 0 && (
            <span className={styles.checkInPendingBadge}>
              {t(T.LIVE_EVENT.PENDING_SYNC, { count: pendingQueueCount })}
            </span>
          )}
          <button
            type="button"
            className={styles.checkInModalClose}
            onClick={onClose}
            aria-label={t(T.UI.CLOSE)}
          >
            ✕
          </button>
        </div>

        {isLoading && <div className={styles.checkInLoading}>{t(T.LIVE_EVENT.FORM_LOADING)}</div>}
        {error && <div className={styles.checkInError}>{error}</div>}
        {!isLoading && !error && formData && (
          <EventCheckInBoard
            dateDisplay={dateDisplay}
            initialData={formData}
            readOnly={readOnly}
            onSave={handleSave}
            onCancel={onClose}
          />
        )}
      </div>
    </div>,
    document.body,
  );
};

export default EventCheckInModal;
