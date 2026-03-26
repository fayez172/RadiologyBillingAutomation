const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const instances = await prisma.dbInstance.findMany({
      where: { is_active: true }
    });
    console.log('Active Instances:', instances.length);
    instances.forEach(i => console.log(`- ${i.id}: ${i.name} (${i.ip})`));
  } catch (err) {
    console.error('Error fetching instances:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
