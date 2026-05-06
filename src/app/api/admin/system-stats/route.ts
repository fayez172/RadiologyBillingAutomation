import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { success, error } from '@/lib/api-response';
import { getAgentStatus } from '@/lib/agent-utils';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return error('UNAUTHORIZED', 'Unauthorized', 401);
    }

    // 1. Instance Stats
    const instances = await prisma.dbInstance.findMany({
      select: {
        id: true,
        name: true,
        is_active: true,
        last_synced_at: true,
        agent_mode: true,
        agent_last_seen_at: true,
      }
    });

    // 2. Reference Data Counts
    const [modalities, procedures, sources, radiologists, studies] = await Promise.all([
      (prisma as any).remoteModality.count(),
      (prisma as any).remoteProcedure.count(),
      (prisma as any).remoteStudySource.count(),
      prisma.radiologist.count(),
      prisma.study.count(),
    ]);

    // 3. Find global last sync
    const lastSyncAt = instances.reduce((latest: Date | null, inst: any) => {
      if (!inst.last_synced_at) return latest;
      if (!latest) return inst.last_synced_at;
      return inst.last_synced_at > latest ? inst.last_synced_at : latest;
    }, null);

    return success({
      instances: instances.map((inst: any) => ({
        ...inst,
        status: getAgentStatus(inst)
      })),
      counts: {
        modalities,
        procedures,
        sources,
        radiologists,
        studies
      },
      lastSyncAt,
      databaseSize: 'N/A' // PostgreSQL doesn't easily expose this via Prisma without raw query
    });
  } catch (err: any) {
    console.error('API Error [SystemStats]:', err);
    return error('INTERNAL_ERROR', err.message, 500);
  }
}
