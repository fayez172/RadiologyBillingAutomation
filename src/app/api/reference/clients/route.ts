import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { error as apiError, success } from '@/lib/api-response';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const clients = await prisma.client.findMany({
      where: { is_active: true },
      select: { id: true, name: true }
    });
    
    return success(clients);
  } catch (error) {
    console.error('[REF_CLIENTS_GET]', error);
    return apiError('INTERNAL_ERROR', 'Failed to fetch clients', 500);
  }
}
