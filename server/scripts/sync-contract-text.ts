/**
 * Sync brand default contract text into systemSettings.
 *
 * Usage (from server/):
 *   npm run sync:contract-text
 *   npm run sync:contract-text -- --dry-run
 */
import dotenv from 'dotenv';
import prisma from '../src/config/prisma';
import { DEFAULT_CONTRACT_TEXT } from '../src/utils/defaultContractText';

dotenv.config();

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing. Run from server/ with a valid .env file.');
    process.exit(1);
  }

  console.log(`Default contract text length: ${DEFAULT_CONTRACT_TEXT.length} chars`);
  console.log(`Includes annex placeholder: ${DEFAULT_CONTRACT_TEXT.includes('{{CONTRACT_ANNEX}}')}`);

  const rows = await prisma.systemSettings.findMany({
    select: { id: true, tenantId: true, contractText: true },
  });

  if (rows.length === 0) {
    console.log('No systemSettings rows found. Create settings via the app first, or seed a tenant.');
    return;
  }

  for (const row of rows) {
    console.log(
      `Row id=${row.id} tenantId=${row.tenantId} currentLength=${row.contractText?.length ?? 0}`,
    );
  }

  if (dryRun) {
    console.log('Dry run — no DB changes.');
    return;
  }

  const result = await prisma.systemSettings.updateMany({
    data: { contractText: DEFAULT_CONTRACT_TEXT },
  });

  console.log(`Updated ${result.count} systemSettings row(s).`);
  console.log('New bookings / contract template will use the updated fixed terms.');
  console.log('Existing bookings keep their stored contractText until re-saved.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
