/**
 * בדיקת 100% — אין שני אירועים/אופציות על אותו תאריך + משבצת.
 * הרצה: npm run verify:double-booking
 * אופציונלי (שרת רץ): npm run verify:double-booking -- --api
 */
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const TEST_DATE = new Date('2027-08-03T12:00:00'); // יום שלישי
const TEST_DATE_KEY = '2027-08-03';
const API_URL = process.env.API_URL || 'http://localhost:5000/api';
const runApi = process.argv.includes('--api');

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function checkUniqueIndex(): Promise<void> {
  const rows = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'Booking'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%calendarDateId%'
      AND indexdef ILIKE '%timeSlot%'
  `;
  assert(rows.length > 0, 'חסר UNIQUE INDEX על (calendarDateId, timeSlot) — הריצי migration 20250621120000');
  console.log(`✅ אינדקס ייחודי קיים: ${rows[0].indexname}`);
}

async function cleanup() {
  const eventDates = await prisma.eventDate.findMany({
    where: {
      date: {
        gte: new Date(TEST_DATE_KEY + 'T00:00:00'),
        lte: new Date(TEST_DATE_KEY + 'T23:59:59'),
      },
    },
  });
  for (const ed of eventDates) {
    await prisma.booking.deleteMany({ where: { calendarDateId: ed.id } });
    await prisma.eventDate.delete({ where: { id: ed.id } });
  }
}

async function testDbParallelInsert(): Promise<void> {
  await cleanup();
  const eventDate = await prisma.eventDate.create({
    data: { date: TEST_DATE, status: 'AVAILABLE' },
  });

  const base = {
    clientAFullName: 'בדיקת כפילות',
    clientAIdNumber: '000000000',
    clientAPhone: '050-0000000',
    calendarDateId: eventDate.id,
    eventType: 'חתונה',
    timeOfDay: 'evening|18:00 - 00:00',
    timeSlot: 'evening',
    guestCount: 100,
    finalPricePortion: 200,
    totalPrice: 20000,
    eventCode: 'TEST-DB-001',
    createdBy: 'verify-script',
    isOption: true,
  };

  const results = await Promise.allSettled([
    prisma.booking.create({ data: { ...base, eventCode: 'TEST-DB-A' } }),
    prisma.booking.create({ data: { ...base, eventCode: 'TEST-DB-B' } }),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

  assert(fulfilled.length === 1, `ציפינו ל-1 הצלחה ב-DB, קיבלנו ${fulfilled.length}`);
  assert(rejected.length === 1, `ציפינו ל-1 כישלון ב-DB, קיבלנו ${rejected.length}`);

  const err = rejected[0].reason;
  assert(
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002',
    `כישלון DB צריך להיות P2002, קיבלנו: ${err}`,
  );

  const count = await prisma.booking.count({ where: { calendarDateId: eventDate.id, timeSlot: 'evening' } });
  assert(count === 1, `ציפינו לרשומה אחת בערב, יש ${count}`);

  console.log('✅ מרוץ DB — רק הזמנה אחת נשמרה, השנייה נחסמה ב-P2002');
  await cleanup();
}

async function testDifferentSlotsAllowed(): Promise<void> {
  await cleanup();
  const eventDate = await prisma.eventDate.create({
    data: { date: TEST_DATE, status: 'AVAILABLE' },
  });

  await prisma.booking.create({
    data: {
      clientAFullName: 'בוקר',
      clientAIdNumber: '111',
      clientAPhone: '050-1',
      calendarDateId: eventDate.id,
      eventType: 'חתונה',
      timeOfDay: 'morning|08:00 - 12:00',
      timeSlot: 'morning',
      guestCount: 50,
      finalPricePortion: 200,
      totalPrice: 10000,
      eventCode: 'TEST-SLOT-M',
      createdBy: 'verify-script',
    },
  });

  await prisma.booking.create({
    data: {
      clientAFullName: 'ערב',
      clientAIdNumber: '222',
      clientAPhone: '050-2',
      calendarDateId: eventDate.id,
      eventType: 'חתונה',
      timeOfDay: 'evening|18:00 - 00:00',
      timeSlot: 'evening',
      guestCount: 50,
      finalPricePortion: 200,
      totalPrice: 10000,
      eventCode: 'TEST-SLOT-E',
      createdBy: 'verify-script',
    },
  });

  const count = await prisma.booking.count({ where: { calendarDateId: eventDate.id } });
  assert(count === 2, `משבצות שונות — ציפינו ל-2, יש ${count}`);
  console.log('✅ בוקר + ערב באותו יום — מותר (2 רשומות)');
  await cleanup();
}

function authHeaders(): Record<string, string> {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET חסר');

  const token = jwt.sign(
    { email: 'verify@maple.test', role: 'manager', name: 'בדיקה', type: 'access' },
    secret,
    { expiresIn: '1h' },
  );
  const csrf = 'verify-double-booking-csrf';
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    Cookie: `maple_csrf=${csrf}`,
    'x-csrf-token': csrf,
  };
}

async function testApiRace(): Promise<void> {
  const headers = authHeaders();

  await cleanup();

  const payload = {
    clientAFullName: 'מרוץ API',
    clientAIdNumber: '333444555',
    clientAPhone: '050-7778888',
    eventType: 'חתונה',
    guestCount: 200,
    finalPricePortion: 200,
    timeOfDay: 'evening',
    isOption: true,
    allSelectedDates: [{ date: TEST_DATE_KEY }],
    createdBy: 'verify-script',
  };

  const [a, b] = await Promise.all([
    fetch(`${API_URL}/bookings`, { method: 'POST', headers, body: JSON.stringify({ ...payload, clientAFullName: 'מנהל א' }) }).then(async (r) => ({ ok: r.ok, status: r.status, data: await r.json() })),
    fetch(`${API_URL}/bookings`, { method: 'POST', headers, body: JSON.stringify({ ...payload, clientAFullName: 'מנהל ב' }) }).then(async (r) => ({ ok: r.ok, status: r.status, data: await r.json() })),
  ]);

  const okCount = [a, b].filter((r) => r.ok).length;
  assert(okCount === 1, `מרוץ API: ציפינו ל-1 הצלחה, קיבלנו ${okCount} (א=${a.status}, ב=${b.status})`);

  const fail = [a, b].find((r) => !r.ok)!;
  assert(fail.status === 400 || fail.status === 409, `מרוץ API: כישלון צריך 400/409, קיבלנו ${fail.status}`);

  const eventDates = await prisma.eventDate.findMany({
    where: { date: TEST_DATE },
    include: { bookings: { where: { timeSlot: 'evening' } } },
  });
  const eveningCount = eventDates.reduce((n, ed) => n + ed.bookings.length, 0);
  assert(eveningCount === 1, `מרוץ API: ציפינו ל-1 הזמנה בערב, יש ${eveningCount}`);

  console.log(`✅ מרוץ API — אחד הצליח, השני נחסם (${fail.status}): ${fail.data.message || ''}`);
  await cleanup();
}

async function main() {
  console.log('🔒 בדיקת 100% — מניעת כפילות תאריך+משבצת\n');

  await checkUniqueIndex();
  await testDbParallelInsert();
  await testDifferentSlotsAllowed();

  if (runApi) {
    try {
      await testApiRace();
    } catch (e) {
      console.error('❌ מרוץ API נכשל:', (e as Error).message);
      process.exit(1);
    }
  } else {
    console.log('ℹ️  לבדיקת API: npm run verify:double-booking -- --api (עם שרver על פורט 5000)');
  }

  console.log('\n🎉 כל הבדיקות עברו — אין סיכוי לשני אירועים על אותה משבצת.');
}

main()
  .catch((e) => {
    console.error('\n❌ נכשל:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
