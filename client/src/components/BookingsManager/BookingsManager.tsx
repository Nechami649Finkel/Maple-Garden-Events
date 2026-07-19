import { useEffect, useMemo, useState } from 'react';
import styles from './BookingsManager.module.css';
import BookingDetailsModal from './BookingDetailsModal';
import { useBookingsQuery } from '../../hooks/queries';
import { PageLoader } from '../PageLoader/PageLoader';
import { loadTablePrefs, saveTablePrefs } from '../../utils/tablePrefs';
import { useTranslation } from '../../i18n/useTranslation';
import { formatDate } from '@shared/i18n/formatters';
import {
  EVENT_TYPE_KEY_BY_VALUE,
  HALL_ONLY_EVENT_TYPE,
  translateByValue,
} from '@shared/i18n/bookingLookups';
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

const TABLE_ID = 'bookings-manager';

const BookingsManager = () => {
  const { t, T, locale } = useTranslation();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [sortKey, setSortKey] = useState(() => loadTablePrefs(TABLE_ID).sortColumn ?? 'date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => loadTablePrefs(TABLE_ID).sortDir ?? 'asc');

  const formatEventType = (value: string) =>
    translateByValue(t, EVENT_TYPE_KEY_BY_VALUE, value);

  const dateStr = (b: any) =>
    b.eventDate?.date ? formatDate(b.eventDate.date, locale) : t(T.COMMON.LABELS.EM_DASH);

  const toEventCard = (b: any, status: 'confirmed' | 'past'): EventCardData => ({
    id: b.id,
    date: dateStr(b),
    code: b.eventCode,
    clientName: b.clientAFullName,
    clientNameB: b.clientBFullName,
    eventType: formatEventType(b.eventType),
    timeOfDay: b.timeOfDay,
    guestCount:
      b.eventType === HALL_ONLY_EVENT_TYPE
        ? t(T.BOOKINGS.EVENT_TYPE_HALL_ONLY_SHORT)
        : b.guestCount,
    status,
    statusLabel: status === 'confirmed' ? t(T.BOOKINGS.STATUS_CONFIRMED) : t(T.BOOKINGS.STATUS_PAST),
  });

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

  const sortBookings = (bookings: any[]) => {
    const sorted = [...bookings];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'code':
          cmp = String(a.eventCode ?? '').localeCompare(String(b.eventCode ?? ''), locale);
          break;
        case 'client':
          cmp = String(a.clientAFullName ?? '').localeCompare(String(b.clientAFullName ?? ''), locale);
          break;
        case 'type':
          cmp = String(a.eventType ?? '').localeCompare(String(b.eventType ?? ''), locale);
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
    const bookings = (data?.data ?? []).filter((b: any) => !b.isOption);

    const upcoming = sortBookings(
      bookings.filter((b: any) => {
        const day = getEventDay(b);
        return day !== null && day >= today;
      }),
    );

    const past = sortBookings(
      bookings.filter((b: any) => {
        const day = getEventDay(b);
        return day !== null && day < today;
      }),
    );

    return { upcomingBookings: upcoming, pastBookings: past };
  }, [data, sortKey, sortDir, locale]);

  const closeSelected = () => setSelected(null);

  const columns: DataTableColumn<any>[] = [
    { key: 'date', header: t(T.BOOKINGS.COL_DATE), sortable: true, render: (b) => dateStr(b) },
    {
      key: 'code',
      header: t(T.BOOKINGS.COL_CODE),
      sortable: true,
      render: (b) => (b.eventCode ? `#${b.eventCode}` : t(T.COMMON.LABELS.EM_DASH)),
    },
    { key: 'client', header: t(T.BOOKINGS.COL_CLIENT), sortable: true, render: (b) => b.clientAFullName },
    { key: 'type', header: t(T.BOOKINGS.COL_TYPE), sortable: true, render: (b) => formatEventType(b.eventType) },
    {
      key: 'guests',
      header: t(T.BOOKINGS.COL_GUESTS),
      sortable: true,
      render: (b) =>
        b.eventType === HALL_ONLY_EVENT_TYPE ? t(T.COMMON.LABELS.EM_DASH) : (b.guestCount ?? t(T.COMMON.LABELS.EM_DASH)),
    },
    {
      key: 'status',
      header: t(T.BOOKINGS.COL_STATUS),
      render: (b) => {
        const today = startOfDay(new Date());
        const day = getEventDay(b);
        const isPast = day !== null && day < today;
        return (
          <Badge variant={isPast ? 'past' : 'confirmed'}>
            {isPast ? t(T.BOOKINGS.STATUS_PAST) : t(T.BOOKINGS.STATUS_CONFIRMED)}
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: t(T.BOOKINGS.COL_ACTIONS),
      render: (b) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setSelected(b);
          }}
        >
          {t(T.BOOKINGS.VIEW_DETAILS)}
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
            viewLabel={t(T.BOOKINGS.VIEW_ALL_DETAILS)}
          />
        ))}
      </div>
    </section>
  );

  return (
    <div className={styles.container}>
      <PageHeader title={t(T.BOOKINGS.PAGE_TITLE)} subtitle={t(T.BOOKINGS.PAGE_SUBTITLE)} />

      <Input
        fieldClassName={styles.searchInput}
        placeholder={t(T.BOOKINGS.SEARCH_PLACEHOLDER)}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label={t(T.BOOKINGS.SEARCH_ARIA)}
      />

      {isLoading ? (
        <PageLoader />
      ) : upcomingBookings.length === 0 && pastBookings.length === 0 ? (
        <EmptyState
          icon="📋"
          title={search ? t(T.BOOKINGS.NO_SEARCH) : t(T.BOOKINGS.EMPTY_TITLE)}
          message={search ? t(T.BOOKINGS.SEARCH_HINT) : t(T.BOOKINGS.EMPTY_MESSAGE)}
        />
      ) : (
        <>
          {upcomingBookings.length > 0 &&
            renderSection(t(T.BOOKINGS.SECTION_UPCOMING), upcomingBookings, 'confirmed')}
          {pastBookings.length > 0 &&
            renderSection(t(T.BOOKINGS.SECTION_PAST), pastBookings, 'past')}
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
