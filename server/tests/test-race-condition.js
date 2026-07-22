/**
 * בדיקת מרוץ: שני מנהלים מנסים לתפוס את אותו תאריך/משבצת במקביל
 * דורש: שרת רץ + JWT_SECRET ב-.env
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_URL = 'http://localhost:5000/api';
const TEST_DATE = '2027-07-06'; // יום שלישי — לא שבת, לא ספירה

function authHeaders() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET חסר ב-.env');
  const token = jwt.sign(
    { email: 'race-test@maple.test', role: 'manager', name: 'טסט מרוץ' },
    secret,
    { expiresIn: '1h' }
  );
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const basePayload = {
  clientAFullName: 'לקוח טסט מרוץ',
  clientAIdNumber: '111222333',
  clientAPhone: '050-9998877-RACE',
  eventType: 'חתונה',
  guestCount: 300,
  finalPricePortion: 300,
  timeOfDay: 'evening',
  isOption: true,
  allSelectedDates: [{ date: TEST_DATE }],
  createdBy: 'טסט אוטומטי',
};

async function cleanup() {
  const [y, m, d] = TEST_DATE.split('-').map(Number);
  const dayStart = new Date(y, m - 1, d, 0, 0, 0);
  const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);
  const eventDates = await prisma.eventDate.findMany({
    where: { date: { gte: dayStart, lte: dayEnd } },
    include: { bookings: true },
  });
  for (const eventDate of eventDates) {
    await prisma.booking.deleteMany({ where: { calendarDateId: eventDate.id } });
    await prisma.eventDate.delete({ where: { id: eventDate.id } });
  }
}

async function createOption(label) {
  const res = await fetch(`${API_URL}/bookings`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ ...basePayload, clientAFullName: `${basePayload.clientAFullName} (${label})` }),
  });
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function checkCalendar() {
  const res = await fetch(`${API_URL}/calendar/dates?start=${TEST_DATE}&end=${TEST_DATE}&eventType=חתונה`);
  const days = await res.json();
  return days.find((d) => d.date === TEST_DATE);
}

async function run() {
  console.log('🏁 בדיקת מרוץ — שני מנהלים על אותו תאריך\n');
  const headers = authHeaders();

  await cleanup();

  console.log('1️⃣ שולח 2 בקשות POST במקביל לאותו תאריך (ערב)...');
  const [a, b] = await Promise.all([createOption('מנהל א'), createOption('מנהל ב')]);

  const successes = [a, b].filter((r) => r.ok);
  const failures = [a, b].filter((r) => !r.ok);

  console.log(`   מנהל א: ${a.ok ? '✅ הצליח' : '❌ נחסם'} (${a.status}) ${a.data.message || ''}`);
  console.log(`   מנהל ב: ${b.ok ? '✅ הצליח' : '❌ נחסם'} (${b.status}) ${b.data.message || ''}`);

  if (successes.length !== 1 || failures.length !== 1) {
    throw new Error(`ציפינו ל-1 הצלחה ו-1 כישלון, קיבלנו ${successes.length}/${failures.length}`);
  }
  const failStatus = failures[0].status;
  if (failStatus !== 400 && failStatus !== 409) {
    console.warn(`   ⚠️ המנהל השני נחסם עם סטטוס ${failStatus} (מצופה 400/409)`);
  }
  console.log('   ✅ מניעת כפילות בשרת עובדת\n');

  const day = await checkCalendar();
  const eveningTaken = (day?.bookings || []).some((b) => {
    const tod = String(b.timeOfDay || b.timeSlot || '');
    return tod.startsWith('evening') || tod.includes('ערב');
  });
  if (!eveningTaken) throw new Error(`משבצת ערב לא מסומנת כתפוסה בלוח. bookings=${JSON.stringify(day?.bookings || [])}`);
  console.log('2️⃣ לוח השנה מציג את התאריך כתפוס — ✅\n');

  console.log('3️⃣ מנהל ג מנסה לשמור אופציה על אותו תאריך אחרי שנתפס...');
  const late = await createOption('מנהל ג');
  if (late.ok) throw new Error('מנהל שלישי הצליח — לא אמור!');
  console.log(`   ❌ נחסם כצפוי (${late.status}): ${late.data.message}\n`);

  console.log('4️⃣ בדיקת API זמינות — resolveOptionDate logic...');
  const calRes = await fetch(`${API_URL}/calendar/dates?start=${TEST_DATE}&end=${TEST_DATE}&eventType=חתונה`);
  const calData = await calRes.json();
  const srvDay = calData[0];
  const hasEveningBooking = (srvDay.bookings || []).some((b) => {
    const tod = String(b.timeOfDay || b.timeSlot || '');
    return tod.startsWith('evening') || tod.includes('ערב');
  });
  if (!hasEveningBooking) throw new Error('API לא מחזיר booking בערב');
  console.log('   ✅ API מחזיר bookings מעודכנים — הלקוח יחסום בחירה\n');

  await cleanup();
  console.log('🎉 כל בדיקות המרוץ עברו בהצלחה!');
  await prisma.$disconnect();
}

run().catch(async (e) => {
  console.error('\n❌ נכשל:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
