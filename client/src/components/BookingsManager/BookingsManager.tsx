import { useEffect, useMemo, useState } from 'react';
import styles from './BookingsManager.module.css';
import BookingDetailsModal from './BookingDetailsModal';
import { useBookingsQuery } from '../../hooks/queries';
import { PageLoader } from '../PageLoader/PageLoader';
import {
  PageHeader,
  Input,
  EmptyState,
  SectionHeader,
  DataTable,
  EventCard,
  Badge,
  Button,
  type DataTableColumn,
  type EventCardData,
} from '../ui';

const startOfDay = (d: Date) => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const getEventDay = (b: any) => (b.eventDate?.date ? startOfDay(new Date(b.eventDate.date)) : null);

const dateStr = (b: any) =>
  b.eventDate?.date ? new Date(b.eventDate.date).toLocaleDateString('he-IL') : '—';

const toEventCard = (b: any, status: 'confirmed' | 'past'): EventCardData => ({
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
  status,
  statusLabel: status === 'confirmed' ? 'מאושר' : 'עבר',
});

const BookingsManager = () => {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useBookingsQuery({
    status: 'BOOKED',
    page: 1,
    limit: 500,
    search: debouncedSearch || undefined,
  });

  const { upcomingBookings, pastBookings } = useMemo(() => {
    const today = startOfDay(new Date());
    const bookings = (data?.data ?? []).filter((b: any) => !b.isOption);

    const upcoming = bookings
      .filter((b: any) => {
        const day = getEventDay(b);
        return day !== null && day >= today;
      })
      .sort((a: any, b: any) => getEventDay(a)!.getTime() - getEventDay(b)!.getTime());

    const past = bookings
      .filter((b: any) => {
        const day = getEventDay(b);
        return day !== null && day < today;
      })
      .sort((a: any, b: any) => getEventDay(b)!.getTime() - getEventDay(a)!.getTime());

    return { upcomingBookings: upcoming, pastBookings: past };
  }, [data]);

  const closeSelected = () => setSelected(null);

  const columns: DataTableColumn<any>[] = [
    { key: 'date', header: 'תאריך', render: (b) => dateStr(b) },
    { key: 'code', header: 'קוד', render: (b) => (b.eventCode ? `#${b.eventCode}` : '—') },
    { key: 'client', header: 'לקוח', render: (b) => b.clientAFullName },
    { key: 'type', header: 'סוג', render: (b) => b.eventType },
    {
      key: 'guests',
      header: 'מוזמנים',
      render: (b) =>
        b.eventType === 'השכרת אולם בלי אוכל' ? '—' : (b.guestCount ?? '—'),
    },
    {
      key: 'status',
      header: 'סטטוס',
      render: (b) => {
        const today = startOfDay(new Date());
        const day = getEventDay(b);
        const isPast = day !== null && day < today;
        return (
          <Badge variant={isPast ? 'past' : 'confirmed'}>
            {isPast ? 'עבר' : 'מאושר'}
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: 'פעולות',
      render: (b) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setSelected(b);
          }}
        >
          פרטים
        </Button>
      ),
    },
  ];

  const renderSection = (
    title: string,
    bookings: any[],
    cardStatus: 'confirmed' | 'past',
  ) => (
    <section className={styles.section}>
      <SectionHeader title={title} count={bookings.length} />
      <div className={styles.tableWrap}>
        <DataTable
          caption={title}
          columns={columns}
          data={bookings}
          rowKey={(b) => b.id}
          onRowClick={(b) => setSelected(b)}
        />
      </div>
      <div className={styles.cardsWrap}>
        {bookings.map((b) => (
          <EventCard
            key={b.id}
            event={toEventCard(b, cardStatus)}
            onView={() => setSelected(b)}
            viewLabel="הצגת כל פרטי ההזמנה"
          />
        ))}
      </div>
    </section>
  );

  return (
    <div className={styles.container}>
      <PageHeader title="ניהול הזמנות" subtitle="הזמנות סגורות — קרובות ועברו" />

      <Input
        fieldClassName={styles.searchInput}
        placeholder="חיפוש לפי שם או תעודת זהות..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="חיפוש הזמנות"
      />

      {isLoading ? (
        <PageLoader />
      ) : upcomingBookings.length === 0 && pastBookings.length === 0 ? (
        <EmptyState
          icon="📋"
          title={search ? 'לא נמצאו תוצאות' : 'אין הזמנות סגורות'}
          message={search ? 'נסה לחפש בשם אחר או בתעודת זהות' : 'הזמנות חדשות יופיעו כאן לאחר סגירה'}
        />
      ) : (
        <>
          {upcomingBookings.length > 0 &&
            renderSection('אירועים קרובים', upcomingBookings, 'confirmed')}
          {pastBookings.length > 0 &&
            renderSection('אירועים שעברו', pastBookings, 'past')}
        </>
      )}

      {selected && (
        <BookingDetailsModal
          booking={selected}
          onClose={closeSelected}
          onBookingUpdated={setSelected}
        />
      )}
    </div>
  );
};

export default BookingsManager;
