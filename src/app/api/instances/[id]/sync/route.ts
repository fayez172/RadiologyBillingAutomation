import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { success, error } from '@/lib/api-response';
import { syncReferenceData, syncStudies } from '@/lib/sync-engine';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return error('UNAUTHORIZED', 'Admin access required', 403);
    }

    const { id } = params;

    // 1. Sync Reference Data First (Radiologists, Modalities, Hospitals)
    await syncReferenceData(id);

    // 2. Sync Studies
    const result = await syncStudies(id);

    return success(result);
  } catch (e: any) {
    console.error('Sync error:', e);
    return error('SYNC_FAILED', Object.keys(e).length > 0 ? e.message || 'Sync failed' : 'Unknown error occurred during sync');
  }
}
