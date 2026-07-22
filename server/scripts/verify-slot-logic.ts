import {
  getBookableSlotsForDate,
  parseDateLocal,
} from '../src/utils/timeSlot';

const cases = [
  {
    name: 'partial day - noon booked',
    date: '2026-06-25',
    bookings: [{ timeOfDay: 'noon|12:00 - 18:00' }],
    expectBookable: ['morning', 'evening'],
    expectCanAdd: true,
  },
  {
    name: 'friday - morning only',
    date: '2026-06-26',
    bookings: [] as { timeOfDay?: string }[],
    expectBookable: ['morning'],
    expectCanAdd: true,
  },
  {
    name: 'shabbat option evening only',
    date: '2026-06-27',
    bookings: [{ timeOfDay: 'evening|18:00 - 00:00' }],
    expectBookable: [] as string[],
    expectCanAdd: false,
  },
  {
    name: 'weekday option evening - morning free',
    date: '2026-06-25',
    bookings: [{ timeOfDay: 'evening|18:00 - 00:00' }],
    expectBookable: ['morning', 'noon'],
    expectCanAdd: true,
  },
  {
    name: 'full day booked',
    date: '2026-06-25',
    bookings: [{ timeOfDay: 'morning' }, { timeOfDay: 'noon' }, { timeOfDay: 'evening' }],
    expectBookable: [] as string[],
    expectCanAdd: false,
  },
];

let failed = 0;
for (const c of cases) {
  const parsed = parseDateLocal(c.date);
  const bookable = getBookableSlotsForDate(parsed, c.bookings);
  const canAdd = bookable.length > 0;
  const ok =
    JSON.stringify(bookable) === JSON.stringify(c.expectBookable)
    && canAdd === c.expectCanAdd;
  if (!ok) {
    failed++;
    console.error('FAIL', c.name, { bookable, canAdd, expectBookable: c.expectBookable });
  } else {
    console.log('OK', c.name);
  }
}

if (failed > 0) {
  throw new Error(`${failed} case(s) failed`);
}
console.log('ALL PASSED');
