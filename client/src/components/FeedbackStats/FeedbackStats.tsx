import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate } from '@shared/i18n/formatters';
import styles from './FeedbackStats.module.css';
import { useFeedbackStatsQuery } from '../../hooks/queries';
import { useTranslation } from '../../i18n/useTranslation';

function stars(score: number | null, emDash: string) {
  if (score == null) return emDash;
  const rounded = Math.round(score);
  return '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
}

const FeedbackStats = () => {
  const { t, T, locale } = useTranslation();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState('');

  const emDash = t(T.COMMON.LABELS.EM_DASH);

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

  const formatEventDate = (iso: string | null) => {
    if (!iso) return emDash;
    return formatDate(iso + 'T12:00:00', locale);
  };

  const sideLabel = (clientSide: string): string =>
    clientSide === 'B' ? t(T.BOOKINGS.SIDE_B) : t(T.BOOKINGS.SIDE_A);

  const { data, isLoading } = useFeedbackStatsQuery(year, month);
  const stats = data;

  const currentYear = new Date().getFullYear();
  const defaultYears = useMemo(
    () => Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i)),
    [currentYear],
  );

  const extraYears = useMemo(() => {
    const fromApi = (stats?.availableYears ?? []).map(String);
    return fromApi.filter((y) => !defaultYears.includes(y));
  }, [stats?.availableYears, defaultYears]);

  const maxTypeAvg = stats?.byEventType.length
    ? Math.max(...stats.byEventType.map((t) => t.average ?? 0), 5)
    : 5;

  const maxCategoryAvg = stats?.categoryComparison.length
    ? Math.max(...stats.categoryComparison.map((c) => c.average ?? 0), 5)
    : 5;

  const maxMonthAvg = stats?.byMonth.length
    ? Math.max(...stats.byMonth.map((m) => m.average ?? 0), 5)
    : 5;

  const maxYearAvg = stats?.byYear.length
    ? Math.max(...stats.byYear.map((y) => y.average ?? 0), 5)
    : 5;

  const periodLabel = year === 'all' ? t(T.FEEDBACK.ALL_YEARS) : year;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>📊 {t(T.FEEDBACK.STATS_TITLE)}</h2>
          <p className={styles.subtitle}>{t(T.FEEDBACK.STATS_SUBTITLE)}</p>
        </div>
        <div className={styles.filters}>
          <select className={styles.select} value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m.value || 'all'} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select className={styles.select} value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="all">{t(T.FEEDBACK.ALL_YEARS)}</option>
            {defaultYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
            {extraYears.length > 0 && (
              <optgroup label={t(T.FEEDBACK.OTHER_YEARS_GROUP)}>
                {extraYears.map((y) => (
                  <option key={`extra-${y}`} value={y}>{y}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loading}>{t(T.UI.LOADING_DATA)}</div>
      ) : !stats ? (
        <div className={styles.noData}>{t(T.FEEDBACK.STATS_LOAD_ERROR)}</div>
      ) : stats.counts.completedFeedbacks === 0 && stats.counts.totalEventsFinished === 0 ? (
        <div className={styles.noData}>
          {t(T.FEEDBACK.STATS_NO_DATA)}
          <div className={styles.linkRow}>
            <Link to="/feedback-manager" className={styles.linkBtn}>← {t(T.FEEDBACK.BACK_TO_MANAGER)}</Link>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>{t(T.FEEDBACK.KPI_OVERALL)}</span>
              <span className={styles.kpiValue}>
                {stats.averages.combined != null ? stats.averages.combined.toFixed(1) : emDash}
              </span>
              {stats.averages.combined != null && (
                <span className={styles.kpiSub}>{stars(stats.averages.combined, emDash)}</span>
              )}
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>{t(T.FEEDBACK.KPI_FOOD)}</span>
              <span className={styles.kpiValue}>
                {stats.averages.food != null ? stats.averages.food.toFixed(1) : emDash}
              </span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>{t(T.FEEDBACK.KPI_SERVICE)}</span>
              <span className={styles.kpiValue}>
                {stats.averages.service != null ? stats.averages.service.toFixed(1) : emDash}
              </span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>{t(T.FEEDBACK.KPI_VENUE)}</span>
              <span className={styles.kpiValue}>
                {stats.averages.venue != null ? stats.averages.venue.toFixed(1) : emDash}
              </span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>{t(T.FEEDBACK.KPI_COMPLETION)}</span>
              <span className={styles.kpiValue}>
                {stats.responseRate != null ? `${stats.responseRate}%` : emDash}
              </span>
              <span className={styles.kpiSub}>
                {stats.counts.completedFeedbacks} / {stats.counts.expectedSides}
              </span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>{t(T.FEEDBACK.KPI_LOW)}</span>
              <span className={`${styles.kpiValue} ${stats.counts.lowScore > 0 ? styles.kpiValueWarn : ''}`}>
                {stats.counts.lowScore}
              </span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>{t(T.FEEDBACK.KPI_EXCELLENT)}</span>
              <span className={styles.kpiValue}>{stats.counts.excellent}</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>{t(T.FEEDBACK.KPI_PENDING)}</span>
              <span className={styles.kpiValue}>{stats.counts.pendingFeedbacks}</span>
              <span className={styles.kpiSub}>
                {stats.counts.notSentEvents} {t(T.FEEDBACK.NOT_SENT_COUNT)}
              </span>
            </div>
          </div>

          <div className={styles.twoCol}>
            {stats.categoryComparison.length > 0 && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>{t(T.FEEDBACK.SECTION_CATEGORIES)}</h3>
                <div className={styles.barList}>
                  {stats.categoryComparison.map((item) => {
                    const pct = item.average != null ? (item.average / maxCategoryAvg) * 100 : 0;
                    return (
                      <div key={item.category} className={styles.barItem}>
                        <div className={styles.barHeader}>
                          <span>{item.category}</span>
                          <span>{item.average?.toFixed(1)} ★</span>
                        </div>
                        <div className={styles.barTrack}>
                          <div
                            className={`${styles.barFill} ${styles.barFillCategory}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {stats.byEventType.length > 0 && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>{t(T.FEEDBACK.SECTION_EVENT_TYPES)}</h3>
                <div className={styles.barList}>
                  {stats.byEventType.map((item) => {
                    const pct = item.average != null ? (item.average / maxTypeAvg) * 100 : 0;
                    return (
                      <div key={item.eventType} className={styles.barItem}>
                        <div className={styles.barHeader}>
                          <span>{item.eventType} ({item.count})</span>
                          <span>{item.average?.toFixed(1)} ★</span>
                        </div>
                        <div className={styles.barTrack}>
                          <div className={styles.barFill} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {!month && year === 'all' && stats.byYear.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                {t(T.FEEDBACK.SECTION_BY_YEAR)} — {t(T.FEEDBACK.ALL_YEARS)}
              </h3>
              <div className={styles.monthChart}>
                {stats.byYear.map((item) => {
                  const heightPct = item.average != null ? (item.average / maxYearAvg) * 100 : 0;
                  return (
                    <div key={item.year} className={styles.monthCol}>
                      <span className={styles.monthScore}>
                        {item.average?.toFixed(1) ?? emDash}
                      </span>
                      <div className={styles.monthBarWrap}>
                        <div className={styles.monthBar} style={{ height: `${heightPct}%` }} />
                      </div>
                      <span className={styles.monthLabel}>{item.year}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!month && year !== 'all' && stats.byMonth.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                {t(T.FEEDBACK.SECTION_BY_MONTH)} — {periodLabel}
              </h3>
              <div className={styles.monthChart}>
                {stats.byMonth.map((item) => {
                  const heightPct = item.average != null ? (item.average / maxMonthAvg) * 100 : 0;
                  return (
                    <div key={item.month} className={styles.monthCol}>
                      <span className={styles.monthScore}>
                        {item.average?.toFixed(1) ?? emDash}
                      </span>
                      <div className={styles.monthBarWrap}>
                        <div className={styles.monthBar} style={{ height: `${heightPct}%` }} />
                      </div>
                      <span className={styles.monthLabel}>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {stats.recentLow.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>⚠️ {t(T.FEEDBACK.SECTION_LOW_RATINGS)}</h3>
              <div className={styles.lowList}>
                {stats.recentLow.map((item, idx) => (
                  <div key={`${item.eventCode}-${idx}`} className={styles.lowItem}>
                    <div className={styles.lowMeta}>
                      <span className={styles.eventCode}>#{item.eventCode}</span>
                      <span>{item.eventType}</span>
                      <span>{formatEventDate(item.eventDate)}</span>
                      <span>{item.clients}</span>
                      <span>{sideLabel(item.clientSide)}</span>
                      <span className={styles.scoreBadge}>{item.score.toFixed(1)}</span>
                    </div>
                    {item.comment && <p className={styles.lowText}>"{item.comment}"</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.recentComments.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>💬 {t(T.FEEDBACK.SECTION_RECENT_COMMENTS)}</h3>
              <div className={styles.commentList}>
                {stats.recentComments.map((item, idx) => (
                  <div key={`${item.eventCode}-c-${idx}`} className={styles.commentItem}>
                    <div className={styles.commentMeta}>
                      <span className={styles.eventCode}>#{item.eventCode}</span>
                      <span>{formatEventDate(item.eventDate)}</span>
                      {item.score != null && (
                        <span className={`${styles.scoreBadge} ${styles.scoreBadgeGood}`}>
                          {item.score.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <p className={styles.commentText}>"{item.comment}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.linkRow}>
            <Link to="/feedback-manager" className={styles.linkBtn}>← {t(T.FEEDBACK.BACK_TO_MANAGER)}</Link>
          </div>
        </>
      )}
    </div>
  );
};

export default FeedbackStats;
