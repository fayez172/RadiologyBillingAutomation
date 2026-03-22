import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { success, error } from '@/lib/api-response';
import { mapUnmappedStudies } from '@/lib/mapping-engine';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return error('UNAUTHORIZED', 'Unauthorized', 401);

    const body = await req.json().catch(() => ({}));
    const instanceId = body.instanceId;

    const result = await mapUnmappedStudies(instanceId);

    return success(result, { message: 'Mapping engine completed successfully' });
  } catch (err: any) {
    console.error('[MAPPING-RUN API]', err);
    return error('INTERNAL_ERROR', err.message || 'Internal server error', 500);
  }
}
