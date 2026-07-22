/**
 * Seed authorized users for Go-Live (all manager role per GO-LIVE-DECISIONS.md).
 *
 * Usage (from server/):
 *   AUTHORIZED_USERS_EMAILS=admin@example.com,staff@example.com npm run seed:authorized-users
 *   npm run seed:authorized-users -- --dry-run
 */
import dotenv from 'dotenv';
import prisma from '../src/config/prisma';

dotenv.config();

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const raw = process.env.AUTHORIZED_USERS_EMAILS?.trim();

  if (!raw) {
    console.error('❌ Set AUTHORIZED_USERS_EMAILS (comma-separated emails).');
    process.exit(1);
  }

  const emails = [...new Set(
    raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
  )];

  if (emails.length === 0) {
    console.error('❌ No valid emails in AUTHORIZED_USERS_EMAILS.');
    process.exit(1);
  }

  console.log(dryRun ? '🔍 Dry run — no DB changes.' : '🌱 Seeding authorized users (role=manager)...');

  for (const email of emails) {
    if (dryRun) {
      console.log(`  would upsert: ${email} → manager`);
      continue;
    }

    const user = await prisma.authorizedUser.upsert({
      where: { email },
      create: { email, role: 'manager' },
      update: { role: 'manager' },
    });
    console.log(`  ✅ ${user.email} (${user.role})`);
  }

  console.log(`\nDone — ${emails.length} user(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
