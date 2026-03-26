import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { error as apiError, success } from '@/lib/api-response';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const procs = await prisma.remoteProcedure.groupBy({
      by: ['procedure_code', 'name'],
      where: { is_active: true },
    });
    
    const unique = new Map();
    procs.forEach((p: any) => {
      const key = p.name;
      if (key && !unique.has(key)) {
        unique.set(key, { name: p.name, code: p.procedure_code });
      }
    });

    return success(Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name)));
  } catch (error) {
    console.error('[REF_PROCEDURES_GET]', error);
    return apiError('INTERNAL_ERROR', 'Failed to fetch procedures', 500);
  }
}
