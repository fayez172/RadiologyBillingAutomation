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
    const modality = searchParams.get('modality');
    const search = searchParams.get('search');

    const where: any = {};
    if (modality) where.modality = modality;
    if (search) {
      where.OR = [
        { procedure_pattern: { contains: search, mode: 'insensitive' } },
        { type: { contains: search, mode: 'insensitive' } },
        { type_dr: { contains: search, mode: 'insensitive' } }
      ];
    }

    const mappings = await prisma.mapping.findMany({
      where,
      orderBy: [
        { modality: 'asc' },
        { is_regex: 'asc' },
        { priority: 'desc' }
      ]
    });
    
    return success(mappings);
  } catch (err: any) {
    return error('INTERNAL_ERROR', err.message, 500);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return error('FORBIDDEN', 'Must be admin', 403);
    }

    const body = await req.json();
    const { modality, procedure_pattern, is_regex, type, type_dr, priority, is_active } = body;

    if (!modality || !procedure_pattern || !type || !type_dr) {
      return error('BAD_REQUEST', 'Missing required fields', 400);
    }

    const mapping = await prisma.mapping.create({
      data: {
        modality: modality.trim(),
        procedure_pattern: procedure_pattern.trim(),
        is_regex: Boolean(is_regex),
        type: type.trim(),
        type_dr: type_dr.trim(),
        priority: priority ? parseInt(priority) : 0,
        is_active: is_active !== undefined ? Boolean(is_active) : true
      }
    });

    // Trigger background re-mapping of relevant studies
    import('@/lib/mapping-engine').then(m => m.mapUnmappedStudies()).catch(console.error);

    return success(mapping);
  } catch (err: any) {
    if (err.code === 'P2002') return error('CONFLICT', 'Mapping for this modality and pattern already exists.', 409);
    return error('INTERNAL_ERROR', err.message, 500);
  }
}
