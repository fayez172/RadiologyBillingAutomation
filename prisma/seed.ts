import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create default admin user
  const passwordHash = await bcrypt.hash('Admin1234!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'fayez@rsb.com.bd' },
    update: {},
    create: {
      email: 'fayez@rsb.com.bd',
      name: 'Fayez',
      password_hash: passwordHash,
      role: 'ADMIN',
      is_active: true,
    },
  });
  console.log(`  ✅ Admin user: ${admin.email} (${admin.role})`);

  // 2. Seed test MSSQL instance (if env vars present)
  const {
    TEST_MSSQL_IP,
    TEST_MSSQL_PORT,
    TEST_MSSQL_USER,
    TEST_MSSQL_PASS,
    TEST_MSSQL_REPORTING_DB,
    TEST_MSSQL_RADIOLOGY_DB,
    TEST_MSSQL_INSTANCE_NAME,
  } = process.env;

  if (TEST_MSSQL_IP && TEST_MSSQL_INSTANCE_NAME) {
    // Simple encryption for seed — in prod use proper AES-256-GCM
    const { encrypt } = await import('../src/lib/encryption');
    const encryptedPassword = encrypt(TEST_MSSQL_PASS || '');

    const instance = await prisma.dbInstance.upsert({
      where: { name: TEST_MSSQL_INSTANCE_NAME },
      update: {},
      create: {
        name: TEST_MSSQL_INSTANCE_NAME,
        ip: TEST_MSSQL_IP,
        port: parseInt(TEST_MSSQL_PORT || '1433'),
        username: TEST_MSSQL_USER || 'sa',
        password_encrypted: encryptedPassword,
        reporting_db: TEST_MSSQL_REPORTING_DB || 'RADSpaRISReportingDB',
        radiology_db: TEST_MSSQL_RADIOLOGY_DB || 'RADSpaRISRadiologyDB',
        is_active: true,
      },
    });
    console.log(`  ✅ DB Instance: ${instance.name} (${instance.ip}:${instance.port})`);
  } else {
    console.log('  ⏭️  Skipping DB instance seed (no TEST_MSSQL env vars)');
  }

  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
