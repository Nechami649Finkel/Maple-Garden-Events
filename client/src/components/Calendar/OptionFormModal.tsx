import { createPortal } from 'react-dom';
import React, { Suspense } from 'react';
import { PageLoader } from '../PageLoader/PageLoader';

const BookingForm = React.lazy(() => import('../BookingForm/BookingForm'));
import { useTranslation } from '../../i18n/useTranslation';
import { formatDate } from '@shared/i18n/formatters';
import styles from './OptionFormModal.module.css';

interface OptionFormModalProps {
  date: string;
  hebrewDate?: string;
  onClose: () => void;
}

export function OptionFormModal({
  date,
  hebrewDate = '',
  onClose,
}: OptionFormModalProps) {
  const { t, T, locale } = useTranslation();
  const dateDisplay = formatDate(date, locale);

  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t(T.CALENDAR.OPEN_OPTION)}
      >
        <header className={styles.header}>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t(T.COMMON.ACTIONS.CLOSE)}
          >
            ✕
          </button>
          <div className={styles.headerText}>
            <h2>{t(T.CALENDAR.OPEN_OPTION)}</h2>
            <p>
              {dateDisplay}
              {hebrewDate ? ` · ${hebrewDate}` : ''}
            </p>
          </div>
        </header>
        <div className={styles.body}>
          <Suspense fallback={<PageLoader />}>
            <BookingForm
              initialDates={[{ date, hebrewDate }]}
              isOption
            />
          </Suspense>
        </div>
      </div>
    </div>,
    document.body,
  );
}
