require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const all = await prisma.eventDate.findMany({
    where: { date: { gte: new Date(2027, 3, 1), lte: new Date(2027, 3, 31, 23, 59, 59) } },
    include: { bookings: true },
  });
  console.log('DB records:', JSON.stringify(all.map(d => ({
    id: d.id,
    date: d.date.toISOString(),
    status: d.status,
    bookings: d.bookings.map(b => ({ timeOfDay: b.timeOfDay, timeSlot: b.timeSlot })),
  })), null, 2));

  const res = await fetch('http://localhost:5000/api/calendar/dates?start=2027-04-12&end=2027-04-12&eventType=חתונה');
  const cal = await res.json();
  console.log('Calendar API:', JSON.stringify(cal, null, 2));
}

main().finally(() => prisma.$disconnect());
