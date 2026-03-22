import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { error as apiError, success } from '@/lib/api-response';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const body = await req.json();
    const { name, email, is_active } = body;

    const existing = await prisma.radiologist.findUnique({
      where: { id: params.id }
    });

    if (!existing) return apiError('NOT_FOUND', 'Radiologist not found', 404);

    if (name && name.trim() !== existing.name) {
      const nameCheck = await prisma.radiologist.findUnique({ where: { name: name.trim() } });
      if (nameCheck) return apiError('BAD_REQUEST', 'Radiologist name already exists', 400);
    }

    const updated = await prisma.radiologist.update({
      where: { id: params.id },
      data: {
        name: name ? name.trim() : undefined,
        email: email !== undefined ? (email?.trim() || null) : undefined,
        is_active: is_active !== undefined ? is_active : undefined
      }
    });

    return success(updated);
  } catch (err: any) {
    console.error('[RADIOLOGISTS_PUT]', err);
    return apiError('INTERNAL_ERROR', 'Failed to update radiologist', 500);
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const radiologist = await prisma.radiologist.findUnique({
      where: { id: params.id }
    });

    if (!radiologist) return apiError('NOT_FOUND', 'Not found', 404);

    // Delete aliases first, then radiologist
    await prisma.$transaction([
      prisma.radiologistAlias.deleteMany({ where: { radiologist_id: params.id } }),
      prisma.radiologistPrice.deleteMany({ where: { radiologist_id: params.id } }),
      prisma.radiologist.delete({ where: { id: params.id } })
    ]);

    return success({ deleted: true });
  } catch (err: any) {
    console.error('[RADIOLOGISTS_DELETE]', err);
    return apiError('INTERNAL_ERROR', 'Failed to delete radiologist', 500);
  }
}
