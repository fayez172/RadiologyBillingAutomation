import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { error as apiError, success } from '@/lib/api-response';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const sources = await prisma.remoteStudySource.findMany({
      select: {
        id: true,
        name: true,
        client_id: true,
        remote_id: true,
        instance_id: true,
      },
      orderBy: { name: 'asc' }
    });
    
    return success(sources);
  } catch (error) {
    console.error('[REF_STUDY_SOURCES_GET]', error);
    return apiError('INTERNAL_ERROR', 'Failed to fetch study sources', 500);
  }
}
