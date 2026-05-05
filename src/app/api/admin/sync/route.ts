import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { error, success } from '@/lib/api-response';
import { syncReferenceData, syncStudies } from '@/lib/sync-engine';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return error('UNAUTHORIZED', 'Admin access required', 401);
    }

    const { instanceId } = await req.json();

    const instances = await prisma.dbInstance.findMany({
      where: instanceId ? { id: instanceId, is_active: true } : { is_active: true }
    });

    if (instances.length === 0) {
      return error('NOT_FOUND', 'No active instances found to sync', 404);
    }

    const results = [];
    for (const instance of instances) {
      try {
        await syncReferenceData(instance.id);
        
        // Full sync or last 30 days if null
        const result = await syncStudies(instance.id);
        results.push({ instance: instance.name, status: 'success', detail: result });
      } catch (err: any) {
        results.push({ instance: instance.name, status: 'error', error: err.message });
      }
    }

    return success({ processed: instances.length, results });

  } catch (err: any) {
    return error('INTERNAL_ERROR', err.message, 500);
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return error('UNAUTHORIZED', 'Admin access required', 401);
    }

    // 1. Delete all transactional data
    // Order matters because of foreign keys
    await prisma.invoiceLine.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.study.deleteMany({});
    
    // 2. Clear remote reference data to ensure fresh pull
    await prisma.remoteProcedure.deleteMany({});
    await prisma.remoteModality.deleteMany({});
    await prisma.remoteStudySource.deleteMany({});
    await prisma.remoteRadiologist.deleteMany({});
    
    // 3. Reset sync markers
    await prisma.dbInstance.updateMany({
      data: { last_synced_at: null }
    });

    return success({ message: 'System data reset successful. You can now start a fresh sync.' });

  } catch (err: any) {
    return error('INTERNAL_ERROR', err.message, 500);
  }
}
