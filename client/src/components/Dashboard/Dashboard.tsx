import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  useBookingsQuery,
  useCalendarDatesQuery,
  useFeedbackStatsQuery,
} from '../../hooks/queries';
import { useTranslation } from '../../i18n/useTranslation';
import { formatDate } from '@shared/i18n/formatters';
import {
  EVENT_TYPE_KEY_BY_VALUE,
  translateByValue,
} from '@shared/i18n/bookingLookups';
import {
  StatCard,
  Card,
  CardHeader,
  CardBody,
  Button,
  Badge,
  SkeletonGroup,
} from '../ui';
import { UpcomingEventsPanel } from './UpcomingEventsPanel';
import { MiniCalendar } from './MiniCalendar';
import styles from './Dashboard.module.css';

const startOfDay = (d: Date) => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const getEventDay = (b: any) =>
  b.eventDate?.date ? startOfDay(new Date(b.eventDate.date)) : null;

const Dashboard = () => {
  const { t, T, locale } = useTranslation();
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1);

  const monthStart = `${year}-${month.padStart(2, '0')}-01`;
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  const { data: bookedData, isLoading: bookedLoading } = useBookingsQuery({
    status: 'BOOKED',
    page: 1,
    limit: 500,
  });

  const { data: optionsData, isLoading: optionsLoading } = useBookingsQuery({
    status: 'OPTION',
    page: 1,
    limit: 500,
  });

  const { data: calendarData, isLoading: calendarLoading } = useCalendarDatesQuery(
    monthStart,
    monthEnd,
    '',
  );

  const { data: feedbackStats, isLoading: feedbackLoading } = useFeedbackStatsQuery(
    year,
    month,
  );

  const upcomingCount = useMemo(() => {
    const today = startOfDay(new Date());
    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);
    return (bookedData?.data ?? []).filter((b: any) => {
      if (b.isOption) return false;
      const day = getEventDay(b);
      return day !== null && day >= today && day <= in30;
    }).length;
  }, [bookedData]);

  const openOptionsCount = useMemo(() => {
    const today = startOfDay(new Date());
    return (optionsData?.data ?? []).filter((b: any) => {
      if (b.isOption === false) return false;
      const day = getEventDay(b);
      return day !== null && day >= today;
    }).length;
  }, [optionsData]);

  const eventsThisMonth = useMemo(() => {
    if (!Array.isArray(calendarData)) return 0;
    return calendarData.reduce((sum: number, day: any) => {
      const bookings = day.bookings?.filter((b: any) => !b.isOption) ?? [];
      return sum + bookings.length;
    }, 0);
  }, [calendarData]);

  const avgScore = feedbackStats?.averages?.combined;
  const avgScoreDisplay =
    avgScore != null ? avgScore.toFixed(1) : t(T.COMMON.LABELS.EM_DASH);

  const recentActivity = useMemo(() => {
    const booked = (bookedData?.data ?? []).filter((b: any) => !b.isOption);
    const options = (optionsData?.data ?? []).filter((b: any) => b.isOption !== false);
    const combined = [
      ...booked.map((b: any) => ({ ...b, _type: 'booked' as const })),
      ...options.map((b: any) => ({ ...b, _type: 'option' as const })),
    ];
    return combined
      .filter((b) => getEventDay(b))
      .sort((a, b) => getEventDay(b)!.getTime() - getEventDay(a)!.getTime())
      .slice(0, 6);
  }, [bookedData, optionsData]);

  const metricsLoading = bookedLoading || optionsLoading || calendarLoading || feedbackLoading;

  const formatEventType = (value: string) =>
    translateByValue(t, EVENT_TYPE_KEY_BY_VALUE, value);

  return (
    <div className={styles.dashboard}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>{t(T.DASHBOARD.TITLE)}</h1>
          <p className={styles.subtitle}>{t(T.DASHBOARD.SUBTITLE)}</p>
        </div>
        <Link to="/calendar">
          <Button variant="primary">{t(T.DASHBOARD.FULL_CALENDAR)}</Button>
        </Link>
      </header>

      <section className={styles.metrics} aria-label={t(T.DASHBOARD.METRICS_ARIA)}>
        <StatCard
          label={t(T.DASHBOARD.UPCOMING_30)}
          value={upcomingCount}
          icon="calendar"
          loading={metricsLoading}
        />
        <StatCard
          label={t(T.DASHBOARD.OPEN_OPTIONS)}
          value={openOptionsCount}
          icon="clipboard"
          loading={metricsLoading}
        />
        <StatCard
          label={t(T.DASHBOARD.EVENTS_THIS_MONTH)}
          value={eventsThisMonth}
          icon="event"
          loading={metricsLoading}
        />
        <StatCard
          label={t(T.DASHBOARD.AVG_FEEDBACK)}
          value={avgScoreDisplay}
          icon="star"
          trend={avgScore != null ? t(T.COMMON.LABELS.OUT_OF_FIVE) : undefined}
          loading={metricsLoading}
        />
      </section>

      <section className={styles.upcoming}>
        <UpcomingEventsPanel />
      </section>

      <section className={styles.miniCal}>
        <Card>
          <CardHeader title={t(T.DASHBOARD.MINI_CALENDAR_TITLE)}>
            <Link to="/calendar">
              <Button variant="secondary" size="sm">
                {t(T.COMMON.ACTIONS.OPEN)}
              </Button>
            </Link>
          </CardHeader>
          <CardBody>
            {calendarLoading ? (
              <SkeletonGroup rows={4} />
            ) : (
              <MiniCalendar days={calendarData ?? []} />
            )}
          </CardBody>
        </Card>
      </section>

      <section className={styles.activity}>
        <Card compact>
          <CardHeader title={t(T.DASHBOARD.RECENT_ACTIVITY)} />
          <CardBody>
            {metricsLoading ? (
              <SkeletonGroup rows={4} />
            ) : recentActivity.length === 0 ? (
              <p className={styles.emptyActivity}>{t(T.DASHBOARD.NO_ACTIVITY)}</p>
            ) : (
              <ul className={styles.activityList}>
                {recentActivity.map((b: any) => (
                  <li key={b.id} className={styles.activityItem}>
                    <div className={styles.activityInfo}>
                      <span className={styles.activityName}>{b.clientAFullName}</span>
                      <span className={styles.activityMeta}>
                        {b.eventDate?.date
                          ? formatDate(b.eventDate.date, locale)
                          : t(T.COMMON.LABELS.EM_DASH)}{' '}
                        · {formatEventType(b.eventType)}
                      </span>
                    </div>
                    <Badge variant={b._type === 'option' ? 'option' : 'confirmed'}>
                      {b._type === 'option' ? t(T.STATUS.OPTION) : t(T.STATUS.CONFIRMED)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
};

export default Dashboard;
