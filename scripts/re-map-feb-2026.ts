import { prisma } from '../src/lib/prisma';
import { mapUnmappedStudies } from '../src/lib/mapping-engine';

async function main() {
  console.log('🧠 Re-mapping studies for February 2026...');
  
  const result = await mapUnmappedStudies();
  
  console.log('✅ Mapping complete!');
  console.log(`   - Total processed: ${result.total_processed}`);
  console.log(`   - Successfully mapped: ${result.mapped}`);
}

main()
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
