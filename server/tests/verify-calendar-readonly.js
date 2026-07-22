require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const bookings = await prisma.booking.findMany({
    take: 5,
    include: { eventDate: true },
    orderBy: { createdAt: 'desc' },
  });
  for (const b of bookings) {
    if (!b.eventDate) continue;
    const d = b.eventDate.date;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const res = await fetch(`http://localhost:5000/api/calendar/dates?start=${key}&end=${key}&eventType=חתונה`);
    const cal = await res.json();
    const day = cal[0];
    console.log(key, 'DB status:', b.eventDate.status, 'API status:', day?.status, 'API bookings:', day?.bookings?.length ?? 0);
  }
}

main().finally(() => prisma.$disconnect());
