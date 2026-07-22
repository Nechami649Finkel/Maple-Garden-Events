import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBookingsQuery } from '../../hooks/queries';
import { useTranslation } from '../../i18n/useTranslation';
import { formatDate } from '@shared/i18n/formatters';
import {
  EVENT_TYPE_KEY_BY_VALUE,
  HALL_ONLY_EVENT_TYPE,
  translateByValue,
} from '@shared/i18n/bookingLookups';
import {
  SectionHeader,
  DataTable,
  EventCard,
  Button,
  Badge,
  SkeletonGroup,
  type DataTableColumn,
  type EventCardData,
} from '../ui';
import styles from './UpcomingEventsPanel.module.css';

const startOfDay = (d: Date) => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const getEventDay = (b: any) =>
  b.eventDate?.date ? startOfDay(new Date(b.eventDate.date)) : null;

export function UpcomingEventsPanel() {
  const { t, T, locale } = useTranslation();
  const { data, isLoading } = useBookingsQuery({
    status: 'BOOKED',
    page: 1,
    limit: 500,
  });

  const formatEventType = (value: string) =>
    translateByValue(t, EVENT_TYPE_KEY_BY_VALUE, value);

  const dateStr = (b: any) =>
    b.eventDate?.date ? formatDate(b.eventDate.date, locale) : t(T.COMMON.LABELS.EM_DASH);

  const toEventCard = (b: any): EventCardData => ({
    id: b.id,
    date: dateStr(b),
    code: b.eventCode,
    clientName: b.clientAFullName,
    clientNameB: b.clientBFullName,
    eventType: formatEventType(b.eventType),
    timeOfDay: b.timeOfDay,
    guestCount:
      b.eventType === HALL_ONLY_EVENT_TYPE
        ? t(T.STATUS.HALL_RENTAL_NO_PORTIONS)
        : b.guestCount,
    status: 'confirmed',
    statusLabel: t(T.STATUS.CONFIRMED),
  });

  const upcoming = useMemo(() => {
    const today = startOfDay(new Date());
    return (data?.data ?? [])
      .filter((b: any) => !b.isOption)
      .filter((b: any) => {
        const day = getEventDay(b);
        return day !== null && day >= today;
      })
      .sort((a: any, b: any) => getEventDay(a)!.getTime() - getEventDay(b)!.getTime())
      .slice(0, 5);
  }, [data]);

  const columns: DataTableColumn<any>[] = [
    { key: 'date', header: t(T.COMMON.LABELS.DATE), render: (b) => dateStr(b) },
    {
      key: 'code',
      header: t(T.COMMON.LABELS.CODE),
      render: (b) => (b.eventCode ? `#${b.eventCode}` : t(T.COMMON.LABELS.EM_DASH)),
    },
    { key: 'client', header: t(T.COMMON.LABELS.CLIENT), render: (b) => b.clientAFullName },
    { key: 'type', header: t(T.COMMON.LABELS.TYPE), render: (b) => formatEventType(b.eventType) },
    {
      key: 'guests',
      header: t(T.COMMON.LABELS.GUESTS),
      render: (b) =>
        b.eventType === HALL_ONLY_EVENT_TYPE
          ? t(T.COMMON.LABELS.EM_DASH)
          : (b.guestCount ?? t(T.COMMON.LABELS.EM_DASH)),
    },
    {
      key: 'status',
      header: t(T.COMMON.LABELS.STATUS),
      render: () => <Badge variant="confirmed">{t(T.STATUS.CONFIRMED)}</Badge>,
    },
  ];

  return (
    <div className={styles.panel}>
      <SectionHeader
        title={t(T.DASHBOARD.UPCOMING_EVENTS)}
        count={upcoming.length}
        action={
          <Link to="/bookings-manager">
            <Button variant="secondary" size="sm">
              {t(T.COMMON.ACTIONS.VIEW_ALL)}
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <SkeletonGroup rows={3} />
      ) : upcoming.length === 0 ? (
        <p className={styles.empty}>{t(T.DASHBOARD.NO_UPCOMING)}</p>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <DataTable
              caption={t(T.DASHBOARD.UPCOMING_EVENTS)}
              columns={columns}
              data={upcoming}
              rowKey={(b: any) => b.id}
            />
          </div>
          <div className={styles.cardsWrap}>
            {upcoming.map((b: any) => (
              <EventCard key={b.id} event={toEventCard(b)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
