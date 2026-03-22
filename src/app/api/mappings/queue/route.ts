import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { error, success } from '@/lib/api-response';


export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return error('UNAUTHORIZED', 'Unauthorized', 401);

    const { searchParams } = new URL(req.url);
    const instanceId = searchParams.get('instanceId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = 50;

    const where: any = {
      is_duplicate: false,
      mapping_confidence: {
        in: ['UNMAPPED', 'MANUAL']
      }
    };
    if (instanceId) {
      where.instance_id = instanceId;
    }

    const total = await prisma.study.count({ where });
    const studies = await prisma.study.findMany({
      where,
      orderBy: { report_dt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        instance: { select: { name: true } }
      }
    });

    return success({ studies, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) {
    return error('INTERNAL_ERROR', err.message, 500);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return error('UNAUTHORIZED', 'Unauthorized', 401);

    // Manual mapping assignment for a study
    const body = await req.json();
    const { studyId, type, type_dr } = body;

    if (!studyId || !type || !type_dr) {
      return error('BAD_REQUEST', 'Missing fields', 400);
    }

    const study = await prisma.study.update({
      where: { id: studyId },
      data: {
        type: type.trim(),
        type_dr: type_dr.trim(),
        mapping_confidence: 'MANUAL'
      } as any
    });

    return success(study);
  } catch (err: any) {
    return error('INTERNAL_ERROR', err.message, 500);
  }
}
