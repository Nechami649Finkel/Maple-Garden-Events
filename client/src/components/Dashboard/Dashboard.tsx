import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  useBookingsQuery,
  useCalendarDatesQuery,
  useFeedbackStatsQuery,
} from '../../hooks/queries';
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
import { type BookingApi } from '../../utils/bookingApi';
import { type CalendarDayApi } from '../../utils/optionDateApi';

type ActivityBooking = BookingApi & { _type: 'booked' | 'option' };

const startOfDay = (d: Date) => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const getEventDay = (b: BookingApi) =>
  b.eventDate?.date ? startOfDay(new Date(b.eventDate.date)) : null;

const Dashboard = () => {
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
    return (bookedData?.data ?? []).filter((b) => {
      if (b.isOption) return false;
      const day = getEventDay(b);
      return day !== null && day >= today && day <= in30;
    }).length;
  }, [bookedData]);

  const openOptionsCount = useMemo(() => {
    const today = startOfDay(new Date());
    return (optionsData?.data ?? []).filter((b) => {
      if (b.isOption === false) return false;
      const day = getEventDay(b);
      return day !== null && day >= today;
    }).length;
  }, [optionsData]);

  const eventsThisMonth = useMemo(() => {
    if (!Array.isArray(calendarData)) return 0;
    return calendarData.reduce((sum: number, day: CalendarDayApi) => {
      const bookings = day.bookings?.filter((b) => !b.isOption) ?? [];
      return sum + bookings.length;
    }, 0);
  }, [calendarData]);

  const avgScore = feedbackStats?.averages?.combined;
  const avgScoreDisplay =
    avgScore != null ? avgScore.toFixed(1) : '—';

  const recentActivity = useMemo(() => {
    const booked = (bookedData?.data ?? []).filter((b) => !b.isOption);
    const options = (optionsData?.data ?? []).filter((b) => b.isOption !== false);
    const combined: ActivityBooking[] = [
      ...booked.map((b) => ({ ...b, _type: 'booked' as const })),
      ...options.map((b) => ({ ...b, _type: 'option' as const })),
    ];
    return combined
      .filter((b) => getEventDay(b))
      .sort((a, b) => getEventDay(b)!.getTime() - getEventDay(a)!.getTime())
      .slice(0, 6);
  }, [bookedData, optionsData]);

  const metricsLoading = bookedLoading || optionsLoading || calendarLoading || feedbackLoading;

  return (
    <div className={styles.dashboard}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>לוח בקרה</h1>
          <p className={styles.subtitle}>סקירה כללית של האירועים וההזמנות במתחם</p>
        </div>
        <Link to="/calendar">
          <Button variant="primary">לוח שנה מלא</Button>
        </Link>
      </header>

      <section className={styles.metrics} aria-label="מדדי ביצוע">
        <StatCard
          label="אירועים קרובים (30 יום)"
          value={upcomingCount}
          icon="calendar"
          loading={metricsLoading}
        />
        <StatCard
          label="אופציות פתוחות"
          value={openOptionsCount}
          icon="clipboard"
          loading={metricsLoading}
        />
        <StatCard
          label="אירועים החודש"
          value={eventsThisMonth}
          icon="event"
          loading={metricsLoading}
        />
        <StatCard
          label="ציון משוב ממוצע"
          value={avgScoreDisplay}
          icon="star"
          trend={avgScore != null ? 'מתוך 5' : undefined}
          loading={metricsLoading}
        />
      </section>

      <section className={styles.upcoming}>
        <UpcomingEventsPanel />
      </section>

      <section className={styles.miniCal}>
        <Card>
          <CardHeader title="לוח שנה — החודש">
            <Link to="/calendar">
              <Button variant="secondary" size="sm">
                פתיחה
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
          <CardHeader title="פעילות אחרונה" />
          <CardBody>
            {metricsLoading ? (
              <SkeletonGroup rows={4} />
            ) : recentActivity.length === 0 ? (
              <p className={styles.emptyActivity}>אין פעילות להצגה</p>
            ) : (
              <ul className={styles.activityList}>
                {recentActivity.map((b) => (
                  <li key={b.id} className={styles.activityItem}>
                    <div className={styles.activityInfo}>
                      <span className={styles.activityName}>{b.clientAFullName}</span>
                      <span className={styles.activityMeta}>
                        {getEventDay(b)?.toLocaleDateString('he-IL')} · {b.eventType}
                      </span>
                    </div>
                    <Badge variant={b._type === 'option' ? 'option' : 'confirmed'}>
                      {b._type === 'option' ? 'אופציה' : 'מאושר'}
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
