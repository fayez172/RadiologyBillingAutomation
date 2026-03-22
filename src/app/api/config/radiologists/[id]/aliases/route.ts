import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { error as apiError, success } from '@/lib/api-response';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const aliases = await prisma.radiologistAlias.findMany({
      where: { radiologist_id: params.id },
      include: { instance: { select: { name: true } } },
      orderBy: { alias_name: 'asc' }
    });

    return success(aliases);
  } catch (err: any) {
    console.error('[RAD_ALIASES_GET]', err);
    return apiError('INTERNAL_ERROR', 'Failed to fetch aliases', 500);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const body = await req.json();
    const { alias_name, instance_id } = body;

    if (!alias_name?.trim()) return apiError('BAD_REQUEST', 'Alias name required', 400);

    const existing = await prisma.radiologistAlias.findFirst({
      where: {
        alias_name: alias_name.trim(),
        instance_id: instance_id || null
      }
    });

    if (existing) {
      if (existing.radiologist_id === params.id) {
        return apiError('BAD_REQUEST', 'This alias already exists for this radiologist', 400);
      } else {
        return apiError('BAD_REQUEST', 'This alias belongs to another radiologist', 400);
      }
    }

    const alias = await prisma.radiologistAlias.create({
      data: {
        radiologist_id: params.id,
        alias_name: alias_name.trim(),
        instance_id: instance_id || null
      },
      include: { instance: { select: { name: true } } }
    });

    return success(alias);
  } catch (err: any) {
    console.error('[RAD_ALIASES_POST]', err);
    return apiError('INTERNAL_ERROR', 'Failed to add alias', 500);
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const { searchParams } = new URL(req.url);
    const aliasId = searchParams.get('aliasId');

    if (!aliasId) return apiError('BAD_REQUEST', 'Alias ID required', 400);

    await prisma.radiologistAlias.delete({
      where: { id: aliasId, radiologist_id: params.id }
    });

    return success({ deleted: true });
  } catch (err: any) {
    console.error('[RAD_ALIASES_DELETE]', err);
    return apiError('INTERNAL_ERROR', 'Failed to delete alias', 500);
  }
}
