import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { error as apiError, success } from '@/lib/api-response';

export async function PUT(req: Request, { params }: { params: { id: string, priceId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const body = await req.json();
    const { type_dr, price, effective_from, effective_to } = body;

    const existing = await prisma.radiologistPrice.findUnique({
      where: { id: params.priceId }
    });

    if (!existing || existing.radiologist_id !== params.id) {
      return apiError('NOT_FOUND', 'Radiologist price not found', 404);
    }

    const updated = await prisma.radiologistPrice.update({
      where: { id: params.priceId },
      data: {
        type_dr: type_dr ? type_dr.trim() : undefined,
        price: price !== undefined ? Number(price) : undefined,
        effective_from: effective_from ? new Date(effective_from) : undefined,
        effective_to: effective_to ? new Date(effective_to) : (effective_to === null ? null : undefined)
      }
    });

    return success(updated);
  } catch (err: any) {
    console.error('[RAD_PRICES_PUT]', err);
    return apiError('INTERNAL_ERROR', 'Failed to update radiologist price', 500);
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string, priceId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return apiError('UNAUTHORIZED', 'Unauthorized', 401);

    const existing = await prisma.radiologistPrice.findUnique({
      where: { id: params.priceId }
    });

    if (!existing || existing.radiologist_id !== params.id) {
      return apiError('NOT_FOUND', 'Radiologist price not found', 404);
    }

    await prisma.radiologistPrice.delete({
      where: { id: params.priceId }
    });

    return success({ deleted: true });
  } catch (err: any) {
    console.error('[RAD_PRICES_DELETE]', err);
    return apiError('INTERNAL_ERROR', 'Failed to delete radiologist price', 500);
  }
}
