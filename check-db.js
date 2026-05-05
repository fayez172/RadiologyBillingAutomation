const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const userCount = await prisma.user.count();
    console.log('UserCount:', userCount);
    
    const users = await prisma.user.findMany({
      select: { email: true, role: true }
    });
    process.stdout.write('Users: ' + JSON.stringify(users) + '\n');

    const instances = await prisma.dbInstance.findMany({
      select: { name: true, is_active: true }
    });
    process.stdout.write('Instances: ' + JSON.stringify(instances) + '\n');

  } catch (err) {
    console.error('Check script failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
