const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const start = new Date('2026-02-01T00:00:00Z');
  const end = new Date('2026-03-01T00:00:00Z');

  const total = await prisma.study.count({
    where: { report_dt: { gte: start, lt: end } }
  });

  const unmapped = await prisma.study.count({
    where: { 
      report_dt: { gte: start, lt: end },
      mapping_confidence: { in: ['UNMAPPED', 'MANUAL'] }
    }
  });

  console.log(`February 2026 Progress:`);
  console.log(`- Total Studies: ${total}`);
  console.log(`- Unmapped/Manual: ${unmapped}`);
  console.log(`- Mapped: ${total - unmapped}`);
}

check().catch(console.error).finally(() => prisma.$disconnect());
