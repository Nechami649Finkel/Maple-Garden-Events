import React from 'react';
import styles from './OptionsManager.module.css';
import OptionActionModal from '../OptionActionModal/OptionActionModal';
import NotifyOptionModal from '../NotifyOptionModal/NotifyOptionModal';
import { useBookingsQuery } from '../../hooks/queries';
import { apiFetch } from '../../services/api';
import { API_URL } from '../../config/api';
import { PageHeader } from '../ui/PageHeader';
import { Input } from '../ui/Input';
import { EmptyState } from '../ui/EmptyState';
import { PageLoader } from '../PageLoader/PageLoader';
import { calendarKeyFromDbDate } from '../../utils/dateLocal';
import { type BookingApi } from '../../utils/bookingApi';
import { useTranslation } from '../../i18n/useTranslation';
import { formatDate, formatDateTime } from '@shared/i18n/formatters';

const HEBREW_NUMERALS: Record<number, string> = {
  1: 'א', 2: 'ב', 3: 'ג', 4: 'ד', 5: 'ה', 6: 'ו', 7: 'ז', 8: 'ח', 9: 'ט', 10: 'י',
  11: 'יא', 12: 'יב', 13: 'יג', 14: 'יד', 15: 'טו', 16: 'טז', 17: 'יז', 18: 'יח', 19: 'יט', 20: 'כ',
  21: 'כא', 22: 'כב', 23: 'כג', 24: 'כד', 25: 'כה', 26: 'כו', 27: 'כז', 28: 'כח', 29: 'כט', 30: 'ל',
};

const getHebrewDateString = (dateObj: Date | null, locale: string) => {
  if (!dateObj) return '';
  try {
    const formatter = new Intl.DateTimeFormat(`${locale}-u-ca-hebrew`, {
      day: 'numeric',
      month: 'long',
    });
    const fullString = formatter.format(dateObj);
    const parts = formatter.formatToParts(dateObj);
    const dayPart = parts.find((p) => p.type === 'day')?.value;
    if (dayPart) {
      const hebLetter = HEBREW_NUMERALS[parseInt(dayPart, 10)];
      if (hebLetter) return fullString.replace(dayPart, hebLetter);
    }
    return fullString;
  } catch {
    return '';
  }
};

const OptionsManager = () => {
  const { t, T, locale } = useTranslation();
  const [search, setSearch] = React.useState('');
  const [selectedOption, setSelectedOption] = React.useState<BookingApi | null>(null);
  const [notifyOption, setNotifyOption] = React.useState<BookingApi | null>(null);

  const { data, isLoading: loading, refetch } = useBookingsQuery({
    status: 'OPTION',
    limit: 100,
    page: 1,
  });

  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const options = (data?.data ?? [])
    .filter((b) => {
      if (!b.isOption) return false;

      if (b.eventDate?.date) {
        const eventDay = new Date(b.eventDate.date);
        eventDay.setHours(0, 0, 0, 0);
        if (eventDay < today) return false;
      }

      if (!search) return true;
      return (
        b.clientAFullName?.includes(search) ||
        b.clientAIdNumber?.includes(search) ||
        b.clientBFullName?.includes(search) ||
        b.clientBIdNumber?.includes(search)
      );
    })
    .sort((a, b) => {
      const da = a.eventDate?.date ? new Date(a.eventDate.date).getTime() : 0;
      const db = b.eventDate?.date ? new Date(b.eventDate.date).getTime() : 0;
      return da - db;
    });

  const handleBump = async (bookingId: string) => {
    if (!window.confirm(t(T.OPTIONS.URGENCY_CONFIRM))) return;
    try {
      const res = await apiFetch(`${API_URL}/bookings/bump`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });
      const result = await res.json();
      if (result.success) {
        const lines = [result.message || t(T.OPTIONS.URGENCY_NOTE)];
        if (result.emailSent) lines.push(t(T.COMMON.LABELS.SENT_EMAIL));
        if (result.whatsappSent) lines.push(t(T.COMMON.LABELS.SENT_WHATSAPP));
        if (result.skippedReasons?.length) {
          lines.push('', t(T.OPTIONS.URGENCY_NOTE));
          lines.push(...result.skippedReasons);
        }
        alert(lines.join('\n'));
        refetch();
      } else {
        alert(result.message);
      }
    } catch {
      alert(t(T.OPTIONS.URGENCY_ERROR));
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className={styles.container}>
      <PageHeader title={t(T.OPTIONS.MANAGER_TITLE)} subtitle={t(T.OPTIONS.MANAGER_SUBTITLE)} />

      <Input
        fieldClassName={styles.searchInput}
        placeholder={t(T.OPTIONS.SEARCH_PLACEHOLDER)}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {options.length === 0 ? (
        <EmptyState
          icon="⏳"
          title={search ? t(T.OPTIONS.EMPTY_SEARCH) : t(T.OPTIONS.EMPTY_TITLE)}
          message={search ? t(T.BOOKINGS.SEARCH_HINT) : t(T.OPTIONS.EMPTY_DEFAULT)}
        />
      ) : (
        <div className={styles.grid}>
          {options.map((option) => {
            const dateObj = option.eventDate?.date ? new Date(option.eventDate.date) : null;
            const eventDateStr = dateObj ? formatDate(dateObj, locale) : '';
            const hebrewDateStr = getHebrewDateString(dateObj, locale);
            const expiresAtStr = option.eventDate?.optionExpiresAt
              ? formatDateTime(option.eventDate.optionExpiresAt, locale)
              : t(T.OPTIONS.NOT_DEFINED);

            return (
              <div key={option.id} className={styles.card} onClick={() => setSelectedOption(option)}>
                <div className={styles.cardContent}>
                  <div>
                    <h3 className={styles.eventDateText}>
                      {t(T.OPTIONS.EVENT_DATE)}: <strong>{eventDateStr}</strong>{' '}
                      {hebrewDateStr && (
                        <span style={{ color: '#d97706', fontSize: '0.95rem' }}>({hebrewDateStr})</span>
                      )}
                    </h3>
                    <p className={styles.clientText}>
                      {t(T.OPTIONS.CLIENT_LINE, {
                        name: option.clientAFullName,
                        phone: option.clientAPhone,
                      })}
                    </p>
                    <p className={styles.expiryText}>
                      {t(T.OPTIONS.EXPIRES_AT)}: {expiresAtStr}
                    </p>
                  </div>
                  <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setNotifyOption(option)}
                      className={`${styles.btn} ${styles.notifyBtn}`}
                    >
                      {t(T.OPTIONS.SEND_INTEREST)}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBump(option.id)}
                      className={`${styles.btn} ${styles.bumpBtn}`}
                    >
                      {t(T.OPTIONS.NUDGE_CLIENT)} ⏱️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedOption && (
        <OptionActionModal
          option={selectedOption}
          onClose={() => setSelectedOption(null)}
          onSuccess={() => {
            setSelectedOption(null);
            refetch();
          }}
        />
      )}

      {notifyOption && (
        <NotifyOptionModal
          booking={notifyOption}
          eventDateStr={
            notifyOption.eventDate?.date
              ? calendarKeyFromDbDate(new Date(notifyOption.eventDate.date))
              : ''
          }
          onClose={() => setNotifyOption(null)}
        />
      )}
    </div>
  );
};

export default OptionsManager;
