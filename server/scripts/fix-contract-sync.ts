/**
 * One-time fix: bookings marked as signed without a stored signature image.
 *
 * Usage (from server/):
 *   npm run fix:contract-sync
 *   npm run fix:contract-sync -- --dry-run
 */
import dotenv from 'dotenv';
import prisma from '../src/config/prisma';

dotenv.config();

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing. Run from server/ with a valid .env file.');
    process.exit(1);
  }

  const inconsistent = await prisma.booking.findMany({
    where: { isContractSigned: true, clientSignatureUrl: null },
    select: { id: true, eventCode: true, clientAFullName: true },
    orderBy: { eventCode: 'asc' },
  });

  console.log(`Found ${inconsistent.length} booking(s) with isContractSigned=true but no clientSignatureUrl:`);
  inconsistent.forEach((b) => {
    console.log(`  - ${b.eventCode || b.id} (${b.clientAFullName})`);
  });

  if (inconsistent.length === 0) {
    console.log('Nothing to fix.');
    return;
  }

  if (dryRun) {
    console.log('Dry run — no changes saved. Re-run without --dry-run to set isContractSigned=false.');
    return;
  }

  const result = await prisma.booking.updateMany({
    where: { isContractSigned: true, clientSignatureUrl: null },
    data: { isContractSigned: false },
  });

  console.log(`Fixed ${result.count} booking(s). Users must re-sign via edit booking.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
