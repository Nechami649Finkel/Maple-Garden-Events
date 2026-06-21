/**
 * One-time migration: assign EVT-/OPT- codes to bookings with legacy eventCode values.
 *
 * Usage (from server/):
 *   npm run migrate:event-codes
 *   npm run migrate:event-codes -- --dry-run
 */
import dotenv from 'dotenv';
import prisma from '../src/config/prisma';
import {
  allocateEventCode,
  formatEventCode,
  initOrderSequence,
  isFormattedEventCode,
  type EventCodePrefix,
} from '../src/utils/eventCode';

dotenv.config();

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is missing. Run from server/ with a valid .env file.');
    process.exit(1);
  }

  console.log(dryRun ? '🔍 Dry run — no changes will be saved.' : '🔄 Migrating legacy event codes...');

  await initOrderSequence();

  const legacyBookings = await prisma.booking.findMany({
    where: {},
    select: {
      id: true,
      eventCode: true,
      eventType: true,
      isOption: true,
      createdAt: true,
      clientAFullName: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const toMigrate = legacyBookings.filter((b) => !isFormattedEventCode(b.eventCode));

  if (toMigrate.length === 0) {
    console.log('✅ No legacy event codes found. All bookings already use EVT-/OPT- format.');
    return;
  }

  console.log(`Found ${toMigrate.length} booking(s) to migrate:\n`);

  const updates: { id: string; oldCode: string; newCode: string; prefix: EventCodePrefix }[] = [];

  let simulatedNext = (
    await prisma.systemSettings.findUnique({ where: { id: 'global' } })
  )?.nextEventNumber ?? 0;

  for (const booking of toMigrate) {
    const prefix: EventCodePrefix = booking.isOption ? 'OPT' : 'EVT';
    let newCode: string;
    if (dryRun) {
      simulatedNext += 1;
      newCode = formatEventCode(prefix, simulatedNext);
    } else {
      newCode = await allocateEventCode(prefix);
    }

    updates.push({
      id: booking.id,
      oldCode: booking.eventCode,
      newCode,
      prefix,
    });

    console.log(
      `  ${booking.clientAFullName || '—'} | ${booking.eventType} | ${booking.createdAt.toISOString().slice(0, 10)}`,
    );
    console.log(`    ${booking.eventCode}  →  ${newCode}\n`);

    if (!dryRun) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { eventCode: newCode },
      });
    }
  }

  if (dryRun) {
    console.log(`Would update ${toMigrate.length} booking(s). Re-run without --dry-run to apply.`);
    return;
  }

  console.log(`✅ Migrated ${updates.length} booking(s) successfully.`);
}

main()
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
