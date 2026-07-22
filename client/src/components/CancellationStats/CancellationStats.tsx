import { useMemo, useState } from 'react';
import styles from './CancellationStats.module.css';
import { useCancellationStatsQuery } from '../../hooks/queries';
import { useTranslation } from '../../i18n/useTranslation';
import { T, type TranslationKey } from '@shared/i18n/keys';
import { translateByValue } from '@shared/i18n/bookingLookups';

interface Stat {
  reason: string;
  count: number;
}

const CANCEL_REASON_KEY_BY_VALUE: Record<string, TranslationKey> = {
  'יקר מדי': T.OPTIONS.CANCEL_REASON_TOO_EXPENSIVE,
  'תאריך לא הסתדר': T.OPTIONS.CANCEL_REASON_DATE,
  'סגרו באולם אחר': T.OPTIONS.CANCEL_REASON_OTHER_VENUE,
  'ביטול האירוע לחלוטין': T.OPTIONS.CANCEL_REASON_EVENT_CANCELLED,
  'חוסר הסכמה על תנאים': T.OPTIONS.CANCEL_REASON_TERMS,
  אחר: T.OPTIONS.CANCEL_REASON_OTHER,
};

const CancellationStats = () => {
  const { t, T } = useTranslation();
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [month, setMonth] = useState<string>('');

  const { data: stats = [], isLoading: loading } = useCancellationStatsQuery(year, month);

  const months = useMemo(
    () => [
      { value: '', label: t(T.UI.ALL_YEAR_SUMMARY) },
      { value: '1', label: t(T.BOOKING.OPTION_DATES.MONTH_JAN) },
      { value: '2', label: t(T.BOOKING.OPTION_DATES.MONTH_FEB) },
      { value: '3', label: t(T.BOOKING.OPTION_DATES.MONTH_MAR) },
      { value: '4', label: t(T.BOOKING.OPTION_DATES.MONTH_APR) },
      { value: '5', label: t(T.BOOKING.OPTION_DATES.MONTH_MAY) },
      { value: '6', label: t(T.BOOKING.OPTION_DATES.MONTH_JUN) },
      { value: '7', label: t(T.BOOKING.OPTION_DATES.MONTH_JUL) },
      { value: '8', label: t(T.BOOKING.OPTION_DATES.MONTH_AUG) },
      { value: '9', label: t(T.BOOKING.OPTION_DATES.MONTH_SEP) },
      { value: '10', label: t(T.BOOKING.OPTION_DATES.MONTH_OCT) },
      { value: '11', label: t(T.BOOKING.OPTION_DATES.MONTH_NOV) },
      { value: '12', label: t(T.BOOKING.OPTION_DATES.MONTH_DEC) },
    ],
    [t, T],
  );

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

  const maxCount = stats.length > 0 ? Math.max(...stats.map((s: Stat) => s.count)) : 0;
  const totalCancellations = stats.reduce((sum: number, s: Stat) => sum + s.count, 0);

  const formatReason = (reason: string) =>
    translateByValue(t, CANCEL_REASON_KEY_BY_VALUE, reason);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>📉 {t(T.OPTIONS.CANCELLATION_STATS_TITLE)}</h2>
        <div className={styles.filters}>
          <select
            className={styles.select}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>{t(T.UI.LOADING_DATA)} ⏳</div>
      ) : stats.length === 0 ? (
        <div className={styles.noData}>{t(T.OPTIONS.NO_CANCELLATIONS)}</div>
      ) : (
        <>
          <div className={styles.totalSummary}>
            {t(T.OPTIONS.CANCELLATIONS_TOTAL, { count: totalCancellations })}
          </div>

          <div className={styles.statsList}>
            {stats.map((stat: Stat, index: number) => {
              const percentage = maxCount > 0 ? (stat.count / maxCount) * 100 : 0;
              const totalPercentage = ((stat.count / totalCancellations) * 100).toFixed(1);

              return (
                <div key={index} className={styles.statItem}>
                  <div className={styles.statHeader}>
                    <span>{formatReason(stat.reason)}</span>
                    <span>
                      {t(T.OPTIONS.CANCELLATION_BAR_LABEL, {
                        count: stat.count,
                        percent: totalPercentage,
                      })}
                    </span>
                  </div>
                  <div className={styles.barContainer}>
                    <div className={styles.barFill} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default CancellationStats;
