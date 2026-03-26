import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncReferenceData, syncStudies } from '@/lib/sync-engine';

export const maxDuration = 300; // Vercel maximum duration (5 mins)

export async function GET(req: Request) {
  // Enforce auth for cron. CRON_SECRET must be set in production.
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('[CRON] Unauthorized access attempt or CRON_SECRET not set');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const instanceId = searchParams.get('instanceId');
    const force = searchParams.get('force') === 'true';

    // Determine current hour in Bangladesh (GMT+6) regardless of server location
    const bdtTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date());

    const [currentHour, currentMinute] = bdtTime.split(':');
    const currentTime = bdtTime;
    
    // Find instances to sync
    const instances = await prisma.dbInstance.findMany({
      where: instanceId 
        ? { id: instanceId, is_active: true }
        : { is_active: true, auto_sync: true }
    });

    const instancesToSync = force ? instances : instances.filter(inst => {
      // Check if current time (HH:MM) matches configured sync time (HH:MM)
      return (inst as any).sync_time === currentTime || (inst as any).sync_time?.startsWith(currentHour);
    });

    if (instancesToSync.length === 0) {
      return NextResponse.json({ 
        message: force 
          ? (instanceId ? `Instance ${instanceId} not found or not active.` : 'No active instances found.') 
          : `No instances configured to sync at hour ${currentHour} (Now: ${currentTime})` 
      });
    }

    console.log(`[CRON] Starting sync for ${instancesToSync.length} instances...`);

    const results = [];

    for (const instance of instancesToSync) {
      try {
        console.log(`[CRON] Starting sync for instance: ${instance.name}`);
        
        // 1. Sync Reference Data (Modalities, Procedures, Radiologists, Clients)
        await syncReferenceData(instance.id);
        
        // 2. Sync Studies (Last 4 days for safety)
        const toDate = new Date();
        const fromDate = new Date(toDate);
        fromDate.setDate(fromDate.getDate() - 4);
        
        await syncStudies(instance.id, fromDate, toDate);

        // Update last synced
        await prisma.dbInstance.update({
          where: { id: instance.id },
          data: { last_synced_at: new Date() }
        });

        results.push({ instance: instance.name, status: 'success' });
      } catch (err: any) {
        console.error(`[CRON] Error syncing instance ${instance.name}:`, err);
        results.push({ instance: instance.name, status: 'error', error: err.message });
      }
    }

    return NextResponse.json({ 
      message: `Cron sync completed at ${currentTime}`, 
      processed: instancesToSync.length,
      results 
    });

  } catch (err: any) {
    console.error('[CRON] Fatal Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
