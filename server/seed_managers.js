const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const emails = ['miriamm41344@gmail.com', 'miryamilandman@gmail.com'];
  
  // Create or get the first tenant
  let tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Maple Garden Events',
        subdomain: 'maple',
        isActive: true,
      }
    });
    console.log('Created tenant:', tenant);
  } else {
    console.log('Found existing tenant:', tenant);
  }

  for (const email of emails) {
    const user = await prisma.authorizedUser.upsert({
      where: { email },
      update: { role: 'manager', tenantId: tenant.id },
      create: {
        email,
        role: 'manager',
        tenantId: tenant.id
      }
    });
    console.log(`Ensured user exists: ${user.email} as ${user.role}`);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
