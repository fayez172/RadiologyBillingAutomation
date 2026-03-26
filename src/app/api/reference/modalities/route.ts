import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { error as apiError, success } from '@/lib/api-response';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const mods = await prisma.remoteModality.groupBy({
      by: ['code', 'display_name'],
      where: { is_active: true },
    });
    
    const unique = new Map();
    mods.forEach((m: any) => {
      const key = m.code || m.display_name;
      if (!unique.has(key)) {
        unique.set(key, { id: key, name: m.display_name, code: m.code });
      }
    });

    return success(Array.from(unique.values()));
  } catch (error) {
    console.error('[REF_MODALITIES_GET]', error);
    return apiError('INTERNAL_ERROR', 'Failed to fetch modalities', 500);
  }
}
