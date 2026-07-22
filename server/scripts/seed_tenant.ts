import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial Multi-Tenant database...');

  // 1. Create Default Tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Maple HQ',
      subdomain: 'maple',
      isActive: true,
    },
  });

  console.log(`✅ Tenant created: ${tenant.name} (ID: ${tenant.id})`);

  // 2. Create Global System Settings for this Tenant
  await prisma.systemSettings.create({
    data: {
      id: 'global', // Retaining original logic for backward compatibility
      tenantId: tenant.id,
      nextEventNumber: 1000,
    },
  });

  console.log('✅ System Settings initialized');

  // 3. Create Admin User
  const adminEmail = 'admin@maple.com'; // Replace with your actual admin email
  await prisma.authorizedUser.create({
    data: {
      email: adminEmail,
      role: 'production',
      tenantId: tenant.id,
    },
  });

  console.log(`✅ Admin User created: ${adminEmail}`);
  console.log('\n🚀 Database is now Multi-Tenant Ready!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
