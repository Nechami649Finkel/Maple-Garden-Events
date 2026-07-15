import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useBookingsQuery } from '../../hooks/queries';
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
import { type BookingApi } from '../../utils/bookingApi';

const startOfDay = (d: Date) => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const getEventDay = (b: BookingApi) =>
  b.eventDate?.date ? startOfDay(new Date(b.eventDate.date)) : null;

const dateStr = (b: BookingApi) =>
  b.eventDate?.date ? new Date(b.eventDate.date).toLocaleDateString('he-IL') : '—';

const toEventCard = (b: BookingApi): EventCardData => ({
  id: b.id,
  date: dateStr(b),
  code: b.eventCode,
  clientName: b.clientAFullName,
  clientNameB: b.clientBFullName,
  eventType: b.eventType,
  timeOfDay: b.timeOfDay,
  guestCount:
    b.eventType === 'השכרת אולם בלי אוכל'
      ? 'השכרת אולם (ללא מנות)'
      : b.guestCount,
  status: 'confirmed',
  statusLabel: 'מאושר',
});

export function UpcomingEventsPanel() {
  const { data, isLoading } = useBookingsQuery({
    status: 'BOOKED',
    page: 1,
    limit: 500,
  });

  const upcoming = useMemo(() => {
    const today = startOfDay(new Date());
    return (data?.data ?? [])
      .filter((b) => !b.isOption)
      .filter((b) => {
        const day = getEventDay(b);
        return day !== null && day >= today;
      })
      .sort((a, b) => getEventDay(a)!.getTime() - getEventDay(b)!.getTime())
      .slice(0, 5);
  }, [data]);

  const columns: DataTableColumn<BookingApi>[] = [
    { key: 'date', header: 'תאריך', render: (b) => dateStr(b) },
    { key: 'code', header: 'קוד', render: (b) => b.eventCode ? `#${b.eventCode}` : '—' },
    { key: 'client', header: 'לקוח', render: (b) => b.clientAFullName },
    { key: 'type', header: 'סוג', render: (b) => b.eventType },
    {
      key: 'guests',
      header: 'מוזמנים',
      render: (b) =>
        b.eventType === 'השכרת אולם בלי אוכל' ? '—' : b.guestCount ?? '—',
    },
    {
      key: 'status',
      header: 'סטטוס',
      render: () => <Badge variant="confirmed">מאושר</Badge>,
    },
  ];

  return (
    <div className={styles.panel}>
      <SectionHeader
        title="אירועים קרובים"
        count={upcoming.length}
        action={
          <Link to="/bookings-manager">
            <Button variant="secondary" size="sm">
              הצג הכל
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <SkeletonGroup rows={3} />
      ) : upcoming.length === 0 ? (
        <p className={styles.empty}>אין אירועים קרובים</p>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <DataTable
              caption="אירועים קרובים"
              columns={columns}
              data={upcoming}
              rowKey={(b) => b.id}
            />
          </div>
          <div className={styles.cardsWrap}>
            {upcoming.map((b) => (
              <EventCard key={b.id} event={toEventCard(b)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
