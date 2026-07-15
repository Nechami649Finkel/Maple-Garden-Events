import { useEffect, useMemo, useState } from 'react';
import styles from './BookingsManager.module.css';
import BookingDetailsModal from './BookingDetailsModal';
import { useBookingsQuery } from '../../hooks/queries';
import { PageLoader } from '../PageLoader/PageLoader';
import { loadTablePrefs, saveTablePrefs } from '../../utils/tablePrefs';
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
import { type BookingApi } from '../../utils/bookingApi';

const startOfDay = (d: Date) => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const getEventDay = (b: BookingApi) => (b.eventDate?.date ? startOfDay(new Date(b.eventDate.date)) : null);

const dateStr = (b: BookingApi) =>
  b.eventDate?.date ? new Date(b.eventDate.date).toLocaleDateString('he-IL') : '—';

const toEventCard = (b: BookingApi, status: 'confirmed' | 'past'): EventCardData => ({
  id: b.id,
  date: dateStr(b),
  code: b.eventCode,
  clientName: b.clientAFullName ?? '',
  clientNameB: b.clientBFullName,
  eventType: b.eventType ?? '',
  timeOfDay: b.timeOfDay ?? undefined,
  guestCount:
    b.eventType === 'השכרת אולם בלי אוכל'
      ? 'השכרת אולם (ללא מנות)'
      : (b.guestCount ?? undefined),
  status,
  statusLabel: status === 'confirmed' ? 'מאושר' : 'עבר',
});

const TABLE_ID = 'bookings-manager';

const BookingsManager = () => {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<BookingApi | null>(null);
  const [sortKey, setSortKey] = useState(() => loadTablePrefs(TABLE_ID).sortColumn ?? 'date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => loadTablePrefs(TABLE_ID).sortDir ?? 'asc');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    saveTablePrefs(TABLE_ID, { sortColumn: sortKey, sortDir });
  }, [sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortBookings = (bookings: BookingApi[]) => {
    const sorted = [...bookings];
    sorted.sort((a, b) => {
      let cmp: number;
      switch (sortKey) {
        case 'code':
          cmp = String(a.eventCode ?? '').localeCompare(String(b.eventCode ?? ''), 'he');
          break;
        case 'client':
          cmp = String(a.clientAFullName ?? '').localeCompare(String(b.clientAFullName ?? ''), 'he');
          break;
        case 'type':
          cmp = String(a.eventType ?? '').localeCompare(String(b.eventType ?? ''), 'he');
          break;
        case 'guests':
          cmp = (Number(a.guestCount) || 0) - (Number(b.guestCount) || 0);
          break;
        case 'date':
        default: {
          const dayA = getEventDay(a)?.getTime() ?? 0;
          const dayB = getEventDay(b)?.getTime() ?? 0;
          cmp = dayA - dayB;
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  };

  const { data, isLoading } = useBookingsQuery({
    status: 'BOOKED',
    page: 1,
    limit: 500,
    search: debouncedSearch || undefined,
  });

  const { upcomingBookings, pastBookings } = useMemo(() => {
    const today = startOfDay(new Date());
    const bookings = (data?.data ?? []).filter((b) => !b.isOption);

    const upcoming = sortBookings(
      bookings
      .filter((b) => {
        const day = getEventDay(b);
        return day !== null && day >= today;
      })
    );

    const past = sortBookings(
      bookings
      .filter((b) => {
        const day = getEventDay(b);
        return day !== null && day < today;
      })
    );

    return { upcomingBookings: upcoming, pastBookings: past };
  }, [data, sortKey, sortDir]);

  const closeSelected = () => setSelected(null);

  const columns: DataTableColumn<BookingApi>[] = [
    { key: 'date', header: 'תאריך', sortable: true, render: (b) => dateStr(b) },
    { key: 'code', header: 'קוד', sortable: true, render: (b) => (b.eventCode ? `#${b.eventCode}` : '—') },
    { key: 'client', header: 'לקוח', sortable: true, render: (b) => b.clientAFullName },
    { key: 'type', header: 'סוג', sortable: true, render: (b) => b.eventType },
    {
      key: 'guests',
      header: 'מוזמנים',
      sortable: true,
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
    bookings: BookingApi[],
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
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
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
