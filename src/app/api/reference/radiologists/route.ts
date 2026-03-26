import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { error as apiError, success } from '@/lib/api-response';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const rads = await prisma.radiologist.findMany({
      where: { is_active: true },
      select: { id: true, name: true }
    });
    
    return success(rads);
  } catch (error) {
    console.error('[REF_RADIOLOGISTS_GET]', error);
    return apiError('INTERNAL_ERROR', 'Failed to fetch radiologists', 500);
  }
}
