import { prisma } from '../src/lib/prisma';
import { syncStudies } from '../src/lib/sync-engine';

async function main() {
  console.log('📅 Fetching studies for February 2026...');
  
  const instances = await prisma.dbInstance.findMany({
    where: { is_active: true }
  });

  if (instances.length === 0) {
    console.log('❌ No active instances found.');
    return;
  }

  const dateFrom = new Date('2026-02-01T00:00:00Z');
  const dateTo = new Date('2026-03-01T00:00:00Z'); // Exclusive

  for (const instance of instances) {
    console.log(`📡 Syncing instance: ${instance.name} (${instance.ip})...`);
    try {
      const result = await syncStudies(instance.id, dateFrom, dateTo);
      console.log(`✅ Success for ${instance.name}:`);
      console.log(`   - Total fetched: ${result.fetched}`);
      console.log(`   - New studies: ${result.new}`);
      console.log(`   - Updated studies: ${result.updated}`);
    } catch (err) {
      console.error(`❌ Sync failed for ${instance.name}:`, err);
    }
  }

  console.log('🏁 Batch sync complete!');
}

main()
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
